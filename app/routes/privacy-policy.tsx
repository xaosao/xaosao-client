import { useTranslation } from "react-i18next";
import type { MetaFunction } from "react-router";
import { Header } from "~/components/header";
import { Footer } from "~/components/footer";

export const meta: MetaFunction = () => [
  {
    title: "ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ | Privacy Policy | Xaosao",
  },
  {
    name: "description",
    content:
      "ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວຂອງ XaoSao — ການເກັບກຳ, ການນຳໃຊ້ ແລະ ການປົກປ້ອງຂໍ້ມູນສ່ວນບຸກຄົນຂອງທ່ານ.",
  },
];

const LAST_UPDATED = "30 / 03 / 2026";

/** Same `useList` shape as terms-conditions — see that file for notes. */
function useList(prefix: string, count: number, t: (k: string) => string) {
  return Array.from({ length: count }, (_, i) => t(`${prefix}.${i + 1}`));
}

// Keys for each `<dt>/<dd>` term in the definitions block. Kept ordered.
const DEFINITION_KEYS = [
  "law",
  "policy",
  "account",
  "application",
  "country",
  "device",
  "system",
  "personalData",
  "service",
  "customer",
  "companion",
  "usageData",
  "you",
  "agreement",
  "thirdParty",
  "registration",
  "processing",
] as const;

const COMPLAINT_ROWS = [
  "row1",
  "row2",
  "row3",
  "row4",
  "row5",
  "row6",
  "row7",
  "row8",
] as const;

/**
 * Unified Privacy Policy page.
 *
 * Identical content for customers and companions — both audiences see
 * the same data-handling rules. Content lives in the `privacy.*` i18n
 * namespace with full EN / LO / TH translations.
 */
