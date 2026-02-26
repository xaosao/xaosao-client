import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Loader, X, Send } from "lucide-react";
import { redirect, useNavigate, type ActionFunctionArgs, type LoaderFunction } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { requireModelSession } from "~/services/model-auth.server";
import { uploadFileToBunnyServer } from "~/services/upload.server";
import { createPost, getModelBasicProfile } from "~/services/post.server";

interface LoaderReturn {
  modelProfile: { firstName: string; lastName?: string | null; profile?: string | null };
}

export const loader: LoaderFunction = async ({ request }) => {
  const modelId = await requireModelSession(request);
  const modelProfile = await getModelBasicProfile(modelId);
  return { modelProfile };
};

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();

  const content = formData.get("content") as string;
  if (!content?.trim()) {
    return { error: true, message: "posts.create.contentRequired" };
  }

  try {
    // Upload images to BunnyCDN
    const imageFiles = formData.getAll("images").filter(
      (f): f is File => f instanceof File && f.size > 0
    );

    if (imageFiles.length > 4) {
      return { error: true, message: "Maximum 4 images allowed" };
    }

    const imageUrls: string[] = [];
    if (imageFiles.length > 0) {
      const uploads = await Promise.all(
        imageFiles.map(async (file) => {
          const buffer = Buffer.from(await file.arrayBuffer());
          return uploadFileToBunnyServer(buffer, file.name, file.type);
        })
      );
      imageUrls.push(...uploads);
    }

    await createPost({
      authorType: "model",
      modelId,
      content: content.trim(),
      images: imageUrls,
    });

    return redirect("/model");
  } catch (error: any) {
    return { error: true, message: error?.message || "posts.create.failed" };
  }
}

interface PageProps {
  loaderData: LoaderReturn;
}

export default function CreateModelPost({ loaderData }: PageProps) {
  const modelProfile = loaderData?.modelProfile;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [previews, setPreviews] = useState<{ url: string; file: File }[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup Object URLs on unmount
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

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

      const response = await fetch(window.location.pathname, {
        method: "POST",
        body: formData,
      });

      if (response.redirected) {
        window.location.href = response.url;
        return;
      }

      const result = await response.json();
      if (result?.error) {
        setError(t(result.message, { defaultValue: result.message }));
      }
    } catch {
      setError(t("posts.create.failed", { defaultValue: "Failed to create post" }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
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
              onClick={() => navigate("/model")}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <textarea
            rows={4}
            maxLength={500}
            placeholder={t("posts.create.whatOnYourMind", { defaultValue: "What's on your mind?" })}
            className="w-full text-sm resize-none outline-none border-none p-0 placeholder-gray-400 mb-3"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          {/* Image Previews */}
          {previews.length > 0 && (
            <div className={`grid gap-2 mb-3 ${previews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {previews.map((preview, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden aspect-square">
                  <img
                    src={preview.url}
                    alt={`Preview ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
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

          {/* Action bar */}
          <div className="border-t pt-3 flex items-center justify-between">
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
        </CardContent>
      </Card>
    </div>
  );
}
