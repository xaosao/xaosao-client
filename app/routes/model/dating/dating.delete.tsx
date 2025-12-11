import { useTranslation } from "react-i18next";
import { AlertCircle, AlertTriangle, Loader } from "lucide-react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { requireModelSession } from "~/services/model-auth.server";
import { deleteModelBooking, getModelBookingDetail } from "~/services/booking.server";

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

   if (request.method === "DELETE") {
      try {
         const res = await deleteModelBooking(id!, modelId);
         if (res.id) {
            return redirect(`/model/dating?toastMessage=${encodeURIComponent("modelDating.delete.success")}&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "modelDating.delete.errors.failed",
         };
      }
   }

   return { success: false, error: true, message: "modelDating.delete.errors.invalidRequest" };
}

export default function DeleteBookingModal() {
   const { t } = useTranslation();
   const data = useLoaderData<BookingData>();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>()
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "DELETE";

   const serviceName = data?.modelService?.service?.name;
   const translatedServiceName = serviceName
      ? t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName })
      : t("modelDating.serviceUnavailable");

   function closeHandler() {
      navigate("/model/dating");
   }

   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-xl border">
         <h1 className="text-md font-bold">{t("modelDating.delete.title")}</h1>
         <p className="block sm:hidden text-sm text-gray-500 my-2">
            <span className="font-bold text-primary">"{translatedServiceName}"</span>
         </p>
         <p className="hidden sm:block text-sm text-gray-500 my-2">
            {t("modelDating.delete.confirmQuestion")}
            <span className="font-bold text-primary"> "{translatedServiceName}"</span>
         </p>
         <Form method="delete" className="space-y-4 mt-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                     <p className="font-medium">{t("modelDating.delete.warningTitle")}</p>
                     <p>{t("modelDating.delete.warningDescription")}</p>
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
                  {t("modelDating.delete.cancel")}
               </Button>
               <Button type="submit" variant="destructive" disabled={isSubmitting} className="text-white bg-rose-500">
                  {isSubmitting && <Loader className="h-4 w-4 animate-spin" />}
                  {t("modelDating.delete.deleteButton")}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
