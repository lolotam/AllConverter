// Which output formats the site offers, and which tool runs behind each one.
//
// Customers pick a format and nothing else; the converter is an admin decision made once
// per format. That choice is a *preference*: no single tool can produce, say, PDF from
// every input, so when the preferred one cannot accept the upload the next capable
// converter runs instead. See `resolveConverter`.
import { onlyAvailable } from "../converters/availability";
import { categoryOf, type Category } from "../converters/categories";
import { getAllTargets, getPossibleSources, getPossibleTargets } from "../converters/main";
import { normalizeFiletype } from "../helpers/normalizeFiletype";
import { getJsonSetting, getSetting, setSetting } from "./settings";

const HIDDEN_KEY = "formats.hidden";
const PREFERRED_KEY = "formats.converter";
const MIGRATED_KEY = "formats.migrated";
/** Converters switched off before the upgrade; kept out of automatic selection. */
const EXCLUDED_KEY = "formats.excludedConverters";

// Superseded by the two keys above; read once by the migration below, then left alone.
const OLD_CONVERTERS_KEY = "converters.hidden";
const OLD_FORMATS_KEY = "converters.hiddenFormats";

export type FormatRow = {
  /** The canonical key this format is stored under. */
  format: string;
  /** The extension people actually type, for display. */
  label: string;
  category: Category;
  /** Every installed converter that can produce this format. */
  converters: string[];
  /** The preferred one — the admin's choice, or the first capable converter. */
  converter: string;
  /** Input formats that reach this one, across every capable converter. */
  accepts: string[];
  visible: boolean;
};

/**
 * The key a format is stored under. Converters spell the same format several ways — jpg and
 * jpeg, md and markdown, tex and latex — and `/convert` runs the target through
 * normalizeFiletype before doing anything with it. Keying off anything else means an admin
 * can switch off "jpeg", watch "jpg" stay on the landing page, and have the conversion
 * refused as hidden the moment somebody picks it.
 */
const canonical = (format: string): string => normalizeFiletype(String(format).toLowerCase());

/** The reverse, for display: the internal key is not what anyone calls the format. */
const FRIENDLY: Record<string, string> = { jpeg: "jpg", latex: "tex", markdown: "md" };

/** The key a format is stored and looked up under. */
export const canonicalFormat = (format: string): string => canonical(format);

/**
 * What to show and offer for a format. Pickers must build their list from this, or a
 * converter advertising both spellings — ImageMagick lists jpg and jpeg — puts two cards
 * on screen for one conversion.
 */
export const formatLabel = (format: string): string => {
  const key = canonical(format);
  return FRIENDLY[key] ?? key;
};

/**
 * Every output format an installed converter can produce, keyed canonically so aliases are
 * one entry. `raw` keeps the spellings the converters themselves use, which is what the
 * input-format index is keyed by.
 */
