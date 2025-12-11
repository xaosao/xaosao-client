import { AlertCircle, CheckCircle, Loader } from "lucide-react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { requireModelSession } from "~/services/model-auth.server";
import { acceptBooking, getModelBookingDetail } from "~/services/booking.server";

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
         const res = await acceptBooking(id!, modelId);
         if (res.id) {
            return redirect(`/model/dating?toastMessage=${encodeURIComponent("modelDating.accept.success")}&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "modelDating.accept.errors.failed",
         };
      }
   }

   return { success: false, error: true, message: "modelDating.accept.errors.invalidRequest" };
}

export default function AcceptBookingModal() {
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
         <h1 className="text-md font-bold">{t("modelDating.accept.title")}</h1>
         <p className="block sm:hidden text-sm text-gray-500 my-2">
            <span className="font-bold text-primary">"{translatedServiceName}"</span>
         </p>
         <p className="hidden sm:block text-sm text-gray-500 my-2">
            {t("modelDating.accept.confirmQuestion")}
            <span className="font-bold text-primary"> "{translatedServiceName}"</span>
         </p>
         <Form method="post" className="space-y-4 mt-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div className="text-sm text-emerald-800">
                     <p className="font-medium">{t("modelDating.accept.confirmTitle")}</p>
                     <p>{t("modelDating.accept.confirmDescription")}</p>
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
                  {t("modelDating.accept.back")}
               </Button>
               <Button type="submit" disabled={isSubmitting} className="text-white bg-emerald-500 hover:bg-emerald-600">
                  {isSubmitting && <Loader className="h-4 w-4 animate-spin" />}
                  {t("modelDating.accept.acceptButton")}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
