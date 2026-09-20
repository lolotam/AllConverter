// The insight tabs of the admin dashboard. Kept out of admin.tsx, which is already long.
import type { Analytics, QueueSnapshot, StorageUsage, SystemHealth } from "../services/adminStats";
import { humanBytes } from "../services/adminStats";

const panel = `rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900`;
const title = `text-lg font-bold text-slate-900 dark:text-white`;
const subtle = `text-xs text-slate-500 dark:text-neutral-400`;
const th = `px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400`;
const td = `px-3 py-2 text-sm text-slate-700 dark:text-neutral-200`;

function Bar({ percent, danger }: { percent: number; danger?: boolean | undefined }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-800">
      <div
        style={`width: ${width}%`}
        class={`h-full rounded-full ${danger ? "bg-rose-500" : "bg-gradient-to-r from-accent-500 to-lime-400"}`}
      />
    </div>
  );
}

export function StoragePanel({ usage, webroot }: { usage: StorageUsage; webroot: string }) {
  const lowOnSpace = usage.disk !== null && usage.disk.usedPercent >= 80;
  return (
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class={title}>Storage</h2>
          <p class={subtle}>
            Files are deleted automatically {usage.retentionHours} hours after a conversion starts.
          </p>
        </div>
        <form method="post" action={`${webroot}/admin/storage/cleanup`}>
          <button type="submit" class="btn-secondary px-4 py-2 text-sm">
            Run cleanup now
          </button>
        </form>
      </div>

      {usage.disk ? (
        <div class={panel}>
          <div class="mb-2 flex items-center justify-between">
            <span class="font-semibold text-slate-900 dark:text-white">Volume</span>
            <span class={subtle}>
              {humanBytes(usage.disk.totalBytes - usage.disk.freeBytes)} of{" "}
              {humanBytes(usage.disk.totalBytes)} used · {humanBytes(usage.disk.freeBytes)} free
            </span>
          </div>
          <Bar percent={usage.disk.usedPercent} danger={lowOnSpace} />
          {lowOnSpace ? (
            <p class="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">
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
            <p class="text-2xl font-extrabold text-slate-900 dark:text-white">
              {humanBytes(area.bytes)}
            </p>
            <p class={subtle}>
              {area.files} file{area.files === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>

      <div class={panel}>
        <h3 class="mb-3 font-bold text-slate-900 dark:text-white">Largest jobs on disk</h3>
        {usage.biggestJobs.length === 0 ? (
          <p class={subtle}>Nothing stored right now.</p>
        ) : (
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-200 dark:border-neutral-800">
                <th class={th}>Job</th>
                <th class={th}>Owner</th>
                <th class={th}>Files</th>
                <th class={th}>Size</th>
              </tr>
            </thead>
            <tbody>
              {usage.biggestJobs.map((job) => (
                <tr class="border-b border-slate-100 dark:border-neutral-800/60">
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
          <p class="text-3xl font-extrabold text-slate-900 dark:text-white">{queue.running}</p>
          <p class={subtle}>of {queue.concurrency} at once</p>
        </div>
        <div class={panel}>
          <p class={subtle}>Waiting in queue</p>
          <p class="text-3xl font-extrabold text-slate-900 dark:text-white">{queue.waiting}</p>
          <p class={subtle}>paid plans go first</p>
        </div>
        <div class={panel}>
          <p class={subtle}>Active jobs</p>
          <p class="text-3xl font-extrabold text-slate-900 dark:text-white">{active.length}</p>
          <p class={subtle}>with files still moving</p>
        </div>
      </div>

      {active.length > 0 ? (
        <div class={panel}>
          <h3 class="mb-3 font-bold text-slate-900 dark:text-white">In flight</h3>
          <ul class="space-y-2">
            {active.map((job) => (
              <li class="flex items-center justify-between gap-4 text-sm">
                <span class="font-medium text-slate-900 dark:text-white">Job #{job.jobId}</span>
                <span class={subtle}>
                  {job.converting} converting · {job.queued} queued
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div class={panel}>
        <h3 class="mb-3 font-bold text-slate-900 dark:text-white">Recent jobs</h3>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-200 dark:border-neutral-800">
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
                <tr class="border-b border-slate-100 dark:border-neutral-800/60">
                  <td class={td}>#{job.id}</td>
                  <td class={td}>{job.user_id}</td>
                  <td class={td} safe>
                    {job.date_created.replace("T", " ").slice(0, 16)}
                  </td>
                  <td class={td}>{job.num_files}</td>
                  <td
                    class={`${td} ${job.failed > 0 ? "font-bold text-rose-600 dark:text-rose-400" : ""}`}
                  >
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
        <h3 class="mb-3 font-bold text-slate-900 dark:text-white">Recent failures</h3>
        {recentFailures.length === 0 ? (
          <p class={subtle}>No failed conversions recorded.</p>
        ) : (
          <ul class="space-y-2">
            {recentFailures.map((failure) => (
              <li class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm dark:border-neutral-800/60">
                <span class="font-medium text-slate-900 dark:text-white" safe>
                  {failure.file_name} → {failure.output_file_name}
                </span>
                <span class="text-rose-600 dark:text-rose-400" safe>
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
          <p class="text-2xl font-extrabold text-slate-900 dark:text-white">
            {hours}h {minutes}m
          </p>
        </div>
        <div class={panel}>
          <p class={subtle}>Bun</p>
          <p class="text-2xl font-extrabold text-slate-900 dark:text-white" safe>
            {health.bunVersion}
          </p>
        </div>
        <div class={panel}>
          <p class={subtle}>Database file</p>
          <p class="text-2xl font-extrabold text-slate-900 dark:text-white">
            {humanBytes(health.databaseBytes)}
          </p>
        </div>
      </div>

      <div class={panel}>
        <h3 class="mb-3 font-bold text-slate-900 dark:text-white">Configuration</h3>
        <ul class="space-y-1.5 text-sm">
          {health.settings.map((setting) => (
            <li class="flex justify-between gap-4 border-b border-slate-100 py-1.5 dark:border-neutral-800/60">
              <span class={subtle} safe>
                {setting.label}
              </span>
              <span class="font-medium text-slate-900 dark:text-white" safe>
                {setting.value}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div class={panel}>
        <h3 class="mb-1 font-bold text-slate-900 dark:text-white">Disabled converters</h3>
        <p class={`${subtle} mb-3`}>
          These formats are offered by the code but the tool is missing from the image, so the
          conversion would fail.
        </p>
        {health.missingConverters.length === 0 ? (
          <p class="text-sm font-medium text-lime-700 dark:text-accent-400">
            Every converter has its tools installed.
          </p>
        ) : (
          <ul class="grid gap-1.5 text-sm sm:grid-cols-2">
            {health.missingConverters.map((entry) => (
              <li class="flex justify-between gap-3 border-b border-slate-100 py-1.5 dark:border-neutral-800/60">
                <span class="font-medium text-slate-900 dark:text-white" safe>
                  {entry.converter}
                </span>
                <span class="text-rose-600 dark:text-rose-400" safe>
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
          <p class="text-3xl font-extrabold text-slate-900 dark:text-white">
            {data.successRate.done + data.successRate.failed}
          </p>
          <p class={subtle}>{data.successRate.failed} failed</p>
        </div>
        <div class={panel}>
          <p class={subtle}>Success rate</p>
          <p class="text-3xl font-extrabold text-lime-600 dark:text-accent-400">
            {data.successRate.percent}%
          </p>
          <Bar percent={data.successRate.percent} />
        </div>
        <div class={panel}>
          <p class={subtle}>Who converts</p>
          <p class="text-3xl font-extrabold text-slate-900 dark:text-white">
            {data.accountJobs} / {data.guestJobs}
          </p>
          <p class={subtle}>accounts / visitors</p>
        </div>
      </div>

      <div class={panel}>
        <h3 class="mb-3 font-bold text-slate-900 dark:text-white">Conversions per day</h3>
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
                <span class="w-24 shrink-0 text-right text-slate-700 dark:text-neutral-200">
                  {day.files} files · {day.jobs} jobs
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div class={panel}>
        <h3 class="mb-3 font-bold text-slate-900 dark:text-white">Most requested formats</h3>
        {data.topFormats.length === 0 ? (
          <p class={subtle}>No conversions yet.</p>
        ) : (
          <ul class="space-y-2">
            {data.topFormats.map((format) => (
              <li class="flex items-center gap-3 text-sm">
                <span class="w-20 shrink-0 font-bold uppercase text-slate-900 dark:text-white" safe>
                  {format.format || "—"}
                </span>
                <span class="flex-1">
                  <Bar percent={(format.count / topFormat) * 100} />
                </span>
                <span class="w-16 shrink-0 text-right text-slate-700 dark:text-neutral-200">
                  {format.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
