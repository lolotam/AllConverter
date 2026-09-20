export const ACCOUNT_REGISTRATION =
  process.env.ACCOUNT_REGISTRATION?.toLowerCase() === "true" || false;

export const HTTP_ALLOWED = process.env.HTTP_ALLOWED?.toLowerCase() === "true" || false;

export const ALLOW_UNAUTHENTICATED =
  process.env.ALLOW_UNAUTHENTICATED?.toLowerCase() === "true" || false;

export const AUTO_DELETE_EVERY_N_HOURS = process.env.AUTO_DELETE_EVERY_N_HOURS
  ? Number(process.env.AUTO_DELETE_EVERY_N_HOURS)
  : 24;

export const HIDE_HISTORY = process.env.HIDE_HISTORY?.toLowerCase() === "true" || false;

export const BRANDING = process.env.BRANDING ?? "ConvertX";

export const WEBROOT = process.env.WEBROOT ?? "";

export const LANGUAGE = process.env.LANGUAGE?.toLowerCase() || "en";

export const MAX_CONVERT_PROCESS =
  process.env.MAX_CONVERT_PROCESS && Number(process.env.MAX_CONVERT_PROCESS) > 0
    ? Number(process.env.MAX_CONVERT_PROCESS)
    : 0;

export const UNAUTHENTICATED_USER_SHARING =
  process.env.UNAUTHENTICATED_USER_SHARING?.toLowerCase() === "true" || false;

export const TIMEZONE = process.env.TZ || undefined;

// Header carrying the real client IP when behind a proxy, e.g. "cf-connecting-ip"
// for Cloudflare. Leave unset when exposed directly: the header is client-spoofable.
export const CLIENT_IP_HEADER = process.env.CLIENT_IP_HEADER?.toLowerCase() || undefined;

// Paddle Billing. Checkout stays hidden until the token, webhook secret and at
// least one price are set. Prices map to tiers by name: PADDLE_PRICE_PRO=pri_...
export const PADDLE_ENVIRONMENT =
  process.env.PADDLE_ENVIRONMENT?.toLowerCase() === "production" ? "production" : "sandbox";

export const PADDLE_CLIENT_TOKEN = process.env.PADDLE_CLIENT_TOKEN || undefined;

export const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET || undefined;

// Optional: only needed for the "Manage billing" customer portal link.
export const PADDLE_API_KEY = process.env.PADDLE_API_KEY || undefined;

export const PADDLE_PRICES: Record<string, string> = Object.fromEntries(
  Object.entries(process.env)
    .filter(([key, value]) => key.startsWith("PADDLE_PRICE_") && value)
    .map(([key, value]) => [key.slice("PADDLE_PRICE_".length).toLowerCase(), value as string]),
);

// Legal pages (/terms, /privacy, /refunds). Unset values render as visible
// [placeholders] so a missing detail is noticed before launch.
export const LEGAL_ENTITY_NAME = process.env.LEGAL_ENTITY_NAME || undefined;

export const LEGAL_CONTACT_EMAIL = process.env.LEGAL_CONTACT_EMAIL || undefined;

export const LEGAL_GOVERNING_LAW = process.env.LEGAL_GOVERNING_LAW || undefined;

export const LEGAL_EFFECTIVE_DATE = process.env.LEGAL_EFFECTIVE_DATE || undefined;

export const REFUND_WINDOW_DAYS =
  process.env.REFUND_WINDOW_DAYS && Number(process.env.REFUND_WINDOW_DAYS) >= 0
    ? Number(process.env.REFUND_WINDOW_DAYS)
    : 14;

// Resumable uploads: how long an abandoned partial upload is kept before it is
// swept, and the chunk size the browser uses. Chunks must stay well under
// Cloudflare's 100 MB request limit and its 100 second request timeout.
export const TUS_UPLOAD_EXPIRY_HOURS = process.env.TUS_UPLOAD_EXPIRY_HOURS
  ? Number(process.env.TUS_UPLOAD_EXPIRY_HOURS)
  : 24;

// How many conversions a visitor without an account may run per day before the
// app asks them to sign up. Registered users follow their plan's daily limit.
export const GUEST_FREE_CONVERSIONS = process.env.GUEST_FREE_CONVERSIONS
  ? Number(process.env.GUEST_FREE_CONVERSIONS)
  : 1;

export const UPLOAD_CHUNK_SIZE_MB =
  process.env.UPLOAD_CHUNK_SIZE_MB && Number(process.env.UPLOAD_CHUNK_SIZE_MB) > 0
    ? Number(process.env.UPLOAD_CHUNK_SIZE_MB)
    : 16;

// How long a signed download link stays valid. The links let download managers and
// command line tools fetch a file without the session cookie, so they are deliberately
// short-lived: a shared link stops working soon after it leaves the page.
export const DOWNLOAD_TOKEN_TTL_MINUTES =
  process.env.DOWNLOAD_TOKEN_TTL_MINUTES && Number(process.env.DOWNLOAD_TOKEN_TTL_MINUTES) > 0
    ? Number(process.env.DOWNLOAD_TOKEN_TTL_MINUTES)
    : 60;

// Sign in with Google is off until both credentials are set.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
export const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";
