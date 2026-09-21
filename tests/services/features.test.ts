import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { setSetting } from "../../src/services/settings";
import {
  hiddenOutputFormats,
  preferredConverters,
  resolveConverter,
  visibleTargets,
} from "../../src/services/features";

// Written straight to the setting rather than through setOfferedFormats, which works out
// the complement from the converters installed in the image — not something a test should
// depend on, since a machine without ffmpeg would have nothing to hide.
const hide = (formats: string[]) => setSetting("formats.hidden", JSON.stringify(formats));
const prefer = (choices: Record<string, string>) =>
  setSetting("formats.converter", JSON.stringify(choices));

beforeEach(() => {
  // Stops the one-time migration from the old converter settings overwriting these
  setSetting("formats.migrated", "test");
  hide([]);
  prefer({});
});

afterEach(() => {
  hide([]);
  prefer({});
});

describe("format visibility", () => {
  it("offers every format until one is switched off", () => {
    expect(hiddenOutputFormats()).toEqual([]);
    expect(visibleTargets({ ffmpeg: ["mp4", "mp3"] })).toEqual({ ffmpeg: ["mp4", "mp3"] });
  });

  it("removes a hidden format from every converter that offers it", () => {
    hide(["mp3"]);
    expect(visibleTargets({ ffmpeg: ["mp4", "mp3"], sox: ["mp3"] })).toEqual({
      ffmpeg: ["mp4"],
    });
  });

  it("drops a converter left with nothing to offer", () => {
    hide(["mp4", "mp3"]);
    expect(visibleTargets({ ffmpeg: ["mp4", "mp3"], pandoc: ["docx"] })).toEqual({
      pandoc: ["docx"],
    });
  });

  it("matches formats regardless of case", () => {
    hide(["mp4"]);
    expect(visibleTargets({ ffmpeg: ["MP4", "mkv"] })).toEqual({ ffmpeg: ["mkv"] });
  });
});

describe("choosing the converter", () => {
  it("has no preference until an admin sets one", () => {
    expect(preferredConverters()).toEqual({});
  });

  it("refuses a format the site does not offer", () => {
    hide(["png"]);
    expect(resolveConverter("jpg", "png")).toBeNull();
  });

  it("returns null when nothing can do the conversion", () => {
    expect(resolveConverter("not-a-real-type", "also-not-real")).toBeNull();
  });
});
