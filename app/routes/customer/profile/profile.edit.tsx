import React, { useState } from "react";
import { useTranslation } from 'react-i18next';
import type { Route } from "./+types/profile.edit";
import { AlertCircle, Camera, ChevronLeft, Loader, X } from "lucide-react";
import { Form, redirect, useActionData, useNavigate, useNavigation, type LoaderFunction } from "react-router";

// components
import Modal from "~/components/ui/model";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

import { requireUserSession, getUserTokenFromSession } from "~/services/auths.server";
import { validateUpdateProfileInputs } from "~/services/validation.server";
import { getCustomerProfile, updateProfile, updateChatProfile } from "~/services/profile.server";
import type { ICustomerCredentials, ICustomerResponse } from "~/interfaces/customer";
import { deleteFileFromBunny, uploadFileToBunnyServer } from "~/services/upload.server";
import { capitalize, extractFilenameFromCDNSafe } from "~/utils/functions/textFormat";
import { compressImage } from "~/utils/imageCompression";

interface LoaderReturn {
    customerData: ICustomerResponse;
    customerId: string;
}

interface TransactionProps {
    loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
    const customerId = await requireUserSession(request)
    const customerData = await getCustomerProfile(customerId)
    return { customerData, customerId }
}

export async function action({ request }: Route.ActionArgs) {
    const customerId = await requireUserSession(request)
    const formData = await request.formData()

    // Get file directly
    const customerData = Object.fromEntries(formData) as Partial<ICustomerCredentials>
    const newProfile = formData.get("newProfile") as File | null
    const profile = formData.get("profile")

    if (request.method === "PATCH") {
        try {
            if (newProfile && newProfile instanceof File && newProfile.size > 0) {
                if (profile) {
                    await deleteFileFromBunny(extractFilenameFromCDNSafe(profile as string))
                }
                const buffer = Buffer.from(await newProfile.arrayBuffer());
                const url = await uploadFileToBunnyServer(buffer, newProfile.name, newProfile.type);
                customerData.profile = url;

            } else {
                customerData.profile = formData.get("profile") as string;
            }

            customerData.whatsapp = Number(customerData.whatsapp);

            // Keep interests as JSON string for validation
            const interestsJson = formData.get("interests") as string;

            // Validate without interests
            await validateUpdateProfileInputs(customerData as ICustomerCredentials)

            // Convert interests to object format after validation for database storage
            if (interestsJson) {
                const interestsArray = JSON.parse(interestsJson) as string[];
                customerData.interests = interestsArray.reduce((acc, interest, index) => {
                    acc[`interest_${index}`] = interest;
                    return acc;
                }, {} as Record<string, string>) as any;
            }
            const res = await updateProfile(customerId, customerData as ICustomerCredentials);
            if (res.id) {
                // Sync profile update to chat backend (non-blocking)
                try {
                    const authToken = await getUserTokenFromSession(request);
                    if (authToken) {
                        await updateChatProfile(authToken, {
                            phone_number: String(customerData.whatsapp),
                            first_name: customerData.firstName || "",
                            last_name: customerData.lastName || "",
                            profile_image: customerData.profile || "",
                        });
                    }
                } catch (chatError) {
                    // Log error but don't fail the main profile update
                    console.error("Failed to sync chat profile:", chatError);
                }

                return redirect(`/customer/profile?toastMessage=Update+your+profile+successfully!&toastType=success`);
            }
        } catch (error: any) {
            console.error("Error updating customer:", error);

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
                message: error || "Failed to edit top-up information!",
            };
        }
    }

    return { success: false, error: true, message: "Invalid request method!" };
}

