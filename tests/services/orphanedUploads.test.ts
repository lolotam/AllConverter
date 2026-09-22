import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import { uploadsDir } from "../../src/helpers/paths";

process.env.DB_PATH ??= "./data/test-orphans.sqlite";
const { default: db } = await import("../../src/db/db");
const { deleteOrphanedUploads } = await import("../../src/services/cleanup");

const userId = 940_000 + Math.floor(Math.random() * 10_000);

function uploadFor(jobId: number, hoursAgo: number, numFiles: number): string {
  const created = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  db.query("INSERT INTO jobs (id, user_id, date_created, num_files) VALUES (?, ?, ?, ?)").run(
    jobId,
    userId,
    created,
    numFiles,
  );
  const directory = path.resolve(`${uploadsDir}${userId}/${jobId}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "document.pdf"), "x");
  return directory;
}

afterAll(() => {
  db.query("DELETE FROM jobs WHERE user_id = ?").run(userId);
});

test("an upload nobody converted is removed once it is past the grace period", () => {
  const abandoned = uploadFor(970_001, 5, 0);
  const justArrived = uploadFor(970_002, 0, 0);
  const converted = uploadFor(970_003, 5, 3);

  deleteOrphanedUploads(2);

  expect(existsSync(abandoned)).toBe(false);
  // Still within the grace period: someone may be about to press Convert
  expect(existsSync(justArrived)).toBe(true);
  // A job that produced files is the retention sweep's business, not ours
  expect(existsSync(converted)).toBe(true);
});

test("a folder with no job row at all is removed on age alone", () => {
  const directory = path.resolve(`${uploadsDir}${userId}/970004`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "stray.pdf"), "x");

  // Back-dated an hour, so this is a test about age rather than about whether the folder
  // happened to be created in the same millisecond as the cutoff. A zero grace period puts
  // the cutoff at exactly now, and a folder stamped "now" on a fast machine sat right on
  // the boundary — kept or removed depending on the clock, which made this test flaky.
  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  utimesSync(directory, anHourAgo, anHourAgo);

  // An hour old, so a two-hour grace period still protects it...
  deleteOrphanedUploads(2);
  expect(existsSync(directory)).toBe(true);

  // ...and no grace period at all takes it
  deleteOrphanedUploads(0);
  expect(existsSync(directory)).toBe(false);
});
