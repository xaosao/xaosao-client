import { ArrowLeft, Loader } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigate, useNavigation } from "react-router";

// services
import { modelLogin } from "~/services/model-auth.server";
import type { IModelSigninCredentials } from "~/services/model-auth.server";
import { validateModelSignInInputs } from "~/services/model-validation.server";

// components
import { LocationPermissionGuide } from "~/components/LocationPermissionGuide";

// hooks
import { useGeolocation } from "~/hooks/useGeolocation";

export const meta: MetaFunction = () => {
  return [
    { title: "Companion Login - XaoSao" },
    { name: "description", content: "Login to your companion account" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { getModelFromSession } = await import("~/services/model-auth.server");
  const { redirect } = await import("react-router");

  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirect") || "/model";

  // Check if model is already logged in
  const modelId = await getModelFromSession(request);

  if (modelId) {
    // Model already logged in, redirect to intended destination
    throw redirect(redirectTo);
  }

  const reset = url.searchParams.get("reset");

  return {
    showResetSuccess: reset === "success",
    redirectTo,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return {
      error: "modelAuth.errors.invalidRequestMethod",
    };
  }

  const { prisma } = await import("~/services/database.server");

  const formData = await request.formData();

  const whatsappRaw = formData.get("whatsapp");
  const passwordRaw = formData.get("password");
  const rememberMeRaw = formData.get("rememberMe");
  const redirectTo = formData.get("redirectTo") as string | null;

  // Get GPS coordinates from client (if provided)
  const latitudeRaw = formData.get("latitude");
  const longitudeRaw = formData.get("longitude");

  if (!whatsappRaw || !passwordRaw) {
    return {
      error: "modelAuth.errors.phoneAndPasswordRequired",
    };
  }

  try {
    const whatsapp = Number(whatsappRaw);
    if (isNaN(whatsapp) || whatsapp <= 0) {
      return {
        error: "modelAuth.errors.invalidPhoneFormat",
      };
    }

    const credentials: IModelSigninCredentials = {
      whatsapp,
      password: String(passwordRaw),
      rememberMe: rememberMeRaw === "on",
      redirectTo: redirectTo || undefined,
    };

    validateModelSignInInputs(credentials);

    // Update model GPS location if provided (non-blocking - don't fail login if this fails)
    if (latitudeRaw && longitudeRaw) {
      try {
        const latitude = parseFloat(String(latitudeRaw));
        const longitude = parseFloat(String(longitudeRaw));

        if (!isNaN(latitude) && !isNaN(longitude) &&
          latitude >= -90 && latitude <= 90 &&
          longitude >= -180 && longitude <= 180) {

          const model = await prisma.model.findFirst({
            where: { whatsapp },
            select: { id: true }
          });

          if (model) {
            await prisma.model.update({
              where: { id: model.id },
              data: {
                latitude,
                longitude,
              },
            }).catch(err => {
              console.error("Failed to update model GPS location on login:", err);
            });

            console.log(`Model GPS location updated for ${whatsapp}: (${latitude}, ${longitude})`);
          }
        }
      } catch (locationError) {
        console.error("Model GPS location update error during login:", locationError);
      }
    }

    // Attempt login
    return await modelLogin(credentials);
  } catch (error: any) {
    if (error && typeof error === "object" && !error.message) {
      const validationError = Object.values(error)[0];
      return {
        error: String(validationError),
      };
    }

    if (error && typeof error === "object" && "status" in error) {
      const httpError = error as { status: number; message?: string };
      if (httpError.status === 401) {
        return {
          error: httpError.message || "modelAuth.errors.invalidCredentials",
        };
      }
    }

    return {
      error: error.message || "modelAuth.errors.loginFailed",
    };
  }
}

export default function ModelLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const { showResetSuccess, redirectTo } = useLoaderData<typeof loader>();
  const isSubmitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(showResetSuccess);

  // Geolocation hook - automatically requests location on mount
  const {
    latitude,
    longitude,
    loading: locationLoading,
    error: locationError,
    permissionState,
    requestLocation,
  } = useGeolocation({ enableHighAccuracy: true, timeout: 15000 });

  const hasLocation = latitude !== null && longitude !== null;

  // Hide success message after 5 seconds
  useEffect(() => {
    if (showResetSuccess) {
      setShowSuccessMessage(true);
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showResetSuccess]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-purple-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-4 sm:p-8 rounded-md shadow-xl">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <ArrowLeft className="w-5 h-5 text-gray-600 cursor-pointer" onClick={() => navigate("/")} />
            <div
              className="flex justify-center mb-4"
              onClick={() => navigate("/")}
            >
              <img src="/images/logo-pink.png" className="w-30 h-10" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {t("modelAuth.login.title")}
          </p>

          {/* Location status indicator */}
          <div className="pt-3">
            {locationLoading && (
              <p className="text-xs text-yellow-600 flex items-center justify-center">
                <Loader className="w-3 h-3 mr-1 animate-spin" />
                {t("modelAuth.login.gettingLocation")}
              </p>
            )}
            {!locationLoading && hasLocation && (
              <p className="text-xs text-green-600 flex items-center justify-center">
                <span className="mr-1">📍</span>
                {t("modelAuth.login.locationDetected")}
              </p>
            )}
            {!locationLoading && !hasLocation && permissionState === 'denied' && (
              <div className="space-y-2 text-center">
                <p className="text-xs text-orange-600 flex items-center justify-center">
                  <span className="mr-1">📍</span>
                  {t("modelAuth.login.locationBlocked", { defaultValue: "Location blocked" })}
                </p>
                <LocationPermissionGuide variant="light" onRetry={requestLocation} permissionDenied={true} />
              </div>
            )}
            {!locationLoading && !hasLocation && (permissionState === 'prompt' || permissionState === 'unknown') && !locationError && (
              <div className="flex items-center justify-center gap-2">
                <p className="text-xs text-gray-500 flex items-center">
                  <span className="mr-1">📍</span>
                  {t("modelAuth.login.enableLocationPrompt", { defaultValue: "Enable location for better experience" })}
                </p>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="text-xs bg-rose-500 hover:bg-rose-600 text-white px-3 py-1 rounded-full cursor-pointer"
                >
                  {t("modelAuth.login.enableLocation", { defaultValue: "Enable" })}
                </button>
              </div>
            )}
            {!locationLoading && !hasLocation && permissionState !== 'denied' && locationError && (
              <div className="flex items-center justify-center gap-2">
                <p className="text-xs text-gray-500 flex items-center">
                  <span className="mr-1">📍</span>
                  {t("modelAuth.login.locationUnavailable")}
                </p>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="text-xs text-rose-500 hover:text-rose-400 underline cursor-pointer"
                >
                  {t("modelAuth.login.retry")}
                </button>
              </div>
            )}
          </div>
        </div>

        {showSuccessMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            <p className="text-md font-medium">{t("modelAuth.login.passwordResetSuccess")}</p>
            <p className="text-sm mt-1">{t("modelAuth.login.passwordResetSuccessMessage")}</p>
          </div>
        )}

        {actionData?.error && (
          <div className="text-sm bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {t(actionData.error)}
          </div>
        )}

        <Form method="post" className="mt-8 space-y-6">
          {redirectTo && redirectTo !== "/model" && (
            <input type="hidden" name="redirectTo" value={redirectTo} />
          )}
          {hasLocation && (
            <>
              <input type="hidden" name="latitude" value={latitude!} />
              <input type="hidden" name="longitude" value={longitude!} />
            </>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.login.phoneNumber")} <span className="text-rose-500">*</span>
              </label>
              <input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                required
                minLength={10}
                maxLength={10}
                placeholder="2012345678"
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.login.password")} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  name="rememberMe"
                  type="checkbox"
                  className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded"
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
                  {t("modelAuth.login.rememberMe")}
                </label>
              </div>

              <Link
                to="/model-auth/forgot-password"
                className="text-sm font-medium text-rose-600 hover:text-rose-500"
              >
                {t("modelAuth.login.forgotPassword")}
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer group relative w-full flex justify-center items-center gap-2 py-2 px-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-sm text-white transition-colors"
            >
              {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
              {isSubmitting ? t("modelAuth.login.signingIn") : t("modelAuth.login.signIn")}
            </button>
          </div>

          <div className="flex items-center justify-center text-sm">
            {t("modelAuth.login.noAccount")}&nbsp;&nbsp;
            <Link
              to={redirectTo && redirectTo !== "/model" ? `/model-auth/register?redirect=${encodeURIComponent(redirectTo)}` : "/model-auth/register"}
              className="font-medium text-rose-600 hover:text-rose-500"
            >
              {t("modelAuth.login.createAccount")}
            </Link>
          </div>

          {/* <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              {t("modelAuth.login.areYouCustomer")}{" "}
              <Link to="/login" className="font-medium text-black hover:text-rose-500 uppercase text-xs ml-2">
                {t("modelAuth.login.loginHere")}
              </Link>
            </p>
          </div> */}
        </Form>
      </div>
    </div>
  );
}
