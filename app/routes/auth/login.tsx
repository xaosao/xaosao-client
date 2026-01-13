import type { Route } from "./+types/login";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Loader, User, AlertCircle } from "lucide-react";
import { Form, Link, useActionData, useNavigate, useNavigation } from "react-router";

// Components
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { LocationPermissionGuide } from "~/components/LocationPermissionGuide";

// Hooks
import { useIsMobile } from "~/hooks/use-mobile";
import { useGeolocation } from "~/hooks/useGeolocation";

// Services & Types
import { validateSignInInputs } from "~/services/validation.server";
import type { ICustomerSigninCredentials } from "~/interfaces";

// Constants
const BACKGROUND_IMAGES = [
    "https://images.pexels.com/photos/17441715/pexels-photo-17441715.jpeg",
    "https://images.pexels.com/photos/5910995/pexels-photo-5910995.jpeg",
    "https://images.pexels.com/photos/2055224/pexels-photo-2055224.jpeg",
    "https://images.pexels.com/photos/3089876/pexels-photo-3089876.jpeg",
    "https://images.pexels.com/photos/5910832/pexels-photo-5910832.jpeg"
] as const;

const CAROUSEL_INTERVAL_MS = 5000;
const PHONE_NUMBER_LENGTH = { MIN: 10, MAX: 10 };

// Types
interface ActionResponse {
    success?: boolean;
    error?: boolean;
    message?: string;
}

/**
 * Loader to check if user is already logged in
 * Redirects to customer dashboard if session exists
 */
export async function loader({ request }: Route.LoaderArgs) {
    const { getUserFromSession } = await import("~/services/auths.server");
    const { redirect } = await import("react-router");

    const customerId = await getUserFromSession(request);

    if (customerId) {
        // User already logged in, redirect to dashboard
        throw redirect("/customer");
    }

    return null;
}

/**
 * Server action handler for login form submission
 * Validates credentials and authenticates user
 */
export async function action({ request }: Route.ActionArgs): Promise<ActionResponse> {
    // Only allow POST requests
    if (request.method !== "POST") {
        return {
            success: false,
            error: true,
            message: "Invalid request method"
        };
    }

    try {
        // Dynamic import for code splitting
        const { customerLogin } = await import("~/services/auths.server");
        const { prisma } = await import("~/services/database.server");

        const formData = await request.formData();

        // Extract and sanitize form data
        const whatsappRaw = formData.get("whatsapp");
        const passwordRaw = formData.get("password");
        const rememberMeRaw = formData.get("rememberMe");

        // Get GPS coordinates from client (if provided)
        const latitudeRaw = formData.get("latitude");
        const longitudeRaw = formData.get("longitude");

        // Validate required fields
        if (!whatsappRaw || !passwordRaw) {
            return {
                success: false,
                error: true,
                message: "login.errors.phoneAndPasswordRequired"
            };
        }

        // Parse and validate phone number
        const whatsapp = Number(whatsappRaw);
        if (isNaN(whatsapp) || whatsapp <= 0) {
            return {
                success: false,
                error: true,
                message: "login.errors.invalidPhoneFormat"
            };
        }

        // Construct credentials object
        const signInData: ICustomerSigninCredentials = {
            whatsapp,
            password: String(passwordRaw),
            rememberMe: rememberMeRaw === "on",
        };

        // Validate and attempt login
        validateSignInInputs(signInData);
        const result = await customerLogin(signInData);

        // Update user GPS location if provided (non-blocking - don't fail login if this fails)
        if (latitudeRaw && longitudeRaw) {
            try {
                const latitude = parseFloat(String(latitudeRaw));
                const longitude = parseFloat(String(longitudeRaw));

                // Validate coordinates
                if (!isNaN(latitude) && !isNaN(longitude) &&
                    latitude >= -90 && latitude <= 90 &&
                    longitude >= -180 && longitude <= 180) {

                    const customer = await prisma.customer.findFirst({
                        where: { whatsapp },
                        select: { id: true }
                    });

                    if (customer) {
                        // Update customer GPS location in database
                        await prisma.customer.update({
                            where: { id: customer.id },
                            data: {
                                latitude,
                                longitude,
                            },
                        }).catch(err => {
                            // Log error but don't fail login
                            console.error("Failed to update GPS location on login:", err);
                        });

                        console.log(`GPS location updated for user ${whatsapp}: (${latitude}, ${longitude})`);
                    }
                }
            } catch (locationError) {
                console.error("GPS location update error during login:", locationError);
            }
        }

        if (!result) {
            return {
                success: false,
                error: true,
                message: "login.errors.loginFailed"
            };
        }

        return result as ActionResponse;

    } catch (error: unknown) {
        // Handle authentication errors
        if (error && typeof error === "object" && "status" in error) {
            const httpError = error as { status: number; message?: string };
            if (httpError.status === 401) {
                return {
                    success: false,
                    error: true,
                    message: httpError.message || "login.errors.invalidCredentials"
                };
            }
        }

        // Handle validation errors
        if (error && typeof error === "object") {
            const validationError = Object.values(error)[0];
            return {
                success: false,
                error: true,
                message: String(validationError)
            };
        }

        // Handle unexpected errors
        return {
            success: false,
            error: true,
            message: "login.errors.unexpectedError"
        };
    }
}


