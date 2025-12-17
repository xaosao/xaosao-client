import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useNavigation, type LoaderFunction } from "react-router"
import { Calendar, MapPin, DollarSign, Clock, Shirt, MoreVertical, UserRoundCheck, Headset, Loader, Search, Info, Shield, Wallet, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Phone, MessageCircleMore } from "lucide-react"

// components:
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"

// interface and service
import type { IServiceBooking } from "~/interfaces/service"
import { requireUserSession } from "~/services/auths.server";
import { getAllMyServiceBookings } from "~/services/booking.server"
import { calculateAgeFromDOB, formatCurrency, formatDate } from "~/utils"

const statusConfig: Record<string, { label: string; className: string }> = {
   pending: {
      label: "Pending",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
   },
   confirmed: {
      label: "Confirmed",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
   },
   in_progress: {
      label: "In Progress",
      className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
   },
   awaiting_confirmation: {
      label: "Awaiting Your Confirmation",
      className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
   },
   completed: {
      label: "Completed",
      className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
   },
   cancelled: {
      label: "Cancelled",
      className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
   },
   rejected: {
      label: "Rejected",
      className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
   },
   disputed: {
      label: "Disputed",
      className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
   },
}

interface LoaderReturn {
   bookInfos: IServiceBooking[];
   hasActiveSubscription: boolean;
}

interface DiscoverPageProps {
   loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
   const customerId = await requireUserSession(request)
   const { hasActiveSubscription } = await import("~/services/package.server");

   const [bookInfos, hasSubscription] = await Promise.all([
      getAllMyServiceBookings(customerId),
      hasActiveSubscription(customerId),
   ]);

   return { bookInfos, hasActiveSubscription: hasSubscription };
}

