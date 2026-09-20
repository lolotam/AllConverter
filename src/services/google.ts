// Sign in with Google (OAuth 2.0 authorization code flow). Stays switched off until both
// credentials are configured; see docs/google-oauth-setup.md for what to create.
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from "../helpers/env";

export const GOOGLE_ENABLED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** The callback Google must be configured with, derived from the request when not set. */
export function redirectUri(request: Request, webroot: string): string {
  if (GOOGLE_REDIRECT_URI) {
    return GOOGLE_REDIRECT_URI;
  }
  const url = new URL(request.url);
  // Behind Traefik and Cloudflare the app itself speaks plain HTTP, so the scheme has to
  // come from the proxy or Google would be handed an http:// callback for an https:// site
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const protocol = forwardedProto ? `${forwardedProto}:` : url.protocol;
  const host = forwardedHost ?? url.host;
  return `${protocol}//${host}${webroot}/auth/google/callback`;
}

export function authorizationUrl(callback: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: callback,
    response_type: "code",
    scope: "openid email profile",
    state,
    // Ask for an account choice rather than silently reusing the last one
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleIdentity = { sub: string; email: string };

/** Reads the claims out of an id_token. Safe without a signature check only because the
 * token came straight from Google's token endpoint over TLS, authenticated with our
 * client secret — it was never in the browser's hands. */
function claimsOf(idToken: string): GoogleIdentity | null {
  const payload = idToken.split(".")[1];
  if (!payload) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      aud?: string;
    };
    // An id_token minted for a different client must never sign anyone in here
    if (claims.aud !== GOOGLE_CLIENT_ID) {
      return null;
    }
    if (!claims.sub || !claims.email) {
      return null;
    }
    if (claims.email_verified === false || claims.email_verified === "false") {
      return null;
    }
    return { sub: claims.sub, email: claims.email.toLowerCase() };
  } catch {
    return null;
  }
}

/** Exchanges the one-time code for the signed-in identity, or null if Google refuses. */
export async function exchangeCode(code: string, callback: string): Promise<GoogleIdentity | null> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: callback,
      grant_type: "authorization_code",
    }),
  }).catch(() => null);

  if (!response?.ok) {
    console.error("Google token exchange failed:", response?.status, await response?.text());
    return null;
  }

  const tokens = (await response.json().catch(() => null)) as { id_token?: string } | null;
  return tokens?.id_token ? claimsOf(tokens.id_token) : null;
}
