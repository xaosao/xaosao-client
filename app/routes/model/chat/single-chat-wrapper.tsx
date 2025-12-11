import { useEffect, useRef, useState } from "react";
import { useLoaderData, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

export async function loader() {
   return {
      CHAT_URL: import.meta.env.VITE_CHAT_URL,
   };
}

const SingleChatWrapper = () => {
   const location = useLocation();
   const { CHAT_URL } = useLoaderData() as { CHAT_URL: string };
   const queryParams = new URLSearchParams(location.search);
   const id = queryParams.get("id");
   const [isLoading, setIsLoading] = useState(true);
   const iframeRef = useRef<HTMLIFrameElement>(null);
   const { i18n } = useTranslation();

   // Listen for language changes and notify the iframe
   useEffect(() => {
      const handleLanguageChange = (lng: string) => {
         if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
               { type: "LANGUAGE_CHANGE", language: lng },
               "*"
            );
         }
      };

      i18n.on("languageChanged", handleLanguageChange);

      return () => {
         i18n.off("languageChanged", handleLanguageChange);
      };
   }, [i18n]);

   // Send initial language when iframe loads
   const handleIframeLoad = () => {
      setIsLoading(false);
      if (iframeRef.current?.contentWindow) {
         const currentLang = localStorage.getItem("i18nextLng") || "en";
         iframeRef.current.contentWindow.postMessage(
            { type: "LANGUAGE_CHANGE", language: currentLang },
            "*"
         );
      }
   };

   return (
      <div style={{ width: "100%", height: "100vh", position: "relative" }}>
         {isLoading && (
            <div
               style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f5f5f5",
               }}
            >
               <div
                  style={{
                     width: "40px",
                     height: "40px",
                     border: "4px solid #e0e0e0",
                     borderTopColor: "#3b82f6",
                     borderRadius: "50%",
                     animation: "spin 1s linear infinite",
                  }}
               />
               <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
         )}
         <iframe
            ref={iframeRef}
            src={`${CHAT_URL}chat?id=${id}&userType=model`}
            style={{
               width: "100%",
               height: "100%",
               border: "none",
               opacity: isLoading ? 0 : 1,
            }}
            title="Realtime Chat"
            onLoad={handleIframeLoad}
         />
      </div>
   );
};

export default SingleChatWrapper;
