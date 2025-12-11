import { useState, useEffect } from "react";
import { Trash2, ShieldAlert, Eye, EyeOff, Loader } from "lucide-react";
import { Form, useNavigation, useSearchParams, redirect } from "react-router";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components:
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

// services:
import { deleteModelAccount } from "~/services/model.server";
import { requireModelSession } from "~/services/model-auth.server";
import { destroyModelSession } from "~/services/model-auth.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Delete Account - Model Settings" },
    { name: "description", content: "Permanently delete your account" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireModelSession(request);
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();

  const reason = formData.get("reason") as string;
  const password = formData.get("password") as string;
  const confirmText = formData.get("confirmText") as string;

  // Validation
  if (!confirmText || !password) {
    return redirect(
      `/model/settings/delete-account?error=${encodeURIComponent("modelDeleteAccount.errors.allFieldsRequired")}`
    );
  }

  if (confirmText !== "DELETE") {
    return redirect(
      `/model/settings/delete-account?error=${encodeURIComponent("modelDeleteAccount.errors.confirmTextMismatch")}`
    );
  }

  try {
    const result = await deleteModelAccount(modelId, password, reason || undefined);

    if (result?.success) {
      await destroyModelSession(request);

      return redirect(
        `/model/login?message=${encodeURIComponent("modelDeleteAccount.success.deleted")}`
      );
    } else {
      return redirect(
        `/model/settings/delete-account?error=${encodeURIComponent("modelDeleteAccount.errors.deleteFailed")}`
      );
    }
  } catch (error: any) {
    return redirect(
      `/model/settings/delete-account?error=${encodeURIComponent(error.message || "modelDeleteAccount.errors.deleteFailed")}`
    );
  }
}

export default function DeleteAccountSettings() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const errorMessage = searchParams.get("error");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (errorMessage) {
      const timeout = setTimeout(() => {
        searchParams.delete("error");
        setSearchParams(searchParams, { replace: true });
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [errorMessage, searchParams, setSearchParams]);

  return (
    <div className="p-2 sm:p-4 lg:p-0 space-y-4">
      <div className="mb-6 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <Trash2 className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h1 className="text-md">
              {t("modelDeleteAccount.title")}
            </h1>
            <p className="text-sm text-gray-600">{t("modelDeleteAccount.subtitle")}</p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{t(errorMessage)}</p>
        </div>
      )}

      <div className="bg-white rounded-sm p-3 sm:p-6 border">
        <Form method="post" className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="confirmText">
              {t("modelDeleteAccount.confirmLabel")} <span className="font-bold text-red-600">DELETE</span> {t("modelDeleteAccount.toConfirm")}{" "}
              <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="confirmText"
              name="confirmText"
              type="text"
              placeholder={t("modelDeleteAccount.confirmPlaceholder")}
              required
              disabled={isSubmitting}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {t("modelDeleteAccount.passwordLabel")}{" "}
              <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("modelDeleteAccount.passwordPlaceholder")}
                required
                disabled={isSubmitting}
                className="text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <Eye className="w-4 h-4 cursor-pointer" />
                ) : (
                  <EyeOff className="w-4 h-4 cursor-pointer" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              {t("modelDeleteAccount.reasonLabel")}
            </Label>
            <Textarea
              id="reason"
              name="reason"
              rows={3}
              placeholder={t("modelDeleteAccount.reasonPlaceholder")}
              disabled={isSubmitting}
              className="resize-none text-sm"
            />
          </div>

          <div className="w-full flex justify-end sm:justify-start">
            <Button
              type="submit"
              className="w-auto bg-red-600 text-white hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader size={18} className="animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {isSubmitting ? t("modelDeleteAccount.deleting") : t("modelDeleteAccount.deleteButton")}
            </Button>
          </div>
        </Form>
      </div>

      <div className="bg-red-50 border border-red-300 rounded-sm p-4 mb-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-700 mb-2 text-md">
              {t("modelDeleteAccount.warning.title")}
            </h3>
            <p className="text-red-700 text-sm mb-3">
              {t("modelDeleteAccount.warning.description")}
            </p>
            <ul className="space-y-1 text-red-700 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>{t("modelDeleteAccount.warning.item1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>{t("modelDeleteAccount.warning.item2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>{t("modelDeleteAccount.warning.item3")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>{t("modelDeleteAccount.warning.item4")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>{t("modelDeleteAccount.warning.item5")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>{t("modelDeleteAccount.warning.item6")}</span>
              </li>
            </ul>
            <p className="text-red-700 text-sm font-bold mt-3 bg-red-100 p-2 rounded">
              {t("modelDeleteAccount.warning.finalWarning")}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
