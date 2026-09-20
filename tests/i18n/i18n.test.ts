import { describe, expect, it } from "bun:test";
import { ar } from "../../src/i18n/ar";
import { en, type MessageKey } from "../../src/i18n/en";
import { isRtl, localeFromRequest, messages, t } from "../../src/i18n";

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

describe("t()", () => {
  it("returns the message in the requested locale", () => {
    expect(t("en", "header.signIn")).toBe("Sign In");
    expect(t("ar", "header.signIn")).toBe("تسجيل الدخول");
  });

  it("falls back to English when the Arabic string is missing", () => {
    const key: MessageKey = "header.signIn";
    const backup = messages.ar[key];
    delete messages.ar[key];
    expect(t("ar", key)).toBe(messages.en[key]);
    messages.ar[key] = backup;
  });

  it("falls back to the key itself when unknown", () => {
    expect(t("en", "made.up.key" as MessageKey)).toBe("made.up.key");
    expect(t("ar", "made.up.key" as MessageKey)).toBe("made.up.key");
  });

  it("substitutes {name} placeholders and leaves unknown ones alone", () => {
    expect(t("en", "home.tag", { from: "PDF", to: "Word" })).toBe("PDF to Word");
    expect(t("ar", "home.tag", { from: "PDF", to: "Word" })).toBe("PDF إلى Word");
    expect(t("en", "home.tag")).toBe("{from} to {to}");
    expect(t("en", "home.tag", { from: "PDF" })).toBe("PDF to {to}");
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
