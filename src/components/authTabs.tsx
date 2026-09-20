// Both entrances to the account are shown side by side: visitors sent here after their
// free conversion were landing on a page that looked like sign-up only.
export function AuthTabs({
  webroot,
  active,
  accountRegistration,
  reason,
}: {
  webroot: string;
  active: "login" | "register";
  accountRegistration: boolean;
  reason?: string | undefined;
}) {
  const suffix = reason ? `?reason=${reason}` : "";
  const tab = (isActive: boolean) =>
    `flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
      isActive
        ? "bg-accent-500 text-neutral-950"
        : "text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
    }`;

  return (
    <div class="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
      <a href={`${webroot}/login${suffix}`} class={tab(active === "login")}>
        Sign in
      </a>
      {accountRegistration ? (
        <a href={`${webroot}/register${suffix}`} class={tab(active === "register")}>
          Create account
        </a>
      ) : null}
    </div>
  );
}

export function GoogleButton({ webroot, label }: { webroot: string; label: string }) {
  return (
    <>
      <a
        href={`${webroot}/auth/google`}
        class={`
          flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white
          px-4 py-3 text-sm font-semibold text-slate-700 transition-colors
          hover:bg-slate-50
          dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700
        `}
      >
        <svg class="size-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
          />
        </svg>
        {label}
      </a>
      <div class="my-5 flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-500">
        <span class="h-px flex-1 bg-slate-200 dark:bg-neutral-800" />
        or use your email
        <span class="h-px flex-1 bg-slate-200 dark:bg-neutral-800" />
      </div>
    </>
  );
}
