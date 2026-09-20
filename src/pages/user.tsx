import { randomUUID } from "node:crypto";
import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { AuthTabs, GoogleButton } from "../components/authTabs";
import { Header } from "../components/header";
import db, { getTierById } from "../db/db";
import { User } from "../db/types";
import {
  ACCOUNT_REGISTRATION,
  ALLOW_UNAUTHENTICATED,
  HIDE_HISTORY,
  HTTP_ALLOWED,
  WEBROOT,
  BRANDING,
} from "../helpers/env";
import { GOOGLE_ENABLED, authorizationUrl, exchangeCode, redirectUri } from "../services/google";
import { PADDLE_ENABLED, PADDLE_PORTAL_ENABLED } from "../services/paddle";
import { userService } from "../services/user";

export { userService } from "../services/user";

export let FIRST_RUN = db.query("SELECT * FROM users").get() === null || false;

export const user = new Elysia()
  .use(userService)
  .get("/setup", ({ redirect }) => {
    if (!FIRST_RUN) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    return (
      <BaseHtml title="ConvertX | Setup" webroot={WEBROOT}>
        <main
          class={`
            mx-auto w-full max-w-4xl flex-1 px-2
            sm:px-4
          `}
        >
          <h1 class="my-8 text-3xl">Welcome to ConvertX!</h1>
          <article class="article p-0">
            <header class="w-full bg-neutral-800 p-4">Create your account</header>
            <form method="post" action={`${WEBROOT}/register`} class="p-4">
              <fieldset class="mb-4 flex flex-col gap-4">
                <label class="flex flex-col gap-1">
                  Email
                  <input
                    type="email"
                    name="email"
                    class="rounded-sm bg-neutral-800 p-3"
                    placeholder="Email"
                    autocomplete="email"
                    required
                  />
                </label>
                <label class="flex flex-col gap-1">
                  Password
                  <input
                    type="password"
                    name="password"
                    class="rounded-sm bg-neutral-800 p-3"
                    placeholder="Password"
                    autocomplete="current-password"
                    required
                  />
                </label>
              </fieldset>
              <input type="submit" value="Create account" class="btn-primary" />
            </form>
            <footer class="p-4">
              Report any issues on{" "}
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
  .get("/register", ({ redirect, query }) => {
    if (!ACCOUNT_REGISTRATION) {
      return redirect(`${WEBROOT}/login?reason=${query.reason ?? ""}`, 302);
    }

    return (
      <BaseHtml webroot={WEBROOT} title="ConvertX | Register">
        <>
          <Header
            webroot={WEBROOT}
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
                  You've used your free conversion for today. Create a free account to keep
                  converting, or{" "}
                  <a href={`${WEBROOT}/login?reason=free-used`} class="text-accent-500 underline">
                    sign in
                  </a>{" "}
                  if you already have one.
                </p>
              )}
              <AuthTabs
                webroot={WEBROOT}
                active="register"
                accountRegistration={ACCOUNT_REGISTRATION}
                reason={typeof query.reason === "string" ? query.reason : undefined}
              />
              {GOOGLE_ENABLED ? (
                <GoogleButton webroot={WEBROOT} label="Continue with Google" />
              ) : null}
              <form method="post" class="flex flex-col gap-4">
                <fieldset class="mb-4 flex flex-col gap-4">
                  <label class="flex flex-col gap-1">
                    Email
                    <input
                      type="email"
                      name="email"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="Email"
                      autocomplete="email"
                      required
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    Password
                    <input
                      type="password"
                      name="password"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="Password"
                      autocomplete="current-password"
                      required
                    />
                  </label>
                </fieldset>
                <p class="text-sm text-neutral-400">
                  By creating an account you agree to the{" "}
                  <a href={`${WEBROOT}/terms`} class="text-accent-500 underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href={`${WEBROOT}/privacy`} class="text-accent-500 underline">
                    Privacy Policy
                  </a>
                  .
                </p>
                <input type="submit" value="Register" class="w-full btn-primary" />
              </form>
            </article>
          </main>
        </>
      </BaseHtml>
    );
  })
  .post(
    "/register",
    async ({ body: { email, password }, set, redirect, jwt, cookie: { auth } }) => {
      if (!ACCOUNT_REGISTRATION && !FIRST_RUN) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      if (FIRST_RUN) {
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
    { body: "signIn" },
  )
  .get(
    "/login",
    async ({ jwt, redirect, query, cookie: { auth } }) => {
      if (FIRST_RUN) {
        return redirect(`${WEBROOT}/setup`, 302);
      }

      // if already logged in, redirect to home
      if (auth?.value) {
        const user = await jwt.verify(auth.value);

        if (user) {
          return redirect(`${WEBROOT}/`, 302);
        }

        auth.remove();
      }

      return (
        <BaseHtml webroot={WEBROOT} title="ConvertX | Login">
          <>
            <Header
              webroot={WEBROOT}
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
                    You've used your free conversion for today. Sign in to keep converting
                    {ACCOUNT_REGISTRATION ? (
                      <>
                        , or{" "}
                        <a
                          href={`${WEBROOT}/register?reason=free-used`}
                          class="text-accent-500 underline"
                        >
                          create a free account
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
                      ? "Registration is closed, so that Google account cannot be used to create an account here."
                      : "Signing in with Google did not work. Please try again."}
                  </p>
                ) : null}
                {GOOGLE_ENABLED ? (
                  <GoogleButton webroot={WEBROOT} label="Sign in with Google" />
                ) : null}
                <form method="post" class="flex flex-col gap-4">
                  <fieldset class="mb-4 flex flex-col gap-4">
                    <label class="flex flex-col gap-1">
                      Email
                      <input
                        type="email"
                        name="email"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder="Email"
                        autocomplete="email"
                        autofocus
                        required
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      Password
                      <input
                        type="password"
                        name="password"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder="Password"
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
                        Register
                      </a>
                    ) : null}
                    <input type="submit" value="Login" class="w-full btn-primary" />
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
  })
  .get(
    "/account",
    async ({ user, redirect, query }) => {
      if (!user) {
        return redirect(`${WEBROOT}/`, 302);
      }

      const userData = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

      if (!userData) {
        return redirect(`${WEBROOT}/`, 302);
      }

      const tier = getTierById(userData.tier ?? "free");
      const notice =
        query.checkout === "success"
          ? "Payment received. Your plan updates within a few seconds; refresh if it still shows the old plan."
          : query.billing === "unavailable"
            ? "The billing portal is unavailable right now. Please try again later."
            : undefined;

      return (
        <BaseHtml webroot={WEBROOT} title="ConvertX | Account">
          <>
            <Header
              webroot={WEBROOT}
              branding={BRANDING}
              accountRegistration={ACCOUNT_REGISTRATION}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              hideHistory={HIDE_HISTORY}
              loggedIn
            />
            <main
              class={`
                w-full flex-1 px-2
                sm:px-4
              `}
            >
              <article class="article">
                <h2 class="mb-2 text-xl font-bold">Your plan</h2>
                {notice && (
                  <p role="status" class="mb-3 text-sm text-accent-400" safe>
                    {notice}
                  </p>
                )}
                <p class="mb-4" safe>
                  {tier?.name ?? userData.tier}
                  {userData.subscription_status ? ` · ${userData.subscription_status}` : ""}
                </p>
                {PADDLE_PORTAL_ENABLED && userData.paddle_customer_id ? (
                  <a href={`${WEBROOT}/billing/portal`} class="btn-secondary">
                    Manage billing
                  </a>
                ) : PADDLE_ENABLED && userData.tier === "free" ? (
                  <a href={`${WEBROOT}/#pricing`} class="btn-primary">
                    Upgrade
                  </a>
                ) : null}
              </article>
              <article class="article">
                <form method="post" class="flex flex-col gap-4">
                  <fieldset class="mb-4 flex flex-col gap-4">
                    <label class="flex flex-col gap-1">
                      Email
                      <input
                        type="email"
                        name="email"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder="Email"
                        autocomplete="email"
                        value={userData.email}
                        required
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      Password (leave blank for unchanged)
                      <input
                        type="password"
                        name="newPassword"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder="Password"
                        autocomplete="new-password"
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      Current Password
                      <input
                        type="password"
                        name="password"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder="Password"
                        autocomplete="current-password"
                        required
                      />
                    </label>
                  </fieldset>
                  <div role="group">
                    <input type="submit" value="Update" class="w-full btn-primary" />
                  </div>
                </form>
              </article>
            </main>
          </>
        </BaseHtml>
      );
    },
    {
      auth: true,
    },
  )
  .post(
    "/account",
    async function handler({ body, set, redirect, jwt, cookie: { auth } }) {
      if (!auth?.value) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      const user = await jwt.verify(auth.value);
      if (!user) {
        return redirect(`${WEBROOT}/login`, 302);
      }
      const existingUser = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

      if (!existingUser) {
        if (auth?.value) {
          auth.remove();
        }
        return redirect(`${WEBROOT}/login`, 302);
      }

      const validPassword = await Bun.password.verify(body.password, existingUser.password);

      if (!validPassword) {
        set.status = 403;
        return {
          message: "Invalid credentials.",
        };
      }

      const fields = [];
      const values = [];

      if (body.email) {
        const existingUser = await db
          .query("SELECT id FROM users WHERE email = ?")
          .as(User)
          .get(body.email);
        if (existingUser && existingUser.id.toString() !== user.id) {
          set.status = 409;
          return { message: "Email already in use." };
        }
        fields.push("email");
        values.push(body.email);
      }
      if (body.newPassword) {
        fields.push("password");
        values.push(await Bun.password.hash(body.newPassword));
      }

      if (fields.length > 0) {
        db.query(
          `UPDATE users SET ${fields.map((field) => `${field}=?`).join(", ")} WHERE id=?`,
        ).run(...values, user.id);
      }

      return redirect(`${WEBROOT}/`, 302);
    },
    {
      body: t.Object({
        email: t.MaybeEmpty(t.String()),
        newPassword: t.MaybeEmpty(t.String()),
        password: t.String(),
      }),
      cookie: "session",
    },
  );
