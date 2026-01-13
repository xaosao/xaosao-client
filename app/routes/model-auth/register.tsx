import { useTranslation } from "react-i18next";
import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Camera, Loader, Gift, ArrowLeft } from "lucide-react";
import type { ActionFunctionArgs, MetaFunction, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useNavigation, useNavigate, useLoaderData } from "react-router";

// services:
import { compressImage } from "~/utils/imageCompression";
import { modelRegister } from "~/services/model-auth.server";
import { findReferrerByCode } from "~/services/referral.server";
import { uploadFileToBunnyServer } from "~/services/upload.server";
import type { IModelSignupCredentials } from "~/services/model-auth.server";
import { validateModelSignUpInputs } from "~/services/model-validation.server";

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
  const password = formData.get("password");
  const dobYear = formData.get("dobYear");
  const dobMonth = formData.get("dobMonth");
  const dobDay = formData.get("dobDay");
  const gender = formData.get("gender");
  const whatsapp = formData.get("whatsapp");
  const bio = formData.get("bio");
  const address = formData.get("address");
  const newProfile = formData.get("newProfile") as File | null;
  const referrerId = formData.get("referrerId") as string | null;

  // Validate and construct DOB
  if (!dobYear || !dobMonth || !dobDay) {
    return {
      error: "modelAuth.errors.dobRequired",
    };
  }

  // Construct DOB string in YYYY-MM-DD format
  const dob = `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`;

  // Basic required fields validation
  if (!firstName || !password || !gender || !whatsapp || !bio || !address) {
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

  try {
    // Upload profile image to Bunny CDN
    const buffer = Buffer.from(await newProfile.arrayBuffer());
    const profileUrl = await uploadFileToBunnyServer(buffer, newProfile.name, newProfile.type);

    // Prepare model data for validation
    const modelData: IModelSignupCredentials = {
      firstName: String(firstName).trim(),
      lastName: lastName ? String(lastName).trim() : undefined,
      password: String(password),
      dob: String(dob),
      gender: String(gender) as "male" | "female" | "other",
      whatsapp: Number(whatsapp),
      bio: String(bio).trim(),
      profile: profileUrl,
      address: String(address).trim(),
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
        password: "Password",
        dob: "Date of Birth",
        gender: "Gender",
        whatsapp: "Phone Number",
        bio: "Bio",
        profile: "Profile Image",
        address: "Address",
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
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [profileError, setProfileError] = useState<string>("");
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!image) {
      e.preventDefault();
      setProfileError(t("modelAuth.errors.profileImageRequiredUpload"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-purple-50 px-2 sm:px-4 py-2">
      <div className="max-w-2xl w-full space-y-8 bg-white px-2 sm:px-8 py-4 rounded-lg shadow-xl">
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
            <div className="flex items-center justify-center gap-2">
              <ArrowLeft className="w-5 h-5 text-gray-500" onClick={() => navigate("/model-auth/login")} />
              <label className="block text-sm font-medium text-gray-700">
                {t("modelAuth.register.profileImage")} <span className="text-rose-500">*</span>
              </label>
            </div>
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("modelAuth.register.dateOfBirth")} <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  id="dobYear"
                  name="dobYear"
                  required
                  className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                  className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                  className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">{t("modelAuth.register.day")}</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
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

            <div className="mt-2 md:col-span-2">
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
            </div>

            <div className="mt-4 sm:mt-8 md:col-span-2">
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
