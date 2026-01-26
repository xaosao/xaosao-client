import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useNavigation, useRevalidator, Outlet, type LoaderFunction } from "react-router"
import { Calendar, MapPin, DollarSign, Clock, Shirt, UserRoundCheck, Headset, Loader, Search, Trash2, Check, X, Info, Shield, Wallet, ChevronDown, ChevronUp, Phone, MessageCircleMore, Video, Banknote } from "lucide-react"

// components:
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"

// interface and service
import { getAllModelBookings } from "~/services/booking.server"
import { requireModelSession } from "~/services/model-auth.server"
import { calculateAgeFromDOB, formatCurrency, formatDate } from "~/utils"
import { useNotifications, type Notification } from "~/hooks/useNotifications"

const statusConfig: Record<string, { label: string; className: string }> = {
   confirmed: {
      label: "Confirmed",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
   },
   pending: {
      label: "Pending",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
   },
   in_progress: {
      label: "In Progress",
      className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
   },
   awaiting_confirmation: {
      label: "Awaiting Confirmation",
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
      className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
   },
   disputed: {
      label: "Disputed",
      className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
   },
}

interface BookingData {
   id: string;
   price: number;
   location: string;
   preferredAttire: string;
   startDate: string;
   endDate: string;
   status: string;
   dayAmount: number;
   hours: number | null;
   sessionType: 'one_time' | 'one_night' | null;
   createdAt: string;
   isContact: boolean;
   customer: {
      id: string;
      firstName: string;
      lastName: string;
      profile: string;
      dob: string;
      whatsapp: number;
   };
   modelService: {
      id: string;
      customRate: number;
      service: {
         id: string;
         name: string;
         description: string;
         baseRate: number;
         billingType: 'per_day' | 'per_hour' | 'per_session' | 'per_minute';
      };
   } | null;
}

interface LoaderReturn {
   bookings: BookingData[];
}

interface DatingPageProps {
   loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
   const modelId = await requireModelSession(request)
   const bookings = await getAllModelBookings(modelId)

   return { bookings };
}

