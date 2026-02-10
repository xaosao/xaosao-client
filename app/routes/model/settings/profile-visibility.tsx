import { useState } from "react";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Form, useNavigation, useSearchParams, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components:
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";

// service:
import { getModelOwnProfile, toggleProfileVisibility } from "~/services/model-profile.server";
import { requireModelSession } from "~/services/model-auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const model = await getModelOwnProfile(modelId);
  return { isProfileHidden: model.isProfileHidden ?? false };
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();
  const isHidden = formData.get("isHidden") === "true";

  try {
    await toggleProfileVisibility(modelId, isHidden);
    return redirect(
      `/model/settings/profile-visibility?success=${encodeURIComponent("Profile visibility updated successfully")}`
    );
  } catch (error: any) {
    return redirect(
      `/model/settings/profile-visibility?error=${encodeURIComponent(error.message || "Failed to update profile visibility")}`
    );
  }
}

export default function ProfileVisibilitySettings() {
  const { t } = useTranslation();
  const { isProfileHidden } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  const isSubmitting = navigation.state === "submitting";
  const error = searchParams.get("error");
  const success = searchParams.get("success");

  const [hidden, setHidden] = useState(isProfileHidden);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2 rounded-lg ${hidden ? "bg-amber-100" : "bg-rose-100"}`}>
          {hidden ? (
            <EyeOff className="w-5 h-5 text-amber-600" />
          ) : (
            <Eye className="w-5 h-5 text-rose-600" />
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("modelSettings.profileVisibility.title", { defaultValue: "Profile Visibility" })}
          </h2>
          <p className="text-sm text-gray-500">
            {t("modelSettings.profileVisibility.description", { defaultValue: "Control whether customers can see your profile" })}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <Form method="post" className="space-y-6">
        <input type="hidden" name="isHidden" value={hidden ? "true" : "false"} />

        <div className="bg-gray-50 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hidden ? "bg-amber-100" : "bg-green-100"}`}>
                {hidden ? (
                  <EyeOff className="w-5 h-5 text-amber-500" />
                ) : (
                  <Eye className="w-5 h-5 text-green-500" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {hidden
                    ? t("modelSettings.profileVisibility.hideProfile", { defaultValue: "Hide Profile" })
                    : t("modelSettings.profileVisibility.showProfile", { defaultValue: "Show Profile" })}
                </h3>
                <p className="text-sm text-gray-500">
                  {hidden
                    ? t("modelSettings.profileVisibility.hiddenStatus", { defaultValue: "Your profile is hidden from customers" })
                    : t("modelSettings.profileVisibility.visibleStatus", { defaultValue: "Your profile is visible to customers" })}
                </p>
              </div>
            </div>
            <Switch
              checked={hidden}
              onCheckedChange={(checked) => setHidden(checked)}
            />
          </div>
        </div>

        {hidden && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-amber-800">
                  {t("modelSettings.profileVisibility.hiddenWarningTitle", { defaultValue: "Profile Hidden" })}
                </h4>
                <p className="text-sm text-amber-700 mt-1">
                  {t("modelSettings.profileVisibility.hiddenWarningDesc", {
                    defaultValue: "While your profile is hidden, customers cannot find you in search, nearby, or any listings. You can still use the app normally."
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            className="bg-rose-500 hover:bg-rose-600 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("settings.common.saving", { defaultValue: "Saving..." }) : t("settings.common.save", { defaultValue: "Save Changes" })}
          </Button>
        </div>
      </Form>
    </div>
  );
}
