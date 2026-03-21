import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { CalendarCheck, X } from "lucide-react";

interface BookingRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string;
}

export function BookingRequiredModal({ isOpen, onClose, modelId }: BookingRequiredModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="w-16 h-16 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center">
          <CalendarCheck className="h-8 w-8 text-rose-500" />
        </div>

        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {t("chat.bookingRequired.title", { defaultValue: "ຕ້ອງຈອງບໍລິການກ່ອນ" })}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {t("chat.bookingRequired.description", {
            defaultValue: "ທ່ານຕ້ອງຈອງບໍລິການກັບນາງແບບຄົນນີ້ກ່ອນຈຶ່ງຈະສາມາດສົນທະນາໄດ້",
          })}
        </p>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            {t("chat.bookingRequired.cancel", { defaultValue: "ປິດ" })}
          </button>
          <button
            onClick={() => {
              onClose();
              navigate(`/customer/user-profile/${modelId}`);
            }}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            {t("chat.bookingRequired.bookNow", { defaultValue: "ຈອງດຽວນີ້" })}
          </button>
        </div>
      </div>
    </div>
  );
}
