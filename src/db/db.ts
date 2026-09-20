import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Tier, User } from "./types";

export function initializeDatabase(db: Database): void {
  const dbVersion = db.query("PRAGMA user_version").get() as { user_version?: number };
  const hasTables = db.query("SELECT * FROM sqlite_master WHERE type='table'").get();

  if (!hasTables) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        tier TEXT DEFAULT 'free',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS file_names (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        output_file_name TEXT NOT NULL,
        status TEXT DEFAULT 'not started',
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date_created TEXT NOT NULL,
        status TEXT DEFAULT 'not started',
        num_files INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    db.exec("PRAGMA user_version = 2;");
  } else {
    // Migration v1: check file_names status
    const fileColumns = db.query("PRAGMA table_info(file_names)").all() as { name: string }[];
    if (!fileColumns.some((c) => c.name.toLowerCase() === "status")) {
      db.exec("ALTER TABLE file_names ADD COLUMN status TEXT DEFAULT 'not started';");
    }

    // Migration v2: check users role, tier, created_at
    const userColumns = db.query("PRAGMA table_info(users)").all() as { name: string }[];
    if (!userColumns.some((c) => c.name.toLowerCase() === "role")) {
      db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';");
    }
    if (!userColumns.some((c) => c.name.toLowerCase() === "tier")) {
      db.exec("ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'free';");
    }
    if (!userColumns.some((c) => c.name.toLowerCase() === "created_at")) {
      db.exec("ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT '';");
    }

    db.exec("PRAGMA user_version = 2;");
  }

  // Ensure user ID 1 is Super Admin with Pro tier
  const firstUser = db.query("SELECT id FROM users ORDER BY id ASC LIMIT 1").get() as {
    id: number;
  } | null;
  if (firstUser) {
    db.query("UPDATE users SET role = 'admin', tier = 'pro' WHERE id = ?").run(firstUser.id);
  }

  // Create tiers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tiers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price TEXT NOT NULL,
      billing_period TEXT NOT NULL,
      description TEXT NOT NULL,
      max_file_size_mb INTEGER NOT NULL,
      daily_conversions INTEGER NOT NULL,
      priority_queue INTEGER NOT NULL DEFAULT 0,
      batch_limit INTEGER NOT NULL DEFAULT 5,
      is_popular INTEGER NOT NULL DEFAULT 0,
      badge TEXT DEFAULT '',
      features TEXT NOT NULL,
      button_text TEXT NOT NULL,
      button_link TEXT NOT NULL,
      color_theme TEXT DEFAULT 'default',
      retention_hours INTEGER NOT NULL DEFAULT 2
    );
  `);

  // Add retention_hours column to tiers table if not present
  const tierColumns = db.query("PRAGMA table_info(tiers)").all() as { name: string }[];
  if (!tierColumns.some((c) => c.name.toLowerCase() === "retention_hours")) {
    db.exec("ALTER TABLE tiers ADD COLUMN retention_hours INTEGER NOT NULL DEFAULT 2;");
    db.exec("UPDATE tiers SET retention_hours = 2 WHERE id = 'free';");
    db.exec("UPDATE tiers SET retention_hours = 24 WHERE id = 'pro';");
    db.exec("UPDATE tiers SET retention_hours = 168 WHERE id = 'business';");
  }

  // Seed default tiers if empty
  const tierCount = (db.query("SELECT COUNT(*) as count FROM tiers").get() as { count: number })
    .count;
  if (tierCount === 0) {
    const insertTier = db.query(`
      INSERT INTO tiers (
        id, name, price, billing_period, description, max_file_size_mb,
        daily_conversions, priority_queue, batch_limit, is_popular, badge,
        features, button_text, button_link, color_theme, retention_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTier.run(
      "free",
      "Free Tier",
      "$0",
      "/ forever",
      "Perfect for occasional file conversion needs.",
      100,
      10,
      0,
      5,
      0,
      "",
      JSON.stringify([
        "Up to 100 MB max file size",
        "10 conversions per day",
        "Standard cloud processing speed",
        "2-hour file retention",
        "No account required",
      ]),
      "Start Free",
      "#dropzone",
      "default",
      2,
    );

    insertTier.run(
      "pro",
      "ConvertX Pro",
      "$9.99",
      "/ month",
      "For power users, designers, and professionals.",
      2048,
      999999,
      1,
      50,
      1,
      "Most Popular",
      JSON.stringify([
        "Up to 2 GB max file size",
        "Unlimited conversions",
        "Priority queue — your files convert first",
        "Batch upload up to 50 files",
        "24-hour file storage",
        "No ads, ever",
      ]),
      "Upgrade to Pro",
      "/register",
      "accent",
      24,
    );

    insertTier.run(
      "business",
      "Business & API",
      "$29.99",
      "/ month",
      "High-volume automated conversion for developers & teams.",
      5120,
      999999,
      2,
      100,
      0,
      "Enterprise",
      JSON.stringify([
        "Up to 5 GB max file size",
        "Batch upload up to 100 files",
        "Highest queue priority",
        "7-day file storage",
        "Email support (1 business day)",
        "API access — join the waiting list",
      ]),
      "Join the waiting list",
      "/register",
      "blue",
      168,
    );
  }

  // Ensure default tier retention and honest features are up to date in existing databases
  db.query(
    `
    UPDATE tiers SET
      retention_hours = 2,
      features = ?
    WHERE id = 'free' AND (features LIKE '%Files kept for 24 hours%' OR features LIKE '%Standard processing queue%')
  `,
  ).run(
    JSON.stringify([
      "Up to 100 MB max file size",
      "10 conversions per day",
      "Standard cloud processing speed",
      "2-hour file retention",
      "No account required",
    ]),
  );

  db.query(
    `
    UPDATE tiers SET
      retention_hours = 24,
      features = ?
    WHERE id = 'pro' AND (features LIKE '%5x faster%' OR features LIKE '%Files kept for 24 hours%')
  `,
  ).run(
    JSON.stringify([
      "Up to 2 GB max file size",
      "Unlimited conversions",
      "Priority queue — your files convert first",
      "Batch upload up to 50 files",
      "24-hour file storage",
      "No ads, ever",
    ]),
  );

  // The old Business card also linked "Get API Access" to a login page, for an API that
  // does not exist; the waiting list is what it really offers today
  db.query(
    `
    UPDATE tiers SET
      button_text = 'Join the waiting list',
      button_link = '/register'
    WHERE id = 'business' AND button_text = 'Get API Access'
  `,
  ).run();

  db.query(
    `
    UPDATE tiers SET
      retention_hours = 168,
      priority_queue = 2,
      features = ?
    WHERE id = 'business' AND (features LIKE '%50,000 API credits%' OR features LIKE '%Files kept for 24 hours%')
  `,
  ).run(
    JSON.stringify([
      "Up to 5 GB max file size",
      "Batch upload up to 100 files",
      "Highest queue priority",
      "7-day file storage",
      "Email support (1 business day)",
      "API access — join the waiting list",
    ]),
  );

  // Paddle subscription state, written by the billing webhook (see services/paddle.ts),
  // and the Google account id for people who signed in with Google (see services/google.ts)
  const billingColumns = db.query("PRAGMA table_info(users)").all() as { name: string }[];
  for (const column of [
    "paddle_customer_id",
    "paddle_subscription_id",
    "subscription_status",
    "subscription_event_at",
    "google_id",
    "display_name",
    "avatar_path",
    // "1" once the person has chosen a password themselves. Accounts created through
    // Google have a random one they were never told, so they may set one without
    // proving the old one.
    "password_set",
  ]) {
    if (!billingColumns.some((c) => c.name.toLowerCase() === column)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT;`);
      if (column === "password_set") {
        // Everyone who existed before this column registered with a password
        db.exec("UPDATE users SET password_set = '1';");
      }
    }
  }

  // Settings an admin can change without a redeploy (see services/settings.ts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Daily conversion counters used to enforce tier quotas (see services/quota.ts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage (
      subject TEXT NOT NULL,
      day TEXT NOT NULL,
      conversions INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (subject, day)
    );
  `);

  // enable WAL mode
  db.exec("PRAGMA journal_mode = WAL;");
}

