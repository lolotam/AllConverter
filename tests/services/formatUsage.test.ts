import { afterAll, describe, expect, test } from "bun:test";

process.env.DB_PATH ??= "./data/test-format-usage.sqlite";

const { default: db } = await import("../../src/db/db");
const { formatUsageCounts, recordFormatUse } = await import("../../src/services/formatUsage");

// Formats nothing else in the suite touches, so the counts here are only ever ours
const OURS = ["zzfmt", "zzalias", "jpg", "jpeg"] as const;
const userId = 840_000 + Math.floor(Math.random() * 10_000);

// Every file in the suite shares one process and so one database; scope each
// write to rows this file owns rather than clearing a table another file is using
const clear = () => {
  for (const format of OURS) {
    db.query("DELETE FROM format_usage WHERE format = ?").run(format);
  }
  db.query("DELETE FROM jobs WHERE user_id = ?").run(userId);
};

clear();
afterAll(clear);

describe("format usage counter", () => {
  test("adds up every conversion into a format", () => {
    recordFormatUse("zzfmt");
    recordFormatUse("zzfmt", 4);

    expect(formatUsageCounts().zzfmt).toBe(5);
  });

  test("counts an alias and its canonical name as one format", () => {
    // normalizeFiletype folds jpg into jpeg, so a customer choosing either is
    // choosing the same row in the admin table and has to be counted there once
    recordFormatUse("jpg", 2);
    recordFormatUse("JPEG", 3);

    expect(formatUsageCounts().jpeg).toBe(5);
    expect(formatUsageCounts().jpg).toBeUndefined();
  });

  test("ignores an empty format and a non-positive count", () => {
    recordFormatUse("", 5);
    recordFormatUse("zzalias", 0);
    recordFormatUse("zzalias", -3);

    expect(formatUsageCounts().zzalias).toBeUndefined();
  });

  test("survives the job and files it came from being deleted", () => {
    // The whole point of a separate table: the admin table's "Used" column has
    // to keep meaning something after a retention sweep or an admin purge, which
    // take the jobs and their file_names rows with them.
    db.query("INSERT INTO jobs (user_id, date_created) VALUES (?, ?)").run(
      userId,
      new Date().toISOString(),
    );
    const { id: jobId } = db
      .query("SELECT id FROM jobs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
      .get(userId) as { id: number };
    db.query(
      "INSERT INTO file_names (job_id, file_name, output_file_name) VALUES (?, 'clip.wav', 'clip.zzfmt')",
    ).run(jobId);

    recordFormatUse("zzfmt", 7);
    const before = formatUsageCounts().zzfmt;

    db.query("DELETE FROM file_names WHERE job_id = ?").run(jobId);
    db.query("DELETE FROM jobs WHERE id = ?").run(jobId);

    expect(db.query("SELECT id FROM jobs WHERE id = ?").get(jobId)).toBeNull();
    expect(formatUsageCounts().zzfmt).toBe(before);
  });
});
