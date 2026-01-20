import {
    X,
    User,
    Heart,
    MapPin,
    Calendar,
    Minimize,
    Maximize,
    UserPlus,
    ChevronLeft,
    ChevronRight,
    Loader,
    MessageSquareText,
    SlidersHorizontal,
    Search,
    Star,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import type { Route } from "./+types/discover";
import { useTranslation } from "react-i18next";
import { Form, redirect, useNavigate, useNavigation, useSearchParams, type LoaderFunction } from "react-router";

// swiper
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import Rating from "~/components/ui/rating";
import { Badge } from "~/components/ui/badge";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";

// filter components
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerTrigger,
} from "~/components/ui/drawer";

// service and backend
import { capitalize } from "~/utils/functions/textFormat";
import { calculateAgeFromDOB, calculateDistance, formatDistance } from "~/utils";
import { getUserTokenFromSession, requireUserSession } from "~/services/auths.server";
import type { Gender, IAvailableStatus, IUserImages } from "~/interfaces/base";
import { createCustomerInteraction, customerAddFriend } from "~/services/interaction.server";
import type { ImodelsResponse, INearbyModelResponse } from "~/interfaces";
import { getModelsForCustomer, getNearbyModels } from "~/services/model.server";

interface LoaderReturn {
    latitude: number;
    longitude: number;
    models: ImodelsResponse[];
    hasActiveSubscription: boolean;
    nearbyModels: INearbyModelResponse[];
}

interface DiscoverPageProps {
    loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
    const customerId = await requireUserSession(request);
    const { hasActiveSubscription } = await import("~/services/package.server");
    const { getCustomerProfile } = await import("~/services/profile.server");

    // Get customer's current GPS location from database
    const customer = await getCustomerProfile(customerId);
    const latitude = customer?.latitude || 0;
    const longitude = customer?.longitude || 0;

    // Check if customer has active subscription
    const hasSubscription = await hasActiveSubscription(customerId);

    // Parse filter parameters from URL
    const url = new URL(request.url);
    const filters = {
        search: url.searchParams.get("search") || undefined,
        services: url.searchParams.getAll("services").filter(Boolean),
        maxDistance: url.searchParams.get("distance") ? Number(url.searchParams.get("distance")) : undefined,
        ageRange: url.searchParams.get("ageMin") && url.searchParams.get("ageMax")
            ? [Number(url.searchParams.get("ageMin")), Number(url.searchParams.get("ageMax"))] as [number, number]
            : undefined,
        gender: url.searchParams.get("gender") || undefined,
        minRating: url.searchParams.get("rating") ? Number(url.searchParams.get("rating")) : undefined,
    };

    // Get models for this customer with filters
    const response = await getModelsForCustomer(customerId, filters);
    const models: ImodelsResponse[] = response.map((model) => ({
        ...model,
        gender: model.gender as Gender,
        available_status: model.available_status as IAvailableStatus,
    }));

    // Get nearby models with same filters
    const nearbyModels = await getNearbyModels(customerId as string, filters);

    return {
        models,
        nearbyModels,
        latitude,
        longitude,
        hasActiveSubscription: hasSubscription,
    };
};

export async function action({
    request,
}: Route.ActionArgs) {
    if (request.method !== "POST") {
        return redirect(`/customer/?toastMessage=Invalid+request+method.+Please+try+again+later&toastType=warning`);
    }

    const customerId = await requireUserSession(request)
    const token = await getUserTokenFromSession(request)
    const formData = await request.formData();
    const like = formData.get("like") === "true";
    const pass = formData.get("pass") === "true";
    const addFriend = formData.get("isFriend") === "true";
    const modelId = formData.get("modelId") as string;

    // Preserve the profileId to keep selection after action
    const profileIdParam = modelId ? `&profileId=${modelId}` : "";

    if (addFriend === true) {
        try {
            const res = await customerAddFriend(customerId, modelId, token);
            if (res?.success) {
                return redirect(`/customer/?toastMessage=Add+friend+successfully!&toastType=success${profileIdParam}`);
            }
            return redirect(`/customer/?toastMessage=${res?.message || 'Failed to add friend'}&toastType=error${profileIdParam}`);
        } catch (error: any) {
            return redirect(`/customer/?toastMessage=${error.message}&toastType=error${profileIdParam}`);
        }
    }

    if (like === false && pass === false) {
        return redirect(`/customer/?toastMessage=Invalid+request+action&toastType=warning${profileIdParam}`);
    }

    const actionType = like === true ? "LIKE" : "PASS"
    try {
        const res = await createCustomerInteraction(customerId, modelId, actionType);
        if (res?.success) {
            return redirect(`/customer/?toastMessage=Interaction+successfully!&toastType=success${profileIdParam}`);
        }
        return redirect(`/customer/?toastMessage=${res?.message || 'Interaction failed'}&toastType=error${profileIdParam}`);
    } catch (error: any) {
        return redirect(`/customer/?toastMessage=${error.message}&toastType=error${profileIdParam}`);
    }
}

