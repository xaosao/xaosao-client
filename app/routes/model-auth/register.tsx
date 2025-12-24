import { useTranslation } from "react-i18next";
import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Camera, X, Loader, Gift } from "lucide-react";
import type { ActionFunctionArgs, MetaFunction, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useNavigation, useNavigate, useLoaderData } from "react-router";

// services:
import { modelRegister } from "~/services/model-auth.server";
import { uploadFileToBunnyServer } from "~/services/upload.server";
import type { IModelSignupCredentials } from "~/services/model-auth.server";
import { validateModelSignUpInputs } from "~/services/model-validation.server";
import { compressImage } from "~/utils/imageCompression";
import { findReferrerByCode } from "~/services/referral.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Companion Registration - XaoSao" },
    { name: "description", content: "Register as a companion" },
  ];
};

interface LoaderData {
  referralCode: string | null;
  referrerName: string | null;
  referrerId: string | null;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData> {
  const { getModelFromSession } = await import("~/services/model-auth.server");
  const { redirect } = await import("react-router");

  // Check if model is already logged in
  const modelId = await getModelFromSession(request);

  if (modelId) {
    // Model already logged in, redirect to dashboard
    throw redirect("/model");
  }

  const url = new URL(request.url);
  const referralCode = url.searchParams.get("ref");

  if (!referralCode) {
    return { referralCode: null, referrerName: null, referrerId: null };
  }

  // Find referrer by code
  const referrer = await findReferrerByCode(referralCode);

  if (!referrer) {
    return { referralCode, referrerName: null, referrerId: null };
  }

  return {
    referralCode,
    referrerName: referrer.firstName,
    referrerId: referrer.id,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST requests
  if (request.method !== "POST") {
    return {
      error: "modelAuth.errors.invalidRequestMethod",
    };
  }

  const formData = await request.formData();

  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  const username = formData.get("username");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");
  const dob = formData.get("dob");
  const gender = formData.get("gender");
  const whatsapp = formData.get("whatsapp");
  const bio = formData.get("bio");
  const address = formData.get("address");
  const career = formData.get("career");
  const education = formData.get("education");
  const interestsJson = formData.get("interests");
  const newProfile = formData.get("newProfile") as File | null;
  const referrerId = formData.get("referrerId") as string | null;

  // Basic required fields validation
  if (!firstName || !username || !password || !dob || !gender || !whatsapp || !bio || !address) {
    return {
      error: "modelAuth.errors.requiredFieldsMissing",
    };
  }

  // Profile image validation
  if (!newProfile || !(newProfile instanceof File) || newProfile.size === 0) {
    return {
      error: "modelAuth.errors.profileImageRequired",
    };
  }

  // File size validation (max 10MB)
  if (newProfile.size > 10 * 1024 * 1024) {
    return {
      error: "modelAuth.errors.profileImageTooLarge",
    };
  }

  // File type validation (relaxed for iOS compatibility - iOS may report heic/heif or empty type)
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", ""];
  const fileExtension = newProfile.name.toLowerCase().split('.').pop();
  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
  if (!allowedTypes.includes(newProfile.type) && !allowedExtensions.includes(fileExtension || "")) {
    return {
      error: "modelAuth.errors.profileImageInvalidFormat",
    };
  }

  // Password confirmation validation
  if (password !== confirmPassword) {
    return {
      error: "modelAuth.errors.passwordsDoNotMatch",
    };
  }

  try {
    // Parse interests
    let interests: string[] | undefined;
    if (interestsJson) {
      try {
        const parsed = JSON.parse(String(interestsJson));
        interests = Array.isArray(parsed) ? parsed : undefined;
      } catch {
        interests = undefined;
      }
    }

    // Upload profile image to Bunny CDN
    const buffer = Buffer.from(await newProfile.arrayBuffer());
    const profileUrl = await uploadFileToBunnyServer(buffer, newProfile.name, newProfile.type);

    // Prepare model data for validation
    const modelData: IModelSignupCredentials = {
      firstName: String(firstName).trim(),
      lastName: lastName ? String(lastName).trim() : undefined,
      username: String(username).trim(),
      password: String(password),
      dob: String(dob),
      gender: String(gender) as "male" | "female" | "other",
      whatsapp: Number(whatsapp),
      bio: String(bio).trim(),
      profile: profileUrl,
      address: String(address).trim(),
      career: career ? String(career).trim() : undefined,
      education: education ? String(education).trim() : undefined,
      interests,
      referrerId: referrerId || undefined,
    };

    // Validate all inputs against SQL injection and business rules
    validateModelSignUpInputs(modelData);

    // Get client IP
    const ip = request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const accessKey = process.env.APIIP_API_KEY || "";

    const result = await modelRegister(modelData, ip.split(",")[0], accessKey);

    if (result.success) {
      return {
        success: true,
        message: result.message,
      };
    }

    return { error: result.message };
  } catch (error: any) {
    // Handle validation errors (thrown as object with field keys)
    if (error && typeof error === "object" && !error.message) {
      const fieldNames: Record<string, string> = {
        firstName: "First Name",
        lastName: "Last Name",
        username: "Username",
        password: "Password",
        dob: "Date of Birth",
        gender: "Gender",
        whatsapp: "Phone Number",
        bio: "Bio",
        profile: "Profile Image",
        address: "Address",
        career: "Career",
        education: "Education",
        interests: "Interests",
      };

      // Get first error with field name
      const firstErrorKey = Object.keys(error)[0];
      const firstErrorValue = error[firstErrorKey];
      const fieldLabel = fieldNames[firstErrorKey] || firstErrorKey;

      return {
        error: String(firstErrorValue),
        errorField: fieldLabel,
      };
    }

    return {
      error: error.message || "modelAuth.errors.registrationFailed",
    };
  }
}

export default function ModelRegister() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<LoaderData>();
  const isSubmitting = navigation.state === "submitting";

  const [image, setImage] = useState<string>("");
  const [newInterest, setNewInterest] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [profileError, setProfileError] = useState<string>("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  useEffect(() => {
    if (actionData?.success) {
      const timer = setTimeout(() => {
        navigate(
          "/model-auth/login?toastMessage=Registration successful! Please login with your credentials.&toastType=success&toastDuration=5000"
        );
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [actionData, navigate]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear previous errors
    setProfileError("");

    if (!e.target.files || !e.target.files[0]) {
      return;
    }

    const file = e.target.files[0];

    // File size validation (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setProfileError(t("modelAuth.errors.profileImageTooLarge"));
      setImage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Relaxed file type validation for iOS compatibility
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", ""];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || "")) {
      setProfileError(t("modelAuth.errors.profileImageInvalidFormat"));
      setImage("");
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
      if (image && image.startsWith('blob:')) {
        URL.revokeObjectURL(image);
      }
      const objectUrl = URL.createObjectURL(compressed);
      setImage(objectUrl);

      // Update the file input with compressed file
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(compressed);
        fileInputRef.current.files = dataTransfer.files;
      }
    } catch (error) {
      console.error('Error compressing image:', error);
      const errorMessage = error instanceof Error ? error.message : t("modelAuth.errors.imageProcessFailed", { defaultValue: "Failed to process image" });
      setProfileError(errorMessage);
      setImage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsCompressing(false);
    }
  };

  const removeInterest = (index: number) => {
    setInterests(interests.filter((_, i) => i !== index));
  };

  const addInterest = () => {
    if (newInterest.trim()) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest("");
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!image) {
      e.preventDefault();
      setProfileError(t("modelAuth.errors.profileImageRequiredUpload"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-purple-50 px-4 py-2">
      <div className="max-w-2xl w-full space-y-8 bg-white px-2 sm:px-8 py-4 rounded-lg shadow-xl">
        {/* Referral Banner */}
        {loaderData.referrerName && (
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg p-4 text-white flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-sm">{t("modelAuth.register.referredBy")}</p>
              <p className="text-white/90 text-xs">{loaderData.referrerName} {t("modelAuth.register.invitedYou")}</p>
            </div>
          </div>
        )}

        <Form method="post" encType="multipart/form-data" className="mt-4 sm:mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Hidden input for referrer ID */}
          {loaderData.referrerId && (
            <input type="hidden" name="referrerId" value={loaderData.referrerId} />
          )}

          <div className="flex flex-col items-center justify-center space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("modelAuth.register.profileImage")} <span className="text-rose-500">*</span>
            </label>
            <div className="relative w-[120px] h-[120px] rounded-full flex items-center justify-center">
              <img
                src={image || "https://xaosao.b-cdn.net/default-image.png"}
                alt="Profile Preview"
                className={`w-full h-full rounded-full object-cover shadow-md border-2 ${profileError ? "border-red-500" : "border-rose-200"} ${isCompressing ? "opacity-50" : ""}`}
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
                className="absolute bottom-1 right-1 bg-rose-500 p-2 rounded-full cursor-pointer shadow-md hover:bg-rose-600 disabled:opacity-50"
              >
                <Camera className="w-5 h-5 text-white" />
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
              <p className="text-sm text-red-600 mt-1 text-center">{profileError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.firstName")} <span className="text-rose-500">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                placeholder={t("modelAuth.register.firstNamePlaceholder")}
                className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.lastName")}
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                placeholder={t("modelAuth.register.lastNamePlaceholder")}
                className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.username")} <span className="text-rose-500">*</span>
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                placeholder={t("modelAuth.register.usernamePlaceholder")}
                className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.phoneNumber")} <span className="text-rose-500">*</span>
              </label>
              <input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                required
                maxLength={10}
                placeholder="2012345678"
                className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.dateOfBirth")} <span className="text-rose-500">*</span>
              </label>
              <input
                id="dob"
                name="dob"
                type="date"
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.gender")} <span className="text-rose-500">*</span>
              </label>
              <select
                id="gender"
                name="gender"
                required
                className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">{t("modelAuth.register.selectGender")}</option>
                <option value="male">{t("modelAuth.register.male")}</option>
                <option value="female">{t("modelAuth.register.female")}</option>
                <option value="other">{t("modelAuth.register.other")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.password")} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder={t("modelAuth.register.passwordPlaceholder")}
                  className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? <Eye className="h-4 w-4 cursor-pointer" /> : <EyeOff className="h-4 w-4 cursor-pointer" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.confirmPassword")} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder={t("modelAuth.register.confirmPasswordPlaceholder")}
                  className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? <Eye className="h-4 w-4 cursor-pointer" /> : <EyeOff className="h-4 w-4 cursor-pointer" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.address")} <span className="text-rose-500">*</span>
              </label>
              <input
                id="address"
                name="address"
                type="text"
                required
                placeholder={t("modelAuth.register.addressPlaceholder")}
                className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.bio")} <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={2}
                required
                placeholder={t("modelAuth.register.bioPlaceholder")}
                className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="career" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.career")}
              </label>
              <input
                id="career"
                name="career"
                type="text"
                placeholder={t("modelAuth.register.careerPlaceholder")}
                className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="education" className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.education")}
              </label>
              <input
                id="education"
                name="education"
                type="text"
                placeholder={t("modelAuth.register.educationPlaceholder")}
                className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("modelAuth.register.interests")}
              </label>
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
                <input
                  type="text"
                  placeholder={t("modelAuth.register.interestsDescription")}
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addInterest();
                    }
                  }}
                  className="text-sm flex-1 appearance-none px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={addInterest}
                  className="px-4 py-2 bg-rose-100 border border-rose-200 text-rose-500 hover:bg-rose-200 rounded-lg text-sm font-medium"
                >
                  {t("modelAuth.register.addInterest")}
                </button>
              </div>
              <input type="hidden" name="interests" value={JSON.stringify(interests)} />
            </div>

            <div className="mt-4 sm:mt-8">
              <button
                type="submit"
                disabled={isSubmitting || isCompressing}
                className="cursor-pointer w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(isSubmitting || isCompressing) && <Loader className="w-4 h-4 animate-spin" />}
                {isCompressing ? t("profileEdit.compressing") : isSubmitting ? t("modelAuth.register.registering") : t("modelAuth.register.register")}
              </button>
            </div>
          </div>

          {actionData?.error && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {(actionData as any).errorField && (
                <span className="font-semibold">{(actionData as any).errorField}: </span>
              )}
              {t(actionData.error)}
            </div>
          )}

          <div className="text-center text-sm">
            <p className="text-gray-600">
              {t("modelAuth.register.alreadyHaveAccount")}&nbsp;&nbsp;
              <Link to="/model-auth/login" className="font-medium text-rose-600 hover:text-rose-500 text-xs uppercase">
                {t("modelAuth.register.loginHere")}
              </Link>
            </p>
          </div>
        </Form>
      </div>
    </div>
  );
}
