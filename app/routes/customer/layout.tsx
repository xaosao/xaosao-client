import { useMemo, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SidebarSeparator } from "~/components/ui/sidebar";
import { Form, Link, Outlet, redirect, useLocation, useNavigate, useRevalidator, type LoaderFunction } from "react-router";
import {
    User,
    MessageCircle,
    Search,
    Wallet,
    UserSearch,
    Settings,
    HandHeart,
    LogOut,
    AlertTriangle,
    X,
} from "lucide-react";
import { useNotifications, type Notification } from "~/hooks/useNotifications";
import { requireVerifiedUserSession } from "~/services/auths.server";
import { getCustomerProfile } from "~/services/profile.server";
import type { ICustomerResponse } from "~/interfaces/customer";
import { NotificationBell } from "~/components/notifications/NotificationBell";
import { loadNotificationFeed } from "~/services/xs-notification.server";
import { PushNotificationPrompt } from "~/components/pwa/PushNotificationPrompt";
import { SubscriptionModal } from "~/components/subscription/SubscriptionModal";
import { useSubscriptionCheck } from "~/hooks/useSubscriptionCheck";
import { useSubscriptionSSE } from "~/hooks/useSubscriptionSSE";
import { useAutoLocation } from "~/hooks/useAutoLocation";
import { LocationPromptModal } from "~/components/location/LocationPromptModal";
import { useChatBadge } from "~/hooks/useChatBadge";
import { useBackendNotifications } from "~/hooks/useBackendNotifications";
import { HeaderSearch } from "~/components/discover/HeaderSearch";
import { useNavPending } from "~/hooks/useNavPending";
import { Loader2 } from "lucide-react";

interface LoaderReturn {
    customerData: ICustomerResponse;
    unreadNotifications: number;
    unreadMessages: number;
    initialNotifications: Notification[];
    hasActiveSubscription: boolean;
    hasPendingSubscription: boolean;
    hasEnabledNotifications: boolean;
    trialPackage: {
        id: string;
        price: number;
    } | null;
    customerBalance: number;
    awaitingSlipIntent: { id: string; amount: number } | null;
}

interface TransactionProps {
    loaderData: LoaderReturn;
}

// The layout loader fires 8 queries (profile, notifications, subscription
// state, wallet, trial plan, awaiting slip). By default it re-runs on
// EVERY child navigation, adding ~800 ms of DB work between every page
// change. Skip it unless something material could have changed:
//   - Explicit revalidation from useRevalidator (SSE notifications,
//     create-post modal, etc.) — URLs identical, must let through
//   - Any non-GET action in the tree (formMethod !== GET)
//   - Any action that returned a result (like/pass/create/etc.)
//   - Coming from a page that mutates layout-visible state (wallet
//     top-up, subscription checkout, notification settings, logout)
export function shouldRevalidate({
    currentUrl,
    nextUrl,
    formMethod,
    actionResult,
    defaultShouldRevalidate,
}: {
    currentUrl: URL;
    nextUrl: URL;
    formMethod?: string;
    actionResult?: any;
    defaultShouldRevalidate: boolean;
}): boolean {
    // Explicit useRevalidator().revalidate() — URLs are literally identical.
    // Must let this through: children rely on it to refresh notification
    // counts, wallet balance after actions, etc.
    if (currentUrl.toString() === nextUrl.toString()) return defaultShouldRevalidate;

    // Any non-GET form submission somewhere in the tree — assume state changed.
    if (formMethod && formMethod !== "GET") return defaultShouldRevalidate;
    if (actionResult) return defaultShouldRevalidate;

    // Pages that DO mutate what the layout shows.
    const mustRefreshFrom = [
        "/customer/wallet-topup",
        "/customer/wallets",
        "/customer/packages",
        "/customer/setting",
        "/logout",
    ];
    if (mustRefreshFrom.some((p) => currentUrl.pathname.startsWith(p))) {
        return defaultShouldRevalidate;
    }

    return false;
}

