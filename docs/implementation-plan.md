# Implementation plan

Status key: **TODO** · **IN PROGRESS** · **DONE** · **BLOCKED (waiting on you)**

The order below is deliberate: each phase removes a risk that makes the next phase
pointless. There is no value in configuring payments (phase 3) while the pricing table
promises features that do not exist (phase 2), and no value in either while a stranger
can claim the admin account (phase 0).

---

## Phase 0 — Close the open admin slot · BLOCKED (waiting on you)

`https://convertx.walidmohamed.com/setup` currently renders "Create your account".
`FIRST_RUN` in `src/pages/user.tsx` is true while the `users` table is empty, so **the
first person to submit that form becomes the first account on the production instance**.
Verified on 2026-09-20: the page returns HTTP 200 with the form, not a redirect.

**You:** open `/setup` and register with a password that has never been used anywhere
else. The password pasted into a chat earlier is exposed and must not be reused.

**Optional hardening (say the word):** require `SETUP_TOKEN` from the environment before
`/setup` will accept a registration, so the window is closed even while the table is empty.

---

## Phase 1 — The three reported bugs · IN PROGRESS

### 1.1 Download managers ask for a username and password

Clicking **Tar Archive** makes Internet Download Manager pop up an authentication dialog.

Diagnosed 2026-09-20 — see [download-auth.md](download-auth.md) for the evidence. Short
version: there is **no** Basic Auth on nginx, Traefik or Dokploy (the response carries no
`WWW-Authenticate` header and `/setup` is reachable without credentials). The cause is
that the session cookie is `httpOnly`, IDM issues its own request without it, receives a
plain `401`, and shows its own credential dialog because it cannot tell one 401 from another.

**Fix:** short-lived signed links. `/download/...` and `/archive/...` accept a `token`
query parameter carrying an HMAC over user + job + filename + expiry. Cookie auth keeps
working; the token is simply another accepted proof, so curl, wget and any download
manager succeed. Tokens are minted when the results page is rendered and expire after
`DOWNLOAD_TOKEN_TTL_MINUTES` (default 60).

### 1.2 The page after the free conversion only offers "create account"

A visitor who uses their free conversion is sent to `/register?reason=free-used`. A login
link exists but only as a word inside a sentence, so the page reads as sign-up only.

**Fix:** a proper two-tab header — **Sign in** | **Create account** — on both `/login` and
`/register`, with the reason notice above it, plus **Continue with Google**.

Email sign-in stays exactly as it is today: email + password, **no confirmation code, no
verification email**. Submitting the form signs you in immediately. This is a deliberate
choice for conversion rate; the trade-off is that an address is never proven, so password
reset by email cannot be added later without a verification step.

### 1.3 The uploaded-files list sits above the dropzone

**Fix:** move the `#file-list` table below `#dropzone` in `src/pages/root.tsx`, so files
appear under the box that accepted them and the dropzone stays where the eye expects it.

### 1.4 No profile area · DONE

The header only had text links and there was nowhere to manage the account. Added an
avatar button in the header opening a menu (profile, history, change password, admin
dashboard for admins, sign out), and `/account` is now a profile dashboard: profile
picture upload, display name and email, change or set a password, plan, recent
conversions and a sign-out button.

Profile pictures live in `data/avatars/`, one file per user, inside the same volume as
everything else. They are raster only (PNG, JPEG, WebP, GIF), at most 2 MB, checked by
their actual bytes rather than by the name or the type the browser claims, served with
`X-Content-Type-Options: nosniff`, and readable only by the account they belong to.

Accounts created through Google have a random password nobody was ever told, so they may
set their first password without proving the old one; everyone else must enter the
current password to change it.

---

## Phase 2 — Make the pricing honest · PARTLY DONE

Full audit in [pricing-audit.md](pricing-audit.md). The **copy is fixed** (2026-09-20):
every plan now lists only what the app does, the Business plan sells file size, batch
size and queue priority instead of an API that does not exist, and a test fails if the
old claims ever come back. What remains is the code change:

1. **Per-tier retention.** The table sells "2-hour file retention" (free) against
   "24-hour file storage" (Pro), but `AUTO_DELETE_EVERY_N_HOURS` is one global number.
   Add `retention_hours` to the `tiers` table, and have the cleanup sweep in
   `src/index.tsx` delete each job according to the tier of the user who owns it, falling
   back to the global value for guests. Roughly half a day, and it turns a false claim into
   a genuine reason to pay.
2. ~~Rewrite the Business plan around what exists.~~ **Done.** Until per-tier retention
   lands, all three plans truthfully say files are kept for 24 hours, which means
   storage is not yet a reason to upgrade.

---

## Phase 3 — Turn on Paddle · BLOCKED (waiting on your keys)

The integration is written and unit-tested; every upgrade button is inert because the
keys are unset. Required in Dokploy (**paste secrets straight into Dokploy, never into a
chat**): `PADDLE_ENVIRONMENT`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`,
`PADDLE_PRICE_PRO`, `PADDLE_PRICE_BUSINESS`, optional `PADDLE_API_KEY` for the customer
portal, plus the `LEGAL_*` values the Terms / Privacy / Refund pages print (company name,
address, contact email, jurisdiction).

Sequence: sandbox keys → one test subscription end to end (checkout, webhook, tier change
visible in the app, cancellation) → live keys → repeat the test with a real card and refund it.

---

## Phase 4 — Auto-deploy · BLOCKED (waiting on you)

GitHub reports zero webhooks on `lolotam/ConvertX`, so no push has ever triggered a
deployment; every deploy so far has been triggered by hand. Reconnect the repository in
Dokploy (Git provider → GitHub) so it installs the webhook. Until then, assume a push is
**not** live until a deploy is run.

---

## Phase 5 — Operational safety · TODO

1. **Disk-space guard.** Nothing stops uploads filling the 10 GB volume, and a full volume
   stops SQLite writes too — that is a whole-site outage, not a failed upload. Check free
   space before accepting an upload (reject with a clear message under a threshold, e.g.
   1 GB), log a warning below 20%, and show it on the health check. ~1 hour.
2. **Backups.** Accounts and subscription state live in one SQLite file on one volume.
   Nightly `VACUUM INTO` a timestamped copy, keep 7, pull them off the server. Losing that
   file after people have paid is unrecoverable. ~2 hours.
3. **Abuse limits.** Guests are limited per IP per day, but nothing rate-limits requests
   themselves. A simple per-IP request cap on upload creation would stop the cheapest
   denial-of-wallet attack.

---

## Phase 6 — Arabic and RTL · TODO

The largest remaining item from the original goal and the one best done last, because
every string added before it is another string to translate.

1. Extract every user-visible string into a message catalogue (`en`, `ar`).
2. Pick the language from a cookie, falling back to `Accept-Language`.
3. Set `dir="rtl"` and `lang="ar"` on the document; audit the Tailwind classes for
   physical directions (`ml-`, `pl-`, `text-left`) and replace with logical ones
   (`ms-`, `ps-`, `text-start`).
4. Translate the legal pages last, and have a human read them — machine-translated terms
   of service are a liability, not an asset.

Estimate: 3–5 days, and it only shrinks if the string extraction happens before more UI
is added.
