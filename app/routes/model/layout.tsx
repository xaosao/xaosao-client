import { useMemo, useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Form, Link, Outlet, redirect, useFetcher, useLocation, useNavigate, useRevalidator, type LoaderFunction } from "react-router";
import {
    Briefcase,
    EyeOff,
    Gift,
    UserSearch,
    HandHeart,
    Heart,
    LogOut,
    Settings,
    User,
    User2Icon,
    Wallet,
    X,
} from "lucide-react";
import {
    Dialog,
    DialogDescription,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { SidebarSeparator } from "~/components/ui/sidebar";
import { NotificationBell } from "~/components/notifications/NotificationBell";
import { PushNotificationPrompt } from "~/components/pwa/PushNotificationPrompt";
import { useAutoLocation } from "~/hooks/useAutoLocation";
import { LocationPromptModal } from "~/components/location/LocationPromptModal";

// services
import { BlurImage } from "~/components/ui/blur-image";
import { capitalize } from "~/utils/functions/textFormat";
import { useNotifications, type Notification } from "~/hooks/useNotifications";
import { getModelDashboardData } from "~/services/model.server";
import { requireModelSession } from "~/services/model-auth.server";
import { getModelUnreadCount, getModelNotifications } from "~/services/notification.server";
import { getModelPendingBookingCount } from "~/services/booking.server";

interface ModelData {
    id: string;
    firstName: string;
    lastName?: string;
    profile: string;
    profileHiddenByAdmin?: boolean;
    available_status: string;
    rating: number;
    total_review: number;
    Wallet: Array<{ totalBalance: number }>;
}

interface LoaderReturn {
    modelData: ModelData;
    unreadNotifications: number;
    initialNotifications: Notification[];
    pendingBookingCount: number;
    hasServices: boolean;
    hasEnabledNotifications: boolean;
    isProfileHidden: boolean;
}

interface LayoutProps {
    loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
    const modelId = await requireModelSession(request);

    try {
        const [modelData, unreadNotifications, notifications, pendingBookingCount] = await Promise.all([
            getModelDashboardData(modelId),
            getModelUnreadCount(modelId).catch(() => 0),
            getModelNotifications(modelId, { limit: 10 }).catch(() => []),
            getModelPendingBookingCount(modelId).catch(() => 0),
        ]);

        const initialNotifications: Notification[] = (notifications || []).map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            data: n.data as Record<string, any>,
            isRead: n.isRead,
            createdAt: n.createdAt.toISOString(),
        }));

        // Check if model has at least one active service
        const hasServices = (modelData?.ModelService?.length ?? 0) > 0;

        // Check if model has enabled notifications (either push or SMS)
        const hasEnabledNotifications = modelData?.sendPushNoti || modelData?.sendSMSNoti || false;

        const isProfileHidden = modelData?.isProfileHidden === true;

        return { modelData, unreadNotifications, initialNotifications, pendingBookingCount, hasServices, hasEnabledNotifications, isProfileHidden };
    } catch (error) {
        console.error("[ModelLayout] Loader error:", error);
        throw redirect("/model-auth/login");
    }
}

