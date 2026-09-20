import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { outputDir, uploadsDir } from "../../src/helpers/paths";

process.env.DB_PATH ??= "./data/test-cleanup.sqlite";

const { default: db } = await import("../../src/db/db");
const { deleteExpiredJobs } = await import("../../src/services/cleanup");

const freeUserId = 810_000 + Math.floor(Math.random() * 10_000);
const proUserId = 820_000 + Math.floor(Math.random() * 10_000);
const businessUserId = 830_000 + Math.floor(Math.random() * 10_000);

// Setup registered test users with respective tiers
db.query(
  "INSERT OR REPLACE INTO users (id, email, password, role, tier) VALUES (?, ?, 'hash', 'user', 'free')",
).run(freeUserId, `free-${freeUserId}@example.com`);
db.query(
  "INSERT OR REPLACE INTO users (id, email, password, role, tier) VALUES (?, ?, 'hash', 'user', 'pro')",
).run(proUserId, `pro-${proUserId}@example.com`);
db.query(
  "INSERT OR REPLACE INTO users (id, email, password, role, tier) VALUES (?, ?, 'hash', 'user', 'business')",
).run(businessUserId, `biz-${businessUserId}@example.com`);

afterAll(() => {
  db.query("DELETE FROM users WHERE id IN (?, ?, ?)").run(freeUserId, proUserId, businessUserId);
  db.query("DELETE FROM jobs WHERE user_id IN (?, ?, ?)").run(
    freeUserId,
    proUserId,
    businessUserId,
  );
});

function insertJob(userId: number, hoursAgo: number): number {
  const date = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  db.query("INSERT INTO jobs (user_id, date_created) VALUES (?, ?)").run(userId, date);
  const { id } = db
    .query("SELECT id FROM jobs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
    .get(userId) as {
    id: number;
  };

  // Create mock files on disk to verify physical removal
  const outFolder = `${outputDir}${userId}/${id}`;
  const upFolder = `${uploadsDir}${userId}/${id}`;
  mkdirSync(outFolder, { recursive: true });
  mkdirSync(upFolder, { recursive: true });
  writeFileSync(`${outFolder}/result.txt`, "converted content");
  writeFileSync(`${upFolder}/input.txt`, "source content");

  return id;
}

test("per-tier cleanup deletes jobs according to each user's tier retention", () => {
  // Free tier has 2 hours retention
  const freeRecent = insertJob(freeUserId, 1); // 1h ago -> KEEP
  const freeExpired = insertJob(freeUserId, 3); // 3h ago -> DELETE (> 2h)

  // Pro tier has 24 hours retention
  const proRecent = insertJob(proUserId, 5); // 5h ago -> KEEP (past 2h, but < 24h)
  const proExpired = insertJob(proUserId, 26); // 26h ago -> DELETE (> 24h)

  // Business tier has 168 hours (7 days) retention
  const bizRecent = insertJob(businessUserId, 48); // 48h ago (2 days) -> KEEP (past 24h, but < 168h)
  const bizExpired = insertJob(businessUserId, 200); // 200h ago (> 8 days) -> DELETE (> 168h)

  // Run automatic per-tier cleanup
  const deletedCount = deleteExpiredJobs();
  expect(deletedCount).toBeGreaterThanOrEqual(3);

  // Check database presence
  const remainingJobIds = (
    db
      .query("SELECT id FROM jobs WHERE user_id IN (?, ?, ?)")
      .all(freeUserId, proUserId, businessUserId) as { id: number }[]
  ).map((j) => j.id);

  expect(remainingJobIds).toContain(freeRecent);
  expect(remainingJobIds).not.toContain(freeExpired);

  expect(remainingJobIds).toContain(proRecent);
  expect(remainingJobIds).not.toContain(proExpired);

  expect(remainingJobIds).toContain(bizRecent);
  expect(remainingJobIds).not.toContain(bizExpired);

  // Verify disk cleanup
  expect(existsSync(`${outputDir}${freeUserId}/${freeExpired}`)).toBe(false);
  expect(existsSync(`${uploadsDir}${freeUserId}/${freeExpired}`)).toBe(false);

  expect(existsSync(`${outputDir}${proUserId}/${proRecent}`)).toBe(true);
  expect(existsSync(`${outputDir}${proUserId}/${proExpired}`)).toBe(false);

  expect(existsSync(`${outputDir}${businessUserId}/${bizRecent}`)).toBe(true);
  expect(existsSync(`${outputDir}${businessUserId}/${bizExpired}`)).toBe(false);
});

test("manual olderThanHours argument overrides per-tier retention", () => {
  // Insert a Pro job 2 hours ago. Normally kept for 24h.
  const proJob = insertJob(proUserId, 2);

  // But if admin or test runs cleanup with olderThanHours = 1:
  deleteExpiredJobs(1);

  const check = db.query("SELECT id FROM jobs WHERE id = ?").get(proJob);
  expect(check).toBeNull();
  expect(existsSync(`${outputDir}${proUserId}/${proJob}`)).toBe(false);
});
