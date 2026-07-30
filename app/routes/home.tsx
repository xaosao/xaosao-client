import { useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Play,
  Star,
  Sparkles,
  Heart,
  Wine,
  Plane,
  PartyPopper,
  BedDouble,
  User,
  Check,
  Crown,
  Users,
  TrendingUp,
  Gift,
  Trophy,
  Infinity as InfinityIcon,
  MapPin,
  Quote,
} from "lucide-react";

import { Header } from "~/components/header";
import { Footer } from "~/components/footer";
import { AppPromoSection } from "~/components/app-promo-section";
import { HowItWorksSection } from "~/components/how-it-works-section";
import { Reveal } from "~/components/reveal";
import { getPublicServices } from "~/services/service.server";
import { getPublicHotModels } from "~/services/model.server";
import type { HotModel } from "~/types/model";
import { goToCta } from "~/utils/platform";

const getServiceIcon = (serviceName: string) => {
  const name = serviceName.toLowerCase();
  if (name.includes("traveling")) return Plane;
  if (name.includes("drinking")) return Wine;
  if (name.includes("hmong") || name.includes("new year") || name.includes("party")) return PartyPopper;
  if (name.includes("sleep") || name.includes("partner") || name.includes("night")) return BedDouble;
  return User;
};

export function meta({ }: Route.MetaArgs) {
  const title = "XaoSao-ເຊົ່າສາວ | SaoSao ບໍລິການສາວ Sao";
  const description =
    "XaoSao (ເຊົ່າສາວ)-ແພລດຟອມເຊົ່າສາວອອນລາຍ ສາວສາວ SaoSao. ຊອກຫາສາວ ຈອງບໍລິການ ນັດພົບ. Find your perfect companion with XaoSao dating app.";
  const url = "https://xaosao.com";
  const image = "https://xaosao.com/icons/icon-512x512.png";
  return [
    { title },
    { name: "description", content: description },
    {
      name: "keywords",
      content:
        "xaosao, saosao, sao, ເຊົ່າສາວ, ສາວສາວ, ສາວ, dating, companion, ນັດພົບ, ບໍລິການສາວ, ເຊົ່າ",
    },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:site_name", content: "XaoSao" },
    { property: "og:locale", content: "lo_LA" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const [services, hotModels] = await Promise.all([
    getPublicServices(),
    getPublicHotModels(20),
  ]);
  return { services, hotModels };
}

const calculateAgeFromDOB = (dob: string | Date): number => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export default function Home({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { services, hotModels } = loaderData;
  const [hasCustomerToken, setHasCustomerToken] = useState(false);

  useEffect(() => {
    const customerToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("whoxa_customer_auth_token="));
    const modelToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("whoxa_model_auth_token="));

    if (customerToken) {
      navigate("/customer", { replace: true });
      return;
    }
    if (modelToken) {
      navigate("/model", { replace: true });
      return;
    }

    setHasCustomerToken(!!customerToken);
  }, [navigate]);

  const getServiceName = (nameKey: string) => {
    const translatedName = t(`modelServices.serviceItems.${nameKey}.name`);
    return translatedName.includes("modelServices.serviceItems") ? nameKey : translatedName;
  };
  const getServiceDescription = (
    nameKey: string,
    fallbackDescription: string | null,
  ) => {
    const translatedDesc = t(`modelServices.serviceItems.${nameKey}.description`);
    if (translatedDesc.includes("modelServices.serviceItems")) {
      return fallbackDescription || t("modelServices.noDescription");
    }
    return translatedDesc;
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "XaoSao",
        alternateName: ["ເຊົ່າສາວ", "SaoSao", "ສາວສາວ", "Sao", "ສາວ"],
        url: "https://xaosao.com",
        description: "XaoSao - ແພລດຟອມເຊົ່າສາວອອນລາຍ. ຊອກຫາສາວ ຈອງບໍລິການ ນັດພົບ.",
      },
      {
        "@type": "Organization",
        name: "XaoSao",
        url: "https://xaosao.com",
        logo: "https://xaosao.com/icons/icon-512x512.png",
        description: "XaoSao (ເຊົ່າສາວ) - Companion dating platform in Laos",
      },
    ],
  };

  // First 4 models become hero collage placeholders
  const heroModels = (hotModels ?? []).slice(0, 4);

  return (
    <div className="min-h-screen bg-[#fffbf8] text-gray-900 font-sans antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      {/* ═══════════════════════════════════════════════════════════════
         HERO — editorial split: copy left, image collage right
      ═══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-24 sm:pt-32 pb-20 sm:pb-32">
        {/* Soft brand wash */}
        <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-rose-200/40 rounded-full blur-3xl -translate-y-1/4 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[50rem] h-[40rem] bg-rose-200/40 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Copy */}
          <Reveal direction="up" className="lg:col-span-6 space-y-8">
            <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm ring-1 ring-rose-100">
              <span className="text-xs font-semibold text-gray-700">
                {t("home.heroBadge", { defaultValue: "Lao's #1 companion platform" })}
              </span>
            </div>

            <h1 className="font-serif text-4xl font-simibold sm:font-bold sm:text-6xl lg:text-7xl text-gray-900 leading-[1.02] tracking-tight">
              {t("home.heroTitleLine1", { defaultValue: "Find someone" })}
              <span className="block">
                {t("home.heroTitleLine2", { defaultValue: "to share" })}{" "}
                <em className="text-rose-500 not-italic font-serif italic">
                  {t("home.heroTitleAccent", { defaultValue: "your moments" })}
                </em>
                .
              </span>
            </h1>

            <p className="text-lg text-gray-600 max-w-xl leading-relaxed">
              {t("home.heroSubtitleNew", {
                defaultValue:
                  "Discover verified companions across Laos. Book a date, a drink, or a trip — all from one beautifully simple app.",
              })}
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => navigate("/video-tutorials")}
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-900 px-4 py-2 rounded-full text-sm font-semibold shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md"
              >
                <Play className="w-4 h-4 fill-rose-500 text-rose-500" />
                {t("home.heroCtaSecondary", { defaultValue: "Watch how it works" })}
              </button>
              <button
                onClick={() => goToCta("/model-auth/login")}
                className="group inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg shadow-rose-500/25 transition-all hover:shadow-xl hover:scale-[1.02]"
              >
                {t("home.heroCtaPrimary", { defaultValue: "Get started" })}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 animate-pulse" />
              </button>
            </div>

            {/* Trust micro-strip */}
            <div className="flex items-center gap-5 pt-4">
              <div className="flex -space-x-2">
                {heroModels.slice(0, 4).map((m, i) => (
                  <div
                    key={m.id ?? i}
                    className="w-9 h-9 rounded-full border-2 border-white overflow-hidden bg-gradient-to-br from-rose-200 to-pink-300"
                  >
                    {m.profile ? (
                      <img
                        src={m.profile}
                        alt={m.firstName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1 text-amber-500">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-gray-900 font-semibold ml-1.5">4.9</span>
                </div>
                <div className="text-xs text-gray-500">
                  {t("home.heroTrustCaption", { defaultValue: "Trusted by 5,000+ users" })}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Device showcase — laptop + phone mockups of the app */}
          <Reveal
            direction="right"
            delay={150}
            className="hidden sm:block lg:col-span-6 relative h-[480px] sm:h-[560px] lg:h-[640px]"
          >
            <HeroDeviceShowcase models={heroModels} t={t} />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
         SERVICES BENTO — one large feature + grid of 3
      ═══════════════════════════════════════════════════════════════ */}
      {services && services.length > 0 && (
        <section className="bg-[#fffbf8] py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <Reveal direction="up" className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 text-rose-500 mb-4">
                  <div className="w-8 h-px bg-rose-500" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                    {t("home.servicesTag", { defaultValue: "Our services" })}
                  </span>
                </div>
                <h2 className="font-serif text-4xl sm:text-5xl text-gray-900 leading-[1.05] tracking-tight">
                  {t("home.servicesTitle", {
                    defaultValue: "Whatever the occasion, we have a match.",
                  })}
                </h2>
              </div>
              <button
                onClick={() => navigate("/register")}
                className="self-start group inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-rose-500 transition-colors"
              >
                {t("home.servicesAll", { defaultValue: "Browse all services" })}
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {services.map((service: { id: string; name: string; description: string | null }, idx: number) => {
                const Icon = getServiceIcon(service.name);
                const isFeatured = idx === 0;
                return (
                  <Reveal
                    key={service.id}
                    direction="up"
                    delay={idx * 80}
                    className={isFeatured ? "md:col-span-2 md:row-span-2" : ""}
                  >
                    <button
                      onClick={() => navigate("/register")}
                      className={`w-full h-full cursor-pointer group relative text-left rounded-lg py-2 px-6 sm:px-4 sm:py-4 transition-all hover:-translate-y-1 hover:shadow-xl ${isFeatured
                        ? "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/20"
                        : "bg-white ring-1 ring-rose-100 shadow-sm"
                        }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isFeatured
                          ? "bg-white/20 backdrop-blur-sm"
                          : "bg-rose-50 group-hover:bg-rose-100 transition-colors"
                          }`}
                      >
                        <Icon
                          className={`w-6 h-6 ${isFeatured ? "text-white" : "text-rose-500"
                            }`}
                          strokeWidth={1.75}
                        />
                      </div>
                      <h3
                        className={`font-serif text-xl sm:text-2xl leading-tight mb-2 ${isFeatured ? "text-white sm:text-3xl" : "text-gray-900"
                          }`}
                      >
                        {getServiceName(service.name)}
                      </h3>
                      <p
                        className={`text-sm leading-relaxed ${isFeatured ? "text-white/85" : "text-gray-600"
                          } ${isFeatured ? "max-w-sm" : "line-clamp-3"}`}
                      >
                        {getServiceDescription(service.name, service.description)}
                      </p>
                      {/* <div
                      className={`mt-6 inline-flex items-center gap-1 text-sm font-semibold ${isFeatured ? "text-white" : "text-rose-500"
                        }`}
                    >
                      {t("home.exploreLink", { defaultValue: "Explore" })}
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </div> */}
                    </button>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         HOW IT WORKS
      ═══════════════════════════════════════════════════════════════ */}
      <HowItWorksSection />

      {/* ═══════════════════════════════════════════════════════════════
         HOT COMPANIONS — magazine-style grid
      ═══════════════════════════════════════════════════════════════ */}
      {hotModels && hotModels.length > 0 && (
        <section className="bg-[#fff8f5] py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <Reveal direction="up" className="flex items-end justify-between mb-12">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 text-rose-500 mb-4">
                  <div className="w-8 h-px bg-rose-500" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                    {t("home.featured.tag", { defaultValue: "Featured" })}
                  </span>
                </div>
                <h2 className="font-serif text-4xl sm:text-5xl text-gray-900 leading-[1.05] tracking-tight">
                  {t("home.featured.title", {
                    defaultValue: "Meet the Sao everyone's talking about.",
                  })}
                </h2>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="hidden sm:inline-flex group items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-rose-500 transition-colors"
              >
                {t("home.featured.viewAll", { defaultValue: "View all" })}
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </Reveal>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {hotModels.slice(0, 8).map((model: HotModel, idx: number) => (
                <Reveal
                  key={model.id}
                  direction="up"
                  delay={idx * 60}
                  className={idx === 0 ? "col-span-2 row-span-2 aspect-square sm:aspect-auto" : "aspect-[3/4]"}
                >
                  <button
                    onClick={() =>
                      navigate(
                        `/login?redirect=${encodeURIComponent(
                          `/customer/user-profile/${model.id}`,
                        )}`,
                      )
                    }
                    className={`w-full h-full group relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-200 to-pink-300 shadow-md hover:shadow-2xl transition-all hover:-translate-y-1`}
                  >
                    {model.profile ? (
                      <img
                        src={model.profile}
                        alt={model.firstName}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <User className="w-16 h-16 text-white/60" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {idx === 0 && (
                      <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
                        <Sparkles className="w-3 h-3 text-rose-500" />
                        <span className="text-[10px] font-semibold text-gray-900 uppercase tracking-wider">
                          {t("home.featured.spotlight", { defaultValue: "Spotlight" })}
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white text-left">
                      <div
                        className={`font-serif leading-tight ${idx === 0 ? "text-2xl sm:text-3xl" : "text-lg"
                          }`}
                      >
                        {model.firstName}
                      </div>
                      <div className="text-xs opacity-90 mt-0.5 flex items-center gap-2">
                        <span>
                          {calculateAgeFromDOB(model.dob)}{" "}
                          {t("discover.yearsOld", { defaultValue: "y.o." })}
                        </span>
                        {model.address && (
                          <>
                            <span className="opacity-60">·</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {model.address}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick view chip — hover-revealed */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-rose-500 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                </Reveal>
              ))}
            </div>

            {/* Mobile view-all */}
            <div className="sm:hidden text-center mt-8">
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-500"
              >
                {t("home.featured.viewAll", { defaultValue: "View all" })}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MEMBERSHIP TIERS — clean pricing cards
      ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-[#fff8f5] py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <Reveal direction="up" className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 text-rose-500 mb-4">
              <div className="w-8 h-px bg-rose-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                {t("home.modelTypes.tag", { defaultValue: "For companions" })}
              </span>
              <div className="w-8 h-px bg-rose-500" />
            </div>
            <h2 className="font-serif text-4xl sm:text-5xl text-gray-900 leading-[1.05] tracking-tight">
              {t("home.modelTypes.title", { defaultValue: "Grow your earnings." })}
            </h2>
            <p className="mt-5 text-gray-600 text-lg">
              {t("home.modelTypes.subtitle", {
                defaultValue:
                  "Start as a Normal companion and unlock higher commissions by referring friends. The more you refer, the more you earn.",
              })}
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Normal */}
            <Reveal direction="up" delay={0}>
              <PricingCard
                tone="rose"
                icon={User}
                name={t("home.modelTypes.normal.name", { defaultValue: "Normal" })}
                condition={t("home.modelTypes.normal.condition", {
                  defaultValue: "Register as a companion",
                })}
                benefits={[
                  {
                    icon: Gift,
                    highlight: "10,000 KIP",
                    text: t("home.modelTypes.normal.bonus", {
                      defaultValue: "per referral (up to 20 people)",
                    }),
                  },
                  {
                    icon: TrendingUp,
                    muted: true,
                    text: t("home.modelTypes.normal.noCommission", {
                      defaultValue: "No booking commission",
                    }),
                  },
                ]}
                footer={t("home.modelTypes.normal.upgradeHint", {
                  defaultValue: "Refer 20 companions to upgrade to Special",
                })}
              />
            </Reveal>

            {/* Special — featured */}
            <Reveal direction="up" delay={100}>
              <PricingCard
                tone="amber"
                featured
                icon={Star}
                name={t("home.modelTypes.special.name", { defaultValue: "Special" })}
                condition={t("home.modelTypes.special.condition", {
                  defaultValue: "Refer 20 companions successfully",
                })}
                benefits={[
                  {
                    icon: TrendingUp,
                    highlight: "2%",
                    text: t("home.modelTypes.special.bookingCommission", {
                      defaultValue: "commission from referred bookings",
                    }),
                  },
                  {
                    icon: Gift,
                    highlight: "20%",
                    text: t("home.modelTypes.special.subscriptionCommission", {
                      defaultValue: "from referred customers' subscriptions",
                    }),
                  },
                  {
                    icon: Users,
                    text: t("home.modelTypes.special.customerReferral", {
                      defaultValue: "Refer customers with referral code",
                    }),
                  },
                  {
                    icon: InfinityIcon,
                    text: t("home.modelTypes.commissionForever", {
                      defaultValue: "Commission forever when conditions are met",
                    }),
                  },
                ]}
                footer={t("home.modelTypes.special.upgradeHint", {
                  defaultValue: "Earn 2,000,000 KIP from referrals to become Partner",
                })}
              />
            </Reveal>

            {/* Partner */}
            <Reveal direction="up" delay={200}>
              <PricingCard
                tone="violet"
                icon={Crown}
                name={t("home.modelTypes.partner.name", { defaultValue: "Partner" })}
                condition={t("home.modelTypes.partner.condition", {
                  defaultValue: "Earn 2,000,000 KIP from referral commissions",
                })}
                benefits={[
                  {
                    icon: TrendingUp,
                    highlight: "4%",
                    text: t("home.modelTypes.partner.bookingCommission", {
                      defaultValue: "commission from referred bookings",
                    }),
                  },
                  {
                    icon: Gift,
                    highlight: "40%",
                    text: t("home.modelTypes.partner.subscriptionCommission", {
                      defaultValue: "from referred customers' subscriptions",
                    }),
                  },
                  {
                    icon: Trophy,
                    text: t("home.modelTypes.partner.vipBenefits", {
                      defaultValue: "VIP support & priority features",
                    }),
                  },
                  {
                    icon: InfinityIcon,
                    text: t("home.modelTypes.commissionForever", {
                      defaultValue: "Commission forever when conditions are met",
                    }),
                  },
                ]}
                footer={t("home.modelTypes.partner.eliteHint", {
                  defaultValue: "Highest earning potential on the platform",
                })}
              />
            </Reveal>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ─── Hero collage ──────────────────────────────────────────────────
 *
 * Asymmetric three-card layout: one large tile + two small tiles.
 * Uses real model photos as visual hooks. A floating "online now"
 * badge on the main tile and a small chat-preview chip in the corner
 * give the collage a sense of life without animations.
 */
function HeroDeviceShowcase({
  models: _models,
  t,
}: {
  models: HotModel[];
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  /*
   * Realistic laptop + phone mockup composition.
   *
   * Both devices show static screenshots of the actual app so the hero
   * doubles as a product demo. Save:
   *   /public/images/hero-laptop-screen.png  — the discover grid
   *   /public/images/hero-phone-screen.png   — the app posts/chat screen
   *
   * The laptop is centered horizontally; the phone sits in front of
   * the laptop's right edge, slightly tilted for dynamic feel.
   */
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* ─── Laptop ───────────────────────────────────────────────
         Screen + chin shell with subtle reflection; rendered as a
         single block so it stays crisp at any width.
      ─────────────────────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 top-1/2 -translate-y-[55%] mx-auto w-full max-w-[620px]">
        {/* Screen bezel */}
        <div className="relative bg-gray-900 rounded-[18px] pt-3 pb-2 px-3 shadow-2xl">
          {/* Camera dot */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gray-700" />

          {/* Screen content */}
          <div className="rounded-[8px] overflow-hidden bg-gray-100 aspect-[16/10] ring-1 ring-black/20">
            <img
              src="/images/hero-laptop-screen.png"
              alt="XaoSao on desktop"
              className="w-full h-full object-cover object-top"
              loading="eager"
            />
          </div>
        </div>

        {/* Laptop base / hinge */}
        <div className="relative">
          <div className="mx-auto bg-gradient-to-b from-gray-300 via-gray-200 to-gray-300 h-3 w-[103%] -ml-[1.5%] rounded-b-[14px] shadow-lg" />
          <div className="mx-auto h-1.5 w-[60%] bg-gray-400/40 rounded-b-full" />
        </div>

        {/* Floor reflection */}
        <div className="mx-auto mt-1 h-6 w-[80%] bg-gradient-to-b from-black/10 to-transparent blur-md rounded-full" />
      </div>

      {/* ─── Phone (slight tilt, in front of laptop's right edge) ── */}
      <div className="absolute right-0 sm:-right-2 lg:-right-6 bottom-2 sm:bottom-4 z-20">
        <div className="rotate-[6deg] origin-bottom-right transition-transform duration-500 hover:rotate-[3deg]">
          <div className="relative w-[190px] sm:w-[230px] aspect-[9/19.5] bg-gray-900 rounded-[2.6rem] p-[6px] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.35)] ring-1 ring-gray-800">
            {/* Dynamic Island */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20" />

            {/* Screen */}
            <div className="relative w-full h-full rounded-[2.2rem] overflow-hidden bg-gray-100">
              <img
                src="/images/hero-phone-screen.png"
                alt="XaoSao mobile app"
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>

            {/* Side buttons */}
            <div className="absolute left-[-2px] top-[22%] w-[3px] h-8 bg-gray-700 rounded-l-full" />
            <div className="absolute left-[-2px] top-[34%] w-[3px] h-12 bg-gray-700 rounded-l-full" />
            <div className="absolute right-[-2px] top-[28%] w-[3px] h-16 bg-gray-700 rounded-r-full" />
          </div>
        </div>
      </div>

      {/* ─── Floating "Available on" chip ────────────────────────── */}
      <div className="absolute top-2 left-2 sm:left-0 z-30 bg-white rounded-full shadow-xl py-2 pl-3 pr-4 flex items-center gap-2 animate-pulse">
        <div className="flex -space-x-1">
          <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center ring-2 ring-white">
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white" fill="currentColor">
              <path d="M17.05 11.97c0-1.95.94-3.42 2.83-4.5-1.06-1.51-2.66-2.34-4.77-2.5-2-.16-4.19 1.18-4.99 1.18-.85 0-2.79-1.12-4.32-1.12C2.5 5.07 0 7.5 0 11.32c0 1.17.21 2.39.64 3.64.57 1.66 2.66 5.74 4.85 5.67 1.14-.03 1.95-.81 3.43-.81 1.44 0 2.19.81 3.46.81 2.21-.03 4.1-3.73 4.64-5.39-2.9-1.36-2.97-3.99-2.97-4.27zM14.27 3.34c1.34-1.59 1.22-3.04 1.18-3.34-1.19.07-2.57.81-3.35 1.72-.86.99-1.37 2.21-1.26 3.41 1.29.1 2.46-.56 3.43-1.79z" />
            </svg>
          </div>
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-white">
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white" fill="currentColor">
              <path d="M3.609 1.814 13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893 2.302 2.302-10.937 6.333 8.635-8.635zm3.171-4.235 2.853 1.653a1 1 0 0 1 0 1.75l-2.853 1.653-2.498-2.498 2.498-2.558zM5.864 2.658 16.802 8.99l-2.302 2.302L5.864 2.658z" />
            </svg>
          </div>
          <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center ring-2 ring-white">
            <span className="text-[8px] text-white font-bold">W</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-gray-900 leading-none">
            {t("home.hero.deviceTitle", { defaultValue: "Available on" })}
          </div>
          <div className="text-[8px] text-gray-500 leading-tight">
            iOS · Android · Web
          </div>
        </div>
      </div>

      {/* ─── Floating "new match" chip ───────────────────────────── */}
      <div className="absolute -bottom-1 left-2 sm:left-0 z-30 bg-white rounded-2xl shadow-2xl p-2.5 max-w-[180px] animate-bounce">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
            <Heart className="w-3.5 h-3.5 text-white fill-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-gray-900 leading-tight">
              {t("home.hero.matchTitle", { defaultValue: "You have a new match!" })}
            </div>
            <div className="text-[9px] text-gray-500 mt-0.5">
              {t("home.hero.matchSubtitle", { defaultValue: "Open the app to chat" })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pricing tier card ─────────────────────────────────────────────
 *
 * Three-tone variant (rose, amber, violet) with a `featured` flag for
 * the middle tier. The featured card is elevated and gets a soft
 * gradient header band; non-featured cards stay quietly white.
 */
function PricingCard({
  tone,
  featured: _featured,
  icon: _Icon,
  name,
  condition,
  benefits,
  footer,
}: {
  tone: "rose" | "amber" | "violet";
  featured?: boolean;
  icon: typeof User;
  name: string;
  condition: string;
  benefits: Array<{
    icon: typeof User;
    text: string;
    highlight?: string;
    muted?: boolean;
  }>;
  footer: string;
}) {
  /*
   * Clean pricing card — each tier gets its own border + check + CTA
   * color so they read as siblings at a glance, not winner/runner-up.
   *
   *   · rose   → Normal
   *   · amber  → Special
   *   · violet → Partner
   */
  // All three tiers share the same rose accent — distinct from each
  // other only by content. `tone` is still accepted for API stability
  // but no longer alters the palette.
  void tone;
  const toneClasses = {
    border: "border-rose-300",
    hoverBorder: "hover:border-rose-400",
    shadow: "hover:shadow-rose-500/10",
    check: "bg-rose-50 text-rose-600",
    highlight: "text-rose-500",
    button:
      "bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20",
  };

  return (
    <div
      className={`relative bg-white rounded-xl p-5 sm:p-6 flex flex-col border ${toneClasses.border} ${toneClasses.hoverBorder} shadow-sm transition-all hover:shadow-xl ${toneClasses.shadow} hover:-translate-y-0.5`}
    >
      {/* Plan name */}
      <h3 className="font-sans text-2xl font-bold text-gray-900 text-center">
        {name}
      </h3>

      {/* Condition line */}
      <p className="text-sm text-gray-500 text-center leading-relaxed">
        {condition}
      </p>

      <div className="my-4 border-t border-gray-100" />

      {/* Benefits list — tone-tinted checks */}
      <ul className="space-y-3.5 flex-1">
        {benefits.map((b, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={`flex-shrink-0 w-5 h-5 rounded-full ${b.muted ? "bg-gray-100 text-gray-400" : toneClasses.check
                } flex items-center justify-center mt-0.5`}
            >
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            <div
              className={`text-sm leading-relaxed ${b.muted ? "text-gray-400" : "text-gray-700"
                }`}
            >
              {b.highlight && (
                <span className={`font-bold ${toneClasses.highlight}`}>
                  {b.highlight}{" "}
                </span>
              )}
              {b.text}
            </div>
          </li>
        ))}
      </ul>

      {/* Upgrade hint */}
      <p className="mt-6 text-xs text-gray-400 text-center leading-relaxed italic">
        {footer}
      </p>

      {/* CTA button — tone-colored */}
      <button
        className={`mt-4 w-full py-3 rounded-xl text-sm font-semibold transition-all ${toneClasses.button}`}
        onClick={() => goToCta("/model-auth/register")}
      >
        Get started
      </button>
    </div>
  );
}
