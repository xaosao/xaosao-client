import { Loader } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { modelVerifyResetToken, modelForgotPassword } from "~/services/model-auth.server";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Verify OTP - Model | XaoSao" },
    { name: "description", content: "Verify your OTP code" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const whatsapp = url.searchParams.get("whatsapp");

  if (!whatsapp) {
    return redirect("/model-auth/forgot-password");
  }
  return { whatsapp };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return {
      error: "modelAuth.errors.invalidRequestMethod",
    };
  }

  const formData = await request.formData();
  const intent = formData.get("intent");
  const whatsapp = formData.get("whatsapp");
  const otp = formData.get("otp");

  if (intent === "resend") {
    if (!whatsapp) {
      return {
        error: "modelAuth.verifyOtp.phoneRequired",
      };
    }

    try {
      await modelForgotPassword(Number(whatsapp));
      return {
        success: true,
        message: "modelAuth.verifyOtp.otpResent",
      };
    } catch (error: any) {
      return {
        error: error.message || "modelAuth.verifyOtp.failedToResend",
      };
    }
  }

  if (!otp || !whatsapp) {
    return {
      error: "modelAuth.verifyOtp.enterOtpCode",
    };
  }

  const otpString = String(otp).trim();

  if (otpString.length !== 6) {
    return {
      error: "modelAuth.verifyOtp.otpLengthError",
    };
  }

  // Must contain only uppercase hexadecimal characters (A-F, 0-9)
  if (!/^[A-F0-9]{6}$/.test(otpString)) {
    return {
      error: "modelAuth.verifyOtp.invalidOtpFormat",
    };
  }

  // Check for injection attempts
  if (/<|>|\.\.\/|\\|javascript:|script|eval\(/.test(otpString)) {
    return {
      error: "modelAuth.verifyOtp.invalidCharacters",
    };
  }

  try {
    const result = await modelVerifyResetToken(otpString);

    if (result.isValid) {
      return redirect(`/model-auth/reset-password?token=${otpString}`);
    }

    return {
      error: "modelAuth.verifyOtp.invalidOtp",
    };
  } catch (error: any) {
    return {
      error: error.message || "modelAuth.verifyOtp.failedToVerify",
    };
  }
}

export default function ModelVerifyOTP() {
  const { t } = useTranslation();
  const { whatsapp } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // Countdown timer for resend - starts on mount and restarts on successful resend
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
  }, [actionData?.success]);

  const handleOtpChange = (index: number, value: string) => {
    // Prevent pasting multiple characters
    if (value.length > 1) return;

    const newOtp = [...otp];

    // If empty (backspace/delete), allow it
    if (value === "") {
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    // Convert to uppercase and validate
    const upperValue = value.toUpperCase();

    // Only allow hexadecimal characters (0-9, A-F)
    if (!/^[A-F0-9]$/.test(upperValue)) {
      return; // Reject invalid characters
    }

    // Update the OTP array
    newOtp[index] = upperValue;
    setOtp(newOtp);

    // Auto-focus next input
    if (index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const otpValue = otp.join("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-purple-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-2 sm:p-8 rounded-lg shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/images/logo-pink.png" className="w-30 h-10" />
          </div>
          <h2 className="mt-6 text-xl text-gray-900">{t("modelAuth.verifyOtp.title")}</h2>
          <p className="mt-2 text-sm text-gray-600">
            {t("modelAuth.verifyOtp.subtitle")} &nbsp;
            <span className="font-medium text-gray-900">{whatsapp}</span>
          </p>
        </div>

        {actionData?.success && (
          <div className="text-sm bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {t("modelAuth.verifyOtp.otpSentNotice")}
          </div>
        )}

        {actionData?.error && (
          <div className="text-sm bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {t(actionData.error)}
          </div>
        )}

        <Form method="post" className="mt-8 space-y-6">
          <input type="hidden" name="whatsapp" value={whatsapp} />
          <input type="hidden" name="otp" value={otpValue} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3 text-start">
              {t("modelAuth.verifyOtp.otpCode")} <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2 justify-between">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent uppercase"
                  autoFocus={index === 0}
                  autoComplete="off"
                  inputMode="text"
                />
              ))}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || otpValue.length !== 6}
              className="cursor-pointer group relative w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
              {isSubmitting ? t("modelAuth.verifyOtp.verifying") : t("modelAuth.verifyOtp.verify")}
            </button>
          </div>
        </Form>

        <div className="flex items-center justify-between">
          <div className="text-center">
            <Link
              to="/model-auth/forgot-password"
              className="font-medium text-gray-600 hover:text-gray-500 text-sm"
            >
              ← {t("modelAuth.forgotPassword.backToLogin")}
            </Link>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="resend" />
            <input type="hidden" name="whatsapp" value={whatsapp} />
            <button
              type="submit"
              disabled={!canResend}
              className={`text-sm font-medium transition-colors ${canResend
                ? "text-rose-600 hover:text-rose-500 cursor-pointer"
                : "text-gray-400 cursor-not-allowed"
                }`}
            >
              {canResend ? t("modelAuth.verifyOtp.resendCode") : `${t("modelAuth.verifyOtp.resendIn")} ${countdown}${t("modelAuth.verifyOtp.seconds")}`}
            </button>
          </Form>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            {t("modelAuth.verifyOtp.otpSentNotice")}
          </p>
        </div>
      </div>
    </div>
  );
}
