// How long files are kept, read from the tiers table so one answer serves the landing
// page, the privacy policy, the admin dashboard and the cleanup sweep. Retention is
// editable in the admin Tiers tab, so anything that states it in words has to ask.
import db from "../db/db";
import { AUTO_DELETE_EVERY_N_HOURS } from "../helpers/env";
import { cleanupEnabled, cleanupOverrideHours } from "./cleanup";

export type TierRetention = { id: string; name: string; hours: number };

/** Every plan's retention window, shortest first. */
export function tierRetention(): TierRetention[] {
  const rows = db.query("SELECT id, name, retention_hours FROM tiers").all() as {
    id: string;
    name: string;
    retention_hours: number;
  }[];
  return rows
    .map((row) => ({ id: row.id, name: row.name, hours: row.retention_hours }))
    .sort((a, b) => a.hours - b.hours);
}

/** Whether anything is deleted automatically at all, for pages that describe it. */
export function deletionIsAutomatic(): boolean {
  return cleanupEnabled();
}

export function formatHours(hours: number): string {
  // A day only reads better than hours once there is more than one of them: the Pro plan
  // sells "24-hour file storage", not "1 day"
  if (hours % 24 === 0 && hours >= 48) {
    const days = hours / 24;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * "2 hours on Free Tier, 24 hours on ConvertX Pro and 7 days on Business & API", or the
 * single window when an admin has set one for everybody.
 */
export function describeRetention(): string {
  const override = cleanupOverrideHours();
  if (override !== null) {
    return formatHours(override);
  }
  const parts = tierRetention().map((tier) => `${formatHours(tier.hours)} on ${tier.name}`);
  if (parts.length === 0) {
    return formatHours(AUTO_DELETE_EVERY_N_HOURS);
  }
  if (parts.length === 1) {
    return parts[0] as string;
  }
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * How to finish a sentence such as "files are deleted …", in whichever way is true:
 * one window for everybody, or each plan's own.
 */
export function retentionSentence(): string {
  const override = cleanupOverrideHours();
  return override !== null
    ? `after ${formatHours(override)}`
    : `according to your plan — ${describeRetention()}`;
}

/** Short form for the admin dashboard: "2h Free / 24h Pro / 7d Business". */
export function shortRetention(): string {
  const override = cleanupOverrideHours();
  if (override !== null) {
    return `${formatHours(override)} for everyone`;
  }
  return (
    tierRetention()
      .map((tier) => {
        const value =
          tier.hours % 24 === 0 && tier.hours >= 48 ? `${tier.hours / 24}d` : `${tier.hours}h`;
        return `${value} ${tier.id}`;
      })
      .join(" / ") || "not set"
  );
}
