import type { Route } from "./+types/register"
import { useTranslation } from "react-i18next"
import React, { useState, useEffect, useRef } from "react"
import { AlertCircle, ArrowLeft, Camera, Eye, EyeOff, Loader, User, UserPlus } from "lucide-react"
import { Form, Link, useActionData, useNavigate, useNavigation } from "react-router"

// components
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Button } from "~/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"

// interfaces and services
import { isAdult } from "~/lib/validation"
import type { Gender } from "~/interfaces/base"
import { validateCustomerSignupInputs } from "~/services/validation.server"
import type { ICustomerSignupCredentials } from "~/interfaces"
import { FieldValidationError, getCurrentIP } from "~/services/base.server"
import { uploadFileToBunnyServer } from "~/services/upload.server"
import { compressImage } from "~/utils/imageCompression"

const backgroundImages = [
    "https://images.pexels.com/photos/12810667/pexels-photo-12810667.jpeg",
    "https://images.pexels.com/photos/5762507/pexels-photo-5762507.jpeg",
    "https://images.pexels.com/photos/1577025/pexels-photo-1577025.jpeg",
    "https://images.pexels.com/photos/825904/pexels-photo-825904.jpeg",
    "https://images.pexels.com/photos/16838518/pexels-photo-16838518.jpeg",
]

export async function loader({ request }: Route.LoaderArgs) {
    const { getUserFromSession } = await import("~/services/auths.server");
    const { redirect } = await import("react-router");

    const customerId = await getUserFromSession(request);

    if (customerId) {
        // User already logged in, redirect to dashboard
        throw redirect("/customer");
    }

    return null;
}

export async function action({ request }: Route.ActionArgs) {
    const { customerRegister } = await import("~/services/auths.server")
    const formData = await request.formData()
    const ip = await getCurrentIP();
    const accessKey = process.env.APIIP_API_KEY || "";

    const genderValue = formData.get("gender") as string
    const newProfile = formData.get("newProfile") as File | null;

    let gender: Gender
    if (genderValue === "male" || genderValue === "female" || genderValue === "other") {
        gender = genderValue as Gender
    } else {
        return { success: false, error: true, messageKey: "register.errors.invalidGender" }
    }

    // Profile image validation (required)
    if (!newProfile || !(newProfile instanceof File) || newProfile.size === 0) {
        return { success: false, error: true, messageKey: "register.errors.profileRequired" };
    }

    let profileUrl = "";
    if (newProfile && newProfile instanceof File && newProfile.size > 0) {
        // File size validation (max 10MB)
        if (newProfile.size > 10 * 1024 * 1024) {
            return { success: false, error: true, messageKey: "register.errors.profileTooLarge" };
        }

        // File type validation (relaxed for iOS compatibility - iOS may report heic/heif or empty type)
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", ""];
        const fileExtension = newProfile.name.toLowerCase().split('.').pop();
        const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
        if (!allowedTypes.includes(newProfile.type) && !allowedExtensions.includes(fileExtension || "")) {
            return { success: false, error: true, messageKey: "register.errors.invalidImageFormat" };
        }

        try {
            // Upload profile image to Bunny CDN
            const buffer = Buffer.from(await newProfile.arrayBuffer());
            profileUrl = await uploadFileToBunnyServer(buffer, newProfile.name, newProfile.type);
        } catch (uploadError: any) {
            console.error("Profile upload error:", uploadError);
            return { success: false, error: true, messageKey: "register.errors.uploadFailed" };
        }
    }

    const signUpData: ICustomerSignupCredentials = {
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        whatsapp: Number(formData.get("whatsapp")),
        gender: gender,
        dob: formData.get("dob") as string,
        password: formData.get("password") as string,
        profile: profileUrl,
    };

    if (!signUpData.firstName) {
        return { success: false, error: true, messageKey: "register.errors.firstNameRequired" }
    }

    if (!signUpData.whatsapp) {
        return { success: false, error: true, messageKey: "register.errors.invalidPhone" }
    }

    if (!signUpData.password) {
        return { success: false, error: true, messageKey: "register.errors.invalidPassword" }
    }

    if (!signUpData.dob) {
        return { success: false, error: true, messageKey: "register.errors.dobRequired" }
    }

    if (signUpData.dob) {
        const isChild = isAdult(signUpData.dob);
        if (!isChild) {
            return { success: false, error: true, messageKey: "register.errors.underAge" }
        }
    }

    if (request.method === "POST") {
        try {
            await validateCustomerSignupInputs(signUpData);
            const res = await customerRegister(signUpData, ip, accessKey);
            console.log("RES::", res);

            // Auto-login returns a redirect response, manual flow returns success object
            // Just return whatever customerRegister returns
            return res;
        } catch (error: any) {
            console.log("Failed:", error)
            // Check if it's a FieldValidationError by checking multiple properties
            if (error instanceof FieldValidationError || (error && (error.payload || error.name === "FieldValidationError"))) {
                const payload = error.payload || error;
                console.log("FieldValidationError payload:", payload);
                console.log("messageKey:", payload.messageKey);
                console.log("message:", payload.message);

                // Ensure we use messageKey if it exists
                const errorMessageKey = payload.messageKey || "register.errors.somethingWentWrong";
                console.log("Returning messageKey:", errorMessageKey);

                return {
                    success: payload.success !== undefined ? payload.success : false,
                    error: payload.error !== undefined ? payload.error : true,
                    messageKey: errorMessageKey,
                    message: payload.message
                }
            }
            console.log("Generic error, first value:", Object.values(error)[0]);
            const value = Object.values(error)[0];
            return { success: false, error: true, message: value as string, messageKey: "register.errors.somethingWentWrong" };
        }
    }
    return { success: false, error: true, messageKey: "register.errors.invalidRequest" };
}

