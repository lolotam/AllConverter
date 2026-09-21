// The site logo and favicon, uploaded from the admin dashboard instead of baked into the
// image. Stored next to the other data so they survive a redeploy.
import { existsSync, mkdirSync, statSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import { brandingDir } from "../helpers/paths";
import { type AvatarError, validateImage } from "./avatar";
import { getSetting, setSetting } from "./settings";

const LOGO_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// A favicon is drawn at 16 pixels, so only the formats every browser reads there
const FAVICON_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
};

const MAX_LOGO_BYTES = 1024 * 1024;

type Asset = "logo" | "favicon";

const settingKey = (asset: Asset) => `branding.${asset}`;

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

/** Saves an uploaded logo or favicon, replacing the previous one. */
export async function saveBrandingAsset(asset: Asset, file: File): Promise<AvatarError | null> {
  const allowed = asset === "logo" ? LOGO_TYPES : FAVICON_TYPES;
  const checked = await validateImage(file, allowed, MAX_LOGO_BYTES);
  if ("error" in checked) {
    return checked.error;
  }

  mkdirSync(brandingDir, { recursive: true });
  const fileName = `${asset}${checked.extension}`;
  await Bun.write(join(brandingDir, fileName), file);

  const previous = getSetting(settingKey(asset));
  if (previous && previous !== fileName) {
    await unlink(join(brandingDir, previous)).catch(() => {});
  }

  setSetting(settingKey(asset), fileName);
  return null;
}

/** Removes the uploaded asset, so the built-in one is used again. */
export async function removeBrandingAsset(asset: Asset): Promise<void> {
  const fileName = getSetting(settingKey(asset));
  if (fileName) {
    await unlink(join(brandingDir, fileName)).catch(() => {});
  }
  setSetting(settingKey(asset), null);
}

export function brandingFile(asset: Asset): { path: string; contentType: string } | null {
  const fileName = getSetting(settingKey(asset));
  if (!fileName) {
    return null;
  }
  const path = join(brandingDir, fileName);
  if (!existsSync(path)) {
    return null;
  }
  return {
    path,
    contentType: CONTENT_TYPES[extname(fileName).toLowerCase()] ?? "application/octet-stream",
  };
}

/**
 * The link to an uploaded asset, or null to fall back to what ships with the app. The
 * version changes with the file so a replacement is not hidden behind a cached copy.
 */
export function brandingUrl(webroot: string, asset: Asset): string | null {
  const file = brandingFile(asset);
  if (!file) {
    return null;
  }
  let version = "0";
  try {
    version = String(Math.floor(statSync(file.path).mtimeMs));
  } catch {
    // Missing file: the link 404s and the page keeps its built-in artwork
  }
  return `${webroot}/branding/${asset}?v=${version}`;
}
