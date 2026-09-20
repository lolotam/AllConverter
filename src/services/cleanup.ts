// Deleting jobs whose files have outlived the retention window. Shared by the timer in
// index.tsx and the "run cleanup now" button in the admin dashboard.
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import db from "../db/db";
import { AUTO_DELETE_EVERY_N_HOURS } from "../helpers/env";
import { incompleteUploadsDir, outputDir, uploadsDir } from "../helpers/paths";
import { getSetting, setSetting } from "./settings";

const ENABLED_KEY = "cleanup.enabled";
const OVERRIDE_KEY = "cleanup.overrideHours";

/** Hours an admin may pick instead of each plan's own window. */
export const CLEANUP_INTERVAL_CHOICES = [2, 4, 6, 12, 24];

/**
 * Whether files are deleted automatically at all. The dashboard setting wins; with no
 * setting saved, AUTO_DELETE_EVERY_N_HOURS decides, as it always did.
 */
export function cleanupEnabled(): boolean {
  const stored = getSetting(ENABLED_KEY);
  return stored === null ? AUTO_DELETE_EVERY_N_HOURS > 0 : stored === "1";
}

export function setCleanupEnabled(enabled: boolean): void {
  setSetting(ENABLED_KEY, enabled ? "1" : "0");
}

/** One window for everybody, or null to use each plan's retention. */
export function cleanupOverrideHours(): number | null {
  const raw = getSetting(OVERRIDE_KEY);
  const hours = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

export function setCleanupOverrideHours(hours: number | null): void {
  setSetting(OVERRIDE_KEY, hours === null ? null : String(hours));
}

/**
 * On a server that has been running with one global window, per-tier retention would
 * silently start deleting free users' files much sooner. So the first start after this
 * change keeps the window it already had, and the dashboard offers the switch to
 * per-plan retention as a deliberate choice.
 */
export function ensureCleanupDefaults(): void {
  if (getSetting(OVERRIDE_KEY) === null && getSetting(ENABLED_KEY) === null) {
    if (AUTO_DELETE_EVERY_N_HOURS > 0) {
      setCleanupOverrideHours(AUTO_DELETE_EVERY_N_HOURS);
    }
    setCleanupEnabled(AUTO_DELETE_EVERY_N_HOURS > 0);
  }
}

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
  // A caller with an explicit window (the admin dashboard) overrides the settings;
  // the timer passes nothing and follows them
  if (olderThanHours === undefined) {
    if (!cleanupEnabled()) {
      return 0;
    }
    const override = cleanupOverrideHours();
    if (override !== null) {
      olderThanHours = override;
    }
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

/**
 * Deletes every stored job and its files, for every user, whether or not it has expired.
 * Nothing is recoverable afterwards, so only the admin dashboard calls this, behind a
 * confirmation.
 */
export function purgeAllJobs(): number {
  const jobs = db.query("SELECT id, user_id FROM jobs").all() as { id: number; user_id: number }[];

  for (const job of jobs) {
    rmSync(path.resolve(`${outputDir}${job.user_id}/${job.id}`), { recursive: true, force: true });
    rmSync(path.resolve(`${uploadsDir}${job.user_id}/${job.id}`), { recursive: true, force: true });
  }

  db.query("DELETE FROM file_names").run();
  db.query("DELETE FROM jobs").run();

  // Folders left behind by jobs the database no longer knows about — an older database,
  // a failed delete — are still storage, and "delete everything" has to mean everything
  for (const directory of [outputDir, uploadsDir, incompleteUploadsDir]) {
    try {
      for (const entry of readdirSync(path.resolve(directory))) {
        rmSync(path.resolve(directory, entry), { recursive: true, force: true });
      }
    } catch {
      // The directory may not exist yet; nothing to remove either way
    }
  }

  return jobs.length;
}
