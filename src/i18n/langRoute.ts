import { Elysia } from "elysia";
import { WEBROOT } from "../helpers/env";
import { isLocale } from "./index";

// Only a path from our own pages is accepted as a redirect target. Returning just the
// path already keeps visitors on this site, but a link from anywhere else could still
// choose which page they land on, so a foreign referer is ignored entirely.
function returnPath(referer: string | null, request: Request): string {
  const fallback = WEBROOT || "/";
  if (!referer) {
    return fallback;
  }
  try {
    const target = new URL(referer);
    const host = request.headers.get("x-forwarded-host") ?? new URL(request.url).host;
    if (target.host !== host) {
      return fallback;
    }
    return target.pathname.startsWith(WEBROOT) ? target.pathname + target.search : fallback;
  } catch {
    return fallback;
  }
}

// Two links in the header (EN | ع) point here; setting the cookie and redirecting
// back reloads the page the visitor came from in the chosen language.
export const langRoute = new Elysia().get(
  "/lang/:locale",
  ({ params, request, redirect, cookie: { lang } }) => {
    if (isLocale(params.locale) && lang) {
      lang.set({
        value: params.locale,
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        path: "/",
      });
    }

    return redirect(returnPath(request.headers.get("referer"), request), 302);
  },
);
