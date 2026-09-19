import db, { getTierById, getUserById } from "../db/db";
import { Tier } from "../db/types";
import { CLIENT_IP_HEADER } from "../helpers/env";

export const MB = 1024 * 1024;

// Tiers at or above this daily limit are shown as "unlimited" in the UI.
export const UNLIMITED_THRESHOLD = 100_000;

// Used only if the tiers table is missing the 'free' row (e.g. deleted by hand).
const FREE_FALLBACK: Tier = Object.assign(new Tier(), {
  id: "free",
  name: "Free Tier",
  max_file_size_mb: 100,
  daily_conversions: 10,
  priority_queue: 0,
  batch_limit: 5,
});

type RequestIpSource = { requestIP(request: Request): { address: string } | null } | null;

function clientIp(request: Request, server: RequestIpSource): string {
  // Only trust a forwarding header when the operator explicitly configured one,
  // otherwise any client could spoof its way past the guest quota.
  if (CLIENT_IP_HEADER) {
    const forwarded = request.headers.get(CLIENT_IP_HEADER)?.split(",")[0]?.trim();
    if (forwarded) {
      return forwarded;
    }
  }
  return server?.requestIP(request)?.address ?? "unknown";
}

/**
 * Resolves the plan a request is billed against. Guests (ALLOW_UNAUTHENTICATED)
 * get a fresh random user id on every page load, so their usage is keyed by IP
 * instead of by id — otherwise a page refresh would reset the daily quota.
 */
export function getQuotaContext(
  userId: string,
  request: Request,
  server: RequestIpSource,
): { tier: Tier; subject: string } {
  const user = getUserById(userId);
  const tier = getTierById(user?.tier ?? "free") ?? getTierById("free") ?? FREE_FALLBACK;
  const subject = user ? `user:${user.id}` : `ip:${clientIp(request, server)}`;
  return { tier, subject };
}

const today = () => new Date().toISOString().slice(0, 10);

export function getConversionsToday(subject: string): number {
  const row = db
    .query("SELECT conversions FROM usage WHERE subject = ? AND day = ?")
    .get(subject, today()) as { conversions: number } | null;
  return row?.conversions ?? 0;
}

/** Atomically checks the daily limit and records `count` conversions if it fits. */
export const consumeConversions = db.transaction(
  (subject: string, tier: Tier, count: number): boolean => {
    if (getConversionsToday(subject) + count > tier.daily_conversions) {
      return false;
    }
    db.query(
      `INSERT INTO usage (subject, day, conversions) VALUES (?, ?, ?)
       ON CONFLICT(subject, day) DO UPDATE SET conversions = conversions + excluded.conversions`,
    ).run(subject, today(), count);
    return true;
  },
);

// Referenced by the privacy policy, keep them in sync
export const USAGE_RETENTION_DAYS = 7;

export function pruneUsage(keepDays = USAGE_RETENTION_DAYS): void {
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  db.query("DELETE FROM usage WHERE day < ?").run(cutoff);
}
