import { afterEach, describe, expect, it } from "bun:test";
import {
  hiddenFormats,
  setHiddenConverters,
  setHiddenFormatsFor,
  visibleTargets,
} from "../../src/services/features";

afterEach(() => {
  setHiddenConverters([]);
  setHiddenFormatsFor("ffmpeg", []);
  setHiddenFormatsFor("pandoc", []);
});

describe("format visibility", () => {
  it("offers every format until one is hidden", () => {
    expect(visibleTargets({ ffmpeg: ["mp4", "mp3"] })).toEqual({ ffmpeg: ["mp4", "mp3"] });
  });

  it("removes only the formats an admin unticked", () => {
    setHiddenFormatsFor("ffmpeg", ["mp3"]);
    expect(visibleTargets({ ffmpeg: ["mp4", "mp3"], pandoc: ["docx"] })).toEqual({
      ffmpeg: ["mp4"],
      pandoc: ["docx"],
    });
  });

  it("drops a converter left with nothing to offer", () => {
    setHiddenFormatsFor("ffmpeg", ["mp4", "mp3"]);
    expect(visibleTargets({ ffmpeg: ["mp4", "mp3"], pandoc: ["docx"] })).toEqual({
      pandoc: ["docx"],
    });
  });

  it("still hides a converter switched off as a whole", () => {
    setHiddenConverters(["pandoc"]);
    expect(visibleTargets({ ffmpeg: ["mp4"], pandoc: ["docx"] })).toEqual({ ffmpeg: ["mp4"] });
  });

  it("stores hidden formats lowercased, once each, per converter", () => {
    setHiddenFormatsFor("ffmpeg", ["MP4", "mp4", "MKV"]);
    expect(hiddenFormats().ffmpeg).toEqual(["mkv", "mp4"]);
  });
});
