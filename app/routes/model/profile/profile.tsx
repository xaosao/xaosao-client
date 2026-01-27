import React, { useRef } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, useNavigation, useSearchParams, redirect, useFetcher } from 'react-router';
import { BadgeCheck, Settings, User, Calendar, MarsStroke, ToggleLeft, MapPin, Star, ChevronLeft, ChevronRight, X, Pencil, Book, BriefcaseBusiness, Trash2, Upload, Loader, Info, Plus, UserRoundPen, MoreVertical, UserPen, SquareArrowOutUpRight } from 'lucide-react';

// components
import {
    Card,
    CardTitle,
    CardFooter,
    CardHeader,
    CardContent,
    CardDescription,
} from "~/components/ui/card"
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogHeader,
    DialogDescription,
} from "~/components/ui/dialog";
import Rating from '~/components/ui/rating';
import { Badge } from '~/components/ui/badge';
import EmptyPage from '~/components/ui/empty';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

// services and utils
import { requireModelSession } from '~/services/model-auth.server';
import { compressImage } from '~/utils/imageCompression';
import { calculateAgeFromDOB, formatCurrency, formatNumber } from '~/utils';
import type { IModelOwnProfileResponse, IModelBank } from '~/interfaces/model-profile';
import { deleteFileFromBunny, uploadFileToBunnyServer } from '~/services/upload.server';
import { capitalize, getFirstWord, extractFilenameFromCDNSafe } from '~/utils/functions/textFormat';
import { getModelOwnProfile, createModelImage, deleteModelImage, updateModelImage, getModelBanks, createModelBank, updateModelBank, deleteModelBank, setDefaultBank } from '~/services/model-profile.server';

const MAX_IMAGES = 6;