export default function ModelDatingPage({ loaderData }: DatingPageProps) {
   const { t } = useTranslation()
   const navigate = useNavigate()
   const navigation = useNavigation()
   const revalidator = useRevalidator()
   const { bookings } = loaderData
   const isLoading = navigation.state === "loading";
   const [isPolicyOpen, setIsPolicyOpen] = useState(false);

   // Booking notification types that should trigger a refresh
   const bookingNotificationTypes = [
      "booking_created",
      "booking_cancelled",
      "booking_disputed",
   ];

   // Handle new notifications - refresh bookings when booking-related
   const handleNewNotification = useCallback((notification: Notification) => {
      if (bookingNotificationTypes.includes(notification.type)) {
         console.log("[ModelDating] Booking notification received, refreshing...", notification.type);
         revalidator.revalidate();
      }
   }, [revalidator]);

   // Connect to real-time notifications
   useNotifications({
      userType: "model",
      onNewNotification: handleNewNotification,
      playSound: false, // Don't play sound here, already handled by notification center
   });

   const getServiceName = (booking: BookingData): string => {
      const serviceName = booking.modelService?.service?.name;
      if (!serviceName) return t("modelDating.serviceUnavailable");
      return t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName });
   };

   // Check if booking is a call service (per_minute billing type)
   const isCallService = (booking: BookingData): boolean => {
      return booking.modelService?.service?.billingType === 'per_minute';
   };

   const getStatusLabel = (status: string): string => {
      return t(`booking.status.${status}`, { defaultValue: statusConfig[status]?.label || status });
   };

   // Check if model can receive money (after booking end time)
   const canReceiveMoney = (booking: BookingData): boolean => {
      if (booking.status !== "confirmed") return false;
      const now = new Date();

      // Calculate effective end date
      let effectiveEndDate: Date | null = null;
      if (booking.endDate) {
         effectiveEndDate = new Date(booking.endDate);
      } else if (booking.hours && booking.startDate) {
         effectiveEndDate = new Date(new Date(booking.startDate).getTime() + booking.hours * 60 * 60 * 1000);
      } else if (booking.startDate) {
         // For day-based services, end of the start date
         effectiveEndDate = new Date(booking.startDate);
         effectiveEndDate.setHours(23, 59, 59, 999);
      }

      if (!effectiveEndDate) return false;
      return now >= effectiveEndDate;
   };

   if (isLoading) {
      return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2">
               <Loader className="w-4 h-4 text-rose-500 animate-spin" />
               <p className="text-rose-600">{t("modelDating.loading")}</p>
            </div>
         </div>
      );
   }

   return (
      <div className="container space-y-2 pt-2 sm:pt-8 px-4 sm:px-10">
         <div className="flex items-start justify-between w-full py-3 sm:px-0 rounded-md">
            <div className="space-y-1">
               <h1 className="text-md sm:text-lg sm:font-bold text-rose-600 sm:text-rose-600 uppercase">
                  {t("modelDating.title")}
               </h1>
            </div>
         </div>

         <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-2 sm:p-4">
            <button
               type="button"
               onClick={() => setIsPolicyOpen(!isPolicyOpen)}
               className="flex items-center justify-between w-full cursor-pointer"
            >
               <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-blue-600 shrink-0" />
                  <h3 className="text-sm font-semibold text-blue-900">{t("modelDating.policy.title")}</h3>
               </div>
               <div>
                  {isPolicyOpen ? (
                     <ChevronUp className="h-4 w-4 text-blue-600" />
                  ) : (
                     <ChevronDown className="h-4 w-4 text-blue-600" />
                  )}
               </div>
            </button>
            <div className={`mt-3 pl-8 ${isPolicyOpen ? 'block' : 'hidden'}`}>
               <ul className="text-xs text-blue-800 space-y-2">
                  <li className="flex items-center gap-2">
                     <Wallet className="h-3 w-3" />
                     <span>{t("modelDating.policy.paymentHeld")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Clock className="h-3 w-3" />
                     <span>{t("modelDating.policy.customerCancel")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Check className="h-3 w-3" />
                     <span>{t("modelDating.policy.receiveImmediately")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Info className="h-3 w-3" />
                     <span>{t("modelDating.policy.autoTransfer")}</span>
                  </li>
               </ul>
            </div>
         </div>

         {bookings && bookings.length > 0 ? (
            <>
               <div className="grid gap-3 grid-cols-1 md:grid-cols-4">
                  {bookings.map((booking) => (
                     <Card
                        key={booking.id}
                        className="hover:shadow-md transition-shadow rounded-sm py-4 sm:py-8 cursor-pointer"
                        onClick={() => navigate(`/model/dating/detail/${booking.id}`)}
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
                                 className={statusConfig[booking.status]?.className || statusConfig.pending.className}
                              >
                                 {getStatusLabel(booking.status)}
                              </Badge>
                           </div>
                        </CardHeader>

                        <CardContent className="space-y-3 p-4">
                           <div className="flex items-start gap-3">
                              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="text-sm text-muted-foreground">
                                 <span className="font-semibold">{formatDate(String(booking.startDate))}</span>
                                 {booking.endDate && (
                                    <>
                                       <span className="text-rose-600"> {t("modelDating.card.to")} </span>
                                       <span className="font-semibold">{formatDate(String(booking.endDate))}</span>
                                    </>
                                 )}
                              </p>
                           </div>

                           <div className="flex items-start gap-3">
                              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="flex gap-2">
                                 <p className="text-sm text-muted-foreground">
                                    {t("modelDating.card.duration")}:
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
                                          {booking.dayAmount} {booking.dayAmount !== 1 ? t("modelDating.card.days") : t("modelDating.card.day")}
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
                                 {t("modelDating.card.price")}:
                              </span>
                              <span className="text-sm text-muted-foreground font-semibold">
                                 {formatCurrency(booking.price)}
                              </span>
                           </div>

                           <div className="flex items-center gap-2">
                              <UserRoundCheck className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground font-semibold">
                                 {booking.customer.firstName + " " + booking.customer.lastName} (
                                 {calculateAgeFromDOB(String(booking.customer.dob))} {t("modelDating.card.years")})
                              </span>
                           </div>

                           <div className="pt-3 border-t flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              {isCallService(booking) ? (
                                 <>
                                    {booking.status === "pending" && (
                                       <>
                                          <Button
                                             variant="outline"
                                             size="sm"
                                             onClick={() => navigate(`/model/dating/accept/${booking.id}`)}
                                             className="text-xs h-8 text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                                          >
                                             <Check className="h-3 w-3" />
                                             {t("modelDating.actions.accept")}
                                          </Button>
                                          <Button
                                             variant="outline"
                                             size="sm"
                                             onClick={() => navigate(`/model/dating/reject/${booking.id}`)}
                                             className="text-xs h-8 text-red-600 border-red-600 hover:bg-red-50"
                                          >
                                             <X className="h-3 w-3" />
                                             {t("modelDating.actions.reject")}
                                          </Button>
                                       </>
                                    )}

                                    {booking.status === "confirmed" && (
                                       <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/model/call/join/${booking.id}`)}
                                          className="text-xs h-8 text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                                       >
                                          <Video className="h-3 w-3" />
                                          {t("modelDating.actions.joinCall")}
                                       </Button>
                                    )}

                                    {["cancelled", "completed"].includes(booking.status) && (
                                       <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/model/dating/delete/${booking.id}`)}
                                          className="text-xs h-8 text-red-600 border-red-600 hover:bg-red-50"
                                       >
                                          <Trash2 className="h-3 w-3" />
                                          {t("modelDating.actions.delete")}
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
                                             onClick={() => navigate(`/model/dating/reject/${booking.id}`)}
                                             className="text-xs h-8 text-red-600 border-red-600 hover:bg-red-50"
                                          >
                                             <X className="h-3 w-3" />
                                             {t("modelDating.actions.reject")}
                                          </Button>
                                          <Button
                                             variant="outline"
                                             size="sm"
                                             onClick={() => navigate(`/model/dating/accept/${booking.id}`)}
                                             className="text-xs h-8 text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                                          >
                                             <Check className="h-3 w-3" />
                                             {t("modelDating.actions.accept")}
                                          </Button>
                                       </>
                                    )}

                                    {booking.status === "confirmed" && booking.isContact && booking.customer.whatsapp && (
                                       <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                             const bookingUrl = `${window.location.origin}/customer/book-service/detail/${booking.id}`;
                                             const message = t("modelDating.whatsappMessage", {
                                                customerName: booking.customer.firstName,
                                                serviceName: getServiceName(booking),
                                                date: formatDate(String(booking.startDate)),
                                                bookingUrl
                                             });
                                             window.open(`https://wa.me/${booking.customer.whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
                                          }}
                                          className="text-xs text-green-600 border-green-600 hover:bg-green-50"
                                       >
                                          <MessageCircleMore className="w-3 h-3" />
                                          {t("modelDating.actions.message")}
                                       </Button>
                                    )}

                                    {booking.status === "confirmed" && (
                                       <>
                                          {booking.customer.whatsapp && (
                                             <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => window.open(`tel:${booking.customer.whatsapp}`, "_self")}
                                                className="text-xs h-8 text-blue-600 border-blue-600 hover:bg-blue-50"
                                             >
                                                <Phone className="h-3 w-3" />
                                                {t("modelDating.actions.call")}
                                             </Button>
                                          )}
                                          {canReceiveMoney(booking) && (
                                             <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => navigate(`/model/dating/receive-money/${booking.id}`)}
                                                className="text-xs h-8 text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                                             >
                                                <Banknote className="h-3 w-3" />
                                                {t("modelDating.actions.receiveMoney")}
                                             </Button>
                                          )}
                                       </>
                                    )}

                                    {["cancelled", "rejected", "completed"].includes(booking.status) && (
                                       <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/model/dating/delete/${booking.id}`)}
                                          className="text-xs h-8 text-red-600 border-red-600 hover:bg-red-50"
                                       >
                                          <Trash2 className="h-3 w-3" />
                                          {t("modelDating.actions.delete")}
                                       </Button>
                                    )}
                                 </>
                              )}
                           </div>
                        </CardContent>
                     </Card>
                  ))}
               </div>
            </>
         ) : (
            <div className="w-full p-8 text-center">
               <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={24} className="text-gray-400" />
               </div>
               <h4 className="text-gray-900 font-medium mb-2">{t("modelDating.empty.title")}</h4>
               <p className="text-gray-600 text-sm">
                  {t("modelDating.empty.description")}
               </p>
            </div>
         )}

         <button
            onClick={() => window.open("https://wa.me/8562093033918", "_blank")}
            className="flex gap-2 cursor-pointer fixed bottom-16 right-4 sm:bottom-6 sm:right-4 z-50 p-2 sm:p-3 rounded-lg bg-rose-500 text-white shadow-lg hover:bg-rose-600 transition"
         >
            <Headset size={16} className="animate-pulse" />
            <span className="text-sm">{t("modelDating.support")}</span>
         </button>

         <Outlet />
      </div>
   )
}
