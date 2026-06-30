import { useTranslation } from "react-i18next";
import type { MetaFunction } from "react-router";
import { Header } from "~/components/header";
import { Footer } from "~/components/footer";

export const meta: MetaFunction = () => [
  {
    title: "ເງື່ອນໄຂການໃຫ້ບໍລິການ | Terms & Conditions | Xaosao",
  },
  {
    name: "description",
    content:
      "ເງື່ອນໄຂການໃຊ້ບໍລິການ XaoSao ສຳລັບລູກຄ້າ ແລະ ຜູ້ໃຫ້ບໍລິການ.",
  },
];

const LAST_UPDATED = "30 / 03 / 2026";

/* ─── Tiny helpers ────────────────────────────────────────────────
 *
 * Both pages are mostly: heading + paragraph(s) + numbered list. To
 * keep the JSX readable, we render lists by mapping over t() lookups.
 * `useList(prefix, count)` returns the localized strings for a list
 * whose items are stored as `prefix.1`, `prefix.2`, …
 */
function useList(prefix: string, count: number, t: (k: string) => string) {
  return Array.from({ length: count }, (_, i) => t(`${prefix}.${i + 1}`));
}

/**
 * Unified Terms & Conditions page.
 *
 * The entire body is sourced from the `terms.*` i18n namespace, with
 * EN / LO / TH provided. Audience-specific sections (refund + closure
 * tail items) get rose-tinted badges so each party can scan their
 * clauses without two separate pages.
 */
export default function TermsConditions() {
  const { t } = useTranslation();

  const aboutItems = useList("terms.about.items", 3, t);
  const regItems = useList("terms.registration.items", 12, t);
  const prohibItems = useList("terms.prohibitions.items", 4, t);
  const disputeItems = useList("terms.dispute.items", 6, t);
  const closureItems = useList("terms.closure.items", 4, t);
  const refundItems = useList("terms.refund.items", 4, t);
  const custBenefitItems = useList("terms.customerBenefits.items", 4, t);
  const compBenefitItems = useList("terms.companionBenefits.items", 4, t);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-24 sm:pt-32 pb-16">
        <article className="max-w-4xl mx-auto px-6 lg:px-8">
          {/* Header */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full mb-4">
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                {t("legal.eyebrow")}
              </span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl text-gray-900 leading-tight tracking-tight">
              {t("legal.terms.title")}
            </h1>
            <p className="mt-3 text-gray-400 text-sm">
              {t("legal.terms.subtitleEn")} · {t("legal.lastUpdated")}{" "}
              {LAST_UPDATED}
            </p>
          </header>

          <div className="rounded-3xl space-y-10 leading-relaxed text-gray-700">
            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("terms.intro.title")}
              </h2>
              <p>{t("terms.intro.body")}</p>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("terms.about.title")}
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                {aboutItems.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("terms.registration.title")}
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                {regItems.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("terms.prohibitions.title")}
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                {prohibItems.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("terms.dispute.title")}
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                {disputeItems.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("terms.closure.title")}
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                {closureItems.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
                <li className="bg-rose-50 -mx-2 px-2 py-2 rounded-lg">
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full mr-2 align-middle">
                    {t("terms.badges.customer")}
                  </span>
                  {t("terms.closure.items.customer")}
                </li>
                <li className="bg-rose-50 -mx-2 px-2 py-2 rounded-lg">
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full mr-2 align-middle">
                    {t("terms.badges.companion")}
                  </span>
                  {t("terms.closure.items.companion")}
                </li>
              </ol>
            </section>

            <section className="border-l-4 border-rose-500 pl-5">
              <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full mb-2">
                {t("terms.badges.customer")}
              </div>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("terms.refund.title")}
              </h2>
              <p className="mb-3">{t("terms.refund.intro")}</p>
              <ol className="list-decimal pl-6 space-y-2">
                {refundItems.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </section>

            <section className="border-l-4 border-rose-500 pl-5">
              <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full mb-2">
                {t("terms.badges.customer")}
              </div>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("terms.customerBenefits.title")}
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                {custBenefitItems.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </section>

            <section className="border-l-4 border-rose-500 pl-5">
              <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full mb-2">
                {t("terms.badges.companion")}
              </div>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("terms.companionBenefits.title")}
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                {compBenefitItems.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
              <p className="mt-3 text-sm text-gray-500 italic">
                {t("terms.companionBenefits.note")}
              </p>
            </section>

            <section className="text-center pt-6 border-t border-gray-100 text-sm text-gray-500">
              <p>
                {t("legal.crossLinkPrivacy")}{" "}
                <a
                  href="/privacy-policy"
                  className="text-rose-500 hover:text-rose-600 font-semibold"
                >
                  {t("legal.viewPrivacy")}
                </a>
              </p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
