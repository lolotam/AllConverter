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
import { localeFromRequest, safeT as safeTr, type Locale } from "../i18n";
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
      <div class="mb-3 flex items-center justify-between text-caption font-semibold text-ink-body">
        <span>
          {job.num_files === 1
            ? safeTr(locale, "results.convertingOne")
            : safeTr(locale, "results.convertingMany", { count: job.num_files })}
        </span>
        <span data-progress-overall class="font-bold text-ink tabular-nums">
          0%
        </span>
      </div>
      <ul class="space-y-3">
        {tracked.map((file, index) => (
          <li
            data-progress-index={String(index)}
            data-state={file.state}
            class="group rounded-card border border-rule bg-surface p-3"
          >
            <div class="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span safe class="truncate font-medium text-ink">
                {file.file}
              </span>
              <span
                data-progress-label
                class="shrink-0 text-xs font-bold text-ink-muted tabular-nums group-data-[state=failed]:text-terracotta"
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
              aria-label={safeTr(locale, "results.convertingFile", { file: file.file })}
              class="h-2.5 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                data-progress-fill
                style="width: 0%"
                class="h-full rounded-full bg-cta group-data-[state=converting]:animate-pulse group-data-[state=failed]:bg-terracotta"
              />
            </div>
            <p data-progress-state class="mt-1 text-xs text-ink-muted">
              {safeTr(locale, STATE_LABELS[file.state].key)}
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
          <h1 class="text-heading-sm font-black text-ink">{safeTr(locale, "results.title")}</h1>
          <p class="mt-1 text-xs text-ink-muted">
            {safeTr(locale, "results.job", { id: job.id })}{" "}
            {finished
              ? files.length === 1
                ? safeTr(locale, "results.readyOne")
                : safeTr(locale, "results.readyMany", { count: files.length })
              : job.num_files === 1
                ? safeTr(locale, "results.convertingCountOne")
                : safeTr(locale, "results.convertingCountMany", { count: job.num_files })}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5">
          <a
            href={`${WEBROOT}/`}
            class="inline-flex btn-secondary items-center gap-1.5 px-3 py-2 text-xs sm:text-sm"
          >
            <span>+</span> {safeTr(locale, "results.convertMore")}
          </a>
          <form action={`${WEBROOT}/delete/${job.id}`} method="POST">
            <button
              type="submit"
              style={finished ? "" : "pointer-events: none;"}
              class="inline-flex btn-secondary items-center gap-1.5 px-3 py-2 text-xs text-terracotta hover:bg-terracotta/10 sm:text-sm"
              {...(finished ? "" : { disabled: true, "aria-busy": "true" })}
            >
              <DeleteIcon /> <span>{safeTr(locale, "results.delete")}</span>
            </button>
          </form>
          <a
            style={finished ? "" : "pointer-events: none;"}
            href={`${WEBROOT}/archive/${job.id}?token=${token}`}
            download={`converted_files_${job.id}.tar`}
            class="inline-flex btn-primary items-center gap-1.5 px-3 py-2 text-xs sm:text-sm"
            {...(finished ? "" : { disabled: true, "aria-busy": "true" })}
          >
            <DownloadIcon /> <span>{safeTr(locale, "results.tarArchive")}</span>
          </a>
          <button
            class="inline-flex btn-primary items-center gap-1.5 px-3 py-2 text-xs sm:text-sm"
            onclick="downloadAll()"
          >
            <DownloadIcon /> <span>{safeTr(locale, "results.downloadAll")}</span>
          </button>
        </div>
      </div>

      {!finished && tracked !== undefined && tracked.length > 0 && (
        <ProgressList locale={locale} job={job} tracked={tracked} />
      )}
      {!finished && !tracked && (
        <p class="mb-6 text-caption text-ink-muted">
          {safeTr(locale, "results.convertingYourFiles")}
        </p>
      )}

      {finished && entries.length > 0 && (
        <div data-results>
          {/* Toolbar: switch between the two views, and act on the selection */}
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            {/* The muted label colour lives on the container: results.js marks the active
                view button with bg-cta text-cta-ink, and a direct class must out-rank
                inherited text so the toggle stays readable */}
            <div class="inline-flex overflow-hidden rounded-button border border-rule text-ink-muted">
              <button type="button" data-view-button="rows" class="px-3 py-1.5 text-xs font-bold">
                {safeTr(locale, "results.rows")}
              </button>
              <button
                type="button"
                data-view-button="cards"
                class="border-s border-rule px-3 py-1.5 text-xs font-bold"
              >
                {safeTr(locale, "results.cards")}
              </button>
            </div>
            <div data-selection-bar hidden class="flex flex-wrap items-center gap-2">
              <span data-selection-count class="text-xs font-semibold text-ink-muted">
                {safeTr(locale, "results.selected", { count: 0 })}
              </span>
              <button
                type="button"
                data-download-selected
                class="inline-flex btn-primary items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <DownloadIcon /> <span>{safeTr(locale, "results.downloadSelected")}</span>
              </button>
              <button type="button" data-clear-selection class="btn-secondary px-3 py-1.5 text-xs">
                {safeTr(locale, "results.clear")}
              </button>
            </div>
          </div>

          {/* Rows view */}
          <div
            data-view="rows"
            class="overflow-x-auto rounded-card border border-rule bg-surface-2 shadow-sm"
          >
            <table class="w-full table-auto text-start text-sm">
              <thead class="border-b border-rule text-xs font-bold tracking-wider text-ink-muted uppercase">
                <tr>
                  <th class="p-4">
                    <input
                      type="checkbox"
                      data-select-all
                      aria-label={safeTr(locale, "results.selectAll")}
                    />
                  </th>
                  <th class="p-4">{safeTr(locale, "results.fileName")}</th>
                  <th class="p-4">{safeTr(locale, "results.size")}</th>
                  <th class="p-4">{safeTr(locale, "results.status")}</th>
                  <th class="p-4 text-end">{safeTr(locale, "results.actions")}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-rule">
                {entries.map((entry) => (
                  <tr
                    data-result-item
                    data-name={entry.name}
                    data-download={entry.downloadUrl}
                    class="transition-colors hover:bg-surface"
                  >
                    <td class="p-4">
                      {entry.failed ? (
                        ""
                      ) : (
                        <input
                          type="checkbox"
                          data-select
                          aria-label={safeTr(locale, "results.selectFile", { name: entry.name })}
                        />
                      )}
                    </td>
                    <td
                      safe
                      class="max-w-[28vw] truncate p-4 font-medium text-ink"
                      title={entry.name}
                    >
                      {entry.name}
                    </td>
                    <td class="p-4 text-ink-muted" safe>
                      {entry.failed ? "—" : entry.size}
                    </td>
                    <td class="p-4">
                      {entry.failed ? (
                        <span
                          class="inline-flex items-center gap-1 rounded-tag border border-terracotta/40 bg-terracotta/10 px-2.5 py-0.5 text-xs font-bold text-terracotta"
                          title={entry.status}
                        >
                          {safeTr(locale, "results.failedBadge")}
                        </span>
                      ) : (
                        <span class="inline-flex items-center gap-1 rounded-tag border border-rule bg-surface px-2.5 py-0.5 text-xs font-bold text-ink-body">
                          {safeTr(locale, "results.readyBadge")}
                        </span>
                      )}
                    </td>
                    <td class="p-4 text-end">
                      {entry.failed ? (
                        <span class="text-xs text-ink-faint">
                          {safeTr(locale, "results.unavailable")}
                        </span>
                      ) : (
                        <div class="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            data-preview={entry.previewUrl}
                            data-is-image={String(entry.isImage)}
                            title={safeTr(locale, "results.previewFile", { name: entry.name })}
                            class="inline-flex size-8 items-center justify-center rounded-button bg-surface-2 text-ink-body transition-colors hover:bg-rule"
                          >
                            <EyeIcon />
                          </button>
                          <a
                            class="inline-flex btn-primary items-center gap-1.5 px-3 py-1.5 text-xs shadow-sm"
                            href={entry.downloadUrl}
                            download={entry.name}
                            title={safeTr(locale, "results.downloadFile", { name: entry.name })}
                          >
                            <DownloadIcon /> <span>{safeTr(locale, "results.download")}</span>
                          </a>
                          <button
                            type="button"
                            data-delete
                            title={safeTr(locale, "results.deleteFile", { name: entry.name })}
                            class="inline-flex size-8 items-center justify-center rounded-button bg-surface-2 text-terracotta transition-colors hover:bg-terracotta/10"
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
                class="group relative overflow-hidden glass-card"
              >
                <div class="relative flex h-36 items-center justify-center overflow-hidden bg-surface-2">
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
                      title={safeTr(locale, "results.previewFile", { name: entry.name })}
                      class="absolute inset-0 flex items-center justify-center bg-frame/0 text-frame-ink opacity-0 transition-all group-hover:opacity-100 hover:bg-frame/40"
                    >
                      <span class="rounded-full bg-frame/70 p-3">
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
                      aria-label={safeTr(locale, "results.selectFile", { name: entry.name })}
                      class="absolute inset-s-2 top-2 size-4 accent-cta"
                    />
                  )}
                </div>
                <div class="p-3">
                  <p safe class="truncate text-xs font-semibold text-ink" title={entry.name}>
                    {entry.name}
                  </p>
                  <div class="mt-2 flex items-center justify-between">
                    <span class="text-xs text-ink-muted" safe>
                      {entry.failed ? safeTr(locale, "results.failed") : entry.size}
                    </span>
                    {entry.failed ? (
                      ""
                    ) : (
                      <span class="inline-flex items-center gap-1.5">
                        <a
                          href={entry.downloadUrl}
                          download={entry.name}
                          title={safeTr(locale, "results.downloadFile", { name: entry.name })}
                          class="inline-flex size-7 items-center justify-center rounded-button bg-cta text-cta-ink transition-opacity hover:opacity-90"
                        >
                          <DownloadIcon />
                        </a>
                        <button
                          type="button"
                          data-delete
                          title={safeTr(locale, "results.deleteFile", { name: entry.name })}
                          class="inline-flex size-7 items-center justify-center rounded-button bg-surface-2 text-terracotta"
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
            class="fixed inset-0 z-50 flex items-center justify-center bg-frame/80 p-4"
          >
            <div class="max-h-full w-full max-w-4xl overflow-auto rounded-card bg-surface p-4">
              <div class="mb-3 flex items-center justify-between gap-4">
                <p data-preview-name class="truncate text-caption font-bold text-ink" />
                <button type="button" data-preview-close class="btn-secondary px-3 py-1.5 text-xs">
                  {safeTr(locale, "results.close")}
                </button>
              </div>
              <img data-preview-image alt="" class="mx-auto max-h-[70vh] w-auto rounded-card" />
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