// Extracted from the loader so `withCache` can wrap it. Runs the 8-way
// parallel fetch that populates the customer top bar / notification bell /
// awaiting-slip banner / subscription modal state.
async function loadCustomerLayoutData(customerId: string) {
    const { hasActiveSubscription, hasPendingSubscription } = await import("~/services/package.server");
    const { prisma } = await import("~/services/database.server");
    const { getAwaitingSlipIntent } = await import("~/services/wallet.server");
    const { getChatUnreadCount } = await import("~/services/xs-chat.server");

    const [customerData, notificationFeed, hasSubscription, hasPending, trialPackage, wallet, awaitingSlipIntent, unreadMessages] = await Promise.all([
        getCustomerProfile(customerId),
        // Notifications now come from the xs_backend API so the web bell
        // matches the app exactly; `loadNotificationFeed` falls back to the
        // local Prisma read if the backend is unreachable.
        loadNotificationFeed(customerId, "customer"),
        hasActiveSubscription(customerId).catch(() => false),
        hasPendingSubscription(customerId).catch(() => false),
        prisma.subscription_plan.findFirst({
            where: { name: "24-Hour Trial", status: "active" },
            select: { id: true, price: true },
        }).catch(() => null),
        prisma.wallet.findFirst({
            where: { customerId },
            select: { totalBalance: true, totalSpend: true, totalRefunded: true },
        }).catch(() => null),
        getAwaitingSlipIntent(customerId).catch(() => null),
        getChatUnreadCount({ userId: customerId, userType: "customer" }),
    ]);

    // Same trap as the model layout: the profile lookup returns null when the
    // session points at a customer that no longer exists, and the component
    // reads `customerData.profile` directly. Fail as an invalid session here,
    // BEFORE the value reaches the 30 s cache.
    if (!customerData) {
        throw new Error(`No customer record for session id ${customerId}`);
    }

    const { unreadNotifications, initialNotifications } = notificationFeed;

    const hasEnabledNotifications = customerData?.sendPushNoti || customerData?.sendSMSNoti || false;
    const availableBalance = (wallet?.totalBalance || 0) - (wallet?.totalSpend || 0) + (wallet?.totalRefunded || 0);

    return {
        customerData,
        unreadNotifications,
        unreadMessages,
        initialNotifications,
        hasActiveSubscription: hasSubscription,
        hasPendingSubscription: hasPending,
        hasEnabledNotifications,
        trialPackage,
        customerBalance: availableBalance,
        awaitingSlipIntent: awaitingSlipIntent
            ? { id: awaitingSlipIntent.id, amount: awaitingSlipIntent.amount }
            : null,
    };
}

export const loader: LoaderFunction = async ({ request }) => {
    const customerId = await requireVerifiedUserSession(request);

    try {
        const { withCache } = await import("~/services/cache.server");

        // Wrap the entire fan-out in the 30 s cache. Post-login and rapid
        // page-hopping now hit memory instead of paying 8 parallel queries
        // every time. Cache key includes customerId so existing
        // `cacheInvalidateContaining(customerId)` calls in like/pass/etc
        // ALSO invalidate this — no per-action wiring needed.
        return await withCache(
            `customerLayout:${customerId}`,
            30_000,
            () => loadCustomerLayoutData(customerId),
        );
    } catch (error) {
        // `redirect()` throws a Response — control flow, not a failure.
        if (error instanceof Response) throw error;
        console.error("[CustomerLayout] Loader error:", error);
        // If the critical profile query fails, redirect to login rather than showing error page
        const url = new URL(request.url);
        const redirectTo = encodeURIComponent(url.pathname + url.search);
        throw redirect(`/model-auth/login?tab=customer&redirect=${redirectTo}`);
    }
}

