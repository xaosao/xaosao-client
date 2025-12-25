import { AlertCircle, CheckCircle2, Loader, MapPin, Navigation } from "lucide-react";
import { Form, redirect, useActionData, useNavigate, useNavigation, type ActionFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { LocationPermissionGuide } from "~/components/LocationPermissionGuide";
import { requireUserSession } from "~/services/auths.server";
import { capitalize } from "~/utils/functions/textFormat";
import { customerCheckIn } from "~/services/booking.server";

// hooks
import { useGeolocation } from "~/hooks/useGeolocation";

export async function action({ params, request }: ActionFunctionArgs) {
   const { id } = params;
   const customerId = await requireUserSession(request);

   if (!customerId) {
      throw new Response("Customer ID is required", { status: 400 });
   }

   if (request.method === "POST") {
      try {
         const formData = await request.formData();
         const lat = parseFloat(formData.get("lat") as string);
         const lng = parseFloat(formData.get("lng") as string);

         if (isNaN(lat) || isNaN(lng)) {
            return {
               success: false,
               error: true,
               message: "Unable to get your location. Please enable GPS and try again.",
            };
         }

         const res = await customerCheckIn(id!, customerId, lat, lng);
         if (res.id) {
            return redirect(`/customer/dates-history?toastMessage=Checked+in+successfully!&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "Failed to check in!",
         };
      }
   }

   return { success: false, error: true, message: "Invalid request method!" };
}

export default function CustomerCheckInModal() {
   const { t } = useTranslation();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>();
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

   // Use the geolocation hook
   const {
      latitude,
      longitude,
      loading: isGettingLocation,
      error: locationError,
      permissionState,
      requestLocation,
   } = useGeolocation({ enableHighAccuracy: true, timeout: 15000 });

   const hasLocation = latitude !== null && longitude !== null;

   function closeHandler() {
      navigate("/customer/dates-history");
   }

   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-xl border">
         <h1 className="text-md font-bold">{t('booking.checkin.title')}</h1>
         <p className="hidden sm:block text-sm text-gray-500 my-2">
            {t('booking.checkin.description')}
         </p>

         <Form method="post" className="space-y-4 mt-4">
            <input type="hidden" name="lat" value={latitude || ""} />
            <input type="hidden" name="lng" value={longitude || ""} />

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                     <p className="font-medium">{t('booking.checkin.gpsVerification')}</p>
                     <p>{t('booking.checkin.gpsVerificationMessage')}</p>
                  </div>
               </div>
            </div>

            {/* Location Status */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
               {isGettingLocation ? (
                  <div className="flex items-center space-x-2 text-gray-600">
                     <Loader className="h-4 w-4 animate-spin" />
                     <span className="text-sm">{t('booking.checkin.gettingLocation')}</span>
                  </div>
               ) : hasLocation ? (
                  <div className="flex items-center space-x-2 text-emerald-600">
                     <CheckCircle2 className="h-4 w-4" />
                     <span className="text-sm">{t('booking.checkin.locationAcquired')}</span>
                  </div>
               ) : permissionState === 'denied' ? (
                  <div className="space-y-3">
                     <div className="flex items-center space-x-2 text-orange-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">{t('booking.checkin.locationBlocked', { defaultValue: 'Location access blocked' })}</span>
                     </div>
                     <LocationPermissionGuide variant="light" onRetry={requestLocation} />
                  </div>
               ) : (permissionState === 'prompt' || permissionState === 'unknown') && !locationError ? (
                  <div className="flex items-center justify-between">
                     <div className="flex items-center space-x-2 text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm">{t('booking.checkin.enableLocationPrompt', { defaultValue: 'Click to enable location access' })}</span>
                     </div>
                     <Button
                        type="button"
                        size="sm"
                        onClick={requestLocation}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                     >
                        <Navigation className="h-3 w-3 mr-1" />
                        {t('booking.checkin.enableLocation', { defaultValue: 'Enable' })}
                     </Button>
                  </div>
               ) : locationError ? (
                  <div className="space-y-2">
                     <div className="flex items-center space-x-2 text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{locationError}</span>
                     </div>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={requestLocation}
                        className="mt-2"
                     >
                        <Navigation className="h-3 w-3 mr-1" />
                        {t('booking.checkin.retry')}
                     </Button>
                  </div>
               ) : null}
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
                  {t('booking.checkin.close')}
               </Button>
               <Button
                  type="submit"
                  disabled={isSubmitting || !hasLocation}
                  className="text-white bg-emerald-500 hover:bg-emerald-600"
               >
                  {isSubmitting && <Loader className="h-4 w-4 animate-spin mr-1" />}
                  <MapPin className="h-4 w-4 mr-1" />
                  {t('booking.checkin.checkInButton')}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
