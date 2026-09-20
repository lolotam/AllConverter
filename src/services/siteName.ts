// The name and tagline shown in the header, editable in the admin dashboard. Falls back
// to the BRANDING environment variable, which is what the app shipped with.
import { BRANDING } from "../helpers/env";
import { getSetting, setSetting } from "./settings";

const NAME_KEY = "site.name";
const TAGLINE_KEY = "site.tagline";

export const DEFAULT_TAGLINE = "Cloud Pro";

export function siteName(): string {
  return getSetting(NAME_KEY)?.trim() || BRANDING;
}

export function siteTagline(): string {
  const stored = getSetting(TAGLINE_KEY);
  return stored === null ? DEFAULT_TAGLINE : stored;
}

export function setSiteName(name: string): void {
  const trimmed = name.trim().slice(0, 40);
  setSetting(NAME_KEY, trimmed || null);
}

export function setSiteTagline(tagline: string): void {
  // An empty tagline is a choice, not a missing value, so it is stored as one
  setSetting(TAGLINE_KEY, tagline.trim().slice(0, 30));
}
