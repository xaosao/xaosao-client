import { useTranslation } from "react-i18next";
import { UserPlus, Heart, CalendarCheck } from "lucide-react";

/**
 * How It Works Section — clean card layout matching the reference.
 *
 * Pattern:
 *   - Rounded pill eyebrow ("HOW IT WORKS") with tinted background
 *   - Bold sans headline with a highlighted final phrase
 *   - 3 equal white cards with:
 *       · numbered pill badge overlapping the top-left corner
 *       · square rounded icon tile
 *       · title + body
 */
export function HowItWorksSection() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: UserPlus,
      title: t("home.how.signup.title", { defaultValue: "Sign up & verify" }),
      desc: t("home.how.signup.desc", {
        defaultValue:
          "Create your account with your phone number, set a profile photo, and you're ready to discover in under a minute.",
      }),
    },
    {
      icon: Heart,
      title: t("home.how.discover.title", {
        defaultValue: "Discover & connect",
      }),
      desc: t("home.how.discover.desc", {
        defaultValue:
          "Browse verified Sao nearby. Filter by service, age, location, and start chatting instantly when you find a match.",
      }),
    },
    {
      icon: CalendarCheck,
      title: t("home.how.book.title", { defaultValue: "Book & enjoy" }),
      desc: t("home.how.book.desc", {
        defaultValue:
          "Choose a service, pay securely through wallet, and meet your companion. Payment is held until you confirm.",
      }),
    },
  ];

  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header block */}
        <div className="max-w-2xl mb-14 sm:mb-20">
          <div className="inline-flex items-center bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full">
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              {t("home.how.tag", { defaultValue: "How it works" })}
            </span>
          </div>

          <h2 className="mt-6 font-sans text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.05] tracking-tight">
            {t("home.how.titleLead", {
              defaultValue: "Find your match in",
            })}{" "}
            <span className="text-rose-500">
              {t("home.how.titleAccent", {
                defaultValue: "three simple steps.",
              })}
            </span>
          </h2>

          <p className="mt-5 text-gray-500 text-base sm:text-lg leading-relaxed">
            {t("home.how.subtitle", {
              defaultValue:
                "Same simple flow whether you're meeting for a drink, a trip, or just a great conversation. Payment is protected end-to-end.",
            })}
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((step, idx) => (
            <div
              key={step.title}
              className="relative bg-white rounded-3xl ring-1 ring-gray-200 p-8 pt-10 transition-all hover:shadow-xl hover:-translate-y-1 hover:ring-rose-200"
            >
              {/* Numbered pill badge — overlapping top-left */}
              <div className="absolute -top-3 left-6 bg-rose-500 text-white px-3 py-1 rounded-full shadow-md">
                <span className="text-xs font-bold tabular-nums tracking-wider">
                  {String(idx + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {step.title}
              </h3>

              <p className="text-gray-500 leading-relaxed text-[15px]">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
