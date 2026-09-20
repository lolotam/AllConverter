import { brandingUrl } from "../services/branding";

/** The avatar button and the menu it opens. Only shown for a real account. */
const AccountMenu = ({
  webroot,
  email,
  name,
  avatar,
  initials,
  tier,
  isAdmin,
  hideHistory,
}: {
  webroot: string;
  email: string;
  name?: string | undefined;
  avatar?: string | undefined;
  initials?: string | undefined;
  tier?: string | undefined;
  isAdmin?: boolean | undefined;
  hideHistory?: boolean | undefined;
}) => {
  const item = `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-neutral-800 transition-colors`;
  return (
    <details class="group relative" data-account-menu>
      <summary
        class={`
          flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 pr-2
          shadow-sm transition-all
          hover:border-accent-500/60 hover:shadow
          dark:border-neutral-700 dark:bg-neutral-900
        `}
        aria-haspopup="menu"
        title="Account menu"
      >
        {avatar ? (
          <img src={avatar} alt="" width="32" height="32" class="size-8 rounded-lg object-cover" />
        ) : (
          <span class="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-accent-500 to-lime-400 text-xs font-black text-neutral-950">
            {initials ?? "??"}
          </span>
        )}
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
      </summary>

      <div
        role="menu"
        class={`
          absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5
          shadow-xl
          dark:border-neutral-800 dark:bg-neutral-900
        `}
      >
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
        </div>

        <div class="py-1">
          <a href={`${webroot}/account`} class={item} role="menuitem">
            <span>👤</span> My profile
          </a>
          {!hideHistory ? (
            <a href={`${webroot}/history`} class={item} role="menuitem">
              <span>🕒</span> Conversion history
            </a>
          ) : null}
          <a href={`${webroot}/account#password`} class={item} role="menuitem">
            <span>🔒</span> Change password
          </a>
          {isAdmin ? (
            <a href={`${webroot}/admin`} class={item} role="menuitem">
              <span>⚡</span> Admin dashboard
            </a>
          ) : null}
        </div>

        <div class="border-t border-slate-200 pt-1 dark:border-neutral-800">
          <a
            href={`${webroot}/logoff`}
            role="menuitem"
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
          >
            <span>↩</span> Sign out
          </a>
        </div>
      </div>
    </details>
  );
};

export const Header = ({
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
}: {
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
}) => {
  // Uploaded in the admin dashboard; null keeps the artwork that ships with the app
  const logo = brandingUrl(webroot, "logo");
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
                {branding.length < 20 ? branding : branding.slice(0, 20)}
              </span>
              <span class="text-[10px] font-semibold uppercase tracking-wider text-lime-600 dark:text-accent-400/90 -mt-1">
                Cloud Pro
              </span>
            </div>
          </a>

          {/* Center Navigation Links (Hidden on small screens) */}
          <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-neutral-300">
            <a
              href={`${webroot}/#tools`}
              class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors"
            >
              Tools
            </a>
            <a
              href={`${webroot}/#how-it-works`}
              class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors"
            >
              How It Works
            </a>
            <a
              href={`${webroot}/#pricing`}
              class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors"
            >
              Pricing
            </a>
            <a
              href={`${webroot}/#features`}
              class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors"
            >
              Features
            </a>
          </nav>
        </div>

        {/* Right Navigation */}
        <div class="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            id="theme-toggle"
            type="button"
            aria-label="Toggle theme"
            title="Toggle Light / Dark Mode"
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
                  History
                </a>
              )}
              <AccountMenu
                webroot={webroot}
                email={accountEmail}
                name={accountName}
                avatar={accountAvatar}
                initials={accountInitials}
                tier={accountTier}
                isAdmin={isAdmin}
                hideHistory={hideHistory}
              />
            </div>
          ) : loggedIn ? (
            <div class="flex items-center gap-3 text-sm">
              {isAdmin && (
                <a
                  href={`${webroot}/admin`}
                  class="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-bold text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-all shadow-sm"
                >
                  <span>⚡</span> Dashboard
                </a>
              )}
              {!hideHistory && (
                <a
                  href={`${webroot}/history`}
                  class="rounded-lg px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition-all"
                >
                  History
                </a>
              )}
              {!allowUnauthenticated ? (
                <a
                  href={`${webroot}/account`}
                  class="rounded-lg px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition-all"
                >
                  Account
                </a>
              ) : null}
              {!allowUnauthenticated ? (
                <a
                  href={`${webroot}/logoff`}
                  class="rounded-lg px-3 py-1.5 font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-red-400 transition-all"
                >
                  Logout
                </a>
              ) : (
                <a
                  href={`${webroot}/#pricing`}
                  class="rounded-xl bg-gradient-to-r from-accent-500 to-lime-400 px-4 py-1.5 text-xs font-bold text-neutral-950 shadow-md hover:from-accent-400 hover:to-lime-300 transition-all"
                >
                  Upgrade to Pro
                </a>
              )}
            </div>
          ) : (
            <div class="flex items-center gap-2.5 text-sm">
              <a
                href={`${webroot}/login`}
                class="rounded-lg px-3.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800/80 dark:hover:text-white transition-all"
              >
                Sign In
              </a>
              {accountRegistration && (
                <a
                  href={`${webroot}/register`}
                  class="rounded-xl bg-gradient-to-r from-accent-500 to-lime-400 px-4 py-2 font-bold text-neutral-950 shadow-lg shadow-accent-500/20 hover:from-accent-400 hover:to-lime-300 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Get Started Free
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