export default function ModelLayout({ loaderData }: LayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const revalidator = useRevalidator();
    const { modelData, unreadNotifications, initialNotifications, pendingBookingCount, hasServices, hasEnabledNotifications, isProfileHidden } = loaderData;
    const profileHiddenFetcher = useFetcher();
    const { t, i18n } = useTranslation();

    // Only show location prompt on main model page
    const isModelMainPage = location.pathname === "/model";

    // Location prompt modal state
    const [showLocationPrompt, setShowLocationPrompt] = useState(false);

    // Referral promotion popup - show until March 31, 2026
    const PROMO_END_DATE = new Date("2026-04-01T00:00:00");
    const [showPromoPopup, setShowPromoPopup] = useState(false);
    const [promoCountdown, setPromoCountdown] = useState({ days: 0, hours: 0, minutes: 0 });

    useEffect(() => {
        const now = new Date();
        if (now >= PROMO_END_DATE) return; // Promotion ended

        // Show once per session
        let dismissed: string | null = null;
        try { dismissed = sessionStorage.getItem("referral_promo_dismissed"); } catch {}
        if (!dismissed) {
            setShowPromoPopup(true);
        }

        // Update countdown
        const updateCountdown = () => {
            const diff = PROMO_END_DATE.getTime() - Date.now();
            if (diff <= 0) {
                setShowPromoPopup(false);
                return;
            }
            setPromoCountdown({
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((diff / (1000 * 60)) % 60),
            });
        };
        updateCountdown();
        const interval = setInterval(updateCountdown, 60000);
        return () => clearInterval(interval);
    }, []);

    const dismissPromo = useCallback(() => {
        setShowPromoPopup(false);
        try { sessionStorage.setItem("referral_promo_dismissed", "true"); } catch {}
    }, []);

    // Auto-location tracking - updates server silently when location is available
    const { requestLocation, hasLocation, permissionState } = useAutoLocation({
        userType: "model",
        enabled: true,
        onNeedPermission: useCallback(() => {
            // Only show prompt on main model page, not on every navigation
            if (isModelMainPage) {
                // Check if user has already dismissed the prompt this session
                let mdismissed: string | null = null;
                try { mdismissed = sessionStorage.getItem("modelLocationPromptDismissed"); } catch {}
                if (!mdismissed) {
                    setShowLocationPrompt(true);
                }
            }
        }, [isModelMainPage]),
    });

    // Close location prompt and remember dismissal for this session
    const closeLocationPrompt = useCallback(() => {
        setShowLocationPrompt(false);
        try { sessionStorage.setItem("modelLocationPromptDismissed", "true"); } catch {}
    }, []);

    // Handle location request from prompt
    const handleLocationRequest = useCallback(() => {
        requestLocation();
        setShowLocationPrompt(false);
    }, [requestLocation]);

    // Notification types that should trigger a layout/child route refresh
    const revalidateNotificationTypes = [
        "booking_created",
        "booking_cancelled",
        "booking_disputed",
        "new_post_match",
        "post_interest",
        "post_comment",
        "post_comment_reply",
    ];

    // Handle new notifications - refresh layout when booking/post-related, redirect for calls
    const handleNewNotification = useCallback((notification: Notification) => {
        // Handle incoming call - redirect to incoming call page
        if (notification.type === "incoming_call") {
            console.log("[ModelLayout] Incoming call notification received!", notification);
            const bookingId = notification.data?.bookingId;
            if (bookingId) {
                navigate(`/model/call/join/${bookingId}`);
            }
            return;
        }

        // Handle booking/post notifications - refresh data
        if (revalidateNotificationTypes.includes(notification.type)) {
            console.log("[ModelLayout] Revalidating for notification:", notification.type);
            revalidator.revalidate();
        }
    }, [revalidator, navigate]);

    // Connect to real-time notifications for layout updates
    useNotifications({
        userType: "model",
        onNewNotification: handleNewNotification,
        playSound: false, // Sound handled by NotificationBell
    });

    const navigationItems = useMemo(() => [
        { title: t('navigation.posts', { defaultValue: 'Posts' }), url: "/model", icon: UserSearch, badge: 0 },
        { title: t('navigation.match'), url: "/model/matches", icon: Heart, badge: 0 },
        // { title: t('navigation.chat'), url: "/model/realtime-chat", icon: MessageCircle, badge: 0 },
        { title: t('navigation.datingHistory'), url: "/model/dating", icon: HandHeart, badge: pendingBookingCount },
        { title: t('navigation.wallet'), url: "/model/settings?tab=wallet", icon: Wallet, badge: 0 },
        { title: t('navigation.myProfile'), url: "/model/profile", icon: User, badge: 0 },
        { title: t('navigation.setting'), url: "/model/settings", icon: Settings, badge: 0 },
    ], [t, i18n.language, pendingBookingCount]);

    const mobileNavigationItems = useMemo(() => [
        { title: t('navigation.posts', { defaultValue: 'Posts' }), url: "/model", icon: UserSearch, badge: 0 },
        { title: t('navigation.match'), url: "/model/matches", icon: Heart, badge: 0 },
        { title: t('navigation.dating'), url: "/model/dating", icon: HandHeart, badge: pendingBookingCount },
        { title: t('navigation.profile'), url: "/model/profile", icon: User2Icon, badge: 0 },
        { title: t('navigation.setting'), url: "/model/settings", icon: Settings, badge: 0 },
    ], [t, i18n.language, pendingBookingCount]);

    const isActiveRoute = (url: string) => {
        // Handle wallet with query param
        if (url === "/model/settings?tab=wallet") {
            return location.pathname === "/model/settings" && location.search === "?tab=wallet";
        }
        // Handle settings (but not wallet)
        if (url === "/model/settings") {
            return location.pathname === "/model/settings" && location.search !== "?tab=wallet";
        }
        // Handle posts (index route at /model renders posts, also match /model/posts/*)
        if (url === "/model") {
            return location.pathname === "/model" || location.pathname.startsWith("/model/posts");
        }
        // Handle matches
        if (url === "/model/matches") {
            return location.pathname.startsWith("/model/matches");
        }
        if (location.pathname.startsWith(url)) return true;
        return false;
    };

    // 👇 Hide bottom nav if the current route includes "realtime-chat"
    const hideMobileNav =
        location.pathname.includes("realtime-chat") ||
        location.pathname.includes("chat");

    // 👇 Show mobile header only on main navigation routes (hide on chat, profile, and settings pages)
    const showMobileHeader = !hideMobileNav &&
        !location.pathname.startsWith("/model/profile") &&
        !location.pathname.startsWith("/model/settings") &&
        mobileNavigationItems.some(item => {
            if (item.url === "/model") return location.pathname === "/model" || location.pathname.startsWith("/model/posts");
            if (location.pathname.startsWith(item.url)) return true;
            return false;
        });

    return (
        <div className="flex min-h-screen w-full relative">
            <div className="w-1/5 p-6 hidden sm:flex flex-col items-start justify-between sm:sticky sm:top-0 sm:h-screen pb-10">
                <div className="w-full">
                    <div className="flex items-start justify-between">
                        <Link to="/model/profile" className="flex items-center space-x-3">
                            <div className="relative">
                                <div className="w-14 h-14 border-[2px] border-rose-500 rounded-full flex items-center justify-center hover:border-rose-600">
                                    <BlurImage
                                        isHidden={modelData.profileHiddenByAdmin}
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
                        </Link>
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
                                    className={`flex items-center justify-between cursor-pointer space-x-3 p-2 rounded-md transition-colors ${isActive
                                        ? "bg-rose-100 text-rose-500 border border-rose-300"
                                        : "hover:bg-rose-50 hover:text-rose-500"
                                        }`}
                                >
                                    <div className="flex gap-2 items-center justify-center">
                                        <item.icon className="w-4 h-4" />
                                        <p suppressHydrationWarning>{item.title}</p>
                                    </div>
                                    {item.badge > 0 && (
                                        <span className="min-w-[18px] h-[18px] px-1.5 flex items-center justify-center bg-rose-500 text-white text-[10px] font-medium rounded-full mb-2 animate-bounce">
                                            {item.badge > 99 ? "99+" : item.badge}
                                        </span>
                                    )}
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

            <div className="w-full sm:w-4/5 flex flex-col min-h-screen pb-18 sm:pb-0">
                {showMobileHeader && (
                    <div className="sm:hidden flex items-center justify-between px-4 py-2 border-b bg-white sticky top-0 z-30">
                        <Link to="/model/profile"
                            prefetch="intent"
                            className="flex items-center gap-2 min-w-0"
                        >
                            <div className="relative flex-shrink-0">
                                <BlurImage
                                    isHidden={modelData.profileHiddenByAdmin}
                                    src={modelData.profile}
                                    alt="Profile"
                                    className="w-10 h-10 min-w-10 min-h-10 rounded-full object-cover border border-rose-300 aspect-square"
                                />
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                            </div>
                            <div className="flex items-start justify-center flex-col min-w-0">
                                <span className="text-sm font-medium uppercase truncate max-w-full">{modelData.firstName} {modelData.lastName}</span>
                                <span className="text-xs text-gray-500 truncate max-w-full">{capitalize(modelData.available_status)}</span>
                            </div>
                        </Link>
                        <div className="flex items-center justify-center gap-4">
                            <NotificationBell userType="model" initialCount={unreadNotifications} initialNotifications={initialNotifications} />
                            {/* <Settings size={18} className="text-gray-500" onClick={() => navigate("/model/settings")} /> */}
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
                                    <div className="relative mb-1">
                                        <item.icon
                                            className={`w-4 h-4 ${isActive ? "text-rose-500" : "text-gray-600"
                                                }`}
                                        />
                                        {item.badge > 0 && (
                                            <span className="absolute -top-1.5 -right-4 min-w-[14px] h-3.5 px-1 flex items-center justify-center bg-rose-500 text-white text-[9px] font-medium rounded-full">
                                                {item.badge > 99 ? "99+" : item.badge}
                                            </span>
                                        )}
                                    </div>
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

            {/* Push Notification Permission Prompt */}
            <PushNotificationPrompt userType="model" hasEnabledNotifications={hasEnabledNotifications} />

            {/* Service Setup Required Modal */}
            <Dialog open={!hasServices && !location.pathname.startsWith("/model/settings")} modal={true}>
                <DialogPortal>
                    <DialogOverlay className="bg-black/80" />
                    <div className="fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-sm bg-white">
                        <DialogHeader className="text-center">
                            <div className="mx-auto mb-4 p-4 bg-rose-100 rounded-full w-fit">
                                <Briefcase className="w-5 h-5 text-rose-600" />
                            </div>
                            <DialogTitle className="text-center text-lg">
                                {t('modelSettings.serviceRequired.title', { defaultValue: 'Service Setup Required' })}
                            </DialogTitle>
                            <DialogDescription className="text-center pt-2">
                                {t('modelSettings.serviceRequired.description', {
                                    defaultValue: 'You need to set up at least one service before you can start receiving bookings from customers. Please add your service details to get started.'
                                })}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                            <Button
                                onClick={() => navigate("/model/settings/services")}
                                className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                            >
                                {t('modelSettings.serviceRequired.button', { defaultValue: 'Set Up Services' })}
                            </Button>
                        </div>
                    </div>
                </DialogPortal>
            </Dialog>

            {/* Profile Hidden Warning Modal */}
            <Dialog open={isProfileHidden} modal={true}>
                <DialogPortal>
                    <DialogOverlay className="bg-black/80" />
                    <div className="fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-sm bg-white">
                        <DialogHeader className="text-center">
                            <div className="mx-auto mb-4 p-4 bg-amber-100 rounded-full w-fit">
                                <EyeOff className="w-5 h-5 text-amber-600" />
                            </div>
                            <DialogTitle className="text-center text-lg">
                                {t('modelSettings.profileHidden.popupTitle', { defaultValue: 'Your Profile is Hidden' })}
                            </DialogTitle>
                            <DialogDescription className="text-center pt-2">
                                {t('modelSettings.profileHidden.popupDescription', {
                                    defaultValue: 'Customers cannot see your profile right now. When you\'re ready to receive bookings again, show your profile.'
                                })}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                            <Button
                                onClick={() => profileHiddenFetcher.submit(
                                    { actionType: "toggleVisibility", isHidden: "false" },
                                    { method: "post", action: "/model/profile" }
                                )}
                                disabled={profileHiddenFetcher.state !== "idle"}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                            >
                                {profileHiddenFetcher.state !== "idle"
                                    ? t('modelSettings.profileHidden.showButton', { defaultValue: 'Show My Profile' }) + "..."
                                    : t('modelSettings.profileHidden.showButton', { defaultValue: 'Show My Profile' })}
                            </Button>
                        </div>
                    </div>
                </DialogPortal>
            </Dialog>

            {/* Referral Promotion Popup */}
            {showPromoPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="relative w-full max-w-sm bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl shadow-2xl overflow-hidden">
                        <button
                            type="button"
                            onClick={dismissPromo}
                            className="absolute top-3 right-3 p-1 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors z-10"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="p-6 text-center text-white space-y-4">
                            <div className="mx-auto w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                                <Gift className="w-7 h-7 text-white" />
                            </div>

                            <div>
                                <h2 className="text-lg font-bold">{t('referralPromo.title', { defaultValue: 'ໂປຣໂມຊັ່ນແນະນຳໃກ້ໝົດ!' })}</h2>
                                <p className="text-sm text-white/90 mt-2">
                                    {t('referralPromo.description', {
                                        defaultValue: 'ຮັບ 50,000 ກີບ ຕໍ່ການແນະນຳ 1 ຄົນ ກຳລັງຈະໝົດເຂດ! ຫຼັງຈາກ 01/04/2026 ຈະໄດ້ຮັບພຽງ 10,000 ກີບ ເທົ່ານັ້ນ.'
                                    })}
                                </p>
                            </div>

                            {/* Countdown */}
                            <div className="flex justify-center gap-3">
                                <div className="bg-white/20 rounded-lg px-3 py-2 min-w-[60px]">
                                    <p className="text-xl font-bold">{promoCountdown.days}</p>
                                    <p className="text-[10px] text-white/80 uppercase">{t('referralPromo.days', { defaultValue: 'ມື້' })}</p>
                                </div>
                                <div className="bg-white/20 rounded-lg px-3 py-2 min-w-[60px]">
                                    <p className="text-xl font-bold">{promoCountdown.hours}</p>
                                    <p className="text-[10px] text-white/80 uppercase">{t('referralPromo.hours', { defaultValue: 'ຊົ່ວໂມງ' })}</p>
                                </div>
                                <div className="bg-white/20 rounded-lg px-3 py-2 min-w-[60px]">
                                    <p className="text-xl font-bold">{promoCountdown.minutes}</p>
                                    <p className="text-[10px] text-white/80 uppercase">{t('referralPromo.minutes', { defaultValue: 'ນາທີ' })}</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { dismissPromo(); navigate("/model/referral"); }}
                                    className="w-full py-2.5 bg-white text-rose-600 font-bold rounded-lg hover:bg-white/90 transition-colors"
                                >
                                    {t('referralPromo.referNow', { defaultValue: 'ແນະນຳເລີຍ!' })}
                                </button>
                                <button
                                    type="button"
                                    onClick={dismissPromo}
                                    className="text-sm text-white/70 hover:text-white transition-colors"
                                >
                                    {t('referralPromo.later', { defaultValue: 'ພາຍຫຼັງ' })}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Location Permission Prompt Modal */}
            <LocationPromptModal
                isOpen={showLocationPrompt}
                onClose={closeLocationPrompt}
                onRequestLocation={handleLocationRequest}
            />
        </div>
    );
}
