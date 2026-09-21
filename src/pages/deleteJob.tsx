import { Elysia, t } from "elysia";
import db from "../db/db";
import { WEBROOT } from "../helpers/env";
import { deleteJobs } from "../services/cleanup";
import { userService } from "./user";
import { Jobs } from "../db/types";

export const deleteJob = new Elysia()
  .use(userService)
  // SECURE: Use POST instead of GET for state-changing actions to prevent CSRF.
  // Browsers automatically follow GET links, which can lead to silent data deletion.
  .post(
    "/delete/:jobId",
    async ({ params, redirect, user }) => {
      const job = db
        .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
        .as(Jobs)
        .get(user.id, params.jobId);

      if (!job) {
        return redirect(`${WEBROOT}/results`, 302);
      }

      deleteJobs([job]);
      return redirect(`${WEBROOT}/history`, 302);
    },
    {
      auth: true,
    },
  )
  .post(
    "/delete-multiple",
    async ({ body, user, set }) => {
      const { jobIds } = body;

      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        set.status = 400;
        return { success: false, message: "Invalid job IDs provided" };
      }

      const results = {
        success: [] as string[],
        failed: [] as { jobId: string; error: string }[],
      };

      // Process deletions sequentially for safety
      for (const jobId of jobIds) {
        try {
          const job = db
            .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
            .as(Jobs)
            .get(user.id, jobId);

          if (!job) {
            results.failed.push({
              jobId,
              error: "Job not found or unauthorized",
            });
            continue;
          }

          deleteJobs([job]);
          results.success.push(jobId);
        } catch (error) {
          results.failed.push({
            jobId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        success: results.failed.length === 0,
        deleted: results.success.length,
        failed: results.failed.length,
        details: results,
      };
    },
    {
      auth: true,
      body: t.Object({
        jobIds: t.Array(t.String(), { maxItems: 100 }),
      }),
    },
  );
