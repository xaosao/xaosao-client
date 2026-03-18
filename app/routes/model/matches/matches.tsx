import React from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
    X,
    Loader,
    BadgeCheck,
    SlidersHorizontal,
} from "lucide-react";
import {
    Form,
    redirect,
    useActionData,
    useFetcher,
    useLoaderData,
    useNavigate,
    useNavigation,
    useSearchParams,
} from "react-router";
import { useTranslation } from "react-i18next";

// components
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerTrigger,
} from "~/components/ui/drawer";
import CustomerCard from "./customerComponent";
import EmptyPage from "~/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// services
import { requireModelSession, getModelTokenFromSession } from "~/services/model-auth.server";
import {
    getForYouCustomers,
    getCustomersWhoLikedMe,
    getCustomersByModelInteraction,
    createModelInteraction,
    getModelDashboardData,
} from "~/services/model.server";
import { modelAddFriend } from "~/services/interaction.server";
import { capitalize } from "~/utils/functions/textFormat";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

interface LoaderReturn {
    foryouCustomers: any[];
    foryouPagination: PaginationProps;
    likeMeCustomers: any[];
    likemePagination: PaginationProps;
    myFavouriteCustomers: any[];
    favouritePagination: PaginationProps;
    myPassCustomers: any[];
    passPagination: PaginationProps;
    modelLatitude: number;
    modelLongitude: number;
    modelName: string;
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
export async function loader({ request }: LoaderFunctionArgs) {
    const modelId = await requireModelSession(request);
    const url = new URL(request.url);

    // Get model's current GPS location from database
    const model = await getModelDashboardData(modelId);
    const modelLatitude = model?.latitude || 0;
    const modelLongitude = model?.longitude || 0;
    const modelName = `${model?.firstName || ''} ${model?.lastName || ''}`.trim();

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
        // Use model's GPS coordinates from database for distance filtering
        modelLat: modelLatitude || undefined,
        modelLng: modelLongitude || undefined,
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
        const { customers: foryouCustomers, pagination } = await getForYouCustomers(
            modelId,
            {
                ...filters,
                page,
                perPage: take,
            }
        );

        return {
            foryouCustomers,
            likeMeCustomers: [],
            myFavouriteCustomers: [],
            myPassCustomers: [],
            foryouPagination: pagination,
            likemePagination: DEFAULT_PAGINATION,
            favouritePagination: DEFAULT_PAGINATION,
            passPagination: DEFAULT_PAGINATION,
            modelLatitude,
            modelLongitude,
            modelName,
        };
    }

    if (likeMeOnly) {
        const { customers: likeMeCustomers, pagination: likemePagination } =
            await getCustomersWhoLikedMe(modelId, likePage, likeTake);

        return {
            foryouCustomers: [],
            likeMeCustomers,
            myFavouriteCustomers: [],
            myPassCustomers: [],
            foryouPagination: DEFAULT_PAGINATION,
            likemePagination,
            favouritePagination: DEFAULT_PAGINATION,
            passPagination: DEFAULT_PAGINATION,
            modelLatitude,
            modelLongitude,
            modelName,
        };
    }

    if (favouriteOnly) {
        const {
            customers: myFavouriteCustomers,
            pagination: favouritePagination,
        } = await getCustomersByModelInteraction(modelId, "LIKE", favPage, favouriteTake);

        return {
            foryouCustomers: [],
            likeMeCustomers: [],
            myFavouriteCustomers,
            myPassCustomers: [],
            foryouPagination: DEFAULT_PAGINATION,
            likemePagination: DEFAULT_PAGINATION,
            favouritePagination,
            passPagination: DEFAULT_PAGINATION,
            modelLatitude,
            modelLongitude,
            modelName,
        };
    }

    if (passedOnly) {
        const { customers: myPassCustomers, pagination: passPagination } =
            await getCustomersByModelInteraction(modelId, "PASS", passedPage, passedTake);

        return {
            foryouCustomers: [],
            likeMeCustomers: [],
            myFavouriteCustomers: [],
            myPassCustomers,
            foryouPagination: DEFAULT_PAGINATION,
            likemePagination: DEFAULT_PAGINATION,
            favouritePagination: DEFAULT_PAGINATION,
            passPagination,
            modelLatitude,
            modelLongitude,
            modelName,
        };
    }

    return {
        foryouCustomers: [],
        likeMeCustomers: [],
        myFavouriteCustomers: [],
        myPassCustomers: [],
        foryouPagination: DEFAULT_PAGINATION,
        likemePagination: DEFAULT_PAGINATION,
        favouritePagination: DEFAULT_PAGINATION,
        passPagination: DEFAULT_PAGINATION,
        modelLatitude,
        modelLongitude,
    };
}

