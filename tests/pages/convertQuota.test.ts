import { describe, expect, it } from "bun:test";

process.env.DB_PATH ??= "./data/test-convert-quota.sqlite";
const { consumeConversions, getConversionsToday } = await import("../../src/services/quota");

// A task is one conversion however many files it carries; the plan's batch limit is what
// caps the files. Counting per file made the one-a-day guest tier unusable: uploading
// four photos was refused after the bytes had already been sent.
describe("a task counts once, not once per file", () => {
  it("lets a visitor with a single daily conversion submit a batch", () => {
    const subject = `test:${crypto.randomUUID()}`;
    expect(consumeConversions(subject, 1, 1)).toBe(true);
    expect(getConversionsToday(subject)).toBe(1);
  });

  it("still refuses the second task that day", () => {
    const subject = `test:${crypto.randomUUID()}`;
    expect(consumeConversions(subject, 1, 1)).toBe(true);
    expect(consumeConversions(subject, 1, 1)).toBe(false);
    expect(getConversionsToday(subject)).toBe(1);
  });
});
