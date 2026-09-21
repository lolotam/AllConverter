import Elysia from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import { onlyAvailable } from "../converters/availability";
import { visibleTargets } from "../services/features";
import { getAllInputs, getAllTargets } from "../converters/main";
import { ALLOW_UNAUTHENTICATED, WEBROOT, BRANDING } from "../helpers/env";
import { headerAccount } from "../helpers/headerUser";
import { localeFromRequest, t } from "../i18n";
import { userService } from "./user";

export const listConverters = new Elysia().use(userService).get(
  "/converters",
  async ({ request, cookie: { lang }, user }) => {
    const locale = localeFromRequest(request, lang?.value);
    return (
      <BaseHtml webroot={WEBROOT} title="ConvertX | Converters" locale={locale}>
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
              <h1 class="mb-4 text-xl">{t(locale, "converters.title")}</h1>
              <table
                class={`
                  w-full table-auto rounded-sm bg-neutral-900 text-start
                  [&_td]:p-4
                  [&_tr]:rounded-sm [&_tr]:border-b [&_tr]:border-neutral-800
                  [&_ul]:list-inside [&_ul]:list-disc
                `}
              >
                <thead>
                  <tr>
                    <th class="mx-4 my-2">{t(locale, "converters.converter")}</th>
                    <th class="mx-4 my-2">{t(locale, "converters.from")}</th>
                    <th class="mx-4 my-2">{t(locale, "converters.to")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(visibleTargets(onlyAvailable(getAllTargets()))).map(
                    ([converter, targets]) => {
                      const inputs = getAllInputs(converter);
                      return (
                        <tr>
                          <td safe>{converter}</td>
                          <td>
                            {t(locale, "converters.count", { count: inputs.length })}
                            <ul>
                              {inputs.map((input) => (
                                <li safe>{input}</li>
                              ))}
                            </ul>
                          </td>
                          <td>
                            {t(locale, "converters.count", { count: targets.length })}
                            <ul>
                              {targets.map((target) => (
                                <li safe>{target}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </article>
          </main>
        </>
      </BaseHtml>
    );
  },
  {
    auth: true,
  },
);
