import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ArrowLeft, History } from "lucide-react"
import { Link, useNavigate, type LoaderFunction } from "react-router"

// components:
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"

import { requireUserSession } from "~/services/auths.server";
import { getPackages } from "~/services/package.server"
import { calculateDiscountPercent, formatCurrency } from "~/utils"
import type { ISubscriptionPlanWithCurrentResponse } from "~/interfaces/packages"

// Helper function to get package translation key from database name
const getPackageKey = (name: string): string => {
   const nameMap: Record<string, string> = {
      '1 week': '1Week',
      '1 month': '1Month',
      '3 months': '3Months',
   };
   return nameMap[name.toLowerCase()] || name.replace(/\s+/g, '');
};

// Feature keys mapping from database feature names to translation keys
const featureKeyMap: Record<string, string> = {
   'Unlimited Profile Likes': 'unlimitedLikes',
   'Smart Pass & Skip Option': 'smartPass',
   'Advanced Partner Filtering Tools': 'advancedFiltering',
   'Private In-App Chat Access': 'privateChat',
   'Easy Date Booking System': 'easyBooking',
   'Profile Boost & Spotlight': 'profileBoost',
   'Ad-Free User Experience': 'adFree',
   'Priority Customer Support': 'prioritySupport',
};

interface LoaderReturn {
   plans: ISubscriptionPlanWithCurrentResponse[];
}

interface TransactionProps {
   loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
   const customerId = await requireUserSession(request)
   const plans = await getPackages(customerId)
   return { plans }
}


