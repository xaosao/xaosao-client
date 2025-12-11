import React, { useState } from "react";
import type { Route } from "./+types/edit";
import { AlertCircle, Camera, ChevronLeft, Loader, X } from "lucide-react";
import { Form, redirect, useActionData, useNavigate, useNavigation, type LoaderFunction } from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

import { requireModelSession, getModelTokenFromSession } from "~/services/model-auth.server";
import { validateUpdateProfileInputs } from "~/services/validation.server";
import { capitalize, extractFilenameFromCDNSafe } from "~/utils/functions/textFormat";
import { deleteFileFromBunny, uploadFileToBunnyServer } from "~/services/upload.server";
import { getModelOwnProfile, updateModelProfile, updateModelChatProfile } from "~/services/model-profile.server";
import type { IModelProfileCredentials, IModelOwnProfileResponse } from "~/interfaces/model-profile";

interface LoaderReturn {
    modelData: IModelOwnProfileResponse;
    modelId: string;
}

interface ProfileEditProps {
    loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
    const modelId = await requireModelSession(request);
    const modelData = await getModelOwnProfile(modelId);
    return { modelData, modelId };
};

export async function action({ request }: Route.ActionArgs) {
    const modelId = await requireModelSession(request);
    const formData = await request.formData();

    // Get file directly
    const modelFormData = Object.fromEntries(formData) as Partial<IModelProfileCredentials>;
    const newProfile = formData.get("newProfile") as File | null;
    const profile = formData.get("profile");

    if (request.method === "PATCH") {
        try {
            if (newProfile && newProfile instanceof File && newProfile.size > 0) {
                if (profile) {
                    await deleteFileFromBunny(extractFilenameFromCDNSafe(profile as string));
                }
                const buffer = Buffer.from(await newProfile.arrayBuffer());
                const url = await uploadFileToBunnyServer(buffer, newProfile.name, newProfile.type);
                modelFormData.profile = url;
            } else {
                modelFormData.profile = formData.get("profile") as string;
            }

            modelFormData.whatsapp = Number(modelFormData.whatsapp);

            // Keep interests as JSON string for validation
            const interestsJson = formData.get("interests") as string;

            // Validate with interests as string
            await validateUpdateProfileInputs(modelFormData as any);

            // Convert interests to object format after validation for database storage
            if (interestsJson) {
                const interestsArray = JSON.parse(interestsJson) as string[];
                modelFormData.interests = interestsArray.reduce((acc, interest, index) => {
                    acc[`interest_${index}`] = interest;
                    return acc;
                }, {} as Record<string, string>);
            }

            const res = await updateModelProfile(modelId, modelFormData as IModelProfileCredentials);
            if (res.id) {
                // Sync profile update to chat backend (non-blocking)
                try {
                    const authToken = await getModelTokenFromSession(request);
                    if (authToken) {
                        await updateModelChatProfile(authToken, {
                            phone_number: String(modelFormData.whatsapp),
                            first_name: modelFormData.firstName || "",
                            last_name: modelFormData.lastName || "",
                            profile_image: modelFormData.profile || "",
                        });
                    }
                } catch (chatError) {
                    // Log error but don't fail the main profile update
                    console.error("Failed to sync model chat profile:", chatError);
                }

                return redirect(`/model/profile?toastMessage=${encodeURIComponent("modelProfileEdit.success.updated")}&toastType=success`);
            }
        } catch (error: any) {
            console.error("Error updating model:", error);

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
                message: error || "modelProfileEdit.errors.updateFailed",
            };
        }
    }

    return { success: false, error: true, message: "modelProfileEdit.errors.invalidRequest" };
}

