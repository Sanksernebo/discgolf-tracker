import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { isAdmin } from "@/lib/admin";

export async function SiteHeader() {
  const t = await getTranslations();
  const authed = await isAdmin();

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 backdrop-blur">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 group min-h-11"
          aria-label={t("app.title")}
        >
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-lg"
            aria-hidden
          >
            ⛳
          </span>
          <span className="font-semibold text-base sm:text-lg group-hover:text-emerald-600 transition-colors">
            {t("app.title")}
          </span>
        </Link>
        <nav
          aria-label={t("nav.primary")}
          className="flex items-center gap-2 sm:gap-3 text-sm flex-wrap justify-end"
        >
          <Link
            href="/"
            className="px-2 py-1 rounded hover:text-emerald-600 transition-colors min-h-11 inline-flex items-center"
          >
            {t("nav.home")}
          </Link>
          {authed && (
            <Link
              href="/admin"
              className="px-2 py-1 rounded hover:text-emerald-600 transition-colors min-h-11 inline-flex items-center"
            >
              {t("nav.admin")}
            </Link>
          )}
          <ThemeToggle />
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