export default function SignUpPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const navigation = useNavigation()
    const [showPassword, setShowPassword] = useState(false)
    const [isAcceptTerms, setIsAcceptTerms] = useState(false)
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [profileImage, setProfileImage] = useState<string>("")
    const [profileError, setProfileError] = useState<string>("")
    const [isCompressing, setIsCompressing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const actionData = useActionData<typeof action>()
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length)
        }, 5000)
        return () => clearInterval(interval)
    }, []);

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfileError("");

        if (!e.target.files || !e.target.files[0]) {
            return;
        }

        const file = e.target.files[0];

        // File size validation (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setProfileError("Profile image must be less than 10MB");
            setProfileImage("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        // Relaxed file type validation for iOS compatibility
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", ""];
        const fileExtension = file.name.toLowerCase().split('.').pop();
        const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || "")) {
            setProfileError("Profile image must be JPG, JPEG, PNG, WebP, or HEIC format");
            setProfileImage("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setIsCompressing(true);

        try {
            // Compress image to max 1MB to avoid BunnyCDN upload limits
            const compressed = await compressImage(file, {
                maxWidth: 1200,
                maxHeight: 1200,
                quality: 0.7,
                maxSizeMB: 1,
            });

            // Create preview from compressed file
            // Revoke previous object URL to prevent memory leaks
            if (profileImage && profileImage.startsWith('blob:')) {
                URL.revokeObjectURL(profileImage);
            }
            const objectUrl = URL.createObjectURL(compressed);
            setProfileImage(objectUrl);

            // Update the file input with compressed file
            if (fileInputRef.current) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(compressed);
                fileInputRef.current.files = dataTransfer.files;
            }
        } catch (error) {
            console.error('Error compressing image:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
            setProfileError(errorMessage);
            setProfileImage("");
            if (fileInputRef.current) fileInputRef.current.value = "";
        } finally {
            setIsCompressing(false);
        }
    };

    return (
        <>
            <style>{`
                /* Compact mobile select dropdowns */
                @media (max-width: 768px) {
                    select option {
                        padding: 8px 12px !important;
                        font-size: 14px !important;
                    }
                    /* iOS specific */
                    @supports (-webkit-touch-callout: none) {
                        select {
                            -webkit-appearance: menulist-button !important;
                        }
                    }
                }
            `}</style>
            <div className="min-h-screen safe-area relative overflow-hidden">
                {backgroundImages.map((bgImage, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 z-0 transition-opacity duration-3000 ${index === currentImageIndex ? "opacity-100" : "opacity-0"
                            }`}
                        style={{
                            backgroundImage: `url(${bgImage})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                        }}
                    />
                ))}

                <div
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-11/12 h-auto rounded-sm
                            bg-black/50 backdrop-blur-lg shadow-2xl py-8 px-4 sm:p-8 flex flex-col justify-start z-20
                            lg:top-0 lg:right-0 lg:left-auto lg:translate-x-0 lg:translate-y-0 lg:w-2/5 lg:h-full lg:rounded-none  py-10 sm:py-0 my-10 sm:my-0">

                    <div className="hidden sm:flex items-start justify-between">
                        <div className="space-y-2 my-6">
                            <h1 className="flex items-center justify-start text-md sm:text-lg font-bold text-white uppercase">
                                <UserPlus className="text-rose-500" />&nbsp;&nbsp;{t('register.title')}
                            </h1>
                            <p className="text-white text-xs sm:text-sm">{t('register.subtitle')}</p>
                        </div>
                    </div>
                    <Form method="post" encType="multipart/form-data" className="space-y-1 sm:space-y-4 ">
                        <div className="flex flex-col items-center justify-center space-y-2">

                            <div className="flex items-center justify-center gap-2">
                                <ArrowLeft className="w-5 h-5 text-white cursor-pointer" onClick={() => navigate("/login")} />
                                <Label className="text-gray-300 text-sm">
                                    {t('register.profileImage')}<span className="text-rose-500">*</span>
                                </Label>
                            </div>
                            <div className="relative w-[100px] h-[100px] rounded-full flex items-center justify-center">
                                <img
                                    src={profileImage || "https://xaosao.b-cdn.net/default-image.png"}
                                    alt="Profile Preview"
                                    className={`w-full h-full rounded-full object-cover shadow-md border-2 ${profileError || (!profileImage && actionData?.error) ? "border-red-500" : "border-rose-200"} ${isCompressing ? "opacity-50" : ""}`}
                                />
                                {isCompressing && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader className="w-6 h-6 animate-spin text-rose-500" />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isCompressing}
                                    className="absolute bottom-0 right-0 bg-rose-500 p-1.5 rounded-full cursor-pointer shadow-md hover:bg-rose-600 disabled:opacity-50"
                                >
                                    <Camera className="w-4 h-4 text-white" />
                                </button>
                                <input
                                    type="file"
                                    name="newProfile"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={onFileChange}
                                    disabled={isCompressing}
                                />
                            </div>
                            {profileError && (
                                <p className="text-xs text-red-400 text-center">{profileError}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="firstName" className="text-gray-300 text-sm">
                                    {t('register.firstName')}<span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    required
                                    type="text"
                                    id="firstName"
                                    name="firstName"
                                    placeholder={t('register.firstName') + "..."}
                                    className="mt-1 border-white text-white placeholder-gray-400 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div>
                                <Label htmlFor="lastName" className="text-gray-300 text-sm">
                                    {t('register.lastName')}<span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    required
                                    type="text"
                                    id="lastName"
                                    name="lastName"
                                    placeholder={t('register.lastName') + "..."}
                                    className="mt-1 border-white text-white placeholder-gray-400 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="mobile" className="text-gray-300 text-sm">
                                    {t('register.mobileNumber')}<span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    required
                                    id="tel"
                                    type="tel"
                                    name="whatsapp"
                                    placeholder="2012345678"
                                    className="mt-1 border-white text-white placeholder-gray-400 focus:border-pink-500 backdrop-blur-sm"
                                />
                            </div>
                            <div>
                                <Label htmlFor="gender" className="text-gray-300 text-sm">
                                    {t('register.gender')}<span className="text-rose-500">*</span>
                                </Label>
                                <Select name="gender" required>
                                    <SelectTrigger className="w-full mt-1 border-white text-white placeholder-gray-400 focus:border-pink-500 backdrop-blur-sm">
                                        <SelectValue placeholder={t('register.selectGender')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">{t('register.male')}</SelectItem>
                                        <SelectItem value="female">{t('register.female')}</SelectItem>
                                        <SelectItem value="other">{t('register.other')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <Label htmlFor="password" className="text-gray-300 text-sm">
                                    {t('login.password')}<span className="text-rose-500">*</span>
                                </Label>
                                <div className="relative mt-1">
                                    <Input
                                        required
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        placeholder="Pa$$w0rd!"
                                        className="border-white text-white placeholder-gray-400 focus:border-rose-500 pr-10 backdrop-blur-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-1 sm:col-span-2 mt-3">
                            <label className="block text-sm font-medium text-white mb-1">
                                {t("modelAuth.register.dateOfBirth")} <span className="text-rose-500">*</span>
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <select
                                    id="dobYear"
                                    name="dobYear"
                                    required
                                    size={1}
                                    onChange={(e) => {
                                        const year = e.target.value;
                                        const month = (document.getElementById('dobMonth') as HTMLSelectElement)?.value;
                                        const day = (document.getElementById('dobDay') as HTMLSelectElement)?.value;
                                        if (year && month && day) {
                                            const dobInput = document.getElementById('dob') as HTMLInputElement;
                                            if (dobInput) dobInput.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                                        }
                                    }}
                                    style={{ maxHeight: '200px' }}
                                    className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-white bg-black/30"
                                >
                                    <option value="">{t("modelAuth.register.year")}</option>
                                    {Array.from({ length: 44 }, (_, i) => 2008 - i).map((year) => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    id="dobMonth"
                                    name="dobMonth"
                                    required
                                    size={1}
                                    onChange={(e) => {
                                        const month = e.target.value;
                                        const year = (document.getElementById('dobYear') as HTMLSelectElement)?.value;
                                        const day = (document.getElementById('dobDay') as HTMLSelectElement)?.value;
                                        if (year && month && day) {
                                            const dobInput = document.getElementById('dob') as HTMLInputElement;
                                            if (dobInput) dobInput.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                                        }
                                    }}
                                    style={{ maxHeight: '200px' }}
                                    className="text-sm appearance-none block w-full px-3 py-2 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-white bg-black/30"
                                >
                                    <option value="">{t("modelAuth.register.month")}</option>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                        <option key={month} value={month}>
                                            {month}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    id="dobDay"
                                    name="dobDay"
                                    required
                                    size={1}
                                    onChange={(e) => {
                                        const day = e.target.value;
                                        const year = (document.getElementById('dobYear') as HTMLSelectElement)?.value;
                                        const month = (document.getElementById('dobMonth') as HTMLSelectElement)?.value;
                                        if (year && month && day) {
                                            const dobInput = document.getElementById('dob') as HTMLInputElement;
                                            if (dobInput) dobInput.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                                        }
                                    }}
                                    style={{ maxHeight: '200px' }}
                                    className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-white bg-black/30"
                                >
                                    <option value="">{t("modelAuth.register.day")}</option>
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                        <option key={day} value={day}>
                                            {day}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <input type="hidden" id="dob" name="dob" required />
                        </div>

                        {actionData?.error && (
                            <div className="mb-4 p-3 bg-red-500/20  rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                <span className="text-red-200 text-sm">
                                    {'messageKey' in actionData && actionData.messageKey ? t(actionData.messageKey) : actionData.message}
                                </span>
                            </div>
                        )}

                        {actionData?.success && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-green-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                                <AlertCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                                <span className="text-green-200 text-sm">
                                    {'messageKey' in actionData && actionData.messageKey ? t(actionData.messageKey) : (actionData as any).message}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center justify-start space-x-2 text-sm mt-8 sm:mt-4">
                            <input
                                id="terms"
                                type="checkbox"
                                name="acceptTerms"
                                checked={isAcceptTerms}
                                onChange={(e) => setIsAcceptTerms(e.target.checked)}
                                className="w-4 h-4 text-rose-500 bg-gray-800 border-gray-600 rounded focus:ring-rose-500"
                            />
                            <Label htmlFor="terms" className="flex items-center justify-start text-gray-300 leading-tight">
                                {t('register.acceptTerms')} <span className="hidden sm:block">{t('register.acceptTermsAll')}</span>
                                <Link to="#" className="text-white hover:text-rose-600 underline">
                                    {t('register.termsConditions')}
                                </Link>
                                <Link to="#" className="text-white hover:text-rose-600 underline">
                                    {t('register.privacyPolicy')}
                                </Link>
                                <span className="text-rose-500">*</span>
                            </Label>
                        </div>


                        <Button
                            type="submit"
                            disabled={isSubmitting || isCompressing || !isAcceptTerms}
                            className={`w-full border border-rose-500 bg-rose-500 hover:bg-rose-600 text-white py-3 font-medium my-4 uppercase ${(isCompressing || !isAcceptTerms) ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                        >
                            {(isSubmitting || isCompressing) ? <Loader className="w-4 h-4 mr-1 animate-spin" /> : ""}
                            {isCompressing ? t('profileEdit.compressing') : isSubmitting ? t('register.registering') : t('register.registerButton')}
                        </Button>


                        <div className="text-center space-x-2 mb-40 sm:mb-0">
                            <span className="text-sm text-white">{t('register.alreadyHaveAccount')} </span>
                            <Link to="/login" className="text-white text-sm font-bold hover:text-rose-600 font-xs uppercase">
                                {t('register.backLogin')}
                            </Link>
                        </div>
                    </Form>
                </div>
            </div>
        </>
    )
}
