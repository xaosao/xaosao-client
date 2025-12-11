import { Clock, Check, X, BadgeCheck, User } from "lucide-react"
import { useLoaderData, useNavigate, type LoaderFunctionArgs } from "react-router"
import { useTranslation } from "react-i18next"

// components
import Modal from "~/components/ui/model"
import { Button } from "~/components/ui/button"

// utils and service
import type { IServiceBooking } from "~/interfaces/service"
import { getMyServiceBookingDetail } from "~/services/booking.server"
import { calculateAgeFromDOB, formatCurrency, formatDate } from "~/utils"

export async function loader({ params }: LoaderFunctionArgs) {
   const data = await getMyServiceBookingDetail(params.id!);
   return data;
}

export default function BookingServiceDetails() {
   const { t } = useTranslation()
   const navigate = useNavigate();
   const data = useLoaderData<IServiceBooking>();

   const getServiceName = (): string => {
      const serviceName = data?.modelService?.service?.name;
      if (!serviceName) return t("booking.serviceUnavailable");
      return t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName });
   };

   function closeHandler() {
      navigate("/customer/dates-history");
   }

   return (
      <Modal onClose={closeHandler} className="h-screen sm:h-auto w-full p-2 sm:w-3/6 border rounded-xl">
         <div className="space-y-4 mt-10 sm:mt-0 p-2">
            <div className="mt-4 sm:mt-0 px-2">
               <h3 className="flex items-center text-black text-md font-bold">{t('booking.detail.title')}</h3>
            </div>
            <div className="space-y-2 px-2">
               <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t('booking.detail.bookingId')}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{data?.id}</p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t('booking.detail.service')}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{getServiceName()}</p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t('booking.detail.date')}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{formatDate(String(data?.startDate))} {data?.endDate ? "-" : ""} {data?.endDate && formatDate(String(data?.endDate))}</p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t('booking.detail.dayAmount')}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{data?.dayAmount} {t('booking.days')}</p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t('booking.price')}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{formatCurrency(data?.price)}</p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t('booking.detail.location')}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{data?.location}</p>
                     </div>
                     <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                        <label className="text-sm font-medium text-gray-500">{t('booking.detail.preferredAttire')}:</label>
                        <p className="mt-0 sm:mt-1 text-sm">{data?.preferredAttire}</p>
                     </div>
                  </div>
                  <hr />
                  <div className="space-y-4">
                     {data?.status === "completed" && (
                        <div className="flex items-start space-x-3">
                           <div className="p-2 rounded-lg bg-green-50 border border-green-300">
                              <Check className="h-4 w-4 text-green-600" />
                           </div>
                           <div>
                              <p className="font-medium text-sm">{t('booking.detail.status.completedTitle')}</p>
                              <p className="text-xs text-gray-500">
                                 {t('booking.detail.status.completedMessage')}
                              </p>
                           </div>
                        </div>
                     )}

                     {data?.status === "confirmed" && (
                        <div className="flex items-start space-x-3">
                           <div className="p-2 rounded-lg bg-blue-50 border border-blue-300">
                              <Check className="h-4 w-4 text-blue-600" />
                           </div>
                           <div>
                              <p className="font-medium text-sm">{t('booking.detail.status.confirmedTitle')}</p>
                              <p className="text-xs text-gray-500">
                                 {t('booking.detail.status.confirmedMessage')}
                              </p>
                           </div>
                        </div>
                     )}

                     {data?.status === "rejected" && (
                        <div className="flex items-start space-x-3">
                           <div className="p-2 rounded-lg bg-red-50">
                              <X className="h-4 w-4 text-red-600" />
                           </div>
                           <div>
                              <p className="font-medium text-sm">{t('booking.detail.status.rejectedTitle')}</p>
                              <p className="text-xs text-gray-500">
                                 {t('booking.detail.status.rejectedMessage', { modelName: `${data.model.firstName} ${data.model.lastName}` })}
                              </p>
                           </div>
                        </div>
                     )}

                     {data?.status === "pending" && (
                        <div className="flex items-start space-x-3">
                           <div className="p-2 rounded-lg bg-yellow-50">
                              <Clock className="h-4 w-4 text-yellow-600" />
                           </div>
                           <div>
                              <p className="font-medium text-sm">{t('booking.detail.status.pendingTitle')}</p>
                              <p className="text-sm text-gray-500">{t('booking.detail.status.pendingMessage')}</p>
                           </div>
                        </div>
                     )}

                     {data?.status === "cancelled" && (
                        <div className="flex items-start space-x-3">
                           <div className="p-2 rounded-lg bg-red-50">
                              <Clock className="h-4 w-4 text-red-600" />
                           </div>
                           <div>
                              <p className="font-medium text-sm">{t('booking.detail.status.cancelledTitle')}</p>
                              <p className="text-xs text-gray-500">{t('booking.detail.status.cancelledMessage')}</p>
                           </div>
                        </div>
                     )}
                  </div>
                  <hr />
                  <div className="flex items-start justiy-start gap-4">
                     <div className="relative flex-shrink-0">
                        <img
                           src={data?.model.profile || ""}
                           alt={`${data.model.firstName}-${data.model.lastName}`}
                           className="w-22 h-22 rounded-full object-cover border-2 border-rose-500"
                        />
                        <BadgeCheck className="w-6 h-6 text-rose-500 absolute bottom-0 right-0 bg-white rounded-full p-[2px]" />
                     </div>
                     <div className="flex items-start justify-center flex-col text-sm">
                        <p>{t('booking.detail.id')}: {data.model.id}</p>
                        <h2 className="text-md">{t('booking.detail.name')}: {`${data.model.firstName} ${data.model.lastName}`}</h2>
                        <p>{t('booking.detail.age')}: {calculateAgeFromDOB(String(data.model.dob))} {t('booking.detail.yearsOld')}.</p>
                        <Button variant="outline" onClick={closeHandler} className="mt-4 bg-rose-500 text-white hover:bg-rose-600 hover:text-white">
                           <User size={18} className="text-white" />
                           {t('booking.detail.viewProfile')}
                        </Button>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
               <Button variant="outline" onClick={closeHandler} className="bg-rose-500 text-white hover:bg-rose-600 hover:text-white">
                  {t('booking.detail.close')}
               </Button>
            </div>
         </div >
      </Modal >
   )
}