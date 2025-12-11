import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, Shield, Loader } from "lucide-react";
import { Form, useNavigation, useSearchParams, redirect } from "react-router";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components:
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";

// service:
import { updateModelPassword } from "~/services/model.server";
import { requireModelSession } from "~/services/model-auth.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Password Change - Model Settings" },
    { name: "description", content: "Update your account password" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireModelSession(request);
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    return redirect(
      `/model/settings/password?error=${encodeURIComponent("modelPassword.errors.allFieldsRequired")}`
    );
  }

  if (newPassword !== confirmPassword) {
    return redirect(
      `/model/settings/password?error=${encodeURIComponent("modelPassword.errors.passwordsDoNotMatch")}`
    );
  }

  if (newPassword.length < 8) {
    return redirect(
      `/model/settings/password?error=${encodeURIComponent("modelPassword.errors.passwordTooShort")}`
    );
  }

  try {
    const result = await updateModelPassword(modelId, currentPassword, newPassword);

    if (result?.success) {
      return redirect(
        `/model/settings/password?success=${encodeURIComponent("modelPassword.success.updated")}`
      );
    } else {
      return redirect(
        `/model/settings/password?error=${encodeURIComponent("modelPassword.errors.updateFailed")}`
      );
    }
  } catch (error: any) {
    return redirect(
      `/model/settings/password?error=${encodeURIComponent(error.message || "modelPassword.errors.updateFailed")}`
    );
  }
}

// Password strength checker
const checkPasswordStrength = (password: string): { strength: 'weak' | 'medium' | 'strong'; score: number } => {
  let score = 0;

  if (!password) return { strength: 'weak', score: 0 };

  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 10) score += 1;
  if (password.length >= 12) score += 1;

  if (/[a-z]/.test(password)) score += 1; // lowercase
  if (/[A-Z]/.test(password)) score += 1; // uppercase
  if (/[0-9]/.test(password)) score += 1; // numbers
  if (/[^a-zA-Z0-9]/.test(password)) score += 1; // special characters

  // Determine strength
  if (score <= 3) return { strength: 'weak', score };
  if (score <= 5) return { strength: 'medium', score };
  return { strength: 'strong', score };
};

export default function PasswordSettings() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState<{ strength: 'weak' | 'medium' | 'strong'; score: number }>({ strength: 'weak', score: 0 });

  const successMessage = searchParams.get("success");
  const errorMessage = searchParams.get("error");

  // Check password strength when new password changes
  useEffect(() => {
    const result = checkPasswordStrength(newPassword);
    setPasswordStrength(result);
  }, [newPassword]);

  // Clear password fields on success and clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      const timeout = setTimeout(() => {
        searchParams.delete("success");
        setSearchParams(searchParams, { replace: true });
      }, 5000);
      return () => clearTimeout(timeout);
    }

    if (errorMessage) {
      const timeout = setTimeout(() => {
        searchParams.delete("error");
        setSearchParams(searchParams, { replace: true });
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage, errorMessage, searchParams, setSearchParams]);

  return (
    <div className="p-2 sm:p-4 lg:p-0 space-y-4">
      <div className="mb-6 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <Lock className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <h1 className="text-md">
              {t("modelPassword.title")}
            </h1>
            <p className="text-sm text-gray-600">{t("modelPassword.subtitle")}</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">{t(successMessage)}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{t(errorMessage)}</p>
        </div>
      )}

      <div className="bg-white rounded-sm p-4 sm:p-6 border">
        <Form method="post" className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">
              {t("modelPassword.currentPassword")} <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                name="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                placeholder={t("modelPassword.enterCurrentPassword")}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="text-sm"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? (
                  <Eye className="w-4 h-4 cursor-pointer" />
                ) : (
                  <EyeOff className="w-4 h-4 cursor-pointer" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">
              {t("modelPassword.newPassword")} <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder={t("modelPassword.enterNewPassword")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                disabled={isSubmitting}
                className="text-sm"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? (
                  <Eye className="w-4 h-4 cursor-pointer" />
                ) : (
                  <EyeOff className="w-4 h-4 cursor-pointer" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {t("modelPassword.confirmPassword")} <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder={t("modelPassword.confirmNewPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={isSubmitting}
                className="text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <Eye className="w-4 h-4 cursor-pointer" />
                ) : (
                  <EyeOff className="w-4 h-4 cursor-pointer" />
                )}
              </button>
            </div>
          </div>

          {newPassword && (
            <div className="space-y-2">
              <div className="flex gap-1">
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${passwordStrength.score >= 1
                  ? passwordStrength.strength === 'weak' ? 'bg-red-500'
                    : passwordStrength.strength === 'medium' ? 'bg-yellow-500'
                      : 'bg-green-500'
                  : 'bg-gray-200'
                  }`}></div>
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${passwordStrength.score >= 3
                  ? passwordStrength.strength === 'medium' ? 'bg-yellow-500'
                    : passwordStrength.strength === 'strong' ? 'bg-green-500'
                      : 'bg-gray-200'
                  : 'bg-gray-200'
                  }`}></div>
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${passwordStrength.score >= 6 ? 'bg-green-500' : 'bg-gray-200'
                  }`}></div>
              </div>
              <p className={`text-xs font-medium ${passwordStrength.strength === 'weak' ? 'text-red-600'
                : passwordStrength.strength === 'medium' ? 'text-yellow-600'
                  : 'text-green-600'
                }`}>
                {t("modelPassword.passwordStrength")}: {passwordStrength.strength === 'weak' ? t("modelPassword.strength.weak")
                  : passwordStrength.strength === 'medium' ? t("modelPassword.strength.medium")
                    : t("modelPassword.strength.strong")}
              </p>
            </div>
          )}

          <div className="w-full flex justify-end sm:justify-start">
            <Button
              type="submit"
              className="w-auto bg-rose-500 text-white hover:bg-rose-600"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader size={18} className="animate-spin" /> : null}
              {isSubmitting ? t("modelPassword.updating") : t("modelPassword.updatePassword")}
            </Button>
          </div>
        </Form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 mb-6">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-md text-blue-700 font-medium mb-1">{t("modelPassword.securityTips.title")}</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• {t("modelPassword.securityTips.tip1")}</li>
              <li>• {t("modelPassword.securityTips.tip2")}</li>
              <li>• {t("modelPassword.securityTips.tip3")}</li>
              <li>• {t("modelPassword.securityTips.tip4")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
