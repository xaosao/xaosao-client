import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { X, Check, Wallet, CreditCard, MessageCircle, Calendar, Loader } from "lucide-react";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerBalance: number;
  trialPrice: number;
  trialPlanId: string;
  onSubscribe: (planId: string) => Promise<void>;
}

export function SubscriptionModal({
  isOpen,
  onClose,
  customerBalance,
  trialPrice,
  trialPlanId,
  onSubscribe,
}: SubscriptionModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const hasEnoughBalance = customerBalance >= trialPrice;
  const balanceDeficit = hasEnoughBalance ? 0 : trialPrice - customerBalance;

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      await onSubscribe(trialPlanId);
      onClose();
    } catch (error) {
      console.error("Subscription error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPackages = () => {
    navigate("/customer/packages");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl animate-in zoom-in duration-300">
        <div className="relative p-6 border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h2 className="text-sm font-bold text-gray-900">
                {t("subscription.trial.title", { defaultValue: "Try 24-Hour Access" })}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t("subscription.trial.subtitle", {
                  defaultValue: "Unlock unlimited features for 24 hours",
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-6 space-y-4">
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-sm p-2 border border-rose-100">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  {t("subscription.trial.price", { defaultValue: "Trial Price" })}
                </p>
                <p className="text-lg font-bold text-rose-600">
                  {trialPrice.toLocaleString()} <span className="text-lg">KIP</span>
                </p>
              </div>
              <div className="text-right space-y-2">
                <p className="text-sm text-gray-600">
                  {t("subscription.trial.duration", { defaultValue: "Duration" })}
                </p>
                <p className="text-sm font-semibold text-gray-900">24 {t("subscription.trial.hours", { defaultValue: "Hours" })}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">
              {t("subscription.trial.benefits", { defaultValue: "What You Get:" })}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-900">
                    {t("subscription.trial.benefit1", { defaultValue: "Unlimited Chat" })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t("subscription.trial.benefit1Desc", {
                      defaultValue: "Chat with any model without restrictions",
                    })}
                  </p>
                </div>
                <Check className="w-5 h-5 text-green-500 shrink-0" />
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-rose-600" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-900">
                    {t("subscription.trial.benefit2", { defaultValue: "Unlimited Bookings" })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t("subscription.trial.benefit2Desc", {
                      defaultValue: "Book as many dates as you want",
                    })}
                  </p>
                </div>
                <Check className="w-5 h-5 text-green-500 shrink-0" />
              </div>
            </div>
          </div>
          <div
            className={`p-4 rounded-lg border ${hasEnoughBalance
              ? "bg-green-50 border-green-200"
              : "bg-amber-50 border-amber-200"
              }`}
          >
            <div className="flex items-center gap-3">
              <Wallet
                className={`w-5 h-5 ${hasEnoughBalance ? "text-green-600" : "text-amber-600"
                  }`}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {t("subscription.trial.yourBalance", { defaultValue: "Your Balance" })}
                </p>
                <p
                  className={`text-md font-semibold ${hasEnoughBalance ? "text-green-600" : "text-amber-600"
                    }`}
                >
                  {customerBalance.toLocaleString()} KIP
                </p>
              </div>
              {!hasEnoughBalance && (
                <div className="text-right">
                  <p className="text-xs text-amber-600">
                    {t("subscription.trial.needMore", { defaultValue: "Need" })}
                  </p>
                  <p className="text-sm font-semibold text-amber-700">
                    +{balanceDeficit.toLocaleString()} KIP
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleViewPackages}
              className="text-sm text-rose-600 hover:text-rose-700 font-medium hover:underline"
            >
              {t("subscription.trial.viewAllPackages", {
                defaultValue: "View all subscription packages →",
              })}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 p-6 space-x-3">
          {hasEnoughBalance ? (
            <>
              <Button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="w-full bg-rose-500 text-white text-sm shadow-lg hover:shadow-xl hover:bg-rose-500"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    {t("subscription.trial.subscribing", { defaultValue: "Subscribing..." })}
                  </span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {t("subscription.trial.subscribe", {
                      defaultValue: "Subscribe Now",
                    })}
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={onClose}
                variant="outline"
                className="w-auto text-sm"
              >
                {t("subscription.trial.close", { defaultValue: "Close" })}
              </Button>
              <Button
                onClick={() => {
                  // Store the current page URL for return after top-up
                  const bookingIntent = sessionStorage.getItem("booking_intent");
                  if (bookingIntent) {
                    const { modelId } = JSON.parse(bookingIntent);
                    sessionStorage.setItem("topup_return_url", `/customer/user-profile/${modelId}`);
                  } else {
                    sessionStorage.setItem("topup_return_url", window.location.pathname);
                  }
                  navigate("/customer/wallet-topup");
                  onClose();
                }}
                className="w-auto bg-rose-500 hover:bg-rose-500 text-white text-sm"
              >
                <CreditCard className="w-4 h-4" />
                {t("subscription.trial.topUp", {
                  defaultValue: "Top Up Wallet",
                })}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
