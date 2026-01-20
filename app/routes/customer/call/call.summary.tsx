"use client"

import { useTranslation } from 'react-i18next';
import { Phone, Video, Clock, Wallet, CheckCircle, User } from "lucide-react"
import { useLoaderData, Link, type LoaderFunctionArgs } from "react-router"

// components:
import { Button } from "~/components/ui/button"

// utils:
import { requireUserSession } from "~/services/auths.server";
import { getCallBooking } from "~/services/call-booking.server";
import { formatCurrency } from "~/utils"
import { formatDuration } from "~/hooks/usePeerCall"

export async function loader({ params, request }: LoaderFunctionArgs) {
   const customerId = await requireUserSession(request);
   const booking = await getCallBooking(params.bookingId!);

   if (!booking) {
      throw new Response("Booking not found", { status: 404 });
   }

   if (booking.customerId !== customerId) {
      throw new Response("Unauthorized", { status: 403 });
   }

   return { booking };
}

export default function CallSummary() {
   const { t } = useTranslation();
   const { booking } = useLoaderData<typeof loader>();

   // Calculate call duration in seconds
   const startTime = booking.callStartedAt ? new Date(booking.callStartedAt).getTime() : 0;
   const endTime = booking.callEndedAt ? new Date(booking.callEndedAt).getTime() : Date.now();
   const durationSeconds = startTime ? Math.floor((endTime - startTime) / 1000) : 0;

   return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
         <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6 space-y-6">
            {/* Success Icon */}
            <div className="text-center">
               <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-500" />
               </div>
               <h2 className="text-xl font-bold text-gray-900">
                  {t('callService.callEnded', { defaultValue: 'Call Ended' })}
               </h2>
            </div>

            {/* Model Info */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
               {booking.model?.profile ? (
                  <img
                     src={booking.model.profile}
                     alt={booking.model.firstName}
                     className="w-14 h-14 rounded-full object-cover"
                  />
               ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                     <User className="w-7 h-7 text-gray-400" />
                  </div>
               )}
               <div>
                  <p className="font-semibold text-gray-900">
                     {booking.model?.firstName} {booking.model?.lastName}
                  </p>
                  <div className="flex items-center gap-1 text-gray-500 text-sm">
                     {booking.callType === 'video' ? (
                        <Video className="w-4 h-4" />
                     ) : (
                        <Phone className="w-4 h-4" />
                     )}
                     <span>
                        {booking.callType === 'video'
                           ? t('callService.videoCall', { defaultValue: 'Video Call' })
                           : t('callService.audioCall', { defaultValue: 'Audio Call' })}
                     </span>
                  </div>
               </div>
            </div>

            {/* Call Details */}
            <div className="space-y-3">
               <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2 text-gray-600">
                     <Clock className="w-5 h-5" />
                     <span>{t('callService.duration', { defaultValue: 'Duration' })}</span>
                  </div>
                  <span className="font-semibold text-gray-900 font-mono">
                     {formatDuration(durationSeconds)}
                  </span>
               </div>

               <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2 text-gray-600">
                     <span className="text-sm">{t('callService.ratePerMinute', { defaultValue: 'Rate' })}</span>
                  </div>
                  <span className="text-gray-700">
                     {formatCurrency(booking.minuteRate || 0)}/min
                  </span>
               </div>

               <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2 text-gray-600">
                     <span>{t('callService.minutesCharged', { defaultValue: 'Minutes Charged' })}</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                     {booking.minutes || 1} {t('callService.minutes', { defaultValue: 'minutes' })}
                  </span>
               </div>

               <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2 text-gray-900 font-semibold">
                     <Wallet className="w-5 h-5" />
                     <span>{t('callService.totalCost', { defaultValue: 'Total Cost' })}</span>
                  </div>
                  <span className="font-bold text-lg text-rose-600">
                     {formatCurrency(booking.price)}
                  </span>
               </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4">
               <Link to="/customer/dates-history">
                  <Button className="w-full bg-rose-500 hover:bg-rose-600 text-white">
                     {t('callService.viewHistory', { defaultValue: 'View Booking History' })}
                  </Button>
               </Link>
               <Link to="/customer/matches">
                  <Button variant="outline" className="w-full">
                     {t('callService.browseModels', { defaultValue: 'Browse More Models' })}
                  </Button>
               </Link>
            </div>
         </div>
      </div>
   )
}
