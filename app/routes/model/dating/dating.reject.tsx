import { AlertCircle, XCircle, Loader } from "lucide-react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { requireModelSession } from "~/services/model-auth.server";
import { rejectBooking, getModelBookingDetail } from "~/services/booking.server";

interface BookingData {
   id: string;
   modelService: {
      service: {
         name: string;
      };
   };
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
         const formData = await request.formData();
         const reason = formData.get("reason") as string;

         const res = await rejectBooking(id!, modelId, reason);
         if (res.id) {
            return redirect(`/model/dating?toastMessage=${encodeURIComponent("modelDating.reject.success")}&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "modelDating.reject.errors.failed",
         };
      }
   }

   return { success: false, error: true, message: "modelDating.reject.errors.invalidRequest" };
}

export default function RejectBookingModal() {
   const { t } = useTranslation();
   const data = useLoaderData<BookingData>();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>()
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

   const serviceName = data?.modelService?.service?.name;
   const translatedServiceName = serviceName
      ? t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName })
      : t("modelDating.serviceUnavailable");

   function closeHandler() {
      navigate("/model/dating");
   }

   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-sm border p-6">
         <h1 className="text-md font-bold">{t("modelDating.reject.title")}</h1>
         <p className="block sm:hidden text-sm text-gray-500 my-2">
            <span className="font-bold text-primary">"{translatedServiceName}"</span>
         </p>
         <p className="hidden sm:block text-sm text-gray-500 my-2">
            {t("modelDating.reject.confirmQuestion")}
            <span className="font-bold text-primary"> "{translatedServiceName}"</span>
         </p>
         <Form method="post" className="space-y-4 mt-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                     <p className="font-medium">{t("modelDating.reject.confirmTitle")}</p>
                     <p>{t("modelDating.reject.confirmDescription")}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-2">
               <Label htmlFor="reason" className="text-sm font-medium">
                  {t("modelDating.reject.reasonLabel")}
               </Label>
               <Textarea
                  id="reason"
                  name="reason"
                  placeholder={t("modelDating.reject.reasonPlaceholder")}
                  className="text-sm min-h-[80px]"
               />
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
                  {t("modelDating.reject.cancel")}
               </Button>
               <Button type="submit" variant="destructive" disabled={isSubmitting} className="text-white bg-red-500 hover:bg-red-600">
                  {isSubmitting && <Loader className="h-4 w-4 animate-spin" />}
                  {t("modelDating.reject.rejectButton")}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