export default function ProfileEditPage({ loaderData }: TransactionProps) {
    const { t } = useTranslation();
    const navigate = useNavigate()
    const navigation = useNavigation()
    const actionData = useActionData<typeof action>()
    const { customerData, customerId } = loaderData
    const [image, setImage] = useState<string>("")
    const [isCompressing, setIsCompressing] = useState(false)
    const [compressedFile, setCompressedFile] = useState<File | null>(null)
    const [imageError, setImageError] = useState<string | null>(null)
    const [isCustomSubmitting, setIsCustomSubmitting] = useState(false)
    const isSubmitting = isCustomSubmitting || (navigation.state !== "idle" && navigation.formMethod === "PATCH")
    const isLoading = navigation.state === "loading"

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            console.log('Original file:', { name: file.name, type: file.type, size: file.size });
            setIsCompressing(true);
            setImageError(null);
            setCompressedFile(null);

            try {
                // Compress image to max 2MB to avoid Vercel's 4.5MB body limit
                const compressed = await compressImage(file, {
                    maxWidth: 1200,
                    maxHeight: 1200,
                    quality: 0.8,
                    maxSizeMB: 2,
                });

                console.log('Compressed file:', { name: compressed.name, type: compressed.type, size: compressed.size });

                // Store the compressed file for form submission
                setCompressedFile(compressed);

                // Create preview from compressed file
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    console.log('Preview DataURL length:', result.length);
                    setImage(result);
                };
                reader.onerror = (err) => {
                    console.error('FileReader error:', err);
                };
                reader.readAsDataURL(compressed);
            } catch (error) {
                console.error('Error compressing image:', error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
                setImageError(errorMessage);
                setImage("");
                setCompressedFile(null);
            } finally {
                setIsCompressing(false);
            }
        }
    };

    // Custom form submission to ensure compressed file is used
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        if (!compressedFile && !image) {
            // No new image, let the form submit normally
            return;
        }

        if (imageError) {
            e.preventDefault();
            return;
        }

        if (compressedFile) {
            e.preventDefault();
            setIsCustomSubmitting(true);

            try {
                const formData = new FormData(e.currentTarget);
                // Remove the original file input and add our compressed file
                formData.delete('newProfile');
                formData.append('newProfile', compressedFile, compressedFile.name);

                console.log('Submitting with compressed file:', {
                    name: compressedFile.name,
                    type: compressedFile.type,
                    size: compressedFile.size
                });

                // Submit the form programmatically
                const response = await fetch(window.location.pathname, {
                    method: 'PATCH',
                    body: formData,
                });

                if (response.redirected) {
                    window.location.href = response.url;
                } else {
                    // Reload to show any errors
                    window.location.reload();
                }
            } catch (error) {
                console.error('Submit error:', error);
                setIsCustomSubmitting(false);
            }
        }
    };

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

    const [interests, setInterests] = useState<string[]>(getInterests());
    const [newInterest, setNewInterest] = useState("");

    // Trigger hidden file input
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // remove one interest
    const removeInterest = (index: number) => {
        setInterests(interests.filter((_, i) => i !== index));
    };

    // add new interest
    const addInterest = () => {
        if (newInterest.trim()) {
            setInterests([...interests, newInterest.trim()]);
            setNewInterest("");
        }
    };

    const closeHandler = () => {
        navigate("/customer/profile")
    };

    if (isLoading) {
        return (
            <div className="h-11/12 flex justify-center items-center min-h-[200px]">
                <Loader className="w-6 h-6 animate-spin text-rose-500" />&nbsp; {t('profileEdit.loading')}
            </div>
        )
    }

    return (
        <Modal onClose={closeHandler} className="w-full sm:w-3/5 h-screen sm:h-auto border">
            <Form method="patch" encType="multipart/form-data" className="py-4 space-y-4" onSubmit={handleSubmit}>
                <div className="flex items-center justify-between block sm:hidden">
                    <div className="flex items-center" onClick={() => navigate("/customer/profile")}>
                        <ChevronLeft />
                    </div>
                    <p className="text-md">{t('profileEdit.editProfile')}</p>
                    <div></div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-start">
                    <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="relative w-[100px] h-[100px] rounded-full flex items-center justify-center">
                            <img
                                src={image ? image : customerData.profile ? customerData.profile : "/images/default.webp"}
                                alt="Profile"
                                className={`w-full h-full rounded-full object-cover shadow-md ${isCompressing ? 'opacity-50' : ''}`}
                            />
                            {isCompressing && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader className="w-6 h-6 animate-spin text-rose-500" />
                                </div>
                            )}
                            <label className="absolute bottom-1 right-1 bg-white p-1 rounded-full cursor-pointer shadow-md hover:bg-gray-100">
                                <Camera className="w-4 h-4 text-gray-700" />
                                <input type="file" name="newProfile" accept="image/*" ref={fileInputRef} className="hidden" onChange={onFileChange} disabled={isCompressing} />
                            </label>
                            <input className="hidden" name="profile" defaultValue={customerData.profile} />
                        </div>
                        {imageError && (
                            <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded-lg">
                                <p className="text-red-600 text-xs text-center">{imageError}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-4 rounded-md">
                    <div className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-start">
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="firstName" className="text-gray-500 text-sm">
                                    {t('profileEdit.firstName')}<span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    required
                                    type="text"
                                    id="firstName"
                                    name="firstName"
                                    defaultValue={customerData.firstName}
                                    placeholder={t('profileEdit.firstNamePlaceholder')}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="lastName" className="text-gray-500 text-sm">
                                    {t('profileEdit.lastName')}<span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    required
                                    type="text"
                                    id="lastName"
                                    name="lastName"
                                    defaultValue={customerData.lastName}
                                    placeholder={t('profileEdit.lastNamePlaceholder')}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="dob" className="text-gray-500 text-sm">
                                    {t('profileEdit.dateOfBirth')}<span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    required
                                    id="dob"
                                    type="date"
                                    name="dob"
                                    defaultValue={new Date(customerData.dob).toISOString().split("T")[0]} // YYYY-MM-DD
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="dob" className="text-gray-500 text-sm mb-1">
                                    {t('profileEdit.gender')}<span className="text-rose-500">*</span>
                                </Label>
                                <Select name="gender" required defaultValue={customerData.gender}>
                                    <SelectTrigger className="bg-background rounded-md h-14 text-foreground font-medium px-6 w-full">
                                        <SelectValue placeholder={t('profileEdit.selectGender')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">{t('profileEdit.men')}</SelectItem>
                                        <SelectItem value="female">{t('profileEdit.women')}</SelectItem>
                                        <SelectItem value="nonbinary">{t('profileEdit.nonBinary')}</SelectItem>
                                        <SelectItem value="all">{t('profileEdit.all')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="dob" className="text-gray-500 text-sm mb-1">
                                    {t('profileEdit.relationshipStatus')}<span className="text-rose-500">*</span>
                                </Label>
                                <Select name="relationshipStatus" required defaultValue={customerData.relationshipStatus ?? "single"}>
                                    <SelectTrigger className="bg-background rounded-md h-14 text-foreground font-medium px-6 w-full">
                                        <SelectValue placeholder={t('profileEdit.selectGender')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Single">{t('profileEdit.single')}</SelectItem>
                                        <SelectItem value="Married">{t('profileEdit.married')}</SelectItem>
                                        <SelectItem value="Relationship">{t('profileEdit.inRelationship')}</SelectItem>
                                        <SelectItem value="Divorced">{t('profileEdit.divorced')}</SelectItem>
                                        <SelectItem value="Widowed">{t('profileEdit.widowed')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="whatsapp" className="text-gray-500 text-sm">
                                    {t('profileEdit.whatsapp')}<span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    required
                                    id="whatsapp"
                                    type="number"
                                    name="whatsapp"
                                    defaultValue={customerData.whatsapp}
                                    placeholder={t('profileEdit.whatsappPlaceholder')}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="bio" className="text-gray-500 text-sm">
                                    {t('profileEdit.bio')}
                                </Label>
                                <Input
                                    id="bio"
                                    type="text"
                                    name="bio"
                                    defaultValue={customerData.bio || ""}
                                    placeholder={t('profileEdit.bioPlaceholder')}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="career" className="text-gray-500 text-sm">
                                    {t('profileEdit.career')}
                                </Label>
                                <Input
                                    id="career"
                                    type="text"
                                    name="career"
                                    defaultValue={customerData.career || ""}
                                    placeholder={t('profileEdit.careerPlaceholder')}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="education" className="text-gray-500 text-sm">
                                    {t('profileEdit.education')}
                                </Label>
                                <Input
                                    id="education"
                                    type="text"
                                    name="education"
                                    defaultValue={customerData.education || ""}
                                    placeholder={t('profileEdit.educationPlaceholder')}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div>
                                <p>{t('profileEdit.interests')}</p>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {interests.map((interest, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between px-3 py-1.5 rounded-md text-sm 
                                            bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 
                                            hover:text-rose-600 transition-colors cursor-pointer space-x-2"
                                        >
                                            <span>{interest}</span>
                                            <X
                                                size={16}
                                                className="cursor-pointer"
                                                onClick={() => removeInterest(index)}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Input
                                        type="text"
                                        placeholder={t('profileEdit.addInterestPlaceholder')}
                                        value={newInterest}
                                        onChange={(e) => setNewInterest(e.target.value)}
                                        className="text-sm border-gray-200 text-gray-700 placeholder-gray-400 focus:border-pink-500"
                                    />
                                    <Button
                                        type="button"
                                        onClick={addInterest}
                                        className="bg-rose-100 border border-rose-200 text-rose-500 hover:bg-rose-300 flex items-center space-x-1"
                                    >
                                        <span>{t('profileEdit.add')}</span>
                                    </Button>
                                </div>
                                <input type="hidden" name="interests" value={JSON.stringify(interests)} />

                            </div>
                        </div>
                        <div>
                            {actionData?.error && (
                                <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                    <span className="text-red-500 text-sm">
                                        {capitalize(actionData.message)}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end">
                            <Button
                                type="submit"
                                disabled={isSubmitting || isCompressing || !!imageError}
                                className="flex cursor-pointer text-sm bg-rose-500 text-rose-500 hover:bg-rose-600 text-white font-medium disabled:opacity-50"
                            >
                                {(isSubmitting || isCompressing) && <Loader className="w-4 h-4 animate-spin" />}
                                {isCompressing ? t('profileEdit.compressing') : isSubmitting ? t('profileEdit.saving') : t('profileEdit.saveChange')}
                            </Button>
                        </div>
                    </div>
                </div>
            </Form>
        </Modal>
    );
}

