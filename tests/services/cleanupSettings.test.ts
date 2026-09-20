import { afterEach, describe, expect, it } from "bun:test";
import {
  CLEANUP_INTERVAL_CHOICES,
  cleanupEnabled,
  cleanupOverrideHours,
  setCleanupEnabled,
  setCleanupOverrideHours,
} from "../../src/services/cleanup";
import { setSetting } from "../../src/services/settings";

afterEach(() => {
  setSetting("cleanup.enabled", null);
  setSetting("cleanup.overrideHours", null);
});

describe("automatic deletion settings", () => {
  it("offers the intervals the dashboard shows", () => {
    expect(CLEANUP_INTERVAL_CHOICES).toEqual([2, 4, 6, 12, 24]);
  });

  it("follows the environment until an admin decides", () => {
    // AUTO_DELETE_EVERY_N_HOURS defaults to 24 in the test environment
    expect(cleanupEnabled()).toBe(true);
    expect(cleanupOverrideHours()).toBeNull();
  });

  it("remembers a chosen window and can return to per-plan retention", () => {
    setCleanupOverrideHours(6);
    expect(cleanupOverrideHours()).toBe(6);

    setCleanupOverrideHours(null);
    expect(cleanupOverrideHours()).toBeNull();
  });

  it("can switch automatic deletion off and on", () => {
    setCleanupEnabled(false);
    expect(cleanupEnabled()).toBe(false);

    setCleanupEnabled(true);
    expect(cleanupEnabled()).toBe(true);
  });

  it("ignores a stored window that is not a usable number", () => {
    setSetting("cleanup.overrideHours", "soon");
    expect(cleanupOverrideHours()).toBeNull();
  });
});