export default function DiscoverPage({ loaderData }: DiscoverPageProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const navigation = useNavigation()
    const [searchParams] = useSearchParams();
    const { models, nearbyModels, latitude, longitude, hasActiveSubscription } = loaderData;

    // Filter drawer state
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const isLoading = navigation.state === "loading";

    // Handler for WhatsApp button click with subscription check
    const handleWhatsAppClick = (whatsappNumber: number) => {
        if (!hasActiveSubscription) {
            navigate("/customer/packages?toastMessage=Please+subscribe+to+a+package+to+contact+models&toastType=warning");
        } else {
            window.open(`https://wa.me/${whatsappNumber}`);
        }
    };
    const isSubmitting =
        navigation.state !== "idle" && navigation.formMethod === "POST"


    const selectedId = searchParams.get("profileId") || models?.[0]?.id;
    const selectedProfile = models.find((p) => p.id === selectedId);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Refs for auto-scroll to selected model in header
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const modelItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Auto-scroll to selected model when selectedId changes or after form submission
    useEffect(() => {
        // Only run when navigation is idle (not during submission/loading)
        if (navigation.state !== 'idle') return;

        // Longer delay for mobile devices to ensure DOM is fully ready
        const timeoutId = setTimeout(() => {
            if (selectedId && scrollContainerRef.current) {
                const container = scrollContainerRef.current;
                const selectedElement = modelItemRefs.current.get(selectedId);
                if (selectedElement) {
                    // Calculate scroll position to center the element
                    const containerWidth = container.clientWidth;
                    const elementOffsetLeft = selectedElement.offsetLeft;
                    const elementWidth = selectedElement.offsetWidth;
                    const scrollPosition = elementOffsetLeft - (containerWidth / 2) + (elementWidth / 2);

                    // Use scrollLeft for better mobile compatibility
                    try {
                        container.scrollTo({
                            left: Math.max(0, scrollPosition),
                            behavior: 'smooth'
                        });
                    } catch {
                        // Fallback for older browsers
                        container.scrollLeft = Math.max(0, scrollPosition);
                    }
                }
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [selectedId, navigation.state]);

    const [images, setImages] = React.useState<IUserImages[]>(models?.[0]?.Images ?? []);
    const [touchEndX, setTouchEndX] = React.useState<number | null>(null)
    const [touchStartX, setTouchStartX] = React.useState<number | null>(null)
    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)

    // For toast messages
    const toastMessage = searchParams.get("toastMessage");
    const toastType = searchParams.get("toastType");
    const showToast = (message: string, type: "success" | "error" | "warning" = "success", duration = 3000) => {
        searchParams.set("toastMessage", message);
        searchParams.set("toastType", type);
        searchParams.set("toastDuration", String(duration));
        navigate({ search: searchParams.toString() }, { replace: true });
    };
    React.useEffect(() => {
        if (toastMessage) {
            showToast(toastMessage, toastType as any);
        }
    }, [toastMessage, toastType]);

    const handlePrev = () => {
        if (selectedIndex === null) return;
        setSelectedIndex((prev) => (prev! - 1 + images.length) % images.length)
    };

    const handleNext = () => {
        if (selectedIndex === null) return;
        setSelectedIndex((prev) => (prev! + 1) % images.length)
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEndX(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStartX || !touchEndX) return;
        const distance = touchStartX - touchEndX;

        if (distance > 50) {
            handleNext();
        } else if (distance < -50) {
            handlePrev();
        }

        setTouchStartX(null);
        setTouchEndX(null);
    };

    if (models.length === 0) {
        return (
            <div className="space-y-6 sm:space-y-8 p-0 sm:p-6">
                <div>
                    <div className="flex items-start justify-between sm:bg-white w-full p-3 sm:px-0">
                        <div className="space-y-1 sm:space-y-2">
                            <h1 className="text-lg sm:text-xl text-rose-500 text-shadow-sm">
                                {t("modelDashboard.title")}
                            </h1>
                            <p className="text-sm text-gray-600">
                                {t("modelDashboard.subtitle")}
                            </p>
                        </div>

                        {/* Filter Button */}
                        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                            <DrawerTrigger className="flex items-center justify-start gap-2 p-2 rounded-md cursor-pointer bg-rose-100 text-rose-500">
                                <SlidersHorizontal className="w-4 h-4" />
                            </DrawerTrigger>
                            <DrawerContent className="space-y-2 sm:space-y-4">
                                <Form
                                    method="get"
                                    className="flex flex-col h-full"
                                    onSubmit={(e) => {
                                        const formData = new FormData(e.currentTarget);
                                        const newParams = new URLSearchParams();

                                        const search = formData.get("search");
                                        const distance = formData.get("distance");
                                        const ageMin = formData.get("ageMin");
                                        const ageMax = formData.get("ageMax");
                                        const rating = formData.get("rating");
                                        const gender = formData.get("gender");
                                        const services = formData.getAll("services");

                                        if (search) newParams.set("search", search.toString());
                                        if (distance) newParams.set("distance", distance.toString());
                                        if (ageMin) newParams.set("ageMin", ageMin.toString());
                                        if (ageMax) newParams.set("ageMax", ageMax.toString());
                                        if (rating) newParams.set("rating", rating.toString());
                                        if (gender) newParams.set("gender", gender.toString());
                                        services.forEach(service => {
                                            if (service) newParams.append("services", service.toString());
                                        });

                                        navigate(`?${newParams.toString()}`, { replace: true });
                                        setDrawerOpen(false);
                                        e.preventDefault();
                                    }}
                                >
                                    <div className="hidden sm:flex items-center justify-between px-6 py-2 border-b">
                                        <h2 className="text-lg font-bold text-rose-500">{t('discover.filterOptions')}</h2>
                                        <DrawerClose>
                                            <button
                                                type="button"
                                                className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </DrawerClose>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                        {/* Search */}
                                        <div>
                                            <label className="block text-gray-700 font-medium">{t('discover.searchByName')}</label>
                                            <div className="relative mt-2">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    name="search"
                                                    defaultValue={searchParams.get("search") || ""}
                                                    placeholder={t('discover.searchPlaceholder')}
                                                    className="w-full pl-10 p-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Services Filter */}
                                        <div>
                                            <label className="block text-gray-700 font-medium mb-2">{t('discover.filterByServices')}</label>
                                            <div className="space-y-2">
                                                <label className="flex items-center text-sm">
                                                    <input
                                                        type="checkbox"
                                                        name="services"
                                                        value="massage"
                                                        defaultChecked={searchParams.getAll("services").includes("massage")}
                                                        className="mr-2 cursor-pointer accent-rose-500"
                                                    />
                                                    {t('discover.services.massage')}
                                                </label>
                                                <label className="flex items-center text-sm">
                                                    <input
                                                        type="checkbox"
                                                        name="services"
                                                        value="drinkingFriend"
                                                        defaultChecked={searchParams.getAll("services").includes("drinkingFriend")}
                                                        className="mr-2 cursor-pointer accent-rose-500"
                                                    />
                                                    {t('discover.services.drinkingFriend')}
                                                </label>
                                                <label className="flex items-center text-sm">
                                                    <input
                                                        type="checkbox"
                                                        name="services"
                                                        value="travelingPartner"
                                                        defaultChecked={searchParams.getAll("services").includes("travelingPartner")}
                                                        className="mr-2 cursor-pointer accent-rose-500"
                                                    />
                                                    {t('discover.services.travelingPartner')}
                                                </label>
                                                <label className="flex items-center text-sm">
                                                    <input
                                                        type="checkbox"
                                                        name="services"
                                                        value="talkingPartner"
                                                        defaultChecked={searchParams.getAll("services").includes("talkingPartner")}
                                                        className="mr-2 cursor-pointer accent-rose-500"
                                                    />
                                                    {t('discover.services.talkingPartner')}
                                                </label>
                                            </div>
                                        </div>

                                        {/* Max Distance */}
                                        <div>
                                            <label className="block text-gray-700 font-medium">{t('discover.maxDistance')}</label>
                                            <input
                                                type="number"
                                                name="distance"
                                                min={1}
                                                max={500}
                                                defaultValue={searchParams.get("distance") || ""}
                                                placeholder="50 km"
                                                className="w-full mt-2 p-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                            />
                                        </div>

                                        {/* Age Range */}
                                        <div>
                                            <label className="block text-gray-700 font-medium">{t('discover.ageRange')}</label>
                                            <div className="flex gap-2 mt-2">
                                                <input
                                                    type="number"
                                                    name="ageMin"
                                                    min={18}
                                                    max={100}
                                                    defaultValue={searchParams.get("ageMin") || ""}
                                                    className="w-1/2 p-2 border rounded-md"
                                                    placeholder={t('discover.minAge')}
                                                />
                                                <input
                                                    type="number"
                                                    name="ageMax"
                                                    min={18}
                                                    max={100}
                                                    defaultValue={searchParams.get("ageMax") || ""}
                                                    className="w-1/2 p-2 border rounded-md"
                                                    placeholder={t('discover.maxAge')}
                                                />
                                            </div>
                                        </div>

                                        {/* Min Rating */}
                                        <div>
                                            <label className="block text-gray-700 font-medium">{t('discover.minRating')}111</label>
                                            <select
                                                name="rating"
                                                className="w-full mt-2 p-2 border rounded-md"
                                                defaultValue={searchParams.get("rating") || ""}
                                            >
                                                <option value="">{t('discover.selectRating')}</option>
                                                {[1, 2, 3, 4, 5].map((r) => (
                                                    <option key={r} value={r}>{r} <Star className="h-4 w-4" /></option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Gender */}
                                        <div>
                                            <label className="block text-gray-700 font-medium">{t('discover.gender')}</label>
                                            <select
                                                name="gender"
                                                className="w-full mt-2 p-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                                defaultValue={searchParams.get("gender") || ""}
                                            >
                                                <option value="">{t('discover.allGenders')}</option>
                                                <option value="female">{t('discover.female')}</option>
                                                <option value="male">{t('discover.male')}</option>
                                                <option value="other">{t('discover.other')}</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-6 space-x-3 border-t">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigate(`/customer`, { replace: true });
                                                setDrawerOpen(false);
                                            }}
                                            className="w-full bg-gray-100 text-gray-700 py-2 rounded-md hover:bg-gray-200 transition-colors font-medium"
                                        >
                                            {t('discover.resetFilters')}
                                        </button>

                                        <button type="submit" className="w-full bg-rose-500 text-white py-2 rounded-md hover:bg-rose-600 transition-colors font-medium">
                                            {t('discover.applyFilters')}
                                        </button>
                                    </div>
                                </Form>
                            </DrawerContent>
                        </Drawer>
                    </div>

                    {/* Empty state message */}
                    <div className="flex items-center justify-center min-h-[40vh] ">
                        <div className="text-center">
                            <Heart className="h-8 w-8 text-rose-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-2">{t('discover.noMoreProfiles')}</h2>
                            <p className="text-muted-foreground mb-4">
                                {t('discover.checkBackLater')}
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate(`/customer`, { replace: true })}
                                className="text-sm px-6 py-2 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors"
                            >
                                {t('discover.resetFilters')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const toggleFullscreen = async () => {
        const doc: any = document;
        const docEl: any = document.documentElement;

        if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
            if (docEl.requestFullscreen) {
                await docEl.requestFullscreen();
                setIsFullscreen(true);
                return;
            }
            if (docEl.webkitRequestFullscreen) {
                await docEl.webkitRequestFullscreen();
                setIsFullscreen(true);
                return;
            }
            document.body.style.height = "100vh";
            document.body.style.overflow = "hidden";
            setIsFullscreen(true);
        } else {
            if (doc.exitFullscreen) {
                await doc.exitFullscreen();
                setIsFullscreen(false);
                return;
            }
            if (doc.webkitExitFullscreen) {
                await doc.webkitExitFullscreen();
                setIsFullscreen(false);
                return;
            }

            document.body.style.height = "";
            document.body.style.overflow = "";
            setIsFullscreen(false);
        }
    };

    const handleProfileClick = (id: string) => {
        searchParams.set("profileId", id);
        navigate({ search: searchParams.toString() }, { replace: false });
    };

    if (isSubmitting || isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-2">
                    <Loader className="w-8 h-8 text-rose-500 animate-spin" />
                    {/* <p className="text-rose-600">{isLoading ? t('discover.loadingResults') : t('discover.processing')}</p> */}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 p-0 sm:p-6">
            <div>
                <div className="flex items-start justify-between bg-gray-100 sm:bg-white w-full p-3 sm:px-0">
                    <div className="space-y-1 sm:space-y-2">
                        <h1 className="text-lg sm:text-xl text-rose-500 text-shadow-sm">
                            {t("modelDashboard.title")}
                        </h1>
                        <p className="text-sm text-gray-600">
                            {t("modelDashboard.subtitle")}
                        </p>
                    </div>

                    {/* Filter Button */}
                    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                        <DrawerTrigger className="flex items-center justify-start gap-2 p-2 rounded-md cursor-pointer bg-rose-100 text-rose-500">
                            <SlidersHorizontal className="w-4 h-4" />
                        </DrawerTrigger>
                        <DrawerContent className="space-y-2 sm:space-y-4">
                            <Form
                                method="get"
                                className="flex flex-col h-full"
                                onSubmit={(e) => {
                                    const formData = new FormData(e.currentTarget);
                                    const newParams = new URLSearchParams();

                                    // Add filter values only if they have values
                                    const search = formData.get("search");
                                    const distance = formData.get("distance");
                                    const ageMin = formData.get("ageMin");
                                    const ageMax = formData.get("ageMax");
                                    const rating = formData.get("rating");
                                    const gender = formData.get("gender");
                                    const services = formData.getAll("services");

                                    if (search) newParams.set("search", search.toString());
                                    if (distance) newParams.set("distance", distance.toString());
                                    if (ageMin) newParams.set("ageMin", ageMin.toString());
                                    if (ageMax) newParams.set("ageMax", ageMax.toString());
                                    if (rating) newParams.set("rating", rating.toString());
                                    if (gender) newParams.set("gender", gender.toString());
                                    services.forEach(service => {
                                        if (service) newParams.append("services", service.toString());
                                    });

                                    navigate(`?${newParams.toString()}`, { replace: true });
                                    setDrawerOpen(false);
                                    e.preventDefault();
                                }}
                            >
                                <div className="hidden sm:flex items-center justify-between px-6 py-2 border-b">
                                    <h2 className="text-lg font-bold text-rose-500">{t('discover.filterOptions')}</h2>
                                    <DrawerClose>
                                        <button
                                            type="button"
                                            className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </DrawerClose>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-4 font-sm">
                                    {/* Search */}
                                    <div>
                                        <label className="block text-gray-700 font-medium">{t('discover.searchByName')}</label>
                                        <div className="relative mt-2">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                name="search"
                                                defaultValue={searchParams.get("search") || ""}
                                                placeholder={t('discover.searchPlaceholder')}
                                                className="w-full pl-10 p-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Services Filter */}
                                    <div>
                                        <label className="block text-gray-700 font-medium mb-2">{t('discover.filterByServices')}</label>
                                        <div className="space-y-2">
                                            <label className="flex items-center text-sm">
                                                <input
                                                    type="checkbox"
                                                    name="services"
                                                    value="massage"
                                                    defaultChecked={searchParams.getAll("services").includes("massage")}
                                                    className="mr-2 cursor-pointer accent-rose-500"
                                                />
                                                {t('discover.services.massage')}
                                            </label>
                                            <label className="flex items-center text-sm">
                                                <input
                                                    type="checkbox"
                                                    name="services"
                                                    value="drinkingFriend"
                                                    defaultChecked={searchParams.getAll("services").includes("drinkingFriend")}
                                                    className="mr-2 cursor-pointer accent-rose-500"
                                                />
                                                {t('discover.services.drinkingFriend')}
                                            </label>
                                            <label className="flex items-center text-sm">
                                                <input
                                                    type="checkbox"
                                                    name="services"
                                                    value="travelingPartner"
                                                    defaultChecked={searchParams.getAll("services").includes("travelingPartner")}
                                                    className="mr-2 cursor-pointer accent-rose-500"
                                                />
                                                {t('discover.services.travelingPartner')}
                                            </label>
                                            <label className="flex items-center text-sm">
                                                <input
                                                    type="checkbox"
                                                    name="services"
                                                    value="talkingPartner"
                                                    defaultChecked={searchParams.getAll("services").includes("talkingPartner")}
                                                    className="mr-2 cursor-pointer accent-rose-500"
                                                />
                                                {t('discover.services.talkingPartner')}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Max Distance */}
                                    <div>
                                        <label className="block text-gray-700 font-medium">{t('discover.maxDistance')}</label>
                                        <input
                                            type="number"
                                            name="distance"
                                            min={1}
                                            max={500}
                                            defaultValue={searchParams.get("distance") || ""}
                                            placeholder="50 km"
                                            className="w-full mt-2 p-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                        />
                                    </div>

                                    {/* Age Range */}
                                    <div>
                                        <label className="block text-gray-700 font-medium">{t('discover.ageRange')}</label>
                                        <div className="flex gap-2 mt-2">
                                            <input
                                                type="number"
                                                name="ageMin"
                                                min={18}
                                                max={100}
                                                defaultValue={searchParams.get("ageMin") || ""}
                                                className="w-1/2 p-2 border rounded-md"
                                                placeholder={t('discover.minAge')}
                                            />
                                            <input
                                                type="number"
                                                name="ageMax"
                                                min={18}
                                                max={100}
                                                defaultValue={searchParams.get("ageMax") || ""}
                                                className="w-1/2 p-2 border rounded-md"
                                                placeholder={t('discover.maxAge')}
                                            />
                                        </div>
                                    </div>

                                    {/* Min Rating */}
                                    <div>
                                        <label className="block text-gray-700 font-medium">{t('discover.minRating')}</label>
                                        <select
                                            name="rating"
                                            className="w-full mt-2 p-2 border rounded-md"
                                            defaultValue={searchParams.get("rating") || ""}
                                        >
                                            <option value="">{t('discover.selectRating')}</option>
                                            {[1, 2, 3, 4, 5].map((r) => (
                                                <option key={r} value={r}>{r} <Star className="h-4 w-4" /></option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Gender */}
                                    <div>
                                        <label className="block text-gray-700 font-medium">{t('discover.gender')}</label>
                                        <select
                                            name="gender"
                                            className="w-full mt-2 p-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                            defaultValue={searchParams.get("gender") || ""}
                                        >
                                            <option value="">{t('discover.allGenders')}</option>
                                            <option value="female">{t('discover.female')}</option>
                                            <option value="male">{t('discover.male')}</option>
                                            <option value="other">{t('discover.other')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-6 space-x-3 border-t">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigate(`/customer`, { replace: true });
                                            setDrawerOpen(false);
                                        }}
                                        className="w-full bg-gray-100 text-gray-700 py-2 rounded-md hover:bg-gray-200 transition-colors font-medium"
                                    >
                                        {t('discover.resetFilters')}
                                    </button>

                                    <button type="submit" className="w-full bg-rose-500 text-white py-2 rounded-md hover:bg-rose-600 transition-colors font-medium">
                                        {t('discover.applyFilters')}
                                    </button>
                                </div>
                            </Form>
                        </DrawerContent>
                    </Drawer>
                </div>

                <div
                    ref={scrollContainerRef}
                    className="px-2 sm:px-0 bg-gray-100 sm:bg-white flex items-center justify-start space-x-8 sm:space-x-10 overflow-x-auto overflow-y-hidden whitespace-nowrap mb-2 sm:mb-0 py-2 sm:py-6"
                    style={{
                        msOverflowStyle: 'none',
                        scrollbarWidth: 'none',
                    }}
                >
                    {models.map((data) => (
                        <div
                            key={data.id}
                            ref={(el) => {
                                if (el) modelItemRefs.current.set(data.id, el);
                            }}
                            className="flex-shrink-0 cursor-pointer"
                            onClick={() => handleProfileClick(data.id)}
                        >
                            <div
                                className={`text-center overflow-hidden space-y-3 transition-colors ${selectedProfile?.id === data.id
                                    ? "text-rose-500 border-b-2 border-rose-500 pb-1"
                                    : ""
                                    }`}
                            >
                                <div
                                    className={`border-3 ${selectedProfile?.id === data.id
                                        ? "border-rose-500"
                                        : "border-gray-600"
                                        } rounded-full w-20 h-20 flex items-center justify-center hover:border-rose-500 overflow-hidden`}
                                >
                                    {data?.profile ? (
                                        <img
                                            src={data.profile}
                                            alt="Profile"
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
                                            <User className="w-10 h-10 text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs">{data.firstName}&nbsp;{data.lastName}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedProfile ? (
                    <div className="flex gap-6 p-3 sm:p-0">
                        <div className="bg-gray-800 rounded-lg overflow-hidden w-full sm:w-1/2">
                            <Swiper
                                modules={[Pagination, Navigation]}
                                navigation={{
                                    prevEl: ".custom-prev",
                                    nextEl: ".custom-next",
                                }}
                                pagination={{ clickable: true }}
                                spaceBetween={10}
                                className="w-full h-96 custom-swiper1 border-2 border-rose-500 rounded-lg"
                            >
                                {selectedProfile?.Images?.length ? (
                                    selectedProfile.Images.map((img: IUserImages) => (
                                        <SwiperSlide key={img.id}>
                                            <div className="relative">
                                                <img
                                                    src={img.name}
                                                    alt={`${img.name}`}
                                                    className="w-full h-96 object-cover cursor-pointer"
                                                    onClick={() => navigate(`/customer/user-profile/${selectedProfile.id}`)}
                                                />
                                            </div>

                                            <div className="block sm:hidden absolute bottom-8 left-4 text-white gap-4">
                                                <h3 className="flex items-center justify-start text-md mb-1 text-shadow-lg"><User size={16} />&nbsp;{selectedProfile.firstName}&nbsp;{selectedProfile.lastName}</h3>
                                                <h3 className="flex items-center justify-start text-sm mb-1 text-shadow-lg"><Calendar size={16} />&nbsp;{t('discover.age')} {calculateAgeFromDOB(selectedProfile.dob)} {t('discover.yearsOld')}</h3>
                                                <h3 className="flex items-center justify-start text-sm mb-1 text-shadow-lg"><MapPin size={16} />&nbsp;{t('discover.location')} {formatDistance(calculateDistance(Number(selectedProfile?.latitude), Number(selectedProfile?.longitude), Number(latitude), Number(longitude)))}</h3>
                                            </div>
                                            <Form method="post">
                                                <input type="hidden" name="like" value={selectedProfile.customerAction === "LIKE" ? "true" : "flase"} id="likeInput" />
                                                <input type="hidden" name="pass" value="false" id="passInput" />
                                                <input type="hidden" name="modelId" value={selectedProfile.id} />
                                                <input type="hidden" name="isFriend" value="false" id="isFriend" />

                                                <div className="absolute top-4 right-4 flex sm:hidden space-x-3">
                                                    {selectedProfile?.isContact ?
                                                        <>
                                                            {selectedProfile?.whatsapp && (
                                                                <button
                                                                    type="button"
                                                                    className="cursor-pointer p-2 rounded-full bg-rose-100 text-rose-500 transition-colors"
                                                                    onClick={() => handleWhatsAppClick(selectedProfile.whatsapp)}
                                                                >
                                                                    <MessageSquareText className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                        :
                                                        <button
                                                            type="submit"
                                                            className="cursor-pointer bg-gray-700 text-gray-300 p-2 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"
                                                            onClick={() => {
                                                                (document.getElementById("isFriend") as HTMLInputElement).value = "true";
                                                            }}
                                                        >
                                                            <UserPlus className="w-4 h-4" />
                                                        </button>
                                                    }
                                                    <button
                                                        type="submit"
                                                        className={`${selectedProfile.customerAction === "LIKE" ? "bg-rose-100 text-rose-500" : "bg-gray-700 text-gray-300"} cursor-pointer p-2 rounded-full  hover:text-rose-500 hover:bg-rose-200 transition-colors`}
                                                        onClick={() => {
                                                            (document.getElementById("likeInput") as HTMLInputElement).value = "true";
                                                            (document.getElementById("passInput") as HTMLInputElement).value = "false";
                                                        }}
                                                    >
                                                        <Heart className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="cursor-pointer bg-gray-700 p-2 rounded-full text-white transition-colors"
                                                        onClick={() => {
                                                            (document.getElementById("likeInput") as HTMLInputElement).value = "false";
                                                            (document.getElementById("passInput") as HTMLInputElement).value = "true";
                                                        }}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="absolute bottom-4 right-4 hidden sm:flex space-x-3">
                                                    {selectedProfile.isContact ?
                                                        <>
                                                            {selectedProfile?.whatsapp && (
                                                                <button
                                                                    type="button"
                                                                    className="cursor-pointer p-2 rounded-full bg-rose-100 text-rose-500 transition-colors"
                                                                    onClick={() => handleWhatsAppClick(selectedProfile.whatsapp)}
                                                                >
                                                                    <MessageSquareText className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                        :
                                                        <button
                                                            type="submit"
                                                            className="cursor-pointer bg-gray-700 text-gray-300 p-2 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"
                                                            onClick={() => {
                                                                (document.getElementById("isFriend") as HTMLInputElement).value = "true";
                                                            }}
                                                        >
                                                            <UserPlus className="w-4 h-4" />
                                                        </button>
                                                    }
                                                    <button
                                                        type="submit"
                                                        className={`${selectedProfile.customerAction === "LIKE" ? "bg-rose-100 text-rose-500" : "bg-gray-700 text-gray-300"} cursor-pointer p-2 rounded-full  hover:text-rose-500 hover:bg-rose-200 transition-colors`}
                                                        onClick={() => {
                                                            (document.getElementById("likeInput") as HTMLInputElement).value = "true";
                                                            (document.getElementById("passInput") as HTMLInputElement).value = "false";
                                                        }}
                                                    >
                                                        <Heart className={`w-4 h-4 ${selectedProfile.customerAction === "LIKE" ? "text-rose-500 fill-rose-500" : ""}`} />
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="cursor-pointer bg-gray-700 p-2 rounded-full text-gray-300 hover:text-rose-500 hover:bg-rose-200 transition-colors"
                                                        onClick={() => {
                                                            (document.getElementById("likeInput") as HTMLInputElement).value = "false";
                                                            (document.getElementById("passInput") as HTMLInputElement).value = "true";
                                                        }}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </Form>

                                        </SwiperSlide>
                                    ))
                                ) : (
                                    <SwiperSlide>
                                        {selectedProfile.profile ? (
                                            <div className="relative">
                                                <img
                                                    src={selectedProfile.profile}
                                                    alt={selectedProfile.firstName}
                                                    className="w-full h-96 object-cover cursor-pointer"
                                                    onClick={() => navigate(`/customer/user-profile/${selectedProfile.id}`)}
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="w-full h-96 bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center cursor-pointer"
                                                onClick={() => navigate(`/customer/user-profile/${selectedProfile.id}`)}
                                            >
                                                <User className="w-24 h-24 text-white" />
                                            </div>
                                        )}

                                        <div className="block sm:hidden absolute bottom-8 left-4 text-white gap-4">
                                            <h3 className="flex items-center justify-start text-md mb-1 text-shadow-lg"><User size={16} />&nbsp;{selectedProfile.firstName}&nbsp;{selectedProfile.lastName}</h3>
                                            <h3 className="flex items-center justify-start text-sm mb-1 text-shadow-lg"><Calendar size={16} />&nbsp;{t('discover.age')} {calculateAgeFromDOB(selectedProfile.dob)} {t('discover.yearsOld')}</h3>
                                            <h3 className="flex items-center justify-start text-sm mb-1 text-shadow-lg"><MapPin size={16} />&nbsp;{t('discover.location')} {formatDistance(calculateDistance(Number(selectedProfile?.latitude), Number(selectedProfile?.longitude), Number(latitude), Number(longitude)))}</h3>
                                        </div>
                                        <Form method="post">
                                            <input type="hidden" name="like" value={selectedProfile.customerAction === "LIKE" ? "true" : "flase"} id="likeInput" />
                                            <input type="hidden" name="pass" value="false" id="passInput" />
                                            <input type="hidden" name="modelId" value={selectedProfile.id} />
                                            <input type="hidden" name="isFriend" value="false" id="isFriend" />

                                            <div className="absolute top-4 right-4 flex sm:hidden space-x-3">
                                                {selectedProfile?.isContact ?
                                                    <>
                                                        {selectedProfile?.whatsapp && (
                                                            <button
                                                                type="button"
                                                                className="cursor-pointer p-2 rounded-full bg-rose-100 text-rose-500 transition-colors"
                                                                onClick={() => handleWhatsAppClick(selectedProfile.whatsapp)}
                                                            >
                                                                <MessageSquareText className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </>
                                                    :
                                                    <button
                                                        type="submit"
                                                        className="cursor-pointer bg-gray-700 text-gray-300 p-2 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"
                                                        onClick={() => {
                                                            (document.getElementById("isFriend") as HTMLInputElement).value = "true";
                                                        }}
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                    </button>
                                                }
                                                <button
                                                    type="submit"
                                                    className={`${selectedProfile.customerAction === "LIKE" ? "bg-rose-100 text-rose-500" : "bg-gray-700 text-gray-300"} cursor-pointer p-2 rounded-full  hover:text-rose-500 hover:bg-rose-200 transition-colors`}
                                                    onClick={() => {
                                                        (document.getElementById("likeInput") as HTMLInputElement).value = "true";
                                                        (document.getElementById("passInput") as HTMLInputElement).value = "false";
                                                    }}
                                                >
                                                    <Heart className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="cursor-pointer bg-gray-700 p-2 rounded-full text-white transition-colors"
                                                    onClick={() => {
                                                        (document.getElementById("likeInput") as HTMLInputElement).value = "false";
                                                        (document.getElementById("passInput") as HTMLInputElement).value = "true";
                                                    }}
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="absolute bottom-4 right-4 hidden sm:flex space-x-3">
                                                {selectedProfile.isContact ?
                                                    <>
                                                        {selectedProfile?.whatsapp && (
                                                            <button
                                                                type="button"
                                                                className="cursor-pointer p-2 rounded-full bg-rose-100 text-rose-500 transition-colors"
                                                                onClick={() => handleWhatsAppClick(selectedProfile.whatsapp)}
                                                            >
                                                                <MessageSquareText className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </>
                                                    :
                                                    <button
                                                        type="submit"
                                                        className="cursor-pointer bg-gray-700 text-gray-300 p-2 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"
                                                        onClick={() => {
                                                            (document.getElementById("isFriend") as HTMLInputElement).value = "true";
                                                        }}
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                    </button>
                                                }
                                                <button
                                                    type="submit"
                                                    className={`${selectedProfile.customerAction === "LIKE" ? "bg-rose-100 text-rose-500" : "bg-gray-700 text-gray-300"} cursor-pointer p-2 rounded-full  hover:text-rose-500 hover:bg-rose-200 transition-colors`}
                                                    onClick={() => {
                                                        (document.getElementById("likeInput") as HTMLInputElement).value = "true";
                                                        (document.getElementById("passInput") as HTMLInputElement).value = "false";
                                                    }}
                                                >
                                                    <Heart className={`w-4 h-4 ${selectedProfile.customerAction === "LIKE" ? "text-rose-500 fill-rose-500" : ""}`} />
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="cursor-pointer bg-gray-700 p-2 rounded-full text-gray-300 hover:text-rose-500 hover:bg-rose-200 transition-colors"
                                                    onClick={() => {
                                                        (document.getElementById("likeInput") as HTMLInputElement).value = "false";
                                                        (document.getElementById("passInput") as HTMLInputElement).value = "true";
                                                    }}
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </Form>

                                    </SwiperSlide>
                                )}

                                <button className="custom-prev hidden">
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button className="custom-next hidden">
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </Swiper>
                        </div>

                        <div className="hidden sm:block w-1/2 rounded-2xl p-6 bg-rose-50 space-y-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-md font-bold text-gray-700 uppercase">
                                    {t('discover.about')} - {selectedProfile.firstName}&nbsp;{selectedProfile.lastName}
                                </h2>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-sm mb-1">{t('discover.fullName')}</h3>
                                    <strong className="font-medium">{selectedProfile.firstName}&nbsp;{selectedProfile.lastName}</strong>
                                </div>

                                <div>
                                    <h3 className="text-sm mb-1">{t('register.gender')}:</h3>
                                    <strong className="font-medium">{selectedProfile.gender}</strong>
                                </div>

                                <div>
                                    <h3 className="text-sm mb-1">{t('discover.availableStatus')}</h3>
                                    <strong className="font-medium">{selectedProfile.available_status}</strong>
                                </div>

                                <div>
                                    <h3 className="text-sm mb-1">{t('discover.age')}</h3>
                                    <strong className="font-medium">{calculateAgeFromDOB(selectedProfile.dob.toLocaleDateString())} {t('discover.yearsOld')}</strong>
                                </div>

                                <div>
                                    <h3 className="text-sm mb-1">{t('discover.rating')}</h3>
                                    <div className="flex items-center">
                                        {selectedProfile.rating === 0 ?
                                            <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200 px-3 py-1">
                                                {capitalize(t('discover.noRating'))}
                                            </Badge> : <Rating value={selectedProfile.rating} />}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm mb-1">{t('discover.address')}</h3>
                                    <strong className="font-medium">{selectedProfile.address}</strong>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm mb-1">{t('discover.bio')}</h3>
                                <strong className="font-medium">{selectedProfile.bio}</strong>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-400 text-lg">{t('discover.clickProfile')}</p>
                    </div>
                )}
            </div>

            <div className="flex flex-col items-start justify-start p-4 w-full space-y-4">
                <div className="space-y-2">
                    <h1 className="text-sm sm:text-md sm:font-bold text-gray-700 uppercase text-shadow-md">{t('discover.nearbyYou')}</h1>
                    <p className="text-xs sm:text-sm font-normal text-gray-600">
                        {t('discover.nearbyDescription')}
                    </p>
                </div>

                <div className="hidden sm:block">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                        {nearbyModels?.map((model) => (
                            <div
                                key={model.id}
                                className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden h-auto w-full group"
                            >
                                <Form method="post">
                                    <input type="hidden" name="modelId" value={model.id} />
                                    {model?.isContact ?
                                        <>
                                            {model?.whatsapp && (
                                                <button
                                                    type="button"
                                                    className="absolute top-4 right-4 rounded-lg py-1.5 px-2 bg-rose-100 text-rose-500 shadow-lg transition-all duration-300 cursor-pointer z-10"
                                                    onClick={() => model.whatsapp && handleWhatsAppClick(model.whatsapp)}
                                                >
                                                    <MessageSquareText className="w-4 h-4" />
                                                </button>
                                            )}
                                        </>
                                        :
                                        <button
                                            type="submit"
                                            name="isFriend"
                                            value="true"
                                            className="absolute top-4 right-4 rounded-lg py-1.5 px-2 bg-gray-700 hover:bg-rose-100 text-gray-300 hover:text-rose-500 shadow-lg transition-all duration-300 cursor-pointer z-10"
                                            onClick={() => {
                                                (document.getElementById("isFriend") as HTMLInputElement).value = "true";
                                            }}
                                        >
                                            <UserPlus className="w-4 h-4" />
                                        </button>
                                    }
                                </Form>
                                <div className="relative h-full overflow-hidden">
                                    <div
                                        onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                        className="w-full h-[30vh]"
                                    >
                                        {model.Images[0]?.name ? (
                                            <img
                                                src={model.Images[0].name}
                                                alt={model.firstName}
                                                className="cursor-pointer w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                        ) : model.profile ? (
                                            <img
                                                src={model.profile}
                                                alt={model.firstName}
                                                className="cursor-pointer w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="cursor-pointer w-full h-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center">
                                                <User className="w-16 h-16 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                    <div className="absolute bottom-4 left-4 right-4 text-white sm:opacity-0 sm:group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 space-y-1">
                                        <div className="flex items-start gap-2 justify-start flex-col">
                                            <h2
                                                className="flex items-center justify-start text-md"
                                                style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.8)" }}
                                            >
                                                <User size={16} />&nbsp;{model.firstName}&nbsp;{model.lastName},
                                            </h2>
                                            <p
                                                className="flex items-center justify-start gap-2 text-sm text-white"
                                                style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.8)" }}
                                            >
                                                <Calendar size={16} /> {calculateAgeFromDOB(model.dob)} {t('discover.yearsOld')}
                                            </p>
                                        </div>
                                        <div className="flex items-center text-sm opacity-90 mb-3">
                                            <MapPin className="h-4 w-4 mr-1" />
                                            {formatDistance(calculateDistance(Number(selectedProfile?.latitude), Number(selectedProfile?.longitude), Number(latitude), Number(longitude)))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="block sm:hidden w-full space-y-8">
                    {nearbyModels?.map((model) => (
                        <div key={model.id} className="flex items-start justify-between pb-4 border-b">
                            <div className="flex items-start justify-start gap-2">
                                {model.profile ? (
                                    <img
                                        src={model.profile}
                                        alt="Profile"
                                        className="w-14 h-14 border-1 border-gray-600 rounded-full object-cover cursor-pointer"
                                        onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                    />
                                ) : (
                                    <div
                                        className="w-14 h-14 border-1 border-gray-600 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer"
                                        onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                    >
                                        <User className="w-7 h-7 text-gray-400" />
                                    </div>
                                )}
                                <div className="space-y-0.5 text-gray-500">
                                    <h2
                                        className="flex items-center justify-start text-sm sm:text-md text-black"
                                    >
                                        <User size={14} />&nbsp;{model.firstName}&nbsp;{model.lastName}
                                    </h2>
                                    <div className="flex items-start justify-start gap-2">
                                        <p
                                            className="text-sm flex items-center "
                                        >
                                            <Calendar size={12} />&nbsp; {calculateAgeFromDOB(model.dob)} {t('discover.yearsOld')},
                                        </p>
                                        <div className="flex items-center text-sm opacity-90">
                                            <MapPin className="h-3 w-3 mr-1 text-rose-500" />
                                            {formatDistance(calculateDistance(Number(selectedProfile?.latitude), Number(selectedProfile?.longitude), Number(latitude), Number(longitude)))}

                                        </div>
                                    </div>
                                    <div className="flex items-start justify-start gap-2 mt-4">
                                        {model.Images && model.Images.length > 0 ? (
                                            model.Images.map((image, index) => (
                                                image.name ? (
                                                    <img
                                                        key={image.name + index}
                                                        src={image.name}
                                                        alt="Profile"
                                                        className="w-24 h-24 rounded-2xl object-cover cursor-pointer"
                                                        onClick={() => { setImages(model.Images), setSelectedIndex(index) }}
                                                    />
                                                ) : model.profile ? (
                                                    <img
                                                        key={`profile-${index}`}
                                                        src={model.profile}
                                                        alt="Profile"
                                                        className="w-24 h-24 rounded-2xl object-cover cursor-pointer"
                                                        onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                                    />
                                                ) : (
                                                    <div
                                                        key={`placeholder-${index}`}
                                                        className="w-24 h-24 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center cursor-pointer"
                                                        onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                                    >
                                                        <User className="w-8 h-8 text-white" />
                                                    </div>
                                                )
                                            ))
                                        ) : model.profile ? (
                                            <img
                                                src={model.profile}
                                                alt="Profile"
                                                className="w-24 h-24 rounded-2xl object-cover cursor-pointer"
                                                onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                            />
                                        ) : (
                                            <div
                                                className="w-24 h-24 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center cursor-pointer"
                                                onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                            >
                                                <User className="w-8 h-8 text-white" />
                                            </div>
                                        )}

                                        {selectedIndex !== null && (
                                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
                                                <button
                                                    className="absolute top-4 right-4 text-white"
                                                    onClick={() => setSelectedIndex(null)}
                                                >
                                                    <X size={32} />
                                                </button>

                                                <button
                                                    className="absolute left-4 text-white hidden sm:block"
                                                    onClick={handlePrev}
                                                >
                                                    <ChevronLeft size={40} />
                                                </button>

                                                <img
                                                    src={images[selectedIndex].name}
                                                    alt="Selected"
                                                    className="h-full sm:max-h-[80vh] w-full sm:max-w-[90vw] object-contain rounded-lg shadow-lg"
                                                    onTouchStart={handleTouchStart}
                                                    onTouchMove={handleTouchMove}
                                                    onTouchEnd={handleTouchEnd}
                                                />

                                                <button
                                                    className="absolute right-4 text-white hidden sm:block"
                                                    onClick={handleNext}
                                                >
                                                    <ChevronRight size={40} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Form method="post">
                                <input type="hidden" name="modelId" value={model.id} />
                                <input type="hidden" name="isFriend" value="true" id="isFriend" />
                                {model?.isContact ?
                                    <>
                                        {model?.whatsapp && (
                                            <button
                                                type="button"
                                                className="rounded-lg py-1.5 px-2 bg-rose-100 text-rose-500 shadow-lg transition-all duration-300 cursor-pointer z-10"
                                                onClick={() => model.whatsapp && handleWhatsAppClick(model.whatsapp)}
                                            >
                                                <MessageSquareText className="w-4 h-4" />
                                            </button>
                                        )}
                                    </>
                                    :
                                    <button
                                        type="submit"
                                        name="isFriend"
                                        value="true"
                                        className="rounded-lg py-1.5 px-2 bg-gray-700 hover:bg-rose-100 text-gray-300 hover:text-rose-500 shadow-lg transition-all duration-300 cursor-pointer z-10"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                    </button>
                                }
                            </Form>
                        </div>
                    ))}
                </div>
            </div>

            <button
                onClick={toggleFullscreen}
                className="cursor-pointer fixed bottom-16 right-4 sm:bottom-4 sm:right-4 z-50 p-3 rounded-full bg-rose-500 text-white shadow-lg hover:bg-rose-600 transition"
            >
                {isFullscreen ? (
                    <Minimize className="w-5 h-5" />
                ) : (
                    <Maximize className="w-5 h-5" />
                )}
            </button>
        </div>
    );
}
