import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { DeleteMyDataButton } from "@/components/DeleteMyDataButton";

export const dynamic = "force-dynamic";

/**
 * Public privacy policy page — the transparency notice required by
 * GDPR Articles 13 and 14. Content lives in the message catalogue so it
 * stays translatable; this file only lays it out.
 */
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  const sections: { title: string; body: string[] }[] = [
    { title: t("s1Title"), body: [t("s1Body")] },
    {
      title: t("s2Title"),
      body: [t("s2Intro"), t("s2Device"), t("s2CheckIn"), t("s2Issue"), t("s2Push"), t("s2Admin")],
    },
    { title: t("s3Title"), body: [t("s3Body")] },
    { title: t("s4Title"), body: [t("s4Body")] },
    { title: t("s5Title"), body: [t("s5Body")] },
    { title: t("s6Title"), body: [t("s6Body")] },
    { title: t("s7Title"), body: [t("s7Body")] },
    { title: t("s8Title"), body: [t("s8Body")] },
  ];

  return (
    <article className="max-w-3xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t("updated")}</p>
      </header>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 text-sm">
        <h2 className="font-medium">{t("tldrTitle")}</h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">
          {t("tldrBody")}
        </p>
      </section>

      {sections.map((s) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{s.title}</h2>
          {s.body.map((p, i) => (
            <p
              key={i}
              className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-line"
            >
              {p}
            </p>
          ))}
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("deleteTitle")}</h2>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {t("deleteBody")}
        </p>
        <DeleteMyDataButton />
      </section>
    </article>
  );
}
