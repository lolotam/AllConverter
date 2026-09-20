import { randomInt } from "node:crypto";
import { assetUrl } from "../helpers/assetUrl";
import { JWTPayloadSpec } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import { headerAccount } from "../helpers/headerUser";
import { onlyAvailable } from "../converters/availability";
import { visibleTargets } from "../services/features";
import { describeRetention } from "../services/retention";
import { getAllTargets } from "../converters/main";
import db, { getTiers, getUserById } from "../db/db";
import { User } from "../db/types";
import {
  ACCOUNT_REGISTRATION,
  AUTO_DELETE_EVERY_N_HOURS,
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
import { FIRST_RUN, userService } from "./user";

// Must match the real cleanup schedule; the privacy policy states the same retention.
// Read per request, because retention is per tier and editable in the admin dashboard.
const fileDeletionPromise = () =>
  AUTO_DELETE_EVERY_N_HOURS > 0
    ? `Uploaded and converted files are permanently deleted from our servers after ${describeRetention()}.`
    : "You can permanently delete your uploaded and converted files at any time.";

const LIMIT_MESSAGES: Record<string, string> = {
  daily:
    "You've used all of today's conversions on your plan. Upgrade to Pro for unlimited conversions.",
  batch:
    "Your plan doesn't allow that many files in one conversion. Upgrade to Pro for bigger batches.",
  upload:
    "Those files haven't finished uploading yet. Wait for every upload to complete, then convert.",
};

export const root = new Elysia().use(userService).get(
  "/",
  async ({ jwt, redirect, query, request, server, cookie: { auth, jobId } }) => {
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
    const isRegistered =
      signedIn !== false &&
      Number.parseInt(signedIn.id) < 2 ** 24 &&
      getUserById(signedIn.id) !== null;

    if (ALLOW_UNAUTHENTICATED && isRegistered) {
      user = signedIn;
    } else if (ALLOW_UNAUTHENTICATED) {
      const newUserId = String(
        UNAUTHENTICATED_USER_SHARING
          ? 0
          : randomInt(2 ** 24, Math.min(2 ** 48 + 2 ** 24 - 1, Number.MAX_SAFE_INTEGER)),
      );
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

    // create a new job
    db.query("INSERT INTO jobs (user_id, date_created) VALUES (?, ?)").run(
      user.id,
      new Date().toISOString(),
    );

    const { id } = db
      .query("SELECT id FROM jobs WHERE user_id = ? ORDER BY id DESC")
      .get(user.id) as { id: number };

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
    // Offering a shortcut to a format no visible converter produces would only fail later
    const offeredFormats = new Set(
      Object.values(allTargets)
        .flat()
        .map((format) => String(format).toLowerCase()),
    );
    const popularFormats = ["PDF", "MP4", "MP3", "JPG", "PNG", "DOCX", "EPUB", "WEBP"].filter(
      (format) => offeredFormats.has(format.toLowerCase()),
    );
    const dbTiers = getTiers();
    const currentUser = user && user.id ? getUserById(user.id) : null;
    const checkout = checkoutConfig(currentUser);
    const { tier, subject, dailyLimit } = getQuotaContext(user.id, request, server);
    const conversionsLeft =
      dailyLimit >= UNLIMITED_THRESHOLD
        ? null
        : Math.max(0, dailyLimit - getConversionsToday(subject));
    const limitMessage =
      query.limit && Object.hasOwn(LIMIT_MESSAGES, query.limit)
        ? LIMIT_MESSAGES[query.limit]
        : undefined;

    return (
      <BaseHtml
        webroot={WEBROOT}
        title={`${BRANDING} - Universal Cloud File Converter`}
        customFooter={true}
      >
        <>
          <Header
            webroot={WEBROOT}
            branding={BRANDING}
            accountRegistration={ACCOUNT_REGISTRATION}
            allowUnauthenticated={ALLOW_UNAUTHENTICATED}
            hideHistory={HIDE_HISTORY}
            loggedIn={Boolean(user)}
            {...headerAccount(user?.id)}
          />

          <main class="w-full flex-1">
            {limitMessage && (
              <div
                role="alert"
                class="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm font-medium text-amber-300"
              >
                <span safe>{limitMessage}</span>{" "}
                <a href="#pricing" class="font-bold underline hover:text-amber-200">
                  See plans
                </a>
              </div>
            )}
            {/* Top Announcement Banner */}
            <div class="border-b border-slate-200 dark:border-neutral-800/60 bg-gradient-to-r from-accent-500/10 via-lime-500/5 to-emerald-500/10 py-2.5 px-4 text-center text-xs sm:text-sm text-slate-700 dark:text-neutral-300">
              <span class="inline-flex items-center gap-1.5 font-medium">
                <span class="flex size-2 rounded-full bg-accent-500 animate-pulse" />
                <strong class="text-lime-700 dark:text-accent-400">New:</strong> Fast cloud
                conversion for over 1,000+ formats with 100% privacy!
              </span>
            </div>

            {/* HERO SECTION */}
            <section class="relative overflow-hidden pt-12 pb-20 px-4 sm:px-6 lg:px-8">
              {/* Subtle background glow circles */}
              <div class="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-gradient-to-tr from-accent-500/15 to-emerald-500/10 blur-[130px]" />
              <div class="pointer-events-none absolute top-1/2 -left-40 size-[450px] rounded-full bg-blue-500/10 blur-[120px]" />

              <div class="relative mx-auto max-w-5xl text-center">
                {/* Badge */}
                <div class="inline-flex items-center gap-2 rounded-full border border-lime-500/30 bg-lime-500/10 px-3.5 py-1.5 text-xs font-semibold text-lime-700 dark:text-accent-400 backdrop-blur-md mb-6 shadow-sm">
                  <span>⚡ Unlimited & Free Online Converter</span>
                </div>

                {/* Main Heading */}
                <h1 class="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-tight">
                  Convert Any File to Any Format{" "}
                  <span class="bg-gradient-to-r from-accent-500 via-lime-500 to-emerald-500 bg-clip-text text-transparent">
                    in Seconds
                  </span>
                </h1>

                {/* Subtitle */}
                <p class="mx-auto max-w-2xl text-base sm:text-lg text-slate-600 dark:text-neutral-300 mb-10 leading-relaxed">
                  Transform audio, video, documents, images, and eBooks effortlessly with zero
                  quality loss. 100% private, cloud-powered, and free.
                </p>

                {/* CONVERTER CARD (CORE ENGINE) */}
                <div class="relative mx-auto max-w-4xl text-left">
                  {/* Glowing border card */}
                  <div class="rounded-3xl border border-slate-200 bg-white/95 p-5 sm:p-8 backdrop-blur-2xl shadow-xl dark:border-neutral-700/60 dark:bg-neutral-900/90 dark:shadow-2xl transition-all">
                    {/* Interactive Dropzone */}
                    <div
                      id="dropzone"
                      data-max-file-size-mb={String(tier.max_file_size_mb)}
                      data-batch-limit={String(tier.batch_limit)}
                      data-chunk-size-mb={String(UPLOAD_CHUNK_SIZE_MB)}
                      data-job-id={String(id)}
                      class={`
                        group relative flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl
                        border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center transition-all duration-300
                        dark:border-neutral-700 dark:bg-neutral-950/40
                        hover:border-accent-500 hover:bg-slate-100 dark:hover:bg-neutral-950/70 hover:shadow-xl hover:shadow-accent-500/5
                        [&.dragover]:border-accent-400 [&.dragover]:bg-accent-500/10 [&.dragover]:scale-[1.01]
                      `}
                    >
                      {/* Upload Icon */}
                      <div class="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent-500/20 to-lime-500/20 text-lime-600 dark:text-accent-400 border border-lime-500/30 group-hover:scale-110 transition-transform">
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
                        <p class="text-lg font-bold text-slate-900 dark:text-white">
                          <span class="text-lime-600 dark:text-accent-400 group-hover:underline">
                            Choose Files
                          </span>{" "}
                          or drag & drop them here
                        </p>
                        <p class="text-xs text-slate-500 dark:text-neutral-400">
                          Video, Audio, Document, Image, eBook & Archives · up to{" "}
                          {tier.max_file_size_mb} MB per file · {tier.batch_limit} files at once
                          {conversionsLeft !== null &&
                            ` · ${conversionsLeft} conversions left today`}
                        </p>
                      </div>

                      {/* File source buttons mockup */}
                      <div class="mt-4 flex items-center gap-2">
                        <span class="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 px-3 py-1 text-xs text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700">
                          📁 From Device
                        </span>
                        <span class="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 px-3 py-1 text-xs text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700">
                          ☁️ Cloud Storage
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
                          w-full table-auto rounded-xl bg-slate-100 text-slate-800 dark:bg-neutral-800/60 dark:text-neutral-200 text-sm
                          [&_td]:p-3.5
                          [&_td]:first:max-w-[28vw] [&_td]:first:truncate [&_td]:first:font-medium
                          [&_tr]:rounded-lg [&_tr]:border-b [&_tr]:border-slate-200 dark:[&_tr]:border-neutral-700/60
                        `}
                      />
                    </div>

                    {/* Quick Recent Formats Bar (Dynamic) */}
                    <div
                      id="quick-recent-pills"
                      class="hidden mt-4 pt-3 border-t border-slate-200 dark:border-neutral-800/80"
                    >
                      <div class="flex items-center gap-2 flex-wrap text-xs">
                        <span class="font-bold text-slate-600 dark:text-neutral-400 flex items-center gap-1">
                          <span>🕒</span> Recent:
                        </span>
                        <div class="recent-pills-list flex flex-wrap gap-1.5" />
                      </div>
                    </div>

                    {/* Popular formats quick tags */}
                    <div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-neutral-400">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span class="font-semibold text-slate-600 dark:text-neutral-400">
                          Popular:
                        </span>
                        {popularFormats.map((fmt) => (
                          <button
                            type="button"
                            onclick={`selectTarget('${fmt.toLowerCase()}', 'popular', '${fmt.toLowerCase()},popular')`}
                            class="rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-700/50 px-2 py-0.5 transition-colors cursor-pointer"
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                      <span class="text-lime-600 dark:text-accent-400 font-medium">
                        1,000+ total formats
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
                        <div class="flex items-center rounded-xl bg-slate-100 dark:bg-neutral-800/90 border border-slate-300 dark:border-neutral-700 px-4 py-3 focus-within:border-accent-500 transition-colors">
                          <svg
                            class="size-5 text-slate-400 dark:text-neutral-400 mr-2"
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
                            placeholder="Select target format (e.g. mp3, pdf, jpg, docx)..."
                            autocomplete="off"
                            class="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-400 focus:outline-none"
                          />
                        </div>

                        <div class="select_container relative">
                          <article
                            class={`
                              convert_to_popup absolute z-20 mt-2 m-0 hidden h-[32vh] max-h-[50vh] w-full flex-col
                              overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl p-2
                              dark:border-neutral-700/80 dark:bg-neutral-850 dark:text-neutral-100
                            `}
                          >
                            {/* Recently Used Formats Group inside popup */}
                            <article
                              id="recent-formats-group"
                              class="convert_to_group hidden w-full flex-col border-b border-slate-200 dark:border-neutral-700/60 p-3 bg-blue-500/5 dark:bg-blue-500/10 rounded-lg mb-1"
                              data-converter="🕒 Recent Formats"
                            >
                              <header class="mb-2 w-full text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                <span>🕒</span> Recently Used (المستخدمة مؤخراً)
                              </header>
                              <ul
                                id="recent-formats-list"
                                class="convert_to_target flex flex-row flex-wrap gap-1.5"
                              />
                            </article>

                            {/* Popular Formats Group inside popup */}
                            <article
                              class="convert_to_group flex w-full flex-col border-b border-slate-200 dark:border-neutral-700/60 p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-lg mb-1"
                              data-converter="🔥 Popular Formats"
                            >
                              <header class="mb-2 w-full text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                <span>🔥</span> Popular Formats (الأكثر شهرة)
                              </header>
                              <ul class="convert_to_target flex flex-row flex-wrap gap-1.5">
                                {[
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
                                ].map((pop) => (
                                  <button
                                    tabindex={0}
                                    class="target rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-accent-500 hover:text-neutral-950 transition-colors"
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

                            {Object.entries(allTargets).map(([converter, targets]) => (
                              <article
                                class={`
                                  convert_to_group flex w-full flex-col border-b border-slate-100 dark:border-neutral-700/60 p-3 last:border-none
                                `}
                                data-converter={converter}
                              >
                                <header
                                  class="mb-2 w-full text-xs font-bold uppercase tracking-wider text-lime-600 dark:text-accent-400"
                                  safe
                                >
                                  {converter}
                                </header>
                                <ul class={`convert_to_target flex flex-row flex-wrap gap-1.5`}>
                                  {targets.map((target) => (
                                    <button
                                      tabindex={0}
                                      class={`
                                        target rounded-lg bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 px-2.5 py-1 text-xs font-medium
                                        hover:bg-accent-500 hover:text-neutral-950 hover:border-accent-400 transition-colors
                                      `}
                                      data-value={`${target},${converter}`}
                                      data-target={target}
                                      data-converter={converter}
                                      type="button"
                                      safe
                                    >
                                      {target}
                                    </button>
                                  ))}
                                </ul>
                              </article>
                            ))}
                          </article>

                          {/* Hidden element for selected format */}
                          <select name="convert_to" aria-label="Convert to" required hidden>
                            <option selected disabled value="">
                              Convert to
                            </option>
                            {Object.entries(allTargets).map(([converter, targets]) => (
                              <optgroup label={converter}>
                                {targets.map((target) => (
                                  <option value={`${target},${converter}`} safe>
                                    {target}
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
                        <label class="flex flex-col gap-1 text-sm text-slate-600 dark:text-neutral-300">
                          Image quality
                          <select
                            name="quality"
                            class={`
                              rounded-xl border border-slate-200 bg-white p-3 text-slate-900
                              dark:border-neutral-700 dark:bg-neutral-800 dark:text-white
                            `}
                          >
                            <option value="150">Standard · 150 DPI (smaller files)</option>
                            <option value="300">High · 300 DPI (sharper, larger files)</option>
                          </select>
                        </label>
                      </div>

                      {/* Big Call to Action Button */}
                      <input
                        class={`
                          btn-primary w-full py-4 text-center text-base font-bold uppercase tracking-wider
                          disabled:opacity-40 disabled:cursor-not-allowed
                        `}
                        type="submit"
                        value="Convert Now ⚡"
                        disabled
                      />
                    </form>

                    {/* Trust Badges */}
                    <div class="mt-6 pt-5 border-t border-slate-200 dark:border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-500 dark:text-neutral-400 text-center">
                      <div class="flex items-center justify-center gap-1.5">
                        <span>🔒</span> 256-Bit SSL Encryption
                      </div>
                      <div class="flex items-center justify-center gap-1.5">
                        <span>🗑️</span> Auto-Deleted After 2h
                      </div>
                      <div class="flex items-center justify-center gap-1.5">
                        <span>⚡</span> High-Speed Cloud
                      </div>
                      <div class="flex items-center justify-center gap-1.5">
                        <span>🛡️</span> 100% Private & Secure
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* CATEGORY TOOLS GRID (Inspired by iLovePDF & Online-Convert) */}
            <section
              id="tools"
              class="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-neutral-800/60 bg-slate-50/70 dark:bg-neutral-950/40"
            >
              <div class="mx-auto max-w-7xl">
                <div class="text-center max-w-3xl mx-auto mb-14">
                  <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                    All-in-One Cloud Conversion Suite
                  </h2>
                  <p class="text-slate-600 dark:text-neutral-400 text-base">
                    Every converter you need in one place. Fast, accurate, and completely online.
                  </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Tool 1: Document */}
                  <div class="tool-card group">
                    <div class="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 mb-5 group-hover:scale-110 transition-transform">
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
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      Document Converter
                    </h3>
                    <p class="text-sm text-slate-600 dark:text-neutral-400 mb-4">
                      Convert PDF, Word (DOCX), Excel (XLSX), PowerPoint (PPTX), and TXT with
                      pixel-perfect accuracy.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        PDF to Word
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        Word to PDF
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        Excel to PDF
                      </span>
                    </div>
                  </div>

                  {/* Tool 2: Video */}
                  <div class="tool-card group">
                    <div class="flex size-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-5 group-hover:scale-110 transition-transform">
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
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      Video Converter
                    </h3>
                    <p class="text-sm text-slate-600 dark:text-neutral-400 mb-4">
                      Compress and convert video files across MP4, MKV, AVI, MOV, WEBM, and animated
                      GIF formats.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        MP4 to MP3
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        MOV to MP4
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        MKV to MP4
                      </span>
                    </div>
                  </div>

                  {/* Tool 3: Audio */}
                  <div class="tool-card group">
                    <div class="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-5 group-hover:scale-110 transition-transform">
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
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      Audio Converter
                    </h3>
                    <p class="text-sm text-slate-600 dark:text-neutral-400 mb-4">
                      Extract audio tracks and convert between MP3, WAV, FLAC, AAC, M4A, OGG, and
                      high-res formats.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        WAV to MP3
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        FLAC to MP3
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        M4A to MP3
                      </span>
                    </div>
                  </div>

                  {/* Tool 4: Image */}
                  <div class="tool-card group">
                    <div class="flex size-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 mb-5 group-hover:scale-110 transition-transform">
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
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      Image Converter
                    </h3>
                    <p class="text-sm text-slate-600 dark:text-neutral-400 mb-4">
                      Convert between PNG, JPG, WEBP, SVG, HEIC, TIFF, and vector formats with smart
                      compression.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        HEIC to JPG
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        PNG to JPG
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        WEBP to PNG
                      </span>
                    </div>
                  </div>

                  {/* Tool 5: E-Book */}
                  <div class="tool-card group">
                    <div class="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mb-5 group-hover:scale-110 transition-transform">
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
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      E-Book Converter
                    </h3>
                    <p class="text-sm text-slate-600 dark:text-neutral-400 mb-4">
                      Read your books on any device. Transform between EPUB, MOBI, PDF, AZW3, and
                      Kindle formats.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        EPUB to PDF
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        PDF to EPUB
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        MOBI to EPUB
                      </span>
                    </div>
                  </div>

                  {/* Tool 6: Data & Archives */}
                  <div class="tool-card group">
                    <div class="flex size-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 mb-5 group-hover:scale-110 transition-transform">
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
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      Data & Archives
                    </h3>
                    <p class="text-sm text-slate-600 dark:text-neutral-400 mb-4">
                      Convert structured data (JSON, CSV, XML, YAML) and compress or unpack ZIP,
                      TAR, and GZ archives.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        JSON to CSV
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        CSV to JSON
                      </span>
                      <span class="rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-transparent px-2 py-0.5 text-xs">
                        XML to JSON
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* HOW IT WORKS SECTION */}
            <section id="how-it-works" class="py-20 px-4 sm:px-6 lg:px-8">
              <div class="mx-auto max-w-7xl">
                <div class="text-center max-w-3xl mx-auto mb-16">
                  <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                    How It Works
                  </h2>
                  <p class="text-slate-600 dark:text-neutral-400 text-base">
                    Transform any file in 3 simple, friction-free steps.
                  </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center relative">
                  {/* Step 1 */}
                  <div class="flex flex-col items-center">
                    <div class="flex size-14 items-center justify-center rounded-2xl bg-slate-100 border border-slate-300 text-slate-800 dark:bg-neutral-800 dark:border-neutral-700 dark:text-accent-400 text-xl font-bold mb-4 shadow-md">
                      1
                    </div>
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      Upload File
                    </h3>
                    <p class="text-sm text-slate-600 dark:text-neutral-400 max-w-xs">
                      Drag and drop your file or select it directly from your computer or mobile
                      phone.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div class="flex flex-col items-center">
                    <div class="flex size-14 items-center justify-center rounded-2xl bg-slate-100 border border-slate-300 text-slate-800 dark:bg-neutral-800 dark:border-neutral-700 dark:text-accent-400 text-xl font-bold mb-4 shadow-md">
                      2
                    </div>
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      Choose Target Format
                    </h3>
                    <p class="text-sm text-slate-600 dark:text-neutral-400 max-w-xs">
                      Pick your desired output format from over 1,000 supported options.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div class="flex flex-col items-center">
                    <div class="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent-500 to-lime-400 text-neutral-950 text-xl font-bold mb-4 shadow-lg shadow-lime-500/20">
                      3
                    </div>
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      Download Instantly
                    </h3>
                    <p class="text-sm text-slate-600 dark:text-neutral-400 max-w-xs">
                      Our high-speed servers process your file in seconds. Download your file right
                      away!
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* FREEMIUM PRICING SECTION (SaaS Monetization) */}
            <section
              id="pricing"
              class="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-neutral-800/60 bg-slate-100/60 dark:bg-neutral-950/60"
            >
              <div class="mx-auto max-w-7xl">
                <div class="text-center max-w-3xl mx-auto mb-16">
                  <div class="inline-flex items-center gap-2 rounded-full border border-lime-500/30 bg-lime-500/10 px-3.5 py-1.5 text-xs font-semibold text-lime-700 dark:text-accent-400 mb-4">
                    <span>Flexible Plans</span>
                  </div>
                  <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                    Simple, Transparent Pricing
                  </h2>
                  <p class="text-slate-600 dark:text-neutral-400 text-base">
                    Use our platform for free, or upgrade for massive file sizes and unlimited
                    conversions.
                  </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
                  {dbTiers.map((t) => {
                    let featuresList: string[] = [];
                    try {
                      featuresList = JSON.parse(t.features);
                    } catch {
                      featuresList = t.features.split("\n");
                    }

                    return (
                      <div
                        class={`rounded-3xl border p-8 flex flex-col justify-between transition-all ${
                          t.is_popular
                            ? "relative border-2 border-accent-500 bg-white dark:bg-gradient-to-b dark:from-neutral-850 dark:to-neutral-900 shadow-2xl shadow-accent-500/10"
                            : "border-slate-200 bg-white shadow-md dark:border-neutral-800 dark:bg-neutral-900/60"
                        }`}
                      >
                        {t.is_popular ? (
                          <div class="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-accent-500 to-lime-400 px-4 py-1 text-xs font-extrabold text-neutral-950 uppercase tracking-wider shadow-sm">
                            {t.badge || "Most Popular"}
                          </div>
                        ) : null}

                        <div>
                          <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            {t.name}
                          </h3>
                          <p class="text-sm text-slate-600 dark:text-neutral-400 mb-6">
                            {t.description}
                          </p>
                          <div class="flex items-baseline gap-1 mb-6">
                            <span class="text-4xl font-extrabold text-slate-900 dark:text-white">
                              {t.price}
                            </span>
                            <span class="text-slate-500 dark:text-neutral-400 text-sm">
                              {t.billing_period}
                            </span>
                          </div>
                          <ul class="space-y-3.5 text-sm text-slate-700 dark:text-neutral-300 mb-8">
                            {featuresList.map((feat) => (
                              <li class="flex items-center gap-2.5">
                                <span class="text-lime-600 dark:text-accent-400 font-bold">✓</span>{" "}
                                {feat}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {checkout && priceIdForTier(t.id) && currentUser?.tier === t.id ? (
                          <a
                            href={`${WEBROOT}/account`}
                            class="w-full text-center text-sm font-bold btn-secondary"
                          >
                            Current plan
                          </a>
                        ) : checkout && priceIdForTier(t.id) ? (
                          <button
                            type="button"
                            data-paddle-price={priceIdForTier(t.id)}
                            class={`w-full text-center text-sm font-bold ${
                              t.is_popular ? "btn-primary" : "btn-secondary"
                            }`}
                          >
                            {t.button_text}
                          </button>
                        ) : (
                          <a
                            href={t.button_link}
                            class={`w-full text-center text-sm font-bold ${
                              t.is_popular ? "btn-primary" : "btn-secondary"
                            }`}
                          >
                            {t.button_text}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* WHY CHOOSE US & SECURITY */}
            <section
              id="features"
              class="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-neutral-800/60"
            >
              <div class="mx-auto max-w-7xl">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                  <div>
                    <h2 class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-6">
                      Engineered for Speed, Privacy & Precision
                    </h2>
                    <p class="text-slate-600 dark:text-neutral-300 text-base mb-8 leading-relaxed">
                      Unlike other services that sell or retain your documents, ConvertX operates
                      under a strict privacy-first architecture. {fileDeletionPromise()}
                    </p>
                    <div class="space-y-4">
                      <div class="flex items-start gap-4">
                        <div class="flex size-10 items-center justify-center rounded-xl bg-lime-500/10 text-lime-600 dark:text-accent-400 shrink-0">
                          🛡️
                        </div>
                        <div>
                          <h4 class="font-bold text-slate-900 dark:text-white text-base">
                            Automatic File Deletion
                          </h4>
                          <p class="text-sm text-slate-600 dark:text-neutral-400">
                            {fileDeletionPromise()}
                          </p>
                        </div>
                      </div>
                      <div class="flex items-start gap-4">
                        <div class="flex size-10 items-center justify-center rounded-xl bg-lime-500/10 text-lime-600 dark:text-accent-400 shrink-0">
                          ⚡
                        </div>
                        <div>
                          <h4 class="font-bold text-slate-900 dark:text-white text-base">
                            Industry-Standard Engines
                          </h4>
                          <p class="text-sm text-slate-600 dark:text-neutral-400">
                            Powered by FFmpeg, LibreOffice, ImageMagick, Pandoc, and Calibre for the
                            highest quality possible.
                          </p>
                        </div>
                      </div>
                      <div class="flex items-start gap-4">
                        <div class="flex size-10 items-center justify-center rounded-xl bg-lime-500/10 text-lime-600 dark:text-accent-400 shrink-0">
                          📱
                        </div>
                        <div>
                          <h4 class="font-bold text-slate-900 dark:text-white text-base">
                            Zero Installation Required
                          </h4>
                          <p class="text-sm text-slate-600 dark:text-neutral-400">
                            Runs smoothly in any modern browser on iOS, Android, macOS, Windows, and
                            Linux.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-neutral-700/60 dark:bg-gradient-to-tr dark:from-neutral-900 dark:to-neutral-850 p-8">
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-4">
                      Supported Converters & Libraries
                    </h3>
                    <div class="grid grid-cols-2 gap-3 text-sm text-slate-700 dark:text-neutral-300">
                      <div class="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-neutral-800/70 border border-slate-200 dark:border-transparent">
                        <span class="text-lime-600 dark:text-accent-400">●</span> FFmpeg
                        (Video/Audio)
                      </div>
                      <div class="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-neutral-800/70 border border-slate-200 dark:border-transparent">
                        <span class="text-lime-600 dark:text-accent-400">●</span> LibreOffice
                        (Office Docs)
                      </div>
                      <div class="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-neutral-800/70 border border-slate-200 dark:border-transparent">
                        <span class="text-lime-600 dark:text-accent-400">●</span> ImageMagick
                        (Raster)
                      </div>
                      <div class="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-neutral-800/70 border border-slate-200 dark:border-transparent">
                        <span class="text-lime-600 dark:text-accent-400">●</span> Pandoc
                        (Markdown/TeX)
                      </div>
                      <div class="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-neutral-800/70 border border-slate-200 dark:border-transparent">
                        <span class="text-lime-600 dark:text-accent-400">●</span> Calibre (eBooks)
                      </div>
                      <div class="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-neutral-800/70 border border-slate-200 dark:border-transparent">
                        <span class="text-lime-600 dark:text-accent-400">●</span> Inkscape
                        (Vectors/SVG)
                      </div>
                      <div class="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-neutral-800/70 border border-slate-200 dark:border-transparent">
                        <span class="text-lime-600 dark:text-accent-400">●</span> Potrace (Raster to
                        Vector)
                      </div>
                      <div class="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 dark:bg-neutral-800/70 border border-slate-200 dark:border-transparent">
                        <span class="text-lime-600 dark:text-accent-400">●</span> Assimp (3D Assets)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>

          {/* SAAS FOOTER */}
          <footer class="w-full border-t border-slate-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 py-12 px-4 sm:px-6 lg:px-8">
            <div class="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-5 gap-8 mb-10 text-sm">
              <div class="col-span-2">
                <div class="flex items-center gap-2.5 mb-3">
                  <div class="flex size-7 items-center justify-center rounded-lg bg-gradient-to-tr from-accent-500 to-lime-400 text-neutral-950 font-bold text-sm">
                    CX
                  </div>
                  <span
                    class="text-lg font-bold text-slate-900 dark:text-white tracking-tight"
                    safe
                  >
                    {BRANDING}
                  </span>
                </div>
                <p class="text-slate-500 dark:text-neutral-400 text-xs max-w-sm leading-relaxed mb-4">
                  The modern, secure online file converter. Transform thousands of file formats in
                  the cloud with zero software installation.
                </p>
                <p class="text-slate-500 dark:text-neutral-400 text-xs">
                  © {new Date().getFullYear()} {BRANDING}. All rights reserved.
                </p>
              </div>

              <div>
                <h5 class="text-slate-900 dark:text-white font-bold mb-3 text-xs uppercase tracking-wider">
                  Converters
                </h5>
                <ul class="space-y-2 text-xs text-slate-600 dark:text-neutral-400">
                  <li>
                    <a
                      href="#tools"
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      PDF Converter
                    </a>
                  </li>
                  <li>
                    <a
                      href="#tools"
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Video Converter
                    </a>
                  </li>
                  <li>
                    <a
                      href="#tools"
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Audio Converter
                    </a>
                  </li>
                  <li>
                    <a
                      href="#tools"
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Image Converter
                    </a>
                  </li>
                  <li>
                    <a
                      href="#tools"
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      eBook Converter
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h5 class="text-slate-900 dark:text-white font-bold mb-3 text-xs uppercase tracking-wider">
                  Product
                </h5>
                <ul class="space-y-2 text-xs text-slate-600 dark:text-neutral-400">
                  <li>
                    <a
                      href="#pricing"
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Pricing Plans
                    </a>
                  </li>
                  <li>
                    <a
                      href="#how-it-works"
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      How It Works
                    </a>
                  </li>
                  <li>
                    <a
                      href="#features"
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Security & Privacy
                    </a>
                  </li>
                  <li>
                    <a
                      href={`${WEBROOT}/history`}
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Conversion History
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h5 class="text-slate-900 dark:text-white font-bold mb-3 text-xs uppercase tracking-wider">
                  Account
                </h5>
                <ul class="space-y-2 text-xs text-slate-600 dark:text-neutral-400">
                  <li>
                    <a
                      href={`${WEBROOT}/login`}
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Sign In
                    </a>
                  </li>
                  <li>
                    <a
                      href={`${WEBROOT}/register`}
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Create Account
                    </a>
                  </li>
                  <li>
                    <a
                      href={`${WEBROOT}/account`}
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Account Settings
                    </a>
                  </li>
                  <li>
                    <a
                      href={`${WEBROOT}/terms`}
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a
                      href={`${WEBROOT}/privacy`}
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href={`${WEBROOT}/refunds`}
                      class="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Refund Policy
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
    }),
  },
);
