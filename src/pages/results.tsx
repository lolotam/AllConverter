import { statSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { Elysia, t } from "elysia";
import { assetUrl } from "../helpers/assetUrl";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import db from "../db/db";
import { Filename, Jobs } from "../db/types";
import { jobProgress, type FileProgress, type FileState } from "../converters/progress";
import { buildDownloadUrl } from "../helpers/buildDownloadUrl";
import { headerAccount } from "../helpers/headerUser";
import { createDownloadToken } from "../services/downloadToken";
import { outputDir } from "../helpers/paths";
import { ALLOW_UNAUTHENTICATED, WEBROOT, BRANDING } from "../helpers/env";
import { DownloadIcon } from "../icons/download";
import { DeleteIcon } from "../icons/delete";
import { EyeIcon } from "../icons/eye";
import sanitize from "sanitize-filename";
import { localeFromRequest, t as tr, type Locale } from "../i18n";
import { userService } from "./user";

const STATE_LABELS: Record<
  FileState,
  {
    key:
      | "results.stateQueued"
      | "results.stateConverting"
      | "results.stateDone"
      | "results.stateFailed";
  }
> = {
  queued: { key: "results.stateQueued" },
  converting: { key: "results.stateConverting" },
  done: { key: "results.stateDone" },
  failed: { key: "results.stateFailed" },
};

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "bmp",
  "tiff",
  "tif",
  "svg",
  "heic",
]);

const FAILED_STATUSES = ["Failed, check logs", "File type not supported"];

const humanSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} kB`;
  }
  return `${bytes} B`;
};

type ResultEntry = {
  name: string;
  status: string;
  failed: boolean;
  isImage: boolean;
  size: string;
  downloadUrl: string;
  previewUrl: string;
};

/**
 * Collects what the results view needs about each converted file. Every link carries a
 * signed token so download managers, which fetch without the session cookie, are not
 * refused and left asking the user for a password (see docs/download-auth.md).
 */
function buildEntries(files: Filename[], outputPath: string, token: string): ResultEntry[] {
  return files.map((file) => {
    const name = file.output_file_name;
    const extension = name.split(".").pop()?.toLowerCase() ?? "";
    let bytes = 0;
    try {
      bytes = statSync(`${outputDir}${outputPath}${name}`).size;
    } catch {
      // The file may have been deleted or the conversion failed
    }
    const downloadUrl = `${buildDownloadUrl(WEBROOT, outputPath, name)}?token=${token}`;
    return {
      name,
      status: file.status,
      failed: FAILED_STATUSES.includes(file.status),
      isImage: IMAGE_EXTENSIONS.has(extension),
      size: humanSize(bytes),
      downloadUrl,
      // Served with an inline disposition so it can be shown instead of downloaded
      previewUrl: `${downloadUrl}&inline=1`,
    };
  });
}

// A job with no files (the home page creates one per visit) has nothing to wait for
const isFinished = (job: Jobs) => job.status === "completed" || job.num_files === 0;

function ProgressList({
  locale,
  job,
  tracked,
}: {
  locale: Locale;
  job: Jobs;
  tracked: FileProgress[];
}) {
  return (
    <section class="mb-6">
      <div class="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-neutral-200">
        <span>
          {job.num_files === 1
            ? tr(locale, "results.convertingOne")
            : tr(locale, "results.convertingMany", { count: job.num_files })}
        </span>
        <span data-progress-overall class="tabular-nums text-lime-600 dark:text-accent-400">
          0%
        </span>
      </div>
      <ul class="space-y-3">
        {tracked.map((file, index) => (
          <li
            data-progress-index={String(index)}
            data-state={file.state}
            class="group rounded-xl border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div class="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span safe class="truncate font-medium text-slate-900 dark:text-white">
                {file.file}
              </span>
              <span
                data-progress-label
                class="shrink-0 text-xs font-bold tabular-nums text-slate-600 group-data-[state=failed]:text-rose-600 dark:text-neutral-300"
              >
                0%
              </span>
            </div>
            <div
              data-progress-bar
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="0"
              aria-label={tr(locale, "results.convertingFile", { file: file.file })}
              class="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-700"
            >
              <div
                data-progress-fill
                style="width: 0%"
                class="h-full rounded-full bg-gradient-to-r from-accent-500 to-lime-400 group-data-[state=converting]:animate-pulse group-data-[state=failed]:from-rose-500 group-data-[state=failed]:to-rose-400"
              />
            </div>
            <p data-progress-state class="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              {tr(locale, STATE_LABELS[file.state].key)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResultsArticle({
  locale,
  job,
  files,
  outputPath,
  tracked,
}: {
  locale: Locale;
  job: Jobs;
  files: Filename[];
  outputPath: string;
  tracked: FileProgress[] | undefined;
}) {
  const finished = isFinished(job);
  // One token per page render covers this job's files and its archive
  const token = createDownloadToken(job.user_id, job.id);
  const entries = buildEntries(files, outputPath, token);
  return (
    <article class="article" data-job-complete={String(finished)}>
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-black text-slate-900 dark:text-white">
            {tr(locale, "results.title")}
          </h1>
          <p class="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            {tr(locale, "results.job", { id: job.id })}{" "}
            {finished
              ? files.length === 1
                ? tr(locale, "results.readyOne")
                : tr(locale, "results.readyMany", { count: files.length })
              : job.num_files === 1
                ? tr(locale, "results.convertingCountOne")
                : tr(locale, "results.convertingCountMany", { count: job.num_files })}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5">
          <a
            href={`${WEBROOT}/`}
            class="btn-secondary text-xs sm:text-sm py-2 px-3 inline-flex items-center gap-1.5"
          >
            <span>+</span> {tr(locale, "results.convertMore")}
          </a>
          <form action={`${WEBROOT}/delete/${job.id}`} method="POST">
            <button
              type="submit"
              style={finished ? "" : "pointer-events: none;"}
              class="btn-secondary text-xs sm:text-sm py-2 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 inline-flex items-center gap-1.5"
              {...(finished ? "" : { disabled: true, "aria-busy": "true" })}
            >
              <DeleteIcon /> <span>{tr(locale, "results.delete")}</span>
            </button>
          </form>
          <a
            style={finished ? "" : "pointer-events: none;"}
            href={`${WEBROOT}/archive/${job.id}?token=${token}`}
            download={`converted_files_${job.id}.tar`}
            class="btn-primary text-xs sm:text-sm py-2 px-3 inline-flex items-center gap-1.5"
            {...(finished ? "" : { disabled: true, "aria-busy": "true" })}
          >
            <DownloadIcon /> <span>{tr(locale, "results.tarArchive")}</span>
          </a>
          <button
            class="btn-primary text-xs sm:text-sm py-2 px-3 inline-flex items-center gap-1.5"
            onclick="downloadAll()"
          >
            <DownloadIcon /> <span>{tr(locale, "results.downloadAll")}</span>
          </button>
        </div>
      </div>

      {!finished && tracked && tracked.length > 0 && (
        <ProgressList locale={locale} job={job} tracked={tracked} />
      )}
      {!finished && !tracked && (
        <p class="mb-6 text-sm text-slate-500 dark:text-neutral-400">
          {tr(locale, "results.convertingYourFiles")}
        </p>
      )}

      {finished && entries.length > 0 && (
        <div data-results>
          {/* Toolbar: switch between the two views, and act on the selection */}
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div class="inline-flex overflow-hidden rounded-xl border border-slate-200 dark:border-neutral-800">
              <button
                type="button"
                data-view-button="rows"
                class="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-neutral-300"
              >
                {tr(locale, "results.rows")}
              </button>
              <button
                type="button"
                data-view-button="cards"
                class="border-s border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-neutral-800 dark:text-neutral-300"
              >
                {tr(locale, "results.cards")}
              </button>
            </div>
            <div data-selection-bar hidden class="flex flex-wrap items-center gap-2">
              <span
                data-selection-count
                class="text-xs font-semibold text-slate-600 dark:text-neutral-300"
              >
                {tr(locale, "results.selected", { count: 0 })}
              </span>
              <button
                type="button"
                data-download-selected
                class="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <DownloadIcon /> <span>{tr(locale, "results.downloadSelected")}</span>
              </button>
              <button type="button" data-clear-selection class="btn-secondary px-3 py-1.5 text-xs">
                {tr(locale, "results.clear")}
              </button>
            </div>
          </div>

          {/* Rows view */}
          <div
            data-view="rows"
            class="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <table class="w-full table-auto text-start text-sm">
              <thead class="border-b border-slate-200 bg-slate-100/80 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-neutral-800 dark:bg-neutral-850/80 dark:text-neutral-400">
                <tr>
                  <th class="p-4">
                    <input
                      type="checkbox"
                      data-select-all
                      aria-label={tr(locale, "results.selectAll")}
                    />
                  </th>
                  <th class="p-4">{tr(locale, "results.fileName")}</th>
                  <th class="p-4">{tr(locale, "results.size")}</th>
                  <th class="p-4">{tr(locale, "results.status")}</th>
                  <th class="p-4 text-end">{tr(locale, "results.actions")}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-neutral-800/80">
                {entries.map((entry) => (
                  <tr
                    data-result-item
                    data-name={entry.name}
                    data-download={entry.downloadUrl}
                    class="transition-colors hover:bg-slate-100/50 dark:hover:bg-neutral-800/40"
                  >
                    <td class="p-4">
                      {entry.failed ? (
                        ""
                      ) : (
                        <input
                          type="checkbox"
                          data-select
                          aria-label={tr(locale, "results.selectFile", { name: entry.name })}
                        />
                      )}
                    </td>
                    <td
                      safe
                      class="max-w-[28vw] truncate p-4 font-medium text-slate-900 dark:text-white"
                      title={entry.name}
                    >
                      {entry.name}
                    </td>
                    <td class="p-4 text-slate-500 dark:text-neutral-400" safe>
                      {entry.failed ? "—" : entry.size}
                    </td>
                    <td class="p-4">
                      {entry.failed ? (
                        <span
                          class="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400"
                          title={entry.status}
                        >
                          {tr(locale, "results.failedBadge")}
                        </span>
                      ) : (
                        <span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {tr(locale, "results.readyBadge")}
                        </span>
                      )}
                    </td>
                    <td class="p-4 text-end">
                      {entry.failed ? (
                        <span class="text-xs text-slate-400 dark:text-neutral-500">
                          {tr(locale, "results.unavailable")}
                        </span>
                      ) : (
                        <div class="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            data-preview={entry.previewUrl}
                            data-is-image={String(entry.isImage)}
                            title={tr(locale, "results.previewFile", { name: entry.name })}
                            class="inline-flex size-8 items-center justify-center rounded-lg bg-slate-200 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                          >
                            <EyeIcon />
                          </button>
                          <a
                            class="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent-500 to-lime-400 px-3 py-1.5 text-xs font-bold text-neutral-950 shadow transition-all hover:from-accent-400 hover:to-lime-300"
                            href={entry.downloadUrl}
                            download={entry.name}
                            title={tr(locale, "results.downloadFile", { name: entry.name })}
                          >
                            <DownloadIcon /> <span>{tr(locale, "results.download")}</span>
                          </a>
                          <button
                            type="button"
                            data-delete
                            title={tr(locale, "results.deleteFile", { name: entry.name })}
                            class="inline-flex size-8 items-center justify-center rounded-lg bg-slate-200 text-rose-600 transition-colors hover:bg-rose-100 dark:bg-neutral-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                          >
                            <DeleteIcon />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards view: a thumbnail per file with the preview eye in the middle */}
          <div
            data-view="cards"
            hidden
            class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {entries.map((entry) => (
              <div
                data-result-item
                data-name={entry.name}
                data-download={entry.downloadUrl}
                class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div class="relative flex h-36 items-center justify-center overflow-hidden bg-slate-100 dark:bg-neutral-950">
                  {entry.isImage && !entry.failed ? (
                    <img
                      src={entry.previewUrl}
                      alt={entry.name}
                      loading="lazy"
                      class="size-full object-cover"
                    />
                  ) : (
                    <span class="text-3xl">{entry.failed ? "✕" : "📄"}</span>
                  )}
                  {entry.failed ? (
                    ""
                  ) : (
                    <button
                      type="button"
                      data-preview={entry.previewUrl}
                      data-is-image={String(entry.isImage)}
                      title={tr(locale, "results.previewFile", { name: entry.name })}
                      class="absolute inset-0 flex items-center justify-center bg-neutral-950/0 text-white opacity-0 transition-all hover:bg-neutral-950/40 group-hover:opacity-100"
                    >
                      <span class="rounded-full bg-neutral-950/70 p-3">
                        <EyeIcon />
                      </span>
                    </button>
                  )}
                  {entry.failed ? (
                    ""
                  ) : (
                    <input
                      type="checkbox"
                      data-select
                      aria-label={tr(locale, "results.selectFile", { name: entry.name })}
                      class="absolute start-2 top-2 size-4 accent-lime-500"
                    />
                  )}
                </div>
                <div class="p-3">
                  <p
                    safe
                    class="truncate text-xs font-semibold text-slate-900 dark:text-white"
                    title={entry.name}
                  >
                    {entry.name}
                  </p>
                  <div class="mt-2 flex items-center justify-between">
                    <span class="text-xs text-slate-500 dark:text-neutral-400" safe>
                      {entry.failed ? tr(locale, "results.failed") : entry.size}
                    </span>
                    {entry.failed ? (
                      ""
                    ) : (
                      <span class="inline-flex items-center gap-1.5">
                        <a
                          href={entry.downloadUrl}
                          download={entry.name}
                          title={tr(locale, "results.downloadFile", { name: entry.name })}
                          class="inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-r from-accent-500 to-lime-400 text-neutral-950"
                        >
                          <DownloadIcon />
                        </a>
                        <button
                          type="button"
                          data-delete
                          title={tr(locale, "results.deleteFile", { name: entry.name })}
                          class="inline-flex size-7 items-center justify-center rounded-lg bg-slate-200 text-rose-600 dark:bg-neutral-800 dark:text-rose-400"
                        >
                          <DeleteIcon />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Preview overlay */}
          <div
            data-preview-modal
            hidden
            class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4"
          >
            <div class="max-h-full w-full max-w-4xl overflow-auto rounded-2xl bg-white p-4 dark:bg-neutral-900">
              <div class="mb-3 flex items-center justify-between gap-4">
                <p
                  data-preview-name
                  class="truncate text-sm font-bold text-slate-900 dark:text-white"
                />
                <button type="button" data-preview-close class="btn-secondary px-3 py-1.5 text-xs">
                  {tr(locale, "results.close")}
                </button>
              </div>
              <img data-preview-image alt="" class="mx-auto max-h-[70vh] w-auto rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export const results = new Elysia()
  .use(userService)
  .get(
    "/results/:jobId",
    async ({ params, set, request, cookie: { job_id, lang }, user }) => {
      if (job_id?.value) {
        // Clear the job_id cookie since we are viewing the results
        job_id.remove();
      }

      const locale = localeFromRequest(request, lang?.value);

      const job = db
        .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
        .as(Jobs)
        .get(user.id, params.jobId);

      if (!job) {
        set.status = 404;
        return {
          message: "Job not found.",
        };
      }

      const outputPath = `${user.id}/${params.jobId}/`;

      const files = db
        .query("SELECT * FROM file_names WHERE job_id = ?")
        .as(Filename)
        .all(params.jobId);

      return (
        <BaseHtml webroot={WEBROOT} title="ConvertX | Result" locale={locale}>
          <>
            <Header
              webroot={WEBROOT}
              locale={locale}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              loggedIn
              branding={BRANDING}
              {...headerAccount(user.id)}
            />
            <main
              class={`
                w-full flex-1 px-2
                sm:px-4
              `}
            >
              <ResultsArticle
                locale={locale}
                job={job}
                files={files}
                outputPath={outputPath}
                tracked={jobProgress(String(job.id))}
              />
            </main>
            <script src={assetUrl(WEBROOT, "results.js")} defer />
          </>
        </BaseHtml>
      );
    },
    { auth: true },
  )
  .post(
    "/progress/:jobId",
    async ({ set, params, request, cookie: { job_id, lang }, user }) => {
      if (job_id?.value) {
        // Clear the job_id cookie since we are viewing the results
        job_id.remove();
      }

      const locale = localeFromRequest(request, lang?.value);

      const job = db
        .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
        .as(Jobs)
        .get(user.id, params.jobId);

      if (!job) {
        set.status = 404;
        return {
          message: "Job not found.",
        };
      }

      const outputPath = `${user.id}/${params.jobId}/`;

      const files = db
        .query("SELECT * FROM file_names WHERE job_id = ?")
        .as(Filename)
        .all(params.jobId);

      return (
        <ResultsArticle
          locale={locale}
          job={job}
          files={files}
          outputPath={outputPath}
          tracked={jobProgress(String(job.id))}
        />
      );
    },
    { auth: true },
  )
  .post(
    "/results/:jobId/delete",
    async ({ params, body, status, user }) => {
      const job = db
        .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
        .as(Jobs)
        .get(user.id, params.jobId);

      if (!job) {
        return status(404, { message: "Job not found." });
      }

      const fileName = sanitize(body.filename);
      await unlink(`${outputDir}${user.id}/${job.id}/${fileName}`).catch(() => {});
      db.query("DELETE FROM file_names WHERE job_id = ? AND output_file_name = ?").run(
        job.id,
        fileName,
      );

      return { deleted: fileName };
    },
    { body: t.Object({ filename: t.String() }), auth: true },
  )
  .get(
    "/progress/:jobId/status",
    ({ params, status, user }) => {
      const job = db
        .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
        .as(Jobs)
        .get(user.id, params.jobId);

      if (!job) {
        return status(404, { message: "Job not found." });
      }

      return { complete: isFinished(job), files: jobProgress(String(job.id)) ?? [] };
    },
    { auth: true },
  );
