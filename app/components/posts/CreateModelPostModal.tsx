import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRevalidator } from "react-router";
import { ImagePlus, Loader, X, Send } from "lucide-react";
import { Button } from "~/components/ui/button";

interface CreateModelPostModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  modelProfile?: { firstName: string; lastName?: string | null; profile?: string | null } | null;
}

export default function CreateModelPostModal({
  open,
  onClose,
  onSuccess,
  modelProfile,
}: CreateModelPostModalProps) {
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [previews, setPreviews] = useState<{ url: string; file: File }[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setContent("");
      setPreviews((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
      setError(null);
      setIsCompressing(false);
      setIsSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const totalCount = previews.length + newFiles.length;

    if (totalCount > 4) {
      setError(t("posts.create.maxImages", { defaultValue: "Maximum 4 images allowed" }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError(null);
    setIsCompressing(true);

    try {
      const { compressImage } = await import("~/utils/imageCompression");
      const newPreviews: { url: string; file: File }[] = [];

      for (const file of newFiles) {
        const compressed = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.8,
          maxSizeMB: 1,
        });
        const url = URL.createObjectURL(compressed);
        newPreviews.push({ url, file: compressed });
      }

      setPreviews((prev) => [...prev, ...newPreviews]);
    } catch (err: any) {
      setError(err?.message || "Failed to process images");
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError(t("posts.create.contentRequired", { defaultValue: "Please write something" }));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("content", content.trim());
      previews.forEach((p) => formData.append("images", p.file, p.file.name));

      const response = await fetch("/model/posts/create", {
        method: "POST",
        body: formData,
      });

      if (response.redirected) {
        revalidator.revalidate();
        onSuccess?.();
        return;
      }

      const result = await response.json();
      if (result?.error) {
        setError(t(result.message, { defaultValue: result.message }));
      }
    } catch {
      setError(t("posts.create.profanityBlocked", { defaultValue: "Failed to create post" }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />

      {/* Desktop: centered dialog */}
      <div className="hidden sm:flex relative items-center justify-center min-h-full p-4">
        <div
          className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <ModalContent
            t={t}
            content={content}
            setContent={setContent}
            previews={previews}
            isCompressing={isCompressing}
            isSubmitting={isSubmitting}
            error={error}
            modelProfile={modelProfile}
            onClose={onClose}
            handleSubmit={handleSubmit}
            handleFileSelect={handleFileSelect}
            removeImage={removeImage}
            fileInputRef={fileInputRef}
          />
        </div>
      </div>

      {/* Mobile: bottom sheet 90% height */}
      <div
        className="sm:hidden absolute bottom-0 left-0 right-0 h-[60vh] bg-white rounded-t-2xl shadow-xl overflow-y-auto animate-slide-up pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="sticky top-0 bg-white pt-3 pb-1 flex justify-center rounded-t-2xl z-10">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <ModalContent
          t={t}
          content={content}
          setContent={setContent}
          previews={previews}
          isCompressing={isCompressing}
          isSubmitting={isSubmitting}
          error={error}
          modelProfile={modelProfile}
          onClose={onClose}
          handleSubmit={handleSubmit}
          handleFileSelect={handleFileSelect}
          removeImage={removeImage}
          fileInputRef={fileInputRef}
          isMobile
        />
      </div>
    </div>
  );
}

function ModalContent({
  t,
  content,
  setContent,
  previews,
  isCompressing,
  isSubmitting,
  error,
  modelProfile,
  onClose,
  handleSubmit,
  handleFileSelect,
  removeImage,
  fileInputRef,
  isMobile,
}: {
  t: any;
  content: string;
  setContent: (v: string) => void;
  previews: { url: string; file: File }[];
  isCompressing: boolean;
  isSubmitting: boolean;
  error: string | null;
  modelProfile?: { firstName: string; lastName?: string | null; profile?: string | null } | null;
  onClose: () => void;
  handleSubmit: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeImage: (i: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isMobile?: boolean;
}) {
  return (
    <div className="p-4 flex flex-col h-full">
      {/* Header: Avatar + Name + Close */}
      <div className="flex items-center gap-3 mb-4">
        {modelProfile?.profile ? (
          <img
            src={modelProfile.profile}
            alt={modelProfile.firstName ?? ""}
            className="h-10 w-10 rounded-full object-cover border border-gray-200"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-sm font-medium text-rose-500">
            {modelProfile?.firstName?.charAt(0) ?? "?"}
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-medium">
            {modelProfile?.firstName ?? ""} {modelProfile?.lastName ?? ""}
          </p>
          <p className="text-xs text-gray-400">
            {t("posts.create.publicPost", { defaultValue: "Public post" })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Textarea */}
      <textarea
        rows={isMobile ? 4 : 4}
        maxLength={500}
        placeholder={t("posts.create.whatOnYourMind", { defaultValue: "What's on your mind?" })}
        className="w-full text-sm resize-none outline-none border-none p-0 placeholder-gray-400 mb-3 flex-shrink-0"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus
      />

      {/* Image Previews */}
      {previews.length > 0 && (
        <div className="flex gap-2 mb-3 flex-shrink-0 overflow-x-auto">
          {previews.map((preview, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden w-20 h-20 flex-shrink-0">
              <img
                src={preview.url}
                alt={`Preview ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Compressing indicator */}
      {isCompressing && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Loader className="h-4 w-4 animate-spin" />
          {t("posts.create.compressing", { defaultValue: "Processing images..." })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-3">
          {error}
        </div>
      )}

      {/* Spacer to push action bar to bottom */}
      <div className="flex-1" />

      {/* Action bar */}
      <div className="border-t pt-3 flex items-center justify-between flex-shrink-0">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-rose-500 transition-colors">
          <ImagePlus className="h-5 w-5 text-green-500" />
          <span>{t("posts.create.photo", { defaultValue: "Photo" })}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={isCompressing || isSubmitting || previews.length >= 4}
          />
        </label>

        <span className="text-xs text-gray-400">{content.length}/500</span>

        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting || isCompressing}
          size="sm"
          className="bg-rose-500 hover:bg-rose-600 text-white px-6"
        >
          {isSubmitting ? (
            <Loader className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          {t("posts.create.post", { defaultValue: "Post" })}
        </Button>
      </div>
    </div>
  );
}
