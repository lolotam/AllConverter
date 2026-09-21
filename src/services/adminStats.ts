// Numbers for the admin dashboard: what the disk holds, what the queue is doing, how
// conversions have been going, and whether the machine is healthy.
import { existsSync, readdirSync, statSync, statfsSync } from "node:fs";
import { join } from "node:path";
import { unavailableConverters } from "../converters/availability";
import { activeJobs } from "../converters/progress";
import db from "../db/db";
import { GUEST_FREE_CONVERSIONS } from "../helpers/env";
import { avatarsDir, incompleteUploadsDir, outputDir, uploadsDir } from "../helpers/paths";
import { conversionQueue } from "../helpers/queue";
import { describeRetention, shortRetention } from "./retention";

export const FAILED_STATUSES = ["Failed, check logs", "File type not supported"];

const dbPath = process.env.DB_PATH ?? "./data/mydb.sqlite";

function directorySize(directory: string): { bytes: number; files: number } {
  let bytes = 0;
  let files = 0;
  if (!existsSync(directory)) {
    return { bytes, files };
  }

  // The trees here are shallow (user / job / file), so walking them on request is cheap
  // enough and always tells the truth, unlike a cached total
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else {
        try {
          bytes += statSync(path).size;
          files += 1;
        } catch {
          // Cleanup can delete a file while we are counting it
        }
      }
    }
  };

  try {
    walk(directory);
  } catch {
    // An unreadable directory should never take the dashboard down
  }
  return { bytes, files };
}

export type StorageUsage = {
  areas: { name: string; path: string; bytes: number; files: number }[];
  totalBytes: number;
  disk: { totalBytes: number; freeBytes: number; usedPercent: number } | null;
  biggestJobs: { jobId: number; userId: number; bytes: number; files: number }[];
  retentionDescription: string;
};

export function storageUsage(): StorageUsage {
  const areas = [
    { name: "Converted files", path: outputDir, ...directorySize(outputDir) },
    { name: "Uploads", path: uploadsDir, ...directorySize(uploadsDir) },
    {
      name: "Unfinished uploads",
      path: incompleteUploadsDir,
      ...directorySize(incompleteUploadsDir),
    },
    { name: "Profile pictures", path: avatarsDir, ...directorySize(avatarsDir) },
    {
      name: "Database",
      path: dbPath,
      bytes: existsSync(dbPath) ? statSync(dbPath).size : 0,
      files: existsSync(dbPath) ? 1 : 0,
    },
  ];

  let disk: StorageUsage["disk"] = null;
  try {
    const fs = statfsSync(outputDir);
    const totalBytes = fs.blocks * fs.bsize;
    const freeBytes = fs.bavail * fs.bsize;
    disk = {
      totalBytes,
      freeBytes,
      usedPercent: totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0,
    };
  } catch {
    // Not every platform reports this; the area totals above still do
  }

  const biggestJobs = jobSizes().slice(0, 10);

  return {
    areas,
    totalBytes: areas.reduce((total, area) => total + area.bytes, 0),
    disk,
    biggestJobs,
    retentionDescription: describeRetention(),
  };
}

/** Every job that still owns output on disk, largest first. */
function jobSizes(): { jobId: number; userId: number; bytes: number; files: number }[] {
  const sizes: { jobId: number; userId: number; bytes: number; files: number }[] = [];
  if (!existsSync(outputDir)) {
    return sizes;
  }

  for (const userEntry of readdirSync(outputDir, { withFileTypes: true })) {
    if (!userEntry.isDirectory()) {
      continue;
    }
    const userPath = join(outputDir, userEntry.name);
    for (const jobEntry of readdirSync(userPath, { withFileTypes: true })) {
      if (!jobEntry.isDirectory()) {
        continue;
      }
      const { bytes, files } = directorySize(join(userPath, jobEntry.name));
      sizes.push({
        jobId: Number(jobEntry.name),
        userId: Number(userEntry.name),
        bytes,
        files,
      });
    }
  }

  return sizes.sort((a, b) => b.bytes - a.bytes);
}

