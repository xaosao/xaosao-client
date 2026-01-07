import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Play, X } from "lucide-react";

// components
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";

interface VideoItem {
   id: string;
   titleKey: string;
   descriptionKey: string;
   url: string;
   thumbnail?: string;
   duration: string;
}

const modelVideos: VideoItem[] = [
   {
      id: "model-1",
      titleKey: "videoTutorials.companionVideos.register.title",
      descriptionKey: "videoTutorials.companionVideos.register.description",
      url: "https://xs-images.b-cdn.net/xaosao-model-video/register.mp4",
      duration: "9:01"
   },
   {
      id: "model-2",
      titleKey: "videoTutorials.companionVideos.referral.title",
      descriptionKey: "videoTutorials.companionVideos.referral.description",
      url: "https://xs-images.b-cdn.net/xaosao-model-video/refferal.mp4",
      duration: "1:29"
   },
   {
      id: "model-3",
      titleKey: "videoTutorials.companionVideos.serviceBank.title",
      descriptionKey: "videoTutorials.companionVideos.serviceBank.description",
      url: "https://xs-images.b-cdn.net/xaosao-model-video/service_bank_images.mp4",
      duration: "4:37"
   },
   {
      id: "model-4",
      titleKey: "videoTutorials.companionVideos.booking.title",
      descriptionKey: "videoTutorials.companionVideos.booking.description",
      url: "https://xs-images.b-cdn.net/xaosao-model-video/booking.mp4",
      duration: "8:34"
   }
];

const customerVideos: VideoItem[] = [
   {
      id: "customer-1",
      titleKey: "videoTutorials.customerVideos.register.title",
      descriptionKey: "videoTutorials.customerVideos.register.description",
      url: "https://xs-images.b-cdn.net/customer-video/Register.mp4",
      duration: "6:02"
   },
   {
      id: "customer-2",
      titleKey: "videoTutorials.customerVideos.forgotPassword.title",
      descriptionKey: "videoTutorials.customerVideos.forgotPassword.description",
      url: "https://xs-images.b-cdn.net/customer-video/Customer-forgot-password-02.mp4",
      duration: "2:39"
   },
   {
      id: "customer-3",
      titleKey: "videoTutorials.customerVideos.booking.title",
      descriptionKey: "videoTutorials.customerVideos.booking.description",
      url: "https://xs-images.b-cdn.net/customer-video/booking.mp4",
      duration: "7:46"
   },
   {
      id: "customer-4",
      titleKey: "videoTutorials.customerVideos.overview.title",
      descriptionKey: "videoTutorials.customerVideos.overview.description",
      url: "https://xs-images.b-cdn.net/customer-video/overview.mp4",
      duration: "4:22"
   }
];

interface VideoCardProps {
   video: VideoItem;
   onClick: () => void;
   t: (key: string) => string;
}

function VideoCard({ video, onClick, t }: VideoCardProps) {
   const videoRef = useRef<HTMLVideoElement>(null);
   const [isHovered, setIsHovered] = useState(false);
   const [hasError, setHasError] = useState(false);
   const [isLoaded, setIsLoaded] = useState(false);

   const handleMouseEnter = () => {
      setIsHovered(true);
      if (videoRef.current && !hasError && isLoaded) {
         videoRef.current.currentTime = 0;
         videoRef.current.play().catch(() => setHasError(true));
      }
   };

   const handleMouseLeave = () => {
      setIsHovered(false);
      if (videoRef.current) {
         videoRef.current.pause();
         videoRef.current.currentTime = 0;
      }
   };

   return (
      <div
         className="group cursor-pointer border rounded-xl hover:border-rose-500"
         onClick={onClick}
         onMouseEnter={handleMouseEnter}
         onMouseLeave={handleMouseLeave}
      >
         <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden mb-3 shadow-lg">
            <video
               ref={videoRef}
               src={video.url}
               className="w-full h-full object-cover"
               muted
               playsInline
               preload="none"
               onLoadedData={() => setIsLoaded(true)}
               onError={() => setHasError(true)}
            />

            <div className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 ${isHovered && isLoaded ? 'opacity-0' : 'opacity-100'}`}>
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
   t: (key: string) => string;
}

function VideoModal({ video, onClose, t }: VideoModalProps) {
   const videoRef = useRef<HTMLVideoElement>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [hasError, setHasError] = useState(false);

   useEffect(() => {
      if (video && videoRef.current) {
         setIsLoading(true);
         setHasError(false);

         const playVideo = async () => {
            try {
               await videoRef.current?.play();
            } catch {
               // Autoplay failed, user needs to tap play button
               console.log("Autoplay blocked, user needs to interact");
            }
         };

         playVideo();
      }
   }, [video]);

   if (!video) return null;

   return (
      <div
         className="fixed inset-0 bg-black z-50 flex flex-col"
         onClick={onClose}
      >
         <div className="flex justify-between items-center p-4 bg-black/80">
            <button
               onClick={onClose}
               className="text-white/70 hover:text-white text-sm flex items-center gap-2 transition-colors"
            >
               <ArrowLeft className="w-5 h-5" />
               <span className="hidden sm:inline">{t("videoTutorials.backToTutorials")}</span>
            </button>
            <button
               onClick={onClose}
               className="text-white/70 hover:text-white transition-colors p-2"
            >
               <X className="w-6 h-6" />
            </button>
         </div>

         <div
            className="flex-1 flex items-center justify-center p-2 sm:p-4"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="w-full max-w-5xl">
               <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                  {isLoading && (
                     <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
                     </div>
                  )}

                  {hasError && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
                        <p className="text-lg mb-4">Video failed to load</p>
                        <a
                           href={video.url}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="bg-rose-500 px-4 py-2 rounded-lg hover:bg-rose-600 transition-colors"
                        >
                           Open video directly
                        </a>
                     </div>
                  )}

                  <video
                     ref={videoRef}
                     src={video.url}
                     className="w-full h-full"
                     controls
                     playsInline
                     webkit-playsinline="true"
                     onLoadedData={() => setIsLoading(false)}
                     onError={() => {
                        setIsLoading(false);
                        setHasError(true);
                     }}
                     onCanPlay={() => setIsLoading(false)}
                  />
               </div>

               <div className="mt-4 space-y-2 px-2">
                  <h2 className="text-lg sm:text-2xl font-bold text-white">{t(video.titleKey)}</h2>
                  <p className="text-gray-400 text-sm sm:text-base line-clamp-3 sm:line-clamp-none">{t(video.descriptionKey)}</p>
               </div>
            </div>
         </div>
      </div>
   );
}

export default function VideoTutorialsPage() {
   const navigate = useNavigate();
   const { t } = useTranslation();
   const [activeTab, setActiveTab] = useState<"customer" | "model">("customer");
   const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

   const videos = activeTab === "customer" ? customerVideos : modelVideos;

   // Prevent body scroll when modal is open
   useEffect(() => {
      if (selectedVideo) {
         document.body.style.overflow = 'hidden';
      } else {
         document.body.style.overflow = '';
      }
      return () => {
         document.body.style.overflow = '';
      };
   }, [selectedVideo]);

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
         <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} t={t} />
      </div>
   );
}