export const meta: MetaFunction = () => {
    return [
        { title: "My Profile - Model Dashboard" },
        { name: "description", content: "View and manage your model profile" },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const modelId = await requireModelSession(request);
    const [model, banks] = await Promise.all([
        getModelOwnProfile(modelId),
        getModelBanks(modelId),
    ]);
    return { model, banks };
}

export async function action({ request }: ActionFunctionArgs) {
    const modelId = await requireModelSession(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;

    // Handle bank create action
    if (actionType === "createBank") {
        const qrCodeFile = formData.get("qr_code_file") as File;

        // QR code is required
        if (!qrCodeFile || !(qrCodeFile instanceof File) || qrCodeFile.size === 0) {
            return redirect(`/model/profile?error=${encodeURIComponent("modelProfile.errors.qrCodeRequired")}&tab=banks`);
        }

        try {
            // Upload QR code image
            const buffer = Buffer.from(await qrCodeFile.arrayBuffer());
            const qrCodeUrl = await uploadFileToBunnyServer(buffer, qrCodeFile.name, qrCodeFile.type);

            await createModelBank(modelId, {
                qr_code: qrCodeUrl,
            });
            return redirect(`/model/profile?success=${encodeURIComponent("modelProfile.success.bankCreated")}&tab=banks`);
        } catch (error: any) {
            return redirect(`/model/profile?error=${encodeURIComponent(error.message || "modelProfile.errors.bankCreateFailed")}&tab=banks`);
        }
    }

    // Handle bank update action
    if (actionType === "updateBank") {
        const bankId = formData.get("bankId") as string;
        const qrCodeFile = formData.get("qr_code_file") as File;
        const existingQrCode = formData.get("existing_qr_code") as string;

        if (!bankId) {
            return redirect(`/model/profile?error=${encodeURIComponent("modelProfile.errors.bankIdRequired")}&tab=banks`);
        }

        // Must have QR code (either existing or new)
        const hasNewQrCode = qrCodeFile && qrCodeFile instanceof File && qrCodeFile.size > 0;
        if (!existingQrCode && !hasNewQrCode) {
            return redirect(`/model/profile?error=${encodeURIComponent("modelProfile.errors.qrCodeRequired")}&tab=banks`);
        }

        try {
            let qrCodeUrl: string = existingQrCode;

            // Upload new QR code image if provided
            if (hasNewQrCode) {
                // Delete old QR code from BunnyCDN if exists
                if (existingQrCode) {
                    await deleteFileFromBunny(extractFilenameFromCDNSafe(existingQrCode));
                }
                const buffer = Buffer.from(await qrCodeFile.arrayBuffer());
                qrCodeUrl = await uploadFileToBunnyServer(buffer, qrCodeFile.name, qrCodeFile.type);
            }

            await updateModelBank(bankId, modelId, {
                qr_code: qrCodeUrl,
            });
            return redirect(`/model/profile?success=${encodeURIComponent("modelProfile.success.bankUpdated")}&tab=banks`);
        } catch (error: any) {
            return redirect(`/model/profile?error=${encodeURIComponent(error.message || "modelProfile.errors.bankUpdateFailed")}&tab=banks`);
        }
    }

    // Handle bank delete action
    if (actionType === "deleteBank") {
        const bankId = formData.get("bankId") as string;
        if (!bankId) {
            return redirect(`/model/profile?error=${encodeURIComponent("modelProfile.errors.bankIdRequired")}&tab=banks`);
        }
        try {
            await deleteModelBank(bankId, modelId);
            return redirect(`/model/profile?success=${encodeURIComponent("modelProfile.success.bankDeleted")}&tab=banks`);
        } catch (error: any) {
            return redirect(`/model/profile?error=${encodeURIComponent(error.message || "modelProfile.errors.bankDeleteFailed")}&tab=banks`);
        }
    }

    // Handle set default bank action
    if (actionType === "setDefaultBank") {
        const bankId = formData.get("bankId") as string;
        if (!bankId) {
            return redirect(`/model/profile?error=${encodeURIComponent("modelProfile.errors.bankIdRequired")}&tab=banks`);
        }
        try {
            await setDefaultBank(bankId, modelId);
            return redirect(`/model/profile?success=${encodeURIComponent("modelProfile.success.bankSetAsDefault")}&tab=banks`);
        } catch (error: any) {
            return redirect(`/model/profile?error=${encodeURIComponent(error.message || "modelProfile.errors.setDefaultFailed")}&tab=banks`);
        }
    }

    // Handle image actions
    const imageId = formData.get("imageId") as string;
    const imageName = formData.get("imageName") as string;
    const newFile = formData.get("newFile") as File;

    // Handle delete action
    if (actionType === "delete") {
        if (!imageId) {
            return redirect(`/model/profile?error=${encodeURIComponent("modelProfile.errors.imageIdRequired")}&tab=images`);
        }

        try {
            // Delete file from BunnyCDN if imageName exists
            if (imageName) {
                await deleteFileFromBunny(extractFilenameFromCDNSafe(imageName));
            }
            await deleteModelImage(imageId, modelId);
            return redirect(`/model/profile?success=${encodeURIComponent("modelProfile.success.imageDeleted")}&tab=images`);
        } catch (error: any) {
            return redirect(`/model/profile?error=${encodeURIComponent(error.message || "modelProfile.errors.imageDeleteFailed")}&tab=images`);
        }
    }

    // Handle upload (POST - new image) or update (PATCH - replace existing image)
    const isNewUpload = imageId?.startsWith("placeholder");

    if (newFile && newFile instanceof File && newFile.size > 0) {
        try {
            let imageUrl = "";

            // Delete old file from BunnyCDN if updating existing image
            if (!isNewUpload && imageName) {
                await deleteFileFromBunny(extractFilenameFromCDNSafe(imageName));
            }

            // Upload new file to BunnyCDN
            const buffer = Buffer.from(await newFile.arrayBuffer());
            imageUrl = await uploadFileToBunnyServer(buffer, newFile.name, newFile.type);

            if (isNewUpload) {
                // Create new image record in database
                const res = await createModelImage(modelId, imageUrl);
                if (res.id) {
                    return redirect(`/model/profile?success=${encodeURIComponent("modelProfile.success.imageUploaded")}&tab=images`);
                }
            } else {
                // Update existing image record in database
                const res = await updateModelImage(imageId, modelId, imageUrl);
                if (res.id) {
                    return redirect(`/model/profile?success=${encodeURIComponent("modelProfile.success.imageUpdated")}&tab=images`);
                }
            }
        } catch (error: any) {
            console.error("Error uploading/updating image:", error);
            return redirect(`/model/profile?error=${encodeURIComponent(error?.message || "modelProfile.errors.imageUploadFailed")}&tab=images`);
        }
    }

    return null;
}

export default function ModelProfilePage() {
    const { t } = useTranslation();
    const fetcher = useFetcher();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { model, banks } = useLoaderData<{ model: IModelOwnProfileResponse; banks: IModelBank[] }>();

    const images = model.Images;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const qrCodeInputRef = useRef<HTMLInputElement>(null);

    // Refs for immediate access to selected image (avoids closure issues)
    const selectedImageIdRef = useRef<string | null>(null);
    const selectedImageNameRef = useRef<string | null>(null);

    // States for file upload and delete
    const [selectedImageId, setSelectedImageId] = React.useState<string | null>(null);
    const [uploadingImageId, setUploadingImageId] = React.useState<string | null>(null);
    const [deletingImageId, setDeletingImageId] = React.useState<string | null>(null);
    const [deletingBankId, setDeletingBankId] = React.useState<string | null>(null);
    const [selectedImageName, setSelectedImageName] = React.useState<string | null>(null);
    const [isCompressing, setIsCompressing] = React.useState(false);

    // States for bank modal
    const [isBankModalOpen, setIsBankModalOpen] = React.useState(false);
    const [isBankSubmitting, setIsBankSubmitting] = React.useState(false);
    const [editingBank, setEditingBank] = React.useState<IModelBank | null>(null);
    const [qrCodeFile, setQrCodeFile] = React.useState<File | null>(null);
    const [qrCodePreview, setQrCodePreview] = React.useState<string | null>(null);

    // States for delete confirmation modal
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [bankToDelete, setBankToDelete] = React.useState<IModelBank | null>(null);

    // States for image preview
    const [touchEndX, setTouchEndX] = React.useState<number | null>(null);
    const [touchStartX, setTouchStartX] = React.useState<number | null>(null);
    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
    const [showProfileFullscreen, setShowProfileFullscreen] = React.useState(false);

    const errorMessage = searchParams.get("error");
    const successMessage = searchParams.get("success");
    const activeTab = searchParams.get("tab") || "account";

    const canUploadMore = images.length < MAX_IMAGES;
    const remainingSlots = MAX_IMAGES - images.length;

    const isSubmitting = navigation.state !== "idle" || fetcher.state !== "idle" || isCompressing;

    // Helper function to get translated service name
    const getServiceName = (nameKey: string) => {
        const translatedName = t(`modelServices.serviceItems.${nameKey}.name`);
        // If translation not found, return the original key
        return translatedName.includes('modelServices.serviceItems') ? nameKey : translatedName;
    };

    // Helper function to get translated service description
    const getServiceDescription = (nameKey: string, fallbackDescription: string | null) => {
        const translatedDesc = t(`modelServices.serviceItems.${nameKey}.description`);
        // If translation not found, return the original description or noDescription
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

    // Handle file selection and upload
    const handleFileInputClick = (imageId: string, imageName: string) => {
        // Set refs immediately for use in handleFileChange (avoids closure issues)
        selectedImageIdRef.current = imageId;
        selectedImageNameRef.current = imageName;
        setSelectedImageId(imageId);
        setSelectedImageName(imageName);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // Use refs to get the current values (avoids closure issues with state)
        const imageId = selectedImageIdRef.current;
        const imageName = selectedImageNameRef.current;

        if (e.target.files && e.target.files[0] && imageId) {
            const file = e.target.files[0];

            // Force synchronous state update to show loading overlay immediately
            flushSync(() => {
                setIsCompressing(true);
                setUploadingImageId(imageId);
            });

            try {
                // Compress the image (also handles HEIC conversion)
                // Use lower threshold to ensure file stays under Vercel's 4.5MB body limit
                const compressedFile = await compressImage(file, {
                    maxWidth: 1600,
                    maxHeight: 1600,
                    quality: 0.7,
                    maxSizeMB: 1,
                });

                // Done compressing, now uploading
                flushSync(() => {
                    setIsCompressing(false);
                });

                const formData = new FormData();
                formData.append("imageId", imageId);
                formData.append("imageName", imageName || "");
                formData.append("newFile", compressedFile);

                fetcher.submit(formData, {
                    method: "post",
                    encType: "multipart/form-data",
                });
            } catch (error) {
                console.error("Error compressing image:", error);
                flushSync(() => {
                    setUploadingImageId(null);
                    setIsCompressing(false);
                });
            }

            // Reset file input
            e.target.value = "";
        }
    };

    // Reset uploading/deleting state when fetcher completes
    React.useEffect(() => {
        if (fetcher.state === 'idle') {
            if (uploadingImageId) setUploadingImageId(null);
            if (deletingImageId) setDeletingImageId(null);
            if (deletingBankId) setDeletingBankId(null);
            if (isBankSubmitting) setIsBankSubmitting(false);
        }
    }, [fetcher.state, uploadingImageId, deletingImageId, deletingBankId, isBankSubmitting]);

    // Handle delete image
    const handleDeleteImage = (imageId: string, imageName: string) => {
        setDeletingImageId(imageId);
        const formData = new FormData();
        formData.append("actionType", "delete");
        formData.append("imageId", imageId);
        formData.append("imageName", imageName);
        fetcher.submit(formData, { method: "post" });
    };

    // Handle open delete confirmation modal
    const handleOpenDeleteBankModal = (bank: IModelBank) => {
        setBankToDelete(bank);
        setIsDeleteModalOpen(true);
    };

    // Handle close delete confirmation modal
    const handleCloseDeleteBankModal = () => {
        setIsDeleteModalOpen(false);
        setBankToDelete(null);
    };

    // Handle confirm delete bank
    const handleConfirmDeleteBank = () => {
        if (!bankToDelete) return;
        setDeletingBankId(bankToDelete.id);
        const formData = new FormData();
        formData.append("actionType", "deleteBank");
        formData.append("bankId", bankToDelete.id);
        fetcher.submit(formData, { method: "post" });
        handleCloseDeleteBankModal();
    };

    // Handle open bank modal for create
    const handleOpenCreateBankModal = () => {
        setEditingBank(null);
        setQrCodeFile(null);
        setQrCodePreview(null);
        setIsBankModalOpen(true);
    };

    // Handle open bank modal for edit
    const handleOpenEditBankModal = (bank: IModelBank) => {
        setEditingBank(bank);
        setQrCodeFile(null);
        setQrCodePreview(bank.qr_code);
        setIsBankModalOpen(true);
    };

    // Handle close bank modal
    const handleCloseBankModal = () => {
        setIsBankModalOpen(false);
        setEditingBank(null);
        setQrCodeFile(null);
        setQrCodePreview(null);
    };

    // Handle QR code file selection
    const handleQrCodeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setQrCodeFile(file);
            // Create preview URL
            const previewUrl = URL.createObjectURL(file);
            setQrCodePreview(previewUrl);
        }
    };

    // Handle remove QR code
    const handleRemoveQrCode = () => {
        setQrCodeFile(null);
        setQrCodePreview(null);
        if (qrCodeInputRef.current) {
            qrCodeInputRef.current.value = "";
        }
    };

    // Handle bank form submit
    const handleBankFormSubmit = () => {
        setIsBankSubmitting(true);
        const formData = new FormData();

        if (qrCodeFile) {
            formData.append("qr_code_file", qrCodeFile);
        }

        if (editingBank) {
            formData.append("actionType", "updateBank");
            formData.append("bankId", editingBank.id);
            if (editingBank.qr_code && !qrCodeFile) {
                formData.append("existing_qr_code", editingBank.qr_code);
            }
        } else {
            formData.append("actionType", "createBank");
        }

        fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
    };

    // Close bank modal when submission is complete
    React.useEffect(() => {
        if (fetcher.state === 'idle' && isBankSubmitting) {
            setIsBankSubmitting(false);
            handleCloseBankModal();
        }
    }, [fetcher.state, isBankSubmitting]);

    // Clear messages after 5 seconds
    React.useEffect(() => {
        if (successMessage || errorMessage) {
            const timeout = setTimeout(() => {
                searchParams.delete("success");
                searchParams.delete("error");
                setSearchParams(searchParams, { replace: true });
            }, 5000);
            return () => clearTimeout(timeout);
        }
    }, [successMessage, errorMessage, searchParams, setSearchParams]);

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

    // Show full-page loading overlay when compressing or uploading images
    if (isCompressing || uploadingImageId) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="flex flex-col items-center justify-center bg-white p-6 rounded-xl shadow-md gap-3">
                    <Loader className="w-6 h-6 animate-spin text-rose-500" />
                    <p className="text-gray-600 font-medium">
                        {isCompressing ? t("profileEdit.compressing") : t("modelProfile.images.uploading")}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-auto sm:h-screen flex items-center justify-center">
            <div className="w-11/12 sm:w-4/5 h-full">
                <div className="px-2 sm:px-6 py-2 sm:py-8 space-y-2">
                    <div className="flex sm:hidden items-start justify-end px-0 sm:px-4">
                        <div className="flex sm:hidden items-center gap-2">
                            <Button
                                size="sm"
                                type="button"
                                className="flex items-center justify-center cursor-pointer sm:hidden text-gray-500 bg-white hover:bg-gray-500 hover:text-white px-4 font-medium text-sm transition-all duration-200 rounded-md bg-rose-50 border border-rose-100 text-rose-500"
                                onClick={() => navigate('/model/referral')}
                            >
                                <SquareArrowOutUpRight className="w-4 h-4" />
                                <span>{t("modelProfile.referral")}</span>
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center sm:justify-start gap-6">
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
                                <h2 className="text-lg text-gray-800">{`${model.firstName} ${model.lastName || ''}`}</h2>
                                <BadgeCheck className="w-5 h-5 text-rose-500" />
                            </div>
                            <div
                                className="flex items-center justify-center gap-2 mb-1 px-4 py-2 rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200"
                                onClick={() => navigate("/model/profile/edit")}
                            >
                                <UserRoundPen className="w-4 h-4" />
                            </div>
                        </div>

                        <div className="hidden sm:block flex-1">
                            <div className="mb-2">
                                <h1 className="text-2xl font-bold mb-1">
                                    {model.firstName}&nbsp;{model.lastName || ''}
                                </h1>

                            </div>
                            <div className="flex items-center gap-6 mb-4">
                                <div className='flex items-center gap-1'>
                                    <span className="text-lg text-black font-bold">{formatNumber(model.totalLikes)}</span>
                                    <span className="text-md text-gray-500 ml-1">{t("modelProfile.likes")}</span>
                                </div>
                                <div className='flex items-center gap-1'>
                                    <span className="text-lg text-black font-bold">{formatNumber(model.totalFriends)}</span>
                                    <span className="text-md text-gray-500 ml-1">{t("modelProfile.friends")}</span>
                                </div>
                                <div className='flex items-center gap-1'>
                                    <span className="text-lg text-black font-bold">{formatNumber(model.total_review)}</span>
                                    <span className="text-md text-gray-500 ml-1">{t("modelProfile.reviews")}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mb-6">
                                <Button
                                    size="sm"
                                    type="button"
                                    className="cursor-pointer hidden sm:flex border border-rose-500 text-rose-500 bg-white hover:bg-rose-500 hover:text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                    onClick={() => navigate('/model/profile/edit')}
                                >
                                    <UserPen />
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    className="cursor-pointer hidden sm:flex bg-gray-600 text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                    onClick={() => navigate('/model/settings')}
                                >
                                    <Settings />
                                    {t("modelProfile.settings")}
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    className="cursor-pointer hidden sm:flex bg-rose-100 hover:bg-rose-200 text-rose-600 px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                    onClick={() => navigate('/model/referral')}
                                >
                                    <SquareArrowOutUpRight /> {t("modelProfile.referral")}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="flex sm:hidden items-center justify-around w-full mb-4">
                        <div className="w-1/3 text-center flex items-center justify-center gap-3 border-r">
                            <div className="text-lg text-black font-bold">{formatNumber(model.totalLikes)}</div>
                            <div className="text-md text-gray-500">{t("modelProfile.likes")}</div>
                        </div>
                        <div className="w-1/3 text-center flex items-center justify-center gap-3 border-r">
                            <div className="text-lg text-black font-bold">{formatNumber(model.totalFriends)}</div>
                            <div className="text-md text-gray-500">{t("modelProfile.friends")}</div>
                        </div>
                        <div className="w-1/3 text-center flex items-center justify-center gap-3">
                            <div className="text-lg text-black font-bold">{formatNumber(model.total_review)}</div>
                            <div className="text-md text-gray-500">{t("modelProfile.reviews")}</div>
                        </div>
                    </div>
                </div>

                <div className="pb-4">
                    <Tabs value={activeTab} onValueChange={(value) => {
                        const newSearchParams = new URLSearchParams(searchParams);
                        newSearchParams.set("tab", value);
                        navigate({ search: newSearchParams.toString() }, { replace: true });
                    }} className="w-full">
                        <TabsList className='w-full mb-2'>
                            <TabsTrigger value="account">{t("modelProfile.tabs.accountInfo")}</TabsTrigger>
                            <TabsTrigger value="banks">{t("modelProfile.tabs.bankAccounts")}</TabsTrigger>
                            <TabsTrigger value="services">{t("modelProfile.tabs.services")}</TabsTrigger>
                            <TabsTrigger value="images">{t("modelProfile.tabs.images")}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="account">
                            <div className="flex flex-col sm:flex-row items-start justify-between space-y-2">
                                <div className="w-full flex items-start justify-start flex-col space-y-3 text-sm p-2">
                                    <h3 className="text-gray-800 font-bold uppercase">{t("modelProfile.account.personalInfo")}</h3>
                                    <p className='flex items-center'><User size={14} />&nbsp;{t("modelProfile.account.fullName")}:&nbsp;<span className="font-semibold">{model.firstName}&nbsp;{model.lastName || ''}</span></p>
                                    <p className="flex items-center"> <Calendar size={14} />&nbsp;{t("modelProfile.account.age")}:&nbsp;<span className="font-semibold">{calculateAgeFromDOB(model.dob)} {t("modelProfile.account.yearsOld")}</span></p>
                                    <div className="flex items-center"><MarsStroke size={14} />&nbsp;{t("modelProfile.account.gender")}:&nbsp;&nbsp;
                                        <Badge variant="outline" className={`${model.gender === "male" ? "bg-gray-700 text-gray-300" : "bg-rose-100 text-rose-500"} px-3 py-1 font-semibold`}>
                                            {capitalize(model.gender)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center"><ToggleLeft size={14} />&nbsp;{t("modelProfile.account.status")}:&nbsp;&nbsp;
                                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1 font-semibold">
                                            {capitalize(model.status)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center"><ToggleLeft size={14} />&nbsp;{t("modelProfile.account.availability")}:&nbsp;&nbsp;
                                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1 font-semibold">
                                            {capitalize(model.available_status)}
                                        </Badge>
                                    </div>
                                    <p className="flex items-center"><MapPin size={14} />&nbsp;{t("modelProfile.account.address")}:&nbsp;<span className="font-semibold">{model.address || t("modelProfile.account.notSet")}</span></p>
                                    <p className="flex items-center"><Calendar size={14} />&nbsp;{t("modelProfile.account.memberSince")}:&nbsp;<span className="font-semibold">{new Date(model.createdAt).toDateString()}</span></p>
                                    {model.career && <p className="flex items-center"><BriefcaseBusiness size={14} />&nbsp;{t("modelProfile.account.career")}:&nbsp;<span className="font-semibold">{model.career}</span></p>}
                                    {model.education && <p className="flex items-center"><Book size={14} />&nbsp;{t("modelProfile.account.education")}:&nbsp;<span className="font-semibold">{model.education}</span></p>}
                                    {model.bio && <p className="flex items-center"><User size={14} />&nbsp;{t("modelProfile.account.bio")}:&nbsp;<span className="font-semibold">{model.bio}</span></p>}
                                </div>
                                <Separator className="block sm:hidden" />
                                <div className="w-full mb-8 space-y-4">
                                    {model.interests &&
                                        <div className='space-y-2'>
                                            <h3 className="text-sm uppercase text-gray-800 font-bold">{t("modelProfile.account.interests")}:</h3>
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
                                        <h3 className="text-sm text-gray-800 font-bold">{t("modelProfile.account.totalRating")}</h3>
                                        <div className="flex items-center">
                                            <Star size={14} />&nbsp;{t("modelProfile.account.rating")}: &nbsp; {model.rating === 0 ?
                                                <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200 px-3 py-1">
                                                    {t("modelProfile.account.noRating")}
                                                </Badge> : <Rating value={model.rating} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="banks" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-gray-800 uppercase">{t("modelProfile.banks.myBankAccounts")}</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="bg-rose-500 text-white hover:bg-rose-500 hover:text-white"
                                    onClick={handleOpenCreateBankModal}
                                >
                                    <Plus size={16} />
                                    {t("modelProfile.banks.addNew")}
                                </Button>
                            </div>

                            {successMessage && activeTab === "banks" && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-800">{t(successMessage)}</p>
                                </div>
                            )}
                            {errorMessage && activeTab === "banks" && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-800">{t(errorMessage)}</p>
                                </div>
                            )}

                            {banks.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {banks.map((bank) => {
                                        const isDeleting = deletingBankId === bank.id;
                                        return (
                                            <Card key={bank.id} className={`py-4 relative border-gray-200 rounded-sm hover:border-rose-500 hover:bg-rose-50 cursor-pointer ${isDeleting ? 'opacity-50' : ''} ${bank.isDefault ? 'border-amber-400 bg-amber-50/30' : ''}`}>
                                                {isDeleting && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10 rounded-lg">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Loader className="w-6 h-6 text-rose-500 animate-spin" />
                                                            <span className="text-xs text-rose-500">{t("modelProfile.banks.deleting")}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Default badge */}
                                                {bank.isDefault && (
                                                    <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <Star size={10} fill="currentColor" />
                                                        <span>{t("modelProfile.banks.default", { defaultValue: "Default" })}</span>
                                                    </div>
                                                )}

                                                <div className="absolute top-2 right-2">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className="cursor-pointer p-1.5 text-gray-500 hover:text-rose-700 hover:bg-rose-100 rounded-full transition-colors"
                                                                disabled={isDeleting}
                                                            >
                                                                <MoreVertical size={18} />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {!bank.isDefault && (
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-amber-600 focus:text-amber-600"
                                                                    onClick={() => {
                                                                        fetcher.submit(
                                                                            { actionType: "setDefaultBank", bankId: bank.id },
                                                                            { method: "POST" }
                                                                        );
                                                                    }}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    <Star size={14} />
                                                                    {t("modelProfile.banks.setAsDefault", { defaultValue: "Set as Default" })}
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                                className="cursor-pointer"
                                                                onClick={() => handleOpenEditBankModal(bank)}
                                                            >
                                                                <Pencil size={14} />
                                                                {t("modelProfile.banks.edit")}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-red-500 focus:text-red-500"
                                                                onClick={() => handleOpenDeleteBankModal(bank)}
                                                                disabled={isSubmitting}
                                                            >
                                                                <Trash2 size={14} />
                                                                {t("modelProfile.banks.delete")}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                                <CardContent className="space-y-2 pt-2">
                                                    <div className='flex items-center justify-center flex-col space-y-1'>
                                                        <img
                                                            src={bank.qr_code}
                                                            alt="QR Code"
                                                            className="w-24 h-24 object-contain border rounded"
                                                        />
                                                        <span className='text-gray-500 text-sm'>{t("modelProfile.banks.qrCode")}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="w-full">
                                    <EmptyPage
                                        title={t("modelProfile.banks.noBankAccounts")}
                                        description={t("modelProfile.banks.noBankAccountsDesc")}
                                    />
                                    <div className="flex justify-center">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white"
                                            onClick={handleOpenCreateBankModal}
                                        >
                                            <Plus size={16} />
                                            {t("modelProfile.banks.addFirstBank")}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="services" className="space-y-4">
                            {model.ModelService.length > 0 ?
                                <div className="w-full">
                                    <div className='flex items-center justify-between py-2'>
                                        <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase">{t("modelProfile.services.myServices")}</h3>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="bg-rose-500 text-white hover:bg-rose-500 hover:text-white"
                                            onClick={() => navigate("/model/settings/services")}
                                        >
                                            <Settings size={16} />
                                            {t("modelProfile.banks.addNew")}
                                        </Button>
                                    </div>
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

                                                        {/* Per Hour - Show hourly rate */}
                                                        {billingType === "per_hour" && (
                                                            <div className="flex items-center justify-between text-sm">
                                                                <span className="text-gray-500">{t("modelServices.hourlyRate")}</span>
                                                                <span className="font-semibold text-rose-600">
                                                                    {formatCurrency(Number(service.customHourlyRate || service.service.hourlyRate || 0))}/{t("modelServices.hour")}
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
                                                        <Badge variant="outline" className={`${service.isAvailable ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"} px-3 py-1`}>
                                                            {service.isAvailable ? t("modelProfile.services.available") : t("modelProfile.services.unavailable")}
                                                        </Badge>
                                                    </CardFooter>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                </div>
                                :
                                <div className="w-full">
                                    <EmptyPage
                                        title={t("modelProfile.services.noServices")}
                                        description={t("modelProfile.services.noServicesDesc")}
                                    />
                                    <div className="flex justify-center mt-4">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white"
                                            onClick={() => navigate('/model/settings/services')}
                                        >
                                            {t("modelProfile.services.addServices")}
                                        </Button>
                                    </div>
                                </div>
                            }
                        </TabsContent>
                        <TabsContent value="images" className='w-full space-y-4'>
                            {successMessage && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-800">{t(successMessage)}</p>
                                </div>
                            )}
                            {errorMessage && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-800">{t(errorMessage)}</p>
                                </div>
                            )}

                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*,.heic,.heif"
                                className="hidden"
                                onChange={handleFileChange}
                            />

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {images.map((image, index) => {
                                    const isUploading = uploadingImageId === image.id;
                                    const isDeleting = deletingImageId === image.id;
                                    const isBusy = isUploading || isDeleting;
                                    return (
                                        <div
                                            key={image.id}
                                            className="relative aspect-square group cursor-pointer overflow-hidden rounded-lg border border-gray-200"
                                        >
                                            <img
                                                src={image.name}
                                                alt={`Profile ${index + 1}`}
                                                className={`w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105 ${isBusy ? 'opacity-50' : ''}`}
                                                onClick={() => !isBusy && setSelectedIndex(index)}
                                            />

                                            {isUploading && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                                                    <div className="flex flex-col items-center gap-2 text-white">
                                                        <Loader className="w-8 h-8 animate-spin" />
                                                        <p className="text-sm font-medium">{isCompressing ? t("profileEdit.compressing") : t("modelProfile.images.uploading")}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {isDeleting && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                                                    <div className="flex flex-col items-center gap-2 text-white">
                                                        <Loader className="w-8 h-8 animate-spin" />
                                                        <p className="text-sm font-medium">{t("modelProfile.images.deleting")}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {!isBusy && (
                                                <>
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex items-end justify-center pb-4 gap-2">
                                                        <button
                                                            type="button"
                                                            className="flex text-rose-500 bg-rose-100 border border-rose-300 rounded-sm px-2 py-1 text-xs shadow-md gap-1 cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleFileInputClick(image.id, image.name);
                                                            }}
                                                        >
                                                            <Upload size={14} />
                                                            {t("modelProfile.images.uploadNew")}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="flex text-red-500 bg-red-100 border border-red-300 rounded-sm px-2 py-1 text-xs shadow-md gap-1 cursor-pointer"
                                                            disabled={isSubmitting}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteImage(image.id, image.name);
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                            {t("modelProfile.images.delete")}
                                                        </button>
                                                    </div>
                                                    {/* Mobile: always visible buttons at bottom */}
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex sm:hidden items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="flex text-rose-500 bg-rose-100 border border-rose-300 rounded-sm px-2 py-1 text-xs shadow-md gap-1 cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleFileInputClick(image.id, image.name);
                                                            }}
                                                        >
                                                            <Upload size={14} />
                                                            {t("modelProfile.images.uploadNew")}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="flex text-red-500 bg-red-100 border border-red-300 rounded-sm px-2 py-1 text-xs shadow-md gap-1 cursor-pointer"
                                                            disabled={isSubmitting}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteImage(image.id, image.name);
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                            {t("modelProfile.images.delete")}
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                                {index + 1}/{MAX_IMAGES}
                                            </div>
                                        </div>
                                    );
                                })}

                                {Array.from({ length: remainingSlots }).map((_, index) => {
                                    const placeholderId = `placeholder-${index}`;
                                    const isUploading = uploadingImageId === placeholderId;
                                    return (
                                        <div
                                            key={placeholderId}
                                            className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 ${isUploading
                                                ? 'border-rose-400 bg-rose-50'
                                                : canUploadMore
                                                    ? 'border-gray-300 hover:border-rose-400 hover:bg-rose-50 cursor-pointer transition-colors'
                                                    : 'border-gray-200 bg-gray-50'
                                                }`}
                                            onClick={() => canUploadMore && !isUploading && handleFileInputClick(placeholderId, "")}
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader className="w-4 h-4 text-rose-500 animate-spin" />
                                                    <span className="text-xs text-rose-500">{isCompressing ? t("profileEdit.compressing") : t("modelProfile.images.uploading")}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className={`w-4 h-4 ${canUploadMore ? 'text-gray-400' : 'text-gray-300'}`} />
                                                    <span className={`text-xs ${canUploadMore ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {t("modelProfile.images.clickToUpload")}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-blue-800 font-medium">
                                        {t("modelProfile.images.uploadLimit")}
                                    </p>
                                    <p className="text-sm text-blue-700">
                                        {t("modelProfile.images.uploadLimitDesc", { max: MAX_IMAGES, current: images.length })}
                                        {remainingSlots > 0 && ` (${remainingSlots} ${remainingSlots === 1 ? t("modelProfile.images.slot") : t("modelProfile.images.slots")} ${t("modelProfile.images.remaining")})`}
                                    </p>
                                </div>
                            </div>

                            {selectedIndex !== null && images.length > 0 && (
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

                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full">
                                        {selectedIndex + 1} / {images.length}
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle className="text-md font-normal">{editingBank ? t("modelProfile.bankModal.editTitle") : t("modelProfile.bankModal.addTitle")}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 pb-4">
                            <div className="grid gap-2">
                                <Label>{t("modelProfile.bankModal.qrCodeLabel")} <span className="text-red-500">*</span></Label>
                                <input
                                    type="file"
                                    ref={qrCodeInputRef}
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleQrCodeFileChange}
                                />
                                {qrCodePreview ? (
                                    <div className="flex items-center gap-3">
                                        <div className="cursor-pointer relative w-32 h-32 border rounded-lg overflow-hidden group">
                                            <img
                                                src={qrCodePreview}
                                                alt="QR Code Preview"
                                                className="w-full h-full object-contain"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    className="p-1.5 bg-white rounded-full text-rose-500 hover:bg-rose-50"
                                                    onClick={() => qrCodeInputRef.current?.click()}
                                                >
                                                    <Upload size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="p-1.5 bg-white rounded-full text-red-500 hover:bg-red-50"
                                                    onClick={handleRemoveQrCode}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex sm:hidden flex-col gap-2">
                                            <button
                                                type="button"
                                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-rose-500 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100"
                                                onClick={() => qrCodeInputRef.current?.click()}
                                            >
                                                <Upload size={14} />
                                                {t("modelProfile.bankModal.change")}
                                            </button>
                                            <button
                                                type="button"
                                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                                                onClick={handleRemoveQrCode}
                                            >
                                                <Trash2 size={14} />
                                                {t("modelProfile.bankModal.remove")}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="mt-2 w-full h-32 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-rose-400 hover:bg-rose-50 transition-colors"
                                        onClick={() => qrCodeInputRef.current?.click()}
                                    >
                                        <Upload className="w-6 h-6 text-gray-400" />
                                        <span className="text-xs text-gray-500">{t("modelProfile.bankModal.uploadQr")}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseBankModal}
                                disabled={isBankSubmitting}
                            >
                                {t("modelProfile.bankModal.cancel")}
                            </Button>
                            <Button
                                type="button"
                                className="bg-rose-500 hover:bg-rose-600 text-white"
                                onClick={handleBankFormSubmit}
                                disabled={(!qrCodeFile && !qrCodePreview) || isBankSubmitting}
                            >
                                {isBankSubmitting ? (
                                    <>
                                        <Loader className="w-4 h-4 animate-spin" />
                                        {editingBank ? t("modelProfile.bankModal.updating") : t("modelProfile.bankModal.creating")}
                                    </>
                                ) : (
                                    editingBank ? t("modelProfile.bankModal.update") : t("modelProfile.bankModal.addNow")
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle className="text-md font-normal text-red-600">{t("modelProfile.deleteModal.title")}</DialogTitle>
                            <DialogDescription>
                                {t("modelProfile.deleteModal.description")}
                            </DialogDescription>
                        </DialogHeader>
                        {bankToDelete && (
                            <div className="py-4">
                                <div className="p-4 bg-gray-50 rounded-lg flex justify-center">
                                    <img
                                        src={bankToDelete.qr_code}
                                        alt="QR Code"
                                        className="w-32 h-32 object-contain border rounded"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseDeleteBankModal}
                            >
                                {t("modelProfile.deleteModal.cancel")}
                            </Button>
                            <Button
                                type="button"
                                className="bg-red-500 hover:bg-red-600 text-white"
                                onClick={handleConfirmDeleteBank}
                            >
                                <Trash2 className="w-4 h-4" />
                                {t("modelProfile.deleteModal.deleteBank")}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Profile Image Fullscreen */}
                {showProfileFullscreen && model?.profile && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 cursor-pointer"
                        onClick={() => setShowProfileFullscreen(false)}
                    >
                        <button
                            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                            onClick={() => setShowProfileFullscreen(false)}
                        >
                            <X size={32} />
                        </button>
                        <img
                            src={model.profile}
                            alt={`${model.firstName} ${model.lastName || ''}`}
                            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-lg"
                        />
                        <p className="absolute bottom-4 text-white/70 text-sm">{t("modelProfile.clickToClose")}</p>
                    </div>
                )}
            </div>
        </div >
    );
};