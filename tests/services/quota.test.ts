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

test("registered users get their own tier and are keyed by user id", () => {
  db.query(
    "INSERT INTO users (id, email, password, tier) VALUES (?, 'quota@test', 'x', 'pro')",
  ).run(proUserId);

  const { tier, subject } = getQuotaContext(String(proUserId), request, serverSeeing(uniqueIp()));

  expect(tier.id).toBe("pro");
  expect(subject).toBe(`user:${proUserId}`);
});

test("consumeConversions stops at the daily limit without recording the rejected batch", () => {
  const { tier, subject } = getQuotaContext("99999999", request, serverSeeing(uniqueIp()));
  const limit = tier.daily_conversions;

  expect(consumeConversions(subject, tier, limit - 1)).toBe(true);
  expect(consumeConversions(subject, tier, 2)).toBe(false);
  expect(getConversionsToday(subject)).toBe(limit - 1);
  expect(consumeConversions(subject, tier, 1)).toBe(true);
  expect(getConversionsToday(subject)).toBe(limit);
});
