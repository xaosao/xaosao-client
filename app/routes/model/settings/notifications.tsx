import { useState, useCallback } from "react";
import { Bell, X, Check, Loader } from "lucide-react";
import { Form, useNavigation, useSearchParams, redirect, useLoaderData } from "react-router";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components:
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";

// hooks:
import { usePushNotifications } from "~/hooks/usePushNotifications";

// service:
import { getModelProfile, updateModelSetting } from "~/services/model-profile.server";
import { requireModelSession } from "~/services/model-auth.server";

type NotificationType = "push" | "sms";

export const meta: MetaFunction = () => {
  return [
    { title: "Notification Settings - Model Dashboard" },
    { name: "description", content: "Manage your notification preferences" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const model = await getModelProfile(modelId);
  return { model };
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();

  const notificationsPush = formData.get("notifications_push") === "true";
  const notificationsSms = formData.get("notifications_sms") === "true";
  const notificationsEmail = formData.get("notifications_email") === "true";

  try {
    await updateModelSetting(modelId, {
      notifications_push: notificationsPush,
      notifications_sms: notificationsSms,
      notifications_email: notificationsEmail,
    });

    return redirect(
      `/model/settings/notifications?success=${encodeURIComponent("Notification settings updated successfully")}`
    );
  } catch (error: any) {
    return redirect(
      `/model/settings/notifications?error=${encodeURIComponent(error.message || "Failed to update settings")}`
    );
  }
}

export default function ModelNotificationSettings() {
  const { t } = useTranslation();
  const { model } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  const isSubmitting = navigation.state === "submitting";
  const error = searchParams.get("error");
  const success = searchParams.get("success");

  const [notifications, setNotifications] = useState({
    push: model.sendPushNoti ?? true,
    sms: model.sendSMSNoti ?? true,
  });
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);

  // Push notifications hook
  const {
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
    permission: pushPermission,
    error: pushError,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications({ userType: "model" });

  const handleNotificationChange = useCallback((type: NotificationType) => {
    // For push notifications, show dialog if trying to enable and not subscribed
    if (type === "push") {
      if (!notifications.push && !isPushSubscribed) {
        // Trying to enable push - show the dialog first
        setShowPushDialog(true);
        setPushSuccess(false);
        return;
      } else if (notifications.push && isPushSubscribed) {
        // Trying to disable push - unsubscribe
        unsubscribePush();
      }
    }
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  }, [notifications.push, isPushSubscribed, unsubscribePush]);

  const handleEnablePush = useCallback(async () => {
    const success = await subscribePush();
    if (success) {
      setPushSuccess(true);
      // Update local state
      setNotifications(prev => ({
        ...prev,
        push: true,
      }));
      // Auto close after showing success
      setTimeout(() => {
        setShowPushDialog(false);
        setPushSuccess(false);
      }, 2000);
    }
  }, [subscribePush]);

  const handleDismissPushDialog = useCallback(() => {
    setShowPushDialog(false);
    setPushSuccess(false);
  }, []);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-rose-100 rounded-lg">
          <Bell className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("modelSettings.notifications.title", { defaultValue: "Notification Preferences" })}
          </h2>
          <p className="text-sm text-gray-500">
            {t("modelSettings.notifications.subtitle", { defaultValue: "Choose how you want to receive notifications" })}
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
        {/* Hidden inputs for form submission */}
        <input type="hidden" name="notifications_push" value={notifications.push ? "true" : "false"} />
        <input type="hidden" name="notifications_sms" value={notifications.sms ? "true" : "false"} />
        <input type="hidden" name="notifications_email" value={model.sendMailNoti ? "true" : "false"} />

        <div className="bg-gray-50 rounded-xl p-4 space-y-4">
          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {t("settings.notification.push", { defaultValue: "Push Notifications" })}
                </h3>
                <p className="text-sm text-gray-500">
                  {t("settings.notification.pushDesc", { defaultValue: "Receive notifications on your device" })}
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.push}
              onCheckedChange={() => handleNotificationChange("push")}
              disabled={isPushLoading}
            />
          </div>

          {/* SMS Notifications */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {t("settings.notification.sms", { defaultValue: "SMS Notifications" })}
                </h3>
                <p className="text-sm text-gray-500">
                  {t("settings.notification.smsDesc", { defaultValue: "Receive important alerts via SMS" })}
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.sms}
              onCheckedChange={() => handleNotificationChange("sms")}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            className="bg-rose-500 hover:bg-rose-600 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                {t("settings.common.saving", { defaultValue: "Saving..." })}
              </span>
            ) : (
              t("settings.common.save", { defaultValue: "Save Changes" })
            )}
          </Button>
        </div>
      </Form>

      {/* Push Notification Enable Dialog */}
      {showPushDialog && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="relative p-4 border-b">
              <button
                onClick={handleDismissPushDialog}
                className="absolute right-4 top-4 p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl shadow-md bg-rose-500 flex items-center justify-center">
                  {pushSuccess ? (
                    <Check className="w-8 h-8 text-white" />
                  ) : (
                    <Bell className="w-8 h-8 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {pushSuccess
                      ? t("push.enabled", { defaultValue: "Notifications Enabled!" })
                      : t("push.title", { defaultValue: "Stay Updated" })}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {pushSuccess
                      ? t("push.enabledDesc", { defaultValue: "You'll receive important updates" })
                      : t("push.subtitle", { defaultValue: "Enable push notifications" })}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {pushSuccess ? (
                <p className="text-sm text-gray-600 text-center">
                  {t("push.successMessage", {
                    defaultValue: "You'll now receive notifications for bookings, messages, and updates.",
                  })}
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    {t("push.description", {
                      defaultValue:
                        "Get notified about new bookings, messages, and important updates even when you're not using the app.",
                    })}
                  </p>

                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                        <Bell className="w-4 h-4 text-rose-500" />
                      </div>
                      <span>{t("push.benefitModel1", { defaultValue: "New booking requests" })}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                        <Bell className="w-4 h-4 text-rose-500" />
                      </div>
                      <span>{t("push.benefitMessages", { defaultValue: "New messages" })}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                        <Bell className="w-4 h-4 text-rose-500" />
                      </div>
                      <span>{t("push.benefitModel3", { defaultValue: "Payment notifications" })}</span>
                    </div>
                  </div>
                </>
              )}

              {pushError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{pushError}</p>
                </div>
              )}

              {pushPermission === "denied" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    {t("push.permissionDenied", {
                      defaultValue:
                        "Notifications are blocked. Please enable them in your browser settings.",
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t flex gap-3">
              {!pushSuccess && (
                <>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleDismissPushDialog}
                    disabled={isPushLoading}
                  >
                    {t("push.notNow", { defaultValue: "Not Now" })}
                  </Button>
                  <Button
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
                    onClick={handleEnablePush}
                    disabled={isPushLoading || pushPermission === "denied"}
                  >
                    {isPushLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t("push.enabling", { defaultValue: "Enabling..." })}
                      </span>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 mr-2" />
                        {t("push.enable", { defaultValue: "Enable Notifications" })}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* Safe area padding for iOS */}
            <div className="h-safe-area-inset-bottom" />
          </div>
        </div>
      )}
    </div>
  );
}
