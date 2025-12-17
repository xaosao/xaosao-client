import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useNavigation, Outlet, type LoaderFunction } from "react-router"
import { Calendar, MapPin, DollarSign, Clock, Shirt, MoreVertical, UserRoundCheck, Headset, Loader, Search, Trash2, Check, X, Info, Shield, Wallet, ChevronDown, ChevronUp, QrCode } from "lucide-react"

// components:
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"

// interface and service
import { getAllModelBookings } from "~/services/booking.server"
import { requireModelSession } from "~/services/model-auth.server"
import { calculateAgeFromDOB, formatCurrency, formatDate } from "~/utils"

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
   createdAt: string;
   isContact: boolean;
   modelCheckedInAt: string | null;
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
   const { bookings } = loaderData
   const isLoading = navigation.state === "loading";
   const [isPolicyOpen, setIsPolicyOpen] = useState(false);

   const getServiceName = (booking: BookingData): string => {
      const serviceName = booking.modelService?.service?.name;
      if (!serviceName) return t("modelDating.serviceUnavailable");
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
               <p className="text-rose-600">{t("modelDating.loading")}</p>
            </div>
         </div>
      );
   }

   return (
      <div className="container space-y-2 pt-2 sm:pt-8 px-4 sm:px-10">
         <div className="flex items-start justify-between bg-rose-100 sm:bg-white w-full p-3 sm:px-0 rounded-md">
            <div className="space-y-1">
               <h1 className="text-md sm:text-lg sm:font-bold text-rose-600 sm:text-rose-600 uppercase">
                  {t("modelDating.title")}
               </h1>
               <p className="text-sm sm:text-md font-normal text-rose-600 sm:text-gray-600">
                  {t("modelDating.subtitle")}
               </p>
            </div>
         </div>

         <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
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
                     <MapPin className="h-3 w-3" />
                     <span>{t("modelDating.policy.gpsCheckin")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Check className="h-3 w-3" />
                     <span>{t("modelDating.policy.customerConfirm")}</span>
                  </li>
                  <li className="flex items-center gap-2">
                     <Info className="h-3 w-3" />
                     <span>{t("modelDating.policy.rejectRefund")}</span>
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
                        className="hover:shadow-md transition-shadow rounded-sm py-8"
                     >
                        <CardHeader>
                           <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                 <h3 className="text-md leading-tight text-balance">
                                    {getServiceName(booking)}
                                 </h3>
                                 <Badge
                                    variant="outline"
                                    className={statusConfig[booking.status]?.className || statusConfig.pending.className}
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
                                       onClick={() => navigate(`/model/dating/detail/${booking.id}`)}
                                       className="cursor-pointer"
                                    >
                                       {t("modelDating.actions.viewDetails")}
                                    </DropdownMenuItem>

                                    {booking.status === "pending" && (
                                       <>
                                          <DropdownMenuItem
                                             onClick={() => navigate(`/model/dating/accept/${booking.id}`)}
                                             className="cursor-pointer text-emerald-600"
                                          >
                                             <Check className="h-4 w-4" />
                                             {t("modelDating.actions.accept")}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                             onClick={() => navigate(`/model/dating/reject/${booking.id}`)}
                                             className="cursor-pointer text-red-600"
                                          >
                                             <X className="h-4 w-4" />
                                             {t("modelDating.actions.reject")}
                                          </DropdownMenuItem>
                                       </>
                                    )}

                                    {booking.status === "confirmed" && !booking.modelCheckedInAt && (
                                       <DropdownMenuItem
                                          onClick={() => navigate(`/model/dating/checkin/${booking.id}`)}
                                          className="cursor-pointer"
                                       >
                                          {t("modelDating.actions.checkIn")}
                                       </DropdownMenuItem>
                                    )}

                                    {(booking.modelCheckedInAt || booking.status === "in_progress") &&
                                       !["completed", "awaiting_confirmation", "cancelled", "rejected", "disputed"].includes(booking.status) && (
                                          <DropdownMenuItem
                                             onClick={() => navigate(`/model/dating/complete/${booking.id}`)}
                                             className="cursor-pointer text-green-600"
                                          >
                                             <Check className="h-4 w-4" />
                                             {t("modelDating.actions.completeGetPaid")}
                                          </DropdownMenuItem>
                                       )}

                                    {booking.status === "awaiting_confirmation" && (
                                       <DropdownMenuItem
                                          onClick={() => navigate(`/model/dating/complete/${booking.id}`)}
                                          className="cursor-pointer text-emerald-600"
                                       >
                                          <QrCode className="h-4 w-4" />
                                          {t("modelDating.actions.viewQRCode")}
                                       </DropdownMenuItem>
                                    )}

                                    {booking.isContact && (
                                       <DropdownMenuItem
                                          onClick={() => navigate(`/model/chat?id=${booking.customer.firstName}`)}
                                          className="cursor-pointer"
                                       >
                                          {t("modelDating.actions.messageCustomer")}
                                       </DropdownMenuItem>
                                    )}

                                    {["cancelled", "rejected", "completed"].includes(booking.status) && (
                                       <DropdownMenuItem
                                          className="text-destructive cursor-pointer"
                                          onClick={() => navigate(`/model/dating/delete/${booking.id}`)}
                                       >
                                          <Trash2 className="h-4 w-4" />
                                          {t("modelDating.actions.delete")}
                                       </DropdownMenuItem>
                                    )}
                                 </DropdownMenuContent>
                              </DropdownMenu>
                           </div>
                        </CardHeader>

                        <CardContent className="space-y-2">
                           <div className="flex items-start gap-3">
                              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="text-sm text-muted-foreground">
                                 {formatDate(String(booking.startDate))}
                                 {booking.endDate && (
                                    <>
                                       <span className="text-rose-600"> {t("modelDating.card.to")} </span>
                                       {formatDate(String(booking.endDate))}
                                    </>
                                 )}
                              </p>
                           </div>

                           <div className="flex items-start gap-3">
                              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="flex gap-2">
                                 <p className="text-sm font-medium text-muted-foreground">
                                    {t("modelDating.card.duration")}:
                                 </p>
                                 <p className="text-sm text-muted-foreground">
                                    {booking.dayAmount} {booking.dayAmount !== 1 ? t("modelDating.card.days") : t("modelDating.card.day")}
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
                                 {t("modelDating.card.price")}:
                              </span>
                              <span className="text-sm text-muted-foreground">
                                 {formatCurrency(booking.price)}
                              </span>
                           </div>

                           <div className="flex items-center gap-2">
                              <UserRoundCheck className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                 {booking.customer.firstName + " " + booking.customer.lastName} (
                                 {calculateAgeFromDOB(String(booking.customer.dob))} {t("modelDating.card.years")})
                              </span>
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
            onClick={() => window.open("https://wa.me/8562078856194", "_blank")}
            className="flex gap-2 cursor-pointer fixed bottom-16 right-4 sm:bottom-6 sm:right-4 z-50 p-3 rounded-lg bg-rose-500 text-white shadow-lg hover:bg-rose-600 transition"
         >
            <Headset size={18} className="animate-pulse" />
            <span className="hidden sm:block">{t("modelDating.support")}</span>
         </button>

         <Outlet />
      </div>
   )
}
