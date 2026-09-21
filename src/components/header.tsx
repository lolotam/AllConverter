import { isRtl, t, type Locale } from "../i18n";
import { brandingUrl } from "../services/branding";
import { siteName, siteTagline } from "../services/siteName";

const menuItem = `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-neutral-800 transition-colors`;

const menuPanel = `absolute end-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900`;

const summaryButton = `flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 pe-2 shadow-sm transition-all hover:border-accent-500/60 hover:shadow dark:border-neutral-700 dark:bg-neutral-900`;

const Chevron = () => (
  <svg
    class="size-4 text-slate-500 transition-transform group-open:rotate-180 dark:text-neutral-400"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/**
 * With ALLOW_UNAUTHENTICATED a visitor is never asked to sign in, so most people
 * never have an account to show. They still get the same control, offering the
 * way in rather than the way out.
 */
const GuestMenu = ({
  webroot,
  locale,
  accountRegistration,
  hideHistory,
}: {
  webroot: string;
  locale: Locale;
  accountRegistration?: boolean | undefined;
  hideHistory?: boolean | undefined;
}) => (
  <details class="group relative" data-account-menu>
    <summary class={summaryButton} aria-haspopup="menu" title={t(locale, "menu.guestMenu")}>
      <span class="flex size-8 items-center justify-center rounded-lg bg-slate-200 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400">
        <svg
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </span>
      <Chevron />
    </summary>

    <div role="menu" class={menuPanel}>
      <div class="border-b border-slate-200 px-3 pb-3 pt-2 dark:border-neutral-800">
        <p class="text-sm font-bold text-slate-900 dark:text-white">
          {t(locale, "menu.guestTitle")}
        </p>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
          {t(locale, "menu.guestHint")}
        </p>
      </div>

      <div class="py-1">
        {!hideHistory ? (
          <a href={`${webroot}/history`} class={menuItem} role="menuitem">
            <span>🕒</span> {t(locale, "menu.history")}
          </a>
        ) : null}
        <a href={`${webroot}/converters`} class={menuItem} role="menuitem">
          <span>🔁</span> {t(locale, "menu.converters")}
        </a>
        <a href={`${webroot}/#pricing`} class={menuItem} role="menuitem">
          <span>💳</span> {t(locale, "menu.pricing")}
        </a>
      </div>

      <div class="border-t border-slate-200 pt-1 dark:border-neutral-800">
        <a
          href={`${webroot}/login`}
          role="menuitem"
          class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-lime-700 hover:bg-accent-500/10 dark:text-accent-400 dark:hover:bg-accent-500/10 transition-colors"
        >
          <span>🔑</span> {t(locale, "menu.signIn")}
        </a>
        {accountRegistration ? (
          <a href={`${webroot}/register`} class={menuItem} role="menuitem">
            <span>✨</span> {t(locale, "menu.createAccount")}
          </a>
        ) : null}
      </div>
    </div>
  </details>
);

/** The avatar button and the menu it opens. Only shown for a real account. */
const AccountMenu = ({
  webroot,
  locale,
  email,
  name,
  avatar,
  initials,
  tier,
  used,
  limit,
  unlimited,
  paid,
  isAdmin,
  hideHistory,
}: {
  webroot: string;
  locale: Locale;
  email: string;
  name?: string | undefined;
  avatar?: string | undefined;
  initials?: string | undefined;
  tier?: string | undefined;
  used?: number | undefined;
  limit?: number | undefined;
  unlimited?: boolean | undefined;
  paid?: boolean | undefined;
  isAdmin?: boolean | undefined;
  hideHistory?: boolean | undefined;
}) => {
  const item = menuItem;
  const left = Math.max(0, (limit ?? 0) - (used ?? 0));
  // A meter is only meaningful against a real ceiling
  const showMeter = !unlimited && (limit ?? 0) > 0;
  const spent = showMeter ? Math.min(100, Math.round(((used ?? 0) / (limit ?? 1)) * 100)) : 0;
  return (
    <details class="group relative" data-account-menu>
      <summary class={summaryButton} aria-haspopup="menu" title={t(locale, "header.accountMenu")}>
        {avatar ? (
          <img src={avatar} alt="" width="32" height="32" class="size-8 rounded-lg object-cover" />
        ) : (
          <span class="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-accent-500 to-lime-400 text-xs font-black text-neutral-950">
            {initials ?? "??"}
          </span>
        )}
        <Chevron />
      </summary>

      <div role="menu" class={menuPanel}>
        <div class="border-b border-slate-200 px-3 pb-3 pt-2 dark:border-neutral-800">
          <p safe class="truncate text-sm font-bold text-slate-900 dark:text-white">
            {name || email}
          </p>
          <p safe class="truncate text-xs text-slate-500 dark:text-neutral-400">
            {email}
          </p>
          {tier ? (
            <span
              safe
              class="mt-2 inline-block rounded-md bg-accent-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-700 dark:text-accent-400"
            >
              {tier}
            </span>
          ) : null}

          {/* What most people open this menu to find out: can I still convert today? */}
          <div class="mt-2.5">
            <p class="text-xs font-medium text-slate-600 dark:text-neutral-300">
              {unlimited
                ? t(locale, "menu.usageUnlimited")
                : t(locale, "menu.usageLeft", { left, limit: limit ?? 0 })}
            </p>
            {showMeter ? (
              <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-800">
                <div
                  class={`h-full rounded-full ${left === 0 ? "bg-red-500" : "bg-accent-500"}`}
                  style={`width:${spent}%`}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div class="py-1">
          <a href={`${webroot}/account`} class={item} role="menuitem">
            <span>👤</span> {t(locale, "menu.profile")}
          </a>
          {!hideHistory ? (
            <a href={`${webroot}/history`} class={item} role="menuitem">
              <span>🕒</span> {t(locale, "menu.history")}
            </a>
          ) : null}
          <a href={`${webroot}/account#plan`} class={item} role="menuitem">
            <span>💳</span> {t(locale, paid ? "menu.billing" : "menu.plan")}
          </a>
          <a href={`${webroot}/converters`} class={item} role="menuitem">
            <span>🔁</span> {t(locale, "menu.converters")}
          </a>
          <a href={`${webroot}/account#password`} class={item} role="menuitem">
            <span>🔒</span> {t(locale, "menu.changePassword")}
          </a>
          {!paid ? (
            <a
              href={`${webroot}/#pricing`}
              role="menuitem"
              class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-lime-700 hover:bg-accent-500/10 dark:text-accent-400 dark:hover:bg-accent-500/10 transition-colors"
            >
              <span>🚀</span> {t(locale, "menu.upgrade")}
            </a>
          ) : null}
        </div>

        {isAdmin ? (
          <div class="border-t border-slate-200 py-1 dark:border-neutral-800">
            <a
              href={`${webroot}/admin`}
              role="menuitem"
              class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/10 transition-colors"
            >
              <span>⚡</span> {t(locale, "menu.admin")}
            </a>
          </div>
        ) : null}

        <div class="border-t border-slate-200 pt-1 dark:border-neutral-800">
          <a
            href={`${webroot}/logoff`}
            role="menuitem"
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
          >
            <span>↩</span> {t(locale, "menu.signOut")}
          </a>
        </div>
      </div>
    </details>
  );
};

export const Header = ({
  locale = "en",
  loggedIn,
  isAdmin,
  accountRegistration,
  allowUnauthenticated,
  hideHistory,
  webroot = "",
  branding = "ConvertX",
  accountEmail,
  accountName,
  accountAvatar,
  accountInitials,
  accountTier,
  accountUsed,
  accountLimit,
  accountUnlimited,
  accountPaid,
}: {
  locale?: Locale | undefined;
  loggedIn?: boolean | undefined;
  isAdmin?: boolean | undefined;
  accountRegistration?: boolean | undefined;
  allowUnauthenticated?: boolean | undefined;
  hideHistory?: boolean | undefined;
  webroot?: string | undefined;
  branding?: string | undefined;
  accountEmail?: string | undefined;
  accountName?: string | undefined;
  accountAvatar?: string | undefined;
  accountInitials?: string | undefined;
  accountTier?: string | undefined;
  accountUsed?: number | undefined;
  accountLimit?: number | undefined;
  accountUnlimited?: boolean | undefined;
  accountPaid?: boolean | undefined;
}) => {
  // Set in the admin dashboard; null or empty keeps what the app ships with
  const logo = brandingUrl(webroot, "logo");
  const name = siteName() || branding;
  const tagline = siteTagline();
  const langLink = (target: Locale) =>
    `rounded-md px-1.5 py-1 transition-colors ${
      locale === target
        ? "font-bold text-slate-900 dark:text-white"
        : "text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
    }`;
  return (
    <header class="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 text-slate-800 dark:border-neutral-800/80 dark:bg-neutral-950/85 dark:text-neutral-100 backdrop-blur-xl transition-colors duration-200">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo */}
        <div class="flex items-center gap-8">
          <a
            href={`${webroot}/`}
            class="group flex items-center gap-2.5 transition-transform hover:scale-[1.02]"
          >
            {logo ? (
              <img
                src={logo}
                alt=""
                width="36"
                height="36"
                class="size-9 rounded-xl object-contain"
              />
            ) : (
              <div class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-accent-500 via-lime-400 to-emerald-400 shadow-lg shadow-accent-500/20">
                <svg
                  class="size-5 text-neutral-950"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                  <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
            )}
            <div class="flex flex-col">
              <span
                class="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white group-hover:text-accent-500 transition-colors"
                safe
              >
                {name.length < 24 ? name : name.slice(0, 24)}
              </span>
              {tagline ? (
                <span
                  safe
                  class="text-[10px] font-semibold uppercase tracking-wider text-lime-600 dark:text-accent-400/90 -mt-1"
                >
                  {tagline}
                </span>
              ) : null}
            </div>
          </a>

          {/* Center Navigation Links (Hidden on small screens) */}
          <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-neutral-300">
            <a
              href={`${webroot}/#tools`}
              class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors"
            >
              {t(locale, "header.tools")}
            </a>
            <a
              href={`${webroot}/#how-it-works`}
              class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors"
            >
              {t(locale, "header.howItWorks")}
            </a>
            <a
              href={`${webroot}/#pricing`}
              class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors"
            >
              {t(locale, "header.pricing")}
            </a>
            <a
              href={`${webroot}/#features`}
              class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors"
            >
              {t(locale, "header.features")}
            </a>
          </nav>
        </div>

        {/* Right Navigation */}
        <div class="flex items-center gap-3">
          {/* Language Switch */}
          <div
            class={`flex items-center gap-1 text-sm ${isRtl(locale) ? "font-bold" : "font-semibold"}`}
          >
            <a href={`${webroot}/lang/en`} class={langLink("en")} title="English">
              EN
            </a>
            <span class="text-slate-300 dark:text-neutral-600">|</span>
            <a href={`${webroot}/lang/ar`} class={langLink("ar")} title="العربية">
              ع
            </a>
          </div>
          {/* Theme Toggle Button */}
          <button
            id="theme-toggle"
            type="button"
            aria-label={t(locale, "header.toggleTheme")}
            title={t(locale, "header.toggleThemeTitle")}
            class="flex size-9 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-neutral-700 dark:bg-neutral-850 dark:text-neutral-200 dark:hover:bg-neutral-700 transition-all cursor-pointer shadow-sm"
            onclick="
              const isDark = document.documentElement.classList.contains('dark');
              if (isDark) {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
                localStorage.setItem('convertx_theme', 'light');
              } else {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
                localStorage.setItem('convertx_theme', 'dark');
              }
            "
          >
            <span class="dark:hidden text-base">🌙</span>
            <span class="hidden dark:inline text-base">☀️</span>
          </button>
          {loggedIn && accountEmail ? (
            <div class="flex items-center gap-3 text-sm">
              {!hideHistory && (
                <a
                  href={`${webroot}/history`}
                  class="hidden rounded-lg px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition-all sm:inline-block"
                >
                  {t(locale, "header.history")}
                </a>
              )}
              <AccountMenu
                webroot={webroot}
                locale={locale}
                email={accountEmail}
                name={accountName}
                avatar={accountAvatar}
                initials={accountInitials}
                tier={accountTier}
                used={accountUsed}
                limit={accountLimit}
                unlimited={accountUnlimited}
                paid={accountPaid}
                isAdmin={isAdmin}
                hideHistory={hideHistory}
              />
            </div>
          ) : loggedIn ? (
            <div class="flex items-center gap-2.5 text-sm">
              {accountRegistration ? (
                <a
                  href={`${webroot}/register`}
                  class="hidden rounded-xl bg-gradient-to-r from-accent-500 to-lime-400 px-4 py-1.5 text-xs font-bold text-neutral-950 shadow-md hover:from-accent-400 hover:to-lime-300 transition-all sm:inline-block"
                >
                  {t(locale, "header.getStarted")}
                </a>
              ) : null}
              <GuestMenu
                webroot={webroot}
                locale={locale}
                accountRegistration={accountRegistration}
                hideHistory={hideHistory}
              />
            </div>
          ) : (
            <div class="flex items-center gap-2.5 text-sm">
              <a
                href={`${webroot}/login`}
                class="rounded-lg px-3.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800/80 dark:hover:text-white transition-all"
              >
                {t(locale, "header.signIn")}
              </a>
              {accountRegistration && (
                <a
                  href={`${webroot}/register`}
                  class="rounded-xl bg-gradient-to-r from-accent-500 to-lime-400 px-4 py-2 font-bold text-neutral-950 shadow-lg shadow-accent-500/20 hover:from-accent-400 hover:to-lime-300 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {t(locale, "header.getStarted")}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      {/* A <details> menu stays open until it is clicked again; people expect a click
          anywhere else, or Escape, to close it */}
      <script>
        {`
          document.addEventListener("click", (event) => {
            for (const menu of document.querySelectorAll("[data-account-menu][open]")) {
              if (!menu.contains(event.target)) menu.removeAttribute("open");
            }
          });
          document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            for (const menu of document.querySelectorAll("[data-account-menu][open]")) {
              menu.removeAttribute("open");
            }
          });
        `}
      </script>
    </header>
  );
};
