import Elysia from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import { groupByCategory } from "../converters/categories";
import { formatCatalogue } from "../services/features";
import { ALLOW_UNAUTHENTICATED, WEBROOT, BRANDING } from "../helpers/env";
import { headerAccount } from "../helpers/headerUser";
import { localeFromRequest, safeT } from "../i18n";
import { userService } from "./user";

// The public list of what the site can do. It talks about formats only: which tool runs is
// an admin setting the customer never chooses, so naming ffmpeg or libreoffice here would
// only raise a question they cannot act on.

// Most formats accept several hundred inputs. Printing every one on every row put a
// megabyte of extensions on the page, so each row shows a count and a few examples.
const EXAMPLES = 10;

export const listConverters = new Elysia().use(userService).get(
  "/converters",
  async ({ request, cookie: { lang }, user }) => {
    const locale = localeFromRequest(request, lang?.value);
    const offered = formatCatalogue().filter((row) => row.visible);
    const byCategory = groupByCategory(offered, (row) => row.category);

    const th = `px-4 py-3 text-start text-xs font-bold uppercase tracking-wide text-ink-muted`;
    const td = `px-4 py-3 align-top text-caption text-ink-body`;

    return (
      <BaseHtml
        webroot={WEBROOT}
        title={`${BRANDING} | ${safeT(locale, "formats.title")}`}
        locale={locale}
      >
        <>
          <Header
            webroot={WEBROOT}
            locale={locale}
            allowUnauthenticated={ALLOW_UNAUTHENTICATED}
            branding={BRANDING}
            loggedIn={Boolean(user)}
            {...headerAccount(user?.id)}
          />
          <main
            class={`
              w-full flex-1 px-2
              sm:px-4
            `}
          >
            <article class="article">
              <h1 class="mb-1 text-subheading font-bold text-ink">
                {safeT(locale, "formats.title")}
              </h1>
              <p class="mb-5 text-caption text-ink-muted">{safeT(locale, "formats.intro")}</p>

              <div class="mb-4 flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  id="format-search"
                  placeholder={safeT(locale, "formats.filter")}
                  autocomplete="off"
                  class="field w-64 text-caption"
                />
                <span class="text-xs text-ink-muted">
                  {safeT(locale, "formats.total", { count: offered.length })}
                </span>
              </div>

              <div class="overflow-x-auto rounded-card border border-rule">
                <table class="w-full">
                  <thead class="bg-surface-2">
                    <tr class="border-b border-rule">
                      <th class={th}>{safeT(locale, "formats.format")}</th>
                      <th class={th}>{safeT(locale, "formats.category")}</th>
                      <th class={th}>{safeT(locale, "formats.from")}</th>
                    </tr>
                  </thead>
                  {byCategory.map(({ category, rows }) => (
                    <tbody data-category-group>
                      {/* data-search deliberately leaves out the accepts list: nearly every
                          format accepts nearly every other, so a search over it would match
                          every row and tell the customer nothing */}
                      {rows.map((row) => (
                        <tr
                          class="border-b border-rule last:border-none hover:bg-surface-2"
                          data-format-entry
                          data-search={`${row.label} ${row.format} ${row.category}`.toLowerCase()}
                        >
                          <td class={`${td} font-bold text-ink uppercase`} safe>
                            {row.label}
                          </td>
                          <td class={td}>{safeT(locale, `formats.category.${category}`)}</td>
                          <td class={td}>
                            {row.accepts.length === 0 ? (
                              <span class="text-ink-muted">—</span>
                            ) : (
                              <>
                                <span class="font-medium text-ink">
                                  {safeT(locale, "formats.fromCount", {
                                    count: row.accepts.length,
                                  })}
                                </span>
                                <span class="text-ink-muted" safe>
                                  {` — ${row.accepts.slice(0, EXAMPLES).join(", ")}${
                                    row.accepts.length > EXAMPLES
                                      ? `, +${row.accepts.length - EXAMPLES}`
                                      : ""
                                  }`}
                                </span>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
                <p id="format-empty" hidden class="p-4 text-caption text-ink-muted">
                  {safeT(locale, "formats.none")}
                </p>
              </div>
            </article>
          </main>

          <script>
            {`
              (() => {
                const search = document.getElementById("format-search");
                const empty = document.getElementById("format-empty");
                const rows = Array.from(document.querySelectorAll("[data-format-entry]"));
                const groups = Array.from(document.querySelectorAll("[data-category-group]"));
                if (!search || !rows.length) return;

                search.addEventListener("input", () => {
                  const term = search.value.trim().toLowerCase();
                  for (const row of rows) {
                    row.hidden = term !== "" && !row.dataset.search.includes(term);
                  }
                  // A category whose every row is hidden should not leave an empty block
                  for (const group of groups) {
                    const visible = group.querySelectorAll("[data-format-entry]:not([hidden])");
                    group.hidden = visible.length === 0;
                  }
                  if (empty) {
                    empty.hidden = rows.some((row) => !row.hidden);
                  }
                });
              })();
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