export default function ModelProfileEditPage({ loaderData }: ProfileEditProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const actionData = useActionData<typeof action>();
    const { modelData, modelId } = loaderData;
    const [image, setImage] = useState<string>("");
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH";
    const isLoading = navigation.state === "loading";

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                setImage(result);
            };
            reader.readAsDataURL(file);
        }
    };

    const [interests, setInterests] = useState<string[]>(
        Object.values(modelData?.interests ?? {})
    );
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
        navigate("/model/profile");
    };

    if (isLoading) {
        return (
            <div className="h-11/12 flex justify-center items-center min-h-[200px]">
                <Loader className="w-6 h-6 animate-spin text-rose-500" />&nbsp; {t("modelProfileEdit.loading")}
            </div>
        );
    }

    return (
        <Modal onClose={closeHandler} className="w-full sm:w-3/5 h-[100dvh] sm:h-auto border overflow-hidden">
            <Form method="patch" encType="multipart/form-data" className="py-2 space-y-4 h-full overflow-y-auto">
                <div className="flex items-center justify-between block sm:hidden">
                    <div className="flex items-center" onClick={() => navigate("/model/profile")}>
                        <ChevronLeft />
                    </div>
                    <p className="text-md">{t("modelProfileEdit.title")}</p>
                    <div></div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-start">
                    <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="relative w-[100px] h-[100px] rounded-full flex items-center justify-center">
                            <img
                                src={image ? image : modelData.profile ? modelData.profile : "/images/default.webp"}
                                alt="Profile"
                                className="w-full h-full rounded-full object-cover shadow-md"
                            />
                            <label className="absolute bottom-1 right-1 bg-white p-1 rounded-full cursor-pointer shadow-md hover:bg-gray-100">
                                <Camera className="w-4 h-4 text-gray-700" />
                                <input type="file" name="newProfile" accept="image/*" ref={fileInputRef} className="hidden" onChange={onFileChange} />
                            </label>
                            <input className="hidden" name="profile" defaultValue={modelData.profile || ""} />
                        </div>
                    </div>
                </div>

                <div className="px-4 rounded-md">
                    <div className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-start">
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="firstName" className="text-gray-500 text-sm">
                                    {t("modelProfileEdit.firstName")}<span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    required
                                    type="text"
                                    id="firstName"
                                    name="firstName"
                                    defaultValue={modelData.firstName}
                                    placeholder={t("modelProfileEdit.firstNamePlaceholder")}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="lastName" className="text-gray-500 text-sm">
                                    {t("modelProfileEdit.lastName")}
                                </Label>
                                <Input
                                    type="text"
                                    id="lastName"
                                    name="lastName"
                                    defaultValue={modelData.lastName || ""}
                                    placeholder={t("modelProfileEdit.lastNamePlaceholder")}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="dob" className="text-gray-500 text-sm">
                                    {t("modelProfileEdit.dateOfBirth")}<span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    required
                                    id="dob"
                                    type="date"
                                    name="dob"
                                    defaultValue={new Date(modelData.dob).toISOString().split("T")[0]}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="gender" className="text-gray-500 text-sm mb-1">
                                    {t("modelProfileEdit.gender")}<span className="text-rose-500">*</span>
                                </Label>
                                <Select name="gender" required defaultValue={modelData.gender}>
                                    <SelectTrigger className="bg-background rounded-md h-14 text-foreground font-medium px-6 w-full">
                                        <SelectValue placeholder={t("modelProfileEdit.selectGender")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">{t("modelProfileEdit.male")}</SelectItem>
                                        <SelectItem value="female">{t("modelProfileEdit.female")}</SelectItem>
                                        <SelectItem value="nonbinary">{t("modelProfileEdit.nonBinary")}</SelectItem>
                                        <SelectItem value="other">{t("modelProfileEdit.other")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="relationshipStatus" className="text-gray-500 text-sm mb-1">
                                    {t("modelProfileEdit.relationshipStatus")}
                                </Label>
                                <Select name="relationshipStatus" defaultValue={modelData.relationshipStatus ?? "Single"}>
                                    <SelectTrigger className="bg-background rounded-md h-14 text-foreground font-medium px-6 w-full">
                                        <SelectValue placeholder={t("modelProfileEdit.selectStatus")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Single">{t("modelProfileEdit.single")}</SelectItem>
                                        <SelectItem value="Married">{t("modelProfileEdit.married")}</SelectItem>
                                        <SelectItem value="Relationship">{t("modelProfileEdit.inRelationship")}</SelectItem>
                                        <SelectItem value="Divorced">{t("modelProfileEdit.divorced")}</SelectItem>
                                        <SelectItem value="Widowed">{t("modelProfileEdit.widowed")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="available_status" className="text-gray-500 text-sm mb-1">
                                    {t("modelProfileEdit.availabilityStatus")}<span className="text-rose-500">*</span>
                                </Label>
                                <Select name="available_status" required defaultValue={modelData.available_status}>
                                    <SelectTrigger className="bg-background rounded-md h-14 text-foreground font-medium px-6 w-full">
                                        <SelectValue placeholder={t("modelProfileEdit.selectAvailability")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="available">{t("modelProfileEdit.available")}</SelectItem>
                                        <SelectItem value="busy">{t("modelProfileEdit.busy")}</SelectItem>
                                        <SelectItem value="offline">{t("modelProfileEdit.offline")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="whatsapp" className="text-gray-500 text-sm">
                                    {t("modelProfileEdit.whatsapp")}<span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    required
                                    id="whatsapp"
                                    type="number"
                                    name="whatsapp"
                                    defaultValue={modelData.whatsapp}
                                    placeholder={t("modelProfileEdit.whatsappPlaceholder")}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="address" className="text-gray-500 text-sm">
                                    {t("modelProfileEdit.address")}
                                </Label>
                                <Input
                                    id="address"
                                    type="text"
                                    name="address"
                                    defaultValue={modelData.address || ""}
                                    placeholder={t("modelProfileEdit.addressPlaceholder")}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="bio" className="text-gray-500 text-sm">
                                    {t("modelProfileEdit.bio")}
                                </Label>
                                <Input
                                    id="bio"
                                    type="text"
                                    name="bio"
                                    defaultValue={modelData.bio || ""}
                                    placeholder={t("modelProfileEdit.bioPlaceholder")}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="career" className="text-gray-500 text-sm">
                                    {t("modelProfileEdit.career")}
                                </Label>
                                <Input
                                    id="career"
                                    type="text"
                                    name="career"
                                    defaultValue={modelData.career || ""}
                                    placeholder={t("modelProfileEdit.careerPlaceholder")}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="gap-2 sm:gap-4">
                                <Label htmlFor="education" className="text-gray-500 text-sm">
                                    {t("modelProfileEdit.education")}
                                </Label>
                                <Input
                                    id="education"
                                    type="text"
                                    name="education"
                                    defaultValue={modelData.education || ""}
                                    placeholder={t("modelProfileEdit.educationPlaceholder")}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-gray-500 text-sm mb-2">{t("modelProfileEdit.interests")}</p>
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
                                        placeholder={t("modelProfileEdit.interestsPlaceholder")}
                                        value={newInterest}
                                        onChange={(e) => setNewInterest(e.target.value)}
                                        className="text-sm border-gray-200 text-gray-700 placeholder-gray-400 focus:border-pink-500"
                                    />
                                    <Button
                                        type="button"
                                        onClick={addInterest}
                                        className="bg-rose-100 border border-rose-200 text-rose-500 hover:bg-rose-300 flex items-center space-x-1"
                                    >
                                        <span>{t("modelProfileEdit.add")}</span>
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
                        <div className="flex items-center justify-end gap-4">
                            <Button
                                type="button"
                                onClick={() => closeHandler()}
                                className="flex cursor-pointer text-sm bg-gray-500 text-white hover:bg-gray-600 text-white font-medium"
                            >
                                {t("modelProfileEdit.close")}
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex cursor-pointer text-sm bg-rose-500 text-rose-500 hover:bg-rose-600 text-white font-medium"
                            >
                                {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
                                {isSubmitting ? t("modelProfileEdit.saving") : t("modelProfileEdit.saveChanges")}
                            </Button>
                        </div>
                    </div>
                </div>
            </Form>
        </Modal>
    );
}
