import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";

process.env.DB_PATH = process.env.DB_PATH ?? "./data/test-isolated.sqlite";
const { initializeDatabase } = await import("../../src/db/db");

type TierRow = {
  id: string;
  features: string;
  button_text: string;
  button_link: string;
  retention_hours: number;
  max_file_size_mb: number;
  batch_limit: number;
};

const seeded = () => {
  const db = new Database(":memory:");
  initializeDatabase(db);
  return db;
};

const tiersOf = (db: Database) =>
  db
    .query(
      "SELECT id, features, button_text, button_link, retention_hours, max_file_size_mb, batch_limit FROM tiers",
    )
    .all() as TierRow[];

const allFeatures = (db: Database) =>
  tiersOf(db)
    .flatMap((tier) => JSON.parse(tier.features) as string[])
    .join(" | ");

// Each of these was sold by the plans while nothing in the code did it
const UNBACKED = [
  "API credits",
  "Webhooks",
  "R2",
  "Uptime SLA",
  "24/7",
  "Dedicated conversion workers",
  "5x faster",
];

test("the seeded plans promise nothing the app does not do", () => {
  const db = seeded();
  const features = allFeatures(db);
  for (const claim of UNBACKED) {
    expect(features).not.toContain(claim);
  }
  db.close();
});

test("what each plan says about storage matches the retention it is given", () => {
  const db = seeded();
  for (const tier of tiersOf(db)) {
    const storageLine = (JSON.parse(tier.features) as string[]).find((line) =>
      /retention|storage|kept for/i.test(line),
    );
    expect(storageLine).toBeDefined();

    // "2-hour file retention" / "24-hour file storage" / "7-day file storage"
    const match = /(\d+)[\s-](hour|day)/i.exec(storageLine ?? "");
    expect(match).not.toBeNull();
    const promisedHours = Number(match?.[1]) * (match?.[2]?.toLowerCase() === "day" ? 24 : 1);
    expect(promisedHours).toBe(tier.retention_hours);
  }
  db.close();
});

test("the old Business call to action no longer offers an API that does not exist", () => {
  const db = seeded();
  db.query(
    "UPDATE tiers SET button_text = 'Get API Access', button_link = '/login' WHERE id = 'business'",
  ).run();

  initializeDatabase(db);

  const business = tiersOf(db).find((tier) => tier.id === "business");
  expect(business?.button_text).toBe("Join the waiting list");
  db.close();
});

test("a database seeded with the old copy is rewritten, once and then left stable", () => {
  const db = seeded();
  db.query("UPDATE tiers SET features = ? WHERE id = 'pro'").run(
    JSON.stringify([
      "Up to 2 GB max file size",
      "Unlimited conversions",
      "Priority Turbo Queue (5x faster)",
      "Batch upload up to 50 files",
      "24-hour file storage",
      "100% Ad-free experience",
    ]),
  );

  initializeDatabase(db);
  const afterFirst = allFeatures(db);
  expect(afterFirst).not.toContain("5x faster");

  // Restarting must not flip the wording back and forth
  initializeDatabase(db);
  expect(allFeatures(db)).toBe(afterFirst);
  db.close();
});

test("copy edited in the admin dashboard is left alone", () => {
  const db = seeded();
  db.query("UPDATE tiers SET features = ? WHERE id = 'free'").run(
    JSON.stringify(["My own wording", "Chosen by the owner"]),
  );

  initializeDatabase(db);

  const free = tiersOf(db).find((tier) => tier.id === "free");
  expect(JSON.parse(free?.features ?? "[]")).toEqual(["My own wording", "Chosen by the owner"]);
  db.close();
});
