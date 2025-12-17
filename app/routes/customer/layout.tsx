import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SidebarSeparator } from "~/components/ui/sidebar";
import { Link, Outlet, useLocation, useNavigate, type LoaderFunction } from "react-router";
import {
    HandHeart,
    Heart,
    Search,
    Settings,
    User,
    Wallet,
    Wallet2,
} from "lucide-react";
import type { Notification } from "~/hooks/useNotifications";
import { requireUserSession } from "~/services/auths.server";
import type { ICustomerResponse } from "~/interfaces/customer";
import { getCustomerProfile } from "~/services/profile.server";
import { NotificationBell } from "~/components/notifications/NotificationBell";
import { getCustomerUnreadCount, getCustomerNotifications } from "~/services/notification.server";

interface LoaderReturn {
    customerData: ICustomerResponse;
    unreadNotifications: number;
    initialNotifications: Notification[];
    hasActiveSubscription: boolean;
}

interface TransactionProps {
    loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
    const customerId = await requireUserSession(request);
    const { hasActiveSubscription } = await import("~/services/package.server");

    const [customerData, unreadNotifications, notifications, hasSubscription] = await Promise.all([
        getCustomerProfile(customerId),
        getCustomerUnreadCount(customerId),
        getCustomerNotifications(customerId, { limit: 10 }),
        hasActiveSubscription(customerId),
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

    return { customerData, unreadNotifications, initialNotifications, hasActiveSubscription: hasSubscription };
}

export default function Dashboard({ loaderData }: TransactionProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { customerData, unreadNotifications, initialNotifications, hasActiveSubscription } = loaderData;
    const { t, i18n } = useTranslation();

    // Handler for chat navigation with subscription check
    const handleChatNavigation = (e: React.MouseEvent, url: string) => {
        if (url.includes("realtime-chat") || url.includes("chat")) {
            if (!hasActiveSubscription) {
                e.preventDefault();
                navigate("/customer/packages?toastMessage=Please+subscribe+to+a+package+to+chat+with+models&toastType=warning");
            }
        }
    };

    const navigationItems = useMemo(() => [
        { title: t('navigation.discover'), url: "/customer", icon: Search },
        { title: t('navigation.match'), url: "/customer/matches", icon: Heart },
        // { title: t('navigation.chat'), url: "/customer/realtime-chat", icon: MessageCircle },
        { title: t('navigation.datingHistory'), url: "/customer/dates-history", icon: HandHeart },
        { title: t('navigation.wallet'), url: "/customer/wallets", icon: Wallet },
        { title: t('navigation.myProfile'), url: "/customer/profile", icon: User },
        { title: t('navigation.setting'), url: "/customer/setting", icon: Settings },
    ], [t, i18n.language]);

    const mobileNavigationItems = useMemo(() => [
        { title: t('navigation.discover'), url: "/customer", icon: Search },
        { title: t('navigation.match'), url: "/customer/matches", icon: Heart },
        // { title: t('navigation.chat'), url: "/customer/realtime-chat", icon: MessageCircle },
        { title: t('navigation.dating'), url: "/customer/dates-history", icon: HandHeart },
        { title: t('navigation.wallet'), url: "/customer/wallets", icon: Wallet2 },
        { title: t('navigation.setting'), url: "/customer/setting", icon: Settings },
    ], [t, i18n.language]);

    const isActiveRoute = (url: string) => {
        if (url === "/customer" && location.pathname === "/customer") return true;
        if (url !== "/customer" && location.pathname.startsWith(url)) return true;
        return false;
    };

    // 👇 Hide bottom nav if the current route includes "realtime-chat"
    const hideMobileNav =
        location.pathname.includes("realtime-chat") ||
        location.pathname.includes("chat");

    // 👇 Show mobile header only on main navigation routes (hide on realtime-chat)
    const showMobileHeader = !hideMobileNav && mobileNavigationItems.some(item => {
        if (item.url === "/customer" && location.pathname === "/customer") return true;
        if (item.url !== "/customer" && location.pathname.startsWith(item.url)) return true;
        return false;
    });


    return (
        <div className="flex min-h-screen w-full relative">
            <div className="w-1/5 p-6 hidden sm:flex flex-col items-start justify-between sm:sticky sm:top-0 sm:h-screen">
                <div className="w-full">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="relative">
                                <div className="w-16 h-16 border-[2px] border-rose-500 rounded-full flex items-center justify-center hover:border-rose-600">
                                    <img
                                        src={customerData.profile}
                                        alt="Profile"
                                        className="w-full h-full rounded-full object-cover cursor-pointer"
                                    />
                                </div>
                                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                            </div>
                            <div>
                                <h2 className="text-lg">{customerData.firstName} {customerData?.lastName}</h2>
                                <p className="text-xs text-gray-500">
                                    Find your perfect match
                                </p>
                            </div>
                        </div>
                        <NotificationBell userType="customer" initialCount={unreadNotifications} initialNotifications={initialNotifications} />
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
                                    onClick={(e) => handleChatNavigation(e, item.url)}
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
                </div>
            </div>

            <div className="w-full sm:w-4/5 flex flex-col min-h-screen">
                {showMobileHeader && (
                    <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b bg-white sticky top-0 z-30">
                        <Link to="/customer/profile"
                            prefetch="intent"
                            className="flex items-center gap-2"
                        >
                            <div className="relative">
                                <img
                                    src={customerData.profile}
                                    alt="Profile"
                                    className="w-10 h-10 rounded-full object-cover border border-rose-300"
                                />
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                            </div>
                            <div className="flex items-start justify-center flex-col">
                                <span className="text-sm font-medium uppercase">{customerData.firstName} {customerData.lastName}</span>
                                <span className="text-xs text-gray-500">{customerData.bio}</span>
                            </div>
                        </Link>
                        <div className="flex items-center justify-center gap-4">
                            <NotificationBell userType="customer" initialCount={unreadNotifications} initialNotifications={initialNotifications} />
                            {/* <Settings size={18} className="text-gray-500" onClick={() => navigate("/customer/setting")} /> */}
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
                                    onClick={(e) => handleChatNavigation(e, item.url)}
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
