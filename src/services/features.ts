// Which converters and which of their formats the site offers. An admin can hide a whole
// converter — useful when a tool is unreliable — or single formats within one.
import { getJsonSetting, setSetting } from "./settings";

const CONVERTERS_KEY = "converters.hidden";
const FORMATS_KEY = "converters.hiddenFormats";

export function hiddenConverters(): string[] {
  return getJsonSetting<string[]>(CONVERTERS_KEY, []);
}

export function setHiddenConverters(names: string[]): void {
  setSetting(CONVERTERS_KEY, JSON.stringify([...new Set(names)].sort()));
}

/** Hidden output formats, per converter. */
export function hiddenFormats(): Record<string, string[]> {
  return getJsonSetting<Record<string, string[]>>(FORMATS_KEY, {});
}

export function setHiddenFormatsFor(converter: string, formats: string[]): void {
  const all = hiddenFormats();
  if (formats.length === 0) {
    delete all[converter];
  } else {
    all[converter] = [...new Set(formats.map((format) => format.toLowerCase()))].sort();
  }
  setSetting(FORMATS_KEY, JSON.stringify(all));
}

export function isFormatHidden(converter: string, format: string): boolean {
  return (hiddenFormats()[converter] ?? []).includes(format.toLowerCase());
}

/**
 * Drops hidden converters from a converter-keyed map. Applied everywhere a converter can
 * be picked, not only on the landing page, so hiding one really takes it out of use.
 */
export function onlyVisible<T>(byConverter: Record<string, T>): Record<string, T> {
  const hidden = new Set(hiddenConverters());
  return Object.fromEntries(
    Object.entries(byConverter).filter(([converter]) => !hidden.has(converter)),
  );
}

/**
 * The same, but also removes individual formats an admin has hidden. A converter left
 * with nothing to offer disappears with them.
 */
export function visibleTargets(byConverter: Record<string, string[]>): Record<string, string[]> {
  const hidden = new Set(hiddenConverters());
  const hiddenByConverter = hiddenFormats();

  return Object.fromEntries(
    Object.entries(byConverter)
      .filter(([converter]) => !hidden.has(converter))
      .map(([converter, formats]) => {
        const off = new Set(hiddenByConverter[converter] ?? []);
        return [converter, formats.filter((format) => !off.has(format.toLowerCase()))] as const;
      })
      .filter(([, formats]) => formats.length > 0),
  );
}