const dbPath = process.env.DB_PATH ?? "./data/mydb.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath, { create: true });
initializeDatabase(db);

export default db;

// Helper functions for Admin Dashboard & Tiers
export function getTiers(): Tier[] {
  return db
    .query(
      "SELECT * FROM tiers ORDER BY CASE id WHEN 'free' THEN 1 WHEN 'pro' THEN 2 WHEN 'business' THEN 3 ELSE 4 END",
    )
    .as(Tier)
    .all();
}

export function getTierById(id: string): Tier | null {
  return db.query("SELECT * FROM tiers WHERE id = ?").as(Tier).get(id);
}

export function updateTier(tier: Partial<Tier> & { id: string }): void {
  const current = getTierById(tier.id);
  if (!current) return;

  const merged = { ...current, ...tier };
  db.query(
    `
    UPDATE tiers SET
      name = ?,
      price = ?,
      billing_period = ?,
      description = ?,
      max_file_size_mb = ?,
      daily_conversions = ?,
      priority_queue = ?,
      batch_limit = ?,
      is_popular = ?,
      badge = ?,
      features = ?,
      button_text = ?,
      button_link = ?,
      color_theme = ?,
      retention_hours = ?
    WHERE id = ?
  `,
  ).run(
    merged.name,
    merged.price,
    merged.billing_period,
    merged.description,
    merged.max_file_size_mb,
    merged.daily_conversions,
    merged.priority_queue,
    merged.batch_limit,
    merged.is_popular,
    merged.badge,
    merged.features,
    merged.button_text,
    merged.button_link,
    merged.color_theme,
    merged.retention_hours ?? 2,
    merged.id,
  );
}

