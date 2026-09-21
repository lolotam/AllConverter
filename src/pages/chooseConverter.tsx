import Elysia, { t } from "elysia";
import { onlyAvailable } from "../converters/availability";
import { visibleTargets } from "../services/features";
import { getPossibleTargets } from "../converters/main";
import { userService } from "./user";

const POPULAR_FORMATS = [
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
  "wav",
  "gif",
  "txt",
  "zip",
];

export const chooseConverter = new Elysia().use(userService).post(
  "/conversions",
  ({ body }) => {
    const possibleTargets = visibleTargets(onlyAvailable(getPossibleTargets(body.fileType)));
    const allUniqueTargets = Array.from(new Set(Object.values(possibleTargets).flat()));
    const popularTargets = POPULAR_FORMATS.filter((p) => allUniqueTargets.includes(p));

    return (
      <>
        <article
          class={`
            convert_to_popup absolute z-20 mt-2 m-0 hidden h-[32vh] max-h-[50vh] w-full flex-col
            overflow-x-hidden overflow-y-auto rounded-card border border-rule bg-surface p-2 text-ink-body shadow-lg
          `}
        >
          {/* Recently Used Formats Group (Populated via JS) */}
          <article
            id="recent-formats-group"
            class="convert_to_group mb-1 hidden w-full flex-col rounded-card border-b border-rule bg-sky/25 p-3"
            data-converter="🕒 Recent Formats"
          >
            <header class="mb-2 flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <span>🕒</span> Recently Used (المستخدمة مؤخراً)
            </header>
            <ul
              id="recent-formats-list"
              class="convert_to_target flex flex-row flex-wrap gap-1.5"
            />
          </article>

          {/* Popular Formats Group */}
          {popularTargets.length > 0 && (
            <article
              class="convert_to_group mb-1 flex w-full flex-col rounded-card border-b border-rule bg-marigold/20 p-3"
              data-converter="🔥 Popular Formats"
            >
              <header class="mb-2 flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <span>🔥</span> Popular Formats (الأكثر شهرة)
              </header>
              <ul class="convert_to_target flex flex-row flex-wrap gap-1.5">
                {popularTargets.map((target) => {
                  const converterEntry = Object.entries(possibleTargets).find(([_, tList]) =>
                    tList.includes(target),
                  );
                  const converterName = converterEntry ? converterEntry[0] : "";
                  return (
                    <button
                      tabindex={0}
                      class="target rounded-tag border border-rule bg-surface px-3 py-1 text-xs font-semibold text-ink transition-colors hover:bg-cta hover:text-cta-ink"
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
              class="convert_to_group flex w-full flex-col border-b border-rule p-3 last:border-none"
              data-converter={converter}
            >
              <header
                class="mb-2 w-full text-xs font-semibold uppercase tracking-wider text-ink-muted"
                safe
              >
                {converter}
              </header>
              <ul class="convert_to_target flex flex-row flex-wrap gap-1.5">
                {targets.map((target) => (
                  <button
                    tabindex={0}
                    class="target rounded-tag border border-rule bg-surface-2 px-3 py-1 text-xs font-medium text-ink-body transition-colors hover:bg-cta hover:text-cta-ink"
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
