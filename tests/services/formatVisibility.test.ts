import { describe, expect, it } from "bun:test";
import { pickConverter } from "../../src/services/features";

// The fallback rule on its own. resolveConverter wraps this with the real converter tables,
// which only answer usefully on an image that has the tools installed.
describe("preferred converter with fallback", () => {
  it("uses the admin's choice when it can accept the input", () => {
    expect(pickConverter(["libreoffice", "imagemagick"], "libreoffice")).toBe("libreoffice");
  });

  it("falls back when the preferred converter cannot read this input", () => {
    // Only imagemagick reaches PDF from a PNG, whatever the admin picked for PDF
    expect(pickConverter(["imagemagick"], "libreoffice")).toBe("imagemagick");
  });

  it("uses the first capable converter when no preference is set", () => {
    expect(pickConverter(["inkscape", "imagemagick"], undefined)).toBe("inkscape");
  });

  it("ignores a preference that is no longer installed", () => {
    expect(pickConverter(["vips"], "graphicsmagick")).toBe("vips");
  });

  it("returns null when nothing can do the conversion", () => {
    expect(pickConverter([], "ffmpeg")).toBeNull();
    expect(pickConverter([], undefined)).toBeNull();
  });
});
