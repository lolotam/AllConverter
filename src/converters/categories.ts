// What kind of thing a format is, so the site can group formats the way a customer thinks
// about them rather than by the tool that happens to produce them.
//
// Converters carry no usable grouping of their own: ffmpeg files everything under "muxer",
// libreoffice under "text" and "calc". So a category is worked out in two steps — an
// explicit list first, then the group its converter filed it under. Anything still unplaced
// lands in "Other" rather than disappearing, which keeps a newly added converter visible.
import { outputGroups } from "./main";

export const CATEGORY_ORDER = [
  "Image",
  "Video",
  "Audio",
  "Document",
  "Ebook",
  "Vector",
  "Data",
  "Archive",
  "3D",
  "Other",
] as const;

export type Category = (typeof CATEGORY_ORDER)[number];

/** Formats whose category the converter grouping would get wrong, or never states. */
const EXPLICIT: Partial<Record<Category, string[]>> = {
  // ffmpeg files audio and video together, so every audio format has to be named
  Audio: [
    "aac",
    "ac3",
    "ac4",
    "adts",
    "adx",
    "afc",
    "aif",
    "aifc",
    "aiff",
    "al",
    "amr",
    "aptx",
    "aptxhd",
    "ast",
    "au",
    "aud",
    "caf",
    "dfpwm",
    "dts",
    "eac3",
    "ec3",
    "flac",
    "g722",
    "gsm",
    "ircam",
    "latm",
    "lbc",
    "loas",
    "m4a",
    "m4b",
    "mka",
    "mlp",
    "mmf",
    "mp2",
    "mp3",
    "mpa",
    "msbc",
    "oga",
    "ogg",
    "oma",
    "opus",
    "ra",
    "rso",
    "sbc",
    "sf",
    "sox",
    "spdif",
    "spx",
    "thd",
    "tta",
    "ul",
    "vag",
    "voc",
    "w64",
    "wav",
    "wma",
    "wv",
  ],
  Video: [
    "264",
    "265",
    "266",
    "3g2",
    "3gp",
    "amv",
    "asf",
    "avi",
    "avs2",
    "avs3",
    "cavs",
    "dnxhd",
    "dnxhr",
    "drc",
    "dv",
    "dvd",
    "evc",
    "f4v",
    "flm",
    "flv",
    "gxf",
    "h261",
    "h263",
    "hevc",
    "isma",
    "ismv",
    "ivf",
    "m1v",
    "m2t",
    "m2ts",
    "m2v",
    "m3u8",
    "m4v",
    "mjpeg",
    "mjpg",
    "mkv",
    "mov",
    "mp4",
    "mpd",
    "mpeg",
    "mpg",
    "mts",
    "mtv",
    "mxf",
    "nut",
    "obu",
    "ogv",
    "roq",
    "rm",
    "swf",
    "ts",
    "vc1",
    "vc2",
    "vob",
    "vvc",
    "webm",
    "wmv",
    "wtv",
    "y4m",
  ],
  Ebook: [
    "azw3",
    "brf",
    "epub",
    "epub2",
    "epub3",
    "fb2",
    "htmlz",
    "kepub.epub",
    "lit",
    "lrf",
    "mobi",
    "oeb",
    "pdb",
    "pml",
    "rb",
    "snb",
    "tcr",
    "txtz",
  ],
  Vector: [
    "ai",
    "cvg",
    "dxf",
    "emf",
    "eps",
    "eps2",
    "eps3",
    "epsf",
    "epsi",
    "fxg",
    "gimppath",
    "hpgl",
    "mvg",
    "msvg",
    "pcl",
    "postscript",
    "pov",
    "ps",
    "ps2",
    "ps3",
    "rsvg",
    "sif",
    "svg",
    "svgz",
    "wmf",
    "wpg",
    "xfig",
  ],
  Data: ["csv", "geojson", "json", "csljson", "tab", "toml", "tsv", "vcf", "xml", "yaml"],
  Document: [
    "doc",
    "docbook",
    "docm",
    "docx",
    "dot",
    "dotm",
    "dotx",
    "epdf",
    "fodt",
    "htm",
    "html",
    "html4",
    "html5",
    "latex",
    "markdown",
    "md",
    "ms",
    "odg",
    "ods",
    "odt",
    "ots",
    "ott",
    "pdf",
    "pdfa",
    "pptx",
    "rtf",
    "srt",
    "ssa",
    "sub",
    "sup",
    "tex",
    "text",
    "txt",
    "vtt",
    "xhtml",
    "xls",
    "xlsm",
    "xlsx",
    "xlt",
    "xltm",
  ],
  Archive: ["zip", "tar", "gz", "7z", "rar"],
  "3D": [
    "3ds",
    "3mf",
    "collada",
    "dae",
    "fbx",
    "fbxa",
    "glb",
    "glb2",
    "gltf",
    "gltf2",
    "obj",
    "objnomtl",
    "ply",
    "plyb",
    "stl",
    "stlb",
    "stp",
  ],
};

