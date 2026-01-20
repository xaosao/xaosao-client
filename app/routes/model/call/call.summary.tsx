"use client"

import { useTranslation } from 'react-i18next';
import { Phone, Video, Clock, Wallet, CheckCircle, User, TrendingUp } from "lucide-react"
import { useLoaderData, Link, type LoaderFunctionArgs } from "react-router"

// components:
import { Button } from "~/components/ui/button"

// utils:
import { requireModelSession } from "~/services/model-auth.server";
import { getCallBooking } from "~/services/call-booking.server";
import { formatCurrency } from "~/utils"
import { formatDuration } from "~/hooks/usePeerCall"

export async function loader({ params, request }: LoaderFunctionArgs) {
   const modelId = await requireModelSession(request);
   const booking = await getCallBooking(params.bookingId!);

   if (!booking) {
      throw new Response("Booking not found", { status: 404 });
   }

   if (booking.modelId !== modelId) {
      throw new Response("Unauthorized", { status: 403 });
   }

   return { booking };
}

export default function ModelCallSummary() {
   const { t } = useTranslation();
   const { booking } = useLoaderData<typeof loader>();

   // Calculate call duration in seconds
   const startTime = booking.callStartedAt ? new Date(booking.callStartedAt).getTime() : 0;
   const endTime = booking.callEndedAt ? new Date(booking.callEndedAt).getTime() : Date.now();
   const durationSeconds = startTime ? Math.floor((endTime - startTime) / 1000) : 0;

   // Calculate earnings
   const commissionRate = booking.modelService?.service?.commission || 0;
   const grossAmount = booking.price;
   const commissionAmount = Math.floor((grossAmount * commissionRate) / 100);
   const netEarnings = grossAmount - commissionAmount;

   return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
         <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6 space-y-6">
            {/* Success Icon */}
            <div className="text-center">
               <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-500" />
               </div>
               <h2 className="text-xl font-bold text-gray-900">
                  {t('callService.callCompleted', { defaultValue: 'Call Completed' })}
               </h2>
            </div>

            {/* Customer Info */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
               {booking.customer?.profile ? (
                  <img
                     src={booking.customer.profile}
                     alt={booking.customer.firstName}
                     className="w-14 h-14 rounded-full object-cover"
                  />
               ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                     <User className="w-7 h-7 text-gray-400" />
                  </div>
               )}
               <div>
                  <p className="font-semibold text-gray-900">
                     {booking.customer?.firstName} {booking.customer?.lastName}
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
                     <span>{t('callService.minutesCharged', { defaultValue: 'Minutes' })}</span>
                  </div>
                  <span className="text-gray-900">
                     {booking.minutes || 1} min
                  </span>
               </div>

               <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2 text-gray-600">
                     <span>{t('callService.grossAmount', { defaultValue: 'Gross Amount' })}</span>
                  </div>
                  <span className="text-gray-900">
                     {formatCurrency(grossAmount)}
                  </span>
               </div>

               <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2 text-gray-600">
                     <span>{t('callService.platformFee', { defaultValue: 'Platform Fee' })} ({commissionRate}%)</span>
                  </div>
                  <span className="text-red-600">
                     -{formatCurrency(commissionAmount)}
                  </span>
               </div>

               <div className="flex items-center justify-between py-3 bg-green-50 rounded-lg px-3">
                  <div className="flex items-center gap-2 text-green-700 font-semibold">
                     <TrendingUp className="w-5 h-5" />
                     <span>{t('callService.yourEarnings', { defaultValue: 'Your Earnings' })}</span>
                  </div>
                  <span className="font-bold text-lg text-green-600">
                     +{formatCurrency(netEarnings)}
                  </span>
               </div>
            </div>

            {/* Info */}
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
               {t('callService.earningsAdded', { defaultValue: 'Earnings have been added to your wallet.' })}
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4">
               <Link to="/model/settings/wallet">
                  <Button className="w-full bg-rose-500 hover:bg-rose-600 text-white">
                     {t('callService.viewWallet', { defaultValue: 'View Wallet' })}
                  </Button>
               </Link>
               <Link to="/model/dating">
                  <Button variant="outline" className="w-full">
                     {t('callService.viewBookings', { defaultValue: 'View Bookings' })}
                  </Button>
               </Link>
            </div>
         </div>
      </div>
   )
}
