import { mkdir } from "node:fs/promises";
import { Elysia, t } from "elysia";
import sanitize from "sanitize-filename";
import { outputDir, uploadsDir } from "..";
import { isConverterAvailable } from "../converters/availability";
import { handleConvert } from "../converters/main";
import db from "../db/db";
import { Jobs } from "../db/types";
import { WEBROOT } from "../helpers/env";
import { normalizeFiletype } from "../helpers/normalizeFiletype";
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
    const converterName = body.convert_to.split(",")[1];

    if (
      !converterName ||
      !isConverterAvailable(converterName) ||
      convertTo.includes("/") ||
      convertTo.includes("\\") ||
      convertTo.includes("..")
    ) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const fileNames = JSON.parse(body.file_names) as string[];

    for (let i = 0; i < fileNames.length; i++) {
      fileNames[i] = sanitize(fileNames[i] || "");
    }

    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const { tier, subject } = getQuotaContext(user.id, request, server);
    if (fileNames.length > tier.batch_limit) {
      return redirect(`${WEBROOT}/?limit=batch#pricing`, 302);
    }
    if (!consumeConversions(subject, tier, fileNames.length)) {
      return redirect(`${WEBROOT}/?limit=daily#pricing`, 302);
    }

    db.query("UPDATE jobs SET num_files = ?1, status = 'pending' WHERE id = ?2").run(
      fileNames.length,
      jobId.value,
    );

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
    }),
    auth: true,
  },
);
