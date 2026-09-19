// Programs each converter runs (see the execFile calls in each converter file).
// Converters written in JS, like vcf, need none. Unknown converters are assumed
// available so a newly added converter is not hidden by accident.
const EXECUTABLES: Record<string, string[]> = {
  assimp: ["assimp"],
  calibre: ["ebook-convert"],
  dasel: ["dasel"],
  dvisvgm: ["dvisvgm"],
  ffmpeg: ["ffmpeg"],
  graphicsmagick: ["gm"],
  imagemagick: ["magick"],
  inkscape: ["inkscape"],
  libheif: ["heif-convert"],
  libjxl: ["cjxl", "djxl"],
  libreoffice: ["soffice"],
  markitDown: ["markitdown"],
  msgconvert: ["msgconvert"],
  pandoc: ["pandoc"],
  pdftops: ["pdftops"],
  potrace: ["potrace"],
  resvg: ["resvg"],
  vcf: [],
  vips: ["vips"],
  vtracer: ["vtracer"],
  xelatex: ["latexmk"],
};

export function missingExecutables(
  converter: string,
  which: (command: string) => string | null = Bun.which,
): string[] {
  return (EXECUTABLES[converter] ?? []).filter((executable) => !which(executable));
}

// PATH lookups are cached for the life of the process: restart after installing a tool
const available = new Map<string, boolean>();

export function isConverterAvailable(converter: string): boolean {
  let isAvailable = available.get(converter);
  if (isAvailable === undefined) {
    isAvailable = missingExecutables(converter).length === 0;
    available.set(converter, isAvailable);
  }
  return isAvailable;
}

/** Drops converters whose programs are not installed, so users are never offered them. */
export function onlyAvailable<T>(byConverter: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(byConverter).filter(([converter]) => isConverterAvailable(converter)),
  );
}

export function unavailableConverters(): { converter: string; missing: string[] }[] {
  return Object.keys(EXECUTABLES)
    .map((converter) => ({ converter, missing: missingExecutables(converter) }))
    .filter(({ missing }) => missing.length > 0);
}
