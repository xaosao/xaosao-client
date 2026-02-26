import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import type { Route } from "./+types/verify-otp";
import { AlertCircle, CheckCircle2, Loader, ShieldCheck, LogOut } from "lucide-react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation } from "react-router";

// components
import { Button } from "~/components/ui/button";

// functions
import Countdown from "~/lib/count-down";
import { FieldValidationError } from "~/services/base.server";
import {
    getUserFromSession,
    verifyPhoneOTP,
    resendVerificationOTP,
    isCustomerPhoneVerified,
} from "~/services/auths.server";

const backgroundImages = [
    "https://images.pexels.com/photos/17441715/pexels-photo-17441715.jpeg",
    "https://images.pexels.com/photos/5910995/pexels-photo-5910995.jpeg",
    "https://images.pexels.com/photos/2055224/pexels-photo-2055224.jpeg",
    "https://images.pexels.com/photos/3089876/pexels-photo-3089876.jpeg",
    "https://images.pexels.com/photos/5910832/pexels-photo-5910832.jpeg"
];

export async function loader({ request }: Route.LoaderArgs) {
    const customerId = await getUserFromSession(request);

    // If not logged in, redirect to login
    if (!customerId) {
        throw redirect("/model-auth/login?tab=customer");
    }

    // If already verified, redirect to customer dashboard
    const isVerified = await isCustomerPhoneVerified(customerId);
    if (isVerified) {
        throw redirect("/customer");
    }

    // Get customer phone number for display
    const { prisma } = await import("~/services/database.server");
    const customer = await prisma.customer.findFirst({
        where: { id: customerId },
        select: { whatsapp: true, firstName: true },
    });

    return {
        customerId,
        phoneNumber: customer?.whatsapp,
        firstName: customer?.firstName,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const customerId = await getUserFromSession(request);

    if (!customerId) {
        throw redirect("/model-auth/login?tab=customer");
    }

    const formData = await request.formData();
    const otp = formData.get("otp") as string;
    const isResend = formData.get("isResend") === "true";

    // Handle resend OTP
    if (isResend) {
        try {
            const result = await resendVerificationOTP(customerId);
            return {
                success: true,
                error: false,
                isResend: true,
                messageKey: "verifyOtp.otpSentSuccess",
            };
        } catch (error: any) {
            if (error instanceof FieldValidationError) {
                return {
                    success: false,
                    error: true,
                    isResend: true,
                    message: error.payload.message,
                    messageKey: "verifyOtp.failedToSendOtp",
                };
            }
            return {
                success: false,
                error: true,
                isResend: true,
                messageKey: "verifyOtp.failedToSendOtp",
            };
        }
    }

    // Handle OTP verification
    try {
        if (!otp || otp.length !== 6) {
            return {
                success: false,
                error: true,
                messageKey: "verifyOtp.invalidOtpFormat",
            };
        }

        const result = await verifyPhoneOTP(customerId, otp);

        if (result.success) {
            // Redirect to customer dashboard on success
            throw redirect("/customer");
        }

        return {
            success: false,
            error: true,
            messageKey: "verifyOtp.invalidOtp",
        };
    } catch (error: any) {
        // If it's a redirect, re-throw it
        if (error instanceof Response) {
            throw error;
        }

        if (error instanceof FieldValidationError) {
            return {
                success: false,
                error: true,
                message: error.payload.message,
                messageKey: "verifyOtp.verificationFailed",
            };
        }

        return {
            success: false,
            error: true,
            messageKey: "verifyOtp.somethingWentWrong",
        };
    }
}

export default function VerifyOtpPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const loaderData = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();

    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60000);

    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

    // Mask phone number for display (e.g., 2055****89)
    const maskedPhone = loaderData?.phoneNumber
        ? String(loaderData.phoneNumber).replace(/(\d{4})(\d+)(\d{2})/, "$1****$3")
        : "";

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) return;
        const newOtp = [...otp];
        newOtp[index] = value.toUpperCase();
        setOtp(newOtp);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").toUpperCase().slice(0, 6);
        const newOtp = [...otp];
        for (let i = 0; i < pastedData.length && i < 6; i++) {
            newOtp[i] = pastedData[i];
        }
        setOtp(newOtp);
        // Focus on the next empty input or the last one
        const nextEmptyIndex = newOtp.findIndex((digit) => !digit);
        if (nextEmptyIndex !== -1) {
            inputRefs.current[nextEmptyIndex]?.focus();
        } else {
            inputRefs.current[5]?.focus();
        }
    };

    useEffect(() => {
        if (timeLeft <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft((prev) => prev - 1000);
        }, 1000);

        return () => clearInterval(interval);
    }, [timeLeft]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Reset timer when OTP is successfully resent
        if (actionData?.isResend && actionData?.success) {
            setTimeLeft(60000);
            setOtp(["", "", "", "", "", ""]);
        }
    }, [actionData]);

    // Focus first input on mount
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    return (
        <div className="fullscreen safe-area relative overflow-hidden">
            <div className="absolute inset-0">
                {backgroundImages.map((image, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-1000 ${index === currentImageIndex ? "opacity-100" : "opacity-0"
                            }`}
                        style={{
                            backgroundImage: `url(${image})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                        }}
                    />
                ))}
            </div>

            <div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-11/12 h-auto
                            bg-black/50 backdrop-blur-md shadow-2xl py-8 px-4 sm:p-8 flex flex-col justify-center rounded-lg z-20
                            lg:top-0 lg:right-0 lg:left-auto lg:translate-x-0 lg:translate-y-0 lg:w-2/5 lg:h-full lg:rounded-none"
            >
                <div className="rounded-full flex items-center justify-center mb-8 cursor-pointer" onClick={() => navigate("/")}>
                    <img src="/images/logo-white.png" className="w-30 h-10" alt="Logo" />
                </div>

                <div className="space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="flex items-center justify-center text-md sm:text-lg font-bold text-white uppercase">
                            <ShieldCheck className="text-rose-500 mr-2" />
                            {t('verifyOtp.title', 'Verify Your Phone')}
                        </h1>
                        <p className="text-white text-sm">
                            {t('verifyOtp.subtitle', 'Enter the 6-digit code sent to')}
                        </p>
                        <p className="text-rose-400 font-semibold">{maskedPhone}</p>
                    </div>

                    {/* Success message for resend */}
                    {actionData?.isResend && actionData?.success && (
                        <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span className="text-green-200 text-sm">
                                {t('verifyOtp.otpSentSuccess', 'OTP sent successfully!')}
                            </span>
                        </div>
                    )}

                    {/* Error message */}
                    {actionData?.error && !actionData?.isResend && (
                        <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <span className="text-red-200 text-sm">
                                {actionData?.message || t(actionData?.messageKey || 'verifyOtp.invalidOtp', 'Invalid OTP. Please try again.')}
                            </span>
                        </div>
                    )}

                    <Form method="post" className="space-y-6">
                        <div className="flex justify-center space-x-1 sm:space-x-3" onPaste={handlePaste}>
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => {
                                        inputRefs.current[index] = el;
                                    }}
                                    type="text"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className="w-12 h-12 text-center text-lg font-semibold bg-gray-800/50 border-2 border-gray-600 text-white rounded-lg focus:border-rose-500 focus:ring-2 focus:ring-pink-500/20 focus:outline-none transition-colors uppercase"
                                />
                            ))}
                        </div>

                        <input type="hidden" name="otp" value={otp.join("")} />

                        <Button
                            type="submit"
                            className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3 font-medium shadow-lg transition-all duration-300 uppercase"
                            disabled={otp.some((digit) => !digit) || isSubmitting}
                        >
                            {isSubmitting ? <Loader className="w-4 h-4 mr-1 animate-spin" /> : null}
                            {isSubmitting ? t('verifyOtp.verifying', 'Verifying...') : t('verifyOtp.verifyButton', 'Verify')}
                        </Button>
                    </Form>

                    <div className="text-center space-y-4">
                        {timeLeft > 0 ? (
                            <div className="text-sm text-gray-400">
                                <Countdown initialMs={timeLeft} />
                            </div>
                        ) : (
                            <Form method="post" className="space-y-4">
                                <input type="hidden" name="isResend" value="true" />

                                {actionData?.isResend && actionData?.error && (
                                    <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                        <span className="text-red-200 text-sm">
                                            {actionData?.message || t(actionData?.messageKey || 'verifyOtp.failedToSendOtp', 'Failed to send OTP')}
                                        </span>
                                    </div>
                                )}

                                <div className="w-full flex items-center justify-center gap-2">
                                    <p className="text-sm text-gray-400">{t('verifyOtp.dontReceive', "Didn't receive the code?")}</p>
                                    <Button
                                        type="submit"
                                        variant="link"
                                        className="cursor-pointer text-md text-rose-500 hover:text-rose-600 font-medium p-0"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? t('verifyOtp.resending', 'Resending...') : t('verifyOtp.resendCode', 'Resend Code')}
                                    </Button>
                                </div>
                            </Form>
                        )}
                    </div>

                    <div className="text-center pt-4 border-t border-gray-700 space-y-3">
                        <p className="text-xs text-gray-500">
                            {t('verifyOtp.helpText', 'Having trouble? Contact support for assistance.')}
                        </p>
                        <Form method="post" action="/logout">
                            <Button
                                type="submit"
                                variant="ghost"
                                className="text-gray-400 hover:bg-rose-500 hover:text-white text-xs"
                            >
                                <LogOut className="w-3 h-3 mr-1" />
                                {t('verifyOtp.logout', 'Logout and go back')}
                            </Button>
                        </Form>
                    </div>
                </div>
            </div>
        </div>
    );
}
