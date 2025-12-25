import { useTranslation } from "react-i18next";
import { Form, useNavigate, type FetcherWithComponents } from "react-router";
import { MapPin, MessageSquareText, Heart, X, UserPlus, User } from "lucide-react";

// swiper imports
import "swiper/css";
import "swiper/css/pagination";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

// utils and interface
import { calculateAgeFromDOB, calculateDistance, formatDistance } from "~/utils";
import type { IForYouModelResponse } from "~/interfaces";

interface ModelCardProps {
    model: IForYouModelResponse;
    fetcher?: FetcherWithComponents<any>;
    customerLatitude?: number;
    customerLongitude?: number;
    hasActiveSubscription?: boolean;
}

export default function ModelCard({ model, customerLatitude, customerLongitude, hasActiveSubscription }: ModelCardProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Handler for WhatsApp button click with subscription check
    const handleWhatsAppClick = (whatsappNumber: number) => {
        if (!hasActiveSubscription) {
            navigate("/customer/packages?toastMessage=Please+subscribe+to+a+package+to+contact+models&toastType=warning");
        } else {
            window.open(`https://wa.me/${whatsappNumber}`);
        }
    };

    return (
        <div
            key={model.id}
            className="cursor-pointer relative bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
        >
            <div className="relative overflow-hidden h-64 sm:h-56 md:h-60 lg:h-64">
                <Swiper
                    modules={[Pagination]}
                    pagination={{ clickable: true }}
                    className="w-full h-full custom-swiper z-999999"
                >
                    {model.Images?.length ? (
                        model.Images.map((img, index) => (
                            <SwiperSlide key={index}>
                                <img
                                    src={img.name}
                                    alt={`${model.firstName} ${index}`}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                />
                            </SwiperSlide>
                        ))
                    ) : (
                        <SwiperSlide>
                            {model.profile ? (
                                <img
                                    src={model.profile}
                                    alt={model.firstName}
                                    className="w-full h-full object-cover"
                                    onClick={() => navigate(`/customer/user-profile/${model.id}`)}
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <User className="w-16 h-16 text-gray-400" />
                                </div>
                            )}
                        </SwiperSlide>
                    )}
                </Swiper>

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                <div className="absolute top-3 right-3 flex gap-2 z-10">
                    <Form method="post">
                        <input type="hidden" name="modelId" value={model.id} />
                        {model?.isContact ?
                            <div className="flex gap-2">
                                {model?.whatsapp && (
                                    <button
                                        type="button"
                                        className="cursor-pointer bg-rose-100 text-rose-500 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm p-1.5 rounded-full hover:bg-rose-500 hover:text-white"
                                        onClick={() => model.whatsapp && handleWhatsAppClick(model.whatsapp)}
                                    >
                                        <MessageSquareText className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            :
                            <button
                                type="submit"
                                name="isFriend"
                                value="true"
                                className="cursor-pointer bg-white/20 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm p-1.5 rounded-full hover:bg-rose-500 hover:text-white"
                            >
                                <UserPlus className="w-4 h-4" />
                            </button>
                        }
                    </Form>

                    <Form method="post">
                        <input type="hidden" name="pass" value="PASS" id="passInput" />
                        <input type="hidden" name="modelId" value={model.id} />
                        {model.customer_interactions?.some(interaction => interaction.action === "LIKE") ? "" :
                            <button
                                type="submit"
                                className={`${model.customer_interactions?.some(interaction => interaction.action === "PASS") ? "bg-gray-600 text-white" : "sm:opacity-0 group-hover:opacity-100 hover:bg-gray-500 hover:text-white"} cursor-pointer bg-white/20 transition-opacity duration-300 backdrop-blur-sm p-1.5 rounded-full`}
                            >
                                <X size={14} />
                            </button>
                        }
                    </Form>

                    <Form method="post">
                        <input type="hidden" name="like" value="LIKE" id="likeInput" />
                        <input type="hidden" name="modelId" value={model.id} />
                        {model.customer_interactions?.some(interaction => interaction.action === "PASS") ? "" :
                            <button
                                type="submit"
                                className={`cursor-pointer backdrop-blur-sm p-1.5 rounded-full hover:bg-rose-500 hover:text-white ${model.customer_interactions?.some(interaction => interaction.action === "LIKE") ? 'bg-rose-500 text-white' : "sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/20"}`}
                            >
                                <Heart size={14} />
                            </button>
                        }
                    </Form>
                </div>
            </div>

            <div className="absolute bottom-4 left-0 right-0 p-4 text-white z-10">
                <h3 className="text-md text-shadow-lg">
                    {model.firstName} {model.lastName},{" "}
                    <span className="text-sm">{calculateAgeFromDOB(model.dob)} {t('matches.yearsOld')}</span>
                </h3>
                <p className="text-sm text-white/90 leading-tight text-shadow-lg">{model.bio}</p>
                <div className="flex items-center gap-1 mt-1">
                    <MapPin size={14} className="text-rose-500 text-shadow-lg" />
                    <span className="text-sm font-medium text-shadow-lg">
                        {customerLatitude && customerLongitude && model?.latitude && model?.longitude
                            ? formatDistance(calculateDistance(
                                Number(model.latitude),
                                Number(model.longitude),
                                Number(customerLatitude),
                                Number(customerLongitude)
                            ))
                            : `-- ${t('matches.km')}`
                        }
                    </span>
                </div>
            </div>
        </div>
    );
}