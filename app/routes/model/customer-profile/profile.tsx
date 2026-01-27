import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, Form, redirect, useNavigation } from 'react-router';
import { User, Calendar, MarsStroke, ToggleLeft, MapPin, Book, BriefcaseBusiness, ChevronLeft, ChevronRight, Heart, MessageSquareText, Forward, UserPlus, UserCheck, Loader, X } from 'lucide-react';

// components
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';

// services and utils
import { capitalize } from '~/utils/functions/textFormat';
import { calculateAgeFromDOB, formatNumber } from '~/utils';
import { getCustomerProfile } from '~/services/profile.server';
import { requireModelSession, getModelTokenFromSession } from '~/services/model-auth.server';

export const meta: MetaFunction = () => {
   return [
      { title: "Customer Profile - Model Dashboard" },
      { name: "description", content: "View customer profile" },
   ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
   const modelId = await requireModelSession(request);

   const customerId = params.id;
   if (!customerId) {
      throw new Response("Customer ID is required", { status: 400 });
   }

   const customer = await getCustomerProfile(customerId, modelId);
   return { customer, modelId };
}

export async function action({ request, params }: ActionFunctionArgs) {
   const modelId = await requireModelSession(request);
   const token = await getModelTokenFromSession(request);
   const formData = await request.formData();
   const customerId = params.id as string;

   const like = formData.get("like") === "true";
   const pass = formData.get("pass") === "true";
   const addFriend = formData.get("isFriend") === "true";

   // Check if token exists
   if (!token) {
      return redirect(`/model/customer-profile/${customerId}?toastMessage=${encodeURIComponent("modelCustomerProfile.errors.authError")}&toastType=error`);
   }

   if (request.method === "POST") {
      // Handle add friend
      if (addFriend) {
         try {
            const { modelAddFriend } = await import("~/services/interaction.server");
            const res = await modelAddFriend(modelId, customerId, token);
            if (res?.success) {
               return redirect(`/model/customer-profile/${customerId}?toastMessage=${encodeURIComponent("modelCustomerProfile.success.addFriend")}&toastType=success`);
            } else {
               return redirect(`/model/customer-profile/${customerId}?toastMessage=${encodeURIComponent(res?.message || "modelCustomerProfile.errors.addFriendFailed")}&toastType=error`);
            }
         } catch (error: any) {
            return redirect(`/model/customer-profile/${customerId}?toastMessage=${encodeURIComponent(error.message || "modelCustomerProfile.errors.addFriendFailed")}&toastType=error`);
         }
      }

      // Handle like/pass
      if (like || pass) {
         const actionType = like ? "LIKE" : "PASS";
         try {
            const { createModelInteraction } = await import("~/services/model.server");
            const res = await createModelInteraction(modelId, customerId, actionType);
            if (res?.success) {
               return redirect(`/model/customer-profile/${customerId}?toastMessage=${encodeURIComponent(actionType === "LIKE" ? "modelCustomerProfile.success.liked" : "modelCustomerProfile.success.passed")}&toastType=success`);
            }
         } catch (error: any) {
            return redirect(`/model/customer-profile/${customerId}?toastMessage=${encodeURIComponent(error.message || "modelCustomerProfile.errors.actionFailed")}&toastType=error`);
         }
      }
   }

   return redirect(`/model/customer-profile/${customerId}?toastMessage=${encodeURIComponent("modelCustomerProfile.errors.invalidRequest")}&toastType=warning`);
}

interface CustomerData {
   id: string;
   firstName: string;
   lastName?: string;
   dob?: string;
   gender?: string;
   latitude?: number;
   longitude?: number;
   country?: string;
   whatsapp?: number;
   profile?: string;
   status?: string;
   interests?: Record<string, string> | string[];
   relationshipStatus?: string;
   bio?: string;
   career?: string;
   education?: string;
   createdAt: string;
   Images?: Array<{ id: string; name: string }>;
   interactions?: {
      likeCount: number;
      friendCount: number;
   };
   isContact?: boolean;
   modelAction?: "LIKE" | "PASS" | null;
}

export default function CustomerProfilePage() {
   const { t } = useTranslation();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const { customer } = useLoaderData<{ customer: CustomerData }>();

   const images = customer.Images || [];
   const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST";

   // States for image preview
   const [touchEndX, setTouchEndX] = React.useState<number | null>(null);
   const [touchStartX, setTouchStartX] = React.useState<number | null>(null);
   const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
   const [showProfileFullscreen, setShowProfileFullscreen] = React.useState(false);

   const handlePrev = () => {
      if (selectedIndex === null) return;
      setSelectedIndex((prev) => (prev! - 1 + images.length) % images.length);
   };

   const handleNext = () => {
      if (selectedIndex === null) return;
      setSelectedIndex((prev) => (prev! + 1) % images.length);
   };

   const handleTouchStart = (e: React.TouchEvent) => {
      setTouchStartX(e.targetTouches[0].clientX);
   };

   const handleTouchMove = (e: React.TouchEvent) => {
      setTouchEndX(e.targetTouches[0].clientX);
   };

   const handleTouchEnd = () => {
      if (!touchStartX || !touchEndX) return;
      const distance = touchStartX - touchEndX;

      if (distance > 50) {
         handleNext();
      } else if (distance < -50) {
         handlePrev();
      }

      setTouchStartX(null);
      setTouchEndX(null);
   };

   if (isSubmitting) {
      return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2">
               <Loader className="w-4 h-4 text-rose-500 animate-spin" />
               <p className="text-rose-600">{t("modelCustomerProfile.processing")}</p>
            </div>
         </div>
      );
   }

   return (
      <div className="h-auto sm:h-screen flex items-center justify-center">
         <div className="w-11/12 sm:w-4/5 h-full">
            <div className="px-2 sm:px-6 py-2 sm:pt-8 space-y-2">
               <div className="flex sm:hidden items-center justify-between px-0 sm:px-4">
                  <div className="flex sm:hidden items-center justify-center gap-3">
                     <Form method="post">
                        <input type="hidden" name="like" value="true" />
                        <Button
                           size="sm"
                           type="submit"
                           className={`cursor-pointer px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md ${customer.modelAction === "LIKE"
                              ? "bg-rose-500 text-white hover:bg-rose-600"
                              : "text-rose-500 bg-white hover:bg-rose-500 hover:text-white"
                              }`}
                        >
                           <Heart className="w-3 h-3" />
                        </Button>
                     </Form>

                     <Form method="post">
                        {customer.whatsapp && (
                           <Button
                              size="sm"
                              type="button"
                              className="cursor-pointer bg-gray-600 text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                              onClick={() => window.open(`https://wa.me/${customer.whatsapp}`)}
                           >
                              <MessageSquareText className="w-3 h-3" />
                           </Button>
                        )}
                        {customer.isContact ? (
                           <div className="flex items-center justify-center bg-green-100 text-green-500 px-4 py-2 font-medium text-sm shadow-lg rounded-md">
                              <UserCheck className="w-3 h-3" />
                           </div>
                        ) : (
                           <Button
                              size="sm"
                              type="submit"
                              name="isFriend"
                              value="true"
                              className="cursor-pointer px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md bg-white hover:bg-gray-700 text-gray-700 hover:text-white"
                           >
                              <UserPlus className="w-3 h-3" />
                           </Button>
                        )}
                     </Form>
                  </div>
                  <Forward
                     className="w-6 h-6 text-gray-500 cursor-pointer"
                     onClick={() => navigate(`/model/customer-profile-share/${customer.id}`)}
                  />
               </div>

               <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center sm:justify-start gap-6">
                  <div
                     className="flex-shrink-0 cursor-pointer"
                     onClick={() => customer.profile && setShowProfileFullscreen(true)}
                  >
                     {customer.profile ? (
                        <img
                           src={customer.profile}
                           alt={`${customer.firstName}-${customer.lastName}`}
                           className="w-32 h-32 rounded-full object-cover border-2 border-rose-500 hover:opacity-90 transition-opacity"
                        />
                     ) : (
                        <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-2 border-rose-500">
                           <User className="w-16 h-16 text-gray-400" />
                        </div>
                     )}
                  </div>

                  <div className="flex sm:hidden items-center justify-center gap-2 text-center">
                     <div className="flex items-center justify-center gap-2 mb-1 px-4 py-0.5 rounded-full bg-gray-100">
                        <h2 className="text-md text-gray-800">{`${customer.firstName} ${customer.lastName || ''}`}</h2>
                     </div>
                  </div>

                  <div className="hidden sm:block flex-1">
                     <div className="flex items-center mb-2 gap-2">
                        <h1 className="text-xl font-bold mb-1">
                           {customer.firstName}&nbsp;{customer.lastName || ''}
                        </h1>
                     </div>
                     <div className="flex items-center gap-6 mb-4">
                        <div className='flex items-center gap-1'>
                           <span className="text-lg text-black font-bold">{formatNumber(customer.interactions?.likeCount || 0)}</span>
                           <span className="text-md text-gray-500 ml-1">{t("modelCustomerProfile.likes")}</span>
                        </div>
                        <div className='flex items-center gap-1'>
                           <span className="text-lg text-black font-bold">{formatNumber(customer.interactions?.friendCount || 0)}</span>
                           <span className="text-md text-gray-500 ml-1">{t("modelCustomerProfile.friends")}</span>
                        </div>
                     </div>

                     <div className="flex items-center gap-3 mb-6">
                        <Form method="post">
                           <input type="hidden" name="like" value="true" />
                           <Button
                              size="sm"
                              type="submit"
                              className={`cursor-pointer hidden sm:flex px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md ${customer.modelAction === "LIKE"
                                 ? "bg-rose-500 text-white hover:bg-rose-600"
                                 : "border border-rose-500 text-rose-500 bg-white hover:bg-rose-500 hover:text-white"
                                 }`}
                           >
                              <Heart className="w-4 h-4" />
                              {customer.modelAction === "LIKE" ? t("modelCustomerProfile.liked") : t("modelCustomerProfile.like")}
                           </Button>
                        </Form>

                        <Form method="post">
                           {customer.whatsapp && (
                              <Button
                                 size="sm"
                                 type="button"
                                 className="cursor-pointer hidden sm:flex bg-gray-600 text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                                 onClick={() => window.open(`https://wa.me/${customer.whatsapp}`)}
                              >
                                 <MessageSquareText className="w-4 h-4" />
                                 {t("modelCustomerProfile.message")}
                              </Button>
                           )}
                           {customer.isContact ? (
                              <div className="hidden sm:flex items-center justify-center bg-green-100 text-green-500 px-4 py-2 font-medium text-sm shadow-lg rounded-md gap-2">
                                 <UserCheck className="w-4 h-4" />
                                 {t("modelCustomerProfile.friend", { defaultValue: "Friend" })}
                              </div>
                           ) : (
                              <Button
                                 size="sm"
                                 type="submit"
                                 name="isFriend"
                                 value="true"
                                 className="cursor-pointer hidden sm:flex px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md bg-white border border-gray-700 hover:bg-gray-700 text-gray-700 hover:text-white"
                              >
                                 <UserPlus className="w-4 h-4" />
                                 {t("modelCustomerProfile.addFriend")}
                              </Button>
                           )}
                        </Form>

                        <Button
                           size="sm"
                           type="button"
                           className="cursor-pointer hidden sm:flex bg-gray-600 text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                           onClick={() => navigate(`/model/customer-profile-share/${customer.id}`)}
                        >
                           <Forward className="w-4 h-4" />
                           {t("modelCustomerProfile.share")}
                        </Button>
                     </div>
                  </div>
               </div>

               <div className="flex sm:hidden items-center justify-around w-full mb-4">
                  <div className="w-1/2 text-center flex items-center justify-center gap-3 border-r">
                     <div className="text-lg text-black font-bold">{formatNumber(customer.interactions?.likeCount || 0)}</div>
                     <div className="text-md text-gray-500">{t("modelCustomerProfile.likes")}</div>
                  </div>
                  <div className="w-1/2 text-center flex items-center justify-center gap-3">
                     <div className="text-lg text-black font-bold">{formatNumber(customer.interactions?.friendCount || 0)}</div>
                     <div className="text-md text-gray-500">{t("modelCustomerProfile.friends")}</div>
                  </div>
               </div>
            </div>

            <Separator />

            <div className="w-full flex flex-col sm:flex-row py-4">
               <div className="w-full sm:w-2/5 space-y-4 p-2">
                  <div className="w-full flex items-start justify-start flex-col space-y-3 text-sm">
                     <h3 className="text-gray-800 font-bold uppercase">{t("modelCustomerProfile.personalInfo")}:</h3>
                     <p className='flex items-center'><User size={14} />&nbsp;{t("modelCustomerProfile.fullName")}: {customer.firstName}&nbsp;{customer.lastName || ''}</p>
                     {customer.dob && (
                        <p className="flex items-center"><Calendar size={14} />&nbsp;{t("modelCustomerProfile.age")}: {calculateAgeFromDOB(customer.dob)} {t("modelCustomerProfile.yearsOld")}</p>
                     )}
                     {customer.gender && (
                        <div className="flex items-center"><MarsStroke size={14} />&nbsp;{t("modelCustomerProfile.gender")}:&nbsp;&nbsp;
                           <Badge variant="outline" className={`${customer.gender === "male" ? "bg-gray-700 text-gray-300" : "bg-rose-100 text-rose-500"} px-3 py-1`}>
                              {capitalize(customer.gender)}
                           </Badge>
                        </div>
                     )}
                     {customer.status && (
                        <div className="flex items-center"><ToggleLeft size={14} />&nbsp;{t("modelCustomerProfile.status")}:&nbsp;&nbsp;
                           <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1">
                              {capitalize(customer.status)}
                           </Badge>
                        </div>
                     )}
                     {customer.relationshipStatus && (
                        <div className="flex items-center"><Heart size={14} />&nbsp;{t("modelCustomerProfile.relationship")}:&nbsp;&nbsp;
                           <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 px-3 py-1">
                              {capitalize(customer.relationshipStatus)}
                           </Badge>
                        </div>
                     )}
                     {customer.country && (
                        <p className="flex items-center"><MapPin size={14} />&nbsp;{t("modelCustomerProfile.country")}: {customer.country}</p>
                     )}
                     <p className="flex items-center"><Calendar size={14} />&nbsp;{t("modelCustomerProfile.memberSince")}: {new Date(customer.createdAt).toDateString()}</p>
                     {customer.career && <p className="flex items-center"><BriefcaseBusiness size={14} />&nbsp;{t("modelCustomerProfile.career")}: {customer.career}</p>}
                     {customer.education && <p className="flex items-center"><Book size={14} />&nbsp;{t("modelCustomerProfile.education")}: {customer.education}</p>}
                     {customer.bio && <p className="flex items-center"><User size={14} />&nbsp;{t("modelCustomerProfile.bio")}: {customer.bio}</p>}
                  </div>

                  {/* Interests */}
                  {customer.interests && (Array.isArray(customer.interests) ? customer.interests.length > 0 : Object.keys(customer.interests).length > 0) && (
                     <div className='space-y-2'>
                        <h3 className="text-sm uppercase text-gray-800 font-bold">{t("modelCustomerProfile.interests")}:</h3>
                        <div className="flex flex-wrap gap-2">
                           {(Array.isArray(customer.interests) ? customer.interests : Object.values(customer.interests)).map((interest, index) => (
                              <Badge
                                 key={index}
                                 variant="outline"
                                 className="bg-purple-100 text-purple-700 border-purple-200 px-3 py-1"
                              >
                                 {interest}
                              </Badge>
                           ))}
                        </div>
                     </div>
                  )}
               </div>

               <div className='w-full sm:w-3/5 p-2'>
                  <h3 className="text-sm uppercase text-gray-800 font-bold mb-3">{t("modelCustomerProfile.photos")}:</h3>
                  {images.length > 0 ? (
                     <div className="grid grid-cols-3 gap-3">
                        {images.map((image, index) => (
                           <div
                              key={image.id}
                              className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setSelectedIndex(index)}
                           >
                              <img
                                 src={image.name}
                                 alt={`Photo ${index + 1}`}
                                 className="w-full h-full object-cover"
                              />
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="flex items-center justify-center h-40 text-gray-400">
                        {t("modelCustomerProfile.noPhotos")}
                     </div>
                  )}
               </div>
            </div>
         </div>

         {selectedIndex !== null && images.length > 0 && (
            <div
               className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
               onClick={() => setSelectedIndex(null)}
               onTouchStart={handleTouchStart}
               onTouchMove={handleTouchMove}
               onTouchEnd={handleTouchEnd}
            >
               <button
                  onClick={() => setSelectedIndex(null)}
                  className="absolute top-4 right-4 text-white p-2 rounded-full z-10"
               >
                  <span className="w-6 h-6 text-2xl">&times;</span>
               </button>

               <button
                  onClick={(e) => {
                     e.stopPropagation();
                     handlePrev();
                  }}
                  className="absolute left-2 sm:left-4 text-white p-3 bg-black/50 hover:bg-black/70 rounded-full z-10 cursor-pointer"
               >
                  <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
               </button>

               <img
                  src={images[selectedIndex].name}
                  alt="Preview"
                  className="max-w-[85%] max-h-[80vh] object-contain"
                  onClick={(e) => e.stopPropagation()}
               />

               <button
                  onClick={(e) => {
                     e.stopPropagation();
                     handleNext();
                  }}
                  className="absolute right-2 sm:right-4 text-white p-3 bg-black/50 hover:bg-black/70 rounded-full z-10 cursor-pointer"
               >
                  <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
               </button>

               <div className="absolute bottom-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                  {selectedIndex + 1} / {images.length}
               </div>
            </div>
         )}

         {/* Profile Image Fullscreen */}
         {showProfileFullscreen && customer.profile && (
            <div
               className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 cursor-pointer"
               onClick={() => setShowProfileFullscreen(false)}
            >
               <button
                  className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                  onClick={() => setShowProfileFullscreen(false)}
               >
                  <X size={32} />
               </button>
               <img
                  src={customer.profile}
                  alt={`${customer.firstName} ${customer.lastName || ''}`}
                  className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-lg"
               />
               <p className="absolute bottom-4 text-white/70 text-sm">{t("modelCustomerProfile.clickToClose")}</p>
            </div>
         )}
      </div>
   );
}
