import type { Route } from "./+types/register"
import { useTranslation } from "react-i18next"
import React, { useState, useEffect, useRef } from "react"
import { AlertCircle, Camera, Eye, EyeOff, Loader, User, UserPlus } from "lucide-react"
import { Form, Link, redirect, useActionData, useNavigate, useNavigation } from "react-router"

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

/**
 * Loader to check if user is already logged in
 * Redirects to customer dashboard if session exists
 */
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

    const confirmPassword = formData.get("confirmPassword") as string
    const genderValue = formData.get("gender") as string
    const newProfile = formData.get("newProfile") as File | null;

    let gender: Gender
    if (genderValue === "male" || genderValue === "female" || genderValue === "other") {
        gender = genderValue as Gender
    } else {
        return { success: false, error: true, message: "Please select a valid gender!" }
    }

    // Profile image validation (required)
    if (!newProfile || !(newProfile instanceof File) || newProfile.size === 0) {
        return { success: false, error: true, message: "Profile image is required" };
    }

    let profileUrl = "";
    if (newProfile && newProfile instanceof File && newProfile.size > 0) {
        // File size validation (max 10MB)
        if (newProfile.size > 10 * 1024 * 1024) {
            return { success: false, error: true, message: "Profile image must be less than 10MB" };
        }

        // File type validation (relaxed for iOS compatibility - iOS may report heic/heif or empty type)
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", ""];
        const fileExtension = newProfile.name.toLowerCase().split('.').pop();
        const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
        if (!allowedTypes.includes(newProfile.type) && !allowedExtensions.includes(fileExtension || "")) {
            return { success: false, error: true, message: "Profile image must be JPG, JPEG, PNG, WebP, or HEIC format" };
        }

        try {
            // Upload profile image to Bunny CDN
            const buffer = Buffer.from(await newProfile.arrayBuffer());
            profileUrl = await uploadFileToBunnyServer(buffer, newProfile.name, newProfile.type);
        } catch (uploadError: any) {
            console.error("Profile upload error:", uploadError);
            return { success: false, error: true, message: "Failed to upload profile image. Please try again." };
        }
    }

    const signUpData: ICustomerSignupCredentials = {
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        username: formData.get("username") as string,
        whatsapp: Number(formData.get("whatsapp")),
        gender: gender,
        dob: formData.get("dob") as string,
        password: formData.get("password") as string,
        profile: profileUrl,
    };

    if (!signUpData.firstName) {
        return { success: false, error: true, message: "First name is required!" }
    }

    if (!signUpData.username) {
        return { success: false, error: true, message: "Username is required!" }
    }

    if (!signUpData.whatsapp) {
        return { success: false, error: true, message: "Invalid or incorrect phone number format!" }
    }

    if (!signUpData.password) {
        return { success: false, error: true, message: "Invalid password!" }
    }

    if (!signUpData.dob) {
        return { success: false, error: true, message: "Date of birth is required!" }
    }

    if (signUpData.dob) {
        const isChild = isAdult(signUpData.dob);
        if (!isChild) {
            return { success: false, error: true, message: "We're not allow under 18 year old!" }
        }
    }

    if (signUpData.password !== confirmPassword) {
        return { success: false, error: true, message: "Password missed match. Please try again!" }
    }

    if (request.method === "POST") {
        try {
            await validateCustomerSignupInputs(signUpData);
            const res = await customerRegister(signUpData, ip, accessKey);
            console.log("RES::", res);
            if (res.success) {

                return redirect("/customer")
            }
        } catch (error: any) {
            console.log("Failed:", error)
            if (error instanceof FieldValidationError) {
                return { success: error.payload.success, error: error.payload.error, message: error.payload.message }
            }
            const value = Object.values(error)[0];
            return { success: false, error: true, message: value };
        }
    }
    return { success: false, error: true, message: "Invalid request method." };
}

