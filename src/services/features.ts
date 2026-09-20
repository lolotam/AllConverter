// Which converters the site offers. An admin can hide one from the dashboard — useful
// when a tool is unreliable, or a format should not be advertised yet.
import { getJsonSetting, setSetting } from "./settings";

const KEY = "converters.hidden";

export function hiddenConverters(): string[] {
  return getJsonSetting<string[]>(KEY, []);
}

export function setHiddenConverters(names: string[]): void {
  setSetting(KEY, JSON.stringify([...new Set(names)].sort()));
}

/**
 * Drops the hidden converters from a converter-keyed map. Applied everywhere a converter
 * can be picked, not only on the landing page, so hiding one really takes it out of use.
 */
export function onlyVisible<T>(byConverter: Record<string, T>): Record<string, T> {
  const hidden = new Set(hiddenConverters());
  return Object.fromEntries(
    Object.entries(byConverter).filter(([converter]) => !hidden.has(converter)),
  );
}
