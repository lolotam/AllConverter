import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";

process.env.DB_PATH = process.env.DB_PATH ?? "./data/test-isolated.sqlite";
const { initializeDatabase } = await import("../../src/db/db");

type TierRow = { id: string; features: string; button_text: string; button_link: string };

const seeded = () => {
  const db = new Database(":memory:");
  initializeDatabase(db);
  return db;
};

const featuresOf = (db: Database) =>
  (db.query("SELECT id, features, button_text, button_link FROM tiers").all() as TierRow[]).flatMap(
    (tier) => JSON.parse(tier.features) as string[],
  );

// Every one of these was sold by the plans while nothing in the code did it
const UNBACKED = [
  "API credits",
  "Webhooks",
  "R2",
  "Uptime SLA",
  "24/7",
  "Dedicated conversion workers",
  "5x faster",
  "2-hour file retention",
];

test("the seeded plans promise nothing the app does not do", () => {
  const db = seeded();
  const features = featuresOf(db).join(" | ");
  for (const claim of UNBACKED) {
    expect(features).not.toContain(claim);
  }
  db.close();
});

test("existing plans still holding the original copy are rewritten", () => {
  const db = seeded();
  // Put the old text back, as a database seeded before this change would have it
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

  expect(featuresOf(db).join(" | ")).not.toContain("5x faster");
  db.close();
});

test("copy edited in the admin dashboard is left alone", () => {
  const db = seeded();
  db.query("UPDATE tiers SET features = ? WHERE id = 'free'").run(
    JSON.stringify(["My own wording", "Chosen by the owner"]),
  );

  initializeDatabase(db);

  const free = db.query("SELECT features FROM tiers WHERE id = 'free'").get() as TierRow;
  expect(JSON.parse(free.features)).toEqual(["My own wording", "Chosen by the owner"]);
  db.close();
});
