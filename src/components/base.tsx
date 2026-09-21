import { version } from "../../package.json";
import { assetUrl } from "../helpers/assetUrl";
import { isRtl, t, type Locale } from "../i18n";
import { brandingUrl } from "../services/branding";

export const BaseHtml = ({
  children,
  title = "AllConverter Tech - Fast, Secure & Free Online File Converter",
  webroot = "",
  customFooter = false,
  locale = "en",
}: {
  children: JSX.Element;
  title?: string;
  webroot?: string;
  customFooter?: boolean;
  locale?: Locale | undefined;
}) => (
  <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} class="dark scroll-smooth">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="webroot" content={webroot} />
      <title safe>{title}</title>
      <meta
        name="description"
        content="Convert audio, video, documents, images, and eBooks online for free. Over 1,000+ formats supported with 100% privacy and high-speed cloud processing."
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Slab:wght@400;700;900&family=Cairo:wght@400;500;600;700;900&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href={assetUrl(webroot, "generated.css")} />
      {brandingUrl(webroot, "favicon") ? (
        <link rel="icon" href={String(brandingUrl(webroot, "favicon"))} />
      ) : (
        <>
          <link rel="apple-touch-icon" sizes="180x180" href={`${webroot}/apple-touch-icon.png`} />
          <link rel="icon" type="image/png" sizes="32x32" href={`${webroot}/favicon-32x32.png`} />
          <link rel="icon" type="image/png" sizes="16x16" href={`${webroot}/favicon-16x16.png`} />
        </>
      )}
      <link rel="manifest" href={`${webroot}/site.webmanifest`} />
      <style>{`
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        /* Roboto Slab carries no Arabic, so the display face falls back to Cairo at the
           same weight rather than letting the browser pick an unrelated substitute. */
        html[dir="rtl"] body,
        html[dir="rtl"] .display-lg,
        html[dir="rtl"] .display-xl {
          font-family: 'Cairo', 'Inter', sans-serif;
        }
      `}</style>
      <script>{`
        (function() {
          try {
            const savedTheme = localStorage.getItem('convertx_theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (savedTheme === 'light') {
              document.documentElement.classList.remove('dark');
              document.documentElement.classList.add('light');
            } else if (savedTheme === 'dark' || prefersDark) {
              document.documentElement.classList.add('dark');
              document.documentElement.classList.remove('light');
            } else {
              document.documentElement.classList.remove('dark');
              document.documentElement.classList.add('light');
            }
          } catch(e) {}
        })();
      `}</script>
    </head>
    <body
      class={`flex min-h-screen w-full flex-col bg-canvas text-ink-body transition-colors duration-200 selection:bg-marigold selection:text-[#181d26]`}
    >
      {children}
      {!customFooter && (
        <footer class="w-full border-t border-rule py-6">
          <div class="p-4 text-center text-caption text-ink-muted">
            <span>{t(locale, "base.poweredBy")} </span>
            <a href="https://github.com/C4illin/ConvertX" class="text-ink-muted hover:text-link">
              ConvertX{" "}
            </a>
            <span safe>v{version || ""}</span>
            <span class="mx-2">·</span>
            <a href={`${webroot}/terms`} class="text-ink-muted hover:text-link">
              {t(locale, "base.terms")}
            </a>
            <span class="mx-2">·</span>
            <a href={`${webroot}/privacy`} class="text-ink-muted hover:text-link">
              {t(locale, "base.privacy")}
            </a>
            <span class="mx-2">·</span>
            <a href={`${webroot}/refunds`} class="text-ink-muted hover:text-link">
              {t(locale, "base.refunds")}
            </a>
          </div>
        </footer>
      )}
    </body>
  </html>
);
