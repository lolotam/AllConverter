// Settings an admin changes from the dashboard instead of the environment. Kept in the
// database so they survive a redeploy, and read on demand so a change takes effect at once.
import db from "../db/db";

export function getSetting(key: string): string | null {
  const row = db.query("SELECT value FROM system_settings WHERE key = ?").get(key) as
    { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  if (value === null) {
    db.query("DELETE FROM system_settings WHERE key = ?").run(key);
    return;
  }
  db.query(
    "INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function getJsonSetting<T>(key: string, fallback: T): T {
  const raw = getSetting(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
