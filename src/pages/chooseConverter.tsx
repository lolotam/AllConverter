import Elysia, { t } from "elysia";
import { onlyAvailable } from "../converters/availability";
import { getPossibleTargets } from "../converters/main";
import { userService } from "./user";

const POPULAR_FORMATS = [
  "pdf", "mp4", "mp3", "jpg", "png", "docx", "webp", "epub", "xlsx", "csv", "wav", "gif", "txt", "zip"
];

export const chooseConverter = new Elysia().use(userService).post(
  "/conversions",
  ({ body }) => {
    const possibleTargets = onlyAvailable(getPossibleTargets(body.fileType));
    const allUniqueTargets = Array.from(new Set(Object.values(possibleTargets).flat()));
    const popularTargets = POPULAR_FORMATS.filter((p) => allUniqueTargets.includes(p));

    return (
      <>
        <article
          class={`
            convert_to_popup absolute z-20 mt-2 m-0 hidden h-[32vh] max-h-[50vh] w-full flex-col
            overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl p-2
            dark:border-neutral-700/80 dark:bg-neutral-850 dark:text-neutral-100
          `}
        >
          {/* Recently Used Formats Group (Populated via JS) */}
          <article
            id="recent-formats-group"
            class="convert_to_group hidden w-full flex-col border-b border-slate-200 dark:border-neutral-700/60 p-3 bg-blue-500/5 dark:bg-blue-500/10 rounded-lg mb-1"
            data-converter="🕒 Recent Formats"
          >
            <header class="mb-2 w-full text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <span>🕒</span> Recently Used (المستخدمة مؤخراً)
            </header>
            <ul id="recent-formats-list" class="convert_to_target flex flex-row flex-wrap gap-1.5" />
          </article>

          {/* Popular Formats Group */}
          {popularTargets.length > 0 && (
            <article
              class="convert_to_group flex w-full flex-col border-b border-slate-200 dark:border-neutral-700/60 p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-lg mb-1"
              data-converter="🔥 Popular Formats"
            >
              <header class="mb-2 w-full text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span>🔥</span> Popular Formats (الأكثر شهرة)
              </header>
              <ul class="convert_to_target flex flex-row flex-wrap gap-1.5">
                {popularTargets.map((target) => {
                  const converterEntry = Object.entries(possibleTargets).find(([_, tList]) => tList.includes(target));
                  const converterName = converterEntry ? converterEntry[0] : "";
                  return (
                    <button
                      tabindex={0}
                      class="target rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-accent-500 hover:text-neutral-950 transition-colors"
                      data-value={`${target},${converterName}`}
                      data-target={target}
                      data-converter={converterName}
                      type="button"
                    >
                      {target.toUpperCase()}
                    </button>
                  );
                })}
              </ul>
            </article>
          )}

          {/* All Converter Groups */}
          {Object.entries(possibleTargets).map(([converter, targets]) => (
            <article
              class="convert_to_group flex w-full flex-col border-b border-slate-100 dark:border-neutral-700/60 p-3 last:border-none"
              data-converter={converter}
            >
              <header class="mb-2 w-full text-xs font-bold uppercase tracking-wider text-lime-600 dark:text-accent-400" safe>
                {converter}
              </header>
              <ul class="convert_to_target flex flex-row flex-wrap gap-1.5">
                {targets.map((target) => (
                  <button
                    tabindex={0}
                    class="target rounded-lg border border-slate-200 bg-slate-100 text-slate-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-accent-500 hover:text-neutral-950 transition-colors"
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

        <select name="convert_to" aria-label="Convert to" required hidden>
          <option selected disabled value="">
            Convert to
          </option>
          {Object.entries(possibleTargets).map(([converter, targets]) => (
            <optgroup label={converter}>
              {targets.map((target) => (
                <option value={`${target},${converter}`} safe>
                  {target}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </>
    );
  },
  { body: t.Object({ fileType: t.String() }) },
);
