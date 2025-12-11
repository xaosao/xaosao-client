import React from 'react';
import { Form, redirect, useNavigate, useNavigation, useSearchParams, type LoaderFunction } from 'react-router';
import { BadgeCheck, UserPlus, Forward, User, Calendar, MarsStroke, ToggleLeft, MapPin, Star, ChevronLeft, ChevronRight, X, MessageSquareText, Loader, Book, BriefcaseBusiness, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import EmptyPage from '~/components/ui/empty';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// interface, services and utils
import { capitalize, getFirstWord } from '~/utils/functions/textFormat';
import { calculateAgeFromDOB, formatCurrency, formatNumber } from '~/utils';
import { requireModelSession } from '~/services/model-auth.server';

interface CustomerProfile {
    id: string;
    firstName: string;
    lastName?: string;
    profile: string;
    dob: string;
    gender: string;
    status: string;
    address?: string;
    createdAt: Date;
    career?: string;
    education?: string;
    bio?: string;
    interests?: Record<string, string>;
    relationshipStatus?: string;
    totalLikes: number;
    totalFriends: number;
    Images: Array<{ id: string; name: string }>;
    model_interactions?: Array<{ action: string }>;
    isContact?: boolean;
}

interface LoaderReturn {
    customer: CustomerProfile;
}

interface ProfilePageProps {
    loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ params, request }) => {
    const modelId = await requireModelSession(request);
    const customerId = params.customerId;

    // TODO: Create this function in model.server.ts
    const { getCustomerProfileForModel } = await import("~/services/model.server");
    const customer = await getCustomerProfileForModel(customerId as string, modelId);

    return { customer };
}

export async function action({ request, params }: any) {
    const modelId = await requireModelSession(request);
    const formData = await request.formData();
    const customerId = params.customerId;
    const isInteraction = formData.get("interaction");
    const addFriend = formData.get("isFriend") === "true";

    // TODO: Create these functions in interaction.server.ts
    const { createModelInteraction, modelAddFriend } = await import(
        "~/services/interaction.server"
    );

    if (request.method === "POST") {
        if (addFriend === true) {
            try {
                const res = await modelAddFriend(modelId, customerId);
                if (res?.success) {
                    return redirect(`/model/customer-profile/${customerId}?toastMessage=Add+friend+successfully!&toastType=success`);
                }
            } catch (error: any) {
                return redirect(`/model/customer-profile/${customerId}?toastMessage=${error.message}&toastType=error`);
            }
        } else {
            const actionType = "LIKE";
            try {
                if (isInteraction === "true") {
                    const res = await createModelInteraction(modelId, customerId, actionType);
                    if (res?.success) {
                        return redirect(`/model/customer-profile/${customerId}?toastMessage=Interaction+successfully!&toastType=success`);
                    }
                } else {
                    return redirect(`/model/customer-profile/${customerId}?toastMessage=Something+wrong.+Please+try+again+later!&toastType=error`);
                }
            } catch (error: any) {
                return { success: false, error: true, message: error.message || "Failed to perform action!" };
            }
        }
    }
    return redirect(`/model/customer-profile/${customerId}?toastMessage=Invalid+request+method!&toastType=warning`);
}

