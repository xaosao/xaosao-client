import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Play, X } from "lucide-react";

// components
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";

interface VideoItem {
   id: string;
   titleKey: string;
   descriptionKey: string;
   url: string; // iframe embed URL for mobile
   directUrl: string; // direct MP4 URL for desktop
   thumbnail?: string;
   duration: string;
}

const modelVideos: VideoItem[] = [
   {
      id: "model-1",
      titleKey: "videoTutorials.companionVideos.register.title",
      descriptionKey: "videoTutorials.companionVideos.register.description",
      url: "https://iframe.mediadelivery.net/play/575603/2fd8c2bf-ac85-48b5-9db9-552ffcbe23ee",
      directUrl: "https://xs-images.b-cdn.net/xaosao-model-video/register.mp4",
      duration: "9:01"
   },
   {
      id: "model-2",
      titleKey: "videoTutorials.companionVideos.referral.title",
      descriptionKey: "videoTutorials.companionVideos.referral.description",
      url: "https://iframe.mediadelivery.net/play/575603/378e7288-9562-40c3-817f-549bf5eaa719",
      directUrl: "https://xs-images.b-cdn.net/xaosao-model-video/refferal.mp4",
      duration: "1:29"
   },
   {
      id: "model-3",
      titleKey: "videoTutorials.companionVideos.serviceBank.title",
      descriptionKey: "videoTutorials.companionVideos.serviceBank.description",
      url: "https://iframe.mediadelivery.net/play/575603/bc260cc5-981f-44d1-abb8-106c866d12ea",
      directUrl: "https://xs-images.b-cdn.net/xaosao-model-video/service_bank_images.mp4",
      duration: "4:37"
   },
   {
      id: "model-4",
      titleKey: "videoTutorials.companionVideos.booking.title",
      descriptionKey: "videoTutorials.companionVideos.booking.description",
      url: "https://iframe.mediadelivery.net/play/575603/5431ad85-94eb-4c6f-9106-25e4cf53ff00",
      directUrl: "https://xs-images.b-cdn.net/xaosao-model-video/booking.mp4",
      duration: "8:34"
   }
];

const customerVideos: VideoItem[] = [
   {
      id: "customer-1",
      titleKey: "videoTutorials.customerVideos.register.title",
      descriptionKey: "videoTutorials.customerVideos.register.description",
      url: "https://iframe.mediadelivery.net/play/575603/6dbd5d24-0f5e-426e-972a-d642b793059f",
      directUrl: "https://xs-images.b-cdn.net/customer-video/Register.mp4",
      duration: "6:02"
   },
   {
      id: "customer-2",
      titleKey: "videoTutorials.customerVideos.forgotPassword.title",
      descriptionKey: "videoTutorials.customerVideos.forgotPassword.description",
      url: "https://iframe.mediadelivery.net/play/575603/1f607b15-6876-49f3-8895-c44a7e7052cd",
      directUrl: "https://xs-images.b-cdn.net/customer-video/Customer-forgot-password-02.mp4",
      duration: "2:39"
   },
   {
      id: "customer-3",
      titleKey: "videoTutorials.customerVideos.booking.title",
      descriptionKey: "videoTutorials.customerVideos.booking.description",
      url: "https://iframe.mediadelivery.net/play/575603/da8e13bb-ad53-451a-83fb-bb6543bb2f32",
      directUrl: "https://xs-images.b-cdn.net/customer-video/booking.mp4",
      duration: "7:46"
   },
   {
      id: "customer-4",
      titleKey: "videoTutorials.customerVideos.overview.title",
      descriptionKey: "videoTutorials.customerVideos.overview.description",
      url: "https://iframe.mediadelivery.net/play/575603/81e99e33-e21e-4716-a305-558fde0439c1",
      directUrl: "https://xs-images.b-cdn.net/customer-video/overview.mp4",
      duration: "4:22"
   }
];

interface VideoCardProps {
   video: VideoItem;
   onClick: () => void;
   t: (key: string) => string;
}

function VideoCard({ video, onClick, t }: VideoCardProps) {
   return (
      <div
         className="group cursor-pointer border rounded-xl hover:border-rose-500"
         onClick={onClick}
      >
         <div className="relative aspect-video bg-gradient-to-br from-rose-500/20 via-gray-800 to-gray-900 rounded-xl overflow-hidden mb-3 shadow-lg">
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
               <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-500/90 flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform duration-300">
                  <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white ml-1" fill="white" />
               </div>
            </div>

            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded font-medium">
               {video.duration}
            </div>
         </div>

         <div className="space-y-1 px-3 pb-6">
            <h3 className="font-semibold text-gray-500 text-md sm:text-md line-clamp-2 group-hover:text-rose-500 transition-colors">
               {t(video.titleKey)}
            </h3>
            <p className="text-gray-500 text-sm sm:text-base mt-2">
               {t(video.descriptionKey)}
            </p>
         </div>
      </div>
   );
}