export default function PrivacyPolicy() {
  const { t } = useTranslation();

  const collectionChannels = useList("privacy.collection.channels", 4, t);
  const otherSources = useList("privacy.collection.otherSources", 7, t);
  const dataTypes = useList("privacy.dataTypes.items", 5, t);
  const purposes = useList("privacy.purposes.items", 10, t);
  const requiredDisclosures = useList("privacy.requiredDisclosures.items", 5, t);
  const crossBorderItems = useList("privacy.crossBorder.items", 6, t);
  const objectItems = useList("privacy.rights.object.items", 4, t);
  const deleteItems = useList("privacy.rights.delete.items", 4, t);
  const restrictItems = useList("privacy.rights.restrict.items", 3, t);
  const securityItems = useList("privacy.security.items", 3, t);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-24 sm:pt-32 pb-16">
        <article className="max-w-4xl mx-auto px-6 lg:px-8">
          <header className="text-center mb-12">
            <div className="inline-flex items-center bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full mb-4">
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                {t("legal.eyebrow")}
              </span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl text-gray-900 leading-tight tracking-tight">
              {t("legal.privacy.title")}
            </h1>
            <p className="mt-3 text-gray-400 text-sm">
              {t("legal.privacy.subtitleEn")} · {t("legal.lastUpdated")}{" "}
              {LAST_UPDATED}
            </p>
          </header>

          <div className="bg-white rounded-3xl space-y-10 leading-relaxed text-gray-700">
            <section>
              <p>{t("privacy.intro")}</p>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("privacy.definitions.title")}
              </h2>
              <dl className="space-y-3">
                {DEFINITION_KEYS.map((key) => (
                  <div key={key}>
                    <dt className="font-bold text-gray-900">
                      {t(`privacy.definitions.${key}.term`)}
                    </dt>
                    <dd className="ml-4">
                      {t(`privacy.definitions.${key}.def`)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("privacy.processing.title")}
              </h2>
              <p>{t("privacy.processing.body")}</p>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.collection.title")}
              </h3>
              <p className="mb-3">{t("privacy.collection.body")}</p>
              <ul className="list-disc pl-6 space-y-1">
                {collectionChannels.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <p className="mt-3">{t("privacy.collection.moreSources")}</p>
              <p className="mt-3">{t("privacy.collection.otherSourcesLead")}</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                {otherSources.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.dataTypes.title")}
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                {dataTypes.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.purposes.title")}
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                {purposes.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.withoutConsent.title")}
              </h3>
              <p>{t("privacy.withoutConsent.body1")}</p>
              <p className="mt-3">{t("privacy.withoutConsent.body2")}</p>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.requestedConsent.title")}
              </h3>
              <p>{t("privacy.requestedConsent.body1")}</p>
              <p className="mt-3">{t("privacy.requestedConsent.body2")}</p>
              <p className="mt-3">{t("privacy.requestedConsent.body3")}</p>
              <p className="mt-3">{t("privacy.requestedConsent.body4")}</p>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.compliantTerms.title")}
              </h3>
              <p>{t("privacy.compliantTerms.body")}</p>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.requiredDisclosures.title")}
              </h3>
              <p className="mb-3">{t("privacy.requiredDisclosures.body")}</p>
              <ul className="list-disc pl-6 space-y-1">
                {requiredDisclosures.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.use.title")}
              </h3>
              <p>{t("privacy.use.body")}</p>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.disclosure.title")}
              </h3>
              <p>{t("privacy.disclosure.body1")}</p>
              <p className="mt-3">{t("privacy.disclosure.body2")}</p>
              <p className="mt-3">{t("privacy.disclosure.body3")}</p>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.crossBorder.title")}
              </h3>
              <p className="mb-3">{t("privacy.crossBorder.body")}</p>
              <ul className="list-disc pl-6 space-y-1">
                {crossBorderItems.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg text-gray-900 mb-3">
                {t("privacy.retention.title")}
              </h3>
              <p>{t("privacy.retention.body1")}</p>
              <p className="mt-3">{t("privacy.retention.body2")}</p>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("privacy.rights.title")}
              </h2>
              <p className="mb-4">{t("privacy.rights.intro")}</p>

              <ol className="list-decimal pl-6 space-y-5">
                <li>
                  <strong className="font-bold text-gray-900">
                    {t("privacy.rights.withdraw.title")}
                  </strong>
                  <p className="mt-1">{t("privacy.rights.withdraw.body")}</p>
                </li>
                <li>
                  <strong className="font-bold text-gray-900">
                    {t("privacy.rights.access.title")}
                  </strong>
                  <p className="mt-1">{t("privacy.rights.access.body")}</p>
                </li>
                <li>
                  <strong className="font-bold text-gray-900">
                    {t("privacy.rights.transfer.title")}
                  </strong>
                  <p className="mt-1">{t("privacy.rights.transfer.body")}</p>
                </li>
                <li>
                  <strong className="font-bold text-gray-900">
                    {t("privacy.rights.correct.title")}
                  </strong>
                  <p className="mt-1">{t("privacy.rights.correct.body")}</p>
                </li>
                <li>
                  <strong className="font-bold text-gray-900">
                    {t("privacy.rights.object.title")}
                  </strong>
                  <p className="mt-1 mb-2">
                    {t("privacy.rights.object.body")}
                  </p>
                  <ul className="list-disc pl-6 space-y-1">
                    {objectItems.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </li>
                <li>
                  <strong className="font-bold text-gray-900">
                    {t("privacy.rights.delete.title")}
                  </strong>
                  <p className="mt-1 mb-2">{t("privacy.rights.delete.body")}</p>
                  <ul className="list-disc pl-6 space-y-1">
                    {deleteItems.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </li>
                <li>
                  <strong className="font-bold text-gray-900">
                    {t("privacy.rights.restrict.title")}
                  </strong>
                  <p className="mt-1 mb-2">
                    {t("privacy.rights.restrict.body")}
                  </p>
                  <ul className="list-disc pl-6 space-y-1">
                    {restrictItems.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </li>
                <li>
                  <strong className="font-bold text-gray-900">
                    {t("privacy.rights.complaint.title")}
                  </strong>
                  <p className="mt-1 mb-2">
                    {t("privacy.rights.complaint.body")}
                  </p>
                  <p className="mb-2">
                    {t("privacy.rights.complaint.rowsLead")}
                  </p>
                  <ul className="list-disc pl-6 space-y-1">
                    {COMPLAINT_ROWS.map((row) => (
                      <li key={row}>
                        {t(`privacy.rights.complaint.rows.${row}`)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-gray-500 italic">
                    {t("privacy.rights.complaint.note")}
                  </p>
                  <p className="mt-3">
                    {t("privacy.rights.complaint.support")}
                  </p>
                  <p className="mt-3">
                    {t("privacy.rights.complaint.refusal")}
                  </p>
                  <p className="mt-3">{t("privacy.rights.complaint.eea")}</p>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("privacy.cookies.title")}
              </h2>
              <p>{t("privacy.cookies.body")}</p>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("privacy.security.title")}
              </h2>
              <p>{t("privacy.security.body1")}</p>
              <p className="mt-3">{t("privacy.security.body2")}</p>
              <p className="mt-3 mb-2">{t("privacy.security.body3")}</p>
              <ul className="list-disc pl-6 space-y-1">
                {securityItems.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("privacy.breach.title")}
              </h2>
              <p>{t("privacy.breach.body")}</p>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("privacy.externalSites.title")}
              </h2>
              <p>{t("privacy.externalSites.body")}</p>
            </section>

            <section>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("privacy.changes.title")}
              </h2>
              <p>{t("privacy.changes.body1")}</p>
              <p className="mt-3">{t("privacy.changes.body2")}</p>
            </section>

            <section className="border-t border-gray-100 pt-8">
              <h2 className="font-serif text-2xl text-gray-900 mb-3">
                {t("privacy.contact.title")}
              </h2>
              <p className="mb-3">{t("privacy.contact.intro")}</p>
              <ul className="space-y-2">
                <li>
                  <span className="font-semibold text-gray-900">
                    {t("privacy.contact.email")}:
                  </span>{" "}
                  <a
                    className="text-rose-500 hover:text-rose-600"
                    href="mailto:xaosao95@gmail.com"
                  >
                    xaosao95@gmail.com
                  </a>
                </li>
                <li>
                  <span className="font-semibold text-gray-900">
                    {t("privacy.contact.phone")}:
                  </span>{" "}
                  <a
                    className="text-rose-500 hover:text-rose-600"
                    href="tel:+8562091082600"
                  >
                    20 9108 2600
                  </a>
                </li>
                <li>
                  <span className="font-semibold text-gray-900">
                    {t("privacy.contact.whatsapp")}:
                  </span>{" "}
                  2091082600
                </li>
              </ul>
            </section>

            <section className="text-center pt-6 border-t border-gray-100 text-sm text-gray-500">
              <p>
                {t("legal.crossLinkTerms")}{" "}
                <a
                  href="/terms-conditions"
                  className="text-rose-500 hover:text-rose-600 font-semibold"
                >
                  {t("legal.viewTerms")}
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
