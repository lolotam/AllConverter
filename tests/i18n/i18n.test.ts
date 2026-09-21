import { describe, expect, it } from "bun:test";
import { ar } from "../../src/i18n/ar";
import { en, type MessageKey } from "../../src/i18n/en";
import { isRtl, localeFromRequest, messages, safeT } from "../../src/i18n";

const requestWith = (headers: Record<string, string>) =>
  new Request("http://localhost/", { headers });

describe("message parity", () => {
  it("has every English key in Arabic and vice versa", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it("never stores an empty string", () => {
    for (const [locale, table] of Object.entries(messages)) {
      for (const [key, value] of Object.entries(table)) {
        expect(`${locale}:${key}`).toSatisfy(() => typeof value === "string" && value.length > 0);
      }
    }
  });
});

describe("safeT()", () => {
  it("returns the message in the requested locale", () => {
    expect(safeT("en", "header.signIn")).toBe("Sign In");
    expect(safeT("ar", "header.signIn")).toBe("تسجيل الدخول");
  });

  it("falls back to English when the Arabic string is missing", () => {
    const key: MessageKey = "header.signIn";
    const backup = messages.ar[key];
    delete messages.ar[key];
    expect(safeT("ar", key)).toBe(messages.en[key]);
    messages.ar[key] = backup;
  });

  it("falls back to the key itself when unknown", () => {
    expect(safeT("en", "made.up.key" as MessageKey)).toBe("made.up.key");
    expect(safeT("ar", "made.up.key" as MessageKey)).toBe("made.up.key");
  });

  it("substitutes {name} placeholders and leaves unknown ones alone", () => {
    expect(safeT("en", "home.tag", { from: "PDF", to: "Word" })).toBe("PDF to Word");
    expect(safeT("ar", "home.tag", { from: "PDF", to: "Word" })).toBe("PDF إلى Word");
    expect(safeT("en", "home.tag")).toBe("{from} to {to}");
    expect(safeT("en", "home.tag", { from: "PDF" })).toBe("PDF to {to}");
  });

  // The name is a promise the callers rely on: pages interpolate the result without a
  // `safe` attribute, and @kitajs/html escapes nothing on its own. Parameters are the part
  // we do not write — filenames, values an admin typed into the dashboard.
  it("escapes what callers pass in, so the result is safe to render raw", () => {
    expect(safeT("en", "home.tag", { from: "<img src=x onerror=alert(1)>", to: "Word" })).toBe(
      "&lt;img src=x onerror=alert(1)&gt; to Word",
    );
    expect(safeT("en", "home.tag", { from: '"', to: "&" })).toBe("&quot; to &amp;");
  });

  it("leaves the messages themselves alone, which we do write", () => {
    expect(safeT("en", "header.signIn")).not.toContain("&");
  });
});

describe("localeFromRequest()", () => {
  it("prefers the lang cookie over Accept-Language", () => {
    const request = requestWith({ "Accept-Language": "ar" });
    expect(localeFromRequest(request, "en")).toBe("en");
    expect(localeFromRequest(request, "ar")).toBe("ar");
  });

  it("parses Accept-Language when no cookie is set", () => {
    expect(localeFromRequest(requestWith({ "Accept-Language": "ar" }), undefined)).toBe("ar");
    expect(localeFromRequest(requestWith({ "Accept-Language": "de-DE,ar;q=0.8" }), undefined)).toBe(
      "ar",
    );
    expect(localeFromRequest(requestWith({ "Accept-Language": "fr-FR" }), undefined)).toBe("en");
  });

  it("ignores an unknown cookie value and honours quality values", () => {
    expect(localeFromRequest(requestWith({ "Accept-Language": "ar;q=0.3,en;q=0.9" }), "xx")).toBe(
      "en",
    );
    expect(localeFromRequest(requestWith({}), "not-a-locale")).toBe("en");
  });
});

describe("isRtl()", () => {
  it("marks Arabic as right-to-left", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("en")).toBe(false);
  });
});
