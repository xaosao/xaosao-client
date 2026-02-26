import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRevalidator } from "react-router";
import { Loader, X, Send } from "lucide-react";
import { Button } from "~/components/ui/button";

interface CreateCustomerPostModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  services: { id: string; name: string }[];
  customerProfile?: { firstName: string; lastName?: string | null; profile?: string | null } | null;
}

export default function CreateCustomerPostModal({
  open,
  onClose,
  onSuccess,
  services,
  customerProfile,
}: CreateCustomerPostModalProps) {
  const { t } = useTranslation();
  const revalidator = useRevalidator();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const content = formData.get("content") as string;
    if (!content?.trim()) {
      setError(t("posts.create.contentRequired", { defaultValue: "Please write something" }));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/customer/posts/create", {
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
      setError(t("posts.create.failed", { defaultValue: "Failed to create post" }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formContent = (
    <div className="p-4">
      {/* Header: Avatar + Name + Close */}
      <div className="flex items-center gap-3 mb-4">
        {customerProfile?.profile ? (
          <img
            src={customerProfile.profile}
            alt={customerProfile.firstName ?? ""}
            className="h-10 w-10 rounded-full object-cover border border-gray-200"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-sm font-medium text-rose-500">
            {customerProfile?.firstName?.charAt(0) ?? "?"}
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-medium">
            {customerProfile?.firstName ?? ""} {customerProfile?.lastName ?? ""}
          </p>
          <p className="text-xs text-gray-400">
            {t("posts.create.publicPost", { defaultValue: "Public post" })}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Content */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            {t("posts.create.whatLookingFor", { defaultValue: "What are you looking for?" })}
          </label>
          <textarea
            name="content"
            rows={3}
            required
            maxLength={500}
            placeholder={t("posts.create.contentPlaceholder", { defaultValue: "E.g., I want 2 girls for drinking tonight in Vientiane..." })}
            className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none resize-none"
            autoFocus
          />
        </div>

        {/* Service */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            {t("posts.create.service", { defaultValue: "Service" })}
          </label>
          <select name="serviceId" className="w-full border rounded-lg p-2.5 text-sm bg-white">
            <option value="">{t("posts.create.anyService", { defaultValue: "Any service" })}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {t(`modelServices.serviceItems.${s.name}.name`, { defaultValue: s.name })}
              </option>
            ))}
          </select>
        </div>

        {/* Gender & Count */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {t("posts.create.gender", { defaultValue: "Gender" })}
            </label>
            <select name="targetGender" className="w-full border rounded-lg p-2.5 text-sm bg-white">
              <option value="">{t("posts.create.anyGender", { defaultValue: "Any" })}</option>
              <option value="female">{t("posts.create.female", { defaultValue: "Female" })}</option>
              <option value="male">{t("posts.create.male", { defaultValue: "Male" })}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {t("posts.create.count", { defaultValue: "How many?" })}
            </label>
            <input
              type="number"
              name="targetCount"
              min={1}
              max={10}
              placeholder="1"
              className="w-full border rounded-lg p-2.5 text-sm"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            {t("posts.create.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
          >
            {isSubmitting ? (
              <Loader className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            {t("posts.create.submit", { defaultValue: "Post & Notify" })}
          </Button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />

      {/* Desktop: centered dialog */}
      <div className="hidden sm:flex relative items-center justify-center min-h-full p-4">
        <div
          className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {formContent}
        </div>
      </div>

      {/* Mobile: bottom sheet */}
      <div
        className="sm:hidden absolute bottom-0 left-0 right-0 max-h-[92vh] bg-white rounded-t-2xl shadow-xl overflow-y-auto animate-slide-up pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white pt-3 pb-1 flex justify-center rounded-t-2xl z-10">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        {formContent}
      </div>
    </div>
  );
}
