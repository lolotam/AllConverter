import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { normalizeFiletype } from "../../src/helpers/normalizeFiletype";
import { setSetting } from "../../src/services/settings";
import { visibleTargets } from "../../src/services/features";

// Converters spell the same format several ways, and /convert runs the chosen target
// through normalizeFiletype before looking anything up. Visibility has to agree with it,
// or an admin switches off "jpeg", "jpg" stays on the landing page, and the conversion is
// refused as hidden the moment somebody picks it.
const hide = (formats: string[]) => setSetting("formats.hidden", JSON.stringify(formats));

beforeEach(() => {
  setSetting("formats.migrated", "test");
  hide([]);
});

afterEach(() => {
  hide([]);
});

describe("format aliases", () => {
  it("normalizeFiletype still collapses the aliases this relies on", () => {
    expect(normalizeFiletype("jpg")).toBe("jpeg");
    expect(normalizeFiletype("htm")).toBe("html");
    expect(normalizeFiletype("tex")).toBe("latex");
    expect(normalizeFiletype("md")).toBe("markdown");
  });

  it("hiding the canonical name also hides the alias", () => {
    hide(["jpeg"]);
    expect(visibleTargets({ imagemagick: ["jpg", "jpeg", "png"] })).toEqual({
      imagemagick: ["png"],
    });
  });

  it("hiding the alias also hides the canonical name", () => {
    // setOfferedFormats stores canonical keys, but a hand-edited setting may not
    hide([normalizeFiletype("jpg")]);
    expect(visibleTargets({ vips: ["jpeg", "webp"] })).toEqual({ vips: ["webp"] });
  });

  it("covers the other aliases too", () => {
    hide(["markdown", "latex", "html"]);
    expect(
      visibleTargets({ pandoc: ["md", "markdown", "tex", "latex", "htm", "html", "rtf"] }),
    ).toEqual({ pandoc: ["rtf"] });
  });

  it("leaves unrelated formats alone", () => {
    hide(["jpeg"]);
    expect(visibleTargets({ ffmpeg: ["mp4", "mkv"] })).toEqual({ ffmpeg: ["mp4", "mkv"] });
  });
});
