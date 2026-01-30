import React from "react";
import type { Route } from "./+types/matches";
import {
    X,
    Loader,
    BadgeCheck,
    SlidersHorizontal,
} from "lucide-react";
import {
    Form,
    redirect,
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
import Pagination from "~/components/ui/pagination";
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
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { SubscriptionModal } from "~/components/subscription/SubscriptionModal";
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
            select: { totalBalance: true },
        }),
    ]);
    const customerLatitude = customer?.latitude || 0;
    const customerLongitude = customer?.longitude || 0;

    // Pagination params
    const page = Number(url.searchParams.get("page") || 1);
    const take = 20;

    const likePage = Number(url.searchParams.get("likeMePage") || 1);
    const likeTake = 20;

    const favPage = Number(url.searchParams.get("favouritePage") || 1);
    const favouriteTake = 20;

    const passedPage = Number(url.searchParams.get("passedPage") || 1);
    const passedTake = 20;

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
            customerBalance: wallet?.totalBalance || 0,
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
            customerBalance: wallet?.totalBalance || 0,
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
            customerBalance: wallet?.totalBalance || 0,
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
            customerBalance: wallet?.totalBalance || 0,
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
        customerBalance: wallet?.totalBalance || 0,
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
    } = loaderData;
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

    // Optimistic UI with useFetcher
    const fetcher = useFetcher<typeof action>();

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
    }, [foryouModels, likeMeModels, myFavouriteModels, myPassModels, fetcher.state]);

    // Handle fetcher response
    React.useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data) {
            const { success, action, modelId } = fetcher.data;
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
            customerAction: model.customerAction,
            isContact: model.isContact,
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
                        <div className="flex items-center justify-between mb-4 px-4">
                            <p className="text-sm sm:text-md font-bold text-gray-700">{t('matches.filter')}</p>
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

                        {isLoading ? (
                            <div className="flex justify-center items-center min-h-[200px]">
                                <Loader className="w-8 h-8 animate-spin text-rose-500" />
                                {/* &nbsp; {t('matches.loading')} */}
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
                                                onLike={() => handleLike(model)}
                                                onPass={() => handlePass(model)}
                                                onAddFriend={() => handleAddFriend(model)}
                                                isFetching={fetcher.state !== "idle"}
                                            />
                                        );
                                    })}
                                </div>
                                {foryouPagination.totalPages > 1 && (
                                    <Pagination
                                        currentPage={foryouPagination.currentPage}
                                        totalPages={foryouPagination.totalPages}
                                        totalCount={foryouPagination.totalCount}
                                        limit={foryouPagination.limit}
                                        hasNextPage={foryouPagination.hasNextPage}
                                        hasPreviousPage={foryouPagination.hasPreviousPage}
                                        baseUrl=""
                                        searchParams={searchParams}
                                    />
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
                                <Loader className="w-8 h-8 animate-spin text-rose-500" />
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
                                                onLike={() => handleLike(model)}
                                                onPass={() => handlePass(model)}
                                                onAddFriend={() => handleAddFriend(model)}
                                                isFetching={fetcher.state !== "idle"}
                                            />
                                        );
                                    })}
                                </div>
                                {likemePagination.totalPages > 1 && (
                                    <Pagination
                                        currentPage={likemePagination.currentPage}
                                        totalPages={likemePagination.totalPages}
                                        totalCount={likemePagination.totalCount}
                                        limit={likemePagination.limit}
                                        hasNextPage={likemePagination.hasNextPage}
                                        hasPreviousPage={likemePagination.hasPreviousPage}
                                        baseUrl=""
                                        searchParams={searchParams}
                                        pageParam="likeMePage"
                                    />
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
                                <Loader className="w-8 h-8 animate-spin text-rose-500" />
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
                                                onLike={() => handleLike(model)}
                                                onPass={() => handlePass(model)}
                                                onAddFriend={() => handleAddFriend(model)}
                                                isFetching={fetcher.state !== "idle"}
                                            />
                                        );
                                    })}
                                </div>
                                {favouritePagination.totalPages > 1 && (
                                    <Pagination
                                        currentPage={favouritePagination.currentPage}
                                        totalPages={favouritePagination.totalPages}
                                        totalCount={favouritePagination.totalCount}
                                        limit={favouritePagination.limit}
                                        hasNextPage={favouritePagination.hasNextPage}
                                        hasPreviousPage={favouritePagination.hasPreviousPage}
                                        baseUrl=""
                                        searchParams={searchParams}
                                        pageParam="favouritePage"
                                    />
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
                                <Loader className="w-8 h-8 animate-spin text-rose-500" />
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
                                                onLike={() => handleLike(model)}
                                                onPass={() => handlePass(model)}
                                                onAddFriend={() => handleAddFriend(model)}
                                                isFetching={fetcher.state !== "idle"}
                                            />
                                        );
                                    })}
                                </div>
                                {passPagination.totalPages > 1 && (
                                    <Pagination
                                        currentPage={passPagination.currentPage}
                                        totalPages={passPagination.totalPages}
                                        totalCount={passPagination.totalCount}
                                        limit={passPagination.limit}
                                        hasNextPage={passPagination.hasNextPage}
                                        hasPreviousPage={passPagination.hasPreviousPage}
                                        baseUrl=""
                                        searchParams={searchParams}
                                        pageParam="passedPage"
                                    />
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
        </div>
    );
}
