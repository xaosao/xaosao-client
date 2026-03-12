import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { ArrowLeft, Loader, Eye, EyeOff, Check, UserRound, Calendar } from "lucide-react";
import { Form, Link, useActionData, useLoaderData, useNavigate, useNavigation, useSearchParams } from "react-router";

// services
import { modelLogin } from "~/services/model-auth.server";
import type { IModelSigninCredentials } from "~/services/model-auth.server";
import { validateModelSignInInputs } from "~/services/model-validation.server";
import { validateSignInInputs } from "~/services/validation.server";
import type { ICustomerSigninCredentials } from "~/interfaces";

export const meta: MetaFunction = () => {
  return [
    { title: "Login - XaoSao" },
    { name: "description", content: "Login to your XaoSao account" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { getModelFromSession } = await import("~/services/model-auth.server");
  const { getUserFromSession } = await import("~/services/auths.server");
  const { redirect } = await import("react-router");

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab");
  const redirectTo = url.searchParams.get("redirect") || "/model";

  // Check if model is already logged in
  const modelId = await getModelFromSession(request);
  if (modelId) {
    throw redirect(redirectTo);
  }

  // Check if customer is already logged in
  const customerId = await getUserFromSession(request);
  if (customerId) {
    const customerRedirect = url.searchParams.get("redirect") || "/customer";
    throw redirect(customerRedirect);
  }

  const reset = url.searchParams.get("reset");

  return {
    showResetSuccess: reset === "success",
    redirectTo,
    initialTab: tab === "model" ? "model" : "customer",
  };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return {
      error: "modelAuth.errors.invalidRequestMethod",
    };
  }

  const formData = await request.formData();
  const loginType = formData.get("loginType") as string;

  const whatsappRaw = formData.get("whatsapp");
  const passwordRaw = formData.get("password");
  const rememberMeRaw = formData.get("rememberMe");
  const redirectTo = formData.get("redirectTo") as string | null;

  if (!whatsappRaw || !passwordRaw) {
    return {
      error: loginType === "customer"
        ? "login.errors.phoneAndPasswordRequired"
        : "modelAuth.errors.phoneAndPasswordRequired",
    };
  }

  const whatsapp = Number(whatsappRaw);
  if (isNaN(whatsapp) || whatsapp <= 0) {
    return {
      error: loginType === "customer"
        ? "login.errors.invalidPhoneFormat"
        : "modelAuth.errors.invalidPhoneFormat",
    };
  }

  // ─── Customer Login ───
  if (loginType === "customer") {
    try {
      const { customerLogin } = await import("~/services/auths.server");

      const signInData: ICustomerSigninCredentials = {
        whatsapp,
        password: String(passwordRaw),
        rememberMe: rememberMeRaw === "on",
      };

      validateSignInInputs(signInData);

      const url = new URL(request.url);
      const redirectPath = url.searchParams.get("redirect") || "/customer";
      const result = await customerLogin(signInData, redirectPath);

      if (!result) {
        return { error: "login.errors.loginFailed" };
      }

      // Normalize customer response: convert { error: true, message: "..." } to { error: "..." }
      if (result && typeof result === "object" && "error" in result && "message" in result) {
        const r = result as { error?: boolean; message?: string };
        if (r.error && r.message) {
          return { error: r.message };
        }
      }

      return result;
    } catch (error: any) {
      if (error && typeof error === "object" && "status" in error) {
        const httpError = error as { status: number; message?: string };
        if (httpError.status === 401) {
          return { error: httpError.message || "login.errors.invalidCredentials" };
        }
      }

      if (error && typeof error === "object" && !error.message) {
        const validationError = Object.values(error)[0];
        return { error: String(validationError) };
      }

      return { error: error.message || "login.errors.unexpectedError" };
    }
  }

  // ─── Model Login (default) ───
  try {
    const credentials: IModelSigninCredentials = {
      whatsapp,
      password: String(passwordRaw),
      rememberMe: rememberMeRaw === "on",
      redirectTo: redirectTo || undefined,
    };

    validateModelSignInInputs(credentials);

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

export default function UnifiedLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const { showResetSuccess, redirectTo, initialTab } = useLoaderData<typeof loader>();
  const isSubmitting = navigation.state === "submitting";

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"customer" | "model">(initialTab as "customer" | "model");
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(showResetSuccess);

  const isCustomer = activeTab === "customer";

  // Show error as toast via URL params
  useEffect(() => {
    if (actionData?.error) {
      const params = new URLSearchParams(window.location.search);
      params.set("toastMessage", actionData.error);
      params.set("toastType", "error");
      params.set("toastDuration", "4000");
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [actionData]);

  useEffect(() => {
    if (showResetSuccess) {
      setShowSuccessMessage(true);
      const timer = setTimeout(() => setShowSuccessMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showResetSuccess]);

  return (
    <div
      className={`min-h-screen relative overflow-hidden transition-all duration-700 ease-in-out ${isCustomer
        ? "bg-gradient-to-br from-rose-100 via-pink-50 to-orange-50"
        : "bg-gradient-to-br from-rose-100 via-pink-50 to-orange-50"
        }`}
    >
      {/* Decorative background orbs */}
      <div
        className={`absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full blur-3xl transition-all duration-1000 pointer-events-none ${isCustomer ? "bg-rose-200/50" : "bg-gray-200/20"
          }`}
      />
      <div
        className={`absolute -bottom-32 -left-32 w-[28rem] h-[28rem] rounded-full blur-3xl transition-all duration-1000 pointer-events-none ${isCustomer ? "bg-pink-200/40" : "bg-slate-200/20"
          }`}
      />
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20rem] h-[20rem] rounded-full blur-3xl transition-all duration-1000 pointer-events-none ${isCustomer ? "bg-orange-100/30" : "bg-blue-50/10"
          }`}
      />

      {/* Back button */}

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-8">
        <div className="w-full max-w-[460px]">
          {/* Card */}
          <div
            className={`bg-white/70 backdrop-blur-2xl rounded-md p-6 sm:p-8 transition-all duration-500 border border-white/40 ${isCustomer
              ? "shadow-[0_25px_80px_-15px_rgba(244,63,94,0.2)]"
              : "shadow-[0_25px_80px_-15px_rgba(0,0,0,0.07)]"
              }`}
          >
            <div className="flex justify-center mb-6 gap-2">
              <button
                type="button"
                onClick={() => navigate("/")}
                className={`rounded-2xl backdrop-blur-sm transition-all duration-300 cursor-pointer ${isCustomer
                  ? "bg-white/50 hover:bg-white/80 text-rose-500"
                  : "bg-white/50 hover:bg-white/80 text-gray-500"
                  }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div onClick={() => navigate("/")} className="cursor-pointer">
                <img src="/images/logo-pink.png" className="h-8" alt="Xaosao" />
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex bg-gray-100/80 rounded-2xl p-1.5 mb-4">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("customer");
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", "customer");
                  window.history.replaceState({}, "", url.toString());
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[14px] text-sm font-semibold transition-all duration-300 cursor-pointer ${isCustomer
                  ? "bg-white text-rose-500 shadow-md shadow-rose-100/50"
                  : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                {isCustomer ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                ຈອງບໍລິການ
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("model");
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", "model");
                  window.history.replaceState({}, "", url.toString());
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[14px] text-sm font-semibold transition-all duration-300 cursor-pointer ${!isCustomer
                  ? "bg-white text-gray-800 shadow-md"
                  : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                {!isCustomer ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : (
                  <UserRound className="w-4 h-4" />
                )}
                ຮັບງານ
              </button>
            </div>

            {/* Subtitle */}
            <div className="text-center mb-2">
              <p className="text-sm text-rose-500">
                {isCustomer
                  ? t("login.title", { defaultValue: "ເຂົ້າສູ່ລະບົບ (ສໍາລັບຜູ້ໃຊ້ບໍລິການເທົ່ານັ້ນ)" })
                  : t("modelAuth.login.title")}
              </p>
            </div>

            {/* Success message */}
            {showSuccessMessage && (
              <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl">
                <p className="text-sm font-medium">{t("modelAuth.login.passwordResetSuccess")}</p>
                <p className="text-xs mt-1">{t("modelAuth.login.passwordResetSuccessMessage")}</p>
              </div>
            )}

            {/* Login Form */}
            <Form method="post" className="space-y-5">
              <input type="hidden" name="loginType" value={isCustomer ? "customer" : "model"} />
              {!isCustomer && redirectTo && redirectTo !== "/model" && (
                <input type="hidden" name="redirectTo" value={redirectTo} />
              )}

              {/* Phone number */}
              <div>
                <label
                  htmlFor="whatsapp"
                  className="block text-sm font-medium text-gray-600 mb-2"
                >
                  {t(isCustomer ? "login.phoneNumber" : "modelAuth.login.phoneNumber", {
                    defaultValue: "ເບີໂທລະສັບ",
                  })}
                  <span className={`ml-0.5 ${isCustomer ? "text-rose-500" : "text-rose-500"}`}>
                    *
                  </span>
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
                  autoComplete="tel"
                  className={`w-full px-4 py-3 rounded-md border-2 bg-white/60 transition-all duration-300 outline-none text-gray-900 placeholder-gray-300 ${isCustomer
                    ? "border-rose-100 focus:border-rose-400 focus:ring-4 focus:ring-rose-50"
                    : "border-gray-100 focus:border-gray-300 focus:ring-4 focus:ring-gray-50"
                    }`}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-600 mb-2"
                >
                  {t(isCustomer ? "login.password" : "modelAuth.login.password", {
                    defaultValue: "ລະຫັດຜ່ານ",
                  })}
                  <span className={`ml-0.5 ${isCustomer ? "text-rose-500" : "text-rose-500"}`}>
                    *
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`w-full px-4 py-3 rounded-md border-2 bg-white/60 transition-all duration-300 outline-none text-gray-900 placeholder-gray-300 pr-12 ${isCustomer
                      ? "border-rose-100 focus:border-rose-400 focus:ring-4 focus:ring-rose-50"
                      : "border-gray-100 focus:border-gray-300 focus:ring-4 focus:ring-gray-50"
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    className={`w-4 h-4 rounded-md border-gray-200 transition-colors ${isCustomer
                      ? "text-rose-500 focus:ring-rose-400"
                      : "text-gray-800 focus:ring-gray-400"
                      }`}
                  />
                  <span className="text-sm text-gray-400">
                    {t(isCustomer ? "login.rememberMe" : "modelAuth.login.rememberMe", {
                      defaultValue: "ຈື່ຈຳຂ້ອຍໄວ້",
                    })}
                  </span>
                </label>
                <Link
                  to={isCustomer ? "/forgot-password" : "/model-auth/forgot-password"}
                  className={`text-sm font-medium transition-colors ${isCustomer
                    ? "text-rose-400 hover:text-rose-500"
                    : "text-gray-400 hover:text-gray-600"
                    }`}
                >
                  {t(isCustomer ? "login.forgotPassword" : "modelAuth.login.forgotPassword", {
                    defaultValue: "ລືມລະຫັດຜ່ານ?",
                  })}
                </Link>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 rounded-lg font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isCustomer
                  ? "bg-rose-500 shadow-lg shadow-rose-200/50 hover:shadow-rose-300/60 hover:-translate-y-0.5 active:translate-y-0"
                  : "bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black shadow-lg shadow-gray-300/30 hover:shadow-gray-400/40 hover:-translate-y-0.5 active:translate-y-0"
                  }`}
              >
                {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
                {isSubmitting
                  ? t(isCustomer ? "login.loggingIn" : "modelAuth.login.signingIn", {
                    defaultValue: "ກຳລັງເຂົ້າສູ່ລະບົບ...",
                  })
                  : t(isCustomer ? "login.loginButton" : "modelAuth.login.signIn", {
                    defaultValue: "ເຂົ້າສູ່ລະບົບ",
                  })}
              </button>
            </Form>

            {/* Divider */}
            <div className="my-6">
              <div className="w-full border-t border-gray-100" />
            </div>

            {/* Register link */}
            <div className="text-center">
              <span className="text-sm text-gray-400">
                {t(isCustomer ? "login.noAccount" : "modelAuth.login.noAccount", {
                  defaultValue: "ຖ້າຍັງບໍ່ມີບັນຊີ?",
                })}
              </span>{" "}
              <Link
                to={
                  isCustomer
                    ? "/register"
                    : redirectTo && redirectTo !== "/model"
                      ? `/model-auth/register?redirect=${encodeURIComponent(redirectTo)}`
                      : "/model-auth/register"
                }
                className={`text-sm font-bold transition-colors ${isCustomer
                  ? "text-rose-500 hover:text-rose-600"
                  : "text-gray-800 hover:text-gray-600 underline underline-offset-2"
                  }`}
              >
                {t(isCustomer ? "login.createAccount" : "modelAuth.login.createAccount", {
                  defaultValue: "ສ້າງບັນຊີໃໝ່",
                })}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
