import { AlertCircle, CheckCircle, Loader, User, Wallet, Clock } from "lucide-react";
import { Form, redirect, useLoaderData, useNavigate, useNavigation, useActionData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components
import { Button } from "~/components/ui/button";
import { requireUserSession } from "~/services/auths.server";
import { getBookingByToken, confirmBookingByToken } from "~/services/booking.server";

interface BookingData {
   id: string;
   price: number;
   status: string;
   isExpired: boolean;
   isAlreadyCompleted: boolean;
   model: {
      firstName: string;
      lastName: string;
      profile: string | null;
   };
   customer: {
      id: string;
      firstName: string;
   };
   modelService: {
      service: {
         name: string;
      };
   };
}

export async function loader({ params, request }: LoaderFunctionArgs) {
   const customerId = await requireUserSession(request);
   const token = params.token;

   if (!token) {
      return { booking: null, error: "Invalid QR code", customerId };
   }

   const booking = await getBookingByToken(token);

   if (!booking) {
      return { booking: null, error: "Invalid or expired QR code", customerId };
   }

   // Check if this booking belongs to the logged-in customer
   if (booking.customer?.id !== customerId) {
      return { booking: null, error: "This booking does not belong to you", customerId };
   }

   return { booking, error: null, customerId, token };
}

export async function action({ params, request }: ActionFunctionArgs) {
   const customerId = await requireUserSession(request);
   const token = params.token;

   if (!customerId) {
      throw new Response("Customer ID is required", { status: 400 });
   }

   if (!token) {
      return {
         success: false,
         error: true,
         message: "customerConfirmQR.errors.invalidToken",
      };
   }

   if (request.method === "POST") {
      try {
         const res = await confirmBookingByToken(token, customerId);
         if (res.id) {
            return redirect(`/customer/dates-history?toastMessage=${encodeURIComponent("customerConfirmQR.success")}&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "customerConfirmQR.errors.failed",
         };
      }
   }

   return { success: false, error: true, message: "customerConfirmQR.errors.invalidRequest" };
}

export default function ConfirmBookingByQRPage() {
   const { t } = useTranslation();
   const { booking, error, customerId } = useLoaderData<{
      booking: BookingData | null;
      error: string | null;
      customerId: string;
   }>();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>();
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

   const serviceName = booking?.modelService?.service?.name;
   const translatedServiceName = serviceName
      ? t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName })
      : "";

   // Show error state
   if (error || !booking) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
               <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
               </div>
               <h1 className="text-xl font-bold text-gray-900 mb-2">
                  {t("customerConfirmQR.errorTitle")}
               </h1>
               <p className="text-gray-600 mb-6">
                  {error || t("customerConfirmQR.errors.invalidQR")}
               </p>
               <Button
                  onClick={() => navigate("/customer/dates-history")}
                  className="bg-rose-500 hover:bg-rose-600 text-white"
               >
                  {t("customerConfirmQR.goToBookings")}
               </Button>
            </div>
         </div>
      );
   }

   // Show already completed state
   if (booking.isAlreadyCompleted) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
               <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
               </div>
               <h1 className="text-xl font-bold text-gray-900 mb-2">
                  {t("customerConfirmQR.alreadyCompletedTitle")}
               </h1>
               <p className="text-gray-600 mb-6">
                  {t("customerConfirmQR.alreadyCompletedDescription")}
               </p>
               <Button
                  onClick={() => navigate("/customer/dates-history")}
                  className="bg-rose-500 hover:bg-rose-600 text-white"
               >
                  {t("customerConfirmQR.goToBookings")}
               </Button>
            </div>
         </div>
      );
   }

   // Show expired state
   if (booking.isExpired) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
               <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-amber-500" />
               </div>
               <h1 className="text-xl font-bold text-gray-900 mb-2">
                  {t("customerConfirmQR.expiredTitle")}
               </h1>
               <p className="text-gray-600 mb-6">
                  {t("customerConfirmQR.expiredDescription")}
               </p>
               <Button
                  onClick={() => navigate("/customer/dates-history")}
                  className="bg-rose-500 hover:bg-rose-600 text-white"
               >
                  {t("customerConfirmQR.goToBookings")}
               </Button>
            </div>
         </div>
      );
   }

   // Show confirmation form
   return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
         <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
            <div className="text-center mb-6">
               <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
               </div>
               <h1 className="text-xl font-bold text-gray-900">
                  {t("customerConfirmQR.title")}
               </h1>
               <p className="text-sm text-gray-500 mt-2">
                  {t("customerConfirmQR.subtitle")}
               </p>
            </div>

            {/* Model Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
               <div className="flex items-center space-x-3">
                  {booking.model.profile ? (
                     <img
                        src={booking.model.profile}
                        alt={booking.model.firstName}
                        className="w-12 h-12 rounded-full object-cover"
                     />
                  ) : (
                     <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                     </div>
                  )}
                  <div>
                     <p className="text-sm text-gray-500">{t("customerConfirmQR.modelLabel")}</p>
                     <p className="font-semibold text-gray-900">
                        {booking.model.firstName} {booking.model.lastName}
                     </p>
                  </div>
               </div>
            </div>

            {/* Service Info */}
            <div className="space-y-3 mb-6">
               <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-500">{t("customerConfirmQR.serviceLabel")}</span>
                  <span className="font-medium text-primary">{translatedServiceName}</span>
               </div>
               <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-500">{t("customerConfirmQR.amountLabel")}</span>
                  <span className="font-bold text-lg text-emerald-600">
                     {booking.price.toLocaleString()} LAK
                  </span>
               </div>
            </div>

            {/* Payment Info */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
               <div className="flex items-start space-x-2">
                  <Wallet className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div className="text-sm text-emerald-800">
                     <p className="font-medium">{t("customerConfirmQR.paymentTitle")}</p>
                     <p>{t("customerConfirmQR.paymentDescription")}</p>
                  </div>
               </div>
            </div>

            {/* Error Message */}
            {actionData?.error && (
               <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-red-500 text-sm">
                     {t(actionData.message)}
                  </span>
               </div>
            )}

            {/* Action Buttons */}
            <Form method="post" className="space-y-3">
               <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3"
               >
                  {isSubmitting ? (
                     <>
                        <Loader className="h-4 w-4 animate-spin mr-2" />
                        {t("customerConfirmQR.confirming")}
                     </>
                  ) : (
                     <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t("customerConfirmQR.confirmButton")}
                     </>
                  )}
               </Button>
               <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/customer/dates-history")}
                  className="w-full"
               >
                  {t("customerConfirmQR.cancel")}
               </Button>
            </Form>
         </div>
      </div>
   );
}
