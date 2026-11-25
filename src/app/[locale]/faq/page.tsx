import { getTranslations } from "next-intl/server";

export default async function FAQPage() {
  const t = await getTranslations("faq");

  const groups = [
    {
      title: t("coursesTitle"),
      items: [
        {
          question: t("coursesMissingQ"),
          answer: t("coursesMissingA"),
        },
        {
          question: t("coursesAddQ"),
          answer: t("coursesAddA"),
        },
      ],
    },
    {
      title: t("dataTitle"),
      items: [
        {
          question: t("dataTrackedQ"),
          answer: t("dataTrackedA"),
        },
        {
          question: t("locationQ"),
          answer: t("locationA"),
        },
        {
          question: t("deviceIdQ"),
          answer: t("deviceIdA"),
        },
      ],
    },
    {
      title: t("checkinTitle"),
      items: [
        {
          question: t("checkinQ"),
          answer: t("checkinA"),
        },
        {
          question: t("checkinDataQ"),
          answer: t("checkinDataA"),
        },
      ],
    },
    {
      title: t("ratingsTitle"),
      items: [
        {
          question: t("ratingQ"),
          answer: t("ratingA"),
        },
        {
          question: t("issueQ"),
          answer: t("issueA"),
        },
        {
          question: t("conditionQ"),
          answer: t("conditionA"),
        },
      ],
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          {t("intro")}
        </p>
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="text-xl font-semibold mb-3">{group.title}</h2>

            <div className="space-y-2">
              {group.items.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-4 font-medium min-h-14">
                    <span>{item.question}</span>
                    <span className="text-emerald-600 text-xl shrink-0 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>

                  <div className="px-4 pb-4 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
