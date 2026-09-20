// Deleting jobs whose files have outlived the retention window. Shared by the timer in
// index.tsx and the "run cleanup now" button in the admin dashboard.
import { rmSync } from "node:fs";
import path from "node:path";
import db from "../db/db";
import { AUTO_DELETE_EVERY_N_HOURS } from "../helpers/env";
import { outputDir, uploadsDir } from "../helpers/paths";

type ExpiredJob = {
  id: number;
  user_id: number;
  date_created: string;
  retention_hours?: number;
};

/**
 * Removes every job older than its retention window, with its uploads and its results.
 * When olderThanHours is explicitly provided, it overrides per-tier retention.
 * Otherwise, each job is evaluated against its owner's tier retention (Free = 2h, Pro = 24h, Business = 168h).
 * Returns how many were deleted.
 */
export function deleteExpiredJobs(olderThanHours?: number): number {
  if (olderThanHours === undefined && AUTO_DELETE_EVERY_N_HOURS === 0) {
    return 0;
  }

  let expired: ExpiredJob[];

  if (typeof olderThanHours === "number" && olderThanHours >= 0) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
    expired = db
      .query("SELECT id, user_id, date_created FROM jobs WHERE date_created < ?")
      .all(cutoff) as ExpiredJob[];
  } else {
    // Per-tier retention: look up the retention_hours based on the owning user's tier.
    // Guests or users without a tier default to the Free tier retention (or AUTO_DELETE_EVERY_N_HOURS fallback).
    const fallbackHours = AUTO_DELETE_EVERY_N_HOURS > 0 ? AUTO_DELETE_EVERY_N_HOURS : 2;

    // Nothing can expire before the shortest window has passed, so let SQLite drop the
    // jobs that are obviously too young instead of loading every job ever run
    const shortestHours = Math.min(
      fallbackHours,
      ...(db.query("SELECT retention_hours FROM tiers").all() as { retention_hours: number }[]).map(
        (tier) => tier.retention_hours,
      ),
    );
    const earliestCutoff = new Date(Date.now() - shortestHours * 60 * 60 * 1000).toISOString();

    const candidates = db
      .query(
        `
      SELECT j.id, j.user_id, j.date_created,
             COALESCE(t.retention_hours, free_tier.retention_hours, ?) AS retention_hours
      FROM jobs j
      LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(j.user_id AS TEXT)
      LEFT JOIN tiers t ON t.id = u.tier
      LEFT JOIN tiers free_tier ON free_tier.id = 'free'
      WHERE j.date_created < ?
    `,
      )
      .all(fallbackHours, earliestCutoff) as ExpiredJob[];

    const now = Date.now();
    expired = candidates.filter((job) => {
      const created = new Date(job.date_created).getTime();
      const retentionMs = (job.retention_hours ?? fallbackHours) * 60 * 60 * 1000;
      return now - created >= retentionMs;
    });
  }

  for (const job of expired) {
    rmSync(path.resolve(`${outputDir}${job.user_id}/${job.id}`), { recursive: true, force: true });
    rmSync(path.resolve(`${uploadsDir}${job.user_id}/${job.id}`), { recursive: true, force: true });

    db.query("DELETE FROM file_names WHERE job_id = ?").run(job.id);
    db.query("DELETE FROM jobs WHERE id = ?").run(job.id);
  }

  return expired.length;
}
