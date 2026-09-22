# Sign in with Google — what you need to create

The code is written and stays **switched off** until the two secrets below are set. With
them unset, `/login` and `/register` simply show the email form as before.

## Variables

| Variable               | Required | Example                                          | Where it comes from                             |
| ---------------------- | -------- | ------------------------------------------------ | ----------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | yes      | `1234567890-abc….apps.googleusercontent.com`     | Google Cloud console                            |
| `GOOGLE_CLIENT_SECRET` | yes      | `GOCSPX-…`                                       | Google Cloud console — **secret**               |
| `GOOGLE_REDIRECT_URI`  | no       | `https://allconverter.tech/auth/google/callback` | defaults to this host + `/auth/google/callback` |

Paste both into **Dokploy → the ConvertX application → Environment**, never into a chat or
a commit. `.env` is gitignored, but the secret should live in Dokploy only.

## Steps in Google Cloud

1. <https://console.cloud.google.com/> → create a project (e.g. "ConvertX") or pick one.
2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: ConvertX · support email: yours · developer contact: yours
   - Scopes: `openid`, `email`, `profile` — nothing more; anything else triggers a review
   - While the app is in **Testing**, only the addresses you list can sign in. Click
     **Publish app** when you are ready for real users. With only those three scopes,
     publishing does not require Google's verification review.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorised JavaScript origins: `https://allconverter.tech`
   - Authorised redirect URIs: `https://allconverter.tech/auth/google/callback`
     (add `http://localhost:3000/auth/google/callback` too if you want it locally)
4. Copy the client ID and client secret into Dokploy, then redeploy.

The redirect URI must match **character for character**, including the scheme and the
absence of a trailing slash, or Google returns `redirect_uri_mismatch`.

## How the flow works here

1. `GET /auth/google` sets a random `oauth_state` cookie and redirects to Google.
2. Google sends the visitor back to `/auth/google/callback?code=…&state=…`.
3. The server rejects a missing or mismatched `state` (this is the CSRF defence), exchanges
   the code for tokens over TLS using the client secret, and reads the email from the
   returned `id_token`.
4. An existing account with that email is signed in. Otherwise an account is created, with
   `google_id` recorded and no usable password — Google is then the only way into it.
5. The normal session cookie is set, exactly as an email sign-in would.

Google only signs in addresses it has verified itself, so no confirmation mail is sent —
consistent with the email flow, which by your decision also sends none.

## One consequence worth knowing

If someone registers with email + password and later signs in with Google using the same
address, they land in the same account. That is the behaviour you want, but it means the
security of the account is the weaker of the two paths. Since the email path sends no
verification mail, an account created by password on an address someone else owns would be
taken over by the real owner through Google — which is the right outcome, but is worth
remembering before any "recover my account" feature is added.
