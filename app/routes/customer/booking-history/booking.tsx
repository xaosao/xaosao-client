import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useNavigation, useRevalidator, type LoaderFunction } from "react-router"
import { Calendar, MapPin, DollarSign, Clock, Shirt, UserRoundCheck, Headset, Loader, Search, Info, Shield, Wallet, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Phone, MessageCircleMore, SquarePen, X, Trash2, Video } from "lucide-react"

// components:
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"

// interface and service
import type { IServiceBooking } from "~/interfaces/service"
import { requireUserSession } from "~/services/auths.server";
import { getAllMyServiceBookings } from "~/services/booking.server"
import { calculateAgeFromDOB, formatCurrency, formatDate } from "~/utils"
import { useNotifications, type Notification } from "~/hooks/useNotifications"

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
      className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
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
   const revalidator = useRevalidator()
   const { bookInfos } = loaderData
   const isLoading = navigation.state === "loading";
   const [isPolicyOpen, setIsPolicyOpen] = useState(false);

   // Booking notification types that should trigger a refresh
   const bookingNotificationTypes = [
      "booking_confirmed",
      "booking_rejected",
      "booking_completed",
   ];

   // Handle new notifications - refresh bookings when booking-related
   const handleNewNotification = useCallback((notification: Notification) => {
      if (bookingNotificationTypes.includes(notification.type)) {
         console.log("[CustomerBooking] Booking notification received, refreshing...", notification.type);
         revalidator.revalidate();
      }
   }, [revalidator]);

   // Connect to real-time notifications
   useNotifications({
      userType: "customer",
      onNewNotification: handleNewNotification,
      playSound: false, // Don't play sound here, already handled by notification center
   });

   const getServiceName = (booking: IServiceBooking): string => {
      const serviceName = booking.modelService?.service?.name;
      if (!serviceName) return t("booking.serviceUnavailable");
      return t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName });
   };

   // Check if booking is a call service (per_minute billing type)
   const isCallService = (booking: IServiceBooking): boolean => {
      return booking.modelService?.service?.billingType === 'per_minute';
   };

   const getStatusLabel = (status: string): string => {
      return t(`booking.status.${status}`, { defaultValue: statusConfig[status]?.label || status });
   };

   // Check if dispute button should be enabled (available for 30 minutes starting from booking time)
   const canDispute = (booking: IServiceBooking): boolean => {
      if (booking.status !== "confirmed") return false;
      const now = new Date();
      const startDate = new Date(booking.startDate);
      const disputeWindowEnd = new Date(startDate.getTime() + 30 * 60 * 1000); // 30 minutes after start
      // Dispute is only available during the 30-minute window from booking start
      return now >= startDate && now <= disputeWindowEnd;
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
                     <Clock className="h-3 w-3" />
                     <span>{t('booking.policy.cancellationNotice')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <AlertTriangle className="h-3 w-3" />
                     <span>{t('booking.policy.disputeWindow')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Info className="h-3 w-3" />
                     <span>{t('booking.policy.autoRelease')}</span>
                  </li>
               </ul>
            </div>
         </div>

         {bookInfos && bookInfos.length > 0 ? (
            <div className="w-full grid gap-3 md:grid-cols-3 lg:grid-cols-4">
               {bookInfos.map((booking) => (
                  <Card
                     key={booking.id}
                     className="border hover:shadow-md transition-shadow rounded-sm cursor-pointer"
                     onClick={() => navigate(`/customer/book-service/detail/${booking.id}`)}
                  >
                     <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                           <div className="space-y-2 flex-1">
                              <h3 className="text-md leading-tight text-balance">
                                 {getServiceName(booking)}
                              </h3>
                           </div>

                           <Badge
                              variant="outline"
                              className={statusConfig[booking.status]?.className || "bg-gray-500/10 text-gray-700 border-gray-500/20"}
                           >
                              {getStatusLabel(booking.status)}
                           </Badge>
                        </div>
                     </CardHeader>

                     <CardContent className="space-y-3 -mt-3">
                        <div className="flex items-start gap-3">
                           <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                           <p className="text-sm text-muted-foreground">
                              <span className="font-semibold">{formatDate(String(booking.startDate))}</span>
                              {booking.endDate && (
                                 <>
                                    <span className="text-rose-600"> {t('booking.to')} </span>
                                    <span className="font-semibold">{formatDate(String(booking.endDate))}</span>
                                 </>
                              )}
                           </p>
                        </div>

                        <div className="flex items-start gap-3">
                           <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                           <div className="flex gap-2">
                              <p className="text-sm text-muted-foreground">
                                 {t('booking.duration')}:
                              </p>
                              <p className="text-sm text-muted-foreground font-semibold">
                                 {booking.modelService?.service?.billingType === 'per_hour' && booking.hours ? (
                                    <>
                                       {booking.hours} {booking.hours !== 1 ? t('profileBook.hours') : t('modelServices.hour')}
                                    </>
                                 ) : booking.modelService?.service?.billingType === 'per_session' && booking.sessionType ? (
                                    <>
                                       {booking.sessionType === 'one_time' ? t('profileBook.oneTime') : t('profileBook.oneNight')}
                                    </>
                                 ) : (
                                    <>
                                       {booking.dayAmount} {booking.dayAmount !== 1 ? t('booking.days') : t('booking.day')}
                                    </>
                                 )}
                              </p>
                           </div>
                        </div>

                        <div className="flex items-start gap-3">
                           <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                           <p className="text-sm text-muted-foreground text-pretty font-semibold">
                              {booking.location}
                           </p>
                        </div>

                        {booking.preferredAttire && (
                           <div className="flex items-start gap-3">
                              <Shirt className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="text-sm text-muted-foreground font-semibold">
                                 {booking.preferredAttire}
                              </p>
                           </div>
                        )}

                        <div className="flex items-center gap-2">
                           <DollarSign className="h-4 w-4 text-muted-foreground" />
                           <span className="text-sm text-muted-foreground">
                              {t('booking.price')}:
                           </span>
                           <span className="text-sm text-muted-foreground font-semibold">
                              {formatCurrency(booking.price)}
                           </span>
                        </div>

                        {booking.model && (
                           <div className="flex items-center gap-2">
                              <UserRoundCheck className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground font-semibold">
                                 {booking.model.firstName + " " + (booking.model.lastName || "")} (
                                 {calculateAgeFromDOB(String(booking.model.dob))} {t('booking.years')})
                              </span>
                           </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-3 border-t flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                           {isCallService(booking) ? (
                              <>
                                 {booking.status === "confirmed" && (
                                    <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => navigate(`/customer/call/start/${booking.id}`)}
                                       className="text-xs h-8 text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                                    >
                                       <Video className="h-3 w-3" />
                                       {t('booking.startCall')}
                                    </Button>
                                 )}
                                 {booking.status === "pending" && (
                                    <>
                                       <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/customer/book-service/edit/${booking.id}`)}
                                          className="text-xs h-8"
                                       >
                                          <SquarePen className="h-3 w-3" />
                                          {t('booking.editBooking')}
                                       </Button>
                                       <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/customer/book-service/cancel/${booking.id}`)}
                                          className="text-xs h-8 text-red-600 border-red-600 hover:bg-red-50"
                                       >
                                          <X className="h-3 w-3" />
                                          {t('booking.cancelBooking')}
                                       </Button>
                                    </>
                                 )}
                                
                                 {["cancelled", "completed"].includes(booking.status) && (
                                    <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => navigate(`/customer/book-service/delete/${booking.id}`)}
                                       className="text-xs h-8 text-red-600 border-red-600 hover:bg-red-50"
                                    >
                                       <Trash2 className="h-3 w-3" />
                                       {t('booking.deleteBooking')}
                                    </Button>
                                 )}
                              </>
                           ) : (
                              <>
                                 {booking.status === "pending" && (
                                    <>
                                       <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/customer/book-service/edit/${booking.id}`)}
                                          className="text-xs h-8"
                                       >
                                          <SquarePen className="h-3 w-3" />
                                          {t('booking.editBooking')}
                                       </Button>
                                       <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/customer/book-service/cancel/${booking.id}`)}
                                          className="text-xs h-8 text-red-600 border-red-600 hover:bg-red-50"
                                       >
                                          <X className="h-3 w-3" />
                                          {t('booking.cancelBooking')}
                                       </Button>
                                    </>
                                 )}

                                 {booking.model?.whatsapp && booking.status !== "completed" && (
                                    <Button
                                       variant="outline"
                                       size="sm"
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
                                       className="text-xs h-8 text-green-600 border-green-600 hover:bg-green-50"
                                    >
                                       <MessageCircleMore className="h-3 w-3" />
                                       {t('booking.messageModel')}
                                    </Button>
                                 )}

                                 {booking.status === "confirmed" && (
                                    <>
                                       {booking.model?.whatsapp && (
                                          <Button
                                             variant="outline"
                                             size="sm"
                                             onClick={() => window.open(`tel:${booking.model.whatsapp}`, "_self")}
                                             className="text-xs h-8 text-blue-600 border-blue-600 hover:bg-blue-50"
                                          >
                                             <Phone className="h-3 w-3" />
                                             {t('booking.callModel')}
                                          </Button>
                                       )}
                                       {canDispute(booking) && (
                                          <Button
                                             variant="outline"
                                             size="sm"
                                             onClick={() => navigate(`/customer/book-service/dispute/${booking.id}`)}
                                             className="text-xs h-8 text-orange-600 border-orange-600 hover:bg-orange-50"
                                          >
                                             <AlertTriangle className="h-3 w-3" />
                                             {t('booking.dispute')}
                                          </Button>
                                       )}
                                    </>
                                 )}

                                 {booking.status === "awaiting_confirmation" && booking.completionToken && (
                                    <>
                                       <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/customer/confirm-booking/${booking.completionToken}`)}
                                          className="text-xs h-8 text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                                       >
                                          <CheckCircle2 className="h-3 w-3" />
                                          {t('booking.confirmRelease')}
                                       </Button>
                                       <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/customer/book-service/dispute/${booking.id}`)}
                                          className="text-xs h-8 text-red-600 border-red-600 hover:bg-red-50"
                                       >
                                          <AlertTriangle className="h-3 w-3" />
                                          {t('booking.dispute')}
                                       </Button>
                                    </>
                                 )}

                                 {["cancelled", "rejected", "completed"].includes(booking.status) && (
                                    <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => navigate(`/customer/book-service/delete/${booking.id}`)}
                                       className="text-xs h-8 text-red-600 border-red-600 hover:bg-red-50"
                                    >
                                       <Trash2 className="h-3 w-3" />
                                       {t('booking.deleteBooking')}
                                    </Button>
                                 )}
                              </>
                           )}
                        </div>
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
            onClick={() => window.open("https://wa.me/8562093033918", "_blank")}
            className="flex gap-2 cursor-pointer fixed bottom-16 right-4 sm:bottom-6 sm:right-4 z-50 p-3 rounded-lg bg-rose-500 text-white shadow-lg hover:bg-rose-600 transition"
         >
            <Headset size={18} className="animate-bounce" />
            <span className="hidden sm:block">{t('booking.support')}</span>
         </button>
      </div>
   )
}
