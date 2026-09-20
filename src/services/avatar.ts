// Profile pictures. One file per user, stored outside the served public directory and
// handed out only to the person it belongs to.
import { mkdirSync, statSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import db from "../db/db";
import { avatarsDir } from "../helpers/paths";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// Raster formats only: an SVG can carry script, and this file is served back to the
// browser from our own origin
export const AVATAR_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type AvatarError = "type" | "size";

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  signature.every((byte, index) => bytes[index] === byte);

const ascii = (bytes: Uint8Array, start: number, text: string) =>
  [...text].every((character, index) => bytes[start + index] === character.charCodeAt(0));

/**
 * Checks the file really is the kind of image it claims to be. The browser sends the type
 * and the name, so both can say "png" over an SVG full of script; only the bytes cannot.
 */
function looksLike(type: string, bytes: Uint8Array): boolean {
  switch (type) {
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return ascii(bytes, 0, "GIF8");
    case "image/webp":
      return ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP");
    default:
      return false;
  }
}

/**
 * Saves the upload as this user's profile picture and records it, replacing whatever
 * was there. Returns the error to show instead if the file is not usable.
 */
export async function saveAvatar(userId: string, file: File): Promise<AvatarError | null> {
  const extension = AVATAR_TYPES[file.type];
  if (!extension) {
    return "type";
  }
  if (file.size === 0 || file.size > MAX_AVATAR_BYTES) {
    return "size";
  }

  const header = new Uint8Array((await file.arrayBuffer()).slice(0, 12));
  if (!looksLike(file.type, header)) {
    return "type";
  }

  mkdirSync(avatarsDir, { recursive: true });
  const fileName = `${userId}${extension}`;
  await Bun.write(join(avatarsDir, fileName), file);

  // The extension can change between uploads, so the old file would otherwise linger
  const previous = currentAvatar(userId);
  if (previous && previous !== fileName) {
    await unlink(join(avatarsDir, previous)).catch(() => {});
  }

  db.query("UPDATE users SET avatar_path = ? WHERE id = ?").run(fileName, userId);
  return null;
}

/** Forgets and deletes this user's profile picture. */
export async function removeAvatar(userId: string): Promise<void> {
  const fileName = currentAvatar(userId);
  if (fileName) {
    await unlink(join(avatarsDir, fileName)).catch(() => {});
  }
  db.query("UPDATE users SET avatar_path = NULL WHERE id = ?").run(userId);
}

function currentAvatar(userId: string): string | null {
  const row = db.query("SELECT avatar_path FROM users WHERE id = ?").get(userId) as
    { avatar_path: string | null } | undefined;
  return row?.avatar_path ?? null;
}

export function avatarFilePath(fileName: string): string {
  return join(avatarsDir, fileName);
}

export function avatarContentType(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  const match = Object.entries(AVATAR_TYPES).find(([, ext]) => ext === extension);
  return match?.[0] ?? "application/octet-stream";
}

/**
 * The link to a user's picture, or null when they have none. The version keeps a newly
 * uploaded picture from being hidden behind the old one in the browser's cache.
 */
export function avatarUrl(webroot: string, userId: string, fileName: string | null): string | null {
  if (!fileName) {
    return null;
  }
  let version = "0";
  try {
    version = String(Math.floor(statSync(join(avatarsDir, fileName)).mtimeMs));
  } catch {
    // The row survives a file that was removed by hand; the link still resolves to 404
  }
  return `${webroot}/avatar/${userId}?v=${version}`;
}

/** Two letters for the placeholder shown until someone uploads a picture. */
export function initialsOf(displayName: string | null, email: string): string {
  const name = displayName?.trim();
  // Without a name, use what comes before the @: the domain says nothing about a person
  const source = name || email.split("@")[0] || email;
  const parts = source.split(name ? /\s+/ : /[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : source.slice(0, 2);
  return letters.toUpperCase();
}
