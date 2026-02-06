import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle, DollarSign, Loader } from "lucide-react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { requireUserSession } from "~/services/auths.server";
import { capitalize } from "~/utils/functions/textFormat";
import { customerReleasePayment, getMyServiceBookingDetail } from "~/services/booking.server";
import { formatCurrency } from "~/utils";

interface BookingData {
   id: string;
   price: number;
   status: string;
   model: {
      firstName: string;
      lastName: string;
      type?: string; // "normal", "special", "partner"
      referredById?: string | null;
   };
   modelService: {
      service: {
         name: string;
         commission: number;
      };
   } | null;
}

export async function loader({ params }: LoaderFunctionArgs) {
   const booking = await getMyServiceBookingDetail(params.id!);
   return booking;
}

export async function action({ params, request }: ActionFunctionArgs) {
   const { id } = params;
   const customerId = await requireUserSession(request);

   if (!customerId) {
      throw new Response("Customer ID is required", { status: 400 });
   }

   if (request.method === "POST") {
      try {
         const res = await customerReleasePayment(id!, customerId);
         if (res.id) {
            return redirect(`/customer/dates-history?toastMessage=${encodeURIComponent("booking.release.success")}&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "booking.release.failed",
         };
      }
   }

   return { success: false, error: true, message: "Invalid request method!" };
}

export default function ReleasePaymentModal() {
   const { t } = useTranslation();
   const data = useLoaderData<BookingData>();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>();
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

   const serviceName = data?.modelService?.service?.name || "default";
   const translatedServiceName = serviceName
      ? t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName })
      : t("booking.serviceUnavailable");

   const modelName = data?.model
      ? `${data.model.firstName} ${data.model.lastName || ""}`.trim()
      : "Model";

   // Calculate net amount after platform commission
   const commissionRate = data?.modelService?.service?.commission || 0;
   const commissionAmount = Math.floor((data?.price * commissionRate) / 100);
   const netAmount = data?.price - commissionAmount;

   // Check if model has a referrer (referral commission is paid separately to the referrer)
   const hasReferrer = !!data?.model?.referredById;
   const referrerType = data?.model?.type || "normal";
   // Referral commission rates: normal=0%, special=2%, partner=4%
   // This is paid to the referrer from the platform, not deducted from model's earnings
   const referralCommissionRate = referrerType === "partner" ? 4 : referrerType === "special" ? 2 : 0;
   const referralCommissionAmount = hasReferrer && referralCommissionRate > 0
      ? Math.floor((data?.price * referralCommissionRate) / 100)
      : 0;

   function closeHandler() {
      navigate("/customer/dates-history");
   }

   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-md border p-6">
         <h1 className="text-md font-bold">{t('booking.release.title', { defaultValue: 'Release Payment' })}</h1>
         <p className="text-sm text-gray-500 my-2">
            {t('booking.release.description', { defaultValue: 'Confirm and release payment to the model for this booking.' })}
         </p>

         <Form method="post" className="space-y-4 mt-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <DollarSign className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div className="text-sm text-emerald-800 space-y-1">
                     <p className="font-medium">{t('booking.release.paymentDetails', { defaultValue: 'Payment Details' })}</p>
                     <div className="mt-2 space-y-1">
                        <p><span className="font-medium">{t('booking.release.service', { defaultValue: 'Service' })}:</span> {translatedServiceName}</p>
                        <p><span className="font-medium">{t('booking.release.model', { defaultValue: 'Model' })}:</span> {modelName}</p>
                        <p><span className="font-medium">{t('booking.release.totalPrice', { defaultValue: 'Total Price' })}:</span> {formatCurrency(data?.price)}</p>
                        <p><span className="font-medium">{t('booking.release.commission', { defaultValue: 'Platform Commission' })}:</span> {formatCurrency(commissionAmount)} ({commissionRate}%)</p>
                        {hasReferrer && referralCommissionRate > 0 && (
                           <p><span className="font-medium">{t('booking.release.referralCommission', { defaultValue: 'Referral Commission' })}:</span> {formatCurrency(referralCommissionAmount)} ({referralCommissionRate}%)</p>
                        )}
                        <p className="text-base font-bold text-emerald-900">
                           <span className="font-medium">{t('booking.release.modelReceives', { defaultValue: 'Model Receives' })}:</span> {formatCurrency(netAmount)}
                        </p>
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                     <p className="font-medium">{t('booking.release.confirmNote', { defaultValue: 'Confirmation' })}</p>
                     <p>{t('booking.release.confirmNoteMessage', { defaultValue: 'By releasing the payment, you confirm that the service was completed satisfactorily. This action cannot be undone.' })}</p>
                  </div>
               </div>
            </div>

            <div>
               {actionData?.error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                     <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                     <span className="text-red-500 text-sm">
                        {capitalize(t(actionData.message, { defaultValue: actionData.message }))}
                     </span>
                  </div>
               )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
               <Button type="button" variant="outline" onClick={closeHandler}>
                  {t('booking.release.cancel', { defaultValue: 'Cancel' })}
               </Button>
               <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
               >
                  {isSubmitting ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {t('booking.release.confirmButton', { defaultValue: 'Release Payment' })}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
