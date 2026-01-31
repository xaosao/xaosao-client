import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, BadgeCheck, ChevronLeft, ChevronRight, Loader, Upload, UserRoundPen, X } from 'lucide-react';
import { redirect, useActionData, useFetcher, useNavigate, useNavigation, useSearchParams, type ActionFunctionArgs, type LoaderFunction } from 'react-router';

// components
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// insterface and services
import { calculateAgeFromDOB } from '~/utils';
import { compressImage } from '~/utils/imageCompression';
import { requireUserSession } from '~/services/auths.server';
import type { ICustomerResponse } from '~/interfaces/customer';
import { capitalize, extractFilenameFromCDNSafe } from '~/utils/functions/textFormat';
import { deleteFileFromBunny, uploadFileToBunnyServer } from '~/services/upload.server';
import { createCustomerImage, getCustomerProfile, updateCustomerImage, deleteCustomerImage } from '~/services/profile.server';

interface LoaderReturn {
    customerData: ICustomerResponse;
}

interface TransactionProps {
    loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
    const customerId = await requireUserSession(request)
    const customerData = await getCustomerProfile(customerId)

    return { customerData }
}

export const action = async ({ request }: ActionFunctionArgs) => {
    const customerId = await requireUserSession(request)
    const formData = await request.formData();
    const imageId = formData.get("imageId") as string;
    const imageName = formData.get("imageName") as string;
    const newFile = formData.get("newFile") as File;
    const deleteImage = formData.get("deleteImage") === "true";

    if (!imageId) {
        return { success: false, error: true, message: "Invalid credentials data!" };
    }
    let image = ""
    if (request.method === "POST") {
        try {
            if (newFile && newFile instanceof File && newFile.size > 0) {
                const buffer = Buffer.from(await newFile.arrayBuffer());
                const url = await uploadFileToBunnyServer(buffer, newFile.name, newFile.type);
                image = url;
            }
            const res = await createCustomerImage(customerId, image);
            if (res.id) {
                return { success: true, action: "upload", message: "Upload your image successfully!" };
            }
        } catch (error: any) {
            console.error("Error insert images:", error);

            if (error?.payload) {
                return error.payload;
            }
            if (error && typeof error === "object" && !Array.isArray(error)) {
                const keys = Object.keys(error);
                if (keys.length > 0) {
                    const firstKey = keys[0];
                    const firstMessage = (error as Record<string, any>)[firstKey];

                    return {
                        success: false,
                        error: true,
                        message: `${firstKey}: ${firstMessage}`,
                    };
                }
            }

            return {
                success: false,
                error: true,
                message: error || "Failed to insert user image!",
            };
        }
    }

    if (request.method === "PATCH") {
        try {
            // Handle image deletion
            if (deleteImage) {
                // Delete the image from Bunny CDN if it exists
                if (imageName) {
                    await deleteFileFromBunny(extractFilenameFromCDNSafe(imageName as string));
                }
                // Delete the image record from database
                const res = await deleteCustomerImage(imageId, customerId);
                if (res.id) {
                    return { success: true, action: "delete", imageId, message: "Image deleted successfully!" };
                }
            }
            // Handle image update
            else if (newFile && newFile instanceof File && newFile.size > 0) {
                if (imageName) {
                    await deleteFileFromBunny(extractFilenameFromCDNSafe(imageName as string))
                }
                const buffer = Buffer.from(await newFile.arrayBuffer());
                const url = await uploadFileToBunnyServer(buffer, newFile.name, newFile.type);
                image = url;

                const res = await updateCustomerImage(imageId, customerId, image);
                if (res.id) {
                    return { success: true, action: "update", imageId, message: "Image updated successfully!" };
                }
            } else {
                image = formData.get("imageName") as string;
                const res = await updateCustomerImage(imageId, customerId, image);
                if (res.id) {
                    return { success: true, action: "update", imageId, message: "Image updated successfully!" };
                }
            }

        } catch (error: any) {
            console.error("Error updating images:", error);
            if (error?.payload) {
                return error.payload;
            }

            if (error && typeof error === "object" && !Array.isArray(error)) {
                const keys = Object.keys(error);
                if (keys.length > 0) {
                    const firstKey = keys[0];
                    const firstMessage = (error as Record<string, any>)[firstKey];

                    return {
                        success: false,
                        error: true,
                        message: `${firstKey}: ${firstMessage}`,
                    };
                }
            }

            return {
                success: false,
                error: true,
                message: error || "Failed to update user images!",
            };
        }
    }
    return { success: false, error: true, message: "Invalid request method!" };
};

