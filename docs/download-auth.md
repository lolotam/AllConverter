# Why download managers asked for a password

## The report

Clicking **Tar Archive** (and single-file downloads) made Internet Download Manager show
its "authentication required — enter username and password" dialog. No credentials work,
because the dialog is asking for HTTP Basic Auth that nothing on the server implements.

## The diagnosis that was suggested, and why it is wrong

The suggestion was that Basic Auth is enabled site-wide in nginx (`auth_basic`) or as a
Traefik/Dokploy middleware (`traefik.http.middlewares.*.basicauth.users`), and that the
browser works only because it cached the credentials.

That is not what is happening here. Evidence, collected 2026-09-20 with no cookies at all:

```
$ curl -s -D - -o /dev/null https://allconverter.tech/archive/1
HTTP/1.1 401 Unauthorized
Content-Type: application/json;charset=utf-8
Content-Length: 42
Server: cloudflare
```

- There is **no `WWW-Authenticate` header**. A Basic Auth challenge must send one; without
  it, no browser would ever show a credential prompt.
- The body is the application's own JSON, `{"success":false,"message":"Unauthorized"}`.
- `GET /setup` returns **200** with a full HTML page to an anonymous `curl`. A site-wide
  proxy password would block that too.

So: no nginx `auth_basic`, no Traefik basicauth middleware, and nothing to remove from a
compose file. The 401 comes from ConvertX itself.

## The actual cause

The session lives in an `httpOnly` cookie. When IDM takes over a download it issues its
own request from outside the browser's cookie jar, so it arrives unauthenticated, and the
application answers `401`. IDM treats any 401 as "this server wants credentials" and opens
its dialog, whether or not a challenge header was sent.

The browser-only workarounds (hold **Alt** while clicking, or remove `tar` from IDM's file
types) do work, but they fix one machine, not the product. Every customer with a download
manager would hit the same wall.

## The fix: short-lived signed links

The download endpoints accept authentication **in the URL** as well as from the cookie:

```
GET /archive/12?token=<payload>.<signature>
GET /download/3/12/page-0.jpg?token=<payload>.<signature>
```

- `payload` is base64url JSON: `{ u: userId, j: jobId, f: filename or "*", e: expiry }`.
- `signature` is HMAC-SHA256 over the payload using `JWT_SECRET`, compared in constant time.
- The server checks the signature, the expiry, and that the job and filename in the token
  match the ones in the path — a token for one file cannot fetch another.
- Cookie authentication still works; the token is an additional accepted proof, not a
  replacement. Requests with neither are still refused (and browsers navigating to them
  are redirected to the login page rather than shown JSON).

Tokens are minted when the results page is rendered, so the links on the page are already
signed. They expire after `DOWNLOAD_TOKEN_TTL_MINUTES` (default 60); after that the page
is reloaded to get fresh ones.

### Why this is safe

- A token grants read access to exactly one file (or one job's archive) for a limited time.
  It carries no session and cannot be used to act as the user anywhere else.
- It is signed with a secret the client never sees, so it cannot be forged or extended.
- The expiry bounds the damage if a link is shared or ends up in a browser history.

### What it does not fix

Downloads still pass through Cloudflare, which caps a proxied response the same way it
caps an upload. Large archives remain subject to that; the resumable upload work solved
the inbound direction only.