/** The category a converter's own group key implies, used when nothing explicit matches. */
const BY_GROUP: Record<string, Category> = {
  images: "Image",
  image: "Image",
  jxl: "Image",
  muxer: "Video",
  text: "Document",
  calc: "Document",
  document: "Document",
  email: "Document",
  contacts: "Data",
  object: "3D",
};

const explicit = new Map<string, Category>();
for (const [category, formats] of Object.entries(EXPLICIT)) {
  for (const format of formats ?? []) {
    explicit.set(format.toLowerCase(), category as Category);
  }
}

// Worked out once, from the same converter tables the rest of the app reads
const byProvenance = new Map<string, Category>();
for (const { group, formats } of outputGroups()) {
  const category = BY_GROUP[group];
  if (!category) continue;
  for (const format of formats) {
    const key = format.toLowerCase();
    // First converter to claim a format wins, matching the priority order in main.ts
    if (!byProvenance.has(key)) {
      byProvenance.set(key, category);
    }
  }
}

/**
 * One hue per category, so a row in the admin format table says what kind of thing it is
 * without spending a column on it. The first six match the chapter cards on the landing
 * page, so a category is the same colour wherever somebody meets it.
 *
 * These are section-scale surfaces, never text: used here as a row stripe and a tab dot.
 *
 * Written out in full rather than built from a hue name, because Tailwind finds the classes
 * it has to generate by scanning the source — a class assembled at runtime is one it never
 * sees and never emits, and the colour would simply not appear.
 */
export const CATEGORY_HUE: Record<Category, { dot: string; stripe: string }> = {
  Document: { dot: "bg-terracotta", stripe: "border-s-terracotta" },
  Video: { dot: "bg-sapphire", stripe: "border-s-sapphire" },
  Audio: { dot: "bg-forest", stripe: "border-s-forest" },
  Image: { dot: "bg-peach", stripe: "border-s-peach" },
  Ebook: { dot: "bg-sky", stripe: "border-s-sky" },
  Vector: { dot: "bg-pink", stripe: "border-s-pink" },
  Data: { dot: "bg-marigold", stripe: "border-s-marigold" },
  "3D": { dot: "bg-iris", stripe: "border-s-iris" },
  Archive: { dot: "bg-clay", stripe: "border-s-clay" },
  Other: { dot: "bg-slate", stripe: "border-s-slate" },
};

export function categoryOf(format: string): Category {
  const key = format.toLowerCase();
  return explicit.get(key) ?? byProvenance.get(key) ?? "Other";
}

/** Splits rows into categories in CATEGORY_ORDER, dropping categories nothing landed in. */
export function groupByCategory<T>(
  rows: T[],
  categoryFor: (row: T) => Category,
): { category: Category; rows: T[] }[] {
  const buckets = new Map<Category, T[]>();
  for (const row of rows) {
    const category = categoryFor(row);
    const bucket = buckets.get(category);
    if (bucket) {
      bucket.push(row);
    } else {
      buckets.set(category, [row]);
    }
  }

  return CATEGORY_ORDER.map((category) => ({ category, rows: buckets.get(category) ?? [] })).filter(
    (bucket) => bucket.rows.length > 0,
  );
}
