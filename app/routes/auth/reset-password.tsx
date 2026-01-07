import { useTranslation } from "react-i18next"
import type { Route } from "./+types/reset-password"
import { useState, useEffect, useCallback } from "react"
import { AlertCircle, Eye, EyeOff, Loader } from "lucide-react"
import { Form, Link, redirect, useActionData, useNavigate, useNavigation } from "react-router"

// components
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Button } from "~/components/ui/button"
import { validateResetPasswordInputs } from "~/services/validation.server"
import { FieldValidationError } from "~/services/base.server"

const backgroundImages = [
    "https://images.pexels.com/photos/6324113/pexels-photo-6324113.jpeg",
    "https://images.pexels.com/photos/7351022/pexels-photo-7351022.jpeg",
    "https://images.pexels.com/photos/5910832/pexels-photo-5910832.jpeg",
]

export async function action({ request }: Route.ActionArgs) {
    const { resetPassword } = await import("~/services/auths.server");
    const url = new URL(request.url);
    const otp = url.searchParams.get("otp");

    const formData = await request.formData();
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!otp || !password || !confirmPassword) {
        return { success: false, error: true, messageKey: "resetPassword.errors.invalidOtpOrPassword" }
    }

    // Check if passwords match
    if (password !== confirmPassword) {
        return { success: false, error: true, messageKey: "resetPassword.errors.passwordMismatch" }
    }

    try {
        await validateResetPasswordInputs({ password })
        const res = await resetPassword(otp as string, password)
        if (res.success) {
            return redirect("/login")
        }
        return { success: res.success, error: res.error, message: res.message, messageKey: "resetPassword.errors.somethingWentWrong" }
    } catch (error: any) {
        console.log("Error::", error)
        if (error instanceof FieldValidationError) {
            return {
                success: false,
                error: true,
                message: error.payload.message,
                messageKey: "resetPassword.errors.somethingWentWrong",
            };
        }
        const value = Object.values(error)[0];
        return { success: false, error: true, message: value as string, messageKey: "resetPassword.errors.somethingWentWrong" };
    }
}

export default function ResetPasswordPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const actionData = useActionData<typeof action>();
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

    const togglePasswordVisibility = useCallback(() => {
        setShowPassword((prev) => !prev);
    }, []);

    const toggleConfirmPasswordVisibility = useCallback(() => {
        setShowConfirmPassword((prev) => !prev);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length)
        }, 5000)
        return () => clearInterval(interval)
    }, [backgroundImages.length])

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
                            lg:top-0 lg:right-0 lg:left-auto lg:translate-x-0 lg:translate-y-0 lg:w-2/5 lg:h-full lg:rounded-none">


                <div className="rounded-full flex items-center justify-center mb-8 cursor-pointer" onClick={() => navigate("/")}>
                    {/* <p className="flex items-center space-x-2">
                        <ArrowLeft className="text-xl text-gray-300" />
                        <span className="text-white text-xl">XAOSAO</span>
                    </p> */}
                    <img src="/images/logo-white.png" className="w-30 h-10" />
                </div>

                <div className="space-y-6">
                    <div className="text-center">
                        <h1 className="text-lg font-bold text-white uppercase">
                            {t('resetPassword.title')}
                        </h1>
                        <p className="text-gray-300">{t('resetPassword.subtitle')}</p>
                    </div>

                    <Form method="post" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-300">
                                {t('resetPassword.newPassword')} <span className="text-rose-500">*</span>
                            </Label>
                            <div className="relative mt-1">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="Pa$$w0rd!"
                                    className="border-white text-white placeholder-gray-400 backdrop-blur-sm pr-10"
                                    required
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

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-gray-300">
                                {t('resetPassword.confirmPassword')} <span className="text-rose-500">*</span>
                            </Label>
                            <div className="relative mt-1">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    placeholder="Pa$$w0rd!"
                                    className="border-white text-white placeholder-gray-400 backdrop-blur-sm pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={toggleConfirmPasswordVisibility}
                                    className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {actionData?.error && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                <span className="text-red-200 text-sm">
                                    {actionData?.messageKey ? t(actionData.messageKey) : actionData?.message}
                                </span>
                            </div>
                        )}
                        <Button
                            type="submit"
                            className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3 font-medium shadow-lg transition-all duration-300 uppercase"
                        >
                            {isSubmitting ? <Loader className="w-4 h-4 mr-1 animate-spin" /> : ""}
                            {isSubmitting ? t('resetPassword.reseting') : t('resetPassword.reset')}
                        </Button>
                    </Form>

                    <div className="text-center pt-4">
                        <p className="text-md text-gray-400">
                            {t('resetPassword.rememberPassword')}{" "}&nbsp;&nbsp;
                            <Link to="/login" className="text-sm text-white hover:text-rose-600 font-medium uppercase">
                                {t('login.loginButton')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
