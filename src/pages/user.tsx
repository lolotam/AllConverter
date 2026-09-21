import { randomUUID, timingSafeEqual } from "node:crypto";
import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { AuthTabs, GoogleButton } from "../components/authTabs";
import { Header } from "../components/header";
import db from "../db/db";
import { User } from "../db/types";
import {
  ACCOUNT_REGISTRATION,
  SETUP_TOKEN,
  ALLOW_UNAUTHENTICATED,
  HIDE_HISTORY,
  HTTP_ALLOWED,
  WEBROOT,
  BRANDING,
} from "../helpers/env";
import { GOOGLE_ENABLED, authorizationUrl, exchangeCode, redirectUri } from "../services/google";
import { isRegisteredSession } from "../helpers/session";
import { localeFromRequest, t as tr } from "../i18n";
import { userService } from "../services/user";

export { userService } from "../services/user";

export let FIRST_RUN = db.query("SELECT * FROM users").get() === null || false;

/**
 * Whether this request may claim the very first (admin) account. With SETUP_TOKEN unset
 * the setup page is open, as it always was; with it set, only someone holding the token
 * can take an empty instance.
 */
export function setupAllowed(token: unknown, configured: string = SETUP_TOKEN): boolean {
  if (!configured) {
    return true;
  }
  const given = typeof token === "string" ? token : "";
  const expected = Buffer.from(configured);
  const provided = Buffer.from(given);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export const user = new Elysia()
  .use(userService)
  .get("/setup", ({ redirect, query, set, request, cookie: { lang } }) => {
    if (!FIRST_RUN) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    const locale = localeFromRequest(request, lang?.value);

    if (!setupAllowed(query.token)) {
      set.status = 403;
      return (
        <BaseHtml title="ConvertX | Setup" webroot={WEBROOT} locale={locale}>
          <main class="mx-auto w-full max-w-2xl flex-1 px-4">
            <h1 class="my-8 text-3xl">{tr(locale, "setup.lockedTitle")}</h1>
            <article class="article">
              <p>
                {tr(locale, "setup.lockedBody1")} <code class="mx-1">/setup?token=YOUR_TOKEN</code>{" "}
                {tr(locale, "setup.lockedBody2")} <code>SETUP_TOKEN</code>{" "}
                {tr(locale, "setup.lockedBody3")}
              </p>
            </article>
          </main>
        </BaseHtml>
      );
    }

    return (
      <BaseHtml title="ConvertX | Setup" webroot={WEBROOT} locale={locale}>
        <main
          class={`
            mx-auto w-full max-w-4xl flex-1 px-2
            sm:px-4
          `}
        >
          <h1 class="my-8 text-3xl">{tr(locale, "setup.welcome")}</h1>
          <article class="article p-0">
            <header class="w-full bg-neutral-800 p-4">{tr(locale, "setup.createAccount")}</header>
            <form method="post" action={`${WEBROOT}/register`} class="p-4">
              <fieldset class="mb-4 flex flex-col gap-4">
                <label class="flex flex-col gap-1">
                  {tr(locale, "auth.email")}
                  <input
                    type="email"
                    name="email"
                    class="field"
                    placeholder={tr(locale, "auth.email")}
                    autocomplete="email"
                    required
                  />
                </label>
                <label class="flex flex-col gap-1">
                  {tr(locale, "auth.password")}
                  <input
                    type="password"
                    name="password"
                    class="field"
                    placeholder={tr(locale, "auth.password")}
                    autocomplete="current-password"
                    required
                  />
                </label>
              </fieldset>
              {SETUP_TOKEN ? (
                <input type="hidden" name="setupToken" value={String(query.token ?? "")} />
              ) : null}
              <input type="submit" value={tr(locale, "auth.createSubmit")} class="btn-primary" />
            </form>
            <footer class="p-4">
              {tr(locale, "setup.reportIssues")}{" "}
              <a
                class={`
                  text-accent-500 underline
                  hover:text-accent-400
                `}
                href="https://github.com/C4illin/ConvertX"
              >
                GitHub
              </a>
              .
            </footer>
          </article>
        </main>
      </BaseHtml>
    );
  })
  .get("/register", ({ redirect, query, request, cookie: { lang } }) => {
    if (!ACCOUNT_REGISTRATION) {
      return redirect(`${WEBROOT}/login?reason=${query.reason ?? ""}`, 302);
    }

    const locale = localeFromRequest(request, lang?.value);

    return (
      <BaseHtml webroot={WEBROOT} title="ConvertX | Register" locale={locale}>
        <>
          <Header
            webroot={WEBROOT}
            locale={locale}
            branding={BRANDING}
            accountRegistration={ACCOUNT_REGISTRATION}
            allowUnauthenticated={ALLOW_UNAUTHENTICATED}
            hideHistory={HIDE_HISTORY}
          />
          <main
            class={`
              w-full flex-1 px-2
              sm:px-4
            `}
          >
            <article class="article">
              {query.reason === "free-used" && (
                <p
                  role="status"
                  class="mb-4 rounded-lg border border-accent-500/40 bg-accent-500/10 p-3 text-sm"
                >
                  {tr(locale, "auth.freeUsedRegister1")}{" "}
                  <a href={`${WEBROOT}/login?reason=free-used`} class="text-accent-500 underline">
                    {tr(locale, "auth.signInLink")}
                  </a>{" "}
                  {tr(locale, "auth.freeUsedRegister2")}
                </p>
              )}
              <AuthTabs
                webroot={WEBROOT}
                locale={locale}
                active="register"
                accountRegistration={ACCOUNT_REGISTRATION}
                reason={typeof query.reason === "string" ? query.reason : undefined}
              />
              {GOOGLE_ENABLED ? (
                <GoogleButton
                  webroot={WEBROOT}
                  locale={locale}
                  label={tr(locale, "auth.continueGoogle")}
                />
              ) : null}
              <form method="post" class="flex flex-col gap-4">
                <fieldset class="mb-4 flex flex-col gap-4">
                  <label class="flex flex-col gap-1">
                    {tr(locale, "auth.email")}
                    <input
                      type="email"
                      name="email"
                      class="field"
                      placeholder={tr(locale, "auth.email")}
                      autocomplete="email"
                      required
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    {tr(locale, "auth.password")}
                    <input
                      type="password"
                      name="password"
                      class="field"
                      placeholder={tr(locale, "auth.password")}
                      autocomplete="current-password"
                      required
                    />
                  </label>
                </fieldset>
                <p class="text-sm text-neutral-400">
                  {tr(locale, "auth.agreeTo")}{" "}
                  <a href={`${WEBROOT}/terms`} class="text-accent-500 underline">
                    {tr(locale, "auth.termsLink")}
                  </a>{" "}
                  {tr(locale, "auth.and")}{" "}
                  <a href={`${WEBROOT}/privacy`} class="text-accent-500 underline">
                    {tr(locale, "auth.privacyLink")}
                  </a>
                  .
                </p>
                <input
                  type="submit"
                  value={tr(locale, "auth.register")}
                  class="w-full btn-primary"
                />
              </form>
            </article>
          </main>
        </>
      </BaseHtml>
    );
  })
  .post(
    "/register",
    async ({ body, set, redirect, jwt, cookie: { auth } }) => {
      const { email, password } = body;
      if (!ACCOUNT_REGISTRATION && !FIRST_RUN) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      if (FIRST_RUN) {
        // The first account becomes the admin, so it is the one worth protecting
        if (!setupAllowed(body.setupToken)) {
          set.status = 403;
          return { message: "A valid setup token is required to create the first account." };
        }
        FIRST_RUN = false;
      }

      const existingUser = await db.query("SELECT * FROM users WHERE email = ?").get(email);
      if (existingUser) {
        set.status = 400;
        return {
          message: "Email already in use.",
        };
      }
      const savedPassword = await Bun.password.hash(password);

      db.query("INSERT INTO users (email, password) VALUES (?, ?)").run(email, savedPassword);

      const user = db.query("SELECT * FROM users WHERE email = ?").as(User).get(email);

      if (!user) {
        set.status = 500;
        return {
          message: "Failed to create user.",
        };
      }

      const accessToken = await jwt.sign({
        id: String(user.id),
      });

      if (!auth) {
        set.status = 500;
        return {
          message: "No auth cookie, perhaps your browser is blocking cookies.",
        };
      }

      // set cookie
      auth.set({
        value: accessToken,
        httpOnly: true,
        secure: !HTTP_ALLOWED,
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "strict",
      });

      return redirect(`${WEBROOT}/`, 302);
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
        setupToken: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/login",
    async ({ jwt, redirect, query, request, cookie: { auth, lang } }) => {
      if (FIRST_RUN) {
        return redirect(`${WEBROOT}/setup`, 302);
      }

      // Only bounce a real account away from the sign-in page. With
      // ALLOW_UNAUTHENTICATED every visitor already holds a valid guest token, so
      // testing the cookie alone sent everyone straight back to the home page and
      // made signing in impossible.
      if (auth?.value) {
        const session = await jwt.verify(auth.value);

        if (session && isRegisteredSession(session.id)) {
          return redirect(`${WEBROOT}/`, 302);
        }

        if (!session) {
          auth.remove();
        }
      }

      const locale = localeFromRequest(request, lang?.value);

      return (
        <BaseHtml webroot={WEBROOT} title="ConvertX | Login" locale={locale}>
          <>
            <Header
              webroot={WEBROOT}
              locale={locale}
              branding={BRANDING}
              accountRegistration={ACCOUNT_REGISTRATION}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              hideHistory={HIDE_HISTORY}
            />
            <main
              class={`
                w-full flex-1 px-2
                sm:px-4
              `}
            >
              <article class="article">
                {query.reason === "free-used" && (
                  <p
                    role="status"
                    class="mb-4 rounded-lg border border-accent-500/40 bg-accent-500/10 p-3 text-sm"
                  >
                    {tr(locale, "auth.freeUsedLogin1")}
                    {ACCOUNT_REGISTRATION ? (
                      <>
                        {tr(locale, "auth.freeUsedLoginOr")}{" "}
                        <a
                          href={`${WEBROOT}/register?reason=free-used`}
                          class="text-accent-500 underline"
                        >
                          {tr(locale, "auth.freeUsedLoginLink")}
                        </a>
                      </>
                    ) : (
                      ""
                    )}
                    .
                  </p>
                )}
                <AuthTabs
                  webroot={WEBROOT}
                  locale={locale}
                  active="login"
                  accountRegistration={ACCOUNT_REGISTRATION}
                  reason={typeof query.reason === "string" ? query.reason : undefined}
                />
                {query.error ? (
                  <p
                    role="alert"
                    class="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm"
                  >
                    {query.error === "closed"
                      ? tr(locale, "auth.errorClosed")
                      : query.error === "setup"
                        ? tr(locale, "auth.errorSetup")
                        : tr(locale, "auth.errorGoogle")}
                  </p>
                ) : null}
                {GOOGLE_ENABLED ? (
                  <GoogleButton
                    webroot={WEBROOT}
                    locale={locale}
                    label={tr(locale, "auth.googleLogin")}
                  />
                ) : null}
                <form method="post" class="flex flex-col gap-4">
                  <fieldset class="mb-4 flex flex-col gap-4">
                    <label class="flex flex-col gap-1">
                      {tr(locale, "auth.email")}
                      <input
                        type="email"
                        name="email"
                        class="field"
                        placeholder={tr(locale, "auth.email")}
                        autocomplete="email"
                        autofocus
                        required
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      {tr(locale, "auth.password")}
                      <input
                        type="password"
                        name="password"
                        class="field"
                        placeholder={tr(locale, "auth.password")}
                        autocomplete="current-password"
                        required
                      />
                    </label>
                  </fieldset>
                  <div class="flex flex-row gap-4">
                    {ACCOUNT_REGISTRATION ? (
                      <a
                        href={`${WEBROOT}/register`}
                        role="button"
                        class="w-full btn-secondary text-center"
                      >
                        {tr(locale, "auth.register")}
                      </a>
                    ) : null}
                    <input
                      type="submit"
                      value={tr(locale, "auth.login")}
                      class="w-full btn-primary"
                    />
                  </div>
                </form>
              </article>
            </main>
          </>
        </BaseHtml>
      );
    },
    { body: "signIn", cookie: "optionalSession" },
  )
  .post(
    "/login",
    async function handler({ body, set, redirect, jwt, cookie: { auth } }) {
      const existingUser = db.query("SELECT * FROM users WHERE email = ?").as(User).get(body.email);

      if (!existingUser) {
        set.status = 403;
        return {
          message: "Invalid credentials.",
        };
      }

      const validPassword = await Bun.password.verify(body.password, existingUser.password);

      if (!validPassword) {
        set.status = 403;
        return {
          message: "Invalid credentials.",
        };
      }

      const accessToken = await jwt.sign({
        id: String(existingUser.id),
      });

      if (!auth) {
        set.status = 500;
        return {
          message: "No auth cookie, perhaps your browser is blocking cookies.",
        };
      }

      // set cookie
      auth.set({
        value: accessToken,
        httpOnly: true,
        secure: !HTTP_ALLOWED,
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "strict",
      });

      return redirect(`${WEBROOT}/`, 302);
    },
    { body: "signIn" },
  )
  .get("/auth/google", ({ request, redirect, cookie }) => {
    if (!GOOGLE_ENABLED) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    // The state is echoed back by Google and compared with this cookie, so a callback
    // someone else triggered cannot sign this browser into their account
    const state = randomUUID();
    cookie.oauth_state?.set({
      value: state,
      httpOnly: true,
      secure: !HTTP_ALLOWED,
      maxAge: 10 * 60,
      sameSite: "lax",
      path: "/",
    });

    return redirect(authorizationUrl(redirectUri(request, WEBROOT), state), 302);
  })
  .get("/auth/google/callback", async ({ request, query, redirect, jwt, cookie }) => {
    if (!GOOGLE_ENABLED) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    const expectedState = cookie.oauth_state?.value;
    cookie.oauth_state?.remove();

    const code = typeof query.code === "string" ? query.code : "";
    if (!code || !expectedState || query.state !== expectedState) {
      return redirect(`${WEBROOT}/login?error=google`, 302);
    }

    const identity = await exchangeCode(code, redirectUri(request, WEBROOT));
    if (!identity) {
      return redirect(`${WEBROOT}/login?error=google`, 302);
    }

    let existingUser = db
      .query("SELECT * FROM users WHERE google_id = ? OR email = ?")
      .as(User)
      .get(identity.sub, identity.email);

    if (existingUser) {
      // Link the Google account the first time an email user signs in this way
      if (!existingUser.google_id) {
        db.query("UPDATE users SET google_id = ? WHERE id = ?").run(identity.sub, existingUser.id);
      }
    } else {
      if (!ACCOUNT_REGISTRATION && !FIRST_RUN) {
        return redirect(`${WEBROOT}/login?error=closed`, 302);
      }
      // Google cannot carry the setup token, so it must not create the admin account
      if (FIRST_RUN && SETUP_TOKEN) {
        return redirect(`${WEBROOT}/login?error=setup`, 302);
      }
      FIRST_RUN = false;

      // Google is the only way into this account: the password is random and never shown
      const unusablePassword = await Bun.password.hash(randomUUID());
      db.query("INSERT INTO users (email, password, google_id) VALUES (?, ?, ?)").run(
        identity.email,
        unusablePassword,
        identity.sub,
      );
      existingUser = db.query("SELECT * FROM users WHERE email = ?").as(User).get(identity.email);
    }

    if (!existingUser) {
      return redirect(`${WEBROOT}/login?error=google`, 302);
    }

    const accessToken = await jwt.sign({ id: String(existingUser.id) });
    cookie.auth?.set({
      value: accessToken,
      httpOnly: true,
      secure: !HTTP_ALLOWED,
      maxAge: 60 * 60 * 24 * 7,
      // Lax, not strict: the browser arrives here from accounts.google.com, and a strict
      // cookie would not be sent on the redirect that follows, showing the user signed out
      sameSite: "lax",
      path: "/",
    });

    return redirect(`${WEBROOT}/`, 302);
  })
  .get("/logoff", ({ redirect, cookie: { auth } }) => {
    if (auth?.value) {
      auth.remove();
    }

    return redirect(`${WEBROOT}/login`, 302);
  })
  .post("/logoff", ({ redirect, cookie: { auth } }) => {
    if (auth?.value) {
      auth.remove();
    }

    return redirect(`${WEBROOT}/login`, 302);
  });
