// Both entrances to the account are shown side by side: visitors sent here after their
// free conversion were landing on a page that looked like sign-up only.
import { safeT, type Locale } from "../i18n";

export function AuthTabs({
  webroot,
  locale,
  active,
  accountRegistration,
  reason,
}: {
  webroot: string;
  locale: Locale;
  active: "login" | "register";
  accountRegistration: boolean;
  reason?: string | undefined;
}) {
  const suffix = reason ? `?reason=${reason}` : "";
  const tab = (isActive: boolean) =>
    `flex-1 rounded-button px-4 py-2.5 text-center text-[14px] font-semibold transition-colors ${
      isActive ? "bg-cta text-cta-ink" : "text-ink-muted hover:bg-surface-2"
    }`;

  return (
    <div class="mb-6 flex gap-1 rounded-card border border-rule bg-surface-2 p-1">
      <a href={`${webroot}/login${suffix}`} class={tab(active === "login")}>
        {safeT(locale, "auth.signInTab")}
      </a>
      {accountRegistration ? (
        <a href={`${webroot}/register${suffix}`} class={tab(active === "register")}>
          {safeT(locale, "auth.createTab")}
        </a>
      ) : null}
    </div>
  );
}

export function GoogleButton({
  webroot,
  locale,
  label,
}: {
  webroot: string;
  locale: Locale;
  label: string;
}) {
  return (
    <>
      <a
        href={`${webroot}/auth/google`}
        class="flex w-full items-center justify-center gap-3 rounded-button border border-rule bg-surface px-4 py-3 text-[14px] font-semibold text-ink transition-colors hover:bg-surface-2"
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
        <span safe>{label}</span>
      </a>
      <div class="my-5 flex items-center gap-3 text-xs text-ink-muted">
        <span class="h-px flex-1 bg-rule" />
        {safeT(locale, "auth.orEmail")}
        <span class="h-px flex-1 bg-rule" />
      </div>
    </>
  );
}
