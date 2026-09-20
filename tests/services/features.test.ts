import { afterEach, describe, expect, it } from "bun:test";
import { hiddenConverters, onlyVisible, setHiddenConverters } from "../../src/services/features";

afterEach(() => {
  setHiddenConverters([]);
});

describe("converter visibility", () => {
  it("offers everything by default", () => {
    expect(hiddenConverters()).toEqual([]);
    expect(onlyVisible({ ffmpeg: ["mp4"], pandoc: ["docx"] })).toEqual({
      ffmpeg: ["mp4"],
      pandoc: ["docx"],
    });
  });

  it("drops a hidden converter from the offer", () => {
    setHiddenConverters(["ffmpeg"]);
    expect(onlyVisible({ ffmpeg: ["mp4"], pandoc: ["docx"] })).toEqual({ pandoc: ["docx"] });
  });

  it("keeps the stored list unique and sorted", () => {
    setHiddenConverters(["pandoc", "ffmpeg", "pandoc"]);
    expect(hiddenConverters()).toEqual(["ffmpeg", "pandoc"]);
  });
});
