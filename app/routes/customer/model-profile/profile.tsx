import React from 'react';
import type { Route } from './+types/profile';
import { useTranslation } from 'react-i18next';
import { Form, redirect, useNavigate, useNavigation, useSearchParams, type LoaderFunction } from 'react-router';
import { BadgeCheck, UserPlus, UserCheck, Forward, User, Calendar, MarsStroke, ToggleLeft, MapPin, Star, ChevronLeft, ChevronRight, X, MessageSquareText, Loader, Book, BriefcaseBusiness, Heart, MessageSquare, Eye, EyeOff, Send, Wallet, CreditCard, AlertTriangle } from 'lucide-react';

// components
import {
    Card,
    CardTitle,
    CardFooter,
    CardHeader,
    CardContent,
    CardDescription,
} from "~/components/ui/card"
import Rating from '~/components/ui/rating';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import EmptyPage from '~/components/ui/empty';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Separator } from '~/components/ui/separator';
import { Checkbox } from '~/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// interface, services and utils
import { getModelProfile } from '~/services/model.server';
import { capitalize, getFirstWord } from '~/utils/functions/textFormat';
import type { ISinglemodelProfileResponse, IReviewData } from '~/interfaces';
import { getUserTokenFromSession, requireUserSession } from '~/services/auths.server';
import { calculateAgeFromDOB, formatCurrency, formatNumber, formatDateRelative } from '~/utils';
import { getModelReviews, canCustomerReviewModel, getCustomerReviewForModel, createReview } from '~/services/review.server';
import { SubscriptionModal } from "~/components/subscription/SubscriptionModal";
import { useSubscriptionCheck } from "~/hooks/useSubscriptionCheck";

interface LoaderReturn {
    model: ISinglemodelProfileResponse & { reviewData?: IReviewData }
    hasActiveSubscription: boolean
    trialPackage: {
        id: string;
        price: number;
    } | null;
    customerBalance: number;
}

interface ProfilePageProps {
    loaderData: LoaderReturn
}

export const loader: LoaderFunction = async ({ params, request }) => {
    const customerId = await requireUserSession(request)
    const modelId = params.userId as string
    const { hasActiveSubscription } = await import("~/services/package.server");
    const { prisma } = await import("~/services/database.server");
    const model = await getModelProfile(modelId, customerId)

    // Fetch review data, subscription status, trial package, and wallet balance
    const [reviewsResult, canReviewResult, customerReview, hasSubscription, trialPackage, wallet] = await Promise.all([
        getModelReviews(modelId, 1, 10),
        canCustomerReviewModel(customerId, modelId),
        getCustomerReviewForModel(customerId, modelId),
        hasActiveSubscription(customerId),
        prisma.subscription_plan.findFirst({
            where: { name: "24-Hour Trial", status: "active" },
            select: { id: true, price: true },
        }),
        prisma.wallet.findFirst({
            where: { customerId },
            select: { totalBalance: true },
        }),
    ]);

    const reviewData: IReviewData = {
        reviews: reviewsResult.reviews,
        totalCount: reviewsResult.totalCount,
        totalPages: reviewsResult.totalPages,
        currentPage: reviewsResult.currentPage,
        canReview: canReviewResult.canReview,
        reviewReason: canReviewResult.reason,
        customerReview: customerReview as any
    };

    return {
        model: { ...model, reviewData },
        hasActiveSubscription: hasSubscription,
        trialPackage,
        customerBalance: wallet?.totalBalance || 0,
    }
}

