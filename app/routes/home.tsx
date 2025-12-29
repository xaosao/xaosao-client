import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { useTranslation } from "react-i18next";
import { LogIn, User, Wine, Plane, PartyPopper, BedDouble } from "lucide-react";

// components
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";
import { DynamicSlogan } from "~/components/dynamic-slogan";
import { HeroBackground } from "~/components/hero-background";

// services
import { getPublicServices } from "~/services/service.server";

// Service icon mapping based on service name
const getServiceIcon = (serviceName: string) => {
  const name = serviceName.toLowerCase();
  if (name.includes("traveling")) return Plane;
  if (name.includes("drinking")) return Wine;
  if (name.includes("hmong") || name.includes("new year") || name.includes("party")) return PartyPopper;
  if (name.includes("sleep") || name.includes("partner") || name.includes("night")) return BedDouble;
  return User;
};

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "XaoSao Client" },
    { name: "description", content: "Welcome to XaoSao!" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const services = await getPublicServices();
  return { message: "Hello from Vercel", services };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { services } = loaderData
  const [hasCustomerToken, setHasCustomerToken] = useState(false)

  useEffect(() => {
    // Check for customer auth token
    const customerToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('whoxa_customer_auth_token='))
    setHasCustomerToken(!!customerToken)
  }, [])

  // Helper function to get translated service name
  const getServiceName = (nameKey: string) => {
    const translatedName = t(`modelServices.serviceItems.${nameKey}.name`);
    return translatedName.includes('modelServices.serviceItems') ? nameKey : translatedName;
  };

  // Helper function to get translated service description
  const getServiceDescription = (nameKey: string, fallbackDescription: string | null) => {
    const translatedDesc = t(`modelServices.serviceItems.${nameKey}.description`);
    if (translatedDesc.includes('modelServices.serviceItems')) {
      return fallbackDescription || t("modelServices.noDescription");
    }
    return translatedDesc;
  };

  return (
    <div className="fullscreen safe-area min-h-screen bg-background text-foreground transition-colors duration-300 font-serif">
      <Header />

      <section className="relative min-h-screen flex items-center justify-center">
        <HeroBackground />

        <div className="w-full relative z-10 px-2 mx-auto text-center lg:px-8 leading-3 space-y-4 sm:space-y-8">
          <div className="mb-2 sm:mb-6">
            <DynamicSlogan />

            <p className="hidden sm:block text-white max-w-4xl mx-auto leading-relaxed px-4 text-sm sm:text-md uppercase">
              {t('home.heroSubtitle')}
            </p>
          </div>

          <div className="flex gap-4 justify-center items-center max-w-md mx-auto mb-3 sm:mb-10">
            <Button
              size="lg"
              className="cursor-pointer w-auto bg-rose-500 hover:bg-rose-600 text-white px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium shadow-xl hover:shadow-pink-500/25 transition-all duration-300 transform hover:scale-105 border-0 rounded-lg"
              onClick={() => navigate("/register")}
            >
              <User className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce" />
              {t('home.getStarted')}
            </Button>
            <Button
              size="lg"
              className="flex cursor-pointer w-auto border-border px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium shadow-xl hover:shadow-pink-500/25 transition-all duration-300 transform hover:scale-105 border-0 rounded-lg"
              onClick={() => navigate(hasCustomerToken ? "/customer" : "/login")}
            >
              <LogIn className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              {hasCustomerToken ? t('home.myAccount') : t('home.login')}
            </Button>
          </div>

          {/* <div className="mt-6 sm:mt-8 flex items-center justify-around sm:justify-center space-x-2 sm:space-x-6 text-sm sm:text-md text-white lowercase sm:uppercase">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
              <span className="font-light">{t('home.freeToJoin')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
              <span className="font-light">{t('home.verifiedProfiles')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
              <span className="font-light">{t('home.safeSecure')}</span>
            </div>
          </div> */}

          {services && services.length > 0 && (
            <section className="py-4 px-1 sm:px-4">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 text-white">
                  {t('home.ourServices', { defaultValue: 'Our Services' })}
                </h2>

                {/* Services Grid - 2 cols mobile, 2 cols tablet, 4 cols desktop */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-6">
                  {services.map((service: { id: string; name: string; description: string | null }) => {
                    const IconComponent = getServiceIcon(service.name);
                    return (
                      <div
                        key={service.id}
                        className="group bg-black/20 border border-rose-500 rounded-sm p-3 sm:p-6 hover:shadow-lg hover:border-rose-500/50 transition-all duration-300 cursor-pointer space-y-1 sm:space-y-2"
                        onClick={() => navigate("/register")}
                      >
                        <div className="flex flex-col sm:flex-row items-center sm:items-center justify-start gap-1 sm:gap-2">
                          <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center group-hover:bg-rose-500 transition-colors duration-300">
                            <IconComponent className="w-4 h-4 text-rose-500 group-hover:text-white transition-colors duration-300" />
                          </div>
                          <h3 className="mt-2 sm:mt-0 text-md sm:text-lg font-semibold text-white text-center sm:text-left">
                            {getServiceName(service.name)}
                          </h3>
                        </div>
                        <p className="text-center sm:text-start text-xs sm:text-sm text-white line-clamp-2 sm:line-clamp-3">
                          {getServiceDescription(service.name, service.description)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>
      </section>

    </div>
  )
}
