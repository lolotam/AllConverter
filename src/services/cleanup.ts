// Deleting jobs whose files have outlived the retention window. Shared by the timer in
// index.tsx and the "run cleanup now" button in the admin dashboard.
import { rmSync } from "node:fs";
import db from "../db/db";
import { Jobs } from "../db/types";
import { AUTO_DELETE_EVERY_N_HOURS } from "../helpers/env";
import { outputDir, uploadsDir } from "../helpers/paths";

/**
 * Removes every job older than the retention window, with its uploads and its results.
 * Returns how many were deleted.
 */
export function deleteExpiredJobs(olderThanHours = AUTO_DELETE_EVERY_N_HOURS): number {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
  const expired = db.query("SELECT * FROM jobs WHERE date_created < ?").as(Jobs).all(cutoff);

  for (const job of expired) {
    rmSync(`${outputDir}${job.user_id}/${job.id}`, { recursive: true, force: true });
    rmSync(`${uploadsDir}${job.user_id}/${job.id}`, { recursive: true, force: true });

    db.query("DELETE FROM file_names WHERE job_id = ?").run(job.id);
    db.query("DELETE FROM jobs WHERE id = ?").run(job.id);
  }

  return expired.length;
}
