// Resumable uploads over the tus protocol (https://tus.io), so a large file is sent
// as a series of small requests. Cloudflare rejects any proxied request over 100 MB
// and cuts one off after 100 seconds, which a single whole-file upload cannot avoid.
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { FileStore } from "@tus/file-store";
import { MemoryLocker, Server, type Upload } from "@tus/server";
import sanitize from "sanitize-filename";
import { Tier } from "../db/types";
import { TUS_UPLOAD_EXPIRY_HOURS, WEBROOT } from "../helpers/env";
import { incompleteUploadsDir, uploadsDir } from "../helpers/paths";
import { MB } from "./quota";

export type UploadContext = { userId: string; jobId: string; tier: Tier; existingFiles: string[] };

// The tus handler only receives the raw request, so the authenticated user and job
// are carried from the route through async context instead of client-supplied metadata.
export const uploadContext = new AsyncLocalStorage<UploadContext>();

export function fileNameOf(upload: Upload): string {
  const name = upload.metadata?.filename;
  return typeof name === "string" ? sanitize(name) : "";
}

export function assertUploadAllowed(
  context: UploadContext,
  upload: { size: number | undefined; name: string },
): void {
  if (!upload.name) {
    throw { status_code: 400, body: "A filename is required." };
  }

  const limitBytes = context.tier.max_file_size_mb * MB;
  if (upload.size === undefined || upload.size > limitBytes) {
    throw {
      status_code: 413,
      body: `"${upload.name}" exceeds the ${context.tier.max_file_size_mb} MB limit of the ${context.tier.name} plan.`,
    };
  }

  // Uploading the same name again replaces it, so it does not add to the batch
  const names = new Set([...context.existingFiles, upload.name]);
  if (names.size > context.tier.batch_limit) {
    throw {
      status_code: 429,
      body: `The ${context.tier.name} plan allows up to ${context.tier.batch_limit} files per conversion.`,
    };
  }
}

export const tusServer = new Server({
  path: `${WEBROOT}/files`,
  datastore: new FileStore({
    directory: incompleteUploadsDir,
    expirationPeriodInMilliseconds: TUS_UPLOAD_EXPIRY_HOURS * 60 * 60 * 1000,
  }),
  locker: new MemoryLocker(),
  // Dokploy's proxy terminates TLS, so the upload URL must follow the forwarded host
  respectForwardedHeaders: true,
  async onUploadCreate(_req, upload) {
    const context = uploadContext.getStore();
    if (!context) {
      throw { status_code: 401, body: "Unauthorized" };
    }

    const name = fileNameOf(upload);
    assertUploadAllowed(context, { size: upload.size, name });

    // Store who the upload belongs to: the finish hook runs in the same request,
    // but the metadata also makes an abandoned upload traceable
    return {
      metadata: {
        ...upload.metadata,
        filename: name,
        userId: context.userId,
        jobId: context.jobId,
      },
    };
  },
  async onUploadFinish(_req, upload) {
    const userId = upload.metadata?.userId;
    const jobId = upload.metadata?.jobId;
    const name = fileNameOf(upload);
    if (!userId || !jobId || !name) {
      throw { status_code: 400, body: "Upload is missing its job details." };
    }

    const targetDir = join(uploadsDir, userId, jobId);
    await mkdir(targetDir, { recursive: true });
    // Same filesystem, so this is atomic: the file appears complete or not at all
    await rename(join(incompleteUploadsDir, upload.id), join(targetDir, name));
    await unlink(join(incompleteUploadsDir, `${upload.id}.json`)).catch(() => {});

    console.log(
      `Upload complete: "${name}" (${upload.size ?? 0} bytes) for job ${jobId} of user ${userId}`,
    );
    return {};
  },
});

/** Deletes partial uploads that were abandoned, freeing their disk space. */
export async function cleanUpExpiredUploads(): Promise<void> {
  try {
    const removed = await tusServer.cleanUpExpiredUploads();
    if (removed > 0) {
      console.log(`Removed ${removed} expired incomplete upload(s).`);
    }
  } catch (error) {
    console.error("Failed to clean up expired uploads:", error);
  }
}
