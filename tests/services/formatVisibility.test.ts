import { describe, expect, it } from "bun:test";
import { pickConverter } from "../../src/services/features";

// The fallback rule on its own. resolveConverter wraps this with the real converter tables,
// which only answer usefully on an image that has the tools installed.
describe("preferred converter with fallback", () => {
  it("uses the admin's choice when it can accept the input", () => {
    expect(pickConverter(["libreoffice", "imagemagick"], ["libreoffice"])).toBe("libreoffice");
  });

  it("falls back when the preferred converter cannot read this input", () => {
    // Only imagemagick reaches PDF from a PNG, whatever the admin picked for PDF
    expect(pickConverter(["imagemagick"], ["libreoffice"])).toBe("imagemagick");
  });

  it("uses the first capable converter when no preference is set", () => {
    expect(pickConverter(["inkscape", "imagemagick"], [])).toBe("inkscape");
  });

  it("ignores a preference that is no longer installed", () => {
    expect(pickConverter(["vips"], ["graphicsmagick"])).toBe("vips");
  });

  it("returns null when nothing can do the conversion", () => {
    expect(pickConverter([], ["ffmpeg"])).toBeNull();
    expect(pickConverter([], [])).toBeNull();
  });
});

// An admin who switched a converter off before this version removed the converter-level
// switch should not find it quietly back in use after upgrading.
describe("converters disabled before the upgrade", () => {
  const excluded = new Set(["graphicsmagick"]);

  it("is kept out of automatic selection", () => {
    expect(pickConverter(["graphicsmagick", "vips"], [], excluded)).toBe("vips");
  });

  it("is kept out of the fallback too, not just the first choice", () => {
    // The preference cannot read this input, so resolution falls through to the rest
    expect(pickConverter(["graphicsmagick", "imagemagick"], ["libreoffice"], excluded)).toBe(
      "imagemagick",
    );
  });

  it("is not used even when it is the only thing that could do the job", () => {
    // Before the upgrade a switched-off converter was dropped outright, so this conversion
    // was not on offer either. Resurrecting it as a last resort would add capability the
    // admin had deliberately taken away.
    expect(pickConverter(["graphicsmagick"], [], excluded)).toBeNull();
  });

  it("is honoured when the admin picks it again explicitly", () => {
    expect(pickConverter(["graphicsmagick", "vips"], ["graphicsmagick"], excluded)).toBe(
      "graphicsmagick",
    );
  });

  it("changes nothing when no converter was ever disabled", () => {
    expect(pickConverter(["inkscape", "imagemagick"], [], new Set())).toBe("inkscape");
  });
});

// The admin lines up a default and two fallbacks per format; resolution walks them in order
// and only decides for itself once the chain runs out.
describe("the converter chain", () => {
  it("takes the first link that can read this input", () => {
    expect(pickConverter(["calibre", "pandoc"], ["libreoffice", "calibre", "pandoc"])).toBe(
      "calibre",
    );
  });

  it("falls to the second link when the first cannot", () => {
    expect(pickConverter(["pandoc"], ["libreoffice", "calibre", "pandoc"])).toBe("pandoc");
  });

  it("keeps the admin's order rather than the built-in one", () => {
    // inkscape sorts first, but the admin asked for imagemagick
    expect(pickConverter(["imagemagick", "inkscape"], ["imagemagick"])).toBe("imagemagick");
  });

  it("decides for itself past the end of the chain", () => {
    expect(pickConverter(["inkscape", "vips"], ["libreoffice"])).toBe("inkscape");
  });

  it("still refuses an excluded converter once the chain is spent", () => {
    expect(
      pickConverter(["graphicsmagick"], ["libreoffice"], new Set(["graphicsmagick"])),
    ).toBeNull();
  });

  it("honours an excluded converter named in the chain", () => {
    expect(
      pickConverter(["graphicsmagick", "vips"], ["graphicsmagick"], new Set(["graphicsmagick"])),
    ).toBe("graphicsmagick");
  });
});