export type QueueSnapshot = {
  queue: { running: number; waiting: number; concurrency: number };
  active: { jobId: string; converting: number; queued: number; files: string[] }[];
  recentJobs: {
    id: number;
    user_id: number;
    status: string;
    num_files: number;
    date_created: string;
    failed: number;
    done: number;
    from_format: string | null;
    to_format: string | null;
    converter: string | null;
  }[];
  recentFailures: { job_id: number; file_name: string; output_file_name: string; status: string }[];
  /** What was asked for, so the filter bar can show its own state back. */
  filters: JobFilters;
  /** Values actually present in the table, for the filter dropdowns. */
  choices: { statuses: string[]; formats: string[]; owners: number[] };
};

export type JobFilters = {
  status?: string | undefined;
  format?: string | undefined;
  owner?: string | undefined;
  limit?: number | undefined;
};

export const JOB_LIMIT_CHOICES = [15, 50, 100, 250];

// The extension of a stored filename, as SQL: everything after the last dot. `rtrim` strips
// the trailing characters that are not dots, leaving "name.", which `replace` then removes.
const EXTENSION_OF = (column: string) =>
  `lower(replace(${column}, rtrim(${column}, replace(${column}, '.', '')), ''))`;

export function queueSnapshot(filters: JobFilters = {}): QueueSnapshot {
  const active = activeJobs().map(({ jobId, files }) => ({
    jobId,
    converting: files.filter((file) => file.state === "converting").length,
    queued: files.filter((file) => file.state === "queued").length,
    files: files.map((file) => file.file),
  }));

  const placeholders = FAILED_STATUSES.map(() => "?").join(", ");

  // Jobs recorded before convert_to/converter existed still show what they did: the
  // formats are read back off the filenames, which have always been stored
  const toFormat = `COALESCE(j.convert_to, (SELECT ${EXTENSION_OF("f.output_file_name")}
                                              FROM file_names f WHERE f.job_id = j.id LIMIT 1))`;
  const fromFormat = `(SELECT ${EXTENSION_OF("f.file_name")}
                         FROM file_names f WHERE f.job_id = j.id LIMIT 1)`;

  const where: string[] = ["j.num_files > 0"];
  const params: (string | number)[] = [];

  if (filters.status === "failed") {
    where.push(`EXISTS (SELECT 1 FROM file_names f
                         WHERE f.job_id = j.id AND f.status IN (${placeholders}))`);
    params.push(...FAILED_STATUSES);
  } else if (filters.status === "done") {
    where.push(`NOT EXISTS (SELECT 1 FROM file_names f
                             WHERE f.job_id = j.id AND f.status IN (${placeholders}))`);
    params.push(...FAILED_STATUSES);
  } else if (filters.status) {
    where.push("j.status = ?");
    params.push(filters.status);
  }

  if (filters.format) {
    where.push(`${toFormat} = ?`);
    params.push(filters.format.toLowerCase());
  }

  if (filters.owner) {
    where.push("j.user_id = ?");
    params.push(filters.owner);
  }

  const limit = JOB_LIMIT_CHOICES.includes(filters.limit ?? 0) ? (filters.limit ?? 15) : 15;

  const recentJobs = db
    .query(
      `SELECT j.id, j.user_id, j.status, j.num_files, j.date_created, j.converter,
              ${fromFormat} AS from_format,
              ${toFormat} AS to_format,
              (SELECT COUNT(*) FROM file_names f
                WHERE f.job_id = j.id AND f.status IN (${placeholders})) AS failed,
              (SELECT COUNT(*) FROM file_names f
                WHERE f.job_id = j.id AND f.status NOT IN (${placeholders})) AS done
         FROM jobs j
        WHERE ${where.join(" AND ")}
        ORDER BY j.id DESC
        LIMIT ?`,
    )
    // Bound in the order the placeholders appear in the text: the two counting subqueries
    // in the SELECT come before anything in the WHERE
    .all(...FAILED_STATUSES, ...FAILED_STATUSES, ...params, limit) as QueueSnapshot["recentJobs"];

  const recentFailures = db
    .query(
      `SELECT job_id, file_name, output_file_name, status
         FROM file_names
        WHERE status IN (${placeholders})
        ORDER BY job_id DESC
        LIMIT 15`,
    )
    .all(...FAILED_STATUSES) as QueueSnapshot["recentFailures"];

  // Offer only filters that would actually match something
  const choices = {
    statuses: (
      db.query("SELECT DISTINCT status FROM jobs WHERE num_files > 0 ORDER BY status").all() as {
        status: string;
      }[]
    ).map((row) => row.status),
    formats: (
      db
        .query(
          `SELECT DISTINCT ${toFormat} AS format FROM jobs j
            WHERE j.num_files > 0 AND format IS NOT NULL AND format <> ''
            ORDER BY format`,
        )
        .all() as { format: string }[]
    ).map((row) => row.format),
    owners: (
      db.query("SELECT DISTINCT user_id FROM jobs WHERE num_files > 0 ORDER BY user_id").all() as {
        user_id: number;
      }[]
    ).map((row) => row.user_id),
  };

  return {
    queue: conversionQueue.stats(),
    active,
    recentJobs,
    recentFailures,
    filters: { ...filters, limit },
    choices,
  };
}