export default function PricingPage({ loaderData }: TransactionProps) {
   const { plans } = loaderData
   // console.log("Plans:::", plans);
   const { t } = useTranslation();

   const navigate = useNavigate()

   // Find the first non-current plan or popular plan for mobile default selection
   const defaultSelectedPlan = plans.find(p => !p.current && p.isPopular) || plans.find(p => !p.current) || plans[0];
   const [selectedPlan, setSelectedPlan] = useState<ISubscriptionPlanWithCurrentResponse>(defaultSelectedPlan)

   return (
      <div className="sm:min-h-screen relative overflow-hidden px-3 sm:px-0">
         <nav className="relative z-10 p-6">
            <div className="container mx-auto flex items-center justify-between">
               <button
                  onClick={() => navigate(-1)}
                  className="flex items-center space-x-2 group"
               >
                  <ArrowLeft className="h-5 w-5 text-rose-500 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-sm font-light text-gray-600 group-hover:text-rose-500 transition-colors">
                     {t('packages.list.back')}
                  </span>
               </button>
               <Link
                  to="/customer/subscription-history"
                  className="flex items-center space-x-2 px-4 py-2 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors"
               >
                  <History className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('packages.list.viewHistory')}</span>
               </Link>
            </div>
         </nav>

         <div className="hidden sm:block container mx-auto px-8 relative z-10">
            <div className="text-center mb-4 sm:mb-12">
               <div className="inline-flex items-center justify-center p-1 bg-gradient-to-r from-rose-100 to-pink-100 rounded-full mb-3">
                  <span className="text-sm font-light text-rose-600 px-4 py-1 bg-white rounded-full shadow-sm">
                     {t('packages.list.chooseYourPlan')}
                  </span>
               </div>
               <p className="hidden sm:block text-md font-light text-gray-600 max-w-3xl mx-auto mb-8">
                  {t('packages.list.subtitle')}
               </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-16">
               {plans.map((plan) => (
                  <Card
                     key={plan.name}
                     className={`py-2 cursor-pointer relative bg-white/80 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 
                        ${plan.current ? "ring-1 ring-rose-500" : !plans.some((p) => p.current) && plan.isPopular ? "ring-1 ring-rose-500" : ""}`}
                  >
                     {plan.current ? (
                        <div className="absolute -top-3 right-1/2 -translate-x-1/2">
                           <span className="bg-rose-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                              {t('packages.list.currentPlan')}
                           </span>
                        </div>
                     ) : !plans.some((p) => p.current) && plan.isPopular ? (
                        <div className="absolute -top-3 right-1/2 -translate-x-1/2">
                           <span className="bg-rose-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                              {t('packages.list.mostPopular')}
                           </span>
                        </div>
                     ) : null}

                     <CardContent className="p-4">
                        <div className="text-center mb-4 space-y-2">
                           <h3 className="text-xl font-bold text-gray-800">
                              {t(`packages.items.${getPackageKey(plan.name)}.name`, { defaultValue: plan.name })}
                           </h3>
                           <p className="text-gray-600 font-light">
                              {t(`packages.items.${getPackageKey(plan.name)}.description`, { defaultValue: plan.description })}
                           </p>
                           <div className="mb-6">
                              <p className="text-xl font-light text-gray-900">
                                 {formatCurrency(plan.price)}
                                 <span className="text-sm ml-2 text-rose-500">({t('packages.list.save')} {calculateDiscountPercent(30000, 7, plan.price, plan.durationDays)}%)</span>
                              </p>
                           </div>
                        </div>

                        <div className="space-y-4 mb-8">
                           {plan.features && Object.values(plan.features).map((feature, featureIndex) => {
                              const featureKey = featureKeyMap[feature as string];
                              return (
                                 <div key={featureIndex} className="flex items-center space-x-3 text-sm">
                                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span className="text-gray-700 font-light">
                                       {featureKey ? t(`packages.features.${featureKey}`) : feature}
                                    </span>
                                 </div>
                              );
                           })}
                        </div>

                        <Button
                           className={`w-full font-light py-3 rounded-md transition-all duration-300 ${plan.current
                              ? "bg-rose-500 text-white cursor-not-allowed opacity-75"
                              : !plans.some((p) => p.current) && plan.isPopular ? "bg-rose-500 text-white hover:shadow-lg hover:bg-rose-600 hover:text-white"
                                 : "bg-white text-black border hover:border-rose-500 hover:bg-rose-500 hover:text-white"
                              }`}
                           variant={plan.isPopular ? "default" : "outline"}
                           onClick={() => !plan.current && navigate(`/customer/payment/${plan.id}`)}
                           disabled={plan.current}
                        >
                           {plan.current ? t('packages.list.currentPlan') : t('packages.list.selectPlan')}
                        </Button>
                     </CardContent>
                  </Card>
               ))}
            </div>
         </div>

         <div className="sm:hidden p-2 rounded-md space-y-0 pb-20">
            <div className="text-center">
               <div className="inline-flex items-center justify-center p-1 bg-gradient-to-r from-rose-100 to-pink-100 rounded-full mb-3">
                  <span className="text-sm font-light text-rose-600 px-4 py-1 bg-white rounded-full shadow-sm">
                     {t('packages.list.chooseYourPlan')}
                  </span>
               </div>
               <p className="text-sm font-light text-gray-600 max-w-3xl mx-auto mb-4">
                  {t('packages.list.subtitle')}
               </p>
            </div>
            <div className="flex items-start justify-start w-full">
               <Swiper
                  modules={[Navigation, Pagination]}
                  navigation={{
                     prevEl: ".custom-prev",
                     nextEl: ".custom-next",
                  }}
                  pagination={{ clickable: true }}
                  spaceBetween={5}
                  slidesPerView={2}
                  className="flex items-center custom-swiper2"
               >
                  {plans.map((plan) => (
                     <SwiperSlide key={plan.id}>
                        <Card
                           onClick={() => setSelectedPlan(plan)}
                           className={`py-2 cursor-pointer relative backdrop-blur-xl transition-all duration-300 border-2
                              ${plan.current
                                 ? "bg-rose-500 text-white border-rose-600 ring-2 ring-rose-300"
                                 : selectedPlan.id === plan.id
                                    ? "bg-rose-100 border-rose-400 ring-1 ring-rose-200"
                                    : "bg-white/80 border-gray-200 hover:border-rose-300"
                              }`}
                        >
                           {plan.current ? (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                                 <span className="bg-white text-rose-500 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
                                    {t('packages.list.currentPlan')}
                                 </span>
                              </div>
                           ) : selectedPlan.id === plan.id ? (
                              <div className="absolute -top-2 -right-2 bg-rose-500 rounded-full p-1">
                                 <Check className="h-4 w-4 text-white" />
                              </div>
                           ) : null}
                           <CardContent className="p-1">
                              <div className="text-center mb-4 space-y-2">
                                 <h3 className={`text-lg font-bold ${plan.current ? "text-white" : "text-gray-800"}`}>
                                    {t(`packages.items.${getPackageKey(plan.name)}.name`, { defaultValue: plan.name })}
                                 </h3>
                                 <p className={`text-md font-light ${plan.current ? "text-white" : "text-gray-900"}`}>
                                    {formatCurrency(plan.price)}
                                 </p>
                                 <span className={`text-sm ${plan.current ? "text-white" : "text-rose-500"}`}>
                                    ({t('packages.list.save')} {calculateDiscountPercent(30000, 7, plan.price, plan.durationDays)}%)
                                 </span>
                              </div>
                           </CardContent>
                        </Card>
                     </SwiperSlide>
                  ))}
               </Swiper>
            </div>

            {/* Display selected plan details */}
            <div className={`mt-4 p-3 rounded-lg border ${selectedPlan.current ? "bg-rose-100 border-rose-300" : "bg-rose-50 border-rose-200"}`}>
               <div className="flex items-center justify-between mb-2">
                  <h4 className="text-md font-bold text-gray-800">
                     {t(`packages.items.${getPackageKey(selectedPlan.name)}.name`, { defaultValue: selectedPlan.name })} - {t('packages.list.features')}
                  </h4>
                  {selectedPlan.current && (
                     <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-xs font-medium">
                        {t('packages.list.currentPlan')}
                     </span>
                  )}
               </div>
               <p className="text-sm text-gray-600 mb-3">
                  {t(`packages.items.${getPackageKey(selectedPlan.name)}.description`, { defaultValue: selectedPlan.description })}
               </p>
            </div>

            <div className="space-y-4 mb-8 w-full px-3 py-4 border rounded-md">
               {selectedPlan.features && Object.values(selectedPlan.features).map((feature, index) => {
                  const featureKey = featureKeyMap[feature as string];
                  return (
                     <div key={index} className="flex items-center space-x-3 text-sm">
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700 font-light">
                           {featureKey ? t(`packages.features.${featureKey}`) : feature}
                        </span>
                     </div>
                  );
               })}
            </div>

            <div className="fixed bottom-0 z-50 bg-white w-full h-auto left-0 p-3 border-t shadow-lg">
               <Button
                  size="lg"
                  onClick={() => navigate(`/customer/payment/${selectedPlan.id}`)}
                  disabled={selectedPlan.current}
                  className={`w-full py-3 rounded-md transition-all duration-300 ${selectedPlan.current
                     ? "bg-gray-400 text-white cursor-not-allowed"
                     : "bg-rose-500 text-white hover:shadow-lg hover:bg-rose-600"
                     }`}
                  variant={"outline"}
               >
                  {selectedPlan.current ? t('packages.list.currentPlan') : t('packages.list.continue')}
               </Button>
            </div>
         </div>
      </div >
   )
}
