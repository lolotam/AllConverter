import { randomInt } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { uploadsDir } from "../helpers/paths";
import { assetUrl } from "../helpers/assetUrl";
import { JWTPayloadSpec } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import { headerAccount } from "../helpers/headerUser";
import { isRegisteredSession } from "../helpers/session";
import { onlyAvailable } from "../converters/availability";
import { categoryOf, groupByCategory } from "../converters/categories";
import { formatLabel, visibleTargets } from "../services/features";
import { deletionIsAutomatic, retentionSentence } from "../services/retention";
import { getAllTargets } from "../converters/main";
import db, { getTiers, getUserById } from "../db/db";
import { User } from "../db/types";
import {
  ACCOUNT_REGISTRATION,
  UPLOAD_CHUNK_SIZE_MB,
  ALLOW_UNAUTHENTICATED,
  HIDE_HISTORY,
  HTTP_ALLOWED,
  UNAUTHENTICATED_USER_SHARING,
  WEBROOT,
  BRANDING,
} from "../helpers/env";
import { checkoutConfig, priceIdForTier } from "../services/paddle";
import { getConversionsToday, getQuotaContext, UNLIMITED_THRESHOLD } from "../services/quota";
import { localeFromRequest, t as tr, type Locale, type MessageKey } from "../i18n";
import { FIRST_RUN, userService } from "./user";

// Must match the real cleanup schedule; the privacy policy states the same retention.
// Read per request, because retention is per tier and editable in the admin dashboard.
// The retention sentence itself comes from the database and stays in its own language.
const fileDeletionPromise = (locale: Locale) =>
  deletionIsAutomatic()
    ? tr(locale, "home.filesDeletedAuto", { retention: retentionSentence() })
    : tr(locale, "home.filesDeletedManual");

const LIMIT_MESSAGE_KEYS: Record<string, MessageKey> = {
  daily: "home.limit.daily",
  batch: "home.limit.batch",
  upload: "home.limit.upload",
  converter: "home.limit.converter",
  nofiles: "home.limit.nofiles",
  kept: "home.limit.kept",
};

/**
 * The job the visitor already uploaded files for and never converted, if it is still
 * theirs and still has files. Anything else means we should start a fresh job.
 */
function pendingUploadJob(userId: string, cookieValue: unknown): number | null {
  const jobId = typeof cookieValue === "string" ? cookieValue : "";
  if (!jobId) {
    return null;
  }

  // Job ids arrive as cookie strings while the column is an integer, and SQLite will not
  // match the two, so ownership is compared here rather than in the query
  const job = db.query("SELECT id, user_id, num_files FROM jobs WHERE id = ?").get(jobId) as
    { id: number; user_id: number; num_files: number } | undefined;
  if (!job || String(job.user_id) !== String(userId) || job.num_files > 0) {
    return null;
  }

  try {
    return readdirSync(resolve(`${uploadsDir}${userId}/${job.id}`)).length > 0 ? job.id : null;
  } catch {
    // No upload folder yet: this job never received a file
    return null;
  }
}

