import QRCode from "qrcode";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Loader, Wallet, QrCode, Timer } from "lucide-react";
import { Form, redirect, useLoaderData, useNavigate, useNavigation, useActionData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { requireModelSession } from "~/services/model-auth.server";
import { completeBooking, getBookingWithToken } from "~/services/booking.server";

interface BookingData {
   id: string;
   price: number;
   status: string;
   completionToken: string | null;
   completionTokenExpiresAt: string | null;
   autoReleaseAt: string | null;
   modelService: {
      service: {
         name: string;
      };
   };
   customer: {
      firstName: string;
      lastName: string;
   };
}

export async function loader({ params, request }: LoaderFunctionArgs) {
   const modelId = await requireModelSession(request);
   const data = await getBookingWithToken(params.id!, modelId);

   const VITE_FRONTEND_URL = process.env.VITE_FRONTEND_URL || "http://localhost:5173";
   return { booking: data, VITE_FRONTEND_URL };
}

export async function action({ params, request }: ActionFunctionArgs) {
   const { id } = params;
   const modelId = await requireModelSession(request);

   if (!modelId) {
      throw new Response("Model ID is required", { status: 400 });
   }

   if (request.method === "POST") {
      try {
         const res = await completeBooking(id!, modelId);
         if (res.id) {
            return redirect(`/model/dating/complete/${id}`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "modelDating.complete.errors.failed",
         };
      }
   }

   return { success: false, error: true, message: "modelDating.complete.errors.invalidRequest" };
}

export default function CompleteBookingModal() {
   const { t } = useTranslation();
   const { booking, VITE_FRONTEND_URL } = useLoaderData<{ booking: BookingData; VITE_FRONTEND_URL: string }>();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>();
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

   const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
   const [timeRemaining, setTimeRemaining] = useState<string>("");

   const serviceName = booking?.modelService?.service?.name;
   const translatedServiceName = serviceName
      ? t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName })
      : t("modelDating.serviceUnavailable");

   const hasQRCode = booking?.completionToken && booking?.status === "awaiting_confirmation";
   const qrUrl = hasQRCode ? `${VITE_FRONTEND_URL}customer/confirm-booking/${booking.completionToken}` : "";

   useEffect(() => {
      if (qrUrl) {
         QRCode.toDataURL(qrUrl, {
            width: 256,
            margin: 2,
            color: {
               dark: "#000000",
               light: "#ffffff",
            },
         })
            .then((url) => setQrCodeDataUrl(url))
            .catch((err) => console.error("Failed to generate QR code:", err));
      }
   }, [qrUrl]);

   // Calculate time remaining until auto-release
   useEffect(() => {
      if (!booking?.autoReleaseAt) return;

      const updateTimer = () => {
         const now = new Date();
         const autoRelease = new Date(booking.autoReleaseAt!);
         const diff = autoRelease.getTime() - now.getTime();

         if (diff <= 0) {
            setTimeRemaining(t("modelDating.completeQR.autoReleased"));
            return;
         }

         const hours = Math.floor(diff / (1000 * 60 * 60));
         const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
         setTimeRemaining(`${hours}h ${minutes}m`);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 60000);

      return () => clearInterval(interval);
   }, [booking?.autoReleaseAt, t]);

   function closeHandler() {
      navigate("/model/dating");
   }

   if (hasQRCode) {
      return (
         <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-sm border p-4 sm:p-6">
            <div className="text-center">
               <h1 className="text-lg font-bold text-emerald-600">{t("modelDating.completeQR.title")}</h1>
               <p className="hidden sm:block text-sm text-gray-500 mt-2">
                  {t("modelDating.completeQR.subtitle")}
               </p>
            </div>

            <div className="mt-6 flex flex-col items-center">
               <div className="bg-white p-0 sm:p-4 rounded-xl border-2 border-gray-200 shadow-sm">
                  {qrCodeDataUrl ? (
                     <img
                        src={qrCodeDataUrl}
                        alt="Completion QR Code"
                        className="w-48 h-48 sm:w-56 sm:h-56"
                     />
                  ) : (
                     <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center bg-gray-100 rounded-lg">
                        <Loader className="w-8 h-8 animate-spin text-gray-400" />
                     </div>
                  )}
               </div>

               <div className="flex gap-2 mt-4 text-center justify-center">
                  <p className="text-sm text-gray-600">
                     {t("modelDating.completeQR.amountLabel")}:
                  </p>
                  <p className="text-lg font-bold text-emerald-600">
                     {booking.price.toLocaleString()} LAK
                  </p>
               </div>

               <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg w-full">
                  <div className="flex items-start space-x-2">
                     <QrCode className="h-4 w-4 text-blue-600 mt-0.5" />
                     <div className="text-sm text-blue-800">
                        <p className="font-medium">{t("modelDating.completeQR.instructionTitle")}</p>
                        <p>{t("modelDating.completeQR.instructionDescription")}</p>
                     </div>
                  </div>
               </div>

               <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg w-full">
                  <div className="flex items-center justify-center space-x-2">
                     <Timer className="h-4 w-4 text-amber-600" />
                     <span className="text-sm text-amber-800">
                        {t("modelDating.completeQR.autoReleaseIn")}: <strong>{timeRemaining}</strong>
                     </span>
                  </div>
                  <p className="text-xs text-amber-600 text-center mt-1">
                     {t("modelDating.completeQR.autoReleaseNote")}
                  </p>
               </div>

            </div>

            <div className="flex justify-end mt-6">
               <Button type="button" variant="outline" onClick={closeHandler} className="border border-rose-500">
                  {t("modelDating.completeQR.close")}
               </Button>
            </div>
         </Modal>
      );
   }

   // Show initial form to generate QR
   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-sm border p-6">
         <h1 className="text-md font-bold">{t("modelDating.complete.title")}</h1>
         <p className="block sm:hidden text-sm text-gray-500 my-2">
            <span className="font-bold text-primary">"{translatedServiceName}"</span>
         </p>
         <p className="hidden sm:block text-sm text-gray-500 my-2">
            {t("modelDating.complete.subtitle")}
            <span className="font-bold text-primary"> "{translatedServiceName}"</span>
         </p>
         <Form method="post" className="space-y-4 mt-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <QrCode className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                     <p className="font-medium">{t("modelDating.complete.qrTitle")}</p>
                     <p>{t("modelDating.complete.qrDescription")}</p>
                  </div>
               </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <Wallet className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div className="text-sm text-emerald-800">
                     <p className="font-medium">{t("modelDating.complete.paymentTitle")}</p>
                     <p>{t("modelDating.complete.paymentDescription")}</p>
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
                  {t("modelDating.complete.close")}
               </Button>
               <Button type="submit" disabled={isSubmitting} className="text-white bg-rose-500 hover:bg-rose-600">
                  {isSubmitting && <Loader className="h-4 w-4 animate-spin" />}
                  <QrCode className="h-4 w-4" />
                  {t("modelDating.complete.generateQR")}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
