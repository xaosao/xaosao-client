import { Loader, ArrowLeft, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useActionData, useLoaderData, useNavigation, useNavigate } from "react-router";

// services
import { modelRegister } from "~/services/model-auth.server";
import { FieldValidationError } from "~/services/base.server";
import {
  getModelRegistrationData,
  clearModelRegistrationSession,
  sendModelRegistrationOTP,
  storeModelRegistrationData,
  verifyModelRegistrationOTP,
} from "~/services/model-auth.server";
import { migrateProfileToStructuredFolder } from "~/services/upload.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Verify Registration - Companion | XaoSao" },
    { name: "description", content: "Verify your phone number to complete registration" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const phone = url.searchParams.get("phone");

  // Check if we have registration data in session
  const registrationData = await getModelRegistrationData(request);

  if (!registrationData) {
    // No registration data - redirect back to register page
    throw redirect("/model-auth/register");
  }

  return {
    maskedPhone: phone || String(registrationData.whatsapp).replace(/(\d{4})(\d+)(\d{2})/, "$1****$3"),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return { error: "modelAuth.errors.invalidRequestMethod" };
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Get registration data from session
  const registrationData = await getModelRegistrationData(request);

  if (!registrationData) {
    return { error: "modelAuth.verifyRegistration.sessionExpired" };
  }

  // Handle resend OTP
  if (intent === "resend") {
    try {
      const { otp } = await sendModelRegistrationOTP(registrationData.whatsapp);

      // Update session with new OTP
      const sessionCookie = await storeModelRegistrationData(request, {
        ...registrationData,
        otp,
        otpExpiry: Date.now() + 5 * 60 * 1000,
      });

      return new Response(
        JSON.stringify({
          success: true,
          isResend: true,
          message: "modelAuth.verifyRegistration.otpResent",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": sessionCookie,
          },
        }
      );
    } catch (error: any) {
      return {
        error: error.message || "modelAuth.verifyRegistration.resendFailed",
        isResend: true,
      };
    }
  }

  // Handle OTP verification
  const otp = formData.get("otp") as string;

  if (!otp || otp.length !== 6) {
    return { error: "modelAuth.verifyRegistration.invalidOtpFormat" };
  }

  // Must contain only uppercase hexadecimal characters (A-F, 0-9)
  if (!/^[A-F0-9]{6}$/.test(otp.toUpperCase())) {
    return { error: "modelAuth.verifyRegistration.invalidOtpFormat" };
  }

  // Verify OTP
  const isValid = verifyModelRegistrationOTP(
    registrationData.otp,
    otp,
    registrationData.otpExpiry
  );

  if (!isValid) {
    // Check if expired specifically
    if (Date.now() > registrationData.otpExpiry) {
      return { error: "modelAuth.verifyRegistration.otpExpired" };
    }
    return { error: "modelAuth.verifyRegistration.invalidOtp" };
  }

  // OTP verified - create model account
  try {
    const { otp: _otp, otpExpiry: _exp, ip, accessKey, ...modelData } = registrationData;

    const result = await modelRegister(modelData, ip, accessKey);

    if (result.success) {
      // Move profile image to structured folder (non-blocking)
      migrateProfileToStructuredFolder("model", modelData.whatsapp, modelData.profile).catch((err) =>
        console.error("[Register] Model profile migration failed:", err)
      );

      // Clear registration session
      const clearCookie = await clearModelRegistrationSession(request);

      // Redirect to login with success message
      return redirect(
        "/model-auth/login?tab=model&toastMessage=modelAuth.verifyRegistration.registrationSuccess&toastType=success&toastDuration=5000",
        {
          headers: {
            "Set-Cookie": clearCookie,
          },
        }
      );
    }

    return { error: result.message || "modelAuth.errors.registrationFailed" };
  } catch (error: any) {
    console.log("Model registration after OTP failed:", error);

    if (error instanceof FieldValidationError || (error && (error.payload || error.name === "FieldValidationError"))) {
      const payload = error.payload || error;
      let errorMessage = "modelAuth.errors.registrationFailed";

      if (payload.message) {
        if (payload.message.includes("phone number is already registered")) {
          errorMessage = "modelAuth.errors.phoneAlreadyRegistered";
        } else {
          errorMessage = payload.message;
        }
      } else if (payload.messageKey) {
        errorMessage = payload.messageKey;
      }

      return { error: errorMessage };
    }

    return {
      error: error.message || "modelAuth.errors.registrationFailed",
    };
  }
}

export default function VerifyRegistrationOTP() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const isSubmitting = navigation.state === "submitting";

  // Countdown timer for resend
  useEffect(() => {
    setCanResend(false);
    setCountdown(60);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [actionData?.isResend && actionData?.success]);

  // Reset OTP on successful resend
  useEffect(() => {
    if (actionData?.isResend && actionData?.success) {
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  }, [actionData]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const upperValue = value.toUpperCase();

    // Only allow hexadecimal characters (0-9, A-F)
    if (value !== "" && !/^[A-F0-9]$/.test(upperValue)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = upperValue;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
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
    const nextEmptyIndex = newOtp.findIndex((digit) => !digit);
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else {
      inputRefs.current[5]?.focus();
    }
  };

  const otpValue = otp.join("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-purple-50 px-4">
      <div className="max-w-md w-full space-y-6 bg-white p-4 sm:p-8 rounded-lg shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/images/logo-pink.png" className="w-30 h-10" alt="XaoSao" />
          </div>
          <h2 className="flex items-center justify-center gap-2 text-lg font-bold text-gray-900">
            <ShieldCheck className="w-5 h-5 text-rose-500" />
            {t("modelAuth.verifyRegistration.title", "Verify Your Phone Number")}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t("modelAuth.verifyRegistration.subtitle", "Enter the 6-digit code sent to")}
          </p>
          <p className="text-rose-500 font-semibold mt-1">{loaderData.maskedPhone}</p>
        </div>

        {/* Resend success message */}
        {actionData?.isResend && actionData?.success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-green-700 text-sm">
              {t("modelAuth.verifyRegistration.otpResent", "New OTP sent successfully!")}
            </span>
          </div>
        )}

        {/* Error message */}
        {actionData?.error && !actionData?.isResend && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-red-700 text-sm">
              {t(actionData.error)}
            </span>
          </div>
        )}

        {/* Resend error */}
        {actionData?.isResend && actionData?.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-red-700 text-sm">
              {t(actionData.error)}
            </span>
          </div>
        )}

        {/* OTP Input Form */}
        <Form method="post" className="space-y-6">
          <input type="hidden" name="otp" value={otpValue} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
              {t("modelAuth.verifyRegistration.otpCode", "OTP Code")} <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
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
                  className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent uppercase"
                  autoFocus={index === 0}
                  autoComplete="off"
                  inputMode="text"
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || otpValue.length !== 6}
            className="cursor-pointer w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
            {isSubmitting ? t("modelAuth.verifyRegistration.verifying", "Verifying...") : t("modelAuth.verifyRegistration.verify", "Verify & Register")}
          </button>
        </Form>

        {/* Resend & Back */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/model-auth/register")}
            className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("modelAuth.verifyRegistration.changeNumber", "Change Number")}
          </button>

          {canResend ? (
            <Form method="post">
              <input type="hidden" name="intent" value="resend" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer text-sm font-medium text-rose-600 hover:text-rose-500 transition-colors"
              >
                {isSubmitting ? t("modelAuth.verifyRegistration.resending", "Resending...") : t("modelAuth.verifyRegistration.resendCode", "Resend Code")}
              </button>
            </Form>
          ) : (
            <span className="text-sm text-gray-400">
              {t("modelAuth.verifyRegistration.resendIn", "Resend in")} {countdown}{t("modelAuth.verifyRegistration.seconds", "s")}
            </span>
          )}
        </div>

        {/* Info box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            {t("modelAuth.verifyRegistration.notice", "We sent a verification code to your phone number via SMS. The code expires in 5 minutes.")}
          </p>
        </div>
      </div>
    </div>
  );
}
