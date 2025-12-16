import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Form, Link, Outlet, useLocation, useNavigate, type LoaderFunction } from "react-router";
import {
    HandHeart,
    Heart,
    LogOut,
    MessageCircle,
    Search,
    Settings,
    User,
    User2Icon,
} from "lucide-react";
import { SidebarSeparator } from "~/components/ui/sidebar";
import { NotificationBell } from "~/components/notifications/NotificationBell";

// services
import { capitalize } from "~/utils/functions/textFormat";
import type { Notification } from "~/hooks/useNotifications";
import { getModelDashboardData } from "~/services/model.server";
import { requireModelSession } from "~/services/model-auth.server";
import { getModelUnreadCount, getModelNotifications } from "~/services/notification.server";

interface ModelData {
    id: string;
    firstName: string;
    lastName?: string;
    profile: string;
    available_status: string;
    rating: number;
    total_review: number;
    Wallet: Array<{ totalBalance: number }>;
}

interface LoaderReturn {
    modelData: ModelData;
    unreadNotifications: number;
    initialNotifications: Notification[];
}

interface LayoutProps {
    loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
    const modelId = await requireModelSession(request);
    const [modelData, unreadNotifications, notifications] = await Promise.all([
        getModelDashboardData(modelId),
        getModelUnreadCount(modelId),
        getModelNotifications(modelId, { limit: 10 }),
    ]);

    const initialNotifications: Notification[] = notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data as Record<string, any>,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
    }));

    return { modelData, unreadNotifications, initialNotifications };
}

export default function ModelLayout({ loaderData }: LayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { modelData, unreadNotifications, initialNotifications } = loaderData;
    const { t, i18n } = useTranslation();

    const navigationItems = useMemo(() => [
        { title: t('navigation.discover'), url: "/model", icon: Search },
        { title: t('navigation.match'), url: "/model/matches", icon: Heart },
        { title: t('navigation.chat'), url: "/model/realtime-chat", icon: MessageCircle },
        { title: t('navigation.datingHistory'), url: "/model/dating", icon: HandHeart },
        { title: t('navigation.myProfile'), url: "/model/profile", icon: User },
        { title: t('navigation.setting'), url: "/model/settings", icon: Settings },
    ], [t, i18n.language]);

    const mobileNavigationItems = useMemo(() => [
        { title: t('navigation.discover'), url: "/model", icon: Search },
        { title: t('navigation.match'), url: "/model/matches", icon: Heart },
        { title: t('navigation.chat'), url: "/model/realtime-chat", icon: MessageCircle },
        { title: t('navigation.dating'), url: "/model/dating", icon: HandHeart },
        { title: t('navigation.profile'), url: "/model/profile", icon: User2Icon },
    ], [t, i18n.language]);

    const isActiveRoute = (url: string) => {
        if (url === "/model" && location.pathname === "/model") return true;
        if (url !== "/model" && location.pathname.startsWith(url)) return true;
        return false;
    };

    // 👇 Hide bottom nav if the current route includes "realtime-chat"
    const hideMobileNav =
        location.pathname.includes("realtime-chat") ||
        location.pathname.includes("chat");

    // 👇 Show mobile header only on main navigation routes (hide on chat and profile pages)
    const showMobileHeader = !hideMobileNav && !location.pathname.startsWith("/model/profile") && mobileNavigationItems.some(item => {
        if (item.url === "/model" && location.pathname === "/model") return true;
        if (item.url !== "/model" && location.pathname.startsWith(item.url)) return true;
        return false;
    });

    return (
        <div className="flex min-h-screen w-full relative">
            <div className="w-1/5 p-6 hidden sm:flex flex-col items-start justify-between sm:sticky sm:top-0 sm:h-screen">
                <div className="w-full">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="relative">
                                <div className="w-14 h-14 border-[2px] border-rose-500 rounded-full flex items-center justify-center hover:border-rose-600">
                                    <img
                                        src={modelData.profile}
                                        alt="Profile"
                                        className="w-full h-full rounded-full object-cover cursor-pointer"
                                    />
                                </div>
                                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                            </div>
                            <div>
                                <h2 className="text-lg">{modelData.firstName} {modelData?.lastName}</h2>
                                <p className="text-xs text-muted-foreground">
                                    Connect with customers
                                </p>
                            </div>
                        </div>
                        <NotificationBell userType="model" initialCount={unreadNotifications} initialNotifications={initialNotifications} />
                    </div>

                    <SidebarSeparator className="my-4" />

                    <div className="space-y-2">
                        {navigationItems.map((item) => {
                            const isActive = isActiveRoute(item.url);
                            return (
                                <Link
                                    to={item.url}
                                    key={item.title}
                                    prefetch="intent"
                                    className={`flex items-center justify-start cursor-pointer space-x-3 p-2 rounded-md transition-colors ${isActive
                                        ? "bg-rose-100 text-rose-500 border border-rose-300"
                                        : "hover:bg-rose-50 hover:text-rose-500"
                                        }`}
                                >
                                    <item.icon className="w-4 h-4" />
                                    <p suppressHydrationWarning>{item.title}</p>
                                </Link>
                            );
                        })}
                    </div>
                    <Form method="post" action="/model-logout">
                        <button
                            type="submit"
                            className="flex items-center justify-center cursor-pointer space-x-3 p-2 rounded-md transition-colors bg-rose-50 text-rose-500 mt-8 hover:border hover:border-rose-500 w-full"
                        >
                            <p suppressHydrationWarning>{t('settings.common.logout')}</p>
                            <LogOut className="w-4 h-4" />
                        </button>
                    </Form>
                </div>
            </div>

            <div className="w-full sm:w-4/5 flex flex-col min-h-screen">
                {showMobileHeader && (
                    <div className="sm:hidden flex items-center justify-between px-4 py-2 border-b bg-white sticky top-0 z-30">
                        <Link to="/model/profile"
                            prefetch="intent"
                            className="flex items-center gap-2"
                        >
                            <div className="relative">
                                <img
                                    src={modelData.profile}
                                    alt="Profile"
                                    className="w-10 h-10 rounded-full object-cover border border-rose-300"
                                />
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                            </div>
                            <div className="flex items-start justify-center flex-col">
                                <span className="text-sm font-medium uppercase">{modelData.firstName} {modelData.lastName}</span>
                                <span className="text-xs text-gray-500">{capitalize(modelData.available_status)}</span>
                            </div>
                        </Link>
                        <div className="flex items-center justify-center gap-4">
                            <NotificationBell userType="model" initialCount={unreadNotifications} initialNotifications={initialNotifications} />
                            <Settings size={18} className="text-gray-500" onClick={() => navigate("/model/settings")} />
                        </div>
                    </div>
                )}
                <main className="bg-background flex-1">
                    <Outlet />
                </main>
            </div>

            {/* ✅ Mobile Bottom Navigation (hidden on realtime-chat) */}
            {!hideMobileNav && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 sm:hidden z-40">
                    <div className="flex items-center justify-around py-1">
                        {mobileNavigationItems.map((item) => {
                            const isActive = isActiveRoute(item.url);
                            return (
                                <Link
                                    to={item.url}
                                    key={item.title}
                                    prefetch="viewport"
                                    className="flex flex-col items-center justify-center p-2 min-w-0 flex-1"
                                >
                                    <item.icon
                                        className={`w-4 h-4 mb-1 ${isActive ? "text-rose-500" : "text-gray-600"
                                            }`}
                                    />
                                    <span
                                        className={`text-xs truncate ${isActive ? "text-rose-500" : "text-gray-600"
                                            }`}
                                        suppressHydrationWarning
                                    >
                                        {item.title}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
