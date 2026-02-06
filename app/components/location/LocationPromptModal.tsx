import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, X, Shield, Navigation } from "lucide-react";
import { Button } from "~/components/ui/button";

interface LocationPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestLocation: () => void;
}

/**
 * Soft prompt modal for location permission
 * Shows a friendly explanation before triggering the browser's permission dialog
 * This increases permission acceptance rates compared to cold-triggering the browser dialog
 */
export function LocationPromptModal({
  isOpen,
  onClose,
  onRequestLocation,
}: LocationPromptModalProps) {
  const { t } = useTranslation();
  const [isRequesting, setIsRequesting] = useState(false);

  if (!isOpen) return null;

  const handleEnableLocation = () => {
    setIsRequesting(true);
    onRequestLocation();
    // Close modal after a short delay to allow the browser dialog to appear
    setTimeout(() => {
      setIsRequesting(false);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center">
            <MapPin className="w-8 h-8 text-rose-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-center text-gray-900 mb-2">
          {t("location.prompt.title", { defaultValue: "Enable Location" })}
        </h2>

        {/* Description */}
        <p className="text-gray-600 text-center text-sm mb-6">
          {t("location.prompt.description", {
            defaultValue:
              "Allow location access to find models near you and get the best experience.",
          })}
        </p>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Navigation className="w-4 h-4 text-emerald-600" />
            </div>
            <span>
              {t("location.prompt.benefit1", {
                defaultValue: "Find nearby models",
              })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <span>
              {t("location.prompt.benefit2", {
                defaultValue: "Your location is private and secure",
              })}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <Button
            onClick={handleEnableLocation}
            disabled={isRequesting}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3"
          >
            <MapPin className="w-4 h-4 mr-2" />
            {isRequesting
              ? t("location.prompt.enabling", { defaultValue: "Enabling..." })
              : t("location.prompt.enable", { defaultValue: "Enable Location" })}
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full text-gray-500 hover:text-gray-700"
          >
            {t("location.prompt.later", { defaultValue: "Maybe Later" })}
          </Button>
        </div>

        {/* Note */}
        <p className="text-xs text-gray-400 text-center mt-4">
          {t("location.prompt.note", {
            defaultValue: "You can change this anytime in your browser settings.",
          })}
        </p>
      </div>
    </div>
  );
}
