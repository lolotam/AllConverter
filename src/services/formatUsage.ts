// How often each format has been converted into, counted for good.
//
// The admin format table shows this next to each format, as the one piece of evidence about
// whether anybody actually wants it. Counting rows in file_names would have been free, but
// those rows are deleted with the job they belong to, so the number would drop every time
// the retention sweep ran — busiest formats looking least used. This count only goes up and
// survives a user clearing their history or an admin purging every file on the volume.
import db from "../db/db";
import { normalizeFiletype } from "../helpers/normalizeFiletype";

/** Records `times` conversions into `format`. Called once per conversion, not per page. */
export function recordFormatUse(format: string, times = 1): void {
  const key = normalizeFiletype(String(format).toLowerCase());
  if (!key || times < 1) {
    return;
  }

  db.query(
    `INSERT INTO format_usage (format, count) VALUES (?1, ?2)
     ON CONFLICT(format) DO UPDATE SET count = count + ?2`,
  ).run(key, times);
}

/** Every format that has ever been converted into, keyed the same way the catalogue is. */
export function formatUsageCounts(): Record<string, number> {
  const rows = db.query("SELECT format, count FROM format_usage").all() as {
    format: string;
    count: number;
  }[];

  // Rows seeded from old filenames are keyed by the extension as written, so "jpg" and
  // "jpeg" can both be present; the table shows one row per format, so they are added up
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const key = normalizeFiletype(row.format);
    totals[key] = (totals[key] ?? 0) + row.count;
  }
  return totals;
}
