import { mkdir, readdir } from "node:fs/promises";
import { Elysia, t } from "elysia";
import sanitize from "sanitize-filename";
import { outputDir, uploadsDir } from "..";
import { isConverterAvailable } from "../converters/availability";
import { handleConvert } from "../converters/main";
import db from "../db/db";
import { Jobs } from "../db/types";
import { WEBROOT } from "../helpers/env";
import { normalizeFiletype } from "../helpers/normalizeFiletype";
import { resolveConverter } from "../services/features";
import { consumeConversions, getQuotaContext } from "../services/quota";
import { userService } from "./user";

export const convert = new Elysia().use(userService).post(
  "/convert",
  async ({ body, redirect, jwt, request, server, cookie: { auth, jobId } }) => {
    if (!auth?.value) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    const user = await jwt.verify(auth.value);
    if (!user) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    if (!jobId?.value) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const existingJob = db
      .query("SELECT * FROM jobs WHERE id = ? AND user_id = ?")
      .as(Jobs)
      .get(jobId.value, user.id);

    if (!existingJob) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const userUploadsDir = `${uploadsDir}${user.id}/${jobId.value}/`;
    const userOutputDir = `${outputDir}${user.id}/${jobId.value}/`;

    // create the output directory
    try {
      await mkdir(userOutputDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create the output directory: ${userOutputDir}.`, error);
    }

    const convertTo = normalizeFiletype(body.convert_to.split(",")[0] ?? "");

    if (convertTo.includes("/") || convertTo.includes("\\") || convertTo.includes("..")) {
      return redirect(`${WEBROOT}/?limit=converter`, 302);
    }

    const fileNames = JSON.parse(body.file_names) as string[];

    for (let i = 0; i < fileNames.length; i++) {
      fileNames[i] = sanitize(fileNames[i] || "");
    }

    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      return redirect(`${WEBROOT}/?limit=nofiles`, 302);
    }

    // Customers choose a format, never a tool. The converter is worked out here from the
    // admin's preference and what the upload actually is, so a stale form cannot pin a
    // converter that has since been retired, nor one that cannot read this file type.
    const firstFile = fileNames[0] ?? "";
    const sourceType = normalizeFiletype(
      firstFile.includes(".") ? firstFile.split(".").pop()! : "",
    );
    const converterName = resolveConverter(sourceType, convertTo);

    if (!converterName || !isConverterAvailable(converterName)) {
      return redirect(`${WEBROOT}/?limit=converter`, 302);
    }

    // A resumable upload only appears in the job folder once it is complete, so this
    // also stops a conversion being started on a file that is still uploading
    const uploaded = await readdir(userUploadsDir).catch(() => [] as string[]);
    if (fileNames.some((fileName) => !uploaded.includes(fileName))) {
      return redirect(`${WEBROOT}/?limit=upload`, 302);
    }

    const { tier, subject, isGuest, dailyLimit } = getQuotaContext(user.id, request, server);
    if (fileNames.length > tier.batch_limit) {
      return redirect(`${WEBROOT}/?limit=batch#pricing`, 302);
    }
    // One conversion is one task, however many files it carries: a visitor converting
    // four photos in one go has done one thing, not four. The number of files in a task
    // is capped separately by the plan's batch limit.
    if (!consumeConversions(subject, dailyLimit, 1)) {
      // A visitor who used their free conversion is asked to create an account,
      // which is free; a signed-in user has genuinely reached their plan's limit
      return isGuest
        ? redirect(`${WEBROOT}/register?reason=free-used`, 302)
        : redirect(`${WEBROOT}/?limit=daily#pricing`, 302);
    }

    db.query(
      "UPDATE jobs SET num_files = ?1, status = 'pending', convert_to = ?2, converter = ?3 WHERE id = ?4",
    ).run(fileNames.length, convertTo, converterName, jobId.value);

    const jobKey = jobId.value;

    // Start the conversion process in the background
    handleConvert(
      fileNames,
      userUploadsDir,
      userOutputDir,
      convertTo,
      converterName,
      jobId,
      tier.priority_queue,
      { density: body.quality === "300" ? 300 : 150 },
    )
      .catch((error) => {
        console.error("Error in conversion process:", error);
      })
      .finally(() => {
        // Always finish the job, even after an error: the results page waits for this
        db.query("UPDATE jobs SET status = 'completed' WHERE id = ?1").run(jobKey);
      });

    // Redirect the client immediately
    return redirect(`${WEBROOT}/results/${jobId.value}`, 302);
  },
  {
    body: t.Object({
      convert_to: t.String(),
      file_names: t.String(),
      // Resolution for rasterising documents such as PDF, in DPI
      quality: t.Optional(t.String()),
    }),
    auth: true,
  },
);
