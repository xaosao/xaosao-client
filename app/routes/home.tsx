import { useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { LogIn, User, Wine, Plane, PartyPopper, BedDouble, ArrowRight, Play, Gift, Users, Trophy, Sparkles, MapPin, Calendar, ChevronLeft, ChevronRight, Flame, Mouse } from "lucide-react";

// Swiper
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Navigation } from "swiper/modules";

// components
import Rating from "~/components/ui/rating";
import { Header } from "~/components/header";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DynamicSlogan } from "~/components/dynamic-slogan";
import { HeroBackground } from "~/components/hero-background";

// services
import { Footer } from "~/components/footer";
import { getPublicServices } from "~/services/service.server";
import { getPublicHotModels } from "~/services/model.server";

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
  const [services, hotModels] = await Promise.all([
    getPublicServices(),
    getPublicHotModels(20),
  ]);
  return { services, hotModels };
}

// Helper to calculate age from DOB
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

interface HotModel {
  id: string;
  firstName: string;
  lastName: string | null;
  dob: Date;
  gender: string;
  bio: string | null;
  profile: string | null;
  rating: number;
  total_review: number;
  address: string | null;
  available_status: string;
  Images: { id: string; name: string }[];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { services, hotModels } = loaderData
  const [hasCustomerToken, setHasCustomerToken] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<HotModel | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const modelItemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    // Check for auth tokens
    const customerToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('whoxa_customer_auth_token='))
    const modelToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('whoxa_model_auth_token='))

    // Auto-redirect if logged in (customer takes priority)
    if (customerToken) {
      navigate('/customer', { replace: true })
      return
    }
    if (modelToken) {
      navigate('/model', { replace: true })
      return
    }

    setHasCustomerToken(!!customerToken)
  }, [navigate])

  // Set first model as selected when hotModels loads
  useEffect(() => {
    if (hotModels && hotModels.length > 0 && !selectedProfile) {
      setSelectedProfile(hotModels[0]);
    }
  }, [hotModels, selectedProfile]);

  const handleProfileClick = (modelId: string) => {
    const model = hotModels?.find((m: HotModel) => m.id === modelId);
    if (model) {
      setSelectedProfile(model);
      // Scroll to the selected model in the horizontal list
      const element = modelItemRefs.current.get(modelId);
      if (element && scrollContainerRef.current) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  const handleViewProfile = (modelId: string) => {
    // Redirect to login with redirect param to model profile
    navigate(`/login?redirect=${encodeURIComponent(`/customer/user-profile/${modelId}`)}`);
  };

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

          <div className="flex flex-col items-center max-w-md mx-auto mb-3 sm:mb-10 space-y-4">
            <div className="flex gap-4 justify-center items-center">
              <Button
                size="lg"
                className="cursor-pointer w-auto bg-rose-500 hover:bg-rose-600 text-white px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium shadow-xl hover:shadow-pink-500/25 transition-all duration-300 transform hover:scale-105 border-0 rounded-lg"
                onClick={() => navigate("/video-tutorials")}
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce" />
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

            <p className="text-white/80 text-xs sm:text-sm">
              {t('home.customerLoginHint', { defaultValue: '👆 For customers looking for companions' })}
            </p>
          </div>

          {services && services.length > 0 && (
            <section className="py-4 px-1 sm:px-4">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-md sm:text-lg text-center mb-4 text-white">
                  {t('home.ourServices', { defaultValue: 'Our Services' })}
                </h2>

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

          {/* Companion/Model login section */}
          <div className="flex items-center justify-center py-2 text-center">
            <p className="text-white text-md">
              {t('home.areYouCompanion', { defaultValue: 'Are you a companion?' })}
            </p>
            <button
              onClick={() => navigate("/model-auth/login")}
              className="text-md text-bold cursor-pointer text-white hover:text-rose-500 font-medium transition-all duration-200 inline-flex items-center gap-2 px-4 rounded-lg hover:bg-white/5 hover:border-rose-500/50 underline"
            >
              {t('home.companionLoginHere', { defaultValue: 'Login here' })}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full flex items-center justify-center mt-6">
            <Mouse className="animate-bounce text-white" />
          </div>
        </div>
      </section>

      {/* Hot Models Preview Section */}
      {hotModels && hotModels.length > 0 && (
        <section className="py-12 sm:py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-rose-500" />
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                    {t('home.hotModels.title', { defaultValue: 'Hot Companions' })}
                  </h2>
                </div>
                <p className="text-sm text-gray-600">
                  {t('home.hotModels.subtitle', { defaultValue: 'Discover our most popular companions' })}
                </p>
              </div>
              <Button
                variant="outline"
                className="text-rose-500 border-rose-500 hover:bg-rose-50"
                onClick={() => navigate('/login')}
              >
                {t('home.hotModels.viewAll', { defaultValue: 'View All' })}
              </Button>
            </div>

            {/* Models Horizontal Scroll */}
            <div
              ref={scrollContainerRef}
              className="flex items-center justify-start space-x-6 overflow-x-auto overflow-y-hidden whitespace-nowrap py-4"
              style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
            >
              {hotModels.map((model: HotModel) => (
                <div
                  key={model.id}
                  ref={(el) => {
                    if (el) modelItemRefs.current.set(model.id, el);
                  }}
                  className="flex-shrink-0 cursor-pointer"
                  onClick={() => handleProfileClick(model.id)}
                >
                  <div
                    className={`text-center overflow-hidden space-y-2 transition-colors ${selectedProfile?.id === model.id
                      ? "text-rose-500 border-b-2 border-rose-500 pb-1"
                      : ""
                      }`}
                  >
                    <div
                      className={`border-3 ${selectedProfile?.id === model.id
                        ? "border-rose-500"
                        : "border-gray-300"
                        } rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center hover:border-rose-500 overflow-hidden transition-colors`}
                    >
                      {model?.profile ? (
                        <img
                          src={model.profile}
                          alt={model.firstName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm truncate max-w-[80px]">{model.firstName}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Profile Preview */}
            {selectedProfile && (
              <div className="flex flex-col sm:flex-row gap-6 mt-6">
                <div className="bg-gray-800 rounded-lg overflow-hidden w-full sm:w-1/2">
                  <Swiper
                    modules={[Pagination, Navigation]}
                    navigation={{
                      prevEl: ".home-prev",
                      nextEl: ".home-next",
                    }}
                    pagination={{ clickable: true }}
                    spaceBetween={10}
                    className="w-full h-80 sm:h-96 custom-swiper1 border-2 border-rose-500 rounded-lg"
                  >
                    {selectedProfile?.Images?.length ? (
                      selectedProfile.Images.map((img) => (
                        <SwiperSlide key={img.id}>
                          <div className="relative cursor-pointer" onClick={() => handleViewProfile(selectedProfile.id)}>
                            <img
                              src={img.name}
                              alt={selectedProfile.firstName}
                              className="w-full h-80 sm:h-96 object-cover"
                            />
                            <div className="absolute bottom-4 left-4 text-white">
                              <h3 className="flex items-center text-lg font-semibold text-shadow-lg">
                                <User size={16} className="mr-1" />
                                {selectedProfile.firstName} {selectedProfile.lastName}
                              </h3>
                              <p className="flex items-center text-sm text-shadow-lg">
                                <Calendar size={14} className="mr-1" />
                                {calculateAgeFromDOB(selectedProfile.dob)} {t('discover.yearsOld', { defaultValue: 'years old' })}
                              </p>
                              {selectedProfile.address && (
                                <p className="flex items-center text-sm text-shadow-lg">
                                  <MapPin size={14} className="mr-1" />
                                  {selectedProfile.address}
                                </p>
                              )}
                            </div>
                            
                            <div className="absolute top-4 right-4">
                              <Badge className="bg-rose-500 text-white hover:bg-rose-600 cursor-pointer">
                                {t('home.hotModels.viewProfile', { defaultValue: 'View Profile' })}
                              </Badge>
                            </div>
                          </div>
                        </SwiperSlide>
                      ))
                    ) : (
                      <SwiperSlide>
                        <div className="relative cursor-pointer" onClick={() => handleViewProfile(selectedProfile.id)}>
                          {selectedProfile.profile ? (
                            <img
                              src={selectedProfile.profile}
                              alt={selectedProfile.firstName}
                              className="w-full h-80 sm:h-96 object-cover"
                            />
                          ) : (
                            <div className="w-full h-80 sm:h-96 bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center">
                              <User className="w-24 h-24 text-white" />
                            </div>
                          )}
                          <div className="absolute bottom-4 left-4 text-white">
                            <h3 className="flex items-center text-lg font-semibold text-shadow-lg">
                              <User size={16} className="mr-1" />
                              {selectedProfile.firstName} {selectedProfile.lastName}
                            </h3>
                            <p className="flex items-center text-sm text-shadow-lg">
                              <Calendar size={14} className="mr-1" />
                              {calculateAgeFromDOB(selectedProfile.dob)} {t('discover.yearsOld', { defaultValue: 'years old' })}
                            </p>
                          </div>
                         
                          <div className="absolute top-4 right-4">
                            <Badge className="bg-rose-500 text-white hover:bg-rose-600 cursor-pointer">
                              {t('home.hotModels.viewProfile', { defaultValue: 'View Profile' })}
                            </Badge>
                          </div>
                        </div>
                      </SwiperSlide>
                    )}
                    <button className="home-prev hidden"><ChevronLeft className="h-5 w-5" /></button>
                    <button className="home-next hidden"><ChevronRight className="h-5 w-5" /></button>
                  </Swiper>
                </div>
               
                <div className="hidden sm:block w-1/2 rounded-lg p-6 bg-rose-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800">
                      {t('discover.about', { defaultValue: 'About' })} - {selectedProfile.firstName}
                    </h2>
                    <Button
                      size="sm"
                      className="bg-rose-500 hover:bg-rose-600 text-white"
                      onClick={() => handleViewProfile(selectedProfile.id)}
                    >
                      {t('home.hotModels.viewProfile', { defaultValue: 'View Profile' })}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">{t('discover.fullName', { defaultValue: 'Full Name' })}</p>
                      <p className="font-medium">{selectedProfile.firstName} {selectedProfile.lastName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('register.gender', { defaultValue: 'Gender' })}</p>
                      <p className="font-medium capitalize">{selectedProfile.gender}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('discover.age', { defaultValue: 'Age' })}</p>
                      <p className="font-medium">{calculateAgeFromDOB(selectedProfile.dob)} {t('discover.yearsOld', { defaultValue: 'years old' })}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('discover.rating', { defaultValue: 'Rating' })}</p>
                      <div className="flex items-center gap-1">
                        {selectedProfile.rating > 0 ? (
                          <Rating value={selectedProfile.rating} />
                        ) : (
                          <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200">
                            {t('discover.noRating', { defaultValue: 'No rating yet' })}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {selectedProfile.address && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500">{t('discover.address', { defaultValue: 'Address' })}</p>
                        <p className="font-medium">{selectedProfile.address}</p>
                      </div>
                    )}
                  </div>

                  {selectedProfile.bio && (
                    <div>
                      <p className="text-sm text-gray-500">{t('discover.bio', { defaultValue: 'Bio' })}</p>
                      <p className="font-medium line-clamp-3">{selectedProfile.bio}</p>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Referral Benefits Section */}
      <section className="relative py-16 sm:py-24 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-rose-500/20 border border-rose-500/30 rounded-full px-4 py-2 mb-4">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <span className="text-rose-300 text-sm font-medium">{t('home.benefits.badge')}</span>
            </div>
            <h2 className="text-xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              {t('home.benefits.title')}
            </h2>
            <p className="text-gray-400 text-md max-w-2xl mx-auto">
              {t('home.benefits.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-4">
            <div className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-md p-6 sm:p-8 hover:border-rose-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-rose-500/10 hover:-translate-y-1">
              <div className="border border-red-500 absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all duration-500" />
              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-sm flex items-center justify-center mb-6 shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Gift className="w-5 h-5 text-white" />
                  </div>

                  <div>
                    <span className="text-gray-400 text-sm uppercase tracking-wider">{t('home.benefits.tier1.label')}</span>
                    <h3 className="text-xl sm:text-2xl font-bold text-white">
                      50,000 <span className="text-rose-400 text-lg">KIP</span>
                    </h3>
                  </div>
                </div>

                <p className="text-gray-400 leading-relaxed">
                  {t('home.benefits.tier1.description')}
                </p>

                <div className="mt-6 pt-6 border-t border-gray-700/50">
                  <div className="flex items-center gap-2 text-rose-400">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">{t('home.benefits.tier1.hint')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-md p-6 sm:p-8 hover:border-amber-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all duration-500" />

              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-md flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Users className="w-5 h-5 text-white" />
                  </div>

                  <div className="mb-4">
                    <span className="text-gray-400 text-sm uppercase tracking-wider">{t('home.benefits.tier2.label')}</span>
                    <h3 className="text-xl sm:text-2xl font-bold text-white">
                      1,000,000 <span className="text-amber-400 text-lg">KIP</span>
                    </h3>
                  </div>
                </div>

                <p className="text-gray-400 leading-relaxed">
                  {t('home.benefits.tier2.description')}
                </p>

                <div className="mt-6 pt-6 border-t border-gray-700/50">
                  <div className="flex items-center gap-2 text-amber-400">
                    <div className="flex -space-x-1">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-5 h-5 bg-amber-500/30 rounded-full border-2 border-gray-800 flex items-center justify-center">
                          <User className="w-3 h-3 text-amber-400" />
                        </div>
                      ))}
                    </div>
                    <span className="text-sm font-medium">{t('home.benefits.tier2.hint')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-md p-6 sm:p-8 hover:border-emerald-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />

              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-md flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>

                  <div className="mb-4">
                    <span className="text-gray-400 text-sm uppercase tracking-wider">{t('home.benefits.tier3.label')}</span>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
                      {t('home.benefits.tier3.prize')}
                    </h3>
                  </div>
                </div>

                <p className="text-gray-400 leading-relaxed">
                  {t('home.benefits.tier3.description')}
                </p>

                <div className="mt-6 pt-6 border-t border-gray-700/50">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('home.benefits.tier3.hint')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12 sm:mt-16">
            <Button
              size="lg"
              className="cursor-pointer bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white px-8 py-4 text-sm shadow-xl shadow-rose-500/25 hover:shadow-rose-500/40 transition-all duration-300 transform hover:scale-105 border-0 rounded-xl"
              onClick={() => navigate("/model-auth/login?redirect=/model/referral")}
            >
              <Gift className="w-4 h-4" />
              {t('home.benefits.cta')}
            </Button>
            <p className="text-gray-500 text-sm mt-4">
              {t('home.benefits.ctaHint')}
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
