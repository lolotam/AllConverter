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
import { localeFromRequest, t as tr, type Locale, type MessageKey } from "../i18n";
import { userService } from "./user";

const NOTICES: Record<string, MessageKey> = {
  profile: "account.notice.profile",
  password: "account.notice.password",
  avatar: "account.notice.avatar",
  "avatar-removed": "account.notice.avatarRemoved",
  "checkout-success": "account.notice.checkout",
};

const avatarTypes = () =>
  Object.values(AVATAR_TYPES)
    .map((extension) => extension.slice(1).toUpperCase())
    .join(", ");

const ERRORS: Record<string, { key: MessageKey; params?: Record<string, string> }> = {
  email: { key: "account.error.email" },
  current: { key: "account.error.current" },
  short: { key: "account.error.short" },
  mismatch: { key: "account.error.mismatch" },
  type: { key: "account.error.type", params: { types: avatarTypes() } },
  size: {
    key: "account.error.size",
    params: { limit: String(MAX_AVATAR_BYTES / (1024 * 1024)) },
  },
  billing: { key: "account.error.billing" },
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString(LANGUAGE, TIMEZONE ? { timeZone: TIMEZONE } : {});

function Notices({
  locale,
  notice,
  error,
}: {
  locale: Locale;
  notice?: string | undefined;
  error?: string | undefined;
}) {
  const noticeMessage = notice ? NOTICES[notice] : undefined;
  const errorMessage = error ? ERRORS[error] : undefined;
  return (
    <>
      {noticeMessage ? (
        <p
          role="status"
          safe
          class="mb-4 rounded-lg border border-accent-500/40 bg-accent-500/10 p-3 text-sm"
        >
          {tr(locale, noticeMessage)}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          safe
          class="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm"
        >
          {tr(locale, errorMessage.key, errorMessage.params)}
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
    async ({ user, redirect, query, request, cookie: { lang } }) => {
      const userData = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);
      if (!userData) {
        return redirect(`${WEBROOT}/`, 302);
      }

      const locale = localeFromRequest(request, lang?.value);
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
        <BaseHtml webroot={WEBROOT} title={`${BRANDING} | My profile`} locale={locale}>
          <>
            <Header
              webroot={WEBROOT}
              locale={locale}
              branding={BRANDING}
              accountRegistration={ACCOUNT_REGISTRATION}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              hideHistory={HIDE_HISTORY}
              loggedIn
              {...headerAccount(user.id)}
            />
            <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
              <h1 class="mb-6 text-2xl font-black text-slate-900 dark:text-white">
                {tr(locale, "account.title")}
              </h1>
              <Notices
                locale={locale}
                notice={typeof notice === "string" ? notice : undefined}
                error={typeof error === "string" ? error : undefined}
              />

              <section class={`${card} mb-6`}>
                <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                  {picture ? (
                    <img
                      src={picture}
                      alt={tr(locale, "account.pictureAlt")}
                      width="96"
                      height="96"
                      class="size-24 rounded-2xl object-cover"
                    />
                  ) : (
                    <span class="flex size-24 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent-500 to-lime-400 text-2xl font-black text-neutral-950">
                      {initialsOf(userData.display_name, userData.email)}
                    </span>
                  )}

                  <div class="flex-1 text-center sm:text-start">
                    <p safe class="text-lg font-bold text-slate-900 dark:text-white">
                      {userData.display_name || userData.email}
                    </p>
                    <p safe class="text-sm text-slate-500 dark:text-neutral-400">
                      {userData.email}
                    </p>
                    <p class="mt-2 text-xs text-slate-500 dark:text-neutral-400">
                      <span safe class="font-bold text-lime-700 dark:text-accent-400">
                        {tier?.name ?? userData.tier ?? tr(locale, "account.tierFree")}
                      </span>
                      {userData.created_at
                        ? tr(locale, "account.memberSince", {
                            date: formatDate(userData.created_at),
                          })
                        : ""}
                    </p>

                    <form
                      method="post"
                      action={`${WEBROOT}/account/avatar`}
                      enctype="multipart/form-data"
                      class="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:items-end"
                    >
                      <label class="flex w-full flex-col gap-1 text-sm sm:w-auto">
                        <span class="font-medium">{tr(locale, "account.picture")}</span>
                        <input
                          type="file"
                          name="avatar"
                          accept={Object.keys(AVATAR_TYPES).join(",")}
                          required
                          class="text-sm file:me-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:font-semibold dark:file:bg-neutral-700 dark:file:text-white"
                        />
                      </label>
                      <button type="submit" class="btn-primary px-4 py-2 text-sm">
                        {tr(locale, "account.upload")}
                      </button>
                    </form>
                    {userData.avatar_path ? (
                      <form method="post" action={`${WEBROOT}/account/avatar/delete`} class="mt-2">
                        <button
                          type="submit"
                          class="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                        >
                          {tr(locale, "account.removePicture")}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </section>

              <section class={`${card} mb-6`}>
                <h2 class={heading}>{tr(locale, "account.details")}</h2>
                <form
                  method="post"
                  action={`${WEBROOT}/account/profile`}
                  class="flex flex-col gap-4"
                >
                  <label class="flex flex-col gap-1 text-sm">
                    {tr(locale, "account.displayName")}
                    <input
                      type="text"
                      name="displayName"
                      class={field}
                      maxlength="60"
                      placeholder={tr(locale, "account.displayNamePlaceholder")}
                      value={userData.display_name ?? ""}
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-sm">
                    {tr(locale, "auth.email")}
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
                      {tr(locale, "account.saveDetails")}
                    </button>
                  </div>
                </form>
              </section>

              <section id="password" class={`${card} mb-6`}>
                <h2 class={heading}>
                  {knowsPassword
                    ? tr(locale, "account.changePassword")
                    : tr(locale, "account.setPasswordHeading")}
                </h2>
                {!knowsPassword ? (
                  <p class="mb-4 text-sm text-slate-500 dark:text-neutral-400">
                    {tr(locale, "account.googlePasswordNote")}
                  </p>
                ) : null}
                <form
                  method="post"
                  action={`${WEBROOT}/account/password`}
                  class="flex flex-col gap-4"
                >
                  {knowsPassword ? (
                    <label class="flex flex-col gap-1 text-sm">
                      {tr(locale, "account.currentPassword")}
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
                    {tr(locale, "account.newPassword")}
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
                    {tr(locale, "account.repeatPassword")}
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
                      {knowsPassword
                        ? tr(locale, "account.changePassword")
                        : tr(locale, "account.setPassword")}
                    </button>
                  </div>
                </form>
              </section>

              <section id="plan" class={`${card} mb-6`}>
                <h2 class={heading}>{tr(locale, "account.plan")}</h2>
                <p safe class="mb-4 text-sm text-slate-600 dark:text-neutral-300">
                  {tier?.name ?? userData.tier}
                  {userData.subscription_status ? ` · ${userData.subscription_status}` : ""}
                </p>
                {PADDLE_PORTAL_ENABLED && userData.paddle_customer_id ? (
                  <a href={`${WEBROOT}/billing/portal`} class="btn-secondary px-5 py-2.5 text-sm">
                    {tr(locale, "account.manageBilling")}
                  </a>
                ) : PADDLE_ENABLED && userData.tier === "free" ? (
                  <a href={`${WEBROOT}/#pricing`} class="btn-primary px-5 py-2.5 text-sm">
                    {tr(locale, "account.upgrade")}
                  </a>
                ) : null}
              </section>

              {!HIDE_HISTORY ? (
                <section class={`${card} mb-6`}>
                  <div class="mb-4 flex items-center justify-between">
                    <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                      {tr(locale, "account.recentConversions")}
                    </h2>
                    <a
                      href={`${WEBROOT}/history`}
                      class="text-sm font-medium text-lime-700 hover:underline dark:text-accent-400"
                    >
                      {tr(locale, "account.viewAll")}
                    </a>
                  </div>
                  {recentJobs.length === 0 ? (
                    <p class="text-sm text-slate-500 dark:text-neutral-400">
                      {tr(locale, "account.emptyHistory")}
                    </p>
                  ) : (
                    <ul class="divide-y divide-slate-200 text-sm dark:divide-neutral-800">
                      {recentJobs.map((job) => (
                        <li class="flex items-center justify-between gap-4 py-2.5">
                          <div>
                            <p class="font-medium text-slate-900 dark:text-white">
                              {job.num_files === 1
                                ? tr(locale, "account.oneFile")
                                : tr(locale, "account.files", { count: job.num_files })}{" "}
                              ·{" "}
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
                            {tr(locale, "account.open")}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              <section class={card}>
                <h2 class={heading}>{tr(locale, "account.signOutTitle")}</h2>
                <p class="mb-4 text-sm text-slate-500 dark:text-neutral-400">
                  {tr(locale, "account.signOutNote")}
                </p>
                <form method="post" action={`${WEBROOT}/logoff`}>
                  <button
                    type="submit"
                    class="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                  >
                    {tr(locale, "menu.signOut")}
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