export function getAllUsers(): (User & { jobs_count: number })[] {
  return db
    .query(
      `
    SELECT
      u.id,
      u.email,
      u.password,
      COALESCE(u.role, 'user') as role,
      COALESCE(u.tier, 'free') as tier,
      COALESCE(u.created_at, 'N/A') as created_at,
      u.display_name,
      u.avatar_path,
      u.google_id,
      COUNT(j.id) as jobs_count
    FROM users u
    LEFT JOIN jobs j ON j.user_id = u.id
    GROUP BY u.id
    ORDER BY u.id ASC
  `,
    )
    .all() as (User & { jobs_count: number })[];
}

export function getUserById(id: number | string): User | null {
  return db
    .query(
      "SELECT id, email, password, COALESCE(role, 'user') as role, COALESCE(tier, 'free') as tier, COALESCE(created_at, 'N/A') as created_at FROM users WHERE id = ?",
    )
    .as(User)
    .get(id);
}

export function updateUserTier(id: number | string, tier: string): void {
  db.query("UPDATE users SET tier = ? WHERE id = ?").run(tier, id);
}

export function updateUserRole(id: number | string, role: string): void {
  db.query("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

export function deleteUserById(id: number | string): void {
  // delete user jobs files
  const jobs = db.query("SELECT id FROM jobs WHERE user_id = ?").all(id) as { id: number }[];
  for (const job of jobs) {
    db.query("DELETE FROM file_names WHERE job_id = ?").run(job.id);
  }
  db.query("DELETE FROM jobs WHERE user_id = ?").run(id);
  db.query("DELETE FROM users WHERE id = ?").run(id);
}

export function getStats() {
  const totalUsers = (db.query("SELECT COUNT(*) as count FROM users").get() as { count: number })
    .count;
  const proUsers = (
    db.query("SELECT COUNT(*) as count FROM users WHERE tier IN ('pro', 'business')").get() as {
      count: number;
    }
  ).count;
  const totalJobs = (db.query("SELECT COUNT(*) as count FROM jobs").get() as { count: number })
    .count;
  const totalFiles = (
    db.query("SELECT COUNT(*) as count FROM file_names").get() as { count: number }
  ).count;

  return {
    totalUsers,
    proUsers,
    totalJobs,
    totalFiles,
  };
}