export default function CustomerProfilePage({ loaderData }: ProfilePageProps) {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const [searchParams] = useSearchParams();
    const { t } = useTranslation();
    const { customer } = loaderData;
    const images = customer.Images;
    const isSubmitting =
        navigation.state !== "idle" && navigation.formMethod === "POST";

    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
    const [touchStartX, setTouchStartX] = React.useState<number | null>(null);
    const [touchEndX, setTouchEndX] = React.useState<number | null>(null);

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
        setSelectedIndex((prev) => (prev! - 1 + images.length) % images.length);
    };

    const handleNext = () => {
        if (selectedIndex === null) return;
        setSelectedIndex((prev) => (prev! + 1) % images.length);
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
                            <Form method="post">
                                <input type="hidden" name="customerId" value={customer.id} />
                                <input type="hidden" name="interaction" value="true" />
                                <Button
                                    size="sm"
                                    type="submit"
                                    className={`cursor-pointer block sm:hidden text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md ${customer.model_interactions?.some(interaction => interaction.action === "LIKE") ? "bg-rose-500 hover:bg-rose-600" : "border border-rose-500 bg-white text-rose-500 hover:bg-rose-500 hover:text-white"}`}
                                >
                                    {customer.model_interactions?.some(interaction => interaction.action === "LIKE")
                                        ? <Heart />
                                        : <Heart />}
                                </Button>
                            </Form>
                            <Form method="post">
                                <input type="hidden" name="customerId" value={customer.id} />
                                {customer?.isContact ?
                                    <Button
                                        size="sm"
                                        type="button"
                                        className="cursor-pointer block sm:hidden border border-rose-500 sm:block text-rose-500 bg-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                        onClick={() => navigate(`/model/chat?id=${customer.firstName}`)}
                                    >
                                        <MessageSquareText className="w-5 h-5 text-rose-500 cursor-pointer" />
                                    </Button>
                                    :
                                    <Button
                                        size="sm"
                                        type="submit"
                                        name="isFriend"
                                        value="true"
                                        className="cursor-pointer bg-white border border-gray-700 hover:bg-gray-700 text-gray-700 sm:block hover:text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                    >
                                        <UserPlus className="w-5 h-5 text-gray-500 cursor-pointer" />
                                    </Button>
                                }
                            </Form>
                        </div>
                        <div className="flex items-start gap-4">
                            <Forward className="w-6 h-6 text-gray-500 cursor-pointer" onClick={() => navigate(`/model/customer-profile-share/${customer.id}`)} />
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <div className="flex-shrink-0">
                            <img
                                src={customer?.profile || undefined}
                                alt={`${customer.firstName}-${customer.lastName}`}
                                className="w-32 h-32 rounded-full object-cover border-2 border-rose-500"
                            />
                        </div>
                        <div className="flex sm:hidden items-center justify-center gap-2 text-center">
                            <div className="flex items-center justify-center gap-2 mb-1 px-4 py-0.5 rounded-full bg-gray-100">
                                <h2 className="text-lg text-gray-800">{`${customer.firstName} ${customer.lastName || ''}`}</h2>
                                <BadgeCheck className="w-5 h-5 text-rose-500" />
                            </div>
                        </div>

                        <div className="hidden sm:block flex-1">
                            <div className="mb-4">
                                <h1 className="text-2xl font-bold mb-1">
                                    {customer.firstName}&nbsp;{customer.lastName}
                                </h1>
                            </div>

                            <div className="flex items-center gap-3 mb-6">
                                <Form method="post">
                                    <input type="hidden" name="customerId" value={customer.id} />
                                    <input type="hidden" name="interaction" value="true" />
                                    <Button
                                        size="sm"
                                        type="submit"
                                        className={`cursor-pointer hidden sm:block text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md ${customer.model_interactions?.some(interaction => interaction.action === "LIKE") ? "bg-rose-500 hover:bg-rose-600" : "border border-rose-500 bg-white text-rose-500 hover:bg-rose-500 hover:text-white"}`}
                                    >
                                        {customer.model_interactions?.some(interaction => interaction.action === "LIKE")
                                            ? t('profile.liked')
                                            : t('profile.like')}
                                    </Button>
                                </Form>
                                <Form method="post">
                                    <input type="hidden" name="customerId" value={customer.id} />
                                    {customer?.isContact ?
                                        <Button
                                            size="sm"
                                            type="button"
                                            className="cursor-pointer hidden bg-gray-700 sm:block text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                            onClick={() => navigate(`/model/chat?id=${customer.firstName}`)}
                                        >
                                            {t('profile.message')}
                                        </Button>
                                        :
                                        <Button
                                            size="sm"
                                            type="submit"
                                            name="isFriend"
                                            value="true"
                                            className="cursor-pointer hidden bg-white border border-gray-700 hover:bg-gray-700 text-gray-700 sm:block hover:text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                        >
                                            {t('profile.addFriend')}
                                        </Button>
                                    }
                                </Form>
                                <Button
                                    size="sm"
                                    type="button"
                                    className="cursor-pointer hidden bg-gray-600 sm:block text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                    onClick={() => navigate(`/model/customer-profile-share/${customer.id}`)}
                                >
                                    {t('profile.share')}
                                </Button>
                            </div>

                            <div className="flex items-center gap-6 mb-4">
                                <div className='flex items-center gap-1'>
                                    <span className="text-lg text-black font-bold">{formatNumber(customer.totalLikes)}</span>
                                    <span className="text-md text-gray-500 ml-1">{t('profile.like')}</span>
                                </div>
                                <div className='flex items-center gap-1'>
                                    <span className="text-lg text-black font-bold">{formatNumber(customer.totalFriends)}</span>
                                    <span className="text-md text-gray-500 ml-1">{t('profile.friends')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex sm:hidden items-center justify-around w-full mb-4">
                        <div className="w-1/2 text-center flex items-center justify-center gap-3 border-r">
                            <div className="text-lg text-black font-bold">{formatNumber(customer.totalLikes)}</div>
                            <div className="text-md text-gray-500">{t('profile.likes')}</div>
                        </div>
                        <div className="w-1/2 text-center flex items-center justify-center gap-3">
                            <div className="text-lg text-black font-bold">{formatNumber(customer.totalFriends)}</div>
                            <div className="text-md text-gray-500">{t('profile.friends')}</div>
                        </div>
                    </div>
                </div>

                <div className="pb-4">
                    <Tabs defaultValue="account" className="w-full">
                        <TabsList className='w-full mb-2'>
                            <TabsTrigger value="account">{t('profile.tabs.accountInfo')}</TabsTrigger>
                            <TabsTrigger value="images">{t('profile.tabs.images')}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="account">
                            <div className="flex flex-col sm:flex-row items-start justify-between space-y-2">
                                <div className="w-full flex items-start justify-start flex-col space-y-3 text-sm p-2">
                                    <h3 className="text-gray-800 font-bold">{t('profile.personalInfo')}</h3>
                                    <p className='flex items-center'><User size={14} />&nbsp;{t('profile.fullname')}: {customer.firstName}&nbsp;{customer.lastName}</p>
                                    <p className="flex items-center"> <Calendar size={14} />&nbsp;{t('profile.age')}: {calculateAgeFromDOB(customer.dob)} {t('profile.yearsOld')}</p>
                                    <div className="flex items-center"><MarsStroke size={14} />&nbsp;{t('profile.gender')}:&nbsp;&nbsp;
                                        <Badge variant="outline" className={`${customer.gender === "male" ? "bg-gray-700 text-gray-300" : "bg-rose-100 text-rose-500"} px-3 py-1`}>
                                            {capitalize(customer.gender)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center"><ToggleLeft size={14} />&nbsp;{t('profile.status')}:&nbsp;&nbsp;
                                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1">
                                            {capitalize(customer.status)}
                                        </Badge>
                                    </div>
                                    {customer.relationshipStatus && (
                                        <div className="flex items-center"><ToggleLeft size={14} />&nbsp;Relationship:&nbsp;&nbsp;
                                            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 px-3 py-1">
                                                {capitalize(customer.relationshipStatus)}
                                            </Badge>
                                        </div>
                                    )}
                                    {customer.address && <p className="flex items-center"><MapPin size={14} />&nbsp;{t('profile.address')}: {customer.address}</p>}
                                    <p className="flex items-center"><Calendar size={14} />&nbsp;{t('profile.memberSince')}: {new Date(customer.createdAt).toDateString()}</p>
                                    {customer.career && <p className="flex items-center"><BriefcaseBusiness size={14} />&nbsp;{t('profile.career')}: {customer.career}</p>}
                                    {customer.education && <p className="flex items-center"><Book size={14} />&nbsp;{t('profile.education')}: {customer.education}</p>}
                                    {customer.bio && <p className="flex items-center"><User size={14} />&nbsp;{t('profile.bio')}: {customer.bio}</p>}
                                </div>
                                <Separator className="block sm:hidden" />
                                <div className="w-full mb-8 space-y-4">
                                    {customer.interests &&
                                        <div className='space-y-2'>
                                            <h3 className="text-sm text-gray-800 font-bold">{t('profile.interests')}</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.values(customer.interests ?? {}).map((interest, index) => (
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
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="images" className='w-full'>
                            <div className="flex space-x-2 rounded-md h-full">
                                {customer.Images.length > 0 ?
                                    <div className="w-full grid grid-cols-2 gap-2 h-fit">
                                        <div className="flex flex-col items-start justify-start space-y-2">
                                            {customer.Images.slice(0, Math.ceil(customer.Images.length / 2)).map((image, index) => (
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
                                            {customer.Images.slice(Math.ceil(customer.Images.length / 2)).map((image, index) => {
                                                const actualIndex = Math.ceil(customer.Images.length / 2) + index;

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
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div >
    );
};
