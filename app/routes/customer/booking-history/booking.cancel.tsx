import { AlertCircle, Loader, AlertTriangle, Wallet } from "lucide-react";
import { Form, redirect, useActionData, useNavigate, useNavigation, type ActionFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { requireUserSession } from "~/services/auths.server";
import { capitalize } from "~/utils/functions/textFormat";
import { cancelServiceBooking } from "~/services/booking.server";

export async function action({ params, request }: ActionFunctionArgs) {
   const { id } = params;
   const customerId = await requireUserSession(request);

   if (!customerId) {
      throw new Response("Customer ID is required", { status: 400 });
   }

   if (request.method === "PATCH") {
      try {
         const res = await cancelServiceBooking(id!, customerId);
         if (res.id) {
            return redirect(`/customer/dates-history?toastMessage=Cancel+date+booking+successfully!&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error || "Failed to cancel date booking!",
         };
      }
   }

   return { success: false, error: true, message: "Invalid request method!" };
}


export default function CancelBookingService() {
   const { t } = useTranslation()
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>()
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "PATCH";

   function closeHandler() {
      navigate("/customer/dates-history");
   }

   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-xl border">
         <h1 className="text-md font-bold">{t('booking.cancel.title')}</h1>
         <p className="hidden sm:block text-md text-gray-500 my-2">{t('booking.cancel.description')}</p>
         <Form method="patch" className="space-y-4 mt-4">
            <div className="space-y-3">
               <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                     <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                     <div className="text-sm text-amber-800">
                        <p className="font-medium">{t('booking.cancel.cancellationPolicy')}</p>
                        <p>{t('booking.cancel.cancellationPolicyMessage')}</p>
                     </div>
                  </div>
               </div>

               <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                     <Wallet className="h-4 w-4 text-emerald-600 mt-0.5" />
                     <div className="text-sm text-emerald-800">
                        <p className="font-medium">{t('booking.cancel.refundPolicy')}</p>
                        <p>{t('booking.cancel.refundPolicyMessage')}</p>
                     </div>
                  </div>
               </div>
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
                  {t('booking.cancel.close')}
               </Button>
               <Button type="submit" variant="destructive" disabled={isSubmitting} className="text-white bg-rose-500">
                  {isSubmitting && <Loader className="h-4 w-4 animate-spin" />}
                  {t('booking.cancel.confirm')}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}