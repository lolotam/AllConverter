import { afterAll, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

// Only takes effect if no earlier test file loaded db.ts; bun shares modules across files,
// so this test uses its own unique rows and never closes the shared connection.
process.env.DB_PATH ??= "./data/test-paddle.sqlite";

const { default: db } = await import("../../src/db/db");
const { applySubscriptionEvent, checkoutSignature, verifyPaddleSignature } =
  await import("../../src/services/paddle");
type PaddleEvent = import("../../src/services/paddle").PaddleEvent;

const secret = "pdl_ntfset_test_secret";
const prices = { pro: "pri_pro", business: "pri_business" };
const createdUserIds: number[] = [];

afterAll(() => {
  for (const id of createdUserIds) {
    db.query("DELETE FROM users WHERE id = ?").run(id);
  }
});

const createUser = () => {
  const { id } = db.query("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM users").get() as {
    id: number;
  };
  db.query("INSERT INTO users (id, email, password, tier) VALUES (?, ?, 'x', 'free')").run(
    id,
    `paddle-${id}@test`,
  );
  createdUserIds.push(id);
  return id;
};

const tierOf = (id: number) =>
  (db.query("SELECT tier FROM users WHERE id = ?").get(id) as { tier: string }).tier;

let clock = Date.parse("2026-09-19T10:00:00Z");
const subscriptionEvent = (
  userId: number,
  overrides: Partial<PaddleEvent["data"]> & { event_type?: string; sigFor?: number } = {},
): PaddleEvent => {
  const { event_type = "subscription.created", sigFor = userId, ...data } = overrides;
  clock += 1000;
  return {
    event_type,
    occurred_at: new Date(clock).toISOString(),
    data: {
      id: `sub_${userId}`,
      status: "active",
      customer_id: `ctm_${userId}`,
      custom_data: { user_id: String(userId), sig: checkoutSignature(sigFor, secret) },
      items: [{ price: { id: "pri_pro" } }],
      ...data,
    },
  };
};

const sign = (body: string, ts: number, key = secret) =>
  createHmac("sha256", key).update(`${ts}:${body}`).digest("hex");

test("verifyPaddleSignature accepts a valid signature and rejects tampering or replays", () => {
  const body = '{"event_type":"subscription.created"}';
  const now = 1_790_000_000_000;
  const ts = now / 1000;

  expect(verifyPaddleSignature(body, `ts=${ts};h1=${sign(body, ts)}`, secret, now)).toBe(true);
  expect(verifyPaddleSignature(`${body} `, `ts=${ts};h1=${sign(body, ts)}`, secret, now)).toBe(
    false,
  );
  expect(verifyPaddleSignature(body, `ts=${ts};h1=${sign(body, ts, "other")}`, secret, now)).toBe(
    false,
  );
  expect(
    verifyPaddleSignature(body, `ts=${ts};h1=${sign(body, ts)}`, secret, now + 10 * 60 * 1000),
  ).toBe(false);
  expect(verifyPaddleSignature(body, null, secret, now)).toBe(false);
});

test("verifyPaddleSignature accepts any h1 while the secret is being rotated", () => {
  const body = "{}";
  const now = 1_790_000_000_000;
  const ts = now / 1000;
  const header = `ts=${ts};h1=${sign(body, ts, "old")};h1=${sign(body, ts)}`;

  expect(verifyPaddleSignature(body, header, secret, now)).toBe(true);
});

test("a signed checkout upgrades the user, and cancellation downgrades them", () => {
  const userId = createUser();

  expect(applySubscriptionEvent(subscriptionEvent(userId), secret, prices).applied).toBe(true);
  expect(tierOf(userId)).toBe("pro");

  const canceled = subscriptionEvent(userId, {
    event_type: "subscription.canceled",
    status: "canceled",
    custom_data: null,
  });
  expect(applySubscriptionEvent(canceled, secret, prices).applied).toBe(true);
  expect(tierOf(userId)).toBe("free");
});

test("a forged checkout signature does not touch another user's account", () => {
  const victim = createUser();
  const attacker = createUser();

  const forged = subscriptionEvent(victim, {
    id: "sub_forged",
    customer_id: "ctm_x",
    sigFor: attacker,
  });

  expect(applySubscriptionEvent(forged, secret, prices).applied).toBe(false);
  expect(tierOf(victim)).toBe("free");
});

test("an event older than the last applied one is ignored", () => {
  const userId = createUser();
  const olderCancel = subscriptionEvent(userId, {
    event_type: "subscription.canceled",
    status: "canceled",
  });
  const newerActive = subscriptionEvent(userId);

  applySubscriptionEvent(newerActive, secret, prices);
  expect(applySubscriptionEvent(olderCancel, secret, prices)).toEqual({
    applied: false,
    reason: "stale event",
  });
  expect(tierOf(userId)).toBe("pro");
});

test("canceling a replaced subscription keeps the plan from the current one", () => {
  const userId = createUser();
  applySubscriptionEvent(subscriptionEvent(userId, { id: "sub_old" }), secret, prices);
  applySubscriptionEvent(
    subscriptionEvent(userId, {
      id: `sub_new_${userId}`,
      items: [{ price: { id: "pri_business" } }],
    }),
    secret,
    prices,
  );

  const oldCanceled = subscriptionEvent(userId, {
    id: "sub_old",
    event_type: "subscription.canceled",
    status: "canceled",
  });

  expect(applySubscriptionEvent(oldCanceled, secret, prices).applied).toBe(false);
  expect(tierOf(userId)).toBe("business");
});

test("an active subscription on an unmapped price is not applied", () => {
  const userId = createUser();
  const unknownPrice = subscriptionEvent(userId, { items: [{ price: { id: "pri_unknown" } }] });

  expect(applySubscriptionEvent(unknownPrice, secret, prices).applied).toBe(false);
  expect(tierOf(userId)).toBe("free");
});
