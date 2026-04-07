import React from "react";
import type { Route } from "./+types/matches";
import {
    X,
    BadgeCheck,
    SlidersHorizontal,
    Search,
    Loader2,
} from "lucide-react";
import {
    Form,
    useFetcher,
    useActionData,
    useNavigate,
    useNavigation,
    useSearchParams,
    type LoaderFunction,
} from "react-router";
import { useTranslation } from "react-i18next";

// components
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerTrigger,
} from "~/components/ui/drawer";
import ModelCard from "./modelComponent";
import EmptyPage from "~/components/ui/empty";
// Pagination removed — replaced with infinite scroll
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// interface, service and utils
import type { IForYouModelResponse } from "~/interfaces";
import { getUserTokenFromSession, requireUserSession } from "~/services/auths.server";
import {
    getForyouModels,
    getLikeMeModels,
    getModelsByInteraction,
} from "~/services/model.server";
import { capitalize } from "~/utils/functions/textFormat";
import { openWhatsApp } from "~/utils/functions/whatsapp";
import { getChattableModelIds } from "~/services/model.server";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { SubscriptionModal } from "~/components/subscription/SubscriptionModal";
import { ChatAccessModal } from "~/components/ChatAccessModal";
import { useSubscriptionCheck } from "~/hooks/useSubscriptionCheck";

interface LoaderReturn {
    foryouModels: IForYouModelResponse[];
    foryouPagination: PaginationProps;
    likeMeModels: IForYouModelResponse[];
    likemePagination: PaginationProps;
    myFavouriteModels: IForYouModelResponse[];
    favouritePagination: PaginationProps;
    myPassModels: IForYouModelResponse[];
    passPagination: PaginationProps;
    customerLatitude: number;
    customerLongitude: number;
    hasActiveSubscription: boolean;
    hasPendingSubscription: boolean;
    trialPackage: {
        id: string;
        price: number;
    } | null;
    customerBalance: number;
    chattableModelIds: string[];
}

interface ForyouModelsProps {
    loaderData: LoaderReturn;
}

type PaginationProps = {
    currentPage: number
    totalPages: number
    totalCount: number
    limit: number
    hasNextPage: boolean
    hasPreviousPage: boolean
    baseUrl?: string
    searchParams?: URLSearchParams
}


const DEFAULT_PAGINATION: PaginationProps = {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPreviousPage: false,
    baseUrl: "",
    searchParams: new URLSearchParams(),
}