export async function action({
    request,
}: Route.ActionArgs) {
    const customerId = await requireUserSession(request)
    const formData = await request.formData()
    const modelId = formData.get("modelId") as string
    const isInteraction = formData.get("interaction")
    const addFriend = formData.get("isFriend") === "true";
    const submitReview = formData.get("submitReview") === "true";
    const token = await getUserTokenFromSession(request)
    const { createCustomerInteraction, customerAddFriend } = await import(
        "~/services/interaction.server"
    );

    if (request.method === "POST") {
        // Handle review submission
        if (submitReview) {
            const rating = Number(formData.get("rating"));
            const title = formData.get("title") as string | null;
            const reviewText = formData.get("reviewText") as string | null;
            const isAnonymous = formData.get("isAnonymous") === "true";

            // Validation
            if (!rating || rating < 1 || rating > 5) {
                return redirect(`/customer/user-profile/${modelId}?toastMessage=Please+select+a+rating+between+1+and+5&toastType=error`);
            }

            try {
                const res = await createReview({
                    rating,
                    title: title || undefined,
                    reviewText: reviewText || undefined,
                    isAnonymous,
                    modelId,
                    customerId
                });
                if (res?.success) {
                    return redirect(`/customer/user-profile/${modelId}?toastMessage=Review+submitted+successfully!&toastType=success`);
                }
            } catch (error: any) {
                const errorMessage = encodeURIComponent(error.message || "Failed to submit review");
                return redirect(`/customer/user-profile/${modelId}?toastMessage=${errorMessage}&toastType=error`);
            }
        }

        if (addFriend === true) {
            try {
                const res = await customerAddFriend(customerId, modelId, token);
                if (res?.success) {
                    return redirect(`/customer/user-profile/${modelId}?toastMessage=Add+friend+successfully!&toastType=success`);
                }
            } catch (error: any) {
                return redirect(`/customer/user-profile/${modelId}?toastMessage=${error.message}&toastType=error`);
            }
        } else {
            const actionType = "LIKE";
            try {
                if (isInteraction === "true") {
                    const res = await createCustomerInteraction(customerId, modelId, actionType);
                    if (res?.success) {
                        return redirect(`/customer/user-profile/${modelId}?toastMessage=Interaction+successfully!&toastType=success`);
                    }
                } else {
                    return redirect(`/customer/user-profile/${modelId}?toastMessage=Something+wrong.+Please+try+again+later!&toastType=error`);
                }
            } catch (error: any) {
                return { success: false, error: true, message: error.message || "Phone number or password incorrect!" };
            }
        }
    }
    return redirect(`/customer/user-profile/${modelId}?toastMessage=Invalid+request+method!&toastType=warning`);
}