export default function ProfilePage({ loaderData }: TransactionProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const [searchParams] = useSearchParams();
    const fetcher = useFetcher();
    const actionData = useActionData<typeof action>()
    const { customerData } = loaderData;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedImageId, setSelectedImageId] = React.useState<string | null>(null);
    const [selectedImageName, setSelectedImageName] = React.useState<string | null>(null);
    const [uploadingImageId, setUploadingImageId] = React.useState<string | null>(null);
    const [deletingImageId, setDeletingImageId] = React.useState<string | null>(null);
    const [isCompressing, setIsCompressing] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState("images");

    // Image preview states
    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
    const [touchStartX, setTouchStartX] = React.useState<number | null>(null);
    const [touchEndX, setTouchEndX] = React.useState<number | null>(null);
    const [showProfileFullscreen, setShowProfileFullscreen] = React.useState(false);

    const DEFAULT_IMAGE = "https://coffective.com/wp-content/uploads/2018/06/default-featured-image.png.jpg";
    // Only show full-screen loading on initial page load, not during data revalidation after fetcher submissions
    const isLoading = navigation.state === "loading" && fetcher.state === "idle";

    const getInterests = (): string[] => {
        if (!customerData?.interests) return [];
        if (Array.isArray(customerData.interests)) return customerData.interests;
        if (typeof customerData.interests === 'string') {
            try {
                return JSON.parse(customerData.interests);
            } catch {
                return [];
            }
        }
        return Object.values(customerData.interests);
    };
    const isUpdating =
        navigation.state !== "idle" && navigation.formMethod === "PATCH"
    const isSubmitting =
        navigation.state !== "idle" && navigation.formMethod === "POST"

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

    // Handle fetcher responses without page reload
    React.useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data) {
            const { success, action, imageId, message } = fetcher.data;

            if (success) {
                // Clear loading states
                setUploadingImageId(null);
                setDeletingImageId(null);
                setIsCompressing(false);

                // Show success toast
                if (message) {
                    showToast(message, "success");
                }

                // Keep user on images tab
                setActiveTab("images");
            } else {
                // Error: Clear loading states and show error toast
                setUploadingImageId(null);
                setDeletingImageId(null);
                setIsCompressing(false);

                if (message) {
                    showToast(message, "error");
                }
            }
        }
    }, [fetcher.state, fetcher.data]);

    const makeColumn = (images: { id: string; name: string }[]) => {
        const slots = [...images];
        while (slots.length < 3) {
            slots.push({ id: `placeholder-${slots.length}`, name: DEFAULT_IMAGE });
        }
        return slots.slice(0, 3);
    };

    const firstCol = makeColumn(customerData.Images.slice(0, Math.ceil(customerData.Images.length / 2)));
    const secondCol = makeColumn(customerData.Images.slice(Math.ceil(customerData.Images.length / 2)));

    // Image preview - all real images (not placeholders)
    const allImages = [...firstCol, ...secondCol].filter(img => !img.id.startsWith('placeholder'));

    const handleAddNew = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleDeleteImage = (imageId: string, imageName: string) => {
        if (imageId.startsWith('placeholder')) return;

        setDeletingImageId(imageId);
        setActiveTab("images"); // Stay on images tab

        // Submit delete request to server (server will handle Bunny deletion)
        const formData = new FormData();
        formData.append("imageId", imageId);
        formData.append("imageName", imageName);
        formData.append("deleteImage", "true");

        fetcher.submit(formData, {
            method: "patch",
            action: "/customer/profile",
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && selectedImageId && selectedImageName) {
            const file = e.target.files[0];

            // Set compressing state and stay on images tab
            setIsCompressing(true);
            setUploadingImageId(selectedImageId);
            setActiveTab("images");

            try {
                // Compress the image (also handles HEIC conversion)
                // Use lower threshold to ensure file stays under Vercel's 4.5MB body limit
                const compressedFile = await compressImage(file, {
                    maxWidth: 1600,
                    maxHeight: 1600,
                    quality: 0.7,
                    maxSizeMB: 1,
                });

                const formData = new FormData();
                formData.append("imageId", selectedImageId);
                formData.append("imageName", selectedImageName);
                formData.append("newFile", compressedFile);

                // Check if imageId starts with "placeholder"
                const method = selectedImageId.startsWith("placeholder") ? "post" : "patch";

                fetcher.submit(formData, {
                    method,
                    encType: "multipart/form-data",
                    action: "/customer/profile",
                });
            } catch (error) {
                console.error("Error compressing image:", error);
                setUploadingImageId(null);
            } finally {
                setIsCompressing(false);
            }
        }
    };

    // Reset uploading/deleting state when fetcher completes
    React.useEffect(() => {
        if (fetcher.state === 'idle') {
            if (uploadingImageId) setUploadingImageId(null);
            if (deletingImageId) setDeletingImageId(null);
        }
    }, [fetcher.state, uploadingImageId, deletingImageId]);

    // Set active tab to "images" if URL hash is #images (after upload redirect)
    React.useEffect(() => {
        if (window.location.hash === '#images') {
            setActiveTab('images');
        }
    }, []);

    // Keyboard navigation for lightbox
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedIndex === null) return;

            if (e.key === 'Escape') {
                setSelectedIndex(null);
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIndex]);

    const handlePrev = () => {
        if (selectedIndex === null) return;
        setSelectedIndex((prev) => (prev! - 1 + allImages.length) % allImages.length);
    };

    const handleNext = () => {
        if (selectedIndex === null) return;
        setSelectedIndex((prev) => (prev! + 1) % allImages.length);
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

    // Remove full screen loading - show per-image loading instead

    const renderImage = (image: { id: string; name: string }, index: number, sizePattern: string[], imageIndex: number) => {
        const sizeClass = sizePattern[index % sizePattern.length];
        const isUploading = uploadingImageId === image.id;
        const isDeleting = deletingImageId === image.id;
        const isBusy = isUploading || isDeleting;
        const isPlaceholder = image.id.startsWith('placeholder');
        const hasImage = !isPlaceholder && image.name !== DEFAULT_IMAGE;

        const handleImageClick = () => {
            if (!isPlaceholder && imageIndex >= 0 && !isBusy) {
                console.log('Image clicked:', { imageIndex, image, allImages });
                setSelectedIndex(imageIndex);
            }
        };

        return (
            <div
                key={image.id}
                className={`relative w-full group overflow-hidden rounded-lg transition-all ${!isPlaceholder ? 'hover:ring-2 hover:ring-rose-500' : ''}`}
                onClick={handleImageClick}
                style={{ cursor: !isPlaceholder && !isBusy ? 'pointer' : 'default' }}
            >
                <img
                    src={image.name}
                    alt={`Profile ${index + 1}`}
                    className={`w-full ${sizeClass} object-cover shadow-sm transition-transform duration-300 ease-in-out ${!isPlaceholder ? 'group-hover:scale-105' : ''} ${isBusy ? 'opacity-50' : ''}`}
                />
                {isBusy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg pointer-events-none z-10">
                        <div className="flex flex-col items-center gap-2 text-white">
                            <Loader className="w-8 h-8 animate-spin" />
                            <p className="text-sm font-medium">
                                {isDeleting ? 'Deleting...' : isCompressing ? t('profileEdit.compressing') : t('profile.uploading')}
                            </p>
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-end justify-center rounded-lg transition gap-2 z-20 pointer-events-none pb-5">
                    {hasImage ? (
                        // Show "New" and "Delete" buttons for uploaded images
                        <>
                            <button
                                type="button"
                                className="flex text-white bg-blue-500 hover:bg-blue-600 rounded-sm px-2 py-1 text-xs pointer-events-auto shadow-md gap-1 cursor-pointer disabled:opacity-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedImageId(image.id);
                                    setSelectedImageName(image.name);
                                    setActiveTab("images");
                                    handleAddNew();
                                }}
                                disabled={isBusy}
                            >
                                <Upload size={14} />
                                New
                            </button>
                            <button
                                type="button"
                                className="flex text-white bg-red-500 hover:bg-red-600 rounded-sm px-2 py-1 text-xs pointer-events-auto shadow-md gap-1 cursor-pointer disabled:opacity-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteImage(image.id, image.name);
                                }}
                                disabled={isBusy}
                            >
                                <X size={14} />
                                Delete
                            </button>
                        </>
                    ) : (
                        // Show "Upload New" for placeholders/empty slots
                        <button
                            type="button"
                            className="flex text-rose-500 bg-rose-100 border border-rose-300 rounded-sm px-2 py-1 text-xs pointer-events-auto shadow-md gap-1 cursor-pointer disabled:opacity-50"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImageId(image.id);
                                setSelectedImageName(image.name);
                                setActiveTab("images");
                                handleAddNew();
                            }}
                            disabled={isBusy}
                        >
                            <Upload size={14} />
                            Upload New
                        </button>
                    )}
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="h-11/12 flex justify-center items-center min-h-[200px]">
                <Loader className="w-6 h-6 animate-spin text-rose-500" />&nbsp; {t('profile.processing')}
            </div>
        )
    }

    return (
        <div className="h-auto sm:min-h-screen bg-white px-0 sm:px-6 py-6 sm:py-2">
            <div className="w-full flex flex-col sm:flex-row gap-0 sm:gap-2 bg-white h-auto sm:h-full">
                <div className="w-full sm:w-5/12 p-0 sm:p-2 border-r space-y-2">
                    {/* <div className="flex items-start justify-between sm:justify-end px-4">
                        <div className="flex sm:hidden items-center">
                            <UserPlus className="w-5 h-5 text-gray-500 cursor-pointer" />
                        </div>
                        <div className="flex items-start gap-4">
                            <Forward className="w-5 h-5 text-gray-500 cursor-pointer" onClick={() => navigate("/customer/profile-share/userid")} />
                            <Settings className="w-5 h-5 text-gray-500 cursor-pointer" onClick={() => navigate("/customer/setting")} />
                        </div>
                    </div> */}
                    <div className="rounded-md flex items-center justify-center flex-col space-y-2 sm:space-y-4 px-2 sm:px-4">
                        <div
                            className="w-[100px] sm:w-[130px] h-[100px] sm:h-[130px] border-[2px] border-rose-500 rounded-full flex items-center justify-center hover:border-rose-600 cursor-pointer"
                            onClick={() => setShowProfileFullscreen(true)}
                        >
                            <img
                                src={customerData.profile}
                                alt="Profile"
                                className="w-full h-full rounded-full object-cover"
                            />
                        </div>

                        <div className="flex items-center justify-center gap-2 text-center ml-10">
                            <div className="flex items-center justify-center gap-2 mb-1 px-4 py-0.5 rounded-full bg-gray-100">
                                <h2 className="text-md sm:text-lg text-gray-800">{customerData.firstName}&nbsp;{customerData.lastName}</h2>
                                <BadgeCheck className="w-4 h-4 text-rose-500" />
                            </div>
                            <div
                                className="flex items-center justify-center gap-2 mb-1 px-4 py-2 rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200"
                                onClick={() => navigate(`/customer/profile-edit/${customerData.id}`)}
                            >
                                <UserRoundPen className="w-4 h-4" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between w-full">
                            <div className="w-full text-center border-r">
                                <div className="text-xl text-black mb-1">{customerData.interactions.passCount ?? 0}</div>
                                <div className="text-xs text-rose-600 uppercase font-bold">{t('profile.passYou')}</div>
                            </div>
                            <div className="w-full text-center">
                                <div className="text-xl text-black mb-1">{customerData.interactions.likeCount}</div>
                                <div className="text-xs text-rose-600 uppercase font-bold">{t('profile.likeYou')}</div>
                            </div>
                            {/* <div className="w-full text-center">
                                <div className="text-xl text-black mb-1">2,000</div>
                                <div className="text-xs text-rose-600 uppercase font-bold">{t('profile.matches')}</div>
                            </div> */}
                        </div>

                        {/* Desktop screen  */}
                        <div className="hidden sm:block">
                            <Separator />
                        </div>
                        <div className="w-full hidden sm:flex items-start justify-start flex-col space-y-2 text-sm">
                            <h3 className="text-md text-gray-800 font-bold">{t('profile.personalInfo')}</h3>
                            <p>{t('profile.id')}:&nbsp;<span className="font-semibold">{customerData.number}</span></p>
                            <p>{t('profile.fullname')}:&nbsp;<span className="font-semibold">{customerData.firstName}&nbsp;{customerData.lastName}</span></p>
                            <p>{t('profile.age')}:&nbsp;<span className="font-semibold">{calculateAgeFromDOB(customerData.dob)} {t('profile.yearsOld')}</span></p>
                            <p>{t('profile.gender')}:&nbsp;<span className="font-semibold">{customerData.gender}</span></p>
                            <p>{t('profile.whatsapp')}:&nbsp;<span className="font-semibold">{customerData.whatsapp}</span></p>
                            <div>{t('profile.status')}:&nbsp;&nbsp;
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1 font-semibold">
                                    {capitalize(customerData.status)}
                                </Badge>
                            </div>
                            {customerData.relationshipStatus &&
                                <div>
                                    {t('profile.relationshipStatus')}:&nbsp;&nbsp;
                                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-0.5 font-semibold">
                                        {capitalize(customerData.relationshipStatus)}
                                    </Badge>
                                </div>
                            }
                            {customerData.bio && <p>{t('profile.bio')}:&nbsp;<span className="font-semibold">{customerData.bio}</span></p>}
                            {customerData.career && <p>{t('profile.career')}:&nbsp;<span className="font-semibold">{customerData.career}</span></p>}
                            {customerData.education && <p>{t('profile.education')}:&nbsp;<span className="font-semibold">{customerData.education}</span></p>}
                            <p>{t('profile.memberSince')}:&nbsp;<span className="font-semibold">{customerData.createdAt.toDateString()}</span></p>
                        </div>

                        <div className="hidden sm:block">
                            <Separator />
                        </div>
                        <div className="hidden sm:block w-full mb-8">
                            <h3 className="text-sm font-semibold text-gray-800 mb-3">{t('profile.interests')}</h3>
                            <div className="flex flex-wrap gap-2">
                                {getInterests().map((interest, index) => (
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
                    </div>
                </div>

                <div className="w-full sm:w-7/12 space-y-4 h-auto sm:h-3/5 p-4 sm:p-2">
                    <div className="hidden sm:flex space-x-2 rounded-md h-full">
                        <div>
                            {actionData?.error && (
                                <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                                    <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                                    <span className="text-red-500 text-sm">
                                        {capitalize(actionData.message)}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="w-full grid grid-cols-2 gap-2 h-fit p-4">
                            <div className="flex flex-col items-center justify-center space-y-2">
                                {firstCol.map((image, index) => {
                                    const imageIndex = allImages.findIndex(img => img.id === image.id);
                                    return renderImage(image, index, ["h-48 sm:h-72", "h-48 sm:h-72", "h-48"], imageIndex);
                                })}
                            </div>

                            <div className="flex flex-col items-center justify-center space-y-2">
                                {secondCol.map((image, index) => {
                                    const imageIndex = allImages.findIndex(img => img.id === image.id);
                                    return renderImage(image, index, ["h-48", "h-48 sm:h-72", "h-48 sm:h-72"], imageIndex);
                                })}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*,.heic,.heif"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>
                    {/* Mobile screen  */}
                    <div className="block sm:hidden">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className='w-full'>
                                <TabsTrigger value="account">{t('profile.tabs.accountInfo')}</TabsTrigger>
                                <TabsTrigger value="interest">{t('profile.tabs.interest')}</TabsTrigger>
                                <TabsTrigger value="images">{t('profile.tabs.images')}</TabsTrigger>
                            </TabsList>
                            <TabsContent value="account">
                                <div className="w-full flex items-start justify-start flex-col space-y-2 text-sm p-2">
                                    <h3 className="text-md text-gray-800 font-bold">{t('profile.personalInfo')}</h3>
                                    <p>{t('profile.id')}:&nbsp;<span className="font-semibold">{customerData.number}</span></p>
                                    <p>{t('profile.fullname')}:&nbsp;<span className="font-semibold">{customerData.firstName}&nbsp;{customerData.lastName}</span></p>
                                    <p>{t('profile.age')}:&nbsp;<span className="font-semibold">{calculateAgeFromDOB(customerData.dob)} {t('profile.yearsOld')}</span></p>
                                    <p>{t('profile.gender')}:&nbsp;<span className="font-semibold">{customerData.gender}</span></p>
                                    <p>{t('profile.whatsapp')}:&nbsp;<span className="font-semibold">{customerData.whatsapp}</span></p>
                                    <div>{t('profile.status')}:&nbsp;&nbsp;
                                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1 font-semibold">
                                            {customerData.status}
                                        </Badge>
                                    </div>
                                    <div>{t('profile.relationshipStatus')}:&nbsp;&nbsp;
                                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1 font-semibold">
                                            {customerData.relationshipStatus}
                                        </Badge>
                                    </div>
                                    {customerData.bio && <p>{t('profile.bio')}:&nbsp;<span className="font-semibold">{customerData.bio}</span></p>}
                                    {customerData.career && <p>{t('profile.career')}:&nbsp;<span className="font-semibold">{customerData.career}</span></p>}
                                    {customerData.education && <p>{t('profile.education')}:&nbsp;<span className="font-semibold">{customerData.education}</span></p>}
                                    <p>{t('profile.memberSince')}:&nbsp;<span className="font-semibold">{customerData.createdAt.toDateString()}</span></p>
                                </div>
                            </TabsContent>
                            <TabsContent value="interest">
                                <div className="w-full mb-8">
                                    <h3 className="text-sm font-semibold text-gray-800 mb-3">{t('profile.interests')}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {getInterests().map((interest, index) => (
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
                            </TabsContent>
                            <TabsContent value="images">
                                <div className="flex space-x-2 rounded-md h-full">
                                    <div className="w-full grid grid-cols-2 gap-1 sm:gap-2 h-fit p-0 sm:p-4">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            {firstCol.map((image, index) => {
                                                const imageIndex = allImages.findIndex(img => img.id === image.id);
                                                return renderImage(image, index, ["h-48 sm:h-72", "h-48 sm:h-72", "h-48"], imageIndex);
                                            })}
                                        </div>

                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            {secondCol.map((image, index) => {
                                                const imageIndex = allImages.findIndex(img => img.id === image.id);
                                                return renderImage(image, index, ["h-48", "h-48 sm:h-72", "h-48 sm:h-72"], imageIndex);
                                            })}
                                        </div>

                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept="image/*,.heic,.heif"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                </div >

                {/* Image Preview Lightbox */}
                {selectedIndex !== null && allImages.length > 0 && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
                        onClick={(e) => {
                            // Close when clicking the backdrop (not the image)
                            if (e.target === e.currentTarget) {
                                setSelectedIndex(null);
                            }
                        }}
                    >
                        <button
                            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 z-50 touch-manipulation"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedIndex(null);
                            }}
                            onTouchEnd={(e) => {
                                e.stopPropagation();
                                setSelectedIndex(null);
                            }}
                        >
                            <X size={32} />
                        </button>

                        <button
                            className="absolute left-4 text-white hidden sm:block bg-black/50 hover:bg-black/70 rounded-full p-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePrev();
                            }}
                        >
                            <ChevronLeft size={40} />
                        </button>

                        <img
                            src={allImages[selectedIndex].name}
                            alt="Selected"
                            className="h-full sm:max-h-[80vh] w-full sm:max-w-[90vw] object-contain rounded-lg shadow-lg"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        />

                        <button
                            className="absolute right-4 text-white hidden sm:block bg-black/50 hover:bg-black/70 rounded-full p-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleNext();
                            }}
                        >
                            <ChevronRight size={40} />
                        </button>
                    </div>
                )}

                {/* Profile Image Fullscreen */}
                {showProfileFullscreen && customerData.profile && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 cursor-pointer"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setShowProfileFullscreen(false);
                            }
                        }}
                    >
                        <button
                            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 z-50 touch-manipulation transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowProfileFullscreen(false);
                            }}
                            onTouchEnd={(e) => {
                                e.stopPropagation();
                                setShowProfileFullscreen(false);
                            }}
                        >
                            <X size={32} />
                        </button>
                        <img
                            src={customerData.profile}
                            alt="Profile"
                            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <p className="absolute bottom-4 text-white/70 text-sm">{t('profile.clickToClose')}</p>
                    </div>
                )}
            </div >
        </div >
    );
}