import { Elysia } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import { headerAccount } from "../helpers/headerUser";
import db from "../db/db";
import { Filename, Jobs } from "../db/types";
import {
  ALLOW_UNAUTHENTICATED,
  HIDE_HISTORY,
  LANGUAGE,
  TIMEZONE,
  WEBROOT,
  BRANDING,
} from "../helpers/env";
import { userService } from "./user";
import { localeFromRequest, t as tr } from "../i18n";
import { EyeIcon } from "../icons/eye";
import { DeleteIcon } from "../icons/delete";

export const history = new Elysia().use(userService).get(
  "/history",
  async ({ redirect, request, cookie: { lang }, user }) => {
    if (HIDE_HISTORY) {
      return redirect(`${WEBROOT}/`, 302);
    }

    if (!user) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    const locale = localeFromRequest(request, lang?.value);
    let userJobs = db.query("SELECT * FROM jobs WHERE user_id = ?").as(Jobs).all(user.id).reverse();

    for (const job of userJobs) {
      const files = db.query("SELECT * FROM file_names WHERE job_id = ?").as(Filename).all(job.id);

      job.finished_files = files.length;
      job.files_detailed = files;
    }

    // Filter out jobs with no files
    userJobs = userJobs.filter((job) => job.num_files > 0);

    return (
      <BaseHtml webroot={WEBROOT} title="ConvertX | Results" locale={locale}>
        <>
          <Header
            webroot={WEBROOT}
            locale={locale}
            branding={BRANDING}
            allowUnauthenticated={ALLOW_UNAUTHENTICATED}
            hideHistory={HIDE_HISTORY}
            loggedIn
            {...headerAccount(user.id)}
          />
          <main
            class={`
              w-full flex-1 px-2
              sm:px-4
            `}
          >
            <article class="article">
              <div class="mb-4 flex items-center justify-between">
                <h1 class="text-subheading font-bold text-ink">{tr(locale, "history.title")}</h1>
                <div id="delete-selected-container">
                  <button
                    id="delete-selected-btn"
                    class={`
                      flex btn-secondary flex-row gap-2
                      disabled:cursor-not-allowed disabled:opacity-50
                    `}
                    disabled
                  >
                    <DeleteIcon />{" "}
                    <span>
                      {tr(locale, "history.deleteSelectedLabel")} (
                      <span id="selected-count">0</span>)
                    </span>
                  </button>
                </div>
              </div>
              <table
                class={`
                  w-full table-auto overflow-y-auto rounded-card bg-surface-2 text-start
                  [&_td]:p-4
                  [&_tr]:rounded-sm [&_tr]:border-b [&_tr]:border-rule
                `}
              >
                <thead>
                  <tr>
                    <th
                      class={`
                        p-2
                        sm:px-4
                      `}
                    >
                      <input
                        type="checkbox"
                        id="select-all"
                        class="size-4 cursor-pointer"
                        title={tr(locale, "history.selectAll")}
                      />
                    </th>
                    <th
                      class={`
                        p-2
                        sm:px-4
                      `}
                    >
                      <span class="sr-only">{tr(locale, "history.expandDetails")}</span>
                    </th>
                    <th
                      class={`
                        p-2
                        sm:px-4
                      `}
                    >
                      {tr(locale, "history.time")}
                    </th>
                    <th
                      class={`
                        p-2
                        sm:px-4
                      `}
                    >
                      {tr(locale, "history.files")}
                    </th>
                    <th
                      class={`
                        p-2
                        max-sm:hidden
                        sm:px-4
                      `}
                    >
                      {tr(locale, "history.filesDone")}
                    </th>
                    <th
                      class={`
                        p-2
                        sm:px-4
                      `}
                    >
                      {tr(locale, "history.status")}
                    </th>
                    <th
                      class={`
                        p-2
                        sm:px-4
                      `}
                    >
                      {tr(locale, "history.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userJobs.map((job) => (
                    <>
                      <tr id={`job-row-${job.id}`}>
                        <td>
                          <input
                            type="checkbox"
                            class="size-4 cursor-pointer"
                            data-checkbox-type="job"
                            data-job-id={job.id}
                          />
                        </td>
                        <td class="job-details-toggle cursor-pointer" data-job-id={job.id}>
                          <svg
                            id={`arrow-${job.id}`}
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="inline-block size-4"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M8.25 4.5l7.5 7.5-7.5 7.5"
                            />
                          </svg>
                        </td>
                        <td safe>
                          {new Date(job.date_created).toLocaleTimeString(LANGUAGE, {
                            timeZone: TIMEZONE,
                          })}
                        </td>
                        <td>{job.num_files}</td>
                        <td class="max-sm:hidden">{job.finished_files}</td>
                        <td safe>{job.status}</td>
                        <td class="flex flex-row gap-4">
                          <a
                            class="text-link hover:underline"
                            href={`${WEBROOT}/results/${job.id}`}
                          >
                            <EyeIcon />
                          </a>
                          <form action={`${WEBROOT}/delete/${job.id}`} method="POST" class="inline">
                            <button type="submit" class="text-terracotta hover:underline">
                              <DeleteIcon />
                            </button>
                          </form>
                        </td>
                      </tr>
                      <tr id={`details-${job.id}`} class="hidden">
                        <td colspan="7">
                          <div class="p-2 text-caption text-ink-muted">
                            <div class="mb-1 font-semibold">
                              {tr(locale, "history.detailedInfo")}
                            </div>
                            {job.files_detailed.map((file: Filename) => (
                              <div class="flex items-center">
                                <span class="w-5/12 truncate" title={file.file_name} safe>
                                  {file.file_name}
                                </span>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  class={`mx-2 inline-block size-4 text-ink-muted`}
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                <span class="w-5/12 truncate" title={file.output_file_name} safe>
                                  {file.output_file_name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </article>
          </main>
          <script>
            {`
              const i18n = ${JSON.stringify({
                confirmDelete: tr(locale, "history.confirmDelete"),
                deletedOk: tr(locale, "history.deletedOk"),
                deletedSomeFailed: tr(locale, "history.deletedSomeFailed"),
                deletedFail: tr(locale, "history.deletedFail"),
                deletedError: tr(locale, "history.deletedError"),
              })};

              document.addEventListener('DOMContentLoaded', () => {
                // Expand/collapse job details
                const toggles = document.querySelectorAll('.job-details-toggle');
                toggles.forEach(toggle => {
                  toggle.addEventListener('click', function() {
                    const jobId = this.dataset.jobId;
                    const detailsRow = document.getElementById(\`details-\${jobId}\`);
                    const arrow = document.getElementById(\`arrow-\${jobId}\`);

                    if (detailsRow && arrow) {
                      detailsRow.classList.toggle("hidden");
                      if (detailsRow.classList.contains("hidden")) {
                        arrow.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />';
                      } else {
                        arrow.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />';
                      }
                    }
                  });
                });

                // Checkbox management
                const selectAllCheckbox = document.getElementById('select-all');
                const jobCheckboxes = document.querySelectorAll('[data-checkbox-type="job"]');
                const deleteSelectedBtn = document.getElementById('delete-selected-btn');
                const deleteSelectedContainer = document.getElementById('delete-selected-container');
                const selectedCountSpan = document.getElementById('selected-count');

                function updateDeleteButton() {
                  const checkedBoxes = Array.from(jobCheckboxes).filter(cb => cb.checked);
                  if (checkedBoxes.length > 0) {
                    deleteSelectedBtn.disabled = false;
                    selectedCountSpan.textContent = checkedBoxes.length;
                  } else {
                    deleteSelectedBtn.disabled = true;
                    selectedCountSpan.textContent = '0';
                  }
                }

                selectAllCheckbox?.addEventListener('change', function() {
                  jobCheckboxes.forEach(checkbox => {
                    checkbox.checked = this.checked;
                  });
                  updateDeleteButton();
                });

                jobCheckboxes.forEach(checkbox => {
                  checkbox.addEventListener('change', function() {
                    const allChecked = Array.from(jobCheckboxes).every(cb => cb.checked);
                    const someChecked = Array.from(jobCheckboxes).some(cb => cb.checked);
                    if (selectAllCheckbox) {
                      selectAllCheckbox.checked = allChecked;
                      selectAllCheckbox.indeterminate = someChecked && !allChecked;
                    }
                    updateDeleteButton();
                  });
                });

                deleteSelectedBtn?.addEventListener('click', async function() {
                  const checkedBoxes = Array.from(jobCheckboxes).filter(cb => cb.checked);
                  const jobIds = checkedBoxes.map(cb => cb.dataset.jobId);

                  if (jobIds.length === 0) return;

                  const confirmed = confirm(i18n.confirmDelete.replace("{count}", jobIds.length));
                  if (!confirmed) return;

                  try {
                    const response = await fetch('${WEBROOT}/delete-multiple', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ jobIds }),
                    });

                    if (!response.ok) {
                      throw new Error(\`HTTP error! status: \${response.status}\`);
                    }

                    const result = await response.json();

                    if (result.success || result.deleted > 0) {
                      alert(
                        i18n.deletedOk.replace("{count}", result.deleted) +
                          (result.failed > 0
                            ? i18n.deletedSomeFailed.replace("{count}", result.failed)
                            : ''),
                      );
                      window.location.reload();
                    } else {
                      alert(i18n.deletedFail);
                    }
                  } catch (error) {
                    console.error('Error deleting jobs:', error);
                    alert(i18n.deletedError);
                  }
                });
              });
            `}
          </script>
        </>
      </BaseHtml>
    );
  },
  {
    auth: true,
  },
);
