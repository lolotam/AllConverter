import { describe, expect, it } from "bun:test";
import {
  MAX_AVATAR_BYTES,
  avatarContentType,
  avatarUrl,
  initialsOf,
  saveAvatar,
} from "../../src/services/avatar";

describe("profile pictures", () => {
  it("refuses a file type that is not a raster image", async () => {
    const svg = new File(["<svg onload='alert(1)'/>"], "x.svg", { type: "image/svg+xml" });
    expect(await saveAvatar("1", svg)).toBe("type");
  });

  it("refuses a file whose bytes are not the image type it claims", async () => {
    const disguised = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "x.png", {
      type: "image/png",
    });
    expect(await saveAvatar("1", disguised)).toBe("type");
  });

  it("refuses an empty file and one over the limit", async () => {
    expect(await saveAvatar("1", new File([], "x.png", { type: "image/png" }))).toBe("size");
    const tooBig = new File([new Uint8Array(MAX_AVATAR_BYTES + 1)], "x.png", { type: "image/png" });
    expect(await saveAvatar("1", tooBig)).toBe("size");
  });

  it("names the type from the stored file", () => {
    expect(avatarContentType("7.jpg")).toBe("image/jpeg");
    expect(avatarContentType("7.webp")).toBe("image/webp");
    expect(avatarContentType("7.exe")).toBe("application/octet-stream");
  });

  it("has no link until a picture was uploaded", () => {
    expect(avatarUrl("", "7", null)).toBeNull();
    expect(avatarUrl("", "7", "7.png")).toStartWith("/avatar/7?v=");
  });

  it("falls back to initials from the name, then the email", () => {
    expect(initialsOf("Waleed Mohamed", "someone@example.com")).toBe("WM");
    expect(initialsOf("Waleed", "someone@example.com")).toBe("WA");
    expect(initialsOf(null, "waleed.mohamed@example.com")).toBe("WM");
    expect(initialsOf("  ", "zoe@example.com")).toBe("ZO");
  });
});
