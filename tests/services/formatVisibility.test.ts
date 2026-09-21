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

// An admin who switched a converter off before this version removed the converter-level
// switch should not find it quietly back in use after upgrading.
describe("converters disabled before the upgrade", () => {
  const excluded = new Set(["graphicsmagick"]);

  it("is kept out of automatic selection", () => {
    expect(pickConverter(["graphicsmagick", "vips"], undefined, excluded)).toBe("vips");
  });

  it("is kept out of the fallback too, not just the first choice", () => {
    // The preference cannot read this input, so resolution falls through to the rest
    expect(pickConverter(["graphicsmagick", "imagemagick"], "libreoffice", excluded)).toBe(
      "imagemagick",
    );
  });

  it("is not used even when it is the only thing that could do the job", () => {
    // Before the upgrade a switched-off converter was dropped outright, so this conversion
    // was not on offer either. Resurrecting it as a last resort would add capability the
    // admin had deliberately taken away.
    expect(pickConverter(["graphicsmagick"], undefined, excluded)).toBeNull();
  });

  it("is honoured when the admin picks it again explicitly", () => {
    expect(pickConverter(["graphicsmagick", "vips"], "graphicsmagick", excluded)).toBe(
      "graphicsmagick",
    );
  });

  it("changes nothing when no converter was ever disabled", () => {
    expect(pickConverter(["inkscape", "imagemagick"], undefined, new Set())).toBe("inkscape");
  });
});
