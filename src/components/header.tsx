import { isRtl, safeT, type Locale } from "../i18n";
import { brandingUrl } from "../services/branding";
import { siteName, siteTagline } from "../services/siteName";

const menuItem = `flex items-center gap-2.5 rounded-button px-3 py-2 text-[14px] text-ink-body hover:bg-surface-2 transition-colors`;

const menuPanel = `absolute end-0 z-50 mt-2 w-64 overflow-hidden rounded-card border border-rule bg-surface p-1.5 shadow-lg`;

const summaryButton = `flex cursor-pointer list-none items-center gap-2 rounded-button border border-rule bg-surface p-1 pe-2 transition-all hover:border-cta`;

const Chevron = () => (
  <svg
    class="size-4 text-ink-faint transition-transform group-open:rotate-180"
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
    <summary class={summaryButton} aria-haspopup="menu" title={safeT(locale, "menu.guestMenu")}>
      <span class="flex size-8 items-center justify-center rounded-button bg-surface-2 text-ink-muted">
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
      <div class="border-b border-rule px-3 pt-2 pb-3">
        <p class="text-[14px] font-semibold text-ink">{safeT(locale, "menu.guestTitle")}</p>
        <p class="mt-0.5 text-xs text-ink-muted">{safeT(locale, "menu.guestHint")}</p>
      </div>

      <div class="py-1">
        {!hideHistory ? (
          <a href={`${webroot}/history`} class={menuItem} role="menuitem">
            <span>🕒</span> {safeT(locale, "menu.history")}
          </a>
        ) : null}
        <a href={`${webroot}/converters`} class={menuItem} role="menuitem">
          <span>🔁</span> {safeT(locale, "menu.converters")}
        </a>
        <a href={`${webroot}/#pricing`} class={menuItem} role="menuitem">
          <span>💳</span> {safeT(locale, "menu.pricing")}
        </a>
      </div>

      <div class="border-t border-rule pt-1">
        <a
          href={`${webroot}/login`}
          role="menuitem"
          class="flex items-center gap-2.5 rounded-button px-3 py-2 text-[14px] font-semibold text-link transition-colors hover:bg-surface-2"
        >
          <span>🔑</span> {safeT(locale, "menu.signIn")}
        </a>
        {accountRegistration ? (
          <a href={`${webroot}/register`} class={menuItem} role="menuitem">
            <span>✨</span> {safeT(locale, "menu.createAccount")}
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
      <summary
        class={summaryButton}
        aria-haspopup="menu"
        title={safeT(locale, "header.accountMenu")}
      >
        {avatar ? (
          <img src={avatar} alt="" width="32" height="32" class="size-8 rounded-lg object-cover" />
        ) : (
          <span
            class="flex size-8 items-center justify-center rounded-button bg-cta text-xs font-semibold text-cta-ink"
            safe
          >
            {initials ?? "??"}
          </span>
        )}
        <Chevron />
      </summary>

      <div role="menu" class={menuPanel}>
        <div class="border-b border-rule px-3 pt-2 pb-3">
          <p safe class="truncate text-[14px] font-semibold text-ink">
            {name || email}
          </p>
          <p safe class="truncate text-xs text-ink-muted">
            {email}
          </p>
          {tier ? (
            <span
              safe
              class="mt-2 inline-block rounded-tag bg-marigold px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#181d26] uppercase"
            >
              {tier}
            </span>
          ) : null}

          {/* What most people open this menu to find out: can I still convert today? */}
          <div class="mt-2.5">
            <p class="text-xs font-medium text-ink-body">
              {unlimited
                ? safeT(locale, "menu.usageUnlimited")
                : safeT(locale, "menu.usageLeft", { left, limit: limit ?? 0 })}
            </p>
            {showMeter ? (
              <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  class={`h-full rounded-full ${left === 0 ? "bg-terracotta" : "bg-cta"}`}
                  style={`width:${spent}%`}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div class="py-1">
          <a href={`${webroot}/account`} class={item} role="menuitem">
            <span>👤</span> {safeT(locale, "menu.profile")}
          </a>
          {!hideHistory ? (
            <a href={`${webroot}/history`} class={item} role="menuitem">
              <span>🕒</span> {safeT(locale, "menu.history")}
            </a>
          ) : null}
          <a href={`${webroot}/account#plan`} class={item} role="menuitem">
            <span>💳</span> {safeT(locale, paid ? "menu.billing" : "menu.plan")}
          </a>
          <a href={`${webroot}/converters`} class={item} role="menuitem">
            <span>🔁</span> {safeT(locale, "menu.converters")}
          </a>
          <a href={`${webroot}/account#password`} class={item} role="menuitem">
            <span>🔒</span> {safeT(locale, "menu.changePassword")}
          </a>
          {!paid ? (
            <a
              href={`${webroot}/#pricing`}
              role="menuitem"
              class="flex items-center gap-2.5 rounded-button px-3 py-2 text-[14px] font-semibold text-link transition-colors hover:bg-surface-2"
            >
              <span>🚀</span> {safeT(locale, "menu.upgrade")}
            </a>
          ) : null}
        </div>

        {isAdmin ? (
          <div class="border-t border-rule py-1">
            <a
              href={`${webroot}/admin`}
              role="menuitem"
              class="flex items-center gap-2.5 rounded-button px-3 py-2 text-[14px] font-semibold text-ink transition-colors hover:bg-surface-2"
            >
              <span>⚡</span> {safeT(locale, "menu.admin")}
            </a>
          </div>
        ) : null}

        <div class="border-t border-rule pt-1">
          <a
            href={`${webroot}/logoff`}
            role="menuitem"
            class="flex items-center gap-2.5 rounded-button px-3 py-2 text-[14px] font-medium text-terracotta transition-colors hover:bg-surface-2"
          >
            <span>↩</span> {safeT(locale, "menu.signOut")}
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
  /** Accepted for call-site compatibility; the guest menu covers both cases now. */
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
      locale === target ? "font-semibold text-ink" : "text-ink-faint hover:text-ink"
    }`;
  return (
    <header class="sticky top-0 z-50 w-full bg-surface text-ink-body shadow-(--shadow-nav) transition-colors duration-200">
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
              <img
                src={`${webroot}/favicon.svg`}
                alt=""
                width="36"
                height="36"
                class="size-9 rounded-xl object-contain shadow-lg shadow-accent-500/20"
              />
            )}
            <div class="flex flex-col">
              <span
                class="font-display text-[20px] font-black tracking-normal text-ink transition-colors"
                safe
              >
                {name.length < 24 ? name : name.slice(0, 24)}
              </span>
              {tagline ? (
                <span
                  safe
                  class="-mt-0.5 text-[10px] font-semibold tracking-wider text-ink-muted uppercase"
                >
                  {tagline}
                </span>
              ) : null}
            </div>
          </a>

          {/* Center Navigation Links (Hidden on small screens) */}
          <nav class="hidden items-center gap-6 text-body-sm text-ink-body md:flex">
            <a href={`${webroot}/#tools`} class="transition-colors hover:text-ink">
              {safeT(locale, "header.tools")}
            </a>
            <a href={`${webroot}/#how-it-works`} class="transition-colors hover:text-ink">
              {safeT(locale, "header.howItWorks")}
            </a>
            <a href={`${webroot}/#pricing`} class="transition-colors hover:text-ink">
              {safeT(locale, "header.pricing")}
            </a>
            <a href={`${webroot}/#features`} class="transition-colors hover:text-ink">
              {safeT(locale, "header.features")}
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
            <span class="text-rule">|</span>
            <a href={`${webroot}/lang/ar`} class={langLink("ar")} title="العربية">
              ع
            </a>
          </div>
          {/* Theme Toggle Button */}
          <button
            id="theme-toggle"
            type="button"
            aria-label={safeT(locale, "header.toggleTheme")}
            title={safeT(locale, "header.toggleThemeTitle")}
            class="flex size-9 cursor-pointer items-center justify-center rounded-button border border-rule bg-surface text-ink-body transition-all hover:bg-surface-2"
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
            <span class="text-base dark:hidden">🌙</span>
            <span class="hidden text-base dark:inline">☀️</span>
          </button>
          {loggedIn && accountEmail ? (
            <div class="flex items-center gap-3 text-sm">
              {!hideHistory && (
                <a
                  href={`${webroot}/history`}
                  class="hidden rounded-button px-3 py-1.5 text-body-sm text-ink-body transition-colors hover:text-ink sm:inline-block"
                >
                  {safeT(locale, "header.history")}
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
                  class="hidden rounded-button bg-cta px-4 py-2 text-[14px] font-semibold text-cta-ink transition-opacity hover:opacity-90 sm:inline-block"
                >
                  {safeT(locale, "header.getStarted")}
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
                class="rounded-button border border-cta bg-(--ghost-surface) px-4 py-2 text-[14px] font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                {safeT(locale, "header.signIn")}
              </a>
              {accountRegistration && (
                <a
                  href={`${webroot}/register`}
                  class="rounded-button bg-cta px-4 py-2 text-[14px] font-semibold text-cta-ink transition-opacity hover:opacity-90 active:scale-[0.99]"
                >
                  {safeT(locale, "header.getStarted")}
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
