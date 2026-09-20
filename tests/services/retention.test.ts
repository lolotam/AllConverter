import { describe, expect, it } from "bun:test";
import {
  describeRetention,
  formatHours,
  shortRetention,
  tierRetention,
} from "../../src/services/retention";

describe("retention wording", () => {
  it("reads every plan's window from the tiers, shortest first", () => {
    const tiers = tierRetention();
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers.map((tier) => tier.hours)).toEqual(
      [...tiers.map((tier) => tier.hours)].sort((a, b) => a - b),
    );
  });

  it("says hours up to two days and days beyond", () => {
    expect(formatHours(2)).toBe("2 hours");
    expect(formatHours(1)).toBe("1 hour");
    expect(formatHours(24)).toBe("24 hours");
    expect(formatHours(168)).toBe("7 days");
    expect(formatHours(48)).toBe("2 days");
  });

  it("names each plan rather than a single global number", () => {
    const description = describeRetention();
    for (const tier of tierRetention()) {
      expect(description).toContain(tier.name);
    }
    expect(shortRetention()).toContain("free");
  });
});
