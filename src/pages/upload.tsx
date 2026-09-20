import { readdir } from "node:fs/promises";
import { Elysia, t } from "elysia";
import db from "../db/db";
import { WEBROOT } from "../helpers/env";
import { uploadsDir } from "../helpers/paths";
import { userService } from "./user";
import sanitize from "sanitize-filename";
import { getQuotaContext, MB } from "../services/quota";
import { tusServer, uploadContext } from "../services/tus";

export const upload = new Elysia().use(userService).post(
  "/upload",
  async ({ body, redirect, user, request, server, status, cookie: { jobId } }) => {
    if (!jobId?.value) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const existingJob = await db
      .query("SELECT * FROM jobs WHERE id = ? AND user_id = ?")
      .get(jobId.value, user.id);

    if (!existingJob) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const userUploadsDir = `${uploadsDir}${user.id}/${jobId.value}/`;

    const files = Array.isArray(body.file) ? body.file : [body.file];
    const { tier } = getQuotaContext(user.id, request, server);

    const tooLarge = files.find((file) => file.size > tier.max_file_size_mb * MB);
    if (tooLarge) {
      return status(413, {
        message: `"${tooLarge.name}" exceeds the ${tier.max_file_size_mb} MB limit of the ${tier.name} plan.`,
      });
    }

    // Re-uploading an existing name overwrites it, so count unique names only
    const existing = await readdir(userUploadsDir).catch(() => [] as string[]);
    const fileCount = new Set([...existing, ...files.map((file) => sanitize(file.name))]).size;
    if (fileCount > tier.batch_limit) {
      return status(429, {
        message: `The ${tier.name} plan allows up to ${tier.batch_limit} files per conversion.`,
      });
    }

    for (const file of files) {
      await Bun.write(`${userUploadsDir}${sanitize(file.name)}`, file);
    }

    return {
      message: "Files uploaded successfully.",
    };
  },
  { body: t.Object({ file: t.Files() }), auth: true },
);

/**
 * Resumable uploads (tus protocol). The browser sends the file in chunks, so no
 * single request carries the whole file: Cloudflare rejects proxied requests over
 * 100 MB and times them out after 100 seconds.
 *
 * Every request is authenticated here, and the job and plan limits are put into
 * async context for the hooks in services/tus.ts.
 */
const handleTus = async ({
  request,
  server,
  user,
  status,
  cookie: { jobId },
}: {
  request: Request;
  server: { requestIP(request: Request): { address: string } | null } | null;
  user: { id: string };
  status: (code: number, body: unknown) => unknown;
  cookie: { jobId?: { value?: string | undefined } };
}) => {
  if (!jobId?.value) {
    return status(400, { message: "No conversion in progress." });
  }

  const job = db
    .query("SELECT id FROM jobs WHERE id = ? AND user_id = ?")
    .get(jobId.value, user.id);
  if (!job) {
    return status(404, { message: "Job not found." });
  }

  const { tier } = getQuotaContext(user.id, request, server);
  const userUploadsDir = `${uploadsDir}${user.id}/${jobId.value}/`;
  const existingFiles = await readdir(userUploadsDir).catch(() => [] as string[]);

  return uploadContext.run({ userId: user.id, jobId: jobId.value, tier, existingFiles }, () =>
    tusServer.handleWeb(request),
  );
};

export const resumableUpload = new Elysia()
  .use(userService)
  // POST creates an upload, OPTIONS advertises the protocol
  .all("/files", handleTus, { parse: "none", auth: true })
  // HEAD reports the offset to resume from, PATCH appends a chunk, DELETE cancels
  .all("/files/*", handleTus, { parse: "none", auth: true });