export async function action({ request }: ActionFunctionArgs) {
    const modelId = await requireModelSession(request);
    const formData = await request.formData();
    const like = formData.get("like");
    const pass = formData.get("pass");
    const customerIdEntry = formData.get("customerId");
    const addFriend = formData.get("isFriend") === "true";
    const token = await getModelTokenFromSession(request);

    if (!customerIdEntry || typeof customerIdEntry !== "string") {
        return {
            success: false,
            error: true,
            message: "Missing or invalid customerId",
        };
    }
    const customerId = customerIdEntry;

    if (request.method === "POST") {
        if (addFriend === true) {
            try {
                const res = await modelAddFriend(modelId, customerId, token);
                if (res?.success) {
                    return redirect(`/model/matches?toastMessage=Add+friend+successfully!&toastType=success`);
                }
            } catch (error: any) {
                return redirect(`/model/matches?toastMessage=${encodeURIComponent(error.message)}&toastType=error`);
            }
        } else {
            const actionValue = (like ?? pass) as FormDataEntryValue | null;
            if (!actionValue || typeof actionValue !== "string") {
                return {
                    success: false,
                    error: true,
                    message: "Invalid request action to process!",
                };
            }
            const actionType = actionValue.toString().toUpperCase() === "LIKE" ? "LIKE" : "PASS";

            try {
                const res = await createModelInteraction(modelId, customerId, actionType);
                if (res?.success) {
                    return {
                        success: true,
                        error: false,
                        message: res.message || "Create Interaction success!",
                        customerId,
                        actionType,
                    };
                } else {
                    return {
                        success: false,
                        error: true,
                        message: res?.message || "Failed to create interaction",
                    };
                }
            } catch (error: any) {
                return redirect(
                    `/model/matches?toastMessage=${encodeURIComponent(
                        error?.message || "Something went wrong"
                    )}&toastType=error`
                );
            }
        }
    }

    return redirect(
        `/model/matches?toastMessage=${encodeURIComponent(
            "Invalid request method. Please try again later"
        )}&toastType=warning`
    );
}

// ─── Infinite scroll hook ────────────────────────────────────────────────────

