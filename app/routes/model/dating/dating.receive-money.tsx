import { AlertCircle, DollarSign, Loader } from "lucide-react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { requireModelSession } from "~/services/model-auth.server";
import { receiveMoneyFromBooking, getModelBookingDetail } from "~/services/booking.server";
import { formatCurrency } from "~/utils";

interface BookingData {
   id: string;
   price: number;
   endDate: Date | null;
   status: string;
   modelService: {
      service: {
         name: string;
         commission: number;
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
         const res = await receiveMoneyFromBooking(id!, modelId);
         if (res.id) {
            return redirect(`/model/dating?toastMessage=${encodeURIComponent("modelDating.receiveMoney.success")}&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "modelDating.receiveMoney.errors.failed",
         };
      }
   }

   return { success: false, error: true, message: "modelDating.receiveMoney.errors.invalidRequest" };
}

export default function ReceiveMoneyModal() {
   const { t } = useTranslation();
   const data = useLoaderData<BookingData>();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>()
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

   const serviceName = data?.modelService?.service?.name || "default";
   const translatedServiceName = serviceName
      ? t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName })
      : t("modelDating.serviceUnavailable");

   // Calculate net amount after commission
   const commissionRate = data?.modelService?.service?.commission || 0;
   const commissionAmount = Math.floor((data?.price * commissionRate) / 100);
   const netAmount = data?.price - commissionAmount;

   function closeHandler() {
      navigate("/model/dating");
   }

   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-sm border p-6">
         <h1 className="text-md font-bold">{t("modelDating.receiveMoney.title")}</h1>
         <p className="text-sm text-gray-500 my-2">
            {t("modelDating.receiveMoney.confirmQuestion")}
            <span className="font-bold text-primary"> "{translatedServiceName}"</span>
         </p>
         <Form method="post" className="space-y-4 mt-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <DollarSign className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div className="text-sm text-emerald-800 space-y-1">
                     <p className="font-medium">{t("modelDating.receiveMoney.confirmTitle")}</p>
                     <p>{t("modelDating.receiveMoney.confirmDescription")}</p>
                     <div className="mt-2 space-y-1">
                        <p><span className="font-medium">{t("modelDating.receiveMoney.totalPrice")}:</span> {formatCurrency(data?.price)}</p>
                        <p><span className="font-medium">{t("modelDating.receiveMoney.commission")}:</span> {formatCurrency(commissionAmount)} ({commissionRate}%)</p>
                        <p className="text-base font-bold text-emerald-900"><span className="font-medium">{t("modelDating.receiveMoney.youReceive")}:</span> {formatCurrency(netAmount)}</p>
                     </div>
                  </div>
               </div>
            </div>
            <div>
               {actionData?.error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                     <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                     <span className="text-red-500 text-sm">
                        {t(actionData.message)}
                     </span>
                  </div>
               )}
            </div>
            <div className="flex justify-end space-x-2 pt-4">
               <Button type="button" variant="outline" onClick={closeHandler}>
                  {t("modelDating.receiveMoney.cancel")}
               </Button>
               <Button type="submit" disabled={isSubmitting} className="text-white bg-emerald-500 hover:bg-emerald-600">
                  {isSubmitting && <Loader className="h-4 w-4 animate-spin" />}
                  {t("modelDating.receiveMoney.confirmButton")}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
