import { Elysia } from "elysia";
import { assetUrl } from "../helpers/assetUrl";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import db from "../db/db";
import { Filename, Jobs } from "../db/types";
import { buildDownloadUrl } from "../helpers/buildDownloadUrl";
import { ALLOW_UNAUTHENTICATED, WEBROOT, BRANDING } from "../helpers/env";
import { DownloadIcon } from "../icons/download";
import { DeleteIcon } from "../icons/delete";
import { EyeIcon } from "../icons/eye";
import { userService } from "./user";

function ResultsArticle({
  job,
  files,
  outputPath,
}: {
  job: Jobs;
  files: Filename[];
  outputPath: string;
}) {
  return (
    <article class="article">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-black text-slate-900 dark:text-white">Conversion Results</h1>
          <p class="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            Job #{job.id} · {files.length} of {job.num_files} files processed
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5">
          <a
            href={`${WEBROOT}/`}
            class="btn-secondary text-xs sm:text-sm py-2 px-3 inline-flex items-center gap-1.5"
          >
            <span>+</span> Convert More
          </a>
          <form action={`${WEBROOT}/delete/${job.id}`} method="POST">
            <button
              type="submit"
              style={files.length !== job.num_files ? "pointer-events: none;" : ""}
              class="btn-secondary text-xs sm:text-sm py-2 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 inline-flex items-center gap-1.5"
              {...(files.length !== job.num_files ? { disabled: true, "aria-busy": "true" } : "")}
            >
              <DeleteIcon /> <span>Delete</span>
            </button>
          </form>
          <a
            style={files.length !== job.num_files ? "pointer-events: none;" : ""}
            href={`${WEBROOT}/archive/${job.id}`}
            download={`converted_files_${job.id}.tar`}
            class="btn-primary text-xs sm:text-sm py-2 px-3 inline-flex items-center gap-1.5"
            {...(files.length !== job.num_files ? { disabled: true, "aria-busy": "true" } : "")}
          >
            <DownloadIcon /> <span>Tar Archive</span>
          </a>
          <button class="btn-primary text-xs sm:text-sm py-2 px-3 inline-flex items-center gap-1.5" onclick="downloadAll()">
            <DownloadIcon /> <span>Download All</span>
          </button>
        </div>
      </div>

      <progress
        max={job.num_files}
        {...(files.length === job.num_files ? { value: files.length } : "")}
        class={`
          mb-6 inline-block h-2.5 w-full appearance-none overflow-hidden rounded-full border-0
          bg-slate-200 dark:bg-neutral-700 bg-none text-lime-500 accent-lime-500
          [&::-moz-progress-bar]:bg-lime-500
          [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:[background:none]
          [&[value]::-webkit-progress-value]:bg-lime-500
          [&[value]::-webkit-progress-value]:transition-[inline-size]
        `}
      />

      <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 shadow-sm">
        <table class="w-full table-auto text-left text-sm">
          <thead class="border-b border-slate-200 dark:border-neutral-800 bg-slate-100/80 dark:bg-neutral-850/80 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
            <tr>
              <th class="p-4">Converted File Name</th>
              <th class="p-4">Status</th>
              <th class="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-neutral-800/80">
            {files.map((file) => {
              const isFailed = ["Failed, check logs", "File type not supported"].includes(file.status);
              const isDone = file.status === "Done";

              return (
                <tr class="hover:bg-slate-100/50 dark:hover:bg-neutral-800/40 transition-colors">
                  <td safe class="p-4 font-medium text-slate-900 dark:text-white max-w-[28vw] truncate" title={file.output_file_name}>
                    {file.output_file_name}
                  </td>
                  <td class="p-4">
                    {isDone ? (
                      <span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        ✓ Ready
                      </span>
                    ) : isFailed ? (
                      <span class="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20" title={file.status}>
                        ✕ Failed
                      </span>
                    ) : (
                      <span class="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        ⏳ {file.status}
                      </span>
                    )}
                  </td>
                  <td class="p-4 text-right">
                    {isFailed ? (
                      <span class="text-xs text-slate-400 dark:text-neutral-500">Unavailable</span>
                    ) : (
                      <div class="inline-flex items-center justify-end gap-2">
                        <a
                          class="inline-flex size-8 items-center justify-center rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 transition-colors"
                          href={buildDownloadUrl(WEBROOT, outputPath, file.output_file_name)}
                          target="_blank"
                          title="Preview"
                        >
                          <EyeIcon />
                        </a>
                        <a
                          class="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent-500 to-lime-400 px-3 py-1.5 text-xs font-bold text-neutral-950 shadow hover:from-accent-400 hover:to-lime-300 transition-all cursor-pointer"
                          href={buildDownloadUrl(WEBROOT, outputPath, file.output_file_name)}
                          download={file.output_file_name}
                          title={`Download ${file.output_file_name}`}
                        >
                          <DownloadIcon /> <span>Download</span>
                        </a>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export const results = new Elysia()
  .use(userService)
  .get(
    "/results/:jobId",
    async ({ params, set, cookie: { job_id }, user }) => {
      if (job_id?.value) {
        // Clear the job_id cookie since we are viewing the results
        job_id.remove();
      }

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
        <BaseHtml webroot={WEBROOT} title="ConvertX | Result">
          <>
            <Header
              webroot={WEBROOT}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              loggedIn
              branding={BRANDING}
            />
            <main
              class={`
                w-full flex-1 px-2
                sm:px-4
              `}
            >
              <ResultsArticle job={job} files={files} outputPath={outputPath} />
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
    async ({ set, params, cookie: { job_id }, user }) => {
      if (job_id?.value) {
        // Clear the job_id cookie since we are viewing the results
        job_id.remove();
      }

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

      return <ResultsArticle job={job} files={files} outputPath={outputPath} />;
    },
    { auth: true },
  );