function useInfiniteScroll(
    initialItems: any[],
    initialPagination: PaginationProps,
    tabFlag: string,
    pageParam: string,
    searchParams: URLSearchParams,
    dataKey: keyof LoaderReturn,
    paginationKey: keyof LoaderReturn,
) {
    const fetcher = useFetcher<LoaderReturn>();
    const [items, setItems] = React.useState<any[]>(initialItems);
    const [page, setPage] = React.useState(initialPagination.currentPage);
    const [hasMore, setHasMore] = React.useState(initialPagination.hasNextPage);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const sentinelRef = React.useRef<HTMLDivElement>(null);

    // Reset when initial data changes (tab switch, filter change)
    React.useEffect(() => {
        setItems(initialItems);
        setPage(initialPagination.currentPage);
        setHasMore(initialPagination.hasNextPage);
        setIsLoadingMore(false);
    }, [initialItems, initialPagination.currentPage, initialPagination.hasNextPage]);

    // When fetcher returns data, append new items
    React.useEffect(() => {
        if (fetcher.data && fetcher.state === "idle") {
            const newItems = (fetcher.data as any)[dataKey] as any[];
            const newPagination = (fetcher.data as any)[paginationKey] as PaginationProps;
            if (newItems && newItems.length > 0) {
                setItems(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const unique = newItems.filter(i => !existingIds.has(i.id));
                    return [...prev, ...unique];
                });
            }
            if (newPagination) {
                setHasMore(newPagination.hasNextPage);
            }
            setIsLoadingMore(false);
        }
    }, [fetcher.data, fetcher.state, dataKey, paginationKey]);

    // Load next page
    const loadMore = React.useCallback(() => {
        if (!hasMore || isLoadingMore || fetcher.state !== "idle") return;
        setIsLoadingMore(true);
        const nextPage = page + 1;
        setPage(nextPage);

        const params = new URLSearchParams(searchParams);
        params.set(tabFlag, "true");
        params.set(pageParam, String(nextPage));

        fetcher.load(`/model/matches?${params.toString()}`);
    }, [hasMore, isLoadingMore, fetcher, page, searchParams, tabFlag, pageParam]);

    // IntersectionObserver on sentinel
    React.useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, loadMore]);

    return { items, hasMore, isLoadingMore, sentinelRef };
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function ModelMatchesPage() {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {
        foryouCustomers,
        likeMeCustomers,
        myFavouriteCustomers,
        myPassCustomers,
        foryouPagination,
        likemePagination,
        favouritePagination,
        passPagination,
        modelLatitude,
        modelLongitude,
        modelName,
    } = useLoaderData<LoaderReturn>();
    const actionData = useActionData<typeof action>();

    const [tabValue, setTabValue] = React.useState<"foryou" | "likeme" | "favourite" | "passed">(
        "foryou"
    );
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    const isSubmitting =
        navigation.state !== "idle" && navigation.formMethod === "POST";
    const isLoading = navigation.state === "loading";

    const [showAlert, setShowAlert] = React.useState<boolean>(Boolean(actionData));

    React.useEffect(() => {
        if (searchParams.has("likeMeOnly")) setTabValue("likeme");
        else if (searchParams.has("favouriteOnly")) setTabValue("favourite");
        else if (searchParams.has("passedOnly")) setTabValue("passed");
        else setTabValue("foryou");
    }, [searchParams]);

    React.useEffect(() => {
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

    // Infinite scroll for each tab
    const foryou = useInfiniteScroll(
        foryouCustomers, foryouPagination,
        "forYouOnly", "page", searchParams,
        "foryouCustomers", "foryouPagination"
    );
    const likeme = useInfiniteScroll(
        likeMeCustomers, likemePagination,
        "likeMeOnly", "likeMePage", searchParams,
        "likeMeCustomers", "likemePagination"
    );
    const favourite = useInfiniteScroll(
        myFavouriteCustomers, favouritePagination,
        "favouriteOnly", "favouritePage", searchParams,
        "myFavouriteCustomers", "favouritePagination"
    );
    const passed = useInfiniteScroll(
        myPassCustomers, passPagination,
        "passedOnly", "passedPage", searchParams,
        "myPassCustomers", "passPagination"
    );

    if (isSubmitting) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 text-rose-500 animate-spin" />
                    <p className="text-rose-600">{t('matches.processing')}</p>
                </div>
            </div>
        );
    }

    const renderGrid = (
        scroll: ReturnType<typeof useInfiniteScroll>,
        emptyDesc: string,
    ) => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center min-h-[200px]">
                    <Loader className="w-6 h-6 animate-spin text-rose-500" />
                    &nbsp; {t('matches.loading')}
                </div>
            );
        }

        if (scroll.items.length === 0) {
            return (
                <EmptyPage
                    title={t('matches.notFound')}
                    description={emptyDesc}
                />
            );
        }

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4 px-2">
                    {scroll.items.map((customer) => (
                        <CustomerCard
                            key={customer.id}
                            customer={customer}
                            modelLatitude={modelLatitude}
                            modelLongitude={modelLongitude}
                            modelName={modelName}
                        />
                    ))}
                </div>

                {/* Sentinel for infinite scroll */}
                <div ref={scroll.sentinelRef} className="h-4" />

                {scroll.isLoadingMore && (
                    <div className="flex justify-center py-4">
                        <Loader className="w-5 h-5 animate-spin text-rose-500" />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen relative">
            <div className="space-y-6 p-2 sm:p-4">
                <Tabs
                    value={tabValue}
                    onValueChange={(val) => {
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
                        navigate(`?${newParams.toString()}`, { replace: true });
                    }}
                    className="w-full space-y-2"
                >
                    <TabsList className="w-full">
                        <TabsTrigger value="foryou" className="cursor-pointer uppercase text-sm">
                            {t('matches.forYou')}
                        </TabsTrigger>
                        <TabsTrigger value="likeme" className="cursor-pointer uppercase text-sm">
                            {t('matches.likeMe')}
                        </TabsTrigger>
                        <TabsTrigger value="favourite" className="cursor-pointer uppercase text-sm">
                            {t('matches.favourite')}
                        </TabsTrigger>
                        <TabsTrigger value="passed" className="cursor-pointer uppercase text-sm">
                            {t('matches.passed')}
                        </TabsTrigger>
                    </TabsList>

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

                        {renderGrid(foryou, t('matches.noResults'))}
                    </TabsContent>

                    <TabsContent value="likeme">
                        {renderGrid(likeme, t('matches.noResults'))}
                    </TabsContent>

                    <TabsContent value="favourite">
                        {renderGrid(favourite, t('matches.noResults'))}
                    </TabsContent>

                    <TabsContent value="passed">
                        {renderGrid(passed, t('matches.noResultsFound'))}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
