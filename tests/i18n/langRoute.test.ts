import { describe, expect, it } from "bun:test";
import { langRoute } from "../../src/i18n/langRoute";

const switchTo = (locale: string, referer?: string) =>
  langRoute.handle(
    new Request(`http://convertx.test/lang/${locale}`, {
      headers: referer ? { referer } : {},
    }),
  );

describe("the language switch", () => {
  it("returns the visitor to the page they came from", async () => {
    const response = await switchTo("ar", "http://convertx.test/history?page=2");
    expect(response.headers.get("location")).toBe("/history?page=2");
    expect(response.headers.get("set-cookie")).toContain("lang=ar");
  });

  it("ignores a referer from another site, which could otherwise choose the landing page", async () => {
    const response = await switchTo("ar", "https://evil.example.com/somewhere");
    expect(response.headers.get("location")).toBe("/");
  });

  it("ignores a referer that is not a URL at all", async () => {
    const response = await switchTo("ar", "not a url");
    expect(response.headers.get("location")).toBe("/");
  });

  it("sets no cookie for a language it does not have", async () => {
    const response = await switchTo("zz", "http://convertx.test/");
    expect(response.headers.get("set-cookie") ?? "").not.toContain("lang=zz");
  });
});
