import "swiper/css";
import "swiper/css/pagination";
import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

interface PostImageGalleryProps {
  images: string[];
  authorName?: string;
}

export default function PostImageGallery({ images, authorName }: PostImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  return (
    <>
      {images.length === 1 ? (
        <div className="overflow-hidden cursor-pointer" onClick={() => setLightboxIndex(0)}>
          <img
            src={images[0]}
            alt={authorName ? `Post by ${authorName}` : "Post image"}
            className="w-full max-h-96 object-cover"
          />
        </div>
      ) : (
        <Swiper
          modules={[Pagination]}
          pagination={{ clickable: true }}
          spaceBetween={0}
          slidesPerView={1}
          className="custom-swiper-post"
        >
          {images.map((url, index) => (
            <SwiperSlide key={index}>
              <img
                src={url}
                alt={authorName ? `Post by ${authorName} (${index + 1})` : `Post image ${index + 1}`}
                className="w-full max-h-96 object-cover cursor-pointer"
                onClick={() => setLightboxIndex(index)}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      )}

      {lightboxIndex !== null && typeof document !== "undefined" &&
        createPortal(
          <ImageLightbox
            images={images}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />,
          document.body
        )
      }
    </>
  );
}

function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
      >
        <X className="h-6 w-6" />
      </button>

      {images.length === 1 ? (
        <img
          src={images[0]}
          alt="Full size"
          className="max-w-full max-h-full object-contain p-4"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="w-full h-full flex items-center" onClick={(e) => e.stopPropagation()}>
          <Swiper
            modules={[Pagination]}
            pagination={{ clickable: true }}
            spaceBetween={0}
            slidesPerView={1}
            initialSlide={initialIndex}
            className="custom-swiper-post w-full h-full"
          >
            {images.map((url, index) => (
              <SwiperSlide key={index} className="flex items-center justify-center">
                <img
                  src={url}
                  alt={`Image ${index + 1}`}
                  className="max-w-full max-h-full object-contain p-4"
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}
    </div>
  );
}
