import { useTranslation } from "react-i18next";
import { AlertCircle, AlertTriangle, Loader, Shield, Clock } from "lucide-react";
import { Form, redirect, useActionData, useNavigate, useNavigation, useParams, type ActionFunctionArgs } from "react-router";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { requireUserSession } from "~/services/auths.server";
import { capitalize } from "~/utils/functions/textFormat";
import { customerDisputeBooking } from "~/services/booking.server";

export async function action({ params, request }: ActionFunctionArgs) {
   const { id } = params;
   const customerId = await requireUserSession(request);

   if (!customerId) {
      throw new Response("Customer ID is required", { status: 400 });
   }

   if (request.method === "POST") {
      try {
         const formData = await request.formData();
         const reason = formData.get("reason") as string;

         if (!reason || reason.trim().length < 10) {
            return {
               success: false,
               error: true,
               message: "Please provide a detailed reason (at least 10 characters).",
            };
         }

         const res = await customerDisputeBooking(id!, customerId, reason);
         if (res.id) {
            return redirect(`/customer/dates-history?toastMessage=Dispute+submitted!+Our+team+will+review+your+case.&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "Failed to submit dispute!",
         };
      }
   }

   return { success: false, error: true, message: "Invalid request method!" };
}

export default function DisputeBookingModal() {
   const { t } = useTranslation();
   const { id } = useParams();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>();
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

   function closeHandler() {
      navigate("/customer/dates-history");
   }

   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-xl border">
         <h1 className="text-md font-bold">{t('booking.disputeModal.title')}</h1>
         <p className="hidden sm:block text-sm text-gray-500 my-2">
            {t('booking.disputeModal.description')}
         </p>

         <Form method="post" className="space-y-4 mt-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                     <p className="font-medium">{t('booking.disputeModal.beforeDisputing')}</p>
                     <p>{t('booking.disputeModal.beforeDisputingMessage')}</p>
                  </div>
               </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                     <p className="font-medium">{t('booking.disputeModal.evidenceAvailable')}</p>
                     <p>{t('booking.disputeModal.evidenceAvailableMessage')}</p>
                  </div>
               </div>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <Clock className="h-4 w-4 text-gray-600 mt-0.5" />
                  <div className="text-sm text-gray-700">
                     <p className="font-medium">{t('booking.disputeModal.reviewTimeline')}</p>
                     <p>{t('booking.disputeModal.reviewTimelineMessage')}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium text-gray-700">
                  {t('booking.disputeModal.reasonLabel')} <span className="text-red-500">*</span>
               </label>
               <Textarea
                  name="reason"
                  placeholder={t('booking.disputeModal.reasonPlaceholder')}
                  className="text-sm min-h-[100px] resize-none"
                  required
                  minLength={10}
               />
               <p className="text-xs text-gray-500">
                  {t('booking.disputeModal.reasonHint')}
               </p>
            </div>

            <div>
               {actionData?.error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                     <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                     <span className="text-red-500 text-sm">
                        {capitalize(actionData.message)}
                     </span>
                  </div>
               )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
               <Button type="button" variant="outline" onClick={closeHandler}>
                  {t('booking.disputeModal.close')}
               </Button>
               <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="destructive"
                  className="bg-red-500 hover:bg-red-600"
               >
                  {isSubmitting && <Loader className="h-4 w-4 animate-spin mr-1" />}
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {t('booking.disputeModal.submitButton')}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