interface VideoModalProps {
   video: VideoItem | null;
   onClose: () => void;
}

function VideoModal({ video, onClose }: VideoModalProps) {
   const [isMobile, setIsMobile] = useState(false);

   // Detect mobile on mount
   useEffect(() => {
      const checkMobile = () => {
         setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
   }, []);

   // Handle escape key to close modal
   useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
         if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
   }, [onClose]);

   // Prevent body scroll when modal is open
   useEffect(() => {
      if (video) {
         document.body.style.overflow = 'hidden';
      }
      return () => {
         document.body.style.overflow = '';
      };
   }, [video]);

   if (!video) return null;

   return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
         <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors"
         >
            <X className="w-6 h-6" />
         </button>

         {isMobile ? (
            // Use BunnyCDN Stream iframe for mobile (handles transcoding)
            <iframe
               src={`${video.url}?autoplay=true&muted=true&preload=true`}
               className="w-full h-full"
               allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
               allowFullScreen
            />
         ) : (
            // Use native video for desktop
            <video
               src={video.directUrl}
               className="max-w-full max-h-full"
               controls
               autoPlay
            />
         )}
      </div>
   );
}

export default function VideoTutorialsPage() {
   const navigate = useNavigate();
   const { t } = useTranslation();
   const [activeTab, setActiveTab] = useState<"customer" | "model">("customer");
   const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

   const videos = activeTab === "customer" ? customerVideos : modelVideos;

   return (
      <div className="min-h-screen">
         <Header />

         <div className="container mx-auto px-4 py-6 sm:py-10 pt-20 mt-0 sm:mt-10">
            <div className="text-center mb-8 sm:mb-12">
               <h1 className="text-2xl sm:text-4xl font-bold text-rose-500 mb-3">
                  {t("videoTutorials.title")}
               </h1>
               <p className="text-gray-500 text-sm sm:text-base max-w-2xl mx-auto">
                  {t("videoTutorials.subtitle")}
               </p>
            </div>

            <div className="flex justify-center mb-2 sm:mb-4">
               <div className="font-semibold inline-flex rounded-xl p-1.5 backdrop-blur-sm border border-gray-700/50">
                  <button
                     onClick={() => setActiveTab("customer")}
                     className={`cursor-pointer px-6 sm:px-8 py-1 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all duration-300 ${activeTab === "customer"
                        ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                        : "text-gray-500"
                        }`}
                  >
                     {t("videoTutorials.customerTab")}
                  </button>
                  <button
                     onClick={() => setActiveTab("model")}
                     className={`cursor-pointer px-6 sm:px-8 py-1 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all duration-300 ${activeTab === "model"
                        ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                        : "text-gray-500"
                        }`}
                  >
                     {t("videoTutorials.companionTab")}
                  </button>
               </div>
            </div>

            <div className="text-center mb-8">
               <p className="text-gray-500 text-sm sm:text-base">
                  {activeTab === "customer"
                     ? t("videoTutorials.customerDescription")
                     : t("videoTutorials.companionDescription")
                  }
               </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
               {videos.map((video) => (
                  <VideoCard
                     key={video.id}
                     video={video}
                     onClick={() => setSelectedVideo(video)}
                     t={t}
                  />
               ))}
            </div>

            {videos.length === 0 && (
               <div className="text-center py-20">
                  <p className="text-gray-500">{t("videoTutorials.noTutorials")}</p>
               </div>
            )}

            <div className="mt-12 sm:mt-16 text-center">
               <div className="rounded-md p-4 sm:p-6 space-y-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-500">
                     {t("videoTutorials.readyToStart")}
                  </h2>
                  <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base">
                     {activeTab === "customer"
                        ? t("videoTutorials.customerCta")
                        : t("videoTutorials.companionCta")
                     }
                  </p>
                  <Button
                     size="lg"
                     className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-3 font-medium shadow-xl hover:shadow-rose-500/25 transition-all duration-300"
                     onClick={() => navigate(activeTab === "customer" ? "/register" : "/model-auth/register")}
                  >
                     {activeTab === "customer" ? t("videoTutorials.registerCustomer") : t("videoTutorials.registerCompanion")}
                  </Button>
               </div>
            </div>
         </div>

         <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
      </div>
   );
}