export const root = new Elysia().use(userService).get(
  "/",
  async ({ jwt, redirect, query, request, server, cookie: { auth, jobId, lang } }) => {
    if (!ALLOW_UNAUTHENTICATED) {
      if (FIRST_RUN) {
        return redirect(`${WEBROOT}/setup`, 302);
      }

      if (!auth?.value) {
        return redirect(`${WEBROOT}/login`, 302);
      }
    }

    // validate jwt
    let user: ({ id: string } & JWTPayloadSpec) | false = false;
    // Guests share the home page with registered accounts: a signed-in user keeps
    // their session (and paid plan) instead of being swapped for a new guest id.
    const signedIn = auth?.value ? await jwt.verify(auth.value) : false;
    const isRegistered = signedIn !== false && isRegisteredSession(signedIn.id);

    if (ALLOW_UNAUTHENTICATED && isRegistered) {
      user = signedIn;
    } else if (ALLOW_UNAUTHENTICATED) {
      // A visitor who already has a guest identity keeps it. Minting a new one on every
      // page load meant a guest's uploads and history were stranded under an id nothing
      // pointed at any more, so reloading the page silently lost their files.
      const existingGuest = signedIn !== false && signedIn.id ? String(signedIn.id) : "";
      const newUserId = UNAUTHENTICATED_USER_SHARING
        ? "0"
        : existingGuest ||
          String(randomInt(2 ** 24, Math.min(2 ** 48 + 2 ** 24 - 1, Number.MAX_SAFE_INTEGER)));
      const accessToken = await jwt.sign({
        id: newUserId,
      });

      user = { id: newUserId };
      if (!auth) {
        return {
          message: "No auth cookie, perhaps your browser is blocking cookies.",
        };
      }

      // set cookie
      auth.set({
        value: accessToken,
        httpOnly: true,
        secure: !HTTP_ALLOWED,
        maxAge: 24 * 60 * 60,
        sameSite: "strict",
      });
    } else if (auth?.value) {
      user = await jwt.verify(auth.value);

      if (
        user !== false &&
        user.id &&
        (Number.parseInt(user.id) < 2 ** 24 || !ALLOW_UNAUTHENTICATED)
      ) {
        // Make sure user exists in db
        const existingUser = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

        if (!existingUser) {
          if (auth?.value) {
            auth.remove();
          }
          return redirect(`${WEBROOT}/login`, 302);
        }
      }
    }

    if (!user) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    // A visitor sent back here after a refused conversion still has their uploads on the
    // server. Minting a new job would orphan them — the files would exist but nothing
    // could reach them — so a job that was never converted is picked up again.
    const pendingJob = pendingUploadJob(user.id, jobId?.value);
    if (!pendingJob) {
      db.query("INSERT INTO jobs (user_id, date_created) VALUES (?, ?)").run(
        user.id,
        new Date().toISOString(),
      );
    }

    const id =
      pendingJob ??
      (
        db.query("SELECT id FROM jobs WHERE user_id = ? ORDER BY id DESC").get(user.id) as {
          id: number;
        }
      ).id;

    if (!jobId) {
      return { message: "Cookies should be enabled to use this app." };
    }

    jobId.set({
      value: id,
      httpOnly: true,
      secure: !HTTP_ALLOWED,
      maxAge: 24 * 60 * 60,
      sameSite: "strict",
    });

    const allTargets = visibleTargets(onlyAvailable(getAllTargets()));
    // What the site actually offers — a shortcut to anything else would only fail later.
    // One entry per conversion, not per spelling: a converter listing both jpg and jpeg
    // would otherwise put two cards on screen that do exactly the same thing.
    const offeredFormats = new Set(Object.values(allTargets).flat().map(formatLabel));
    // Before a file is uploaded there is nothing to resolve a converter against, so each
    // card carries whichever tool can produce that format at all. It is only a placeholder
    // that keeps the form well-formed — /convert works the real one out from the upload.
    const formatCards = groupByCategory(
      [...offeredFormats].sort().map((format) => ({
        format,
        converter:
          Object.entries(allTargets).find(([, targets]) =>
            targets.some((target) => formatLabel(target) === format),
          )?.[0] ?? "",
      })),
      (entry) => categoryOf(entry.format),
    );
    const popularFormats = ["PDF", "MP4", "MP3", "JPG", "PNG", "DOCX", "EPUB", "WEBP"].filter(
      (format) => offeredFormats.has(format.toLowerCase()),
    );
    // The shortcuts inside the picker, filtered the same way: a format an admin has
    // switched off must not keep a chip that only leads to a refused conversion
    const popularCards = [
      "pdf",
      "mp4",
      "mp3",
      "jpg",
      "png",
      "docx",
      "webp",
      "epub",
      "xlsx",
      "csv",
    ].filter((format) => offeredFormats.has(format));
    const dbTiers = getTiers();
    const currentUser = user && user.id ? getUserById(user.id) : null;
    const checkout = checkoutConfig(currentUser);
    const { tier, subject, dailyLimit, isGuest } = getQuotaContext(user.id, request, server);
    const conversionsLeft =
      dailyLimit >= UNLIMITED_THRESHOLD
        ? null
        : Math.max(0, dailyLimit - getConversionsToday(subject));
    const limitMessageKey = query.limit ? LIMIT_MESSAGE_KEYS[query.limit] : undefined;
    const locale = localeFromRequest(request, lang?.value);

    return (
      <BaseHtml
        webroot={WEBROOT}
        title={`${BRANDING} - Universal Cloud File Converter`}
        customFooter={true}
        locale={locale}
      >
        <>
          <Header
            webroot={WEBROOT}
            locale={locale}
            branding={BRANDING}
            accountRegistration={ACCOUNT_REGISTRATION}
            allowUnauthenticated={ALLOW_UNAUTHENTICATED}
            hideHistory={HIDE_HISTORY}
            loggedIn={Boolean(user)}
            {...headerAccount(user?.id)}
          />

          <main class="w-full flex-1">
            {limitMessageKey && (
              <div
                role="alert"
                class="border-b border-rule bg-marigold/25 px-4 py-3 text-center text-caption font-medium text-ink"
              >
                <span safe>{tr(locale, limitMessageKey)}</span>{" "}
                <a href="#pricing" class="font-semibold text-link underline">
                  {tr(locale, "home.seePlans")}
                </a>
              </div>
            )}
            {/* Top Announcement Banner */}
            <div class="w-full border-b border-rule bg-surface-2 px-4 py-3 text-center text-caption text-ink-body">
              <span class="inline-flex items-center gap-2">
                <strong class="font-semibold text-link">
                  {tr(locale, "home.announcementNew")}
                </strong>
                {tr(locale, "home.announcement")}
              </span>
            </div>

            {/* HERO SECTION */}
            <section class="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
              <div class="relative mx-auto max-w-[1200px] text-center">
                {/* Marigold is the reference's chip hue; it stays a chip and goes nowhere else */}
                <div class="chip mb-6 bg-marigold text-[#181d26]">
                  <span>{tr(locale, "home.badge")}</span>
                </div>

                {/* Display 900, no tracking — the reference is explicit that the display
                    face is drawn tight and must not be letter-spaced */}
                <h1 class="display-xl mb-6 text-ink">
                  {tr(locale, "home.heroTitle")} {tr(locale, "home.heroTitleHighlight")}
                </h1>

                <p
                  class="mx-auto mb-10 max-w-2xl text-body text-ink-body"
                  style="text-wrap: pretty"
                >
                  {tr(locale, "home.heroSubtitle")}
                </p>

                {/* CONVERTER CARD (CORE ENGINE) */}
                <div class="relative mx-auto max-w-4xl text-start">
                  {/* The reference frames the product in an onyx container on the cream
                      canvas. Here the converter itself is the product, so it takes that
                      slot: dark in both themes, which is why everything inside reads from
                      the frame-* tokens rather than the page ones. */}
                  <div class="rounded-card border border-frame-rule bg-frame p-5 text-frame-ink shadow-lg sm:p-8">
                    {/* Interactive Dropzone */}
                    <div
                      id="dropzone"
                      data-max-file-size-mb={String(tier.max_file_size_mb)}
                      data-batch-limit={String(tier.batch_limit)}
                      data-chunk-size-mb={String(UPLOAD_CHUNK_SIZE_MB)}
                      data-job-id={String(id)}
                      data-conversions-left={
                        conversionsLeft === null ? "" : String(conversionsLeft)
                      }
                      data-quota-message={
                        isGuest
                          ? tr(locale, "home.quotaSpentGuest")
                          : tr(locale, "home.quotaSpentUser")
                      }
                      data-quota-action-url={
                        isGuest ? `${WEBROOT}/register?reason=free-used` : `${WEBROOT}/#pricing`
                      }
                      data-quota-action-label={
                        isGuest
                          ? tr(locale, "home.quotaActionRegister")
                          : tr(locale, "home.quotaActionUpgrade")
                      }
                      class={`
                        group relative flex min-h-[220px] w-full flex-col items-center justify-center rounded-card
                        border border-dashed border-frame-rule bg-frame-surface p-6 text-center transition-all duration-300
                        hover:border-frame-ink/40
                        [&.dragover]:border-marigold [&.dragover]:bg-marigold/10
                      `}
                    >
                      {/* Upload Icon */}
                      <div class="mb-4 flex size-16 items-center justify-center rounded-card border border-frame-rule bg-frame-surface text-frame-ink transition-transform group-hover:scale-105">
                        <svg
                          class="size-8"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>

                      <div class="space-y-1">
                        <p class="text-subheading font-semibold text-frame-ink">
                          <span class="underline decoration-frame-ink-muted underline-offset-4">
                            {tr(locale, "home.chooseFiles")}
                          </span>{" "}
                          {tr(locale, "home.orDragDrop")}
                        </p>
                        <p class="text-caption text-frame-ink-muted">
                          {tr(locale, "home.fileTypes")} ·{" "}
                          {tr(locale, "home.upTo", { size: tier.max_file_size_mb })} ·{" "}
                          {tr(locale, "home.filesAtOnce", { count: tier.batch_limit })}
                          {conversionsLeft !== null &&
                            ` · ${tr(locale, "home.conversionsLeft", { count: conversionsLeft })}`}
                        </p>
                      </div>

                      {/* File source buttons mockup */}
                      <div class="mt-4 flex items-center gap-2">
                        <span class="chip border border-frame-rule bg-frame-surface text-frame-ink-muted">
                          {tr(locale, "home.fromDevice")}
                        </span>
                        <span class="chip border border-frame-rule bg-frame-surface text-frame-ink-muted">
                          {tr(locale, "home.cloudStorage")}
                        </span>
                      </div>

                      {/* Hidden File Input */}
                      <input
                        type="file"
                        name="file"
                        multiple
                        class="absolute inset-0 size-full cursor-pointer opacity-0"
                      />
                    </div>

                    {/* File List Table (Visible when files uploaded) */}
                    <div class="mt-4 scrollbar-thin max-h-[40vh] overflow-y-auto">
                      <table
                        id="file-list"
                        class={`
                          w-full table-auto rounded-card bg-frame-surface text-caption text-frame-ink
                          [&_td]:p-3.5
                          [&_td]:first:max-w-[28vw] [&_td]:first:truncate [&_td]:first:font-medium
                          [&_tr]:border-b [&_tr]:border-frame-rule
                        `}
                      />
                    </div>

                    {/* Quick Recent Formats Bar (Dynamic) */}
                    <div
                      id="quick-recent-pills"
                      class="mt-4 hidden border-t border-frame-rule pt-3"
                    >
                      <div class="flex items-center gap-2 flex-wrap text-xs">
                        <span class="flex items-center gap-1 font-semibold text-frame-ink-muted">
                          {tr(locale, "home.recent")}
                        </span>
                        <div class="recent-pills-list flex flex-wrap gap-1.5" />
                      </div>
                    </div>

                    {/* Popular formats quick tags */}
                    <div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-caption text-frame-ink-muted">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span class="font-semibold text-frame-ink-muted">
                          {tr(locale, "home.popular")}
                        </span>
                        {popularFormats.map((fmt) => (
                          <button
                            type="button"
                            onclick={`selectTarget('${fmt.toLowerCase()}', 'popular', '${fmt.toLowerCase()},popular')`}
                            class="cursor-pointer rounded-tag border border-frame-rule bg-frame-surface px-3 py-1 text-frame-ink transition-colors hover:bg-frame-ink/15"
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                      <span class="font-medium text-frame-ink-muted">
                        {tr(locale, "home.totalFormats")}
                      </span>
                    </div>

                    {/* Conversion Settings & Form */}
                    <form
                      method="post"
                      action={`${WEBROOT}/convert`}
                      class="relative mt-6 w-full space-y-4"
                    >
                      <input type="hidden" name="file_names" id="file_names" />

                      <div class="relative">
                        <div class="flex items-center rounded-button border border-frame-rule bg-frame-surface px-4 py-3 transition-colors focus-within:border-frame-ink/50">
                          <svg
                            class="me-2 size-5 text-frame-ink-muted"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                          <input
                            type="search"
                            name="convert_to_search"
                            placeholder={tr(locale, "home.searchPlaceholder")}
                            autocomplete="off"
                            class="w-full bg-transparent text-body-sm text-frame-ink placeholder-frame-ink-muted focus:outline-none"
                          />
                        </div>

                        <div class="select_container relative">
                          <article
                            class={`
                              convert_to_popup absolute z-20 m-0 mt-2 hidden h-[32vh] max-h-[50vh] w-full flex-col
                              overflow-x-hidden overflow-y-auto rounded-card border border-rule bg-surface p-2 text-ink-body shadow-lg
                            `}
                          >
                            {/* Recently Used Formats Group inside popup */}
                            <article
                              id="recent-formats-group"
                              class="convert_to_group mb-1 hidden w-full flex-col rounded-card border-b border-rule bg-sky/25 p-3"
                              data-converter={tr(locale, "home.recentFormatsGroup")}
                            >
                              <header class="mb-2 flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                {tr(locale, "home.recentlyUsed")}
                              </header>
                              <ul
                                id="recent-formats-list"
                                class="convert_to_target flex flex-row flex-wrap gap-1.5"
                              />
                            </article>

                            {/* Popular Formats Group inside popup */}
                            <article
                              class="convert_to_group mb-1 flex w-full flex-col rounded-card border-b border-rule bg-marigold/20 p-3"
                              data-converter={tr(locale, "home.popularFormatsGroup")}
                            >
                              <header class="mb-2 flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                {tr(locale, "home.popularFormatsGroup")}
                              </header>
                              <ul class="convert_to_target flex flex-row flex-wrap gap-1.5">
                                {popularCards.map((pop) => (
                                  <button
                                    tabindex={0}
                                    class="target rounded-tag border border-rule bg-surface px-3 py-1 text-xs font-semibold text-ink transition-colors hover:bg-cta hover:text-cta-ink"
                                    data-value={`${pop},popular`}
                                    data-target={pop}
                                    data-converter="Popular"
                                    type="button"
                                  >
                                    {pop.toUpperCase()}
                                  </button>
                                ))}
                              </ul>
                            </article>

                            {formatCards.map(({ category, rows }) => (
                              <article
                                class={`
                                  convert_to_group flex w-full flex-col border-b border-rule p-3 last:border-none
                                `}
                                data-converter={category}
                              >
                                <header class="mb-2 w-full text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                  {tr(locale, `formats.category.${category}`)}
                                </header>
                                <ul class={`convert_to_target flex flex-row flex-wrap gap-1.5`}>
                                  {rows.map((entry) => (
                                    <button
                                      tabindex={0}
                                      class={`
                                        target rounded-tag border border-rule bg-surface-2 px-3 py-1 text-xs font-medium text-ink-body
                                        transition-colors hover:bg-cta hover:text-cta-ink
                                      `}
                                      data-value={`${entry.format},${entry.converter}`}
                                      data-target={entry.format}
                                      data-converter={entry.converter}
                                      type="button"
                                    >
                                      {entry.format.toUpperCase()}
                                    </button>
                                  ))}
                                </ul>
                              </article>
                            ))}
                          </article>

                          {/* Hidden element for selected format */}
                          {/* Not "required": the control is hidden, so the browser can
                              neither show nor focus its validation message, and the form
                              would simply refuse to submit with nothing on screen. The
                              choice is checked in script.js, and again on the server. */}
                          <select
                            name="convert_to"
                            aria-label={tr(locale, "home.convertTo")}
                            hidden
                          >
                            <option selected disabled value="">
                              {tr(locale, "home.convertTo")}
                            </option>
                            {formatCards.map(({ category, rows }) => (
                              <optgroup label={tr(locale, `formats.category.${category}`)}>
                                {rows.map((entry) => (
                                  <option value={`${entry.format},${entry.converter}`} safe>
                                    {entry.format}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Resolution for documents rendered to images (PDF to JPG and similar).
                          script.js only shows this when it applies to the chosen formats. */}
                      <div id="quality-option" hidden class="mt-4">
                        <label class="flex flex-col gap-1 text-caption text-frame-ink-muted">
                          {tr(locale, "home.imageQuality")}
                          <select
                            name="quality"
                            class="rounded-button border border-frame-rule bg-frame-surface p-3 text-frame-ink"
                          >
                            <option value="150">{tr(locale, "home.qualityStandard")}</option>
                            <option value="300">{tr(locale, "home.qualityHigh")}</option>
                          </select>
                        </label>
                      </div>

                      {/* Big Call to Action Button */}
                      <input
                        class={`
                          btn-on-frame w-full text-center
                          disabled:cursor-not-allowed disabled:opacity-40
                        `}
                        type="submit"
                        value={tr(locale, "home.convertNow")}
                        disabled
                      />
                    </form>

                    {/* Trust Badges */}
                    <div class="mt-6 grid grid-cols-2 gap-4 border-t border-frame-rule pt-5 text-center text-caption text-frame-ink-muted sm:grid-cols-4">
                      <div class="flex items-center justify-center gap-1.5">
                        {tr(locale, "home.ssl")}
                      </div>
                      <div class="flex items-center justify-center gap-1.5">
                        {tr(locale, "home.autoDeleted")}
                      </div>
                      <div class="flex items-center justify-center gap-1.5">
                        {tr(locale, "home.highSpeed")}
                      </div>
                      <div class="flex items-center justify-center gap-1.5">
                        {tr(locale, "home.privateSecure")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* CATEGORY TOOLS GRID (Inspired by iLovePDF & Online-Convert) */}
            <section id="tools" class="border-t border-rule px-4 py-16 sm:px-6 lg:px-8">
              <div class="mx-auto max-w-7xl">
                <div class="text-center max-w-3xl mx-auto mb-14">
                  <h2 class="display-lg mb-4 text-ink">{tr(locale, "home.toolsTitle")}</h2>
                  <p class="text-body text-ink-body">{tr(locale, "home.toolsSubtitle")}</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Chapter 1: Document */}
                  <div class="chapter-card group bg-terracotta">
                    <div class="mb-5 flex size-12 items-center justify-center rounded-card bg-white/15 text-[#faf5e8]">
                      <svg
                        class="size-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 class="mb-5 text-heading-sm font-semibold text-[#faf5e8]">
                      {tr(locale, "home.docConverter")}
                    </h3>
                    <div class="chapter-panel">
                      <p class="text-body-sm text-ink-body">
                        {tr(locale, "home.docConverterDesc")}
                      </p>
                      <div class="mt-4 flex flex-wrap gap-1.5">
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "PDF", to: "Word" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "Word", to: "PDF" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "Excel", to: "PDF" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chapter 2: Video */}
                  <div class="chapter-card group bg-sapphire">
                    <div class="mb-5 flex size-12 items-center justify-center rounded-card bg-white/15 text-[#faf5e8]">
                      <svg
                        class="size-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <h3 class="mb-5 text-heading-sm font-semibold text-[#faf5e8]">
                      {tr(locale, "home.videoConverter")}
                    </h3>
                    <div class="chapter-panel">
                      <p class="text-body-sm text-ink-body">
                        {tr(locale, "home.videoConverterDesc")}
                      </p>
                      <div class="mt-4 flex flex-wrap gap-1.5">
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "MP4", to: "MP3" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "MOV", to: "MP4" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "MKV", to: "MP4" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chapter 3: Audio */}
                  <div class="chapter-card group bg-forest">
                    <div class="mb-5 flex size-12 items-center justify-center rounded-card bg-white/15 text-[#faf5e8]">
                      <svg
                        class="size-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
                    <h3 class="mb-5 text-heading-sm font-semibold text-[#faf5e8]">
                      {tr(locale, "home.audioConverter")}
                    </h3>
                    <div class="chapter-panel">
                      <p class="text-body-sm text-ink-body">
                        {tr(locale, "home.audioConverterDesc")}
                      </p>
                      <div class="mt-4 flex flex-wrap gap-1.5">
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "WAV", to: "MP3" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "FLAC", to: "MP3" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "M4A", to: "MP3" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chapter 4: Image */}
                  <div class="chapter-card group bg-peach">
                    <div class="mb-5 flex size-12 items-center justify-center rounded-card bg-black/10 text-[#181d26]">
                      <svg
                        class="size-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <h3 class="mb-5 text-heading-sm font-semibold text-[#181d26]">
                      {tr(locale, "home.imageConverter")}
                    </h3>
                    <div class="chapter-panel">
                      <p class="text-body-sm text-ink-body">
                        {tr(locale, "home.imageConverterDesc")}
                      </p>
                      <div class="mt-4 flex flex-wrap gap-1.5">
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "HEIC", to: "JPG" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "PNG", to: "JPG" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "WEBP", to: "PNG" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chapter 5: E-Book */}
                  <div class="chapter-card group bg-sky">
                    <div class="mb-5 flex size-12 items-center justify-center rounded-card bg-black/10 text-[#181d26]">
                      <svg
                        class="size-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    </div>
                    <h3 class="mb-5 text-heading-sm font-semibold text-[#181d26]">
                      {tr(locale, "home.ebookConverter")}
                    </h3>
                    <div class="chapter-panel">
                      <p class="text-body-sm text-ink-body">
                        {tr(locale, "home.ebookConverterDesc")}
                      </p>
                      <div class="mt-4 flex flex-wrap gap-1.5">
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "EPUB", to: "PDF" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "PDF", to: "EPUB" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "MOBI", to: "EPUB" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chapter 6: Data & Archives */}
                  <div class="chapter-card group bg-pink">
                    <div class="mb-5 flex size-12 items-center justify-center rounded-card bg-black/10 text-[#181d26]">
                      <svg
                        class="size-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                        />
                      </svg>
                    </div>
                    <h3 class="mb-5 text-heading-sm font-semibold text-[#181d26]">
                      {tr(locale, "home.dataArchives")}
                    </h3>
                    <div class="chapter-panel">
                      <p class="text-body-sm text-ink-body">
                        {tr(locale, "home.dataArchivesDesc")}
                      </p>
                      <div class="mt-4 flex flex-wrap gap-1.5">
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "JSON", to: "CSV" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "CSV", to: "JSON" })}
                        </span>
                        <span class="chip border border-rule bg-surface-2 text-ink-body">
                          {tr(locale, "home.tag", { from: "XML", to: "JSON" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* HOW IT WORKS SECTION */}
            <section id="how-it-works" class="border-t border-rule px-4 py-16 sm:px-6 lg:px-8">
              <div class="mx-auto max-w-7xl">
                <div class="text-center max-w-3xl mx-auto mb-16">
                  <h2 class="display-lg mb-4 text-ink">{tr(locale, "home.howTitle")}</h2>
                  <p class="text-body text-ink-body">{tr(locale, "home.howSubtitle")}</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center relative">
                  {/* Step 1 */}
                  <div class="flex flex-col items-center">
                    <div class="mb-4 flex size-14 items-center justify-center rounded-card border border-rule bg-surface text-subheading font-semibold text-ink-muted">
                      1
                    </div>
                    <h3 class="text-lg font-bold text-ink mb-2">{tr(locale, "home.step1Title")}</h3>
                    <p class="text-sm text-ink-muted max-w-xs">{tr(locale, "home.step1Desc")}</p>
                  </div>

                  {/* Step 2 */}
                  <div class="flex flex-col items-center">
                    <div class="mb-4 flex size-14 items-center justify-center rounded-card border border-rule bg-surface text-subheading font-semibold text-ink-muted">
                      2
                    </div>
                    <h3 class="text-lg font-bold text-ink mb-2">{tr(locale, "home.step2Title")}</h3>
                    <p class="text-sm text-ink-muted max-w-xs">{tr(locale, "home.step2Desc")}</p>
                  </div>

                  {/* Step 3 */}
                  <div class="flex flex-col items-center">
                    <div class="mb-4 flex size-14 items-center justify-center rounded-card bg-cta text-subheading font-semibold text-cta-ink">
                      3
                    </div>
                    <h3 class="text-lg font-bold text-ink mb-2">{tr(locale, "home.step3Title")}</h3>
                    <p class="text-sm text-ink-muted max-w-xs">{tr(locale, "home.step3Desc")}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* FREEMIUM PRICING SECTION (SaaS Monetization) */}
            <section id="pricing" class="border-t border-rule px-4 py-16 sm:px-6 lg:px-8">
              <div class="mx-auto max-w-7xl">
                <div class="text-center max-w-3xl mx-auto mb-16">
                  <div class="chip mb-4 bg-marigold text-[#181d26]">
                    <span>{tr(locale, "home.pricingBadge")}</span>
                  </div>
                  <h2 class="display-lg mb-4 text-ink">{tr(locale, "home.pricingTitle")}</h2>
                  <p class="text-body text-ink-body">{tr(locale, "home.pricingSubtitle")}</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
                  {dbTiers.map((t) => {
                    let featuresList: string[];
                    try {
                      featuresList = JSON.parse(t.features);
                    } catch {
                      featuresList = t.features.split("\n");
                    }

                    return (
                      <div
                        class={`rounded-3xl border p-8 flex flex-col justify-between transition-all ${
                          t.is_popular
                            ? "relative border-2 border-cta bg-surface shadow-lg"
                            : "border-rule bg-surface"
                        }`}
                      >
                        {t.is_popular ? (
                          <div class="absolute -top-4 left-1/2 -translate-x-1/2 rounded-tag bg-marigold px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[#181d26]">
                            <span safe>{t.badge || tr(locale, "home.mostPopular")}</span>
                          </div>
                        ) : null}

                        <div>
                          <h3 safe class="text-xl font-bold text-ink mb-2">
                            {t.name}
                          </h3>
                          <p safe class="text-sm text-ink-muted mb-6">
                            {t.description}
                          </p>
                          <div class="flex items-baseline gap-1 mb-6">
                            <span class="text-4xl font-extrabold text-ink">{t.price}</span>
                            <span class="text-ink-muted text-sm">{t.billing_period}</span>
                          </div>
                          <ul class="space-y-3.5 text-sm text-ink-body mb-8">
                            {featuresList.map((feat) => (
                              <li class="flex items-center gap-2.5">
                                <span class="text-ink font-bold">✓</span> <span safe>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {checkout && priceIdForTier(t.id) && currentUser?.tier === t.id ? (
                          <a
                            href={`${WEBROOT}/account`}
                            class="w-full text-center text-sm font-bold btn-secondary"
                          >
                            {tr(locale, "home.currentPlan")}
                          </a>
                        ) : checkout && priceIdForTier(t.id) ? (
                          <button
                            type="button"
                            data-paddle-price={priceIdForTier(t.id)}
                            class={`w-full text-center text-sm font-bold ${
                              t.is_popular ? "btn-primary" : "btn-secondary"
                            }`}
                          >
                            <span safe>{t.button_text}</span>
                          </button>
                        ) : (
                          <a
                            href={t.button_link}
                            class={`w-full text-center text-sm font-bold ${
                              t.is_popular ? "btn-primary" : "btn-secondary"
                            }`}
                          >
                            <span safe>{t.button_text}</span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* WHY CHOOSE US & SECURITY */}
            <section id="features" class="py-20 px-4 sm:px-6 lg:px-8 border-t border-rule">
              <div class="mx-auto max-w-7xl">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                  <div>
                    <h2 class="text-3xl sm:text-4xl font-black text-ink tracking-tight mb-6">
                      {tr(locale, "home.featuresTitle")}
                    </h2>
                    <p class="text-ink-body text-base mb-8 leading-relaxed">
                      {tr(locale, "home.featuresIntro")} {fileDeletionPromise(locale)}
                    </p>
                    <div class="space-y-4">
                      <div class="flex items-start gap-4">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-card bg-surface-2 text-ink">
                          🛡️
                        </div>
                        <div>
                          <h4 class="font-bold text-ink text-base">
                            {tr(locale, "home.autoDeleteTitle")}
                          </h4>
                          <p class="text-sm text-ink-muted">{fileDeletionPromise(locale)}</p>
                        </div>
                      </div>
                      <div class="flex items-start gap-4">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-card bg-surface-2 text-ink">
                          ⚡
                        </div>
                        <div>
                          <h4 class="font-bold text-ink text-base">
                            {tr(locale, "home.industryTitle")}
                          </h4>
                          <p class="text-sm text-ink-muted">{tr(locale, "home.industryDesc")}</p>
                        </div>
                      </div>
                      <div class="flex items-start gap-4">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-card bg-surface-2 text-ink">
                          📱
                        </div>
                        <div>
                          <h4 class="font-bold text-ink text-base">
                            {tr(locale, "home.zeroInstallTitle")}
                          </h4>
                          <p class="text-sm text-ink-muted">{tr(locale, "home.zeroInstallDesc")}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-feature border border-rule bg-surface p-8">
                    <h3 class="text-xl font-bold text-ink mb-4">
                      {tr(locale, "home.librariesTitle")}
                    </h3>
                    <div class="grid grid-cols-2 gap-3 text-sm text-ink-body">
                      <div class="flex items-center gap-2 rounded-button border border-rule bg-surface-2 p-2.5">
                        <span class="text-ink">●</span> {tr(locale, "home.lib.ffmpeg")}
                      </div>
                      <div class="flex items-center gap-2 rounded-button border border-rule bg-surface-2 p-2.5">
                        <span class="text-ink">●</span> {tr(locale, "home.lib.libreoffice")}
                      </div>
                      <div class="flex items-center gap-2 rounded-button border border-rule bg-surface-2 p-2.5">
                        <span class="text-ink">●</span> {tr(locale, "home.lib.imagemagick")}
                      </div>
                      <div class="flex items-center gap-2 rounded-button border border-rule bg-surface-2 p-2.5">
                        <span class="text-ink">●</span> {tr(locale, "home.lib.pandoc")}
                      </div>
                      <div class="flex items-center gap-2 rounded-button border border-rule bg-surface-2 p-2.5">
                        <span class="text-ink">●</span> {tr(locale, "home.lib.calibre")}
                      </div>
                      <div class="flex items-center gap-2 rounded-button border border-rule bg-surface-2 p-2.5">
                        <span class="text-ink">●</span> {tr(locale, "home.lib.inkscape")}
                      </div>
                      <div class="flex items-center gap-2 rounded-button border border-rule bg-surface-2 p-2.5">
                        <span class="text-ink">●</span> {tr(locale, "home.lib.potrace")}
                      </div>
                      <div class="flex items-center gap-2 rounded-button border border-rule bg-surface-2 p-2.5">
                        <span class="text-ink">●</span> {tr(locale, "home.lib.assimp")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>

          {/* SAAS FOOTER */}
          <footer class="w-full border-t border-rule px-4 py-12 sm:px-6 lg:px-8">
            <div class="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-5 gap-8 mb-10 text-sm">
              <div class="col-span-2">
                <div class="flex items-center gap-2.5 mb-3">
                  <div class="flex size-7 items-center justify-center rounded-lg bg-gradient-to-tr from-accent-500 to-lime-400 text-neutral-950 font-bold text-sm">
                    CX
                  </div>
                  <span class="text-lg font-bold text-ink tracking-tight" safe>
                    {BRANDING}
                  </span>
                </div>
                <p class="text-ink-muted text-xs max-w-sm leading-relaxed mb-4">
                  {tr(locale, "home.footerTagline")}
                </p>
                <p safe class="text-ink-muted text-xs">
                  {tr(locale, "home.copyright", {
                    year: new Date().getFullYear(),
                    brand: BRANDING,
                  })}
                </p>
              </div>

              <div>
                <h5 class="text-ink font-bold mb-3 text-xs uppercase tracking-wider">
                  {tr(locale, "home.footerConverters")}
                </h5>
                <ul class="space-y-2 text-xs text-ink-muted">
                  <li>
                    <a href="#tools" class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerPdf")}
                    </a>
                  </li>
                  <li>
                    <a href="#tools" class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerVideo")}
                    </a>
                  </li>
                  <li>
                    <a href="#tools" class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerAudio")}
                    </a>
                  </li>
                  <li>
                    <a href="#tools" class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerImage")}
                    </a>
                  </li>
                  <li>
                    <a href="#tools" class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerEbook")}
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h5 class="text-ink font-bold mb-3 text-xs uppercase tracking-wider">
                  {tr(locale, "home.footerProduct")}
                </h5>
                <ul class="space-y-2 text-xs text-ink-muted">
                  <li>
                    <a href="#pricing" class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerPricing")}
                    </a>
                  </li>
                  <li>
                    <a href="#how-it-works" class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerHow")}
                    </a>
                  </li>
                  <li>
                    <a href="#features" class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerSecurity")}
                    </a>
                  </li>
                  <li>
                    <a href={`${WEBROOT}/history`} class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerHistory")}
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h5 class="text-ink font-bold mb-3 text-xs uppercase tracking-wider">
                  {tr(locale, "home.footerAccount")}
                </h5>
                <ul class="space-y-2 text-xs text-ink-muted">
                  <li>
                    <a href={`${WEBROOT}/login`} class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerSignIn")}
                    </a>
                  </li>
                  <li>
                    <a href={`${WEBROOT}/register`} class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerCreate")}
                    </a>
                  </li>
                  <li>
                    <a href={`${WEBROOT}/account`} class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerSettings")}
                    </a>
                  </li>
                  <li>
                    <a href={`${WEBROOT}/terms`} class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerTerms")}
                    </a>
                  </li>
                  <li>
                    <a href={`${WEBROOT}/privacy`} class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerPrivacy")}
                    </a>
                  </li>
                  <li>
                    <a href={`${WEBROOT}/refunds`} class="transition-colors hover:text-ink">
                      {tr(locale, "home.footerRefunds")}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </footer>

          <script src={assetUrl(WEBROOT, "tus.min.js")} defer />
          <script src={assetUrl(WEBROOT, "script.js")} defer />
          {checkout && (
            <>
              <div
                id="paddle-checkout"
                hidden
                data-token={checkout.token}
                data-environment={checkout.environment}
                data-email={checkout.email}
                data-user-id={checkout.userId}
                data-sig={checkout.sig}
                data-success-url={`${WEBROOT}/account?checkout=success`}
              />
              <script src="https://cdn.paddle.com/paddle/v2/paddle.js" defer />
              <script src={assetUrl(WEBROOT, "billing.js")} defer />
            </>
          )}
        </>
      </BaseHtml>
    );
  },
  {
    cookie: t.Cookie({
      auth: t.Optional(t.String()),
      jobId: t.Optional(t.String()),
      lang: t.Optional(t.String()),
    }),
  },
);