export default function Dashboard({ loaderData }: TransactionProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const revalidator = useRevalidator();
    const { customerData, unreadNotifications, unreadMessages, initialNotifications, hasActiveSubscription, hasPendingSubscription, hasEnabledNotifications, trialPackage, customerBalance, awaitingSlipIntent } = loaderData;
    const { t, i18n } = useTranslation();

    // Live unread-message count for the Chat nav badge. Seeded from the
    // loader, kept current by the shared chat socket between revalidations.
    const liveUnreadMessages = useChatBadge("customer", unreadMessages);

    // Notifications created by xs_backend arrive over the chat socket. The
    // website's own SSE stream can't carry them — it's fed by an in-process
    // emitter that only this app's writes reach.
    useBackendNotifications({ userType: "customer", playSound: true });

    // Lets each nav item show a spinner while its own route is loading.
    const isNavPending = useNavPending();

    // Awaiting-slip banner — shown once per intent, dismissed until next login
    const [showSlipBanner, setShowSlipBanner] = useState(false);
    useEffect(() => {
        if (!awaitingSlipIntent) return;
        let dismissed = false;
        try { dismissed = !!sessionStorage.getItem(`slip_banner_dismissed_${awaitingSlipIntent.id}`); } catch {}
        if (!dismissed) setShowSlipBanner(true);
    }, [awaitingSlipIntent?.id]);

    const dismissSlipBanner = () => {
        if (awaitingSlipIntent) {
            try { sessionStorage.setItem(`slip_banner_dismissed_${awaitingSlipIntent.id}`, '1'); } catch {}
        }
        setShowSlipBanner(false);
    };

    // Notification types that should trigger data refresh
    const revalidateNotificationTypes = [
        "new_post_match",
        "post_interest",
        "post_comment",
        "post_comment_reply",
        "booking_confirmed",
        "booking_rejected",
        "booking_completed",
    ];

    // Handle new notifications - refresh child routes when post/booking-related
    const handleNewNotification = useCallback((notification: Notification) => {
        if (revalidateNotificationTypes.includes(notification.type)) {
            console.log("[CustomerLayout] Revalidating for notification:", notification.type);
            revalidator.revalidate();
        }
    }, [revalidator]);

    // Connect to real-time notifications for data revalidation
    useNotifications({
        userType: "customer",
        onNewNotification: handleNewNotification,
        playSound: false, // Sound handled by NotificationBell
    });

    // Only show modal on mount when on dashboard page
    const isDashboardPage = location.pathname === "/customer";

    // Search is a Discover feature, so the header icon only appears there.
    // (Discover is the index route; its tabs live in ?tab=, not the path.)
    const isDiscoverPage = location.pathname === "/customer";
    console.log("[ModalSequence] State:", { isDashboardPage, hasEnabledNotifications, hasActiveSubscription, hasPendingSubscription });

    // === Modal sequencing: Location → Push Notification (Android) → Subscription ===
    const [showLocationPrompt, setShowLocationPrompt] = useState(false);
    const [locationStepDone, setLocationStepDone] = useState(false);
    const [pushStepDone, setPushStepDone] = useState(false);

    // Auto-location tracking - updates server silently when location is available
    const { requestLocation, hasLocation, permissionState } = useAutoLocation({
        userType: "customer",
        enabled: true,
        onNeedPermission: useCallback(() => {
            // Only show prompt on dashboard page, not on every navigation
            if (isDashboardPage) {
                let dismissed: string | null = null;
                try { dismissed = sessionStorage.getItem("locationPromptDismissed"); } catch {}
                if (!dismissed) {
                    setShowLocationPrompt(true);
                } else {
                    setLocationStepDone(true);
                }
            }
        }, [isDashboardPage]),
    });

    // Detect when location step is done (permission already granted/denied, no prompt needed)
    useEffect(() => {
        console.log("[ModalSequence] Location check:", { isDashboardPage, showLocationPrompt, permissionState, locationStepDone });
        if (!isDashboardPage || showLocationPrompt) return;
        if (permissionState === "granted" || permissionState === "denied") {
            console.log("[ModalSequence] Location permission already", permissionState, "→ skipping prompt, advancing in 500ms");
            const timer = setTimeout(() => {
                if (!showLocationPrompt) {
                    setLocationStepDone(true);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isDashboardPage, permissionState, showLocationPrompt]);

    // Close location prompt → advance to push notification step
    const closeLocationPrompt = useCallback(() => {
        setShowLocationPrompt(false);
        try { sessionStorage.setItem("locationPromptDismissed", "true"); } catch {}
        setLocationStepDone(true);
    }, []);

    // Handle location request from prompt
    const handleLocationRequest = useCallback(() => {
        requestLocation();
        setShowLocationPrompt(false);
        try { sessionStorage.setItem("locationPromptDismissed", "true"); } catch {}
        setLocationStepDone(true);
    }, [requestLocation]);

    // Push notification dismissed → advance to subscription step
    const handlePushDismissed = useCallback(() => {
        console.log("[ModalSequence] Push step done → advancing to subscription");
        setPushStepDone(true);
    }, []);

    // Subscription modal management - only auto-show after location + push steps are done
    const {
        showSubscriptionModal,
        openSubscriptionModal,
        closeSubscriptionModal,
        handleSubscribe,
    } = useSubscriptionCheck({
        hasActiveSubscription,
        hasPendingSubscription,
        customerBalance,
        trialPrice: trialPackage?.price || 10000,
        trialPlanId: trialPackage?.id || "",
        showOnMount: pushStepDone && isDashboardPage,
    });

    // SSE connection for subscription activation notifications
    useSubscriptionSSE({
        hasPendingSubscription,
        onActivated: (data) => {
            console.log("Subscription activated via SSE:", data);
        },
    });

    // Handler for chat navigation with subscription check
    const handleChatNavigation = (e: React.MouseEvent, url: string) => {
        if (url.includes("/chat")) {
            if (!hasActiveSubscription) {
                e.preventDefault();
                openSubscriptionModal();
            }
        }
    };

    const navigationItems = useMemo(() => [
        { title: t('navigation.discover'), url: "/customer", icon: Search, badge: 0 },
        { title: t('navigation.posts', { defaultValue: 'Posts' }), url: "/customer/posts", icon: UserSearch, badge: 0 },
        { title: t('navigation.chat'), url: "/customer/chat", icon: MessageCircle, badge: liveUnreadMessages },
        { title: t('navigation.datingHistory'), url: "/customer/dates-history", icon: HandHeart, badge: 0 },
        { title: t('navigation.wallet'), url: "/customer/wallets", icon: Wallet, badge: 0 },
        { title: t('navigation.myProfile'), url: "/customer/profile", icon: User, badge: 0 },
        { title: t('navigation.setting'), url: "/customer/setting", icon: Settings, badge: 0 },
    ], [t, i18n.language, liveUnreadMessages]);

    const mobileNavigationItems = useMemo(() => [
        { title: t('navigation.discover'), url: "/customer", icon: Search, badge: 0 },
        { title: t('navigation.chat'), url: "/customer/chat", icon: MessageCircle, badge: liveUnreadMessages },
        { title: t('navigation.dating'), url: "/customer/dates-history", icon: HandHeart, badge: 0 },
        // { title: t('navigation.wallet'), url: "/customer/wallets", icon: Wallet, badge: 0 },
        { title: t('navigation.posts', { defaultValue: 'Posts' }), url: "/customer/posts", icon: UserSearch, badge: 0 },
        { title: t('navigation.setting'), url: "/customer/setting", icon: Settings, badge: 0 },
    ], [t, i18n.language, liveUnreadMessages]);

    const isActiveRoute = (url: string) => {
        if (url === "/customer" && location.pathname === "/customer") return true;
        if (url !== "/customer" && location.pathname.startsWith(url)) return true;
        return false;
    };

    // 👇 Hide the bottom nav inside a single conversation (/customer/chat/:id)
    //    so the composer sits at the bottom of the screen. The conversation
    //    list itself (/customer/chat) keeps the nav.
    const hideMobileNav = /^\/customer\/chat\/[^/]+/.test(location.pathname);

    // 👇 Show mobile header only on main navigation routes (hide inside a conversation and on settings pages)
    const showMobileHeader = !hideMobileNav &&
        !location.pathname.startsWith("/customer/setting") &&
        mobileNavigationItems.some(item => {
            if (item.url === "/customer" && location.pathname === "/customer") return true;
            if (item.url !== "/customer" && location.pathname.startsWith(item.url)) return true;
            return false;
        });


    return (
        <div className="flex min-h-screen w-full relative">
            <div className="w-1/5 p-6 hidden sm:flex flex-col items-start justify-between sm:sticky sm:top-0 sm:h-screen pb-10">
                <div className="w-full">
                    <div className="flex items-start justify-between">
                        <Link to="/customer/profile" className="flex items-center space-x-3">
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
                        </Link>
                        <NotificationBell userType="customer" initialCount={unreadNotifications} initialNotifications={initialNotifications} />
                    </div>

                    <SidebarSeparator className="my-4" />

                    <div className="space-y-2">
                        {navigationItems.map((item) => {
                            const isActive = isActiveRoute(item.url);
                            const pending = isNavPending(item.url);
                            return (
                                <Link
                                    to={item.url}
                                    key={item.title}
                                    prefetch="intent"
                                    onClick={(e) => handleChatNavigation(e, item.url)}
                                    aria-busy={pending}
                                    className={`flex items-center justify-start cursor-pointer space-x-3 p-2 rounded-md transition-all duration-150 active:scale-[0.97] active:bg-rose-100 ${isActive
                                        ? "bg-rose-100 text-rose-500 border border-rose-300"
                                        : "hover:bg-rose-50 hover:text-rose-500"
                                        } ${pending ? "bg-rose-50 text-rose-500" : ""}`}
                                >
                                    {pending
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <item.icon className="w-4 h-4" />}
                                    <p className="flex-1" suppressHydrationWarning>{item.title}</p>
                                    {!!item.badge && item.badge > 0 && (
                                        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[11px] font-medium">
                                            {item.badge > 99 ? "99+" : item.badge}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                    <Form method="post" action="/logout" className="w-full mt-10">
                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium bg-rose-50 border border-rose-100 text-rose-500 cursor-pointer hover:bg-rose-100 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            <span suppressHydrationWarning>{t('settings.common.logout')}</span>
                        </button>
                    </Form>
                </div>

            </div>

            <div className={`w-full sm:w-4/5 flex flex-col min-h-screen sm:pb-0 ${hideMobileNav ? "" : "pb-18"}`}>
                {showMobileHeader && (
                    <div className="sm:hidden flex items-center justify-between px-4 py-3 pt-safe border-b bg-white sticky top-0 z-30">
                        <Link to="/customer/profile"
                            prefetch="intent"
                            className="flex items-center gap-2 min-w-0"
                        >
                            <div className="relative flex-shrink-0">
                                <img
                                    src={customerData.profile}
                                    alt="Profile"
                                    className="w-10 h-10 min-w-10 min-h-10 rounded-full object-cover border border-rose-300 aspect-square"
                                />
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                            </div>
                            <div className="flex items-start justify-center flex-col min-w-0">
                                <span className="text-sm font-medium uppercase truncate max-w-full">{customerData.firstName} {customerData.lastName}</span>
                                {/* <span className="text-xs text-gray-500 truncate max-w-full">{customerData.bio}</span> */}
                            </div>
                        </Link>
                        <div className="flex items-center justify-center gap-3">
                            <NotificationBell userType="customer" initialCount={unreadNotifications} initialNotifications={initialNotifications} />
                            {isDiscoverPage && (
                                <HeaderSearch searchAction="/customer/discover/find" hrefFor={(id) => `/customer/user-profile/${id}`} />
                            )}
                            <Form method="post" action="/logout">
                                <button
                                    type="submit"
                                    className="bg-rose-50 flex items-center gap-1.5 px-2 py-1.5 rounded-sm text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer text-xs font-medium"
                                >
                                    {/* <span suppressHydrationWarning>{t('settings.common.logout')}</span> */}
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </Form>
                        </div>
                    </div>
                )}
                <main className="bg-background flex-1">
                    <Outlet />
                </main>
            </div>

            {/* ── Awaiting-slip floating banner (mobile only, above bottom nav) ── */}
            {showSlipBanner && awaitingSlipIntent && !hideMobileNav && (
                <div className="fixed bottom-[58px] left-2 right-2 z-40 sm:hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-xl shadow-lg">
                        <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        <Link
                            to={`/customer/wallet-topup?intentId=${awaitingSlipIntent.id}&resumeStep=3&amount=${awaitingSlipIntent.amount}`}
                            className="flex-1 min-w-0"
                        >
                            <p className="text-xs font-semibold text-amber-800 leading-tight">
                                {t('wallet.awaitingSlip.title', { defaultValue: 'ການໂອນເງິນຍັງບໍ່ສຳເລັດ' })}
                            </p>
                            <p className="text-[11px] text-amber-600 truncate">
                                {t('wallet.awaitingSlip.action', { defaultValue: 'ກົດເພື່ອອັບໂຫລດໃບຊໍາລະ →' })}
                            </p>
                        </Link>
                        <button
                            type="button"
                            onClick={dismissSlipBanner}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-amber-400 hover:bg-amber-100 transition-colors flex-shrink-0 cursor-pointer"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* ✅ Mobile Bottom Navigation (hidden inside a conversation) */}
            {!hideMobileNav && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 sm:hidden z-40">
                    <div className="flex items-center justify-around py-1">
                        {mobileNavigationItems.map((item) => {
                            const isActive = isActiveRoute(item.url);
                            const pending = isNavPending(item.url);
                            return (
                                <Link
                                    to={item.url}
                                    key={item.title}
                                    prefetch="viewport"
                                    onClick={(e) => handleChatNavigation(e, item.url)}
                                    aria-busy={pending}
                                    className="flex flex-col items-center justify-center p-2 min-w-0 flex-1 transition-transform duration-150 active:scale-90"
                                >
                                    <span className="relative">
                                        {pending ? (
                                            <Loader2 className="w-4 h-4 mb-1 animate-spin text-rose-500" />
                                        ) : (
                                        <item.icon
                                            // Lucide icons are SVG strokes, so "bold" means a
                                            // thicker stroke — font-weight does nothing here.
                                            strokeWidth={isActive ? 2.75 : 2}
                                            className={`w-4 h-4 mb-1 ${isActive ? "text-rose-500" : "text-gray-600"
                                                }`}
                                        />
                                        )}
                                        {!!item.badge && item.badge > 0 && (
                                            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-medium">
                                                {item.badge > 99 ? "99+" : item.badge}
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        className={`text-xs truncate ${isActive ? "text-rose-500 font-bold" : "text-gray-600"
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

            {/* Step 1: Location Permission Prompt Modal */}
            <LocationPromptModal
                isOpen={showLocationPrompt}
                onClose={closeLocationPrompt}
                onRequestLocation={handleLocationRequest}
            />

            {/* Step 2: Push Notification Permission Prompt (Android only, after location step) */}
            <PushNotificationPrompt
                userType="customer"
                hasEnabledNotifications={hasEnabledNotifications}
                enabled={locationStepDone}
                onDismiss={handlePushDismissed}
            />

            {/* Step 3: Subscription Trial Modal (after push step) */}
            {trialPackage && (
                <SubscriptionModal
                    isOpen={showSubscriptionModal}
                    onClose={closeSubscriptionModal}
                    customerBalance={customerBalance}
                    trialPrice={trialPackage.price}
                    trialPlanId={trialPackage.id}
                    onSubscribe={handleSubscribe}
                    hasPendingSubscription={hasPendingSubscription}
                />
            )}
        </div>
    );
}
