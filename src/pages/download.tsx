import path from "node:path";
import { Elysia } from "elysia";
import sanitize from "sanitize-filename";
import * as tar from "tar";
import { outputDir } from "..";
import db from "../db/db";
import { WEBROOT } from "../helpers/env";
import { isHtmlPageRequest } from "../helpers/isHtmlPageRequest";
import { verifyDownloadToken } from "../services/downloadToken";
import { userService } from "./user";

type JwtVerifier = { verify: (token: string) => Promise<{ id: string } | false> };

/**
 * Downloads accept either the session cookie or a signed link. Download managers fetch
 * outside the browser's cookie jar, so without the signed link they would be refused and
 * would ask the user for a password nothing on the server wants. See docs/download-auth.md.
 */
async function resolveDownloader(
  jwt: JwtVerifier,
  cookieValue: string | undefined,
  token: string | undefined,
  expect: { jobId: string; fileName?: string },
): Promise<string | null> {
  const signed = verifyDownloadToken(token, expect);
  if (signed) {
    return signed;
  }

  if (!cookieValue) {
    return null;
  }
  const user = await jwt.verify(cookieValue);
  return user ? String(user.id) : null;
}

export const download = new Elysia()
  .use(userService)
  .get(
    "/download/:userId/:jobId/:fileName",
    async ({ params, query, redirect, set, jwt, cookie, request }) => {
      const jobId = decodeURIComponent(params.jobId);
      const fileName = sanitize(decodeURIComponent(params.fileName));

      const token = typeof query.token === "string" ? query.token : undefined;
      const session = typeof cookie.auth?.value === "string" ? cookie.auth.value : undefined;
      const userId = await resolveDownloader(jwt, session, token, {
        jobId,
        fileName,
      });
      if (!userId) {
        if (isHtmlPageRequest(request)) {
          return redirect(`${WEBROOT}/login`, 302);
        }
        set.status = 401;
        return { success: false, message: "Unauthorized" };
      }

      const job = db.query("SELECT * FROM jobs WHERE user_id = ? AND id = ?").get(userId, jobId);
      if (!job) {
        return redirect(`${WEBROOT}/history`, 302);
      }

      const filePath = `${outputDir}${userId}/${jobId}/${fileName}`;
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        set.status = 404;
        return { message: "Converted file not found." };
      }

      // Previews and card thumbnails ask for the file inline; everything else downloads
      const disposition = query.inline ? "inline" : "attachment";
      set.headers["content-disposition"] =
        `${disposition}; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
      return file;
    },
  )
  .get("/archive/:jobId", async ({ params, query, redirect, set, jwt, cookie, request }) => {
    const jobId = decodeURIComponent(params.jobId);

    const token = typeof query.token === "string" ? query.token : undefined;
    const session = typeof cookie.auth?.value === "string" ? cookie.auth.value : undefined;
    const userId = await resolveDownloader(jwt, session, token, { jobId });
    if (!userId) {
      if (isHtmlPageRequest(request)) {
        return redirect(`${WEBROOT}/login`, 302);
      }
      set.status = 401;
      return { success: false, message: "Unauthorized" };
    }

    const job = db.query("SELECT * FROM jobs WHERE user_id = ? AND id = ?").get(userId, jobId);
    if (!job) {
      return redirect(`${WEBROOT}/history`, 302);
    }

    const outputPath = `${outputDir}${userId}/${jobId}`;
    const archiveName = `converted_files_${jobId}.tar`;
    const outputTar = path.join(outputPath, archiveName);

    await tar.create(
      {
        file: outputTar,
        cwd: outputPath,
        filter: (path) => {
          return !path.match(".*\\.tar");
        },
      },
      ["."],
    );

    // The URL ends in the job id, so without this the archive is saved as "12"
    set.headers["content-disposition"] = `attachment; filename="${archiveName}"`;
    return Bun.file(outputTar);
  });
