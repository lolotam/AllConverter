import { describe, expect, it } from "bun:test";
import { CATEGORY_ORDER, categoryOf, groupByCategory } from "../../src/converters/categories";

describe("categoryOf", () => {
  it("files the formats a customer would recognise", () => {
    expect(categoryOf("mp4")).toBe("Video");
    expect(categoryOf("avi")).toBe("Video");
    expect(categoryOf("mp3")).toBe("Audio");
    expect(categoryOf("png")).toBe("Image");
    expect(categoryOf("pdf")).toBe("Document");
    expect(categoryOf("epub")).toBe("Ebook");
    expect(categoryOf("svg")).toBe("Vector");
    expect(categoryOf("csv")).toBe("Data");
    expect(categoryOf("stl")).toBe("3D");
  });

  it("does not let ffmpeg's one big group turn audio into video", () => {
    expect(categoryOf("flac")).toBe("Audio");
    expect(categoryOf("wav")).toBe("Audio");
    expect(categoryOf("opus")).toBe("Audio");
  });

  it("ignores case", () => {
    expect(categoryOf("MP4")).toBe(categoryOf("mp4"));
    expect(categoryOf("PnG")).toBe("Image");
  });

  it("places an unknown format rather than dropping it", () => {
    expect(categoryOf("not-a-real-format")).toBe("Other");
    expect(categoryOf("")).toBe("Other");
  });
});

describe("groupByCategory", () => {
  it("returns categories in display order and leaves out empty ones", () => {
    const grouped = groupByCategory(["pdf", "mp4", "png", "mp3"], categoryOf);

    expect(grouped.map((bucket) => bucket.category)).toEqual([
      "Image",
      "Video",
      "Audio",
      "Document",
    ]);
    expect(grouped[0]?.rows).toEqual(["png"]);
    expect(grouped.every((bucket) => bucket.rows.length > 0)).toBe(true);
  });

  it("keeps every row", () => {
    const formats = ["pdf", "mp4", "png", "mp3", "not-a-real-format"];
    const grouped = groupByCategory(formats, categoryOf);

    expect(grouped.flatMap((bucket) => bucket.rows).sort()).toEqual([...formats].sort());
  });

  it("orders categories the same way every time", () => {
    expect(CATEGORY_ORDER.indexOf("Image")).toBeLessThan(CATEGORY_ORDER.indexOf("Other"));
  });
});
