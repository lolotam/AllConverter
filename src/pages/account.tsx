import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import db, { getTierById } from "../db/db";
import { Jobs, User } from "../db/types";
import {
  ACCOUNT_REGISTRATION,
  ALLOW_UNAUTHENTICATED,
  BRANDING,
  HIDE_HISTORY,
  HTTP_ALLOWED,
  LANGUAGE,
  TIMEZONE,
  WEBROOT,
} from "../helpers/env";
import { headerAccount } from "../helpers/headerUser";
import {
  AVATAR_TYPES,
  MAX_AVATAR_BYTES,
  avatarContentType,
  avatarFilePath,
  avatarUrl,
  initialsOf,
  removeAvatar,
  saveAvatar,
} from "../services/avatar";
import { PADDLE_ENABLED, PADDLE_PORTAL_ENABLED } from "../services/paddle";
import { userService } from "./user";

const NOTICES: Record<string, string> = {
  profile: "Your details were saved.",
  password: "Your password was changed.",
  avatar: "Your profile picture was updated.",
  "avatar-removed": "Your profile picture was removed.",
  "checkout-success":
    "Payment received. Your plan updates within a few seconds; refresh if it still shows the old plan.",
};

const ERRORS: Record<string, string> = {
  email: "That email address is already used by another account.",
  current: "Your current password is not correct.",
  short: "Your new password must be at least 8 characters.",
  mismatch: "The two new passwords do not match.",
  type: `That file type cannot be used. Choose a ${Object.values(AVATAR_TYPES)
    .map((extension) => extension.slice(1).toUpperCase())
    .join(", ")} image.`,
  size: `That picture is too large. The limit is ${MAX_AVATAR_BYTES / (1024 * 1024)} MB.`,
  billing: "The billing portal is unavailable right now. Please try again later.",
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString(LANGUAGE, TIMEZONE ? { timeZone: TIMEZONE } : {});

function Notices({ notice, error }: { notice?: string | undefined; error?: string | undefined }) {
  return (
    <>
      {notice && NOTICES[notice] ? (
        <p
          role="status"
          safe
          class="mb-4 rounded-lg border border-accent-500/40 bg-accent-500/10 p-3 text-sm"
        >
          {NOTICES[notice]}
        </p>
      ) : null}
      {error && ERRORS[error] ? (
        <p
          role="alert"
          safe
          class="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm"
        >
          {ERRORS[error]}
        </p>
      ) : null}
    </>
  );
}

const field = `w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white`;
const card = `rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6`;
const heading = `mb-4 text-lg font-bold text-slate-900 dark:text-white`;

export const account = new Elysia()
  .use(userService)
  .get(
    "/account",
    async ({ user, redirect, query }) => {
      const userData = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);
      if (!userData) {
        return redirect(`${WEBROOT}/`, 302);
      }

      const tier = getTierById(userData.tier ?? "free");
      const picture = avatarUrl(WEBROOT, String(userData.id), userData.avatar_path);
      const recentJobs = db
        .query("SELECT * FROM jobs WHERE user_id = ? ORDER BY id DESC LIMIT 5")
        .as(Jobs)
        .all(user.id)
        .filter((job) => job.num_files > 0);
      // Google accounts were given a random password nobody was ever told
      const knowsPassword = userData.password_set === "1";

      const notice = query.checkout === "success" ? "checkout-success" : query.saved;
      const error = query.billing === "unavailable" ? "billing" : query.error;

      return (
        <BaseHtml webroot={WEBROOT} title={`${BRANDING} | My profile`}>
          <>
            <Header
              webroot={WEBROOT}
              branding={BRANDING}
              accountRegistration={ACCOUNT_REGISTRATION}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              hideHistory={HIDE_HISTORY}
              loggedIn
              {...headerAccount(user.id)}
            />
            <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
              <h1 class="mb-6 text-2xl font-black text-slate-900 dark:text-white">My profile</h1>
              <Notices
                notice={typeof notice === "string" ? notice : undefined}
                error={typeof error === "string" ? error : undefined}
              />

              <section class={`${card} mb-6`}>
                <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                  {picture ? (
                    <img
                      src={picture}
                      alt="Your profile picture"
                      width="96"
                      height="96"
                      class="size-24 rounded-2xl object-cover"
                    />
                  ) : (
                    <span class="flex size-24 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent-500 to-lime-400 text-2xl font-black text-neutral-950">
                      {initialsOf(userData.display_name, userData.email)}
                    </span>
                  )}

                  <div class="flex-1 text-center sm:text-left">
                    <p safe class="text-lg font-bold text-slate-900 dark:text-white">
                      {userData.display_name || userData.email}
                    </p>
                    <p safe class="text-sm text-slate-500 dark:text-neutral-400">
                      {userData.email}
                    </p>
                    <p class="mt-2 text-xs text-slate-500 dark:text-neutral-400">
                      <span safe class="font-bold text-lime-700 dark:text-accent-400">
                        {tier?.name ?? userData.tier ?? "Free"}
                      </span>
                      {userData.created_at
                        ? ` · member since ${formatDate(userData.created_at)}`
                        : ""}
                    </p>

                    <form
                      method="post"
                      action={`${WEBROOT}/account/avatar`}
                      enctype="multipart/form-data"
                      class="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:items-end"
                    >
                      <label class="flex w-full flex-col gap-1 text-sm sm:w-auto">
                        <span class="font-medium">Profile picture</span>
                        <input
                          type="file"
                          name="avatar"
                          accept={Object.keys(AVATAR_TYPES).join(",")}
                          required
                          class="text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:font-semibold dark:file:bg-neutral-700 dark:file:text-white"
                        />
                      </label>
                      <button type="submit" class="btn-primary px-4 py-2 text-sm">
                        Upload
                      </button>
                    </form>
                    {userData.avatar_path ? (
                      <form method="post" action={`${WEBROOT}/account/avatar/delete`} class="mt-2">
                        <button
                          type="submit"
                          class="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                        >
                          Remove picture
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </section>

              <section class={`${card} mb-6`}>
                <h2 class={heading}>Your details</h2>
                <form
                  method="post"
                  action={`${WEBROOT}/account/profile`}
                  class="flex flex-col gap-4"
                >
                  <label class="flex flex-col gap-1 text-sm">
                    Display name
                    <input
                      type="text"
                      name="displayName"
                      class={field}
                      maxlength="60"
                      placeholder="How should we call you?"
                      value={userData.display_name ?? ""}
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-sm">
                    Email
                    <input
                      type="email"
                      name="email"
                      class={field}
                      autocomplete="email"
                      value={userData.email}
                      required
                    />
                  </label>
                  <div>
                    <button type="submit" class="btn-primary px-5 py-2.5 text-sm">
                      Save details
                    </button>
                  </div>
                </form>
              </section>

              <section id="password" class={`${card} mb-6`}>
                <h2 class={heading}>{knowsPassword ? "Change password" : "Set a password"}</h2>
                {!knowsPassword ? (
                  <p class="mb-4 text-sm text-slate-500 dark:text-neutral-400">
                    You signed in with Google, so this account has no password yet. Setting one lets
                    you sign in with your email as well.
                  </p>
                ) : null}
                <form
                  method="post"
                  action={`${WEBROOT}/account/password`}
                  class="flex flex-col gap-4"
                >
                  {knowsPassword ? (
                    <label class="flex flex-col gap-1 text-sm">
                      Current password
                      <input
                        type="password"
                        name="currentPassword"
                        class={field}
                        autocomplete="current-password"
                        required
                      />
                    </label>
                  ) : null}
                  <label class="flex flex-col gap-1 text-sm">
                    New password
                    <input
                      type="password"
                      name="newPassword"
                      class={field}
                      autocomplete="new-password"
                      minlength="8"
                      required
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-sm">
                    Repeat new password
                    <input
                      type="password"
                      name="confirmPassword"
                      class={field}
                      autocomplete="new-password"
                      minlength="8"
                      required
                    />
                  </label>
                  <div>
                    <button type="submit" class="btn-primary px-5 py-2.5 text-sm">
                      {knowsPassword ? "Change password" : "Set password"}
                    </button>
                  </div>
                </form>
              </section>

              <section class={`${card} mb-6`}>
                <h2 class={heading}>Your plan</h2>
                <p safe class="mb-4 text-sm text-slate-600 dark:text-neutral-300">
                  {tier?.name ?? userData.tier}
                  {userData.subscription_status ? ` · ${userData.subscription_status}` : ""}
                </p>
                {PADDLE_PORTAL_ENABLED && userData.paddle_customer_id ? (
                  <a href={`${WEBROOT}/billing/portal`} class="btn-secondary px-5 py-2.5 text-sm">
                    Manage billing
                  </a>
                ) : PADDLE_ENABLED && userData.tier === "free" ? (
                  <a href={`${WEBROOT}/#pricing`} class="btn-primary px-5 py-2.5 text-sm">
                    Upgrade
                  </a>
                ) : null}
              </section>

              {!HIDE_HISTORY ? (
                <section class={`${card} mb-6`}>
                  <div class="mb-4 flex items-center justify-between">
                    <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                      Recent conversions
                    </h2>
                    <a
                      href={`${WEBROOT}/history`}
                      class="text-sm font-medium text-lime-700 hover:underline dark:text-accent-400"
                    >
                      View all
                    </a>
                  </div>
                  {recentJobs.length === 0 ? (
                    <p class="text-sm text-slate-500 dark:text-neutral-400">
                      You have not converted anything yet.
                    </p>
                  ) : (
                    <ul class="divide-y divide-slate-200 text-sm dark:divide-neutral-800">
                      {recentJobs.map((job) => (
                        <li class="flex items-center justify-between gap-4 py-2.5">
                          <div>
                            <p class="font-medium text-slate-900 dark:text-white">
                              {job.num_files} file{job.num_files === 1 ? "" : "s"} ·{" "}
                              <span safe class="text-slate-500 dark:text-neutral-400">
                                {job.status}
                              </span>
                            </p>
                            <p safe class="text-xs text-slate-500 dark:text-neutral-400">
                              {formatDate(job.date_created)}
                            </p>
                          </div>
                          <a
                            href={`${WEBROOT}/results/${job.id}`}
                            class="shrink-0 text-sm font-medium text-lime-700 hover:underline dark:text-accent-400"
                          >
                            Open
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              <section class={card}>
                <h2 class={heading}>Sign out</h2>
                <p class="mb-4 text-sm text-slate-500 dark:text-neutral-400">
                  Signs this browser out. Your files stay until they are deleted automatically.
                </p>
                <form method="post" action={`${WEBROOT}/logoff`}>
                  <button
                    type="submit"
                    class="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                  >
                    Sign out
                  </button>
                </form>
              </section>
            </main>
          </>
        </BaseHtml>
      );
    },
    { auth: true },
  )
  .post(
    "/account/profile",
    async ({ body, user, redirect }) => {
      const email = body.email?.trim().toLowerCase();
      if (email) {
        const clash = db.query("SELECT id FROM users WHERE email = ?").as(User).get(email);
        if (clash && String(clash.id) !== String(user.id)) {
          return redirect(`${WEBROOT}/account?error=email`, 302);
        }
        db.query("UPDATE users SET email = ? WHERE id = ?").run(email, user.id);
      }

      const displayName = body.displayName?.trim().slice(0, 60) ?? "";
      db.query("UPDATE users SET display_name = ? WHERE id = ?").run(displayName || null, user.id);

      return redirect(`${WEBROOT}/account?saved=profile`, 302);
    },
    {
      auth: true,
      body: t.Object({
        displayName: t.Optional(t.String()),
        email: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/account/password",
    async ({ body, user, redirect, cookie: { auth } }) => {
      const userData = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);
      if (!userData) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      // Someone who signed in with Google has never been told their password, so they
      // set the first one without proving the old one
      if (userData.password_set === "1") {
        const current = body.currentPassword ?? "";
        if (!(await Bun.password.verify(current, userData.password))) {
          return redirect(`${WEBROOT}/account?error=current#password`, 302);
        }
      }

      if (body.newPassword.length < 8) {
        return redirect(`${WEBROOT}/account?error=short#password`, 302);
      }
      if (body.newPassword !== body.confirmPassword) {
        return redirect(`${WEBROOT}/account?error=mismatch#password`, 302);
      }

      db.query("UPDATE users SET password = ?, password_set = '1' WHERE id = ?").run(
        await Bun.password.hash(body.newPassword),
        user.id,
      );

      // The session token does not embed the password, so it stays valid; refresh the
      // cookie's lifetime instead of signing the person out of the browser they used
      if (auth?.value) {
        auth.update({
          httpOnly: true,
          secure: !HTTP_ALLOWED,
          maxAge: 60 * 60 * 24 * 7,
        });
      }

      return redirect(`${WEBROOT}/account?saved=password`, 302);
    },
    {
      auth: true,
      body: t.Object({
        currentPassword: t.Optional(t.String()),
        newPassword: t.String(),
        confirmPassword: t.String(),
      }),
    },
  )
  .post(
    "/account/avatar",
    async ({ body, user, redirect }) => {
      const failure = await saveAvatar(String(user.id), body.avatar);
      if (failure) {
        return redirect(`${WEBROOT}/account?error=${failure}`, 302);
      }
      return redirect(`${WEBROOT}/account?saved=avatar`, 302);
    },
    {
      auth: true,
      body: t.Object({ avatar: t.File() }),
    },
  )
  .post(
    "/account/avatar/delete",
    async ({ user, redirect }) => {
      await removeAvatar(String(user.id));
      return redirect(`${WEBROOT}/account?saved=avatar-removed`, 302);
    },
    { auth: true },
  )
  .get(
    "/avatar/:userId",
    async ({ params, user, set }) => {
      // A profile picture is only ever shown to the person it belongs to
      if (String(user.id) !== params.userId) {
        set.status = 403;
        return { message: "Forbidden" };
      }

      const row = db.query("SELECT avatar_path FROM users WHERE id = ?").get(params.userId) as
        { avatar_path: string | null } | undefined;
      if (!row?.avatar_path) {
        set.status = 404;
        return { message: "No profile picture." };
      }

      const file = Bun.file(avatarFilePath(row.avatar_path));
      if (!(await file.exists())) {
        set.status = 404;
        return { message: "No profile picture." };
      }

      // Never let the browser guess a different type for an uploaded file
      set.headers["content-type"] = avatarContentType(row.avatar_path);
      set.headers["x-content-type-options"] = "nosniff";
      set.headers["cache-control"] = "private, max-age=300";
      return file;
    },
    { auth: true },
  );
