// The insight tabs of the admin dashboard. Kept out of admin.tsx, which is already long.
import type { Analytics, QueueSnapshot, StorageUsage, SystemHealth } from "../services/adminStats";
import { humanBytes } from "../services/adminStats";

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

export function ConversionsPanel({ snapshot }: { snapshot: QueueSnapshot }) {
  const { queue, active, recentJobs, recentFailures } = snapshot;
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
        <h3 class="mb-3 font-bold text-ink">Recent jobs</h3>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-rule">
                <th class={th}>Job</th>
                <th class={th}>Owner</th>
                <th class={th}>Started</th>
                <th class={th}>Files</th>
                <th class={th}>Failed</th>
                <th class={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr class="border-b border-rule">
                  <td class={td}>#{job.id}</td>
                  <td class={td}>{job.user_id}</td>
                  <td class={td} safe>
                    {job.date_created.replace("T", " ").slice(0, 16)}
                  </td>
                  <td class={td}>{job.num_files}</td>
                  <td class={`${td} ${job.failed > 0 ? "font-bold text-terracotta" : ""}`}>
                    {job.failed}
                  </td>
                  <td class={td} safe>
                    {job.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  converters,
}: {
  webroot: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  siteName: string;
  siteTagline: string;
  converters: { name: string; visible: boolean; formats: { format: string; visible: boolean }[] }[];
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
        <h3 class="mb-1 font-bold text-ink">Converters offered</h3>
        <p class={`${subtle} mb-4`}>
          Open a converter to choose which of its formats the site offers. A format you untick
          disappears from the landing page and the converter chooser, so nobody can start a
          conversion into it. Converters whose tools are missing from the image never appear here at
          all.
        </p>

        <div class="space-y-2">
          {converters.map((converter) => {
            const shown = converter.formats.filter((format) => format.visible).length;
            return (
              <details class="group rounded-card border border-rule">
                <summary class="flex cursor-pointer list-none items-center gap-3 p-3 text-caption hover:bg-surface-2">
                  <span
                    class={`size-2.5 shrink-0 rounded-full ${converter.visible ? "bg-cta" : "bg-rule"}`}
                  />
                  <span class="font-bold text-ink" safe>
                    {converter.name}
                  </span>
                  <span class={subtle}>
                    {converter.visible
                      ? `${shown} of ${converter.formats.length} formats offered`
                      : "switched off"}
                  </span>
                  <span class={`${subtle} ml-auto group-open:hidden`}>Open</span>
                </summary>

                <form
                  method="post"
                  action={`${webroot}/admin/features/${converter.name}`}
                  class="border-t border-rule p-3"
                >
                  <div class="mb-3 flex flex-wrap items-center gap-4">
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="converterVisible"
                        value="1"
                        checked={converter.visible}
                        class="size-4 accent-cta"
                      />
                      <span class="font-medium text-ink">Offer this converter</span>
                    </label>
                    <span class={subtle}>
                      Tick the formats to offer. Unticking them all switches the converter off.
                    </span>
                  </div>

                  <div class="max-h-72 overflow-y-auto rounded-button border border-rule p-2">
                    <div class="grid gap-1 sm:grid-cols-3 lg:grid-cols-5">
                      {converter.formats.map((format) => (
                        <label class="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-surface-2">
                          <input
                            type="checkbox"
                            name="format"
                            value={format.format}
                            checked={format.visible}
                            class="size-3.5 accent-cta"
                          />
                          <span class="truncate text-ink-body" safe>
                            {format.format}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div class="mt-3 flex flex-wrap gap-2">
                    <button type="submit" class="btn-primary px-4 py-2 text-sm">
                      Save {converter.name}
                    </button>
                    <button
                      type="submit"
                      name="all"
                      value="1"
                      class="btn-secondary px-4 py-2 text-sm"
                    >
                      Offer every format
                    </button>
                  </div>
                </form>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}