// Loader
export const loader: LoaderFunction = async ({ request }) => {
    const customerId = await requireUserSession(request);
    const { getCustomerProfile } = await import("~/services/profile.server");
    const { hasActiveSubscription, hasPendingSubscription } = await import("~/services/package.server");
    const { prisma } = await import("~/services/database.server");
    const url = new URL(request.url);

    // Get customer's current GPS location from database, subscription status, trial package, and wallet balance
    const [customer, hasSubscription, hasPending, trialPackage, wallet] = await Promise.all([
        getCustomerProfile(customerId),
        hasActiveSubscription(customerId),
        hasPendingSubscription(customerId),
        prisma.subscription_plan.findFirst({
            where: { name: "24-Hour Trial", status: "active" },
            select: { id: true, price: true },
        }),
        prisma.wallet.findFirst({
            where: { customerId },
            select: { totalBalance: true, totalSpend: true, totalRefunded: true },
        }),
    ]);
    const customerLatitude = customer?.latitude || 0;
    const customerLongitude = customer?.longitude || 0;

    // Calculate available balance: totalBalance - totalSpend + totalRefunded
    const customerAvailableBalance = (wallet?.totalBalance || 0) - (wallet?.totalSpend || 0) + (wallet?.totalRefunded || 0);

    // Get chattable model IDs for green chat button
    const chattableSet = hasSubscription ? await getChattableModelIds(customerId) : new Set<string>();
    const chattableModelIds = Array.from(chattableSet);

    // Pagination params
    const page = Number(url.searchParams.get("page") || 1);
    const take = 50;

    const likePage = Number(url.searchParams.get("likeMePage") || 1);
    const likeTake = 50;

    const favPage = Number(url.searchParams.get("favouritePage") || 1);
    const favouriteTake = 50;

    const passedPage = Number(url.searchParams.get("passedPage") || 1);
    const passedTake = 50;

    // Filters
    const filters = {
        maxDistance: url.searchParams.get("distance")
            ? Number(url.searchParams.get("distance"))
            : undefined,
        ageRange:
            url.searchParams.get("ageMin") && url.searchParams.get("ageMax")
                ? ([
                    Number(url.searchParams.get("ageMin")),
                    Number(url.searchParams.get("ageMax")),
                ] as [number, number])
                : undefined,
        minRating: url.searchParams.get("rating")
            ? Number(url.searchParams.get("rating"))
            : undefined,
        gender: url.searchParams.get("gender") || undefined,
        location: url.searchParams.get("location") || undefined,
        relationshipStatus:
            url.searchParams.get("relationshipStatus") || undefined,
        customerLat: url.searchParams.get("lat")
            ? Number(url.searchParams.get("lat"))
            : undefined,
        customerLng: url.searchParams.get("lng")
            ? Number(url.searchParams.get("lng"))
            : undefined,
    };

    // Flags to determine partial loads
    const emptyParams =
        !url.searchParams.has("forYouOnly") &&
        !url.searchParams.has("likeMeOnly") &&
        !url.searchParams.has("favouriteOnly") &&
        !url.searchParams.has("passedOnly");

    const forYouOnly = url.searchParams.has("forYouOnly");
    const likeMeOnly = url.searchParams.has("likeMeOnly");
    const favouriteOnly = url.searchParams.has("favouriteOnly");
    const passedOnly = url.searchParams.has("passedOnly");

    // If requesting ForYou or no specific flag -> load for you
    if (forYouOnly || emptyParams) {
        const { models: foryouModels, pagination } = await getForyouModels(
            customerId,
            {
                ...filters,
                page,
                perPage: take,
            }
        );

        return {
            foryouModels,
            likeMeModels: [],
            myFavouriteModels: [],
            myPassModels: [],
            foryouPagination: pagination,
            likemePagination: DEFAULT_PAGINATION,
            favouritePagination: DEFAULT_PAGINATION,
            passPagination: DEFAULT_PAGINATION,
            customerLatitude,
            customerLongitude,
            hasActiveSubscription: hasSubscription,
            hasPendingSubscription: hasPending,
            trialPackage,
            customerBalance: customerAvailableBalance,
            chattableModelIds,
        } as LoaderReturn;
    }

    if (likeMeOnly) {
        const { models: likeMeModels, pagination: likemePagination } =
            await getLikeMeModels(customerId, likePage, likeTake);

        return {
            foryouModels: [],
            likeMeModels,
            myFavouriteModels: [],
            myPassModels: [],
            foryouPagination: DEFAULT_PAGINATION,
            likemePagination,
            favouritePagination: DEFAULT_PAGINATION,
            passPagination: DEFAULT_PAGINATION,
            customerLatitude,
            customerLongitude,
            hasActiveSubscription: hasSubscription,
            hasPendingSubscription: hasPending,
            trialPackage,
            customerBalance: customerAvailableBalance,
            chattableModelIds,
        } as LoaderReturn;
    }

    if (favouriteOnly) {
        const {
            models: myFavouriteModels,
            pagination: favouritePagination,
        } = await getModelsByInteraction(customerId, "LIKE", favPage, favouriteTake);

        return {
            foryouModels: [],
            likeMeModels: [],
            myFavouriteModels,
            myPassModels: [],
            foryouPagination: DEFAULT_PAGINATION,
            likemePagination: DEFAULT_PAGINATION,
            favouritePagination,
            passPagination: DEFAULT_PAGINATION,
            customerLatitude,
            customerLongitude,
            hasActiveSubscription: hasSubscription,
            hasPendingSubscription: hasPending,
            trialPackage,
            customerBalance: customerAvailableBalance,
            chattableModelIds,
        } as LoaderReturn;
    }

    if (passedOnly) {
        const { models: myPassModels, pagination: passPagination } =
            await getModelsByInteraction(customerId, "PASS", passedPage, passedTake);

        return {
            foryouModels: [],
            likeMeModels: [],
            myFavouriteModels: [],
            myPassModels,
            foryouPagination: DEFAULT_PAGINATION,
            likemePagination: DEFAULT_PAGINATION,
            favouritePagination: DEFAULT_PAGINATION,
            passPagination,
            customerLatitude,
            customerLongitude,
            hasActiveSubscription: hasSubscription,
            hasPendingSubscription: hasPending,
            trialPackage,
            customerBalance: customerAvailableBalance,
            chattableModelIds,
        } as LoaderReturn;
    }

    return {
        foryouModels: [],
        likeMeModels: [],
        myFavouriteModels: [],
        myPassModels: [],
        foryouPagination: DEFAULT_PAGINATION,
        likemePagination: DEFAULT_PAGINATION,
        favouritePagination: DEFAULT_PAGINATION,
        passPagination: DEFAULT_PAGINATION,
        customerLatitude,
        customerLongitude,
        hasActiveSubscription: hasSubscription,
        hasPendingSubscription: hasPending,
        trialPackage,
        customerBalance: customerAvailableBalance,
        chattableModelIds,
    } as LoaderReturn;
};

export async function action({ request }: Route.ActionArgs) {
    if (request.method !== "POST") {
        return {
            success: false,
            error: true,
            message: "Invalid request method",
        };
    }

    const { createCustomerInteraction, customerAddFriend } = await import(
        "~/services/interaction.server"
    );

    const customerId = await requireUserSession(request);
    const token = await getUserTokenFromSession(request);
    const formData = await request.formData();

    const actionType = formData.get("actionType") as string;
    const modelId = formData.get("modelId") as string;

    if (!modelId) {
        return {
            success: false,
            error: true,
            message: "Missing or invalid modelId",
        };
    }

    try {
        if (actionType === "addFriend") {
            const res = await customerAddFriend(customerId, modelId, token);
            return {
                success: res?.success || false,
                action: "addFriend",
                modelId,
                message: res?.success ? "Add friend successfully!" : (res?.message || "Failed to add friend"),
            };
        }

        if (actionType === "like" || actionType === "pass") {
            const interactionAction = actionType === "like" ? "LIKE" : "PASS";
            const res = await createCustomerInteraction(customerId, modelId, interactionAction);

            return {
                success: res?.success || false,
                action: actionType,
                modelId,
                currentAction: interactionAction,
                message: res?.message || (res?.success ? "Interaction success!" : "Failed to create interaction"),
            };
        }

        // Handle tracking actions (fire-and-forget)
        if (actionType === "trackActivity") {
            const trackAction = formData.get("trackAction") as string;
            const { trackSubscriberActivity } = await import("~/services/tracking.server");
            trackSubscriberActivity({
                customerId,
                modelId,
                action: trackAction as any,
                page: "matches",
            });
            return { success: true, action: "trackActivity", modelId };
        }

        return {
            success: false,
            error: true,
            message: "Invalid action type",
        };
    } catch (error: any) {
        console.error("Matches action error:", error);
        return {
            success: false,
            error: true,
            action: actionType,
            modelId,
            message: error?.message || "Something went wrong",
        };
    }
}

