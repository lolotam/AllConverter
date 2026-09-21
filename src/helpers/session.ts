import { getUserById } from "../db/db";

// Guest ids are drawn from 2^24 upwards so they cannot collide with a users row id,
// which is a small autoincrementing integer.
const GUEST_ID_FLOOR = 2 ** 24;

/**
 * Whether a verified token belongs to a real account.
 *
 * With ALLOW_UNAUTHENTICATED every visitor is handed a signed token on the home page,
 * so a valid cookie says nothing about being signed in. Anything that asks "is this
 * person logged in" has to ask this instead, or it will treat every passer-by as a
 * signed-in user.
 */
export function isRegisteredSession(id: unknown): boolean {
  if (typeof id !== "string" && typeof id !== "number") {
    return false;
  }
  const numeric = Number.parseInt(String(id), 10);
  if (!Number.isFinite(numeric) || numeric >= GUEST_ID_FLOOR) {
    return false;
  }
  return getUserById(String(id)) !== null;
}