function everyFormat(): Map<string, { converters: string[]; raw: Set<string> }> {
  const byFormat = new Map<string, { converters: string[]; raw: Set<string> }>();

  for (const [converter, targets] of Object.entries(onlyAvailable(getAllTargets()))) {
    for (const target of Array.isArray(targets) ? targets : []) {
      const format = canonical(target);
      const entry = byFormat.get(format);
      if (entry) {
        if (!entry.converters.includes(converter)) {
          entry.converters.push(converter);
        }
        entry.raw.add(String(target).toLowerCase());
      } else {
        byFormat.set(format, {
          converters: [converter],
          raw: new Set([String(target).toLowerCase()]),
        });
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
  const offered = new Set(formats.map(canonical));
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
    const key = canonical(format);
    // Never trust a posted converter name: it has to be one that really produces this
    if (!converter || !(capable.get(key)?.converters ?? []).includes(converter)) {
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
    .map(([format, { converters, raw }]) => {
      // The input index is keyed by the spellings converters use, so every alias of this
      // format has to be asked, not just the canonical one
      const accepts = [
        ...new Set(
          [...raw].flatMap((name) => {
            const sources = getPossibleSources(name);
            return converters.flatMap((converter) => sources[converter] ?? []);
          }),
        ),
      ]
        .map((from) => from.toLowerCase())
        .sort((a, b) => a.localeCompare(b));

      const choice = preferred[format];
      return {
        format,
        label: FRIENDLY[format] ?? format,
        category: categoryOf(format),
        converters: [...converters].sort((a, b) => a.localeCompare(b)),
        // A converter that has since been uninstalled falls back to whatever is left
        converter: choice && converters.includes(choice) ? choice : (converters[0] ?? ""),
        accepts,
        visible: !hidden.has(format),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The converter that should run for this conversion, or null when nothing can do it.
 *
 * The admin's preference wins whenever it can accept the input. Otherwise the first
 * converter that can — the order in `main.ts` is a deliberate priority list, which is why
 * Inkscape sits at the top of it.
 */
export function resolveConverter(from: string, to: string): string | null {
  const target = canonical(to);
  if (hiddenOutputFormats().includes(target)) {
    return null;
  }

  const capable = Object.entries(onlyAvailable(getPossibleTargets(from)))
    .filter(([, targets]) => targets.some((format) => canonical(format) === target))
    .map(([converter]) => converter);

  return pickConverter(capable, preferredConverters()[target], new Set(excludedConverters()));
}

/**
 * Converters an admin had switched off before this version removed the converter-level
 * switch. They stay out of automatic selection — reinstating a tool somebody disabled
 * because it was unreliable should not happen behind their back.
 */
function excludedConverters(): string[] {
  migrateFromConverterSettings();
  return getJsonSetting<string[]>(EXCLUDED_KEY, []);
}

/** The decision on its own: the preference if it can do the job, else the first that can. */
function pickConverter(
  capable: string[],
  preferred: string | undefined,
  excluded: ReadonlySet<string> = new Set(),
): string | null {
  if (capable.length === 0) {
    return null;
  }
  // An explicit choice always wins, including a converter that was switched off before the
  // upgrade — picking it in the dropdown is the admin saying they want it back.
  if (preferred && capable.includes(preferred)) {
    return preferred;
  }
  // Otherwise a converter they had switched off is not resurrected. If it is the only thing
  // that could do this particular conversion, the answer is that we do not do it — which is
  // exactly what happened before the upgrade, when a switched-off converter was dropped
  // outright rather than kept as a last resort.
  const allowed = capable.filter((converter) => !excluded.has(converter));
  return allowed[0] ?? null;
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
          // Compared canonically, so switching off "jpeg" takes "jpg" with it instead of
          // leaving a card that /convert would refuse
          [converter, formats.filter((format) => !hidden.has(canonical(format)))] as const,
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
  const wasHidden = (converter: string, format: string, aliases: Set<string>) =>
    hiddenConverters.has(converter) ||
    (hiddenFormats[converter] ?? []).some((name) => name === format || aliases.has(name));

  const catalogue = [...everyFormat().entries()];

  const hidden = catalogue
    .filter(([format, { converters, raw }]) =>
      converters.every((converter) => wasHidden(converter, format, raw)),
    )
    .map(([format]) => format)
    .sort();

  // An admin who switched a converter off usually did so because it was unreliable. The new
  // model has no converter-level off switch, so that intent is carried over as a per-format
  // preference: anything it used to produce now points at a converter that was left on,
  // wherever one exists. Without this the disabled tool would quietly become the default,
  // since the fallback is simply the first capable converter.
  const stillHidden = new Set(hidden);
  const preferences: Record<string, string> = {};
  for (const [format, { converters, raw }] of catalogue) {
    if (stillHidden.has(format)) {
      continue;
    }
    const allowed = converters.filter((converter) => !wasHidden(converter, format, raw));
    const wouldDefaultTo = converters[0];
    if (allowed.length > 0 && wouldDefaultTo && !allowed.includes(wouldDefaultTo)) {
      preferences[format] = allowed[0] as string;
    }
  }

  setSetting(HIDDEN_KEY, JSON.stringify(hidden));
  if (Object.keys(preferences).length > 0) {
    setSetting(PREFERRED_KEY, JSON.stringify({ ...preferences, ...preferredConverters() }));
  }
  // The preference above covers the tool picked first; this keeps the disabled one out of
  // the fallback too, for the inputs the preferred converter cannot read.
  if (hiddenConverters.size > 0) {
    setSetting(EXCLUDED_KEY, JSON.stringify([...hiddenConverters].sort()));
  }
  setSetting(MIGRATED_KEY, new Date().toISOString());
}

/**
 * @internal For testing only. Do not use in production.
 * Lets the fallback rule be covered without needing every converter installed.
 */
export { pickConverter };