// Page
export default function MatchesPage({ loaderData }: ForyouModelsProps) {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {
        foryouModels,
        likeMeModels,
        myFavouriteModels,
        myPassModels,
        foryouPagination,
        likemePagination,
        favouritePagination,
        passPagination,
        customerLatitude,
        customerLongitude,
        hasActiveSubscription,
        hasPendingSubscription,
        trialPackage,
        customerBalance,
        chattableModelIds,
    } = loaderData;
    const chattableSet = new Set(chattableModelIds || []);
    const actionData = useActionData<typeof action>();

    // local UI state
    const [tabValue, setTabValue] = React.useState<"foryou" | "likeme" | "favourite" | "passed">(
        "foryou"
    );
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    // Subscription modal management
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
        showOnMount: false,
    });

    // Chat access modal state
    const [chatModalState, setChatModalState] = React.useState<{ modelId: string; reason: string; whatsappNumber?: number } | null>(null);
    const bookingCheckFetcher = useFetcher();
    const pendingChatRef = React.useRef<{ whatsappNumber: number; modelId: string } | null>(null);

    const handleChatClick = React.useCallback((whatsappNumber: number, modelId: string) => {
        pendingChatRef.current = { whatsappNumber, modelId };
        bookingCheckFetcher.load(`/customer/check-booking?modelId=${modelId}`);
    }, [bookingCheckFetcher]);

    React.useEffect(() => {
        if (bookingCheckFetcher.state === "idle" && bookingCheckFetcher.data && pendingChatRef.current) {
            const { whatsappNumber, modelId } = pendingChatRef.current;
            pendingChatRef.current = null;
            const data = bookingCheckFetcher.data as any;
            if (data.canChat) {
                openWhatsApp(whatsappNumber);
            } else {
                setChatModalState({ modelId, reason: data.reason, whatsappNumber });
            }
        }
    }, [bookingCheckFetcher.state, bookingCheckFetcher.data]);

    // Search state
    const [searchQuery, setSearchQuery] = React.useState("");
    const [searchResults, setSearchResults] = React.useState<IForYouModelResponse[] | null>(null);
    const searchFetcher = useFetcher<{ models: IForYouModelResponse[] }>();
    const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSearching = searchQuery.length >= 2;
    const isSearchLoading = searchFetcher.state === "loading";

    // Infinite scroll state
    const loadMoreFetcher = useFetcher<LoaderReturn>();
    const loadMoreTabRef = React.useRef<"foryou" | "likeme" | "favourite" | "passed">("foryou");
    const processedDataRef = React.useRef<any>(null);
    const sentinelRef = React.useRef<HTMLDivElement>(null);
    const [currentPages, setCurrentPages] = React.useState({
        foryou: 1, likeme: 1, favourite: 1, passed: 1,
    });
    const [hasMore, setHasMore] = React.useState({
        foryou: foryouPagination.hasNextPage,
        likeme: likemePagination.hasNextPage,
        favourite: favouritePagination.hasNextPage,
        passed: passPagination.hasNextPage,
    });

    // Debounced search effect
    React.useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        if (searchQuery.length >= 2) {
            searchTimeoutRef.current = setTimeout(() => {
                searchFetcher.load(`/customer/matches/search?q=${encodeURIComponent(searchQuery)}`);
            }, 300);
        } else {
            setSearchResults(null);
        }
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery]);

    // Handle search results
    React.useEffect(() => {
        if (searchFetcher.state === "idle" && searchFetcher.data) {
            setSearchResults(searchFetcher.data.models || []);
        }
    }, [searchFetcher.state, searchFetcher.data]);

    // Optimistic UI with useFetcher
    const fetcher = useFetcher<typeof action>();
    const trackingFetcher = useFetcher();

    // Track subscriber activity (fire-and-forget)
    const handleTrackActivity = (modelId: string, trackAction: string) => {
        const formData = new FormData();
        formData.append("actionType", "trackActivity");
        formData.append("trackAction", trackAction);
        formData.append("modelId", modelId);
        trackingFetcher.submit(formData, { method: "post" });
    };

    const [optimisticInteractions, setOptimisticInteractions] = React.useState<{
        [modelId: string]: {
            action: "LIKE" | "PASS" | null;
            isFriend: boolean;
        };
    }>({});

    // Cache models to prevent reload
    const [cachedForyou, setCachedForyou] = React.useState(foryouModels);
    const [cachedLikeMe, setCachedLikeMe] = React.useState(likeMeModels);
    const [cachedFavourite, setCachedFavourite] = React.useState(myFavouriteModels);
    const [cachedPassed, setCachedPassed] = React.useState(myPassModels);

    // Update cached models only when loader data changes (not from fetcher)
    React.useEffect(() => {
        if (fetcher.state === "loading") return;
        setCachedForyou(foryouModels);
        setCachedLikeMe(likeMeModels);
        setCachedFavourite(myFavouriteModels);
        setCachedPassed(myPassModels);
        // Reset infinite scroll state when loader data changes (tab switch / filter)
        setCurrentPages({
            foryou: foryouPagination.currentPage,
            likeme: likemePagination.currentPage,
            favourite: favouritePagination.currentPage,
            passed: passPagination.currentPage,
        });
        setHasMore({
            foryou: foryouPagination.hasNextPage,
            likeme: likemePagination.hasNextPage,
            favourite: favouritePagination.hasNextPage,
            passed: passPagination.hasNextPage,
        });
        processedDataRef.current = null;
    }, [foryouModels, likeMeModels, myFavouriteModels, myPassModels, fetcher.state]);

    // Load more function for infinite scroll
    const loadMore = React.useCallback(() => {
        if (loadMoreFetcher.state !== "idle" || !hasMore[tabValue]) return;

        loadMoreTabRef.current = tabValue;
        const nextPage = currentPages[tabValue] + 1;
        const params = new URLSearchParams(searchParams);

        switch (tabValue) {
            case "foryou": params.set("page", String(nextPage)); break;
            case "likeme": params.set("likeMePage", String(nextPage)); break;
            case "favourite": params.set("favouritePage", String(nextPage)); break;
            case "passed": params.set("passedPage", String(nextPage)); break;
        }

        loadMoreFetcher.load(`/customer/matches?${params.toString()}`);
    }, [tabValue, currentPages, hasMore, searchParams, loadMoreFetcher]);

    // Handle load more results — append to cached arrays
    React.useEffect(() => {
        if (loadMoreFetcher.state !== "idle" || !loadMoreFetcher.data || loadMoreFetcher.data === processedDataRef.current) return;
        processedDataRef.current = loadMoreFetcher.data;
        const data = loadMoreFetcher.data as LoaderReturn;
        const tab = loadMoreTabRef.current;

        const dedup = (prev: IForYouModelResponse[], next: IForYouModelResponse[]) => {
            const ids = new Set(prev.map(m => m.id));
            return [...prev, ...next.filter(m => !ids.has(m.id))];
        };

        if (tab === "foryou") {
            setCachedForyou(prev => dedup(prev, data.foryouModels));
            setCurrentPages(prev => ({ ...prev, foryou: data.foryouPagination.currentPage }));
            setHasMore(prev => ({ ...prev, foryou: data.foryouPagination.hasNextPage }));
        } else if (tab === "likeme") {
            setCachedLikeMe(prev => dedup(prev, data.likeMeModels));
            setCurrentPages(prev => ({ ...prev, likeme: data.likemePagination.currentPage }));
            setHasMore(prev => ({ ...prev, likeme: data.likemePagination.hasNextPage }));
        } else if (tab === "favourite") {
            setCachedFavourite(prev => dedup(prev, data.myFavouriteModels));
            setCurrentPages(prev => ({ ...prev, favourite: data.favouritePagination.currentPage }));
            setHasMore(prev => ({ ...prev, favourite: data.favouritePagination.hasNextPage }));
        } else if (tab === "passed") {
            setCachedPassed(prev => dedup(prev, data.myPassModels));
            setCurrentPages(prev => ({ ...prev, passed: data.passPagination.currentPage }));
            setHasMore(prev => ({ ...prev, passed: data.passPagination.hasNextPage }));
        }
    }, [loadMoreFetcher.state, loadMoreFetcher.data]);

    // IntersectionObserver — auto-load when sentinel scrolls into view
    React.useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadMore();
            },
            { rootMargin: "200px" }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [loadMore]);

    // Handle fetcher response
    React.useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data) {
            const { success, action, modelId } = fetcher.data;
            if (!modelId) return;
            const optimisticState = optimisticInteractions[modelId];

            if (success && optimisticState) {
                // Update all cached model lists
                const updateModel = (model: IForYouModelResponse) => {
                    if (model.id === modelId) {
                        if (action === "like" || action === "pass") {
                            return { ...model, customerAction: optimisticState.action };
                        } else if (action === "addFriend") {
                            return { ...model, isContact: optimisticState.isFriend };
                        }
                    }
                    return model;
                };

                setCachedForyou(prev => prev.map(updateModel));
                setCachedLikeMe(prev => prev.map(updateModel));
                setCachedFavourite(prev => prev.map(updateModel));
                setCachedPassed(prev => prev.map(updateModel));

                // Remove optimistic state
                setOptimisticInteractions(prev => {
                    const updated = { ...prev };
                    delete updated[modelId];
                    return updated;
                });
            } else if (!success) {
                // Revert optimistic state on error
                setOptimisticInteractions(prev => {
                    const updated = { ...prev };
                    delete updated[modelId];
                    return updated;
                });
            }
        }
    }, [fetcher.state, fetcher.data]);

    // Helper to get display state (optimistic or real)
    const getModelState = (model: IForYouModelResponse) => {
        const optimistic = optimisticInteractions[model.id];
        if (optimistic) {
            return {
                customerAction: optimistic.action,
                isContact: optimistic.isFriend,
            };
        }
        return {
            customerAction: model.customerAction ?? null,
            isContact: model.isContact ?? false,
        };
    };

    // Event handlers
    const handleLike = (model: IForYouModelResponse) => {
        const currentAction = getModelState(model).customerAction;
        const newAction = currentAction === "LIKE" ? null : "LIKE";

        setOptimisticInteractions(prev => ({
            ...prev,
            [model.id]: {
                action: newAction,
                isFriend: model.isContact || false,
            },
        }));

        const formData = new FormData();
        formData.append("actionType", "like");
        formData.append("modelId", model.id);
        fetcher.submit(formData, { method: "post" });
    };

    const handlePass = (model: IForYouModelResponse) => {
        setOptimisticInteractions(prev => ({
            ...prev,
            [model.id]: {
                action: "PASS",
                isFriend: model.isContact || false,
            },
        }));

        const formData = new FormData();
        formData.append("actionType", "pass");
        formData.append("modelId", model.id);
        fetcher.submit(formData, { method: "post" });
    };

    const handleAddFriend = (model: IForYouModelResponse) => {
        if (model.isContact) return;

        setOptimisticInteractions(prev => ({
            ...prev,
            [model.id]: {
                action: model.customerAction as "LIKE" | "PASS" | null,
                isFriend: true,
            },
        }));

        const formData = new FormData();
        formData.append("actionType", "addFriend");
        formData.append("modelId", model.id);
        fetcher.submit(formData, { method: "post" });
    };

    const isLoading = navigation.state === "loading";

    // Alert visibility control (auto-hide after 5s)
    const [showAlert, setShowAlert] = React.useState<boolean>(Boolean(actionData));

    React.useEffect(() => {
        // Sync tab with search params when route changes / on mount
        if (searchParams.has("likeMeOnly")) setTabValue("likeme");
        else if (searchParams.has("favouriteOnly")) setTabValue("favourite");
        else if (searchParams.has("passedOnly")) setTabValue("passed");
        else setTabValue("foryou");
    }, [searchParams]);

    React.useEffect(() => {
        // When actionData arrives, show the alert for 5 seconds then hide it.
        if (actionData) {
            setShowAlert(true);
            const timer = setTimeout(() => {
                setShowAlert(false);
            }, 5000);

            return () => clearTimeout(timer);
        } else {
            setShowAlert(false);
        }
    }, [actionData]);

    // For toast messages (url based)
    const toastMessage = searchParams.get("toastMessage");
    const toastType = searchParams.get("toastType");
    const showToast = (message: string, type: "success" | "error" | "warning" = "success", duration = 3000) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("toastMessage", message);
        newParams.set("toastType", type);
        newParams.set("toastDuration", String(duration));
        navigate({ search: newParams.toString() }, { replace: true });
    };
    React.useEffect(() => {
        if (toastMessage) {
            showToast(toastMessage, toastType as any);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toastMessage, toastType]);

    // Ensure there's always a tab flag in the URL (initial load)
    React.useEffect(() => {
        const hasTabFlag =
            searchParams.has("forYouOnly") ||
            searchParams.has("likeMeOnly") ||
            searchParams.has("favouriteOnly") ||
            searchParams.has("passedOnly");

        if (!hasTabFlag) {
            const newParams = new URLSearchParams(searchParams);
            newParams.set("forYouOnly", "true");
            navigate(`?${newParams.toString()}`, { replace: true });
        }
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen relative">
            <div className="space-y-6 p-2 sm:p-4">
                <Tabs
                    value={tabValue}
                    onValueChange={(val) => {
                        // Keep local tab state for immediate UI responsiveness
                        setTabValue(val as any);
                        const newParams = new URLSearchParams();

                        if (val === "foryou") {
                            newParams.set("forYouOnly", "true");
                            newParams.set("page", "1");
                        }
                        if (val === "likeme") {
                            newParams.set("likeMeOnly", "true");
                            newParams.set("likeMePage", "1");
                        }
                        if (val === "favourite") {
                            newParams.set("favouriteOnly", "true");
                            newParams.set("favouritePage", "1");
                        }
                        if (val === "passed") {
                            newParams.set("passedOnly", "true");
                            newParams.set("passedPage", "1");
                        }

                        // Navigate with replace so browser history isn't filled when switching tabs
                        navigate(`?${newParams.toString()}`, { replace: true });
                    }}
                    className="w-full space-y-2"
                >
                    <TabsList className="w-full">
                        <TabsTrigger value="foryou" className="cursor-pointer uppercase text-xs sm:text-sm">
                            {t('matches.forYou')}
                        </TabsTrigger>
                        <TabsTrigger value="likeme" className="cursor-pointer uppercase text-xs sm:text-sm">
                            {t('matches.likeMe')}
                        </TabsTrigger>
                        <TabsTrigger value="favourite" className="cursor-pointer uppercase text-xs sm:text-sm">
                            {t('matches.favourite')}
                        </TabsTrigger>
                        <TabsTrigger value="passed" className="cursor-pointer uppercase text-xs sm:text-sm">
                            {t('matches.passed')}
                        </TabsTrigger>
                    </TabsList>

                    {/* Server action alerts (auto-hide) */}
                    {actionData && showAlert && actionData?.success && (
                        <Alert variant="default" className="border-green-300 text-green-500 bg-green-50">
                            <BadgeCheck className="text-green-600" />
                            <AlertTitle className="text-md">{t('matches.success')}</AlertTitle>
                            <AlertDescription className="text-green-500">
                                {actionData.message}
                            </AlertDescription>
                        </Alert>
                    )}

                    {actionData && showAlert && actionData?.error && (
                        <Alert variant="destructive">
                            <X size={22} />
                            <AlertTitle className="text-md">{t('matches.error')}</AlertTitle>
                            <AlertDescription>
                                {capitalize(actionData.message)}
                            </AlertDescription>
                        </Alert>
                    )}

                    <TabsContent value="foryou">
                        <div className="flex items-center justify-end gap-2 sticky top-[48px] sm:top-0 z-20 bg-white pt-6 sm:pt-3 pb-2 -mx-2 px-2 sm:-mx-4 sm:px-4">
                            <div className="w-full sm:w-2/5 relative items-center justify-end">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('discover.searchPlaceholder')}
                                    className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setSearchResults(null);
                                        }}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100"
                                    >
                                        <X className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                )}
                            </div>
                            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                                <DrawerTrigger className="flex items-center justify-start gap-2 p-2 rounded-md cursor-pointer bg-rose-100 text-rose-500">
                                    <SlidersHorizontal className="w-4 h-4" />
                                </DrawerTrigger>
                                <DrawerContent className="space-y-2 sm:space-y-4">
                                    <Form
                                        method="get"
                                        className="flex flex-col h-full"
                                        onSubmit={(e) => {
                                            // Get form data
                                            const formData = new FormData(e.currentTarget);
                                            const newParams = new URLSearchParams();

                                            // Preserve the current tab
                                            newParams.set("forYouOnly", "true");
                                            newParams.set("page", "1");

                                            // Add filter values only if they have values
                                            const distance = formData.get("distance");
                                            const ageMin = formData.get("ageMin");
                                            const ageMax = formData.get("ageMax");
                                            const rating = formData.get("rating");
                                            const gender = formData.get("gender");
                                            const location = formData.get("location");
                                            const relationshipStatus = formData.get("relationshipStatus");

                                            if (distance) newParams.set("distance", distance.toString());
                                            if (ageMin) newParams.set("ageMin", ageMin.toString());
                                            if (ageMax) newParams.set("ageMax", ageMax.toString());
                                            if (rating) newParams.set("rating", rating.toString());
                                            if (gender) newParams.set("gender", gender.toString());
                                            if (location) newParams.set("location", location.toString());
                                            if (relationshipStatus) newParams.set("relationshipStatus", relationshipStatus.toString());

                                            // Navigate with new params
                                            navigate(`?${newParams.toString()}`, { replace: true });
                                            setDrawerOpen(false);
                                            e.preventDefault();
                                        }}
                                    >
                                        <div className="hidden sm:flex items-center justify-between px-6 py-2 border-b">
                                            <h2 className="text-lg font-bold text-rose-500">{t('matches.filterOptions')}</h2>
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
                                            <div>
                                                <label className="block text-gray-700 font-medium">{t('matches.maxDistance')}</label>
                                                <input
                                                    type="number"
                                                    name="distance"
                                                    min={1}
                                                    max={500}
                                                    defaultValue={searchParams.get("distance") || ""}
                                                    placeholder="10 km"
                                                    className="w-full mt-2 p-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-gray-700 font-medium">{t('matches.ageRange')}</label>
                                                <div className="flex gap-2 mt-2">
                                                    <input
                                                        type="number"
                                                        name="ageMin"
                                                        min={2}
                                                        max={100}
                                                        defaultValue={searchParams.get("ageMin") || ""}
                                                        className="w-1/2 p-2 border rounded-md"
                                                        placeholder="Age...."
                                                    />
                                                    <input
                                                        type="number"
                                                        name="ageMax"
                                                        min={2}
                                                        max={100}
                                                        defaultValue={searchParams.get("ageMax") || ""}
                                                        className="w-1/2 p-2 border rounded-md"
                                                        placeholder="Age...."
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-gray-700 font-medium">{t('matches.minRating')}</label>
                                                <select
                                                    name="rating"
                                                    className="w-full mt-2 p-2 border rounded-md"
                                                    defaultValue={searchParams.get("rating") || ""}
                                                >
                                                    <option value="">{t('matches.selectRating')}</option>
                                                    {[1, 2, 3, 4, 5].map((r) => (
                                                        <option key={r} value={r}>{r}+</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-gray-700 font-medium">{t('matches.gender')}</label>
                                                <select
                                                    name="gender"
                                                    className="w-full mt-2 p-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                                    defaultValue={searchParams.get("gender") || ""}
                                                >
                                                    <option value="">{t('matches.all')}</option>
                                                    <option value="female">{t('matches.female')}</option>
                                                    <option value="male">{t('matches.male')}</option>
                                                    <option value="other">{t('matches.other')}</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-gray-700 font-medium">{t('matches.location')}</label>
                                                <select
                                                    name="location"
                                                    className="w-full mt-2 p-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                                    defaultValue={searchParams.get("location") || ""}
                                                >
                                                    <option value="">{t('matches.anyLocation')}</option>
                                                    <option value="Turkey">Turkey</option>
                                                    <option value="Spain">Spain</option>
                                                    <option value="France">France</option>
                                                    <option value="USA">USA</option>
                                                    <option value="UK">UK</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-gray-700 font-medium">{t('matches.relationshipStatus')}</label>
                                                <div className="space-y-1 mt-2">
                                                    <label className="flex items-center text-sm">
                                                        <input
                                                            type="radio"
                                                            name="relationshipStatus"
                                                            value="Single"
                                                            defaultChecked={searchParams.get("relationshipStatus") === "Single"}
                                                            className="mr-2 cursor-pointer text-rose-500"
                                                        />
                                                        {t('matches.single')}
                                                    </label>
                                                    <label className="flex items-center text-sm">
                                                        <input
                                                            type="radio"
                                                            name="relationshipStatus"
                                                            value="Divorced"
                                                            defaultChecked={searchParams.get("relationshipStatus") === "Divorced"}
                                                            className="mr-2 cursor-pointer text-rose-500"
                                                        />
                                                        {t('matches.divorced')}
                                                    </label>
                                                    <label className="flex items-center text-sm">
                                                        <input
                                                            type="radio"
                                                            name="relationshipStatus"
                                                            value="Widowed"
                                                            defaultChecked={searchParams.get("relationshipStatus") === "Widowed"}
                                                            className="mr-2 cursor-pointer text-rose-500"
                                                        />
                                                        {t('matches.widowed')}
                                                    </label>
                                                    <label className="flex items-center text-sm">
                                                        <input
                                                            type="radio"
                                                            name="relationshipStatus"
                                                            value="Separated"
                                                            defaultChecked={searchParams.get("relationshipStatus") === "Separated"}
                                                            className="mr-2 cursor-pointer text-rose-500"
                                                        />
                                                        {t('matches.separated')}
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-6 space-x-3 border-t">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    // Clear all filters and keep only the tab
                                                    const newParams = new URLSearchParams();
                                                    newParams.set("forYouOnly", "true");
                                                    newParams.set("page", "1");
                                                    navigate(`?${newParams.toString()}`, { replace: true });
                                                    setDrawerOpen(false);
                                                }}
                                                className="w-full bg-gray-100 text-gray-700 py-2 rounded-md hover:bg-gray-200 transition-colors font-medium"
                                            >
                                                {t('matches.resetFilters')}
                                            </button>

                                            <button type="submit" className="w-full bg-rose-500 text-white py-2 rounded-md hover:bg-rose-600 transition-colors font-medium">
                                                {t('matches.applyFilters')}
                                            </button>
                                        </div>
                                    </Form>
                                </DrawerContent>
                            </Drawer>
                        </div>

                        {/* Search Results */}
                        {isSearching ? (
                            <div className="px-2">
                                <p className="text-xs text-gray-500 mb-3">
                                    {t('discover.searchResultsFor', { defaultValue: 'Results for' })}: "<span className="font-semibold text-gray-700">{searchQuery}</span>"
                                </p>
                                {isSearchLoading ? (
                                    <div className="flex justify-center items-center min-h-[200px]">
                                        <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : searchResults && searchResults.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4">
                                        {searchResults.map((model) => {
                                            const displayState = getModelState(model);
                                            return (
                                                <ModelCard
                                                    key={model.id}
                                                    model={model}
                                                    displayState={displayState}
                                                    customerLatitude={customerLatitude}
                                                    customerLongitude={customerLongitude}
                                                    hasActiveSubscription={hasActiveSubscription}
                                                    onOpenSubscriptionModal={openSubscriptionModal}
                                                    onChatClick={handleChatClick}
                                                    canChat={chattableSet.has(model.id)}
                                                    onLike={() => handleLike(model)}
                                                    onPass={() => handlePass(model)}
                                                    onAddFriend={() => handleAddFriend(model)}
                                                    onTrackActivity={handleTrackActivity}
                                                    isFetching={fetcher.state !== "idle"}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                        <Search className="w-10 h-10 mb-3" />
                                        <p className="text-sm font-medium">{t('matches.notFound')}</p>
                                        <p className="text-xs mt-1">{t('matches.noResults')}</p>
                                    </div>
                                )}
                            </div>
                        ) : isLoading ? (
                            <div className="flex justify-center items-center min-h-[200px]">
                                <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                            </div>
                        ) : cachedForyou.length > 0 ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4 px-2">
                                    {cachedForyou.map((model) => {
                                        const displayState = getModelState(model);
                                        return (
                                            <ModelCard
                                                key={model.id}
                                                model={model}
                                                displayState={displayState}
                                                customerLatitude={customerLatitude}
                                                customerLongitude={customerLongitude}
                                                hasActiveSubscription={hasActiveSubscription}
                                                onOpenSubscriptionModal={openSubscriptionModal}
                                                onChatClick={handleChatClick}
                                                onLike={() => handleLike(model)}
                                                onPass={() => handlePass(model)}
                                                onAddFriend={() => handleAddFriend(model)}
                                                onTrackActivity={handleTrackActivity}
                                                isFetching={fetcher.state !== "idle"}
                                            />
                                        );
                                    })}
                                </div>
                                {hasMore.foryou && (
                                    <div ref={sentinelRef} className="flex justify-center py-6">
                                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <EmptyPage
                                title={t('matches.notFound')}
                                description={t('matches.noResults')}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="likeme">
                        {isLoading ? (
                            <div className="flex justify-center items-center min-h-[200px]">
                                <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                                {/* &nbsp; {t('matches.loading')} */}
                            </div>
                        ) : cachedLikeMe.length > 0 ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {cachedLikeMe.map((model) => {
                                        const displayState = getModelState(model);
                                        return (
                                            <ModelCard
                                                key={model.id}
                                                model={model}
                                                displayState={displayState}
                                                customerLatitude={customerLatitude}
                                                customerLongitude={customerLongitude}
                                                hasActiveSubscription={hasActiveSubscription}
                                                onOpenSubscriptionModal={openSubscriptionModal}
                                                onChatClick={handleChatClick}
                                                onLike={() => handleLike(model)}
                                                onPass={() => handlePass(model)}
                                                onAddFriend={() => handleAddFriend(model)}
                                                onTrackActivity={handleTrackActivity}
                                                isFetching={fetcher.state !== "idle"}
                                            />
                                        );
                                    })}
                                </div>
                                {hasMore.likeme && (
                                    <div ref={sentinelRef} className="flex justify-center py-6">
                                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <EmptyPage
                                title={t('matches.notFound')}
                                description={t('matches.noResults')}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="favourite">
                        {isLoading ? (
                            <div className="flex justify-center items-center min-h-[200px]">
                                <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                                {/* &nbsp; {t('matches.loading')} */}
                            </div>
                        ) : cachedFavourite.length > 0 ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {cachedFavourite.map((model) => {
                                        const displayState = getModelState(model);
                                        return (
                                            <ModelCard
                                                key={model.id}
                                                model={model}
                                                displayState={displayState}
                                                customerLatitude={customerLatitude}
                                                customerLongitude={customerLongitude}
                                                hasActiveSubscription={hasActiveSubscription}
                                                onOpenSubscriptionModal={openSubscriptionModal}
                                                onChatClick={handleChatClick}
                                                onLike={() => handleLike(model)}
                                                onPass={() => handlePass(model)}
                                                onAddFriend={() => handleAddFriend(model)}
                                                onTrackActivity={handleTrackActivity}
                                                isFetching={fetcher.state !== "idle"}
                                            />
                                        );
                                    })}
                                </div>
                                {hasMore.favourite && (
                                    <div ref={sentinelRef} className="flex justify-center py-6">
                                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <EmptyPage
                                title={t('matches.notFound')}
                                description={t('matches.noResults')}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="passed">
                        {isLoading ? (
                            <div className="flex justify-center items-center min-h-[200px]">
                                <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                                {/* &nbsp; {t('matches.loading')} */}
                            </div>
                        ) : cachedPassed.length > 0 ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {cachedPassed.map((model) => {
                                        const displayState = getModelState(model);
                                        return (
                                            <ModelCard
                                                key={model.id}
                                                model={model}
                                                displayState={displayState}
                                                customerLatitude={customerLatitude}
                                                customerLongitude={customerLongitude}
                                                hasActiveSubscription={hasActiveSubscription}
                                                onOpenSubscriptionModal={openSubscriptionModal}
                                                onChatClick={handleChatClick}
                                                onLike={() => handleLike(model)}
                                                onPass={() => handlePass(model)}
                                                onAddFriend={() => handleAddFriend(model)}
                                                onTrackActivity={handleTrackActivity}
                                                isFetching={fetcher.state !== "idle"}
                                            />
                                        );
                                    })}
                                </div>
                                {hasMore.passed && (
                                    <div ref={sentinelRef} className="flex justify-center py-6">
                                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <EmptyPage
                                title={t('matches.notFound')}
                                description={t('matches.noResultsFound')}
                            />
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Subscription Trial Modal */}
            {trialPackage && (
                <SubscriptionModal
                    isOpen={showSubscriptionModal}
                    onClose={closeSubscriptionModal}
                    customerBalance={customerBalance}
                    trialPrice={trialPackage.price}
                    trialPlanId={trialPackage.id}
                    onSubscribe={handleSubscribe}
                />
            )}

            {/* Chat Access Modal */}
            <ChatAccessModal
                isOpen={!!chatModalState}
                onClose={() => setChatModalState(null)}
                modelId={chatModalState?.modelId || ""}
                reason={chatModalState?.reason || ""}
                whatsappNumber={chatModalState?.whatsappNumber}
                onGiftSent={() => {
                    setChatModalState(null);
                    if (pendingChatRef.current) {
                        const { modelId } = pendingChatRef.current;
                        bookingCheckFetcher.load(`/customer/check-booking?modelId=${modelId}`);
                    }
                }}
            />
        </div>
    );
}
