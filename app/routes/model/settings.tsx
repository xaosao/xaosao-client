import {
  Lock,
  LogOut,
  Trash2,
  Wallet,
  Settings,
  Briefcase,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Bell
} from "lucide-react";
import { useEffect } from "react";
import type { MetaFunction } from "react-router";
import { Separator } from "~/components/ui/separator";
import { useNavigate, useLocation, Outlet, Form } from "react-router";
import { useTranslation } from "react-i18next";

export const meta: MetaFunction = () => {
  return [
    { title: "Settings - Model Dashboard" },
    { name: "description", content: "Manage your model account settings" },
  ];
};

export default function ModelSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: "services", label: t("modelSettings.tabs.services"), icon: Briefcase, path: "/model/settings/services", description: t("modelSettings.tabs.servicesDesc") },
    { id: "wallet", label: t("modelSettings.tabs.wallet"), icon: Wallet, path: "/model/settings/wallet", description: t("modelSettings.tabs.walletDesc") },
    { id: "notifications", label: t("modelSettings.tabs.notifications", { defaultValue: "Notifications" }), icon: Bell, path: "/model/settings/notifications", description: t("modelSettings.tabs.notificationsDesc", { defaultValue: "Manage your notification preferences" }) },
    { id: "password", label: t("modelSettings.tabs.password"), icon: Lock, path: "/model/settings/password", description: t("modelSettings.tabs.passwordDesc") },
    { id: "report", label: t("modelSettings.tabs.report"), icon: AlertCircle, path: "/model/settings/report", description: t("modelSettings.tabs.reportDesc") },
    { id: "delete", label: t("modelSettings.tabs.delete"), icon: Trash2, path: "/model/settings/delete-account", description: t("modelSettings.tabs.deleteDesc") },
  ];

  // Redirect to first tab if on settings index (only on desktop)
  useEffect(() => {
    if (location.pathname === "/model/settings") {
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      if (isDesktop) {
        navigate("/model/settings/services", { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  const currentPath = location.pathname;
  const isChildRouteActive = currentPath !== "/model/settings" && currentPath.startsWith("/model/settings/");

  return (
    <div className="min-h-screen py-4 sm:py-6 px-4 sm:px-8">

      {!isChildRouteActive && (
        <>
          <div className="px-0 sm:px-8">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="p-2 bg-rose-100 rounded-lg"
                onClick={() => navigate("/model/settings")}
              >
                <Settings className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <h1 className="text-md font-bold">
                  {t("modelSettings.title")}
                </h1>
                <p className="text-gray-600 text-sm">{t("modelSettings.subtitle")}</p>
              </div>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Mobile: Show menu list only when on settings index, otherwise show child content */}
      <div className="block lg:hidden px-0 sm:px-8">
        {!isChildRouteActive ? (
          <div className="bg-white rounded-xl overflow-hidden">
            {tabs.map((tab, index) => {
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`cursor-pointer w-full flex items-center justify-between p-4 hover:bg-rose-50 transition-colors ${index !== tabs.length - 1 ? "border-b border-gray-100" : ""
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <h3 className="font-medium text-gray-900">{tab.label}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tab.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              );
            })}

            {/* Logout button - Mobile only */}
            <Form method="post" action="/model-logout" className="border-t border-gray-100">
              <button
                type="submit"
                className="cursor-pointer w-full flex items-center justify-between p-4 hover:bg-rose-50 transition-colors text-rose-600"
              >
                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <h3 className="font-medium">{t("settings.common.logout")}</h3>
                    <p className="text-xs text-rose-400 mt-0.5">
                      {t("modelSettings.tabs.logoutDesc")}
                    </p>
                  </div>
                </div>
                <LogOut className="w-4 h-4" />
              </button>
            </Form>
          </div>
        ) : (
          <div className="py-0 sm:py-4">
            <button
              onClick={() => navigate("/model/settings")}
              className="flex items-center gap-2 text-gray-600 hover:text-rose-500 mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">{t("modelSettings.backToSettings")}</span>
            </button>
            <Outlet />
          </div>
        )}
      </div>

      <div className="hidden lg:block px-0 sm:px-8">
        <div className="bg-white rounded-xl overflow-hidden px-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentPath === tab.path;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`cursor-pointer flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors ${isActive
                    ? tab.id === "delete"
                      ? "border-b-2 border-red-500 text-red-600 bg-red-50"
                      : "border-b-2 border-rose-500 text-rose-600"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm hidden xl:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="py-6 min-h-[500px]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}