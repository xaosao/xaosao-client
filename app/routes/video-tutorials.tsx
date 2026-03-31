import { Play, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

// components
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";

interface VideoItem {
   id: string;
   title: string;
   description: string;
   url: string; // iframe embed URL (fallback)
   directUrl: string; // direct video URL (local or CDN)
   thumbnail?: string;
   duration: string;
   isLocal?: boolean; // true = use native <video> player
}

const modelVideos: VideoItem[] = [
   {
      id: "model-1",
      title: "ການຕິດຕັ້ງແອັບ ແລະ ສະໝັກບັນຊີ",
      description: "ແນະນຳວິທີລົງທະບຽນເປັນນາງແບບໃນ XaoSao ແບບລະອຽດ ຕັ້ງແຕ່ການກອກຂໍ້ມູນ, ອັບໂຫຼດຮູບພາບ, ຢືນຢັນເບີໂທລະສັບ ຈົນສຳເລັດ",
      url: "https://iframe.mediadelivery.net/play/575603/2fd8c2bf-ac85-48b5-9db9-552ffcbe23ee",
      directUrl: "https://xs-images.b-cdn.net/videos/model-register.mov",
      thumbnail: "https://xs-images.b-cdn.net/videos/model-register-thumbnail.webp",
      duration: "2:42",
      isLocal: true,
   },
   {
      id: "model-2",
      title: "ວິທີກູ້ຄືນລະຫັດຜ່ານ",
      description: "ວິທີຣີເຊັດລະຫັດຜ່ານເມື່ອລືມ ຜ່ານລະບົບ OTP ທາງເບີໂທລະສັບ ເພື່ອຕັ້ງລະຫັດໃໝ່ ແລະ ເຂົ້າສູ່ລະບົບໄດ້ອີກຄັ້ງ",
      url: "https://iframe.mediadelivery.net/play/575603/378e7288-9562-40c3-817f-549bf5eaa719",
      directUrl: "https://xs-images.b-cdn.net/videos/model-forgot-password.mp4",
      thumbnail: "https://xs-images.b-cdn.net/videos/model-forgot-password-thumbnail.webp",
      duration: "1:18",
      isLocal: true,
   },
   {
      id: "model-3",
      title: "ການຮັບການຈອງ ແລະ ໂພສເພື່ອຫາຄູ່",
      description: "ແນະນຳວິທີຮັບການຈອງຈາກລູກຄ້າ, ການຢືນຢັນ ຫຼື ປະຕິເສດການຈອງ ແລະ ວິທີສ້າງໂພສເພື່ອໂຄສະນາບໍລິການ ແລະ ຫາລູກຄ້າໃໝ່",
      url: "https://iframe.mediadelivery.net/play/575603/bc260cc5-981f-44d1-abb8-106c866d12ea",
      directUrl: "https://xs-images.b-cdn.net/videos/model-accept-booking-post.mov",
      thumbnail: "https://xs-images.b-cdn.net/videos/model-booking-post-thumbnail.webp",
      duration: "1:27",
      isLocal: true,
   },
];

const customerVideos: VideoItem[] = [
   {
      id: "customer-1",
      title: "ການຕິດຕັ້ງແອັບ ແລະ ສະໝັກບັນຊີໃໝ່",
      description: "ແນະນຳວິທີລົງທະບຽນເປັນລູກຄ້າໃນ XaoSao ຕັ້ງແຕ່ການຕິດຕັ້ງແອັບ, ສ້າງບັນຊີ, ກອກຂໍ້ມູນສ່ວນຕົວ ແລະ ຢືນຢັນເບີໂທລະສັບ",
      url: "https://iframe.mediadelivery.net/play/575603/6dbd5d24-0f5e-426e-972a-d642b793059f",
      directUrl: "https://xs-images.b-cdn.net/videos/customer-register.mov",
      thumbnail: "https://xs-images.b-cdn.net/videos/customer-register-thumbnail.webp",
      duration: "6:06",
      isLocal: true,
   },
   {
      id: "customer-2",
      title: "ວິທີກູ້ຄືນລະຫັດຜ່ານ",
      description: "ວິທີກູ້ຄືນລະຫັດຜ່ານເມື່ອລືມ ຜ່ານລະບົບຢືນຢັນ OTP ທາງເບີໂທລະສັບ ແລະ ຕັ້ງລະຫັດໃໝ່ໄດ້ງ່າຍໆ",
      url: "https://iframe.mediadelivery.net/play/575603/1f607b15-6876-49f3-8895-c44a7e7052cd",
      directUrl: "https://xs-images.b-cdn.net/videos/customer-forgot-password.mp4",
      thumbnail: "https://xs-images.b-cdn.net/videos/customer-forgot-password-thumbnail.webp",
      duration: "2:39",
      isLocal: true,
   },
   {
      id: "customer-3",
      title: "ວິທີເຕີມເງິນ ແລະ ຈອງນາງແບບ",
      description: "ແນະນຳວິທີເຕີມເງິນເຂົ້າ Wallet, ເລືອກບໍລິການ, ຊຳລະເງິນ ແລະ ຈອງນາງແບບ ຈົນຮອດການຢືນຢັນການຈອງສຳເລັດ",
      url: "https://iframe.mediadelivery.net/play/575603/da8e13bb-ad53-451a-83fb-bb6543bb2f32",
      directUrl: "https://xs-images.b-cdn.net/videos/customer-booking-deposit.mov",
      thumbnail: "https://xs-images.b-cdn.net/videos/customer-booking-deposit-thumbnail.webp",
      duration: "7:46",
      isLocal: true,
   }
];

interface VideoCardProps {
   video: VideoItem;
   onClick: () => void;
}

function VideoCard({ video, onClick }: VideoCardProps) {
   return (
      <div
         className="group cursor-pointer border border-gray-500 rounded-md hover:border-rose-500"
         onClick={onClick}
      >
         <div className="relative aspect-video bg-gradient-to-br from-rose-500/20 via-gray-800 to-gray-900 rounded-t-md overflow-hidden mb-3 shadow-lg">
            {video.thumbnail && (
               <img src={video.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
               <div className="w-12 h-12 rounded-full bg-rose-500/90 flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform duration-300">
                  <Play className="w-4 h-4 text-white ml-1" fill="white" />
               </div>
            </div>

            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded font-medium">
               {video.duration}
            </div>
         </div>

         <div className="space-y-1 px-3 pb-6">
            <h3 className="font-semibold text-gray-500 text-md sm:text-md line-clamp-2 group-hover:text-rose-500 transition-colors">
               {video.title}
            </h3>
            <p className="text-gray-500 text-sm sm:text-base mt-2">
               {video.description}
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
   const videoRef = useRef<HTMLVideoElement>(null);

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

   // Auto-fullscreen on mobile for native video
   useEffect(() => {
      if (video?.isLocal && videoRef.current) {
         const el = videoRef.current;
         el.play().catch(() => { });
         // Request fullscreen on mobile
         const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
         if (isMobile) {
            try {
               if (el.requestFullscreen) {
                  el.requestFullscreen();
               } else if ((el as any).webkitEnterFullscreen) {
                  (el as any).webkitEnterFullscreen();
               }
            } catch { }
         }
      }
   }, [video]);

   if (!video) return null;

   // Native video player for local files
   if (video.isLocal) {
      return (
         <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
            <button
               onClick={onClose}
               className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
               <X className="w-6 h-6" />
            </button>

            <video
               ref={videoRef}
               src={video.directUrl}
               className="w-full h-full object-contain"
               controls
               autoPlay
               playsInline
               preload="auto"
               onEnded={onClose}
            />
         </div>
      );
   }

   // Iframe fallback for BunnyCDN Stream
   return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
         <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
         >
            <X className="w-6 h-6" />
         </button>

         <div className="w-full h-full sm:w-auto sm:h-full sm:aspect-video">
            <iframe
               src={`${video.url}?autoplay=true&preload=true&responsive=true`}
               className="w-full h-full border-0"
               allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
               allowFullScreen
            />
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