export default function BookingsList({ loaderData }: DiscoverPageProps) {
   const { t } = useTranslation()
   const navigate = useNavigate()
   const navigation = useNavigation()
   const { bookInfos } = loaderData
   const isLoading = navigation.state === "loading";
   const [isPolicyOpen, setIsPolicyOpen] = useState(false);

   const getServiceName = (booking: IServiceBooking): string => {
      const serviceName = booking.modelService?.service?.name;
      if (!serviceName) return t("booking.serviceUnavailable");
      return t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName });
   };

   const getStatusLabel = (status: string): string => {
      return t(`booking.status.${status}`, { defaultValue: statusConfig[status]?.label || status });
   };

   if (isLoading) {
      return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2">
               <Loader className="w-4 h-4 text-rose-500 animate-spin" />
               <p className="text-rose-600">{t('booking.loading')}</p>
            </div>
         </div>
      );
   }

   return (
      <div className="container space-y-2 pt-2 sm:pt-8 px-4 sm:px-10">
         <div className="flex items-start justify-between bg-rose-100 sm:bg-white w-full p-3 sm:px-0 rounded-md">
            <div className="space-y-1">
               <h1 className="text-sm sm:text-md sm:font-bold text-gray-800 uppercase text-shadow-md">{t('booking.title')}</h1>
               <p className="text-xs sm:text-md font-normal text-gray-600">
                  {t('booking.subtitle')}
               </p>
            </div>
         </div>

         <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
            <button
               type="button"
               onClick={() => setIsPolicyOpen(!isPolicyOpen)}
               className="flex items-center justify-between w-full cursor-pointer"
            >
               <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-amber-600 shrink-0" />
                  <h3 className="text-sm font-semibold text-amber-900">{t('booking.policy.title')}</h3>
               </div>
               <div>
                  {isPolicyOpen ? (
                     <ChevronUp className="h-4 w-4 text-amber-600" />
                  ) : (
                     <ChevronDown className="h-4 w-4 text-amber-600" />
                  )}
               </div>
            </button>
            <div className={`mt-3 pl-8 ${isPolicyOpen ? 'block' : 'hidden'}`}>
               <ul className="text-xs text-amber-800 space-y-2">
                  <li className="flex items-center gap-2">
                     <Wallet className="h-3 w-3" />
                     <span>{t('booking.policy.paymentHeld')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <MapPin className="h-3 w-3" />
                     <span>{t('booking.policy.gpsCheckin')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Info className="h-3 w-3" />
                     <span>{t('booking.policy.confirmOrDispute')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <AlertTriangle className="h-3 w-3" />
                     <span className="font-medium">{t('booking.policy.cancellationNotice')}</span>
                  </li>
               </ul>
            </div>
         </div>

         {bookInfos && bookInfos.length > 0 ? (
            <div className="w-full grid gap-3 md:grid-cols-3 lg:grid-cols-4">
               {bookInfos.map((booking) => (
                  <Card
                     key={booking.id}
                     className="border hover:shadow-md transition-shadow rounded-sm"
                  >
                     <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                           <div className="space-y-2 flex-1">
                              <h3 className="text-md leading-tight text-balance">
                                 {getServiceName(booking)}
                              </h3>
                              <Badge
                                 variant="outline"
                                 className={statusConfig[booking.status]?.className || "bg-gray-500/10 text-gray-700 border-gray-500/20"}
                              >
                                 {getStatusLabel(booking.status)}
                              </Badge>
                           </div>

                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                 </Button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent align="end">
                                 <DropdownMenuItem
                                    onClick={() =>
                                       navigate(`/customer/book-service/detail/${booking.id}`)
                                    }
                                    className="cursor-pointer"
                                 >
                                    {t('booking.viewDetails')}
                                 </DropdownMenuItem>

                                 {booking.status === "pending" && (
                                    <>
                                       <DropdownMenuItem
                                          onClick={() =>
                                             navigate(`/customer/book-service/edit/${booking.id}`)
                                          }
                                          className="cursor-pointer"
                                       >
                                          {t('booking.editBooking')}
                                       </DropdownMenuItem>
                                       <DropdownMenuItem
                                          className="text-destructive cursor-pointer"
                                          onClick={() =>
                                             navigate(`/customer/book-service/cancel/${booking.id}`)
                                          }
                                       >
                                          {t('booking.cancelBooking')}
                                       </DropdownMenuItem>
                                    </>
                                 )}

                                 {booking.status === "confirmed" && (
                                    <>
                                       <DropdownMenuItem
                                          onClick={() =>
                                             navigate(`/customer/book-service/checkin/${booking.id}`)
                                          }
                                          className="cursor-pointer"
                                       >
                                          {t('booking.checkIn')}
                                       </DropdownMenuItem>
                                       {booking.model?.whatsapp && (
                                          <DropdownMenuItem
                                             onClick={() => window.open(`tel:${booking.model.whatsapp}`, "_self")}
                                             className="cursor-pointer text-blue-600"
                                          >
                                             <Phone className="h-4 w-4" />
                                             {t('booking.callModel')}
                                          </DropdownMenuItem>
                                       )}
                                    </>
                                 )}

                                 {booking.model?.whatsapp && (
                                    <DropdownMenuItem
                                       onClick={() => {
                                          const bookingUrl = `${window.location.origin}/model/dating/detail/${booking.id}`;
                                          const message = t("booking.whatsappMessage", {
                                             modelName: booking.model.firstName,
                                             serviceName: getServiceName(booking),
                                             date: formatDate(String(booking.startDate)),
                                             bookingUrl
                                          });
                                          window.open(`https://wa.me/${booking.model.whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
                                       }}
                                       className="cursor-pointer text-green-600"
                                    >
                                       <MessageCircleMore className="h-4 w-4" />
                                       {t('booking.messageModel')}
                                    </DropdownMenuItem>
                                 )}

                                 {booking.status === "awaiting_confirmation" && (
                                    <>
                                       <DropdownMenuItem
                                          onClick={() =>
                                             navigate(`/customer/confirm-booking/${booking.id}`)
                                          }
                                          className="cursor-pointer text-emerald-600"
                                       >
                                          <CheckCircle2 className="h-4 w-4" />
                                          {t('booking.confirmRelease')}
                                       </DropdownMenuItem>
                                       <DropdownMenuItem
                                          onClick={() =>
                                             navigate(`/customer/book-service/dispute/${booking.id}`)
                                          }
                                          className="cursor-pointer text-red-600"
                                       >
                                          <AlertTriangle className="h-4 w-4" />
                                          {t('booking.dispute')}
                                       </DropdownMenuItem>
                                    </>
                                 )}

                                 {["cancelled", "rejected", "completed"].includes(
                                    booking.status
                                 ) && (
                                       <DropdownMenuItem
                                          className="text-destructive cursor-pointer"
                                          onClick={() =>
                                             navigate(`/customer/book-service/delete/${booking.id}`)
                                          }
                                       >
                                          {t('booking.deleteBooking')}
                                       </DropdownMenuItem>
                                    )}
                              </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                     </CardHeader>

                     <CardContent className="space-y-2 -mt-3">
                        <div className="flex items-start gap-3">
                           <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                           <p className="text-sm text-muted-foreground">
                              {formatDate(String(booking.startDate))}
                              {booking.endDate && (
                                 <>
                                    <span className="text-rose-600"> {t('booking.to')} </span>
                                    {formatDate(String(booking.endDate))}
                                 </>
                              )}
                           </p>
                        </div>

                        <div className="flex items-start gap-3">
                           <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                           <div className="flex gap-2">
                              <p className="text-sm font-medium text-muted-foreground">
                                 {t('booking.duration')}:
                              </p>
                              <p className="text-sm text-muted-foreground">
                                 {booking.dayAmount} {booking.dayAmount !== 1 ? t('booking.days') : t('booking.day')}
                              </p>
                           </div>
                        </div>

                        <div className="flex items-start gap-3">
                           <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                           <p className="text-sm text-muted-foreground text-pretty">
                              {booking.location}
                           </p>
                        </div>

                        {booking.preferredAttire && (
                           <div className="flex items-start gap-3">
                              <Shirt className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="text-sm text-muted-foreground">
                                 {booking.preferredAttire}
                              </p>
                           </div>
                        )}

                        <div className="flex items-center gap-2">
                           <DollarSign className="h-4 w-4 text-muted-foreground" />
                           <span className="text-sm font-medium text-muted-foreground">
                              {t('booking.price')}:
                           </span>
                           <span className="text-sm text-muted-foreground">
                              {formatCurrency(booking.price)}
                           </span>
                        </div>

                        {booking.model && (
                           <div className="flex items-center gap-2">
                              <UserRoundCheck className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                 {booking.model.firstName + " " + (booking.model.lastName || "")} (
                                 {calculateAgeFromDOB(String(booking.model.dob))} {t('booking.years')})
                              </span>
                           </div>
                        )}
                     </CardContent>
                  </Card>
               ))}
            </div>
         ) : (
            <div className="w-full p-8 text-center">
               <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={24} className="text-gray-400" />
               </div>
               <h4 className="text-gray-900 font-medium mb-2">{t('booking.emptyTitle')}</h4>
               <p className="text-gray-600 text-sm">
                  {t('booking.emptyMessage')}
               </p>
            </div>
         )}

         <button
            onClick={() => window.open("https://wa.me/8562078856194", "_blank")}
            className="flex gap-2 cursor-pointer fixed bottom-16 right-4 sm:bottom-6 sm:right-4 z-50 p-3 rounded-lg bg-rose-500 text-white shadow-lg hover:bg-rose-600 transition"
         >
            <Headset size={18} className="animate-bounce" />
            <span className="hidden sm:block">{t('booking.support')}</span>
         </button>
      </div>
   )
}
