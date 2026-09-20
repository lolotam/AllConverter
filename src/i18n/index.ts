import { ar } from "./ar";
import { en, type MessageKey } from "./en";

export type Locale = "en" | "ar";

export type { MessageKey };

export const messages: Record<Locale, Record<string, string>> = { en, ar };

const LOCALES: Locale[] = ["en", "ar"];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

export function isRtl(locale: Locale): boolean {
  return locale === "ar";
}

/**
 * The message for a key, falling back to English and then to the key itself.
 * {name} placeholders are replaced from params and left alone when absent.
 */
export function t(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const message = messages[locale][key] ?? messages.en[key] ?? key;
  if (!params) {
    return message;
  }
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

/**
 * The lang cookie wins; otherwise the first supported language in Accept-Language
 * (quality values honoured); otherwise English.
 */
export function localeFromRequest(request: Request, cookieValue: unknown): Locale {
  if (isLocale(cookieValue)) {
    return cookieValue;
  }

  const header = request.headers.get("accept-language");
  if (!header) {
    return "en";
  }

  const preferences = header
    .split(",")
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(";");
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith("q="));
      return {
        language: (tag ?? "").trim().split("-")[0]?.toLowerCase() ?? "",
        quality: quality ? Number.parseFloat(quality.slice(2)) : 1,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { language, quality } of preferences) {
    if (quality <= 0) {
      break;
    }
    if (isLocale(language)) {
      return language;
    }
  }

  return "en";
}
