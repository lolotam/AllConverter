// Which output formats the site offers, and which tool runs behind each one.
//
// Customers pick a format and nothing else; the converter is an admin decision made once
// per format. That choice is a *preference*: no single tool can produce, say, PDF from
// every input, so when the preferred one cannot accept the upload the next capable
// converter runs instead. See `resolveConverter`.
import { onlyAvailable } from "../converters/availability";
import { categoryOf, type Category } from "../converters/categories";
import { getAllTargets, getPossibleSources, getPossibleTargets } from "../converters/main";
import { getJsonSetting, getSetting, setSetting } from "./settings";

const HIDDEN_KEY = "formats.hidden";
const PREFERRED_KEY = "formats.converter";
const MIGRATED_KEY = "formats.migrated";

// Superseded by the two keys above; read once by the migration below, then left alone.
const OLD_CONVERTERS_KEY = "converters.hidden";
const OLD_FORMATS_KEY = "converters.hiddenFormats";

export type FormatRow = {
  format: string;
  category: Category;
  /** Every installed converter that can produce this format. */
  converters: string[];
  /** The preferred one — the admin's choice, or the first capable converter. */
  converter: string;
  /** Input formats that reach this one, across every capable converter. */
  accepts: string[];
  visible: boolean;
};

/** Every output format an installed converter can produce, lowercased and deduplicated. */
function everyFormat(): Map<string, string[]> {
  const byFormat = new Map<string, string[]>();

  for (const [converter, targets] of Object.entries(onlyAvailable(getAllTargets()))) {
    for (const target of Array.isArray(targets) ? targets : []) {
      const format = String(target).toLowerCase();
      const converters = byFormat.get(format);
      if (converters) {
        if (!converters.includes(converter)) {
          converters.push(converter);
        }
      } else {
        byFormat.set(format, [converter]);
      }
    }
  }

  return byFormat;
}

export function hiddenOutputFormats(): string[] {
  migrateFromConverterSettings();
  return getJsonSetting<string[]>(HIDDEN_KEY, []);
}

/** Stores the complement: everything installed but not in `formats` is switched off. */
export function setOfferedFormats(formats: string[]): void {
  // Marks the migration done, so a later read cannot overwrite what is being saved here
  migrateFromConverterSettings();
  const offered = new Set(formats.map((format) => format.toLowerCase()));
  const hidden = [...everyFormat().keys()].filter((format) => !offered.has(format)).sort();
  setSetting(HIDDEN_KEY, JSON.stringify(hidden));
}

export function preferredConverters(): Record<string, string> {
  return getJsonSetting<Record<string, string>>(PREFERRED_KEY, {});
}

/** Merges into what is already stored; a format mapped to "" goes back to the default. */
export function setPreferredConverters(choices: Record<string, string>): void {
  const all = preferredConverters();
  const capable = everyFormat();

  for (const [format, converter] of Object.entries(choices)) {
    const key = format.toLowerCase();
    // Never trust a posted converter name: it has to be one that really produces this
    if (!converter || !(capable.get(key) ?? []).includes(converter)) {
      delete all[key];
    } else {
      all[key] = converter;
    }
  }

  setSetting(PREFERRED_KEY, JSON.stringify(all));
}

/** One row per output format, for the admin table. */
export function formatCatalogue(): FormatRow[] {
  const hidden = new Set(hiddenOutputFormats());
  const preferred = preferredConverters();

  return [...everyFormat().entries()]
    .map(([format, converters]) => {
      const sources = getPossibleSources(format);
      const accepts = [
        ...new Set(
          converters
            .flatMap((converter) => sources[converter] ?? [])
            .map((from) => from.toLowerCase()),
        ),
      ].sort((a, b) => a.localeCompare(b));

      const choice = preferred[format];
      return {
        format,
        category: categoryOf(format),
        converters: [...converters].sort((a, b) => a.localeCompare(b)),
        // A converter that has since been uninstalled falls back to whatever is left
        converter: choice && converters.includes(choice) ? choice : (converters[0] ?? ""),
        accepts,
        visible: !hidden.has(format),
      };
    })
    .sort((a, b) => a.format.localeCompare(b.format));
}

/**
 * The converter that should run for this conversion, or null when nothing can do it.
 *
 * The admin's preference wins whenever it can accept the input. Otherwise the first
 * converter that can — the order in `main.ts` is a deliberate priority list, which is why
 * Inkscape sits at the top of it.
 */
export function resolveConverter(from: string, to: string): string | null {
  const target = to.toLowerCase();
  if (hiddenOutputFormats().includes(target)) {
    return null;
  }

  const capable = Object.entries(onlyAvailable(getPossibleTargets(from)))
    .filter(([, targets]) => targets.some((format) => format.toLowerCase() === target))
    .map(([converter]) => converter);

  return pickConverter(capable, preferredConverters()[target]);
}

/** The decision on its own: the preference if it can do the job, else the first that can. */
function pickConverter(capable: string[], preferred: string | undefined): string | null {
  if (capable.length === 0) {
    return null;
  }
  return preferred && capable.includes(preferred) ? preferred : (capable[0] ?? null);
}

/**
 * Drops hidden formats from a converter-keyed map. Applied everywhere a target can be
 * picked, not only on the landing page, so switching a format off really takes it out of
 * use. A converter left with nothing to offer disappears with them.
 */
export function visibleTargets(byConverter: Record<string, string[]>): Record<string, string[]> {
  const hidden = new Set(hiddenOutputFormats());

  return Object.fromEntries(
    Object.entries(byConverter)
      .map(
        ([converter, formats]) =>
          [converter, formats.filter((format) => !hidden.has(format.toLowerCase()))] as const,
      )
      .filter(([, formats]) => formats.length > 0),
  );
}

/**
 * Moves the old per-converter settings onto the format-level ones, once.
 *
 * A format is only switched off if it was hidden under *every* converter that offers it —
 * otherwise a format an admin had hidden on one converter but deliberately left on another
 * would vanish from the site on upgrade.
 */
function migrateFromConverterSettings(): void {
  if (getSetting(MIGRATED_KEY)) {
    return;
  }

  const hiddenConverters = new Set(getJsonSetting<string[]>(OLD_CONVERTERS_KEY, []));
  const hiddenFormats = getJsonSetting<Record<string, string[]>>(OLD_FORMATS_KEY, {});

  const hidden = [...everyFormat().entries()]
    .filter(([format, converters]) =>
      converters.every(
        (converter) =>
          hiddenConverters.has(converter) || (hiddenFormats[converter] ?? []).includes(format),
      ),
    )
    .map(([format]) => format)
    .sort();

  setSetting(HIDDEN_KEY, JSON.stringify(hidden));
  setSetting(MIGRATED_KEY, new Date().toISOString());
}

/**
 * @internal For testing only. Do not use in production.
 * Lets the fallback rule be covered without needing every converter installed.
 */
export { pickConverter };
