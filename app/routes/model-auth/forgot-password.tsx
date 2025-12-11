import { Loader } from "lucide-react";
import { useTranslation } from "react-i18next";
import { modelForgotPassword } from "~/services/model-auth.server";
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { validateModelForgotPasswordInputs } from "~/services/model-validation.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Forgot Password - Companion | XaoSao" },
    { name: "description", content: "Reset your model account password" },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return {
      error: "modelAuth.errors.invalidRequestMethod",
    };
  }

  const formData = await request.formData();
  const whatsappRaw = formData.get("whatsapp");

  if (!whatsappRaw) {
    return {
      error: "modelAuth.forgotPassword.phoneRequired",
    };
  }

  try {
    const whatsapp = Number(whatsappRaw);
    if (isNaN(whatsapp) || whatsapp <= 0) {
      return {
        error: "modelAuth.errors.invalidPhoneFormat",
      };
    }

    validateModelForgotPasswordInputs({ whatsapp });
    const result = await modelForgotPassword(whatsapp);

    if (result.success) {
      return redirect(`/model-auth/verify-otp?whatsapp=${whatsapp}`);
    }
    return {
      error: result.message || "modelAuth.forgotPassword.failedToSendOtp",
    };
  } catch (error: any) {
    if (error && typeof error === "object" && !error.message) {
      const validationError = Object.values(error)[0];
      return {
        error: String(validationError),
      };
    }

    return {
      error: error.message || "modelAuth.errors.somethingWentWrong",
    };
  }
}

export default function ModelForgotPassword() {
  const { t } = useTranslation();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-purple-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-4 sm:p-8 rounded-lg shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/images/logo-pink.png" className="w-30 h-10" />
          </div>
          <h2 className="mt-6 text-xl text-gray-900">{t("modelAuth.forgotPassword.title")}</h2>
          <p className="mt-2 text-sm text-gray-600">
            {t("modelAuth.forgotPassword.subtitle")}
          </p>
        </div>

        {actionData?.error && (
          <div className="text-sm bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {t(actionData.error)}
          </div>
        )}

        <Form method="post" className="mt-6 space-y-6">
          <div>
            <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 mb-1">
              {t("modelAuth.forgotPassword.phoneNumber")} <span className="text-rose-500">*</span>
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
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer group relative w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent text-sm font-medium rounded-sm text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
              {isSubmitting ? t("modelAuth.forgotPassword.sending") : t("modelAuth.forgotPassword.sendOtp")}
            </button>
          </div>

          <div className="text-center">
            <Link
              to="/model-auth/login"
              className="font-medium text-rose-600 hover:text-rose-500 text-sm"
            >
              {t("modelAuth.forgotPassword.backToLogin")}
            </Link>
          </div>
        </Form>

        <div className="mt-6 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            {t("modelAuth.forgotPassword.otpSentNotice")}
          </p>
        </div>
      </div>
    </div>
  );
}
