import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useFetcher } from "react-router";
import { Gift, X, Loader2, Wallet } from "lucide-react";

interface GiftItem {
  id: string;
  name: string;
  image: string;
  price: number;
}

interface ChatAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string;
  reason: "gift_required" | "subscribe" | string;
  whatsappNumber?: number | null;
  onGiftSent?: () => void;
}

export function ChatAccessModal({
  isOpen,
  onClose,
  modelId,
  reason,
  whatsappNumber,
  onGiftSent,
}: ChatAccessModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const giftFetcher = useFetcher<{ gifts: GiftItem[] }>();
  const sendFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const [selectedGift, setSelectedGift] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Load gifts when modal opens with gift_required reason
  useEffect(() => {
    if (isOpen && reason === "gift_required" && giftFetcher.state === "idle" && !giftFetcher.data) {
      giftFetcher.load("/customer/send-direct-gift");
    }
  }, [isOpen, reason]);

  // Handle send gift response
  useEffect(() => {
    if (sendFetcher.state === "idle" && sendFetcher.data) {
      if (sendFetcher.data.success) {
        onClose();
        onGiftSent?.();
        if (whatsappNumber) {
          window.open(`https://wa.me/${whatsappNumber}`);
        }
      } else if (sendFetcher.data.error) {
        setError(sendFetcher.data.error);
      }
    }
  }, [sendFetcher.state, sendFetcher.data]);

  if (!isOpen) return null;

  const gifts = giftFetcher.data?.gifts || [];
  const isLoadingGifts = giftFetcher.state === "loading";
  const isSending = sendFetcher.state !== "idle";

  const handleSendGift = () => {
    if (!selectedGift) return;
    setError("");
    sendFetcher.submit(
      { modelId, giftId: selectedGift },
      { method: "post", action: "/customer/send-direct-gift" }
    );
  };

  // Subscribe required screen
  if (reason === "subscribe") {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl max-w-sm w-full p-6 text-center relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>

          <div className="w-16 h-16 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center">
            <Wallet className="h-8 w-8 text-rose-500" />
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {t("chat.subscribeRequired.title", { defaultValue: "ຕ້ອງສະໝັກສະມາຊິກກ່ອນ" })}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {t("chat.subscribeRequired.description", {
              defaultValue: "ທ່ານຕ້ອງສະໝັກສະມາຊິກກ່ອນຈຶ່ງຈະສາມາດສົນທະນາກັບນາງແບບໄດ້",
            })}
          </p>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onClose}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              {t("common.close", { defaultValue: "ປິດ" })}
            </button>
            <button
              onClick={() => {
                onClose();
                navigate("/customer/packages");
              }}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              {t("chat.subscribeRequired.subscribe", { defaultValue: "ສະໝັກສະມາຊິກ" })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gift required screen
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-4">
          <div className="w-14 h-14 mx-auto mb-3 bg-rose-100 rounded-full flex items-center justify-center">
            <Gift className="h-7 w-7 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {t("chat.giftRequired.title", { defaultValue: "ສົ່ງຂອງຂວັນເພື່ອແຊັດ" })}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {t("chat.giftRequired.description", {
              defaultValue: "ທ່ານໃຊ້ 2 ແຊັດຟຣີໝົດແລ້ວ. ສົ່ງຂອງຂວັນໃຫ້ນາງແບບເພື່ອເລີ່ມສົນທະນາ.",
            })}
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3 text-center">
            {error}
          </div>
        )}

        {isLoadingGifts ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-rose-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {gifts.map((gift) => (
              <button
                key={gift.id}
                onClick={() => { setSelectedGift(gift.id); setError(""); }}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                  selectedGift === gift.id
                    ? "border-rose-500 bg-rose-50"
                    : "border-gray-100 hover:border-rose-200"
                }`}
              >
                <img src={gift.image} alt={gift.name} className="w-10 h-10 object-contain mb-1" />
                <span className="text-xs text-gray-700 font-medium truncate w-full text-center">{gift.name}</span>
                <span className="text-xs text-rose-500 font-bold">{gift.price.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            {t("common.close", { defaultValue: "ປິດ" })}
          </button>
          <button
            onClick={handleSendGift}
            disabled={!selectedGift || isSending}
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            {isSending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t("common.sending", { defaultValue: "ກຳລັງສົ່ງ..." })}</>
            ) : (
              <><Gift className="h-4 w-4" />{t("chat.giftRequired.send", { defaultValue: "ສົ່ງຂອງຂວັນ" })}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
