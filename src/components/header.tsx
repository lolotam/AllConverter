export const Header = ({
  loggedIn,
  isAdmin,
  accountRegistration,
  allowUnauthenticated,
  hideHistory,
  webroot = "",
  branding = "ConvertX",
}: {
  loggedIn?: boolean;
  isAdmin?: boolean;
  accountRegistration?: boolean;
  allowUnauthenticated?: boolean;
  hideHistory?: boolean;
  webroot?: string;
  branding?: string;
}) => {
  return (
    <header class="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 text-slate-800 dark:border-neutral-800/80 dark:bg-neutral-950/85 dark:text-neutral-100 backdrop-blur-xl transition-colors duration-200">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo */}
        <div class="flex items-center gap-8">
          <a href={`${webroot}/`} class="group flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
            <div class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-accent-500 via-lime-400 to-emerald-400 shadow-lg shadow-accent-500/20">
              <svg class="size-5 text-neutral-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <div class="flex flex-col">
              <span class="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white group-hover:text-accent-500 transition-colors" safe>
                {branding.length < 20 ? branding : branding.slice(0, 20)}
              </span>
              <span class="text-[10px] font-semibold uppercase tracking-wider text-lime-600 dark:text-accent-400/90 -mt-1">
                Cloud Pro
              </span>
            </div>
          </a>

          {/* Center Navigation Links (Hidden on small screens) */}
          <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-neutral-300">
            <a href={`${webroot}/#tools`} class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors">
              Tools
            </a>
            <a href={`${webroot}/#how-it-works`} class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors">
              How It Works
            </a>
            <a href={`${webroot}/#pricing`} class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors">
              Pricing
            </a>
            <a href={`${webroot}/#features`} class="hover:text-lime-600 dark:hover:text-accent-400 transition-colors">
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
          {loggedIn ? (
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
    </header>
  );
};
