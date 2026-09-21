// The insight tabs of the admin dashboard. Kept out of admin.tsx, which is already long.
import type { Analytics, QueueSnapshot, StorageUsage, SystemHealth } from "../services/adminStats";
import { humanBytes, JOB_LIMIT_CHOICES } from "../services/adminStats";
import type { FormatRow } from "../services/features";

const panel = `glass-card p-5`;
const title = `text-body font-bold text-ink`;
const subtle = `text-xs text-ink-muted`;
const th = `px-3 py-2 text-start text-xs font-bold uppercase tracking-wide text-ink-muted`;
const td = `px-3 py-2 text-caption text-ink-body`;

function Bar({ percent, danger }: { percent: number; danger?: boolean | undefined }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div class="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        style={`width: ${width}%`}
        class={`h-full rounded-full ${danger ? "bg-terracotta" : "bg-cta"}`}
      />
    </div>
  );
}

export function StoragePanel({
  usage,
  webroot,
  cleanup,
}: {
  usage: StorageUsage;
  webroot: string;
  cleanup: { enabled: boolean; overrideHours: number | null; choices: number[] };
}) {
  const lowOnSpace = usage.disk !== null && usage.disk.usedPercent >= 80;
  return (
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class={title}>Storage</h2>
          <p class={subtle}>
            <span safe>
              Files are deleted automatically after {usage.retentionDescription}, counted from when
              the conversion started.
            </span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <form method="post" action={`${webroot}/admin/storage/cleanup`}>
            <button type="submit" class="btn-secondary px-4 py-2 text-sm">
              Delete expired now
            </button>
          </form>
          <form
            method="post"
            action={`${webroot}/admin/storage/purge`}
            onsubmit="return confirm('Delete every stored file for every user, including files that have not expired? This cannot be undone.')"
          >
            <button
              type="submit"
              class="rounded-button border border-terracotta/40 bg-terracotta/10 px-4 py-2 text-caption font-bold text-terracotta transition-colors hover:bg-terracotta/20"
            >
              Delete all files now
            </button>
          </form>
        </div>
      </div>

      <div class={panel}>
        <h3 class="mb-1 font-bold text-ink">Automatic deletion</h3>
        <p class={`${subtle} mb-4`}>
          The sweep runs every 15 minutes. Each plan has its own window, or you can set one window
          for everybody.
        </p>
        <form
          method="post"
          action={`${webroot}/admin/storage/schedule`}
          class="flex flex-wrap items-end gap-4"
        >
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-ink">Delete files after</span>
            <select
              name="hours"
              class="rounded-button border border-rule bg-surface p-2.5 text-caption text-ink"
            >
              <option value="" selected={cleanup.overrideHours === null}>
                Each plan's own window
              </option>
              {cleanup.choices.map((hours) => (
                <option value={String(hours)} selected={cleanup.overrideHours === hours}>
                  {hours} hours (everyone)
                </option>
              ))}
            </select>
          </label>
          <label class="flex items-center gap-2 pb-2.5 text-sm">
            <input
              type="checkbox"
              name="enabled"
              value="1"
              checked={cleanup.enabled}
              class="size-4 accent-cta"
            />
            <span class="font-medium text-ink">Delete files automatically</span>
          </label>
          <button type="submit" class="btn-primary px-5 py-2.5 text-sm">
            Save schedule
          </button>
        </form>
        {!cleanup.enabled ? (
          <p class="mt-3 text-sm font-medium text-terracotta">
            Automatic deletion is off. Nothing is removed until you delete it here, and the volume
            will keep filling.
          </p>
        ) : null}
      </div>

      {usage.disk ? (
        <div class={panel}>
          <div class="mb-2 flex items-center justify-between">
            <span class="font-semibold text-ink">Volume</span>
            <span class={subtle}>
              {humanBytes(usage.disk.totalBytes - usage.disk.freeBytes)} of{" "}
              {humanBytes(usage.disk.totalBytes)} used · {humanBytes(usage.disk.freeBytes)} free
            </span>
          </div>
          <Bar percent={usage.disk.usedPercent} danger={lowOnSpace} />
          {lowOnSpace ? (
            <p class="mt-2 text-sm font-medium text-terracotta">
              Less than 20% free. A full volume also stops the database from accepting writes.
            </p>
          ) : null}
        </div>
      ) : null}

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {usage.areas.map((area) => (
          <div class={panel}>
            <p class={subtle} safe>
              {area.name}
            </p>
            <p class="text-heading-sm font-extrabold text-ink">{humanBytes(area.bytes)}</p>
            <p class={subtle}>
              {area.files} file{area.files === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>

      <div class={panel}>
        <h3 class="mb-3 font-bold text-ink">Largest jobs on disk</h3>
        {usage.biggestJobs.length === 0 ? (
          <p class={subtle}>Nothing stored right now.</p>
        ) : (
          <table class="w-full">
            <thead>
              <tr class="border-b border-rule">
                <th class={th}>Job</th>
                <th class={th}>Owner</th>
                <th class={th}>Files</th>
                <th class={th}>Size</th>
              </tr>
            </thead>
            <tbody>
              {usage.biggestJobs.map((job) => (
                <tr class="border-b border-rule">
                  <td class={td}>#{job.jobId}</td>
                  <td class={td}>{job.userId}</td>
                  <td class={td}>{job.files}</td>
                  <td class={td}>{humanBytes(job.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ConversionsPanel({
  snapshot,
  webroot,
}: {
  snapshot: QueueSnapshot;
  webroot: string;
}) {
  const { queue, active, recentJobs, recentFailures, filters, choices } = snapshot;
  const filterField = `rounded-button border border-rule bg-surface px-2 py-1.5 text-caption text-ink`;
  return (
    <div class="space-y-6">
      <div>
        <h2 class={title}>Conversions</h2>
        <p class={subtle}>What the queue is doing now, and how the last jobs went.</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class={panel}>
          <p class={subtle}>Converting now</p>
          <p class="text-heading font-extrabold text-ink">{queue.running}</p>
          <p class={subtle}>of {queue.concurrency} at once</p>
        </div>
        <div class={panel}>
          <p class={subtle}>Waiting in queue</p>
          <p class="text-heading font-extrabold text-ink">{queue.waiting}</p>
          <p class={subtle}>paid plans go first</p>
        </div>
        <div class={panel}>
          <p class={subtle}>Active jobs</p>
          <p class="text-heading font-extrabold text-ink">{active.length}</p>
          <p class={subtle}>with files still moving</p>
        </div>
      </div>

      {active.length > 0 ? (
        <div class={panel}>
          <h3 class="mb-3 font-bold text-ink">In flight</h3>
          <ul class="space-y-2">
            {active.map((job) => (
              <li class="flex items-center justify-between gap-4 text-sm">
                <span class="font-medium text-ink">Job #{job.jobId}</span>
                <span class={subtle}>
                  {job.converting} converting · {job.queued} queued
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div class={panel}>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-bold text-ink">Recent jobs</h3>
          <div id="job-delete-container" class="hidden">
            <button
              type="button"
              id="job-delete-btn"
              class="rounded-button border border-terracotta/40 bg-terracotta/10 px-4 py-2 text-caption font-bold text-terracotta transition-colors hover:bg-terracotta/20"
            >
              Delete selected (<span id="job-selected-count">0</span>)
            </button>
          </div>
        </div>

        {/* GET, so a filtered view can be reloaded, bookmarked or shared */}
        <form
          method="get"
          action={`${webroot}/admin`}
          class="mb-4 flex flex-wrap items-end gap-2 border-b border-rule pb-4"
        >
          <input type="hidden" name="tab" value="conversions" />
          <label class="flex flex-col gap-1 text-xs">
            <span class="font-medium text-ink-muted">Status</span>
            <select name="status" class={filterField}>
              <option value="" selected={!filters.status}>
                Any
              </option>
              <option value="done" selected={filters.status === "done"}>
                No failures
              </option>
              <option value="failed" selected={filters.status === "failed"}>
                Has failures
              </option>
              {choices.statuses.map((status) => (
                <option value={status} selected={filters.status === status} safe>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-xs">
            <span class="font-medium text-ink-muted">To format</span>
            <select name="format" class={filterField}>
              <option value="" selected={!filters.format}>
                Any
              </option>
              {choices.formats.map((format) => (
                <option value={format} selected={filters.format === format} safe>
                  {format}
                </option>
              ))}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-xs">
            <span class="font-medium text-ink-muted">Owner</span>
            <select name="owner" class={filterField}>
              <option value="" selected={!filters.owner}>
                Anyone
              </option>
              {choices.owners.map((owner) => (
                <option value={String(owner)} selected={filters.owner === String(owner)}>
                  {owner}
                </option>
              ))}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-xs">
            <span class="font-medium text-ink-muted">Show</span>
            <select name="limit" class={filterField}>
              {JOB_LIMIT_CHOICES.map((limit) => (
                <option value={String(limit)} selected={filters.limit === limit}>
                  {limit}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" class="btn-secondary px-4 py-2 text-sm">
            Apply
          </button>
          <a href={`${webroot}/admin?tab=conversions`} class={`${subtle} pb-2 hover:underline`}>
            Clear
          </a>
        </form>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-rule">
                <th class={`${th} w-10`}>
                  <input type="checkbox" id="job-select-all" class="size-4 accent-cta" />
                </th>
                <th class={`${th} w-12`}>#</th>
                <th class={th}>Job</th>
                <th class={th}>From</th>
                <th class={th}>To</th>
                <th class={th}>Converter</th>
                <th class={th}>Owner</th>
                <th class={th}>Started</th>
                <th class={th}>Files</th>
                <th class={th}>Failed</th>
                <th class={th}>Status</th>
              </tr>
            </thead>
            {/* Cell styling on the one element rather than on every cell, as in the format
                table: this list goes up to 250 rows of eleven columns. */}
            <tbody
              class={`
                [&_td]:px-3 [&_td]:py-2 [&_td]:text-caption [&_td]:text-ink-body
                [&_td:nth-child(2)]:text-ink-muted
                [&_td:nth-child(4)]:uppercase
                [&_td:nth-child(5)]:font-medium [&_td:nth-child(5)]:uppercase [&_td:nth-child(5)]:text-ink
                [&_tr]:border-b [&_tr]:border-rule
                [&_input]:size-4 [&_input]:accent-cta
              `}
            >
              {recentJobs.length === 0 ? (
                <tr>
                  <td colspan="11">
                    <span class={subtle}>No jobs match these filters.</span>
                  </td>
                </tr>
              ) : (
                recentJobs.map((job, index) => (
                  <tr>
                    <td>
                      <input type="checkbox" data-job-id={String(job.id)} />
                    </td>
                    <td>{index + 1}</td>
                    <td>#{job.id}</td>
                    <td safe>{job.from_format || "—"}</td>
                    <td safe>{job.to_format || "—"}</td>
                    <td safe>{job.converter || "—"}</td>
                    <td>{job.user_id}</td>
                    <td safe>{job.date_created.replace("T", " ").slice(0, 16)}</td>
                    <td>{job.num_files}</td>
                    <td class={job.failed > 0 ? "font-bold text-terracotta" : ""}>{job.failed}</td>
                    <td safe>{job.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <script>
          {`
            (() => {
              const boxes = Array.from(document.querySelectorAll("[data-job-id]"));
              const all = document.getElementById("job-select-all");
              const container = document.getElementById("job-delete-container");
              const button = document.getElementById("job-delete-btn");
              const count = document.getElementById("job-selected-count");
              if (!all || !container || !button || !count) return;

              const selected = () => boxes.filter((box) => box.checked).map((box) => box.dataset.jobId);

              const refresh = () => {
                const chosen = selected();
                count.textContent = String(chosen.length);
                container.classList.toggle("hidden", chosen.length === 0);
              };

              all.addEventListener("change", () => {
                for (const box of boxes) box.checked = all.checked;
                refresh();
              });
              for (const box of boxes) box.addEventListener("change", refresh);

              button.addEventListener("click", async () => {
                const jobIds = selected();
                if (jobIds.length === 0) return;
                if (!confirm("Delete " + jobIds.length + " jobs and every file they produced? This cannot be undone.")) return;

                button.disabled = true;
                button.textContent = "Deleting...";
                try {
                  const response = await fetch("${webroot}/admin/conversions/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jobIds }),
                  });
                  if (!response.ok) throw new Error("Request failed");
                  window.location.reload();
                } catch (error) {
                  button.disabled = false;
                  button.textContent = "Delete failed - try again";
                }
              });

              refresh();
            })();
          `}
        </script>
      </div>
      <div class={panel}>
        <h3 class="mb-3 font-bold text-ink">Recent failures</h3>
        {recentFailures.length === 0 ? (
          <p class={subtle}>No failed conversions recorded.</p>
        ) : (
          <ul class="space-y-2">
            {recentFailures.map((failure) => (
              <li class="flex flex-wrap items-center justify-between gap-2 border-b border-rule py-2">
                <span class="font-medium text-ink" safe>
                  {failure.file_name} → {failure.output_file_name}
                </span>
                <span class="text-terracotta" safe>
                  {failure.status} (job #{String(failure.job_id)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function HealthPanel({ health }: { health: SystemHealth }) {
  const hours = Math.floor(health.uptimeSeconds / 3600);
  const minutes = Math.floor((health.uptimeSeconds % 3600) / 60);
  return (
    <div class="space-y-6">
      <div>
        <h2 class={title}>System health</h2>
        <p class={subtle}>What this running image can actually do.</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class={panel}>
          <p class={subtle}>Uptime</p>
          <p class="text-heading-sm font-extrabold text-ink">
            {hours}h {minutes}m
          </p>
        </div>
        <div class={panel}>
          <p class={subtle}>Bun</p>
          <p class="text-heading-sm font-extrabold text-ink" safe>
            {health.bunVersion}
          </p>
        </div>
        <div class={panel}>
          <p class={subtle}>Database file</p>
          <p class="text-heading-sm font-extrabold text-ink">{humanBytes(health.databaseBytes)}</p>
        </div>
      </div>

      <div class={panel}>
        <h3 class="mb-3 font-bold text-ink">Configuration</h3>
        <ul class="space-y-1.5 text-sm">
          {health.settings.map((setting) => (
            <li class="flex justify-between gap-4 border-b border-rule py-1.5">
              <span class={subtle} safe>
                {setting.label}
              </span>
              <span class="font-medium text-ink" safe>
                {setting.value}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div class={panel}>
        <h3 class="mb-1 font-bold text-ink">Disabled converters</h3>
        <p class={`${subtle} mb-3`}>
          These formats are offered by the code but the tool is missing from the image, so the
          conversion would fail.
        </p>
        {health.missingConverters.length === 0 ? (
          <p class="text-caption font-medium text-ink-body">
            Every converter has its tools installed.
          </p>
        ) : (
          <ul class="grid gap-1.5 text-sm sm:grid-cols-2">
            {health.missingConverters.map((entry) => (
              <li class="flex justify-between gap-3 border-b border-rule py-1.5">
                <span class="font-medium text-ink" safe>
                  {entry.converter}
                </span>
                <span class="text-terracotta" safe>
                  missing {entry.missing.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AnalyticsPanel({ data }: { data: Analytics }) {
  const busiest = Math.max(1, ...data.perDay.map((day) => day.files));
  const topFormat = Math.max(1, ...data.topFormats.map((format) => format.count));
  return (
    <div class="space-y-6">
      <div>
        <h2 class={title}>Usage</h2>
        <p class={subtle}>The last two weeks of conversions.</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class={panel}>
          <p class={subtle}>Files converted</p>
          <p class="text-heading font-extrabold text-ink">
            {data.successRate.done + data.successRate.failed}
          </p>
          <p class={subtle}>{data.successRate.failed} failed</p>
        </div>
        <div class={panel}>
          <p class={subtle}>Success rate</p>
          <p class="text-heading font-extrabold text-ink">{data.successRate.percent}%</p>
          <Bar percent={data.successRate.percent} />
        </div>
        <div class={panel}>
          <p class={subtle}>Who converts</p>
          <p class="text-heading font-extrabold text-ink">
            {data.accountJobs} / {data.guestJobs}
          </p>
          <p class={subtle}>accounts / visitors</p>
        </div>
      </div>

      <div class={panel}>
        <h3 class="mb-3 font-bold text-ink">Conversions per day</h3>
        {data.perDay.length === 0 ? (
          <p class={subtle}>Nothing converted in this period.</p>
        ) : (
          <ul class="space-y-2">
            {data.perDay.map((day) => (
              <li class="flex items-center gap-3 text-sm">
                <span class={`${subtle} w-24 shrink-0`} safe>
                  {day.day}
                </span>
                <span class="flex-1">
                  <Bar percent={(day.files / busiest) * 100} />
                </span>
                <span class="w-24 shrink-0 text-end text-ink-body">
                  {day.files} files · {day.jobs} jobs
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div class={panel}>
        <h3 class="mb-3 font-bold text-ink">Most requested formats</h3>
        {data.topFormats.length === 0 ? (
          <p class={subtle}>No conversions yet.</p>
        ) : (
          <ul class="space-y-2">
            {data.topFormats.map((format) => (
              <li class="flex items-center gap-3 text-sm">
                <span class="w-20 shrink-0 font-bold uppercase text-ink" safe>
                  {format.format || "—"}
                </span>
                <span class="flex-1">
                  <Bar percent={(format.count / topFormat) * 100} />
                </span>
                <span class="w-16 shrink-0 text-end text-ink-body">{format.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SitePanel({
  webroot,
  logoUrl,
  faviconUrl,
  siteName,
  siteTagline,
  formats,
  usage,
}: {
  webroot: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  siteName: string;
  siteTagline: string;
  formats: FormatRow[];
  /** Files produced per format, keyed by lowercase extension. */
  usage: Record<string, number>;
}) {
  const uploadField = `text-caption file:me-3 file:cursor-pointer file:rounded-button file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-caption file:font-semibold file:text-ink`;
  const input = `field text-caption`;
  return (
    <div class="space-y-6">
      <div>
        <h2 class={title}>Site</h2>
        <p class={subtle}>
          Name, artwork and which converters the site offers. Changes apply on the next page load.
        </p>
      </div>
      <div class={panel}>
        <h3 class="mb-3 font-bold text-ink">Name</h3>
        <form
          method="post"
          action={`${webroot}/admin/site/name`}
          class="grid gap-4 sm:grid-cols-2 sm:items-end"
        >
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-ink">Site name</span>
            <input type="text" name="siteName" value={siteName} maxlength="40" class={input} />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-ink">Tagline under the name</span>
            <input
              type="text"
              name="siteTagline"
              value={siteTagline}
              maxlength="30"
              placeholder="e.g. Cloud Pro"
              class={input}
            />
          </label>
          <div class="sm:col-span-2">
            <button type="submit" class="btn-primary px-5 py-2.5 text-sm">
              Save name
            </button>
          </div>
        </form>
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class={panel}>
          <h3 class="mb-3 font-bold text-ink">Logo</h3>
          <div class="mb-4 flex items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Current logo"
                width="48"
                height="48"
                class="size-12 rounded-xl object-contain"
              />
            ) : (
              <span class="flex size-12 items-center justify-center rounded-button bg-frame text-xs font-black text-frame-ink">
                CX
              </span>
            )}
            <p class={subtle}>
              {logoUrl ? "Your logo, shown in the header." : "Using the built-in mark."} PNG, JPEG,
              WebP or GIF, up to 1 MB.
            </p>
          </div>
          <form
            method="post"
            action={`${webroot}/admin/branding/logo`}
            enctype="multipart/form-data"
            class="flex flex-wrap items-center gap-2"
          >
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp,image/gif"
              required
              class={uploadField}
            />
            <button type="submit" class="btn-primary px-4 py-2 text-sm">
              Upload
            </button>
          </form>
          {logoUrl ? (
            <form method="post" action={`${webroot}/admin/branding/logo/delete`} class="mt-2">
              <button type="submit" class="text-xs font-medium text-terracotta hover:underline">
                Use the built-in mark again
              </button>
            </form>
          ) : null}
        </div>

        <div class={panel}>
          <h3 class="mb-3 font-bold text-ink">Favicon</h3>
          <div class="mb-4 flex items-center gap-4">
            {faviconUrl ? (
              <img
                src={faviconUrl}
                alt="Current favicon"
                width="32"
                height="32"
                class="size-8 rounded object-contain"
              />
            ) : (
              <span class="flex size-8 items-center justify-center rounded bg-surface-2 text-[10px] font-bold text-ink-muted">
                ICO
              </span>
            )}
            <p class={subtle}>
              {faviconUrl ? "Your favicon, shown in the browser tab." : "Using the bundled icons."}{" "}
              PNG or ICO, up to 1 MB.
            </p>
          </div>
          <form
            method="post"
            action={`${webroot}/admin/branding/favicon`}
            enctype="multipart/form-data"
            class="flex flex-wrap items-center gap-2"
          >
            <input
              type="file"
              name="image"
              accept="image/png,image/x-icon,.ico"
              required
              class={uploadField}
            />
            <button type="submit" class="btn-primary px-4 py-2 text-sm">
              Upload
            </button>
          </form>
          {faviconUrl ? (
            <form method="post" action={`${webroot}/admin/branding/favicon/delete`} class="mt-2">
              <button type="submit" class="text-xs font-medium text-terracotta hover:underline">
                Use the bundled icons again
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <div class={panel}>
        <h3 class="mb-1 font-bold text-ink">Formats offered</h3>
        <p class={`${subtle} mb-4`}>
          One row per format a customer can convert into. Untick a format and it disappears from the
          landing page, so nobody can start a conversion into it. The converter is yours to choose
          and is never shown to customers — when it cannot read the file somebody uploads, the next
          capable one runs instead. Formats whose tools are missing from the image never appear here
          at all.
        </p>

        <form method="post" action={`${webroot}/admin/site/formats`}>
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              id="format-filter"
              placeholder="Filter by format, category or converter…"
              autocomplete="off"
              class="field w-64 text-caption"
            />
            <span class={subtle}>
              <span id="format-shown" safe>
                {String(formats.length)}
              </span>{" "}
              of {formats.length} formats · {formats.filter((row) => row.visible).length} offered
            </span>
            <div class="ms-auto flex flex-wrap gap-2">
              <button type="submit" class="btn-primary px-4 py-2 text-sm">
                Save formats
              </button>
              <button type="submit" name="all" value="1" class="btn-secondary px-4 py-2 text-sm">
                Offer every format
              </button>
            </div>
          </div>

          <div class="max-h-[32rem] overflow-auto rounded-card border border-rule">
            <table class="w-full" id="format-table">
              <thead class="sticky top-0 z-10 bg-surface">
                <tr class="border-b border-rule">
                  <th class={`${th} w-12`}>#</th>
                  <th class={th}>Format</th>
                  <th class={th}>Category</th>
                  <th class={th}>Accepted formats</th>
                  <th class={th}>Converter</th>
                  <th class={`${th} text-end`}>Usage</th>
                  <th class={`${th} text-end`}>
                    <label class="flex items-center justify-end gap-2">
                      <span>Offered</span>
                      <input type="checkbox" id="format-all" class="size-4 accent-cta" />
                    </label>
                  </th>
                </tr>
              </thead>
              {/* Every cell's styling lives here, on the one element, instead of being
                  repeated as a class attribute on all 3,500 of them. Same idiom as the
                  history and landing-page tables; it is what keeps this page a sane size
                  once a full image offers 500-odd formats. */}
              <tbody
                class={`
                  [&_td]:px-3 [&_td]:py-2 [&_td]:text-caption [&_td]:text-ink-body
                  [&_td:nth-child(1)]:text-ink-muted
                  [&_td:nth-child(2)]:font-bold [&_td:nth-child(2)]:uppercase [&_td:nth-child(2)]:text-ink
                  [&_td:nth-child(4)]:max-w-xs
                  [&_td:nth-child(6)]:text-end [&_td:nth-child(6)]:tabular-nums
                  [&_td:nth-child(7)]:text-end
                  [&_tr]:border-b [&_tr]:border-rule [&_tr]:last:border-none
                  [&_tr]:hover:bg-surface-2
                  [&_input]:size-4 [&_input]:accent-cta
                  [&_select]:rounded-button [&_select]:border [&_select]:border-rule
                  [&_select]:bg-surface [&_select]:px-2 [&_select]:py-1 [&_select]:text-xs
                  [&_select]:text-ink
                `}
              >
                {/* The rows carry no data-search attribute: the format, category and
                    converter are already in the cells, and repeating them 507 times is pure
                    weight. The filter reads them off the cells instead. */}
                {formats.map((row, index) => (
                  <tr data-format-row>
                    <td>{index + 1}</td>
                    <td safe>{row.label}</td>
                    <td>{row.category}</td>
                    <td>
                      {row.accepts.length === 0 ? (
                        <span class={subtle}>none</span>
                      ) : (
                        <span safe>
                          {`${row.accepts.length} (${row.accepts.slice(0, 4).join(", ")}${
                            row.accepts.length > 4 ? `, +${row.accepts.length - 4}` : ""
                          })`}
                        </span>
                      )}
                    </td>
                    <td>
                      {row.converters.length === 1 ? (
                        <span safe>{row.converter}</span>
                      ) : (
                        <select name={`converter.${row.format}`}>
                          {row.converters.map((converter) => (
                            <option value={converter} selected={converter === row.converter} safe>
                              {converter}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>{usage[row.label] ? String(usage[row.label]) : "—"}</td>
                    <td>
                      <input
                        type="checkbox"
                        name="format"
                        value={row.format}
                        checked={row.visible}
                        data-format-offered
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <script>
          {`
            (() => {
              const filter = document.getElementById("format-filter");
              const all = document.getElementById("format-all");
              const shown = document.getElementById("format-shown");
              const rows = Array.from(document.querySelectorAll("[data-format-row]"));
              if (!filter || !all || !rows.length) return;

              // Format, category and converter — not the accepted-formats cell, where
              // nearly every row lists nearly every extension and would match anything
              const keys = rows.map((row) =>
                [row.cells[1], row.cells[2], row.cells[4]]
                  .map((cell) => (cell ? cell.textContent : ""))
                  .join(" ")
                  .toLowerCase(),
              );

              const visibleRows = () => rows.filter((row) => !row.classList.contains("hidden"));

              filter.addEventListener("input", () => {
                const search = filter.value.trim().toLowerCase();
                rows.forEach((row, index) => {
                  row.classList.toggle("hidden", search !== "" && !keys[index].includes(search));
                });
                if (shown) shown.textContent = String(visibleRows().length);
              });

              // Ticking the header box applies to what is on screen, so it works with a filter
              all.addEventListener("change", () => {
                for (const row of visibleRows()) {
                  const box = row.querySelector("[data-format-offered]");
                  if (box) box.checked = all.checked;
                }
              });
            })();
          `}
        </script>
      </div>{" "}
    </div>
  );
}
