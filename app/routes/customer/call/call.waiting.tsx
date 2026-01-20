"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslation } from 'react-i18next';
import { Phone, PhoneOff, Video, User, Loader } from "lucide-react"
import { useLoaderData, useNavigate, useParams, type LoaderFunctionArgs } from "react-router"

// components:
import { Button } from "~/components/ui/button"

// utils:
import { requireUserSession } from "~/services/auths.server";
import { getCallBooking } from "~/services/call-booking.server";

const RING_TIMEOUT = 60000; // 60 seconds

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

export default function CallWaiting() {
   const navigate = useNavigate()
   const params = useParams()
   const { t } = useTranslation();
   const { booking } = useLoaderData<typeof loader>();

   const [status, setStatus] = useState<'initiating' | 'ringing' | 'connecting' | 'timeout' | 'declined'>('initiating');
   const [ringTimer, setRingTimer] = useState(60);

   // Initiate the call
   const initiateCall = useCallback(async () => {
      try {
         const response = await fetch('/api/call/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: params.bookingId }),
         });

         const result = await response.json();

         if (result.success) {
            setStatus('ringing');
         } else {
            console.error('Failed to initiate call:', result.error);
         }
      } catch (error) {
         console.error('Error initiating call:', error);
      }
   }, [params.bookingId]);

   // Poll for call status
   useEffect(() => {
      if (status !== 'ringing') return;

      const pollInterval = setInterval(async () => {
         try {
            const response = await fetch(`/api/call/booking?id=${params.bookingId}`);
            const result = await response.json();

            if (result.success && result.booking) {
               const callStatus = result.booking.callStatus;

               if (callStatus === 'connecting' || callStatus === 'in_call') {
                  // Model accepted, redirect to active call
                  navigate(`/customer/call/${params.bookingId}/active`);
               } else if (callStatus === 'cancelled') {
                  setStatus('declined');
               } else if (callStatus === 'missed') {
                  setStatus('timeout');
               }
            }
         } catch (error) {
            console.error('Error polling call status:', error);
         }
      }, 2000);

      return () => clearInterval(pollInterval);
   }, [status, params.bookingId, navigate]);

   // Ring timer countdown
   useEffect(() => {
      if (status !== 'ringing') return;

      const countdown = setInterval(() => {
         setRingTimer(prev => {
            if (prev <= 1) {
               // Timeout - call missed
               handleMissedCall();
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      return () => clearInterval(countdown);
   }, [status]);

   // Initiate call on mount
   useEffect(() => {
      initiateCall();
   }, [initiateCall]);

   // Handle missed call
   const handleMissedCall = async () => {
      try {
         await fetch('/api/call/missed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: params.bookingId }),
         });
         setStatus('timeout');
      } catch (error) {
         console.error('Error handling missed call:', error);
      }
   };

   // Cancel call
   const handleCancelCall = async () => {
      try {
         await fetch('/api/call/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: params.bookingId, endedBy: 'customer' }),
         });
         navigate('/customer/dates-history');
      } catch (error) {
         console.error('Error canceling call:', error);
         navigate('/customer/dates-history');
      }
   };

   // Go back
   const handleGoBack = () => {
      navigate('/customer/dates-history');
   };

   return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4">
         {/* Model Info */}
         <div className="text-center mb-8">
            {booking.model?.profile ? (
               <img
                  src={booking.model.profile}
                  alt={booking.model.firstName}
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-white/20"
               />
            ) : (
               <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-gray-700 flex items-center justify-center border-4 border-white/20">
                  <User className="w-12 h-12 text-gray-400" />
               </div>
            )}
            <h2 className="text-xl font-semibold text-white">
               {booking.model?.firstName} {booking.model?.lastName}
            </h2>
            <div className="flex items-center justify-center gap-2 text-gray-400 mt-2">
               {booking.callType === 'video' ? (
                  <Video className="w-4 h-4" />
               ) : (
                  <Phone className="w-4 h-4" />
               )}
               <span className="text-sm">
                  {booking.callType === 'video'
                     ? t('callService.videoCall', { defaultValue: 'Video Call' })
                     : t('callService.audioCall', { defaultValue: 'Audio Call' })}
               </span>
            </div>
         </div>

         {/* Status */}
         <div className="text-center mb-8">
            {status === 'initiating' && (
               <>
                  <Loader className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
                  <p className="text-white text-lg">
                     {t('callService.initiating', { defaultValue: 'Initiating call...' })}
                  </p>
               </>
            )}

            {status === 'ringing' && (
               <>
                  <div className="relative mx-auto mb-4">
                     <div className="w-16 h-16 rounded-full bg-green-500 animate-pulse flex items-center justify-center">
                        <Phone className="w-8 h-8 text-white" />
                     </div>
                     <div className="absolute inset-0 w-16 h-16 rounded-full bg-green-500/30 animate-ping" />
                  </div>
                  <p className="text-white text-lg">
                     {t('callService.calling', { defaultValue: 'Calling...' })}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                     {t('callService.waitingForAnswer', { defaultValue: 'Waiting for answer' })} ({ringTimer}s)
                  </p>
               </>
            )}

            {status === 'timeout' && (
               <>
                  <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center mx-auto mb-4">
                     <PhoneOff className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-white text-lg">
                     {t('callService.noAnswer', { defaultValue: 'No answer' })}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                     {t('callService.callMissed', { defaultValue: 'The model did not answer. Your balance has been refunded.' })}
                  </p>
               </>
            )}

            {status === 'declined' && (
               <>
                  <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4">
                     <PhoneOff className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-white text-lg">
                     {t('callService.callDeclined', { defaultValue: 'Call declined' })}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                     {t('callService.modelBusy', { defaultValue: 'The model is currently unavailable. Your balance has been refunded.' })}
                  </p>
               </>
            )}
         </div>

         {/* Actions */}
         <div className="flex gap-4">
            {(status === 'initiating' || status === 'ringing') && (
               <Button
                  onClick={handleCancelCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
               >
                  <PhoneOff className="w-8 h-8 text-white" />
               </Button>
            )}

            {(status === 'timeout' || status === 'declined') && (
               <Button
                  onClick={handleGoBack}
                  variant="outline"
                  className="px-6 py-3 text-white border-white/30 hover:bg-white/10"
               >
                  {t('common.goBack', { defaultValue: 'Go Back' })}
               </Button>
            )}
         </div>
      </div>
   )
}
