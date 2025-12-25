import { Clock, Check, X, User } from "lucide-react"
import { useLoaderData, useNavigate, type LoaderFunctionArgs } from "react-router"
import { useTranslation } from "react-i18next"

// components
import Modal from "~/components/ui/model"
import { Button } from "~/components/ui/button"

// utils and service
import { requireModelSession } from "~/services/model-auth.server"
import { getModelBookingDetail } from "~/services/booking.server"
import { calculateAgeFromDOB, formatCurrency, formatDate } from "~/utils"
import { capitalize } from "~/utils/functions/textFormat"

interface BookingDetail {
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
   customer: {
      id: string;
      firstName: string;
      lastName: string;
      profile: string;
      dob: string;
      whatsapp: number;
      gender: string;
   };
   modelService: {
      id: string;
      customRate: number;
      service: {
         id: string;
         name: string;
         description: string;
         baseRate: number;
         billingType: 'per_day' | 'per_hour' | 'per_session';
      };
   } | null;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
   const modelId = await requireModelSession(request);
   const data = await getModelBookingDetail(params.id!, modelId);
   return data;
}

export default function DatingDetailModal() {
   const { t } = useTranslation();
   const navigate = useNavigate();
   const data = useLoaderData<BookingDetail>();

   function closeHandler() {
      navigate("/model/dating");
   }

   return (
      <Modal onClose={closeHandler} className="h-screen sm:h-auto w-full p-2 sm:w-3/6 border rounded-sm">
         <div className="space-y-4 mt-10 sm:mt-0 p-2">
            <div className="mt-4 sm:mt-0 px-2">
               <h3 className="flex items-center text-black text-md font-bold">{t("modelDating.detail.title")}</h3>
            </div>
            <div className="space-y-2 px-2">
               <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t("modelDating.detail.bookingId")}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{data?.id}</p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t("modelDating.detail.service")}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">
                           {data?.modelService?.service?.name
                              ? t(`modelServices.serviceItems.${data.modelService.service.name}.name`, { defaultValue: data.modelService.service.name })
                              : t("modelDating.serviceUnavailable")}
                        </p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t("modelDating.detail.date")}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">
                           {formatDate(String(data?.startDate))} {data?.endDate ? "-" : ""} {data?.endDate && formatDate(String(data?.endDate))}
                        </p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t("modelDating.detail.duration")}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">
                           {/* Show duration based on billing type */}
                           {data?.modelService?.service?.billingType === 'per_hour' && data?.hours ? (
                              <>
                                 {data.hours} {data.hours !== 1 ? t('profileBook.hours') : t('modelServices.hour')}
                              </>
                           ) : data?.modelService?.service?.billingType === 'per_session' && data?.sessionType ? (
                              <>
                                 {data.sessionType === 'one_time' ? t('profileBook.oneTime') : t('profileBook.oneNight')}
                              </>
                           ) : (
                              <>
                                 {data?.dayAmount} {t("modelDating.card.days")}
                              </>
                           )}
                        </p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t("modelDating.detail.price")}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{formatCurrency(data?.price)}</p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t("modelDating.detail.location")}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{data?.location}</p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t("modelDating.detail.preferredAttire")}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{data?.preferredAttire || t("modelDating.detail.notSpecified")}</p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t("modelDating.detail.status")}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{capitalize(data?.status || "")}</p>
                     </div>
                  </div>
                  <hr />
                  <div className="space-y-4">
                     {data?.status === "confirmed" && (
                        <div className="flex items-start space-x-3">
                           <div className="p-2 rounded-lg bg-green-50 border border-green-300">
                              <Check className="h-4 w-4 text-green-600" />
                           </div>
                           <div>
                              <p className="font-medium text-sm">{t("modelDating.detail.statusMessages.confirmed.title")}</p>
                              <p className="text-xs text-gray-500">
                                 {t("modelDating.detail.statusMessages.confirmed.description")}
                              </p>
                           </div>
                        </div>
                     )}

                     {data?.status === "completed" && (
                        <div className="flex items-start space-x-3">
                           <div className="p-2 rounded-lg bg-blue-50 border border-blue-300">
                              <Check className="h-4 w-4 text-blue-600" />
                           </div>
                           <div>
                              <p className="font-medium text-sm">{t("modelDating.detail.statusMessages.completed.title")}</p>
                              <p className="text-xs text-gray-500">
                                 {t("modelDating.detail.statusMessages.completed.description")}
                              </p>
                           </div>
                        </div>
                     )}

                     {data?.status === "rejected" && (
                        <div className="flex items-start space-x-3">
                           <div className="p-2 rounded-lg bg-gray-50 border border-gray-300">
                              <X className="h-4 w-4 text-gray-600" />
                           </div>
                           <div>
                              <p className="font-medium text-sm">{t("modelDating.detail.statusMessages.rejected.title")}</p>
                              <p className="text-xs text-gray-500">
                                 {t("modelDating.detail.statusMessages.rejected.description")}
                              </p>
                           </div>
                        </div>
                     )}

                     {data?.status === "pending" && (
                        <div className="flex items-start space-x-3">
                           <div className="p-2 rounded-lg bg-yellow-50 border border-yellow-300">
                              <Clock className="h-4 w-4 text-yellow-600" />
                           </div>
                           <div>
                              <p className="font-medium text-sm">{t("modelDating.detail.statusMessages.pending.title")}</p>
                              <p className="text-sm text-gray-500">
                                 {t("modelDating.detail.statusMessages.pending.description")}
                              </p>
                           </div>
                        </div>
                     )}

                     {data?.status === "cancelled" && (
                        <div className="flex items-start space-x-3">
                           <div className="p-2 rounded-lg bg-red-50 border border-red-300">
                              <X className="h-4 w-4 text-red-600" />
                           </div>
                           <div>
                              <p className="font-medium text-sm">{t("modelDating.detail.statusMessages.cancelled.title")}</p>
                              <p className="text-xs text-gray-500">
                                 {t("modelDating.detail.statusMessages.cancelled.description")}
                              </p>
                           </div>
                        </div>
                     )}
                  </div>
                  <hr />
                  <div className="flex items-start justiy-start gap-4">
                     <div className="relative flex-shrink-0">
                        {data?.customer.profile ? (
                           <img
                              src={data?.customer.profile}
                              alt={`${data.customer.firstName}-${data.customer.lastName}`}
                              className="w-22 h-22 rounded-full object-cover border-2 border-rose-500"
                           />
                        ) : (
                           <div className="w-22 h-22 rounded-full bg-gray-200 flex items-center justify-center border-2 border-rose-500">
                              <User className="w-10 h-10 text-gray-400" />
                           </div>
                        )}
                     </div>
                     <div className="flex items-start justify-center flex-col text-sm">
                        <h2 className="text-md">{t("modelDating.detail.customerName")}: {`${data?.customer.firstName} ${data?.customer.lastName}`}</h2>
                        <p>{t("modelDating.detail.customerAge")}: {calculateAgeFromDOB(String(data?.customer.dob))} {t("modelDating.detail.yearsOld")}</p>
                        <p>{t("modelDating.detail.customerGender")}: {capitalize(data?.customer.gender || t("modelDating.detail.notSpecified"))}</p>
                        <Button
                           variant="outline"
                           onClick={() => navigate(`/model/customer-profile/${data?.customer.id}`)}
                           className="text-xs mt-4 bg-rose-500 text-white hover:bg-rose-600 hover:text-white"
                        >
                           <User size={18} className="text-white" />
                           {t("modelDating.detail.viewProfile")}
                        </Button>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
               <Button variant="outline" onClick={closeHandler} className="bg-rose-500 text-white hover:bg-rose-600 hover:text-white">
                  {t("modelDating.detail.close")}
               </Button>
               {data?.status === "pending" && (
                  <>
                     <Button
                        variant="outline"
                        onClick={() => navigate(`/model/dating/reject/${data?.id}`)}
                        className="border border-gray-500 bg-white text-gray-500 hover:bg-gray-500 hover:text-white"
                     >
                        {t("modelDating.detail.reject")}
                     </Button>
                     <Button
                        variant="outline"
                        onClick={() => navigate(`/model/dating/accept/${data?.id}`)}
                        className="border border-green-500 text-green-600 hover:bg-green-500 hover:text-white"
                     >
                        {t("modelDating.detail.accept")}
                     </Button>
                  </>
               )}
            </div>
         </div>
      </Modal>
   )
}