/** How many files have been produced in each output format, for the admin format table. */
export function formatUsage(): Record<string, number> {
  const rows = db
    .query(
      `SELECT ${EXTENSION_OF("output_file_name")} AS format, COUNT(*) AS count
         FROM file_names
        GROUP BY format`,
    )
    .all() as { format: string; count: number }[];

  return Object.fromEntries(rows.filter((row) => row.format).map((row) => [row.format, row.count]));
}

export type Analytics = {
  perDay: { day: string; jobs: number; files: number }[];
  topFormats: { format: string; count: number }[];
  successRate: { done: number; failed: number; percent: number };
  guestJobs: number;
  accountJobs: number;
};

export function analytics(days = 14): Analytics {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const perDay = db
    .query(
      `SELECT substr(j.date_created, 1, 10) AS day,
              COUNT(*) AS jobs,
              COALESCE(SUM(j.num_files), 0) AS files
         FROM jobs j
        WHERE j.date_created >= ? AND j.num_files > 0
        GROUP BY day
        ORDER BY day`,
    )
    .all(since) as Analytics["perDay"];

  const topFormats = db
    .query(
      `SELECT lower(replace(output_file_name, rtrim(output_file_name, replace(output_file_name, '.', '')), '')) AS format,
              COUNT(*) AS count
         FROM file_names
        GROUP BY format
        ORDER BY count DESC
        LIMIT 10`,
    )
    .all() as Analytics["topFormats"];

  const placeholders = FAILED_STATUSES.map(() => "?").join(", ");
  const failed = (
    db
      .query(`SELECT COUNT(*) AS count FROM file_names WHERE status IN (${placeholders})`)
      .get(...FAILED_STATUSES) as { count: number }
  ).count;
  const total = (db.query("SELECT COUNT(*) AS count FROM file_names").get() as { count: number })
    .count;
  const done = total - failed;

  // A job belongs to a guest when its user id has no row in users
  const guestJobs = (
    db
      .query(
        "SELECT COUNT(*) AS count FROM jobs WHERE num_files > 0 AND user_id NOT IN (SELECT id FROM users)",
      )
      .get() as { count: number }
  ).count;
  const accountJobs = (
    db
      .query(
        "SELECT COUNT(*) AS count FROM jobs WHERE num_files > 0 AND user_id IN (SELECT id FROM users)",
      )
      .get() as { count: number }
  ).count;

  return {
    perDay,
    topFormats,
    successRate: { done, failed, percent: total > 0 ? Math.round((done / total) * 100) : 100 },
    guestJobs,
    accountJobs,
  };
}

export type SystemHealth = {
  uptimeSeconds: number;
  bunVersion: string;
  databaseBytes: number;
  missingConverters: { converter: string; missing: string[] }[];
  settings: { label: string; value: string }[];
};

export function systemHealth(features: { label: string; value: string }[] = []): SystemHealth {
  return {
    uptimeSeconds: Math.floor(process.uptime()),
    bunVersion: Bun.version,
    databaseBytes: existsSync(dbPath) ? statSync(dbPath).size : 0,
    missingConverters: unavailableConverters(),
    settings: [
      { label: "File retention", value: `Per tier — ${shortRetention()}` },
      { label: "Free conversions for visitors", value: String(GUEST_FREE_CONVERSIONS) },
      { label: "Conversions at once", value: String(conversionQueue.stats().concurrency) },
      ...features,
    ],
  };
}

export function humanBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} kB`;
  }
  return `${bytes} B`;
}
