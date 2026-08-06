import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const donate =
    process.env.NEXT_PUBLIC_DONATE_URL ??
    "https://buymeacoffee.com/digiarendus";
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="mt-8 border-t border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70"
    >
      <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-neutral-600 dark:text-neutral-400">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span>© {year} · {t("madeBy")}</span>
          <a
            href="mailto:info@digiarendus.ee"
            className="hover:text-emerald-600 focus:outline-none underline-offset-2 hover:underline"
          >
            info@digiarendus.ee
          </a>
        </div>
        <a
          href={donate}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 self-start sm:self-auto min-h-11"
        >
          <span aria-hidden>☕</span>
          <span>{t("support")}</span>
        </a>
      </div>
    </footer>
  );
}
