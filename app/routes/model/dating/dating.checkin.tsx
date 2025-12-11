import { AlertCircle, CheckCircle2, Loader, MapPin, Navigation } from "lucide-react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { requireModelSession } from "~/services/model-auth.server";
import { modelCheckIn, getModelBookingDetail } from "~/services/booking.server";

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
         const lat = parseFloat(formData.get("lat") as string);
         const lng = parseFloat(formData.get("lng") as string);

         if (isNaN(lat) || isNaN(lng)) {
            return {
               success: false,
               error: true,
               message: "modelDating.checkin.errors.locationRequired",
            };
         }

         const res = await modelCheckIn(id!, modelId, lat, lng);
         if (res.id) {
            return redirect(`/model/dating?toastMessage=${encodeURIComponent("modelDating.checkin.success")}&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error?.message || "modelDating.checkin.errors.failed",
         };
      }
   }

   return { success: false, error: true, message: "modelDating.checkin.errors.invalidRequest" };
}

export default function ModelCheckInModal() {
   const { t } = useTranslation();
   const data = useLoaderData<BookingData>();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>();
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

   const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
   const [locationError, setLocationError] = useState<string | null>(null);
   const [isGettingLocation, setIsGettingLocation] = useState(false);

   const serviceName = data?.modelService?.service?.name;
   const translatedServiceName = serviceName
      ? t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName })
      : t("modelDating.serviceUnavailable");

   function closeHandler() {
      navigate("/model/dating");
   }

   function getLocation() {
      setIsGettingLocation(true);
      setLocationError(null);

      if (!navigator.geolocation) {
         setLocationError(t("modelDating.checkin.geoNotSupported"));
         setIsGettingLocation(false);
         return;
      }

      navigator.geolocation.getCurrentPosition(
         (position) => {
            setLocation({
               lat: position.coords.latitude,
               lng: position.coords.longitude,
            });
            setIsGettingLocation(false);
         },
         (error) => {
            switch (error.code) {
               case error.PERMISSION_DENIED:
                  setLocationError(t("modelDating.checkin.permissionDenied"));
                  break;
               case error.POSITION_UNAVAILABLE:
                  setLocationError(t("modelDating.checkin.locationUnavailable"));
                  break;
               case error.TIMEOUT:
                  setLocationError(t("modelDating.checkin.timeout"));
                  break;
               default:
                  setLocationError(t("modelDating.checkin.locationError"));
            }
            setIsGettingLocation(false);
         },
         {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
         }
      );
   }

   useEffect(() => {
      getLocation();
   }, []);

   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-sm border p-6">
         <h1 className="text-md font-bold">{t("modelDating.checkin.title")}</h1>
         <p className="block sm:hidden text-sm text-gray-500 my-2">
            <span className="font-bold text-primary">"{translatedServiceName}"</span>
         </p>
         <p className="hidden sm:block text-sm text-gray-500 my-2">
            {t("modelDating.checkin.subtitle")}
            <span className="font-bold text-primary"> "{translatedServiceName}"</span>
         </p>

         <Form method="post" className="space-y-4 mt-4">
            <input type="hidden" name="lat" value={location?.lat || ""} />
            <input type="hidden" name="lng" value={location?.lng || ""} />

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                     <p className="font-medium">{t("modelDating.checkin.gpsVerification")}</p>
                     <p>{t("modelDating.checkin.gpsDescription")}</p>
                  </div>
               </div>
            </div>

            {/* Location Status */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
               {isGettingLocation ? (
                  <div className="flex items-center space-x-2 text-gray-600">
                     <Loader className="h-4 w-4 animate-spin" />
                     <span className="text-sm">{t("modelDating.checkin.gettingLocation")}</span>
                  </div>
               ) : location ? (
                  <div className="flex items-center space-x-2 text-emerald-600">
                     <CheckCircle2 className="h-4 w-4" />
                     <span className="text-sm">{t("modelDating.checkin.locationAcquired")}</span>
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
                        onClick={getLocation}
                        className="mt-2"
                     >
                        <Navigation className="h-3 w-3 mr-1" />
                        {t("modelDating.checkin.retry")}
                     </Button>
                  </div>
               ) : null}
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
                  {t("modelDating.checkin.close")}
               </Button>
               <Button
                  type="submit"
                  disabled={isSubmitting || !location}
                  className="text-white bg-emerald-500 hover:bg-emerald-600"
               >
                  {isSubmitting && <Loader className="h-4 w-4 animate-spin" />}
                  <MapPin className="h-4 w-4" />
                  {t("modelDating.checkin.checkInButton")}
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
