import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { X, Camera, Upload, AlertTriangle, Loader2, CheckCircle, ImagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { compressImage } from "~/utils/imageCompression";

interface ImageStatus {
  id: string;
  name: string;
  ok: boolean;
}

interface ProfileCheckData {
  needsAttention: boolean;
  profileOk: boolean;
  profileUrl: string | null;
  galleryImages: ImageStatus[];
  galleryCount: number;
  brokenGalleryImages: string[];
  needsMoreImages: boolean;
  modelName: string;
}

export function ProfileCheckModal() {
  const { t } = useTranslation();
  const checkFetcher = useFetcher<ProfileCheckData>();
  const uploadFetcher = useFetcher<any>();
  const profileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [localProfileUrl, setLocalProfileUrl] = useState<string | null>(null);
  const [localGalleryImages, setLocalGalleryImages] = useState<ImageStatus[]>([]);

  // Check on mount if not dismissed this session
  useEffect(() => {
    try {
      if (sessionStorage.getItem("profile_modal_dismissed") === "true") {
        setDismissed(true);
        return;
      }
    } catch {}

    checkFetcher.load("/model/check-profile-images");
  }, []);

  // Process check result
  useEffect(() => {
    if (checkFetcher.state === "idle" && checkFetcher.data && !dismissed) {
      const data = checkFetcher.data;
      if (data.needsAttention) {
        setIsOpen(true);
        setLocalProfileUrl(data.profileUrl);
        setLocalGalleryImages(data.galleryImages || []);
      }
    }
  }, [checkFetcher.state, checkFetcher.data, dismissed]);

  // Handle upload response
  useEffect(() => {
    if (uploadFetcher.state === "idle" && uploadFetcher.data) {
      setUploadingType(null);
      if (uploadFetcher.data.success) {
        if (uploadFetcher.data.intent === "uploadProfile") {
          setLocalProfileUrl(uploadFetcher.data.url);
          setProfilePreview(null);
        } else if (uploadFetcher.data.intent === "uploadGallery") {
          setLocalGalleryImages((prev) => [
            ...prev,
            { id: uploadFetcher.data.imageId, name: uploadFetcher.data.url, ok: true },
          ]);
        }
        // Re-check to update state
        checkFetcher.load("/model/check-profile-images");
      }
    }
  }, [uploadFetcher.state, uploadFetcher.data]);

  const handleClose = () => {
    setIsOpen(false);
    setDismissed(true);
    try { sessionStorage.setItem("profile_modal_dismissed", "true"); } catch {}
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingType("profile");
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8, maxSizeMB: 2 });
      setProfilePreview(URL.createObjectURL(compressed));

      const formData = new FormData();
      formData.append("intent", "uploadProfile");
      formData.append("file", compressed);
      if (localProfileUrl) formData.append("oldProfile", localProfileUrl);
      uploadFetcher.submit(formData, { method: "post", action: "/model/check-profile-images", encType: "multipart/form-data" });
    } catch (err) {
      setUploadingType(null);
      console.error("Profile upload error:", err);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingType("gallery");
      const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.7, maxSizeMB: 1 });

      const formData = new FormData();
      formData.append("intent", "uploadGallery");
      formData.append("file", compressed);
      uploadFetcher.submit(formData, { method: "post", action: "/model/check-profile-images", encType: "multipart/form-data" });
    } catch (err) {
      setUploadingType(null);
      console.error("Gallery upload error:", err);
    }
  };

  if (!isOpen) return null;

  const data = checkFetcher.data;
  if (!data) return null;

  const profileDisplayUrl = profilePreview || localProfileUrl;
  const profileIsOk = localProfileUrl ? (data.profileOk || profilePreview !== null || (uploadFetcher.data?.intent === "uploadProfile" && uploadFetcher.data?.success)) : false;
  const okGalleryCount = localGalleryImages.filter((i) => i.ok).length;
  const brokenCount = localGalleryImages.filter((i) => !i.ok).length;
  const emptySlots = Math.max(0, 6 - localGalleryImages.length);
  const isUploading = uploadingType !== null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl h-[85vh] sm:max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-bold text-gray-900">
              {t("profileCheck.title", { defaultValue: "ກວດເບິ່ງໂປຣໄຟລ໌ຂອງທ່ານ" })}
            </h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Warning message */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-sm text-amber-800">
              {t("profileCheck.warning", {
                defaultValue: "ຮູບໂປຣໄຟລ໌ ຫຼື ຮູບພາບຂອງທ່ານບາງຮູບໄດ້ສູນຫາຍ. ກະລຸນາອັບໂຫຼດໃໝ່ເພື່ອໃຫ້ລູກຄ້າສາມາດເຫັນໂປຣໄຟລ໌ຂອງທ່ານ.",
              })}
            </p>
          </div>

          {/* Profile Image */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Camera className="h-4 w-4" />
              {t("profileCheck.profileImage", { defaultValue: "ຮູບໂປຣໄຟລ໌" })}
              {profileIsOk ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <span className="text-xs text-red-500 font-normal">
                  {t("profileCheck.missing", { defaultValue: "ຂາດຫາຍ" })}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex-shrink-0">
                {profileDisplayUrl ? (
                  <img src={profileDisplayUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="h-8 w-8 text-gray-300" />
                  </div>
                )}
                {uploadingType === "profile" && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <button
                onClick={() => profileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white text-sm rounded-lg hover:bg-rose-600 disabled:bg-gray-300 transition-colors"
              >
                <Upload className="h-4 w-4" />
                {t("profileCheck.uploadProfile", { defaultValue: "ອັບໂຫຼດຮູບໂປຣໄຟລ໌" })}
              </button>
              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileUpload}
              />
            </div>
          </div>

          {/* Gallery Images */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <ImagePlus className="h-4 w-4" />
              {t("profileCheck.galleryImages", { defaultValue: "ຮູບພາບ" })}
              <span className="text-xs text-gray-500 font-normal">
                ({okGalleryCount}/6)
              </span>
              {brokenCount > 0 && (
                <span className="text-xs text-red-500 font-normal">
                  · {brokenCount} {t("profileCheck.broken", { defaultValue: "ສູນຫາຍ" })}
                </span>
              )}
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {/* Existing images */}
              {localGalleryImages.map((img) => (
                <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  {img.ok ? (
                    <img src={img.name} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 border-2 border-dashed border-red-200">
                      <AlertTriangle className="h-5 w-5 text-red-400 mb-1" />
                      <span className="text-[10px] text-red-400">{t("profileCheck.lost", { defaultValue: "ສູນຫາຍ" })}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Empty slots + upload button */}
              {emptySlots > 0 && (
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isUploading}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 hover:border-rose-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {uploadingType === "gallery" ? (
                    <Loader2 className="h-6 w-6 text-rose-500 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-gray-400 mb-1" />
                      <span className="text-[10px] text-gray-400">{t("profileCheck.addImage", { defaultValue: "ເພີ່ມຮູບ" })}</span>
                    </>
                  )}
                </button>
              )}

              {/* Remaining empty slots (visual only) */}
              {Array.from({ length: Math.max(0, emptySlots - 1) }, (_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50"
                >
                  <Camera className="h-5 w-5 text-gray-200" />
                </div>
              ))}
            </div>

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGalleryUpload}
            />
          </div>

          {/* Upload error */}
          {uploadFetcher.data?.error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 text-center">
              {uploadFetcher.data.error}
            </div>
          )}

          {/* Status summary */}
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <p className="flex items-center gap-1.5">
              {profileIsOk ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              {t("profileCheck.profileStatus", { defaultValue: "ຮູບໂປຣໄຟລ໌" })}: {profileIsOk ? t("profileCheck.ok", { defaultValue: "ປົກກະຕິ" }) : t("profileCheck.needsUpload", { defaultValue: "ຕ້ອງອັບໂຫຼດ" })}
            </p>
            <p className="flex items-center gap-1.5">
              {okGalleryCount >= 6 ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              {t("profileCheck.galleryStatus", { defaultValue: "ຮູບພາບ" })}: {okGalleryCount}/6
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
