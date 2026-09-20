import { describe, expect, it } from "bun:test";
import { setupAllowed } from "../../src/pages/user";

describe("first-run setup token", () => {
  it("leaves setup open when no token is configured", () => {
    expect(setupAllowed(undefined, "")).toBe(true);
    expect(setupAllowed("anything", "")).toBe(true);
  });

  it("refuses a wrong, empty or missing token when one is configured", () => {
    expect(setupAllowed("s3cret-token", "s3cret-token")).toBe(true);
    expect(setupAllowed("s3cret-toke", "s3cret-token")).toBe(false);
    expect(setupAllowed("S3CRET-TOKEN", "s3cret-token")).toBe(false);
    expect(setupAllowed("", "s3cret-token")).toBe(false);
    expect(setupAllowed(undefined, "s3cret-token")).toBe(false);
    expect(setupAllowed(42, "s3cret-token")).toBe(false);
  });
});
