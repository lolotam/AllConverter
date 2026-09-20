import { afterAll, expect, test } from "bun:test";

// Only takes effect if no earlier test file loaded db.ts; bun shares modules across files,
// so this test must not assume an empty database or close the shared connection.
process.env.DB_PATH ??= "./data/test-quota.sqlite";

const { default: db } = await import("../../src/db/db");
const { consumeConversions, getConversionsToday, getQuotaContext } =
  await import("../../src/services/quota");

const request = new Request("http://localhost/");
const serverSeeing = (address: string) => ({ requestIP: () => ({ address }) });
const uniqueIp = () => `203.0.113.${Math.floor(Math.random() * 250)}-${crypto.randomUUID()}`;
const proUserId = 900_000 + Math.floor(Math.random() * 90_000);

afterAll(() => {
  db.query("DELETE FROM users WHERE id = ?").run(proUserId);
  db.query("DELETE FROM usage WHERE subject LIKE 'ip:203.0.113.%' OR subject = ?").run(
    `user:${proUserId}`,
  );
});

test("guests are keyed by client IP so a new guest id does not reset the quota", () => {
  const ip = uniqueIp();
  const first = getQuotaContext("99999999", request, serverSeeing(ip));
  const second = getQuotaContext("88888888", request, serverSeeing(ip));

  expect(first.tier.id).toBe("free");
  expect(first.subject).toBe(`ip:${ip}`);
  expect(second.subject).toBe(first.subject);
});

test("a visitor without an account gets the free-trial limit, not the plan's daily limit", () => {
  const guest = getQuotaContext("99999999", request, serverSeeing(uniqueIp()));

  expect(guest.isGuest).toBe(true);
  expect(guest.tier.daily_conversions).toBe(10);
  // Set by GUEST_FREE_CONVERSIONS: one taste of the service, then sign up
  expect(guest.dailyLimit).toBe(1);
});

test("registered users get their own tier and are keyed by user id", () => {
  db.query(
    "INSERT INTO users (id, email, password, tier) VALUES (?, 'quota@test', 'x', 'pro')",
  ).run(proUserId);

  const { tier, subject, isGuest, dailyLimit } = getQuotaContext(
    String(proUserId),
    request,
    serverSeeing(uniqueIp()),
  );

  expect(tier.id).toBe("pro");
  expect(subject).toBe(`user:${proUserId}`);
  expect(isGuest).toBe(false);
  expect(dailyLimit).toBe(tier.daily_conversions);
});

test("consumeConversions stops at the daily limit without recording the rejected task", () => {
  const { subject } = getQuotaContext("99999999", request, serverSeeing(uniqueIp()));
  const limit = 10;

  expect(consumeConversions(subject, limit, limit - 1)).toBe(true);
  expect(consumeConversions(subject, limit, 2)).toBe(false);
  expect(getConversionsToday(subject)).toBe(limit - 1);
  expect(consumeConversions(subject, limit, 1)).toBe(true);
  expect(getConversionsToday(subject)).toBe(limit);
});
