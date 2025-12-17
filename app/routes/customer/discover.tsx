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
} from "lucide-react";
import React, { useState } from "react";
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

// service and backend
import { capitalize } from "~/utils/functions/textFormat";
import { calculateAgeFromDOB, calculateDistance } from "~/utils";
import { getUserTokenFromSession, requireUserSession } from "~/services/auths.server";
import type { Gender, IAvailableStatus, IUserImages } from "~/interfaces/base";
import { createCustomerInteraction, customerAddFriend } from "~/services/interaction.server";
import type { IHotmodelsResponse, ImodelsResponse, INearbyModelResponse } from "~/interfaces";
import { getHotModels, getModelsForCustomer, getNearbyModels } from "~/services/model.server";

interface LoaderReturn {
    latitude: number;
    longitude: number;
    models: ImodelsResponse[];
    hasActiveSubscription: boolean;
    hotModels: IHotmodelsResponse[];
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

    // Get models for this customer
    const response = await getModelsForCustomer(customerId);
    const models: ImodelsResponse[] = response.map((model) => ({
        ...model,
        gender: model.gender as Gender,
        available_status: model.available_status as IAvailableStatus,
    }));

    const res = await getHotModels(customerId);
    const hotModels: IHotmodelsResponse[] = res.map((model) => ({
        ...model,
    }));

    const nearbyModels = await getNearbyModels(customerId as string)

