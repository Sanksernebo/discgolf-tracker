"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useTransition } from "react";

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-700 p-0.5 text-xs">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          disabled={isPending || l === locale}
          onClick={() =>
            startTransition(() => {
              router.replace(pathname, { locale: l });
            })
          }
          className={
            l === locale
              ? "px-2 py-1 rounded-full bg-emerald-500 text-white font-medium"
              : "px-2 py-1 rounded-full text-neutral-600 dark:text-neutral-300 hover:text-emerald-600"
          }
        >
          {t(l)}
        </button>
      ))}
    </div>
  );
}
