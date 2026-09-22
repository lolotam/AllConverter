import Elysia, { t } from "elysia";
import { onlyAvailable } from "../converters/availability";
import { categoryOf, groupByCategory } from "../converters/categories";
import { formatLabel, resolveConverter, visibleTargets } from "../services/features";
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

    // A format is offered once — not once per tool that happens to produce it, and not
    // once per spelling either: a converter listing both jpg and jpeg means one conversion,
    // so the names are canonicalised before deduplicating and shown as the familiar
    // extension. Which tool runs is the admin's call, resolved here so the customer never
    // sees a converter name.
    const formats = [...new Set(Object.values(possibleTargets).flat().map(formatLabel))]
      .map((format) => ({
        format,
        converter: resolveConverter(body.fileType, format) ?? "",
      }))
      .filter((entry) => entry.converter !== "")
      .sort((a, b) => a.format.localeCompare(b.format));

    const byCategory = groupByCategory(formats, (entry) => categoryOf(entry.format));
    const popularTargets = POPULAR_FORMATS.map((popular) =>
      formats.find((entry) => entry.format === popular),
    ).filter((entry): entry is (typeof formats)[number] => entry !== undefined);

    return (
      <>
        <article
          class={`
            convert_to_popup absolute z-20 m-0 mt-2 hidden h-[32vh] max-h-[50vh] w-full flex-col
            overflow-x-hidden overflow-y-auto rounded-card border border-rule bg-surface p-2 text-ink-body shadow-lg
          `}
        >
          {/* Recently Used Formats Group (Populated via JS) */}
          <article
            id="recent-formats-group"
            class="convert_to_group mb-1 hidden w-full flex-col rounded-card border-b border-rule bg-sky/25 p-3"
            data-converter="🕒 Recent Formats"
          >
            <header class="mb-2 flex w-full items-center gap-1.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">
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
              <header class="mb-2 flex w-full items-center gap-1.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">
                <span>🔥</span> Popular Formats (الأكثر شهرة)
              </header>
              <ul class="convert_to_target flex flex-row flex-wrap gap-1.5">
                {popularTargets.map((entry) => (
                  <button
                    tabindex={0}
                    class="target rounded-tag border border-rule bg-surface px-3 py-1 text-xs font-semibold text-ink transition-colors hover:bg-cta hover:text-cta-ink"
                    data-value={`${entry.format},${entry.converter}`}
                    data-target={entry.format}
                    data-converter={entry.converter}
                    type="button"
                    safe
                  >
                    {entry.format.toUpperCase()}
                  </button>
                ))}
              </ul>
            </article>
          )}

          {/* Every offered format, grouped the way a customer thinks about them */}
          {byCategory.map(({ category, rows }) => (
            <article
              class="convert_to_group flex w-full flex-col border-b border-rule p-3 last:border-none"
              data-converter={category}
            >
              <header class="mb-2 w-full text-xs font-semibold tracking-wider text-ink-muted uppercase">
                {category}
              </header>
              <ul class="convert_to_target flex flex-row flex-wrap gap-1.5">
                {rows.map((entry) => (
                  <button
                    tabindex={0}
                    class="target rounded-tag border border-rule bg-surface-2 px-3 py-1 text-xs font-medium text-ink-body transition-colors hover:bg-cta hover:text-cta-ink"
                    data-value={`${entry.format},${entry.converter}`}
                    data-target={entry.format}
                    data-converter={entry.converter}
                    type="button"
                    safe
                  >
                    {entry.format}
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
          {byCategory.map(({ category, rows }) => (
            <optgroup label={category}>
              {rows.map((entry) => (
                <option value={`${entry.format},${entry.converter}`} safe>
                  {entry.format}
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
