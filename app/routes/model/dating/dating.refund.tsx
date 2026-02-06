import { AlertCircle, DollarSign, Loader, RefreshCcw } from "lucide-react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { requireModelSession } from "~/services/model-auth.server";
import { modelRefundDisputedBooking, getModelBookingDetail } from "~/services/booking.server";
import { formatCurrency } from "~/utils";
import { capitalize } from "~/utils/functions/textFormat";

interface BookingData {
   id: string;
   price: number;
   status: string;
   disputeReason: string | null;
   customer: {
      firstName: string;
      lastName: string;
   };
   modelService: {
      service: {
         name: string;
      };
   } | null;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
   const modelId = await requireModelSession(request);
   const data = await getModelBookingDetail(params.id!, modelId);
   return data;
}

export async function action({ params, request }: ActionFunctionArgs) {
   const { id } = params;
   const modelId = await requireModelSession(request);

   if (!modelId) {
      throw new Response("Model ID is required", { status: 400 });
   }

   if (request.method === "POST") {
      try {
         const res = await modelRefundDisputedBooking(id!, modelId);
         if (res.id) {
            return redirect(`/model/dating?toastMessage=${encodeURIComponent("modelDating.refund.success")}&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "modelDating.refund.errors.failed",
         };
      }
   }

   return { success: false, error: true, message: "modelDating.refund.errors.invalidRequest" };
}

export default function RefundBookingModal() {
   const { t } = useTranslation();
   const data = useLoaderData<BookingData>();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>();
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

   const serviceName = data?.modelService?.service?.name || "default";
   const translatedServiceName = serviceName
      ? t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName })
      : t("modelDating.serviceUnavailable");

   const customerName = data?.customer
      ? `${data.customer.firstName} ${data.customer.lastName || ""}`.trim()
      : "Customer";

   function closeHandler() {
      navigate("/model/dating");
   }

   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-md border p-6">
         <h1 className="text-md font-bold">{t('modelDating.refund.title', { defaultValue: 'Refund Disputed Booking' })}</h1>
         <p className="text-sm text-gray-500 my-2">
            {t('modelDating.refund.description', {
               defaultValue: 'You are about to refund {{amount}} to customer {{customerName}}.',
               amount: formatCurrency(data?.price),
               customerName: customerName
            })}
         </p>

         <Form method="post" className="space-y-4 mt-4">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <RefreshCcw className="h-4 w-4 text-orange-600 mt-0.5" />
                  <div className="text-sm text-orange-800 space-y-1">
                     <p className="font-medium">{t('modelDating.refund.disputeDetails', { defaultValue: 'Dispute Details' })}</p>
                     <div className="mt-2 space-y-1">
                        <p><span className="font-medium">{t('modelDating.refund.service', { defaultValue: 'Service' })}:</span> {translatedServiceName}</p>
                        <p><span className="font-medium">{t('modelDating.refund.customer', { defaultValue: 'Customer' })}:</span> {customerName}</p>
                        <p><span className="font-medium">{t('modelDating.refund.amount', { defaultValue: 'Refund Amount' })}:</span> {formatCurrency(data?.price)}</p>
                        {data?.disputeReason && (
                           <div className="mt-2 pt-2 border-t border-orange-200">
                              <p className="font-medium">{t('modelDating.refund.reason', { defaultValue: 'Dispute Reason' })}:</p>
                              <p className="text-orange-700 italic">"{data.disputeReason}"</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <DollarSign className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                     <p className="font-medium">{t('modelDating.refund.confirmNote', { defaultValue: 'Important' })}</p>
                     <p>{t('modelDating.refund.confirmNoteMessage', { defaultValue: 'By refunding, you accept the dispute and the full amount will be returned to the customer. This action cannot be undone.' })}</p>
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
                  {t('modelDating.refund.cancel', { defaultValue: 'Cancel' })}
               </Button>
               <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
               >
                  {isSubmitting ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  {t('modelDating.refund.confirmButton', { defaultValue: 'Refund Customer' })}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
