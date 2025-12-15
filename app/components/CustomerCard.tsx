import { differenceInYears } from "date-fns";
import { Form, useNavigate } from "react-router";
import { MapPin, Heart, MessageSquareText, X, User, UserRoundPlus } from "lucide-react";

// swiper imports
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { CustomerCardProps } from "~/interfaces/customer";

export default function CustomerCard({
  customer,
  modelLatitude,
  modelLongitude,
  onViewProfile
}: CustomerCardProps) {

  const navigate = useNavigate();
  const calculateAge = (dob: string) => {
    return differenceInYears(new Date(), new Date(dob));
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const getDistance = () => {
    if (
      customer.latitude &&
      customer.longitude &&
      modelLatitude &&
      modelLongitude
    ) {
      return calculateDistance(
        customer.latitude,
        customer.longitude,
        modelLatitude,
        modelLongitude
      );
    }
    return null;
  };

  const handleViewProfile = () => {
    if (onViewProfile) onViewProfile(customer.id);
  };

  const allImages = [
    ...(customer.profile ? [{ id: 'profile', name: customer.profile }] : []),
    ...(customer.Images || [])
  ];

  const distance = getDistance();

  return (
    <div className="group relative bg-white rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
      <Swiper
        modules={[Pagination]}
        navigation={true}
        pagination={{ clickable: true }}
        spaceBetween={0}
        slidesPerView={1}
        className="w-full h-72 sm:h-80 custom-swiper1"
      >
        {allImages.length > 0 ? (
          allImages.map((image, index) => (
            <SwiperSlide key={image.id || index}>
              <div
                className="relative h-72 sm:h-80 overflow-hidden bg-gradient-to-br from-rose-100 to-purple-100 cursor-pointer"
                onClick={handleViewProfile}
              >
                <img
                  src={image.name}
                  alt={`${customer.firstName} ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </div>
            </SwiperSlide>
          ))
        ) : (
          <SwiperSlide>
            <div
              className="relative h-72 sm:h-80 overflow-hidden bg-gradient-to-br from-rose-100 to-purple-100 cursor-pointer"
              onClick={handleViewProfile}
            >
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-6xl font-bold text-rose-300">
                  {customer.firstName?.charAt(0) || "?"}
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>
          </SwiperSlide>
        )}

        <Form method="post">
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="like" value="false" id={`likeInput-${customer.id}`} />
          <input type="hidden" name="pass" value="false" id={`passInput-${customer.id}`} />
          <input type="hidden" name="isFriend" value="false" id={`isFriend-${customer.id}`} />

          <div className="absolute top-4 right-4 z-10 flex space-x-2">
            {customer.isContact ? (
              <button
                type="button"
                onClick={() => navigate(`/model/chat?id=${customer.firstName}`)}
                className="bg-rose-500 hover:bg-rose-600 text-white cursor-pointer backdrop-blur-sm p-1.5 rounded-full transition-all duration-300 shadow-lg"
              >
                <MessageSquareText className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                onClick={() => {
                  (document.getElementById(`isFriend-${customer.id}`) as HTMLInputElement).value = "true";
                }}
                className="bg-white/90 hover:bg-rose-500 hover:text-white cursor-pointer backdrop-blur-sm p-1.5 rounded-full transition-all duration-300 shadow-lg"
              >
                <UserRoundPlus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              onClick={() => {
                (document.getElementById(`likeInput-${customer.id}`) as HTMLInputElement).value = "true";
                (document.getElementById(`passInput-${customer.id}`) as HTMLInputElement).value = "false";
              }}
              className={`cursor-pointer backdrop-blur-sm p-1.5 rounded-full transition-all duration-300 shadow-lg ${customer.modelAction === "LIKE"
                ? "bg-rose-500 text-white hover:bg-rose-600"
                : "bg-white/90 hover:bg-rose-500 hover:text-white"
                }`}
            >
              <Heart className="w-3.5 h-3.5" />
            </button>
            <button
              type="submit"
              onClick={() => {
                (document.getElementById(`likeInput-${customer.id}`) as HTMLInputElement).value = "false";
                (document.getElementById(`passInput-${customer.id}`) as HTMLInputElement).value = "true";
              }}
              className="cursor-pointer bg-white/90 backdrop-blur-sm hover:bg-gray-700 hover:text-white p-1.5 rounded-full transition-all duration-300 shadow-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </Form>

        <div className="flex items-center justify-start gap-2 absolute bottom-3 left-0 right-0 p-4 text-white z-10">
          <div className="relative w-10 h-10">
            <div className="w-full h-full rounded-full border-2 border-rose-500 shadow-lg overflow-hidden bg-white">
              {customer.profile ? (
                <img
                  src={customer.profile}
                  alt={customer.firstName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm sm:text-md text-shadow-lg">
              {customer.firstName}
              {customer.lastName ? ` ${customer.lastName}` : ""},
              {customer.dob && (
                <span className="text-sm ml-2 font-normal">
                  {calculateAge(customer.dob)} Y
                </span>
              )}
            </h3>
            {distance !== null && (
              <div className="flex items-center text-sm text-gray-200">
                <MapPin className="w-4 h-4 mr-1" />
                <span className="mt-1">{distance} km</span>
              </div>
            )}
          </div>
        </div>
      </Swiper>
    </div>
  );
}
