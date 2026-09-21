import { afterAll, beforeAll, expect, test } from "bun:test";

process.env.DB_PATH ??= "./data/test-session.sqlite";

const db = (await import("../../src/db/db")).default;
const { isRegisteredSession } = await import("../../src/helpers/session");

const email = `session-${Date.now()}@example.com`;
let id = 0;

beforeAll(() => {
  db.query("INSERT INTO users (email, password) VALUES (?, ?)").run(email, "x");
  id = (db.query("SELECT id FROM users WHERE email = ?").get(email) as { id: number }).id;
});

afterAll(() => {
  db.query("DELETE FROM users WHERE email = ?").run(email);
});

test("an account that exists is a signed-in session", () => {
  expect(isRegisteredSession(id)).toBe(true);
  // The cookie carries the id as text, which has to behave the same
  expect(isRegisteredSession(String(id))).toBe(true);
});

test("a guest id is never a signed-in session", () => {
  // ALLOW_UNAUTHENTICATED draws guest ids from 2^24 upwards. This is the whole point:
  // a guest holds a valid token, so the sign-in page must not treat them as signed in.
  expect(isRegisteredSession(2 ** 24)).toBe(false);
  expect(isRegisteredSession("16777216")).toBe(false);
  expect(isRegisteredSession(String(2 ** 40 + 7))).toBe(false);
});

test("an id with no row is not a session", () => {
  expect(isRegisteredSession(987_654)).toBe(false);
});

test("junk is rejected rather than throwing", () => {
  for (const value of [undefined, null, "", "abc", {}, [], true]) {
    expect(isRegisteredSession(value)).toBe(false);
  }
});