export default function ModelProfilePage({ loaderData }: ProfilePageProps) {
    const navigate = useNavigate()
    const navigation = useNavigation()
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation();
    const { model, hasActiveSubscription, trialPackage, customerBalance } = loaderData
    const images = model.Images
    const isSubmitting =
        navigation.state !== "idle" && navigation.formMethod === "POST"

    // Check if we should show subscription modal from URL param
    const shouldShowSubscriptionFromUrl = searchParams.get("showSubscription") === "true" && !hasActiveSubscription;

    // Subscription modal management
    const {
        showSubscriptionModal,
        openSubscriptionModal,
        closeSubscriptionModal,
        handleSubscribe,
    } = useSubscriptionCheck({
        hasActiveSubscription,
        customerBalance,
        trialPrice: trialPackage?.price || 10000,
        trialPlanId: trialPackage?.id || "",
        showOnMount: shouldShowSubscriptionFromUrl,
    });

    // Handler for WhatsApp button click with subscription check
    const handleWhatsAppClick = (whatsappNumber: number) => {
        if (!hasActiveSubscription) {
            openSubscriptionModal();
        } else {
            window.open(`https://wa.me/${whatsappNumber}`);
        }
    };

    // Handler for book service button click with subscription and balance check
    const handleBookClick = (modelId: string, serviceId: string, serviceName: string, servicePrice: number) => {
        if (!hasActiveSubscription) {
            // Store booking intent in sessionStorage for post-subscription redirect
            sessionStorage.setItem("booking_intent", JSON.stringify({ modelId, serviceId }));
            openSubscriptionModal();
        } else if (customerBalance < servicePrice) {
            // Show insufficient balance modal
            setInsufficientBalanceData({ servicePrice, serviceName });
            setShowInsufficientBalanceModal(true);
        } else {
            navigate(`/customer/book-service/${modelId}/${serviceId}`);
        }
    };

    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
    const [touchStartX, setTouchStartX] = React.useState<number | null>(null);
    const [touchEndX, setTouchEndX] = React.useState<number | null>(null);
    const [showProfileFullscreen, setShowProfileFullscreen] = React.useState(false);

    // Insufficient balance modal state
    const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] = React.useState(false);
    const [insufficientBalanceData, setInsufficientBalanceData] = React.useState<{
        servicePrice: number;
        serviceName: string;
    } | null>(null);

    // Review state
    const [reviewRating, setReviewRating] = React.useState<number>(0);
    const [isAnonymous, setIsAnonymous] = React.useState<boolean>(false);
    const reviewData = model.reviewData;

    // Helper function to get translated service name
    const getServiceName = (nameKey: string) => {
        const translatedName = t(`modelServices.serviceItems.${nameKey}.name`);
        return translatedName.includes('modelServices.serviceItems') ? nameKey : translatedName;
    };

    // Helper function to get translated service description
    const getServiceDescription = (nameKey: string, fallbackDescription: string | null) => {
        const translatedDesc = t(`modelServices.serviceItems.${nameKey}.description`);
        if (translatedDesc.includes('modelServices.serviceItems')) {
            return fallbackDescription || t("modelServices.noDescription");
        }
        return translatedDesc;
    };

    // Helper to get billing type label
    const getBillingTypeLabel = (billingType: string) => {
        switch (billingType) {
            case "per_hour":
                return t("modelServices.billingTypes.perHour");
            case "per_session":
                return t("modelServices.billingTypes.perSession");
            case "per_day":
            default:
                return t("modelServices.billingTypes.perDay");
        }
    };

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

    if (isSubmitting) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader className="w-4 h-4 text-rose-500 animate-spin" /> : ""}
                    <p className="text-rose-600">{t('profile.processing')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-auto sm:h-screen flex items-center justify-center">
            <div className="w-11/12 sm:w-4/5 h-full">
                <div className="px-2 sm:px-6 py-2 sm:py-8 space-y-2">
                    <div className="flex sm:hidden items-start justify-between sm:justify-end px-0 sm:px-4">
                        <div className="flex sm:hidden items-center gap-2">
                            <Form method="post" >
                                <input type="hidden" name="modelId" value={model.id} />
                                <input type="hidden" name="interaction" value="true" />
                                <Button
                                    size="sm"
                                    type="submit"
                                    className={`cursor-pointer block sm:hidden text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md ${model.customer_interactions?.some(interaction => interaction.action === "LIKE") ? "bg-rose-500 hover:bg-rose-600" : "border border-rose-500 bg-white text-rose-500 hover:bg-rose-500 hover:text-white"}`}
                                >
                                    {model.customer_interactions?.some(interaction => interaction.action === "LIKE")
                                        ? <Heart />
                                        : <Heart />}
                                </Button>
                            </Form>
                            {model?.whatsapp && (
                                <Button
                                    size="sm"
                                    type="button"
                                    className="cursor-pointer block sm:hidden border border-rose-500 text-rose-500 bg-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                    onClick={() => model.whatsapp && handleWhatsAppClick(model.whatsapp)}
                                >
                                    <MessageSquareText className="w-5 h-5 text-rose-500 cursor-pointer" />
                                </Button>
                            )}
                            {model?.isContact ? (
                                <div className="block sm:hidden rounded-md py-1.5 px-2 bg-green-100 text-green-500 shadow-lg">
                                    <UserCheck className="w-5 h-5" />
                                </div>
                            ) : (
                                <Form method="post">
                                    <input type="hidden" name="modelId" value={model.id} />
                                    <Button
                                        size="sm"
                                        type="submit"
                                        name="isFriend"
                                        value="true"
                                        className="cursor-pointer block sm:hidden bg-white border border-gray-700 hover:bg-gray-700 text-gray-700 hover:text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                    >
                                        <UserPlus className="w-5 h-5 text-gray-500 cursor-pointer" />
                                    </Button>
                                </Form>
                            )}
                        </div>
                        <div className="flex items-start gap-4">
                            <Forward className="w-6 h-6 text-gray-500 cursor-pointer" onClick={() => navigate(`/customer/user-profile-share/${model.id}`)} />
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <div
                            className="flex-shrink-0 cursor-pointer"
                            onClick={() => setShowProfileFullscreen(true)}
                        >
                            <img
                                src={model?.profile || undefined}
                                alt={`${model.firstName}-${model.lastName}`}
                                className="w-32 h-32 rounded-full object-cover border-2 border-rose-500 hover:opacity-90 transition-opacity"
                            />
                        </div>
                        <div className="flex sm:hidden items-center justify-center gap-2 text-center">
                            <div className="flex items-center justify-center gap-2 mb-1 px-4 py-0.5 rounded-full bg-gray-100">
                                <h2 className="text-lg text-gray-800">{`${model.firstName} ${model.lastName}`}</h2>
                                <BadgeCheck className="w-5 h-5 text-rose-500" />
                            </div>
                        </div>

                        <div className="hidden sm:block flex-1">
                            <div className="mb-4">
                                <h1 className="text-2xl font-bold mb-1">
                                    {model.firstName}&nbsp;{model.lastName}
                                </h1>
                            </div>

                            <div className="flex items-center gap-3 mb-6">
                                <Form method="post" >
                                    <input type="hidden" name="modelId" value={model.id} />
                                    <input type="hidden" name="interaction" value="true" />
                                    <Button
                                        size="sm"
                                        type="submit"
                                        className={`cursor-pointer hidden sm:block text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md ${model.customer_interactions?.some(interaction => interaction.action === "LIKE") ? "bg-rose-500 hover:bg-rose-600" : "border border-rose-500 bg-white text-rose-500 hover:bg-rose-500 hover:text-white"}`}
                                    >
                                        {model.customer_interactions?.some(interaction => interaction.action === "LIKE")
                                            ? t('profile.liked')
                                            : t('profile.like')}
                                    </Button>
                                </Form>
                                {model?.whatsapp && (
                                    <Button
                                        size="sm"
                                        type="button"
                                        className="cursor-pointer hidden bg-gray-700 sm:block text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                        onClick={() => model.whatsapp && handleWhatsAppClick(model.whatsapp)}
                                    >
                                        {t('profile.message')}
                                    </Button>
                                )}
                                {model?.isContact ? (
                                    <div className="hidden sm:flex items-center justify-center bg-green-100 text-green-500 px-4 py-2 font-medium text-sm shadow-lg rounded-md gap-2">
                                        <UserCheck className="w-4 h-4" />
                                        {t('profile.friend')}
                                    </div>
                                ) : (
                                    <Form method="post">
                                        <input type="hidden" name="modelId" value={model.id} />
                                        <Button
                                            size="sm"
                                            type="submit"
                                            name="isFriend"
                                            value="true"
                                            className="cursor-pointer hidden bg-white border border-gray-700 hover:bg-gray-700 text-gray-700 sm:block hover:text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                        </Button>
                                    </Form>
                                )}
                                <Button
                                    size="sm"
                                    type="button"
                                    className="cursor-pointer hidden bg-gray-600 sm:block text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                    onClick={() => navigate(`/customer/user-profile-share/${model.id}`)}
                                >
                                    {t('profile.share')}
                                </Button>
                            </div>

                            <div className="flex items-center gap-6 mb-4">
                                <div className='flex items-center gap-1'>
                                    <span className="text-lg text-black font-bold">{formatNumber(model.totalLikes)}</span>
                                    <span className="text-md text-gray-500 ml-1">{t('profile.like')}</span>
                                </div>
                                <div className='flex items-center gap-1'>
                                    <span className="text-lg text-black font-bold">{formatNumber(model.totalFriends)}</span>
                                    <span className="text-md text-gray-500 ml-1">{t('profile.friends')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex sm:hidden items-center justify-around w-full mb-4">
                        <div className="w-1/2 text-center flex items-center justify-center gap-3 border-r">
                            <div className="text-lg text-black font-bold">{formatNumber(model.totalLikes)}</div>
                            <div className="text-md text-gray-500">{t('profile.likes')}</div>
                        </div>
                        <div className="w-1/2 text-center flex items-center justify-center gap-3">
                            <div className="text-lg text-black font-bold">{formatNumber(model.totalFriends)}</div>
                            <div className="text-md text-gray-500">{t('profile.friends')}</div>
                        </div>
                    </div>
                </div>

                <div className="pb-4">
                    <Tabs defaultValue="services" className="w-full">
                        <TabsList className='w-full mb-2'>
                            <TabsTrigger value="services">{t('profile.tabs.service')}</TabsTrigger>
                            <TabsTrigger value="account">{t('profile.tabs.accountInfo')}</TabsTrigger>
                            <TabsTrigger value="images">{t('profile.tabs.images')}</TabsTrigger>
                            <TabsTrigger value="reviews">{t('profile.tabs.reviews')}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="services" className="space-y-4">
                            {model.ModelService.length > 0 ?
                                <div className="w-full">
                                    <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase">{t('profile.serviceRating')}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mx-auto ">
                                        {model.ModelService.map((service) => {
                                            const name = getFirstWord(service.service.name).toLowerCase();
                                            const billingType = service.service.billingType || 'per_day';
                                            return (
                                                <Card key={service.id} className={`cursor-pointer w-full max-w-sm ${name === "sleep" ? "border-cyan-500" : name === "drinking" ? "border-green-500" : "border-rose-500"}`}>
                                                    <CardHeader>
                                                        <CardTitle className='text-sm'>{getServiceName(service.service.name)}</CardTitle>
                                                        <CardDescription className='text-xs sm:text-sm'>
                                                            {getServiceDescription(service.service.name, service.service.description)}
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="space-y-2">
                                                        {/* Billing Type Badge */}
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-gray-500">{t("modelServices.billingType")}</span>
                                                            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-700">
                                                                {getBillingTypeLabel(billingType)}
                                                            </span>
                                                        </div>

                                                        {/* Per Day - Show daily rate */}
                                                        {billingType === "per_day" && (
                                                            <div className="flex items-center justify-between text-sm">
                                                                <span className="text-gray-500">{t("modelServices.rate")}</span>
                                                                <span className="font-semibold text-rose-600">
                                                                    {formatCurrency(Number(service.customRate || service.service.baseRate))}/{t("modelServices.day")}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Per Hour - Show hourly rate OR lowest massage price */}
                                                        {billingType === "per_hour" && (
                                                            <div className="flex items-center justify-between text-sm">
                                                                <span className="text-gray-500">{t("modelServices.hourlyRate")}</span>
                                                                <span className="font-semibold text-rose-600">
                                                                    {service.service.name.toLowerCase() === 'massage' && service.model_service_variant && service.model_service_variant.length > 0 ? (
                                                                        <>
                                                                            {t("modelServices.startingFrom")} {formatCurrency(Math.min(...service.model_service_variant.map(v => v.pricePerHour)))}/{t("modelServices.hour")}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {formatCurrency(Number(service.customHourlyRate || service.service.hourlyRate || 0))}/{t("modelServices.hour")}
                                                                        </>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Per Session - Show one time and one night prices */}
                                                        {billingType === "per_session" && (
                                                            <>
                                                                <div className="flex items-center justify-between text-sm">
                                                                    <span className="text-gray-500">{t("modelServices.oneTimePrice")}</span>
                                                                    <span className="font-semibold text-rose-600">
                                                                        {formatCurrency(Number(service.customOneTimePrice || service.service.oneTimePrice || 0))}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between text-sm">
                                                                    <span className="text-gray-500">{t("modelServices.oneNightPrice")}</span>
                                                                    <span className="font-semibold text-rose-600">
                                                                        {formatCurrency(Number(service.customOneNightPrice || service.service.oneNightPrice || 0))}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </CardContent>
                                                    <CardFooter className="flex-col gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="w-full hover:border hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500"
                                                            onClick={() => {
                                                                const serviceName = getServiceName(service.service.name);
                                                                const servicePrice = service.service.name.toLowerCase() === 'massage' && service.model_service_variant && service.model_service_variant.length > 0
                                                                    ? Math.min(...service.model_service_variant.map(v => v.pricePerHour))
                                                                    : Number(service.customHourlyRate || service.service.hourlyRate || service.customOneTimePrice || service.service.oneTimePrice || 0);
                                                                handleBookClick(model.id, service.id, serviceName, servicePrice);
                                                            }}
                                                        >
                                                            {t('profile.bookNow')}
                                                        </Button>
                                                    </CardFooter>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                </div>
                                :
                                <div className="w-full">
                                    <EmptyPage
                                        title={t('profile.noServices')}
                                        description={t('profile.noServicesDesc')}
                                    />
                                </div>
                            }
                        </TabsContent>
                        <TabsContent value="account">
                            <div className="flex flex-col sm:flex-row items-start justify-between space-y-2">
                                <div className="w-full flex items-start justify-start flex-col space-y-3 text-sm p-2">
                                    <h3 className="text-gray-800 font-bold">{t('profile.personalInfo')}</h3>
                                    <p className='flex items-center'><User size={14} />&nbsp;{t('profile.fullname')}:&nbsp;<span className="font-semibold">{model.firstName}&nbsp;{model.lastName}</span></p>
                                    <p className="flex items-center"> <Calendar size={14} />&nbsp;{t('profile.age')}:&nbsp;<span className="font-semibold">{calculateAgeFromDOB(model.dob)} {t('profile.yearsOld')}</span></p>
                                    <div className="flex items-center"><MarsStroke size={14} />&nbsp;{t('profile.gender')}:&nbsp;&nbsp;
                                        <Badge variant="outline" className={`${model.gender === "male" ? "bg-gray-700 text-gray-300" : "bg-rose-100 text-rose-500"} px-3 py-1 font-semibold`}>
                                            {capitalize(model.gender)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center"><ToggleLeft size={14} />&nbsp;{t('profile.status')}:&nbsp;&nbsp;
                                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1 font-semibold">
                                            {capitalize(model.status)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center"><ToggleLeft size={14} />&nbsp;{t('profile.availableStatus')}:&nbsp;&nbsp;
                                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1 font-semibold">
                                            {capitalize(model.available_status)}
                                        </Badge>
                                    </div>
                                    <p className="flex items-center"><MapPin size={14} />&nbsp;{t('profile.address')}:&nbsp;<span className="font-semibold">{model.address}</span></p>
                                    <p className="flex items-center"><Calendar size={14} />&nbsp;{t('profile.memberSince')}:&nbsp;<span className="font-semibold">{model.createdAt.toDateString()}</span></p>
                                    {model.career && <p className="flex items-center"><BriefcaseBusiness size={14} />&nbsp;{t('profile.career')}:&nbsp;<span className="font-semibold">{model.career}</span></p>}
                                    {model.education && <p className="flex items-center"><Book size={14} />&nbsp;{t('profile.education')}:&nbsp;<span className="font-semibold">{model.education}</span></p>}
                                    {model.bio && <p className="flex items-center"><User size={14} />&nbsp;{t('profile.bio')}:&nbsp;<span className="font-semibold">{model.bio}</span></p>}
                                </div>
                                <Separator className="block sm:hidden" />
                                <div className="w-full mb-8 space-y-4">
                                    {model.interests &&
                                        <div className='space-y-2'>
                                            <h3 className="text-sm text-gray-800 font-bold">{t('profile.interests')}</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.values(model.interests ?? {}).map((interest, index) => (
                                                    <Badge
                                                        key={index}
                                                        variant="outline"
                                                        className="bg-purple-100 text-purple-700 border-purple-200 px-3 py-1"
                                                    >
                                                        {interest}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    }
                                    <div className='space-y-2'>
                                        <h3 className="text-sm text-gray-800 font-bold">{t('profile.totalRating')}</h3>
                                        <div className="flex items-center">
                                            <Star size={14} />&nbsp;{t('profile.rating')}: &nbsp; {model.rating === 0 ?
                                                <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200 px-3 py-1">
                                                    {capitalize(t('profile.noRating'))}
                                                </Badge> : <Rating value={4} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="images" className='w-full'>
                            <div className="flex space-x-2 rounded-md h-full">
                                {model.Images.length > 0 ?
                                    <div className="w-full grid grid-cols-2 gap-2 h-fit">
                                        <div className="flex flex-col items-start justify-start space-y-2">
                                            {model.Images.slice(0, Math.ceil(model.Images.length / 2)).map((image, index) => (
                                                <div
                                                    key={image.id}
                                                    className="relative w-full group cursor-pointer overflow-hidden rounded-lg"
                                                    onClick={() => setSelectedIndex(index)}
                                                >
                                                    <img
                                                        src={image.name}
                                                        alt={`Profile ${index + 1}`}
                                                        className="w-full h-48 sm:h-72 object-cover shadow-sm transition-transform duration-300 ease-in-out group-hover:scale-105"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex flex-col items-start justify-start space-y-2 cursor-pointer">
                                            {model.Images.slice(Math.ceil(model.Images.length / 2)).map((image, index) => {
                                                const actualIndex = Math.ceil(model.Images.length / 2) + index;

                                                return (
                                                    <div
                                                        key={image.id}
                                                        className="relative w-full group cursor-pointer overflow-hidden rounded-lg"
                                                        onClick={() => setSelectedIndex(actualIndex)}
                                                    >
                                                        <img
                                                            src={image.name}
                                                            alt={`Profile ${index + 1}`}
                                                            className="w-full h-48 sm:h-72 object-cover shadow-sm transition-transform duration-300 ease-in-out group-hover:scale-105"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    :
                                    <div className="w-full">
                                        <EmptyPage
                                            title={t('profile.noPhotos')}
                                            description={t('profile.noPhotosDesc')}
                                        />

                                    </div>
                                }
                            </div>

                            {selectedIndex !== null && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
                                    <button
                                        className="absolute top-4 right-4 text-white p-4 bg-black/50 hover:bg-black/70 rounded-full z-50 cursor-pointer active:bg-black/80 transition-colors"
                                        onClick={() => setSelectedIndex(null)}
                                        type="button"
                                        aria-label="Close"
                                    >
                                        <X size={24} />
                                    </button>

                                    <button
                                        className="absolute left-4 text-white p-3 bg-black/50 hover:bg-black/70 rounded-full z-10 cursor-pointer hidden sm:block"
                                        onClick={handlePrev}
                                        type="button"
                                    >
                                        <ChevronLeft size={32} />
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
                                        className="absolute right-4 text-white p-3 bg-black/50 hover:bg-black/70 rounded-full z-10 cursor-pointer hidden sm:block"
                                        onClick={handleNext}
                                        type="button"
                                    >
                                        <ChevronRight size={32} />
                                    </button>

                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center z-50">
                                        <div className="text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                                            {selectedIndex + 1} / {images.length}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="reviews" className="space-y-6">
                            {/* Review Form Section */}
                            {reviewData?.canReview ? (
                                <Card className="border-rose-200">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <MessageSquare className="w-5 h-5 text-rose-500" />
                                            {t('profile.review.writeReview')}
                                        </CardTitle>
                                        <CardDescription>
                                            {t('profile.review.shareExperience')}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Form method="post" className="space-y-4">
                                            <input type="hidden" name="modelId" value={model.id} />
                                            <input type="hidden" name="submitReview" value="true" />
                                            <input type="hidden" name="rating" value={reviewRating} />
                                            <input type="hidden" name="isAnonymous" value={isAnonymous.toString()} />

                                            {/* Rating */}
                                            <div className="space-y-2">
                                                <Label>{t('profile.review.rating')} *</Label>
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            onClick={() => setReviewRating(star)}
                                                            className="transition-transform hover:scale-110"
                                                        >
                                                            <Star
                                                                size={28}
                                                                className={`cursor-pointer ${star <= reviewRating
                                                                    ? 'fill-yellow-400 text-yellow-400'
                                                                    : 'text-gray-300'
                                                                    }`}
                                                            />
                                                        </button>
                                                    ))}
                                                </div>
                                                {reviewRating === 0 && (
                                                    <p className="text-xs text-gray-500">{t('profile.review.selectRating')}</p>
                                                )}
                                            </div>

                                            {/* Title */}
                                            <div className="space-y-2">
                                                <Label htmlFor="title">{t('profile.review.title')}</Label>
                                                <Input
                                                    id="title"
                                                    name="title"
                                                    placeholder={t('profile.review.titlePlaceholder')}
                                                    maxLength={100}
                                                />
                                            </div>

                                            {/* Review Text */}
                                            <div className="space-y-2">
                                                <Label htmlFor="reviewText">{t('profile.review.reviewText')}</Label>
                                                <Textarea
                                                    id="reviewText"
                                                    name="reviewText"
                                                    placeholder={t('profile.review.reviewTextPlaceholder')}
                                                    maxLength={500}
                                                    rows={4}
                                                />
                                            </div>

                                            {/* Anonymous checkbox */}
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="anonymous"
                                                    checked={isAnonymous}
                                                    onCheckedChange={(checked: boolean) => setIsAnonymous(checked)}
                                                />
                                                <label
                                                    htmlFor="anonymous"
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                                                >
                                                    {isAnonymous ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    {t('profile.review.submitAnonymously')}
                                                </label>
                                            </div>

                                            <Button
                                                type="submit"
                                                disabled={reviewRating === 0 || isSubmitting}
                                                className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                                            >
                                                {isSubmitting ? (
                                                    <Loader className="w-4 h-4 animate-spin mr-2" />
                                                ) : (
                                                    <Send className="w-4 h-4 mr-2" />
                                                )}
                                                {t('profile.review.submitReview')}
                                            </Button>
                                        </Form>
                                    </CardContent>
                                </Card>
                            ) : reviewData?.customerReview ? (
                                <Card className="border-green-200 bg-green-50">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                                            <BadgeCheck className="w-5 h-5" />
                                            {t('profile.review.yourReview')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        size={20}
                                                        className={star <= reviewData.customerReview!.rating
                                                            ? 'fill-yellow-400 text-yellow-400'
                                                            : 'text-gray-300'
                                                        }
                                                    />
                                                ))}
                                            </div>
                                            {reviewData.customerReview.title && (
                                                <p className="font-semibold">{reviewData.customerReview.title}</p>
                                            )}
                                            {reviewData.customerReview.reviewText && (
                                                <p className="text-gray-600">{reviewData.customerReview.reviewText}</p>
                                            )}
                                            <p className="text-xs text-gray-500">
                                                {formatDateRelative(new Date(reviewData.customerReview.createdAt))}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="border-gray-200 bg-gray-50">
                                    <CardContent className="pt-6">
                                        <div className="text-center text-gray-500">
                                            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                                            <p className="font-medium">{t('profile.review.cannotReview')}</p>
                                            <p className="text-sm mt-1">
                                                {reviewData?.reviewReason === 'no_completed_booking'
                                                    ? t('profile.review.needCompletedBooking')
                                                    : t('profile.review.alreadyReviewed')}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Reviews List */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5" />
                                    {t('profile.review.allReviews')}
                                    <Badge variant="secondary">{reviewData?.totalCount || 0}</Badge>
                                </h3>

                                {reviewData?.reviews && reviewData.reviews.length > 0 ? (
                                    <div className="space-y-3">
                                        {reviewData.reviews.map((review) => (
                                            <Card key={review.id} className="border-gray-200">
                                                <CardContent className="pt-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-3">
                                                            {review.isAnonymous ? (
                                                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                                    <User className="w-5 h-5 text-gray-500" />
                                                                </div>
                                                            ) : review.customer?.profile ? (
                                                                <img
                                                                    src={review.customer.profile}
                                                                    alt={review.customer.firstName}
                                                                    className="w-10 h-10 rounded-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                                                                    <span className="text-rose-600 font-semibold">
                                                                        {review.customer?.firstName?.charAt(0) || '?'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="font-medium">
                                                                    {review.isAnonymous
                                                                        ? t('profile.review.anonymous')
                                                                        : `${review.customer?.firstName || ''} ${review.customer?.lastName || ''}`
                                                                    }
                                                                </p>
                                                                <div className="flex items-center gap-1">
                                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                                        <Star
                                                                            key={star}
                                                                            size={14}
                                                                            className={star <= review.rating
                                                                                ? 'fill-yellow-400 text-yellow-400'
                                                                                : 'text-gray-300'
                                                                            }
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs text-gray-500">
                                                            {formatDateRelative(new Date(review.createdAt))}
                                                        </span>
                                                    </div>
                                                    {review.title && (
                                                        <p className="font-semibold mt-3">{review.title}</p>
                                                    )}
                                                    {review.reviewText && (
                                                        <p className="text-gray-600 mt-2">{review.reviewText}</p>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyPage
                                        title={t('profile.review.noReviews')}
                                        description={t('profile.review.noReviewsDesc')}
                                    />
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Profile Image Fullscreen */}
                {showProfileFullscreen && model?.profile && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 cursor-pointer"
                        onClick={() => setShowProfileFullscreen(false)}
                    >
                        <button
                            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowProfileFullscreen(false);
                            }}
                            type="button"
                            aria-label="Close"
                        >
                            <X size={32} />
                        </button>
                        <img
                            src={model.profile}
                            alt={`${model.firstName} ${model.lastName}`}
                            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-lg"
                        />
                        <p className="absolute bottom-4 text-white/70 text-sm">{t('profile.clickToClose')}</p>
                    </div>
                )}

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

                {/* Insufficient Balance Modal */}
                {showInsufficientBalanceModal && insufficientBalanceData && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="w-full max-w-md bg-white rounded-lg shadow-2xl animate-in zoom-in duration-300 mx-4">
                            <div className="relative p-6">
                                <button
                                    onClick={() => setShowInsufficientBalanceModal(false)}
                                    className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-md font-bold text-gray-900">
                                            {t("profile.insufficientBalance.title", { defaultValue: "Insufficient Balance" })}
                                        </h2>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {t("profile.insufficientBalance.subtitle", {
                                                defaultValue: "You don't have enough balance to book this service",
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 space-y-4">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm text-gray-600">
                                            {t("profile.insufficientBalance.service", { defaultValue: "Service" })}
                                        </div>
                                        <div className="font-semibold text-gray-900">
                                            {insufficientBalanceData.serviceName}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm text-gray-600">
                                            {t("profile.insufficientBalance.requiredAmount", { defaultValue: "Required Amount" })}
                                        </div>
                                        <div className="font-semibold text-rose-600">
                                            {formatCurrency(insufficientBalanceData.servicePrice)}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-gray-600">
                                            {t("profile.insufficientBalance.yourBalance", { defaultValue: "Your Balance" })}
                                        </div>
                                        <div className="font-semibold text-amber-600">
                                            {formatCurrency(customerBalance)}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                                    <div className="flex items-center gap-3">
                                        <Wallet className="w-5 h-5 text-rose-600" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-rose-900">
                                                {t("profile.insufficientBalance.needMore", { defaultValue: "You need" })}
                                            </p>
                                            <p className="text-md font-bold text-rose-600">
                                                +{formatCurrency(insufficientBalanceData.servicePrice - customerBalance)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 p-6">
                                <Button
                                    onClick={() => setShowInsufficientBalanceModal(false)}
                                    variant="outline"
                                    className="w-auto"
                                >
                                    {t("profile.insufficientBalance.close", { defaultValue: "Close" })}
                                </Button>
                                <Button
                                    onClick={() => {
                                        // Store return URL for after top-up
                                        sessionStorage.setItem("topup_return_url", `/customer/user-profile/${model.id}`);
                                        navigate("/customer/wallet-topup");
                                        setShowInsufficientBalanceModal(false);
                                    }}
                                    className="w-auto bg-rose-500 hover:bg-rose-600 text-white"
                                >
                                    <CreditCard className="w-4 h-4" />
                                    {t("profile.insufficientBalance.topUp", { defaultValue: "Top Up" })}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};