    return {
        models,
        hotModels,
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

    if (addFriend === true) {
        try {
            const res = await customerAddFriend(customerId, modelId, token);
            if (res?.success) {
                return redirect(`/customer/?toastMessage=Add+friend+successfully!&toastType=success`);
            }
            return redirect(`/customer/?toastMessage=${res?.message || 'Failed to add friend'}&toastType=error`);
        } catch (error: any) {
            return redirect(`/customer/?toastMessage=${error.message}&toastType=error`);
        }
    }

    if (like === false && pass === false) {
        return redirect(`/customer/?toastMessage=Invalid+request+action&toastType=warning`);
    }

    const actionType = like === true ? "LIKE" : "PASS"
    try {
        const res = await createCustomerInteraction(customerId, modelId, actionType);
        if (res?.success) {
            return redirect(`/customer/?toastMessage=Interaction+successfully!&toastType=success`);
        }
        return redirect(`/customer/?toastMessage=${res?.message || 'Interaction failed'}&toastType=error`);
    } catch (error: any) {
        return redirect(`/customer/?toastMessage=${error.message}&toastType=error`);
    }
}

export default function DiscoverPage({ loaderData }: DiscoverPageProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const navigation = useNavigation()
    const [searchParams] = useSearchParams();
    const { models, hotModels, nearbyModels, latitude, longitude, hasActiveSubscription } = loaderData;

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
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Heart className="h-16 w-16 text-pink-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">{t('discover.noMoreProfiles')}</h2>
                    <p className="text-muted-foreground">
                        {t('discover.checkBackLater')}
                    </p>
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

    if (isSubmitting) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader className="w-4 h-4 text-rose-500 animate-spin" /> : ""}
                    <p className="text-rose-600">{t('discover.processing')}</p>
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
                </div>
                <div
                    className="px-2 sm:px-0 bg-gray-100 sm:bg-white flex items-center justify-start space-x-8 sm:space-x-10 overflow-x-auto overflow-y-hidden whitespace-nowrap mb-2 sm:mb-0 py-2 sm:py-6"
                    style={{
                        msOverflowStyle: 'none',
                        scrollbarWidth: 'none',
                    }}
                >
                    {models.map((data) => (
                        <div
                            key={data.id}
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
                        <div className="bg-gray-800 rounded-2xl overflow-hidden w-full sm:w-1/2">
                            <Swiper
                                modules={[Pagination, Navigation]}
                                navigation={{
                                    prevEl: ".custom-prev",
                                    nextEl: ".custom-next",
                                }}
                                pagination={{ clickable: true }}
                                spaceBetween={10}
                                className="w-full h-96 custom-swiper1"
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
                                                <h3 className="flex items-center justify-start text-sm mb-1 text-shadow-lg"><MapPin size={16} />&nbsp;{t('discover.location')} {calculateDistance(Number(selectedProfile?.latitude), Number(selectedProfile?.longitude), Number(latitude), Number(longitude))} km</h3>
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

                                                {/* large screen  */}
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
                                            <h3 className="flex items-center justify-start text-sm mb-1 text-shadow-lg"><MapPin size={16} />&nbsp;{t('discover.location')} {calculateDistance(Number(selectedProfile?.latitude), Number(selectedProfile?.longitude), Number(latitude), Number(longitude))} km</h3>
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

                                            {/* large screen  */}
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

            <div className="flex flex-col items-start justify-start p-3 w-full space-y-4">
                <div className="flex items-start justify-between w-full mb-2 sm:mb-4">
                    <div className="space-y-2 sm:space-y-1">
                        <h1 className="text-sm sm:text-md sm:font-bold text-gray-800 uppercase text-shadow-md">
                            {t('discover.dailyPicks')}
                        </h1>
                        <p className="text-xs sm:text-sm font-normal text-gray-600">
                            {t('discover.dailyPicksDescription')}
                        </p>
                    </div>
                </div>

                <Swiper
                    modules={[Navigation, Pagination]}
                    navigation={{
                        prevEl: ".custom-prev",
                        nextEl: ".custom-next",
                    }}
                    pagination={{ clickable: true }}
                    spaceBetween={20}
                    breakpoints={{
                        0: { slidesPerView: 1 },
                        768: { slidesPerView: 2 },
                        1024: { slidesPerView: 3 },
                    }}
                    className="w-full custom-swiper"
                >
                    {hotModels.map((model) => (
                        <SwiperSlide key={model.id}>
                            <div className="relative shadow-md bg-white rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-transform h-60">
                                <Form method="post">
                                    <input type="hidden" name="modelId" value={model.id} />
                                    <input type="hidden" name="isFriend" value="true" id="isFriend" />
                                    <div className="relative h-full overflow-hidden">
                                        {model.Images?.[0]?.name ? (
                                            <img
                                                src={model.Images[0].name}
                                                alt={model.firstName + model.lastName}
                                                className="w-full h-full object-cover transition-transform duration-300"
                                                onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                            />
                                        ) : model.profile ? (
                                            <img
                                                src={model.profile}
                                                alt={model.firstName + model.lastName}
                                                className="w-full h-full object-cover transition-transform duration-300 cursor-pointer"
                                                onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                            />
                                        ) : (
                                            <div
                                                className="w-full h-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center cursor-pointer"
                                                onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                            >
                                                <User className="w-16 h-16 text-white" />
                                            </div>
                                        )}
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
                                                className="absolute top-4 right-4 rounded-lg py-1.5 px-2 bg-gray-700 hover:bg-rose-100 text-gray-300 hover:text-rose-500 shadow-lg transition-all duration-300 cursor-pointer z-10"
                                                onClick={() => {
                                                    (document.getElementById("isFriend") as HTMLInputElement).value = "true";
                                                }}
                                            >
                                                <UserPlus className="w-4 h-4" />
                                            </button>
                                        }

                                        <div className="absolute top-0 left-4 right-4 text-white transition-all duration-300">
                                            <div className="flex items-start space-x-3 mt-2">
                                                <div className="w-12 h-12">
                                                    {model.profile ? (
                                                        <img
                                                            src={model.profile}
                                                            alt="Profile"
                                                            className="w-full h-full rounded-full object-cover border-2 border-gray-700"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center">
                                                            <User className="w-6 h-6 text-gray-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <h2
                                                        className="flex items-center justify-start text-sm gap-1"
                                                        style={{
                                                            textShadow: "1px 1px 2px rgba(35, 35, 35, 0.8)",
                                                        }}
                                                    >
                                                        <User size={16} />{model.firstName + " " + model.lastName}
                                                    </h2>
                                                    <p
                                                        className="flex items-center justify-start text-xs text-white gap-1"
                                                        style={{
                                                            textShadow: "1px 1px 2px rgba(35, 35, 35, 0.8)",
                                                        }}
                                                    >
                                                        <Calendar size={16} />{calculateAgeFromDOB(model.dob)} {t('discover.yearsOld')}
                                                    </p>
                                                    <p
                                                        className="flex items-center justify-start text-xs text-white gap-1"
                                                        style={{
                                                            textShadow: "1px 1px 2px rgba(35, 35, 35, 0.8)",
                                                        }}
                                                    >
                                                        <MapPin size={16} />&nbsp;{calculateDistance(Number(selectedProfile?.latitude), Number(selectedProfile?.longitude), Number(latitude), Number(longitude))} km
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Form>
                            </div>
                        </SwiperSlide>
                    ))}

                    <button className="custom-prev hidden sm:block cursor-pointer absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white shadow-lg border text-gray-600 hover:bg-gray-50">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button className="custom-next hidden sm:block cursor-pointer absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white shadow-lg border text-gray-600 hover:bg-gray-50">
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </Swiper>
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
                                            {calculateDistance(Number(selectedProfile?.latitude), Number(selectedProfile?.longitude), Number(latitude), Number(longitude))} Km
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
                                            {calculateDistance(Number(selectedProfile?.latitude), Number(selectedProfile?.longitude), Number(latitude), Number(longitude))} Km

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