export default function SignUpPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const navigation = useNavigation()
    const [showPassword, setShowPassword] = useState(false)
    const [isAcceptTerms, setIsAcceptTerms] = useState(false)
    const [showConPassword, setShowConPassword] = useState(false)
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
            // Compress image to max 2MB to avoid Vercel's 4.5MB body limit
            const compressed = await compressImage(file, {
                maxWidth: 1200,
                maxHeight: 1200,
                quality: 0.8,
                maxSizeMB: 2,
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
            // Fallback to original file if compression fails
            try {
                if (profileImage && profileImage.startsWith('blob:')) {
                    URL.revokeObjectURL(profileImage);
                }
                const objectUrl = URL.createObjectURL(file);
                setProfileImage(objectUrl);
            } catch {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    setProfileImage(result);
                };
                reader.onerror = () => {
                    setProfileError("Failed to load image preview");
                };
                reader.readAsDataURL(file);
            }
        } finally {
            setIsCompressing(false);
        }
    };

    return (
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
                            lg:top-0 lg:right-0 lg:left-auto lg:translate-x-0 lg:translate-y-0 lg:w-2/5 lg:h-full lg:rounded-none">

                <div className="rounded-full hidden sm:flex items-center justify-start mb-4 cursor-pointer" onClick={() => navigate("/")}>
                    <img src="/images/logo-white.png" className="w-30 h-10" />
                </div>

                <div className="space-y-2 mb-6">
                    <h1 className="flex items-center justify-start text-md sm:text-lg font-bold text-white uppercase">
                        <UserPlus className="text-rose-500" />&nbsp;&nbsp;{t('register.title')}
                    </h1>
                    <p className="text-white text-xs sm:text-sm">{t('register.subtitle')}</p>
                </div>
                <Form method="post" encType="multipart/form-data" className="space-y-1 sm:space-y-4">
                    <div className="flex flex-col items-center justify-center space-y-2">
                        <Label className="text-gray-300 text-sm">
                            {t('register.profileImage')}<span className="text-rose-500">*</span>
                        </Label>
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

                    <div className="grid grid-cols-2 gap-3">
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

                    <div>
                        <Label htmlFor="username" className="text-gray-300 text-sm">
                            {t('register.username')}<span className="text-rose-500">*</span>
                        </Label>
                        <div className="relative mt-1">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                required
                                type="text"
                                id="username"
                                name="username"
                                placeholder={t('register.username') + "..."}
                                className="pl-9 mt-1 border-white text-white placeholder-gray-400 focus:border-pink-500 backdrop-blur-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="mobile" className="text-gray-300 text-sm">
                            {t('register.mobileNumber')}<span className="text-rose-500">*</span>
                        </Label>
                        <div className="flex mt-1 space-x-2">
                            <Select name="telCode" defaultValue="+856">
                                <SelectTrigger className="mt-1 border-white text-white placeholder-gray-400 focus:border-pink-500 backdrop-blur-sm">
                                    <SelectValue placeholder="🇱🇦" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="+856">🇱🇦 Laos +856</SelectItem>
                                    <SelectItem value="+1">🇺🇸 +1</SelectItem>
                                    <SelectItem value="+66">🇹🇭 Thailand +66</SelectItem>
                                    <SelectItem value="+84">🇻🇳 Vietnam +84</SelectItem>
                                    <SelectItem value="+95">🇲🇲 Myanmar +95</SelectItem>
                                    <SelectItem value="+65">🇸🇬 Singapore +65</SelectItem>
                                    <SelectItem value="+60">🇲🇾 Malaysia +60</SelectItem>
                                    <SelectItem value="+62">🇮🇩 Indonesia +62</SelectItem>
                                    <SelectItem value="+855">🇰🇭 Cambodia +855</SelectItem>
                                    <SelectItem value="+63">🇵🇭 Philippines +63</SelectItem>
                                    <SelectItem value="+673">🇧🇳 Brunei +673</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                required
                                id="tel"
                                type="tel"
                                name="whatsapp"
                                placeholder="2078856194"
                                className="mt-1 border-white text-white placeholder-gray-400 focus:border-pink-500 backdrop-blur-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="gender" className="text-gray-300 text-sm">
                                {t('register.gender')}<span className="text-rose-500">*</span>
                            </Label>
                            <Select name="gender">
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
                        <div>
                            <Label htmlFor="dateOfBirth" className="text-gray-300 text-sm">
                                {t('register.dateOfBirth')}<span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                required
                                name="dob"
                                type="date"
                                id="dateOfBirth"
                                className="w-full mt-1 border-white text-white placeholder-gray-400 focus:border-pink-500 backdrop-blur-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
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
                        <div>
                            <Label htmlFor="confirmPassword" className="text-gray-300 text-sm">
                                {t('register.confirmPassword')}<span className="text-rose-500">*</span>
                            </Label>
                            <div className="relative mt-1">
                                <Input
                                    required
                                    type={showConPassword ? "text" : "password"}
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    placeholder="Pa$$w0rd!"
                                    className="mt-1 border-white text-white placeholder-gray-400 focus:border-pink-500 backdrop-blur-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConPassword(!showConPassword)}
                                    className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                >
                                    {showConPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {actionData?.error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <span className="text-red-200 text-sm">
                                {actionData.message}
                            </span>
                        </div>
                    )}
                    {actionData?.success && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-green-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                            <AlertCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span className="text-green-200 text-sm">
                                {actionData.message}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center justify-start space-x-2 text-sm mt-8 sm:mt-0">
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
                        disabled={isAcceptTerms === false || isSubmitting || isCompressing}
                        className={`w-full border border-rose-500 bg-rose-500 hover:bg-rose-600 text-white py-3 font-medium my-4 uppercase ${isAcceptTerms === false || isCompressing ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                        {(isSubmitting || isCompressing) ? <Loader className="w-4 h-4 mr-1 animate-spin" /> : ""}
                        {isCompressing ? t('profileEdit.compressing') : isSubmitting ? t('register.registering') : t('register.registerButton')}
                    </Button>

                    <div className="text-center space-x-2">
                        <span className="text-white">{t('register.alreadyHaveAccount')} </span>
                        <Link to="/login" className="text-white text-xs font-bold hover:text-rose-600 font-xs uppercase">
                            {t('register.backLogin')}
                        </Link>
                    </div>
                </Form>
            </div>
        </div>
    )
}
