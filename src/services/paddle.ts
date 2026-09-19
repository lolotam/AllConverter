import { createHmac, timingSafeEqual } from "node:crypto";
import db from "../db/db";
import { User } from "../db/types";
import {
  PADDLE_API_KEY,
  PADDLE_CLIENT_TOKEN,
  PADDLE_ENVIRONMENT,
  PADDLE_PRICES,
  PADDLE_WEBHOOK_SECRET,
} from "../helpers/env";

export const PADDLE_ENABLED = Boolean(
  PADDLE_CLIENT_TOKEN && PADDLE_WEBHOOK_SECRET && Object.keys(PADDLE_PRICES).length > 0,
);

export const PADDLE_PORTAL_ENABLED = PADDLE_ENABLED && Boolean(PADDLE_API_KEY);

const API_BASE =
  PADDLE_ENVIRONMENT === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

// Statuses that keep the paid tier. past_due keeps it while Paddle retries the card;
// Paddle sends canceled if dunning fails.
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

export function priceIdForTier(tierId: string): string | undefined {
  return PADDLE_PRICES[tierId];
}

/**
 * Verifies the `Paddle-Signature` header (`ts=...;h1=...`): an HMAC-SHA256 of
 * `${ts}:${rawBody}` keyed with the notification destination's secret. Several
 * h1 values can be present while a secret is being rotated.
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowMs = Date.now(),
  toleranceSeconds = 300,
): boolean {
  if (!header) {
    return false;
  }

  let ts: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "ts") {
      ts = value;
    } else if (key === "h1") {
      signatures.push(value);
    }
  }

  // Reject replays of old, correctly signed requests
  if (!ts || !/^\d+$/.test(ts) || Math.abs(nowMs / 1000 - Number(ts)) > toleranceSeconds) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest();
  return signatures.some((signature) => {
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

/**
 * Signs the user id passed to checkout as custom_data, so a buyer cannot attach
 * their subscription (or its later cancellation) to someone else's account.
 */
export function checkoutSignature(userId: number | string, secret: string): string {
  return createHmac("sha256", secret).update(`checkout:${userId}`).digest("hex");
}

function hasValidCheckoutSignature(
  customData: Record<string, unknown> | null | undefined,
  secret: string,
): customData is { user_id: string; sig: string } {
  if (typeof customData?.user_id !== "string" || typeof customData.sig !== "string") {
    return false;
  }
  const expected = Buffer.from(checkoutSignature(customData.user_id, secret), "hex");
  const received = Buffer.from(customData.sig, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export type PaddleEvent = {
  event_type: string;
  occurred_at: string;
  data: {
    id: string;
    status: string;
    customer_id: string;
    custom_data?: Record<string, unknown> | null;
    items?: { price?: { id?: string } }[];
  };
};

type ApplyResult =
  { applied: true; userId: number; tier: string } | { applied: false; reason: string };

function findUser(event: PaddleEvent, secret: string): User | null {
  const subscription = event.data;
  const bySubscription = db
    .query("SELECT * FROM users WHERE paddle_subscription_id = ?")
    .as(User)
    .get(subscription.id);
  if (bySubscription) {
    return bySubscription;
  }
  if (hasValidCheckoutSignature(subscription.custom_data, secret)) {
    const byCheckout = db
      .query("SELECT * FROM users WHERE id = ?")
      .as(User)
      .get(subscription.custom_data.user_id);
    if (byCheckout) {
      return byCheckout;
    }
  }
  return db
    .query("SELECT * FROM users WHERE paddle_customer_id = ?")
    .as(User)
    .get(subscription.customer_id);
}

/** Data the browser needs to open checkout for a signed-in user, or null if unavailable. */
export function checkoutConfig(user: { id: number; email: string } | null) {
  if (!PADDLE_ENABLED || !user || !PADDLE_CLIENT_TOKEN || !PADDLE_WEBHOOK_SECRET) {
    return null;
  }
  return {
    token: PADDLE_CLIENT_TOKEN,
    environment: PADDLE_ENVIRONMENT,
    email: user.email,
    userId: String(user.id),
    sig: checkoutSignature(user.id, PADDLE_WEBHOOK_SECRET),
  };
}

/** Applies a subscription.* webhook to the matching user's tier. */
export function applySubscriptionEvent(
  event: PaddleEvent,
  secret: string,
  prices: Record<string, string> = PADDLE_PRICES,
): ApplyResult {
  if (!event.event_type?.startsWith("subscription.")) {
    return { applied: false, reason: `ignored event type ${event.event_type}` };
  }

  const subscription = event.data;
  const user = findUser(event, secret);
  if (!user) {
    return { applied: false, reason: `no user for subscription ${subscription.id}` };
  }

  // Paddle does not guarantee delivery order
  if (user.subscription_event_at && event.occurred_at < user.subscription_event_at) {
    return { applied: false, reason: "stale event" };
  }

  const isPaid = PAID_STATUSES.has(subscription.status);
  const isOtherSubscription =
    user.paddle_subscription_id !== null && user.paddle_subscription_id !== subscription.id;
  // Ending an old or duplicate subscription must not downgrade the one in use
  if (isOtherSubscription && !isPaid) {
    return { applied: false, reason: "event for a subscription the user no longer uses" };
  }

  let tier = "free";
  if (isPaid) {
    const priceId = subscription.items?.[0]?.price?.id;
    const match = Object.entries(prices).find(([, id]) => id === priceId);
    if (!match) {
      return { applied: false, reason: `price ${priceId} is not mapped to a tier` };
    }
    tier = match[0];
  }

  db.query(
    `UPDATE users SET tier = ?, paddle_customer_id = ?, paddle_subscription_id = ?,
       subscription_status = ?, subscription_event_at = ?
     WHERE id = ?`,
  ).run(
    tier,
    subscription.customer_id,
    subscription.id,
    subscription.status,
    event.occurred_at,
    user.id,
  );

  return { applied: true, userId: user.id, tier };
}

/** Creates a short-lived Paddle customer portal link, or null if unavailable. */
export async function createPortalUrl(user: User): Promise<string | null> {
  if (!PADDLE_API_KEY || !user.paddle_customer_id) {
    return null;
  }

  const response = await fetch(
    `${API_BASE}/customers/${encodeURIComponent(user.paddle_customer_id)}/portal-sessions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription_ids: user.paddle_subscription_id ? [user.paddle_subscription_id] : [],
      }),
    },
  );
  if (!response.ok) {
    console.error(`Paddle portal session failed: ${response.status} ${await response.text()}`);
    return null;
  }

  const json = (await response.json()) as { data?: { urls?: { general?: { overview?: string } } } };
  return json.data?.urls?.general?.overview ?? null;
}
