import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router";

type ToastType = "success" | "error" | "warning";

interface ToastStyleConfig {
   bg: string;
   border: string;
   text: string;
   iconColor: string;
}

const toastStyles: Record<ToastType, ToastStyleConfig> = {
   success: {
      bg: "bg-gradient-to-r from-green-50 to-green-100",
      border: "border-green-500",
      text: "text-green-800",
      iconColor: "text-green-500",
   },
   error: {
      bg: "bg-gradient-to-r from-red-50 to-red-100",
      border: "border-red-500",
      text: "text-red-800",
      iconColor: "text-red-500",
   },
   warning: {
      bg: "bg-gradient-to-r from-yellow-50 to-yellow-100",
      border: "border-yellow-500",
      text: "text-yellow-800",
      iconColor: "text-yellow-500",
   },
};

export default function Toast() {
   const { t } = useTranslation();
   const [searchParams] = useSearchParams();
   const navigate = useNavigate();

   const rawMessage = searchParams.get("toastMessage");
   // Translate the message if it's a translation key, otherwise use as-is
   const message = rawMessage ? t(rawMessage) : null;
   const type = (searchParams.get("toastType") as ToastType) || "success";
   const duration = Number(searchParams.get("toastDuration")) || 3000;

   useEffect(() => {
      if (rawMessage) {
         const timer = setTimeout(() => {
            searchParams.delete("toastMessage");
            searchParams.delete("toastType");
            searchParams.delete("toastDuration");
            navigate({ search: searchParams.toString() }, { replace: true });
         }, duration);

         return () => clearTimeout(timer);
      }
   }, [rawMessage, duration, navigate, searchParams]);

   if (!message) return null;

   const handleClose = () => {
      searchParams.delete("toastMessage");
      searchParams.delete("toastType");
      searchParams.delete("toastDuration");
      navigate({ search: searchParams.toString() }, { replace: true });
   };

   const renderIcon = () => {
      switch (type) {
         case "success":
            return <CheckCircle className={`w-5 h-5 flex-shrink-0 ${toastStyles[type].iconColor}`} />;
         case "error":
            return <AlertCircle className={`w-5 h-5 flex-shrink-0 ${toastStyles[type].iconColor}`} />;
         case "warning":
            return <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${toastStyles[type].iconColor}`} />;
      }
   };

   const style = toastStyles[type];

   return (
      <div
         className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50
            flex items-start gap-3 px-4 py-4 border-l-4 rounded-lg shadow-lg
            backdrop-blur-sm animate-slide-up transition-all duration-300
            ${style.bg} ${style.border} ${style.text}`}
      >
         {/* Icon */}
         <div className="mt-0.5">
            {renderIcon()}
         </div>

         {/* Message */}
         <div className="flex-1 min-w-0">
            <p className="text-sm md:text-base font-medium leading-relaxed break-words">
               {message}
            </p>
         </div>

         {/* Close Button */}
         <button
            onClick={handleClose}
            className={`flex-shrink-0 p-1 rounded-md transition-colors duration-200
               hover:bg-black/5 active:bg-black/10 ${style.text}`}
            aria-label="Close notification"
         >
            <X size={18} />
         </button>
      </div>
   );
}