export default function SignInPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const actionData = useActionData<typeof action>();

    // Geolocation hook - automatically requests location on mount
    const {
        latitude,
        longitude,
        loading: locationLoading,
        error: locationError,
        permissionState,
        permissionDenied,
        requestLocation,
        canRetry
    } = useGeolocation({ enableHighAccuracy: true, timeout: 15000 });

    // Local state
    const [showPassword, setShowPassword] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Computed values
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST";
    const isMobile = useIsMobile();
    const hasLocation = latitude !== null && longitude !== null;

    // Background image carousel effect
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => (prevIndex + 1) % BACKGROUND_IMAGES.length);
        }, CAROUSEL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, []);

    // Toggle password visibility handler
    const togglePasswordVisibility = useCallback(() => {
        setShowPassword((prev) => !prev);
    }, []);

    // Navigation handlers
    const handleBackClick = useCallback(() => {
        navigate("/");
    }, [navigate]);

    return (
        <div className="fullscreen safe-area relative overflow-hidden">
            {BACKGROUND_IMAGES.map((image, index) => (
                <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-3000 ${index === currentImageIndex ? "opacity-100" : "opacity-0"
                        }`}
                    style={{
                        backgroundImage: `url(${image})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />

            ))}

            <div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-11/12 h-auto
                            bg-black/50 backdrop-blur-md shadow-2xl py-8 px-2 sm:px-4 sm:p-8 flex flex-col justify-start rounded-sm z-20
                            lg:top-0 lg:right-0 lg:left-auto lg:translate-x-0 lg:translate-y-0 lg:w-2/5 lg:h-full lg:rounded-none">

                <button
                    type="button"
                    onClick={handleBackClick}
                    className="rounded-full flex items-center justify-center sm:justify-start mb-8 cursor-pointer"
                    aria-label="Go back to home"
                >
                    <img src="/images/logo-white.png" className="w-30 h-10" />
                </button>

                <div className="space-y-2 mb-6">
                    <h1 className="flex items-center justify-start text-md sm:text-lg font-bold text-white uppercase">
                        <User className="text-rose-500" />&nbsp;{t('login.title')}
                    </h1>
                    <p className="text-white text-sm">{t('login.subtitle')}</p>

                    {/* Location status indicator */}
                    <div className="pt-2">
                        {locationLoading && (
                            <p className="text-xs text-yellow-300 flex items-center">
                                <Loader className="w-3 h-3 mr-1 animate-spin" />
                                {t('login.gettingLocation', { defaultValue: 'Getting your location...' })}
                            </p>
                        )}
                        {!locationLoading && hasLocation && (
                            <p className="text-xs text-green-400 flex items-center">
                                <span className="mr-1">📍</span>
                                {t('login.locationDetected', { defaultValue: 'Location detected' })}
                            </p>
                        )}
                        {!locationLoading && !hasLocation && permissionState === 'denied' && (
                            <div className="space-y-2">
                                <p className="text-xs text-orange-400 flex items-center">
                                    <span className="mr-1">📍</span>
                                    {t('login.locationBlocked', { defaultValue: 'Location blocked' })}
                                </p>
                                <LocationPermissionGuide variant="dark" onRetry={requestLocation} permissionDenied={true} />
                            </div>
                        )}
                        {!locationLoading && !hasLocation && (permissionState === 'prompt' || permissionState === 'unknown') && !locationError && (
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-300 flex items-center">
                                    <span className="mr-1">📍</span>
                                    {t('login.enableLocationPrompt', { defaultValue: 'Enable location for better experience' })}
                                </p>
                                <button
                                    type="button"
                                    onClick={requestLocation}
                                    className="text-xs bg-rose-500 hover:bg-rose-600 text-white px-3 py-1 rounded-full cursor-pointer"
                                >
                                    {t('login.enableLocation', { defaultValue: 'Enable' })}
                                </button>
                            </div>
                        )}
                        {!locationLoading && !hasLocation && permissionState !== 'denied' && locationError && (
                            <div className="flex items-center justify-between w-full">
                                <p className="text-xs text-gray-400 flex items-center">
                                    <span className="mr-1">📍</span>
                                    {t('login.locationUnavailable', { defaultValue: 'Location unavailable' })}
                                </p>
                                <button
                                    type="button"
                                    onClick={requestLocation}
                                    className="text-xs text-rose-500 hover:text-rose-400 underline cursor-pointer"
                                >
                                    {t('login.retry', { defaultValue: 'Retry' })}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <Form method="post" className="space-y-4 sm:space-y-6" noValidate>
                    {/* Hidden fields for GPS coordinates */}
                    {hasLocation && (
                        <>
                            <input type="hidden" name="latitude" value={latitude!} />
                            <input type="hidden" name="longitude" value={longitude!} />
                        </>
                    )}

                    <div>
                        <Label htmlFor="whatsapp" className="text-gray-300 text-sm">
                            {t('login.phoneNumber')}
                            <span className="text-rose-500" aria-label="required">*</span>
                        </Label>
                        <Input
                            required
                            minLength={PHONE_NUMBER_LENGTH.MIN}
                            maxLength={PHONE_NUMBER_LENGTH.MAX}
                            id="whatsapp"
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]{10}"
                            name="whatsapp"
                            placeholder={t('login.phonePlaceholder')}
                            autoComplete="tel"
                            className="mt-1 border-white text-white placeholder-gray-400 focus:border-pink-500 backdrop-blur-sm"
                            aria-describedby="whatsapp-error"
                        />
                    </div>

                    <div>
                        <Label htmlFor="password" className="text-gray-300 text-sm">
                            {t('login.password')}
                            <span className="text-rose-500" aria-label="required">*</span>
                        </Label>
                        <div className="relative mt-1">
                            <Input
                                required
                                id="password"
                                type={showPassword ? "text" : "password"}
                                name="password"
                                placeholder={t('login.passwordPlaceholder')}
                                autoComplete="current-password"
                                className="border-white text-white placeholder-gray-400 focus:border-rose-500 pr-10 backdrop-blur-sm"
                                aria-describedby="password-error"
                            />
                            <button
                                type="button"
                                onClick={togglePasswordVisibility}
                                className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {actionData?.error && actionData.message && (
                        <div
                            role="alert"
                            aria-live="polite"
                            className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm"
                        >
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" aria-hidden="true" />
                            <span className="text-red-200 text-sm">
                                {t(actionData.message)}
                            </span>
                        </div>
                    )}

                    <div className="w-full flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember"
                                type="checkbox"
                                name="rememberMe"
                                className="w-4 h-4 text-pink-500 bg-gray-900 border-gray-600 rounded"
                                aria-label="Remember me"
                            />
                            <Label htmlFor="remember" className="ml-2 text-sm text-gray-300 cursor-pointer">
                                {t('login.rememberMe')}
                            </Label>
                        </div>

                        <Link
                            to="/forgot-password"
                            className="text-white hover:text-rose-600 text-sm underline transition-colors rounded"
                        >
                            {t('login.forgotPassword')}
                        </Link>
                    </div>

                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-rose-500/50 disabled:cursor-not-allowed text-white py-3 font-medium uppercase transition-colors"
                        aria-busy={isSubmitting}
                    >
                        {isSubmitting && <Loader className="w-4 h-4 animate-spin" aria-hidden="true" />}
                        {isSubmitting ? t('login.loggingIn') : t('login.loginButton')}
                    </Button>

                    <div className="flex flex-col sm:flex-row text-center justify-center space-y-2">
                        <div className="space-x-2">
                            <span className="text-sm text-white">{t('login.noAccount')}</span>
                            <Link
                                to="/register"
                                className="text-white text-sm font-bold transition-colors rounded uppercase hover:text-rose-500"
                            >
                                {isMobile ? t('login.createAccountMobile') : t('login.createAccount')}
                            </Link>
                        </div>
                    </div>
                </Form>
            </div>
        </div>
    );
}