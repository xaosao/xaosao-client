"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useTranslation } from 'react-i18next';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, User, Clock, Wallet } from "lucide-react"
import { useLoaderData, useNavigate, useParams, type LoaderFunctionArgs } from "react-router"

// components:
import { Button } from "~/components/ui/button"

// hooks:
import { usePeerCall, formatDuration, calculateCallCost } from "~/hooks/usePeerCall"

// utils:
import { requireModelSession } from "~/services/model-auth.server";
import { getCallBooking } from "~/services/call-booking.server";
import { formatCurrency } from "~/utils"

export async function loader({ params, request }: LoaderFunctionArgs) {
   const modelId = await requireModelSession(request);
   const booking = await getCallBooking(params.bookingId!);

   if (!booking) {
      throw new Response("Booking not found", { status: 404 });
   }

   if (booking.modelId !== modelId) {
      throw new Response("Unauthorized", { status: 403 });
   }

   return { booking, modelId };
}

export default function ModelActiveCall() {
   const navigate = useNavigate()
   const params = useParams()
   const { t } = useTranslation();
   const { booking, modelId } = useLoaderData<typeof loader>();

   const localVideoRef = useRef<HTMLVideoElement>(null);
   const remoteVideoRef = useRef<HTMLVideoElement>(null);
   const [currentEarnings, setCurrentEarnings] = useState(0);
   const [showEndConfirm, setShowEndConfirm] = useState(false);
   const [waitingTimer, setWaitingTimer] = useState(90); // 90 second timeout for customer to connect

   // Get commission rate from service
   const commissionRate = booking.modelService?.service?.commission || 0;

   // Initialize peer call (model side - waiting for customer to connect)
   const {
      callState,
      localStream,
      remoteStream,
      duration,
      isAudioEnabled,
      isVideoEnabled,
      peerId,
      acceptCall,
      endCall,
      toggleAudio,
      toggleVideo,
      cleanup,
   } = usePeerCall({
      bookingId: params.bookingId!,
      callType: booking.callType as 'audio' | 'video',
      userId: modelId,
      userName: 'Model',
      isModel: true,
      onCallStateChange: (state) => {
         console.log('[Model] Call state changed:', state);
         // Only navigate to summary when call actually ended (after being connected)
         if (state === 'ended') {
            navigate(`/model/call/summary/${params.bookingId}`);
         }
         // Reset waiting timer when call progresses
         if (state === 'ringing' || state === 'connecting' || state === 'connected') {
            setWaitingTimer(90);
         }
      },
      onDurationUpdate: (seconds) => {
         const grossEarnings = calculateCallCost(seconds, booking.minuteRate || 0);
         const netEarnings = grossEarnings * (1 - commissionRate / 100);
         setCurrentEarnings(Math.floor(netEarnings));
      },
      onCallEnded: (reason) => {
         console.log('[Model] Call ended:', reason);
      },
      onError: (error) => {
         console.error('[Model] Call error:', error);
         // Don't navigate away on error - customer might still be connecting
      },
   });

   // Waiting timer - if customer doesn't call within timeout, navigate to summary
   useEffect(() => {
      if (callState === 'connected') return; // Don't count down when connected

      const countdown = setInterval(() => {
         setWaitingTimer(prev => {
            if (prev <= 1) {
               console.log('[Model] Waiting timeout - navigating to summary');
               navigate(`/model/call/summary/${params.bookingId}`);
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      return () => clearInterval(countdown);
   }, [callState, navigate, params.bookingId]);

   // Debug: Log call state changes
   useEffect(() => {
      console.log('[Model] 📊 Call state:', callState, '| Peer ID:', peerId);
      if (callState === 'ready' && peerId) {
         console.log('[Model] ✅ PeerJS ready and waiting for calls. My peer ID:', peerId);
      }
   }, [callState, peerId]);

   // Accept incoming call when ready (model side)
   useEffect(() => {
      if (callState === 'ringing') {
         console.log('[Model] Incoming call detected, accepting...');
         acceptCall().catch(err => {
            console.error('[Model] Failed to accept call:', err);
         });
      }
   }, [callState, acceptCall]);

   // Attach local stream to video element
   useEffect(() => {
      if (localStream && localVideoRef.current) {
         localVideoRef.current.srcObject = localStream;
      }
   }, [localStream]);

   // Attach remote stream to video element
   useEffect(() => {
      if (remoteStream && remoteVideoRef.current) {
         remoteVideoRef.current.srcObject = remoteStream;
      }
   }, [remoteStream]);

   // Cleanup on unmount - empty dependency array ensures this only runs on unmount
   useEffect(() => {
      return () => {
         cleanup();
      };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // Handle end call
   const handleEndCall = useCallback(async () => {
      try {
         // End the call via API
         await fetch('/api/call/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: params.bookingId, endedBy: 'model' }),
         });

         // End the peer connection
         endCall();

         // Navigate to summary
         navigate(`/model/call/summary/${params.bookingId}`);
      } catch (error) {
         console.error('Error ending call:', error);
         navigate(`/model/call/summary/${params.bookingId}`);
      }
   }, [params.bookingId, endCall, navigate]);

   return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
         {/* Video Area */}
         <div className="flex-1 relative">
            {/* Remote Video (Full Screen) */}
            {booking.callType === 'video' ? (
               <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
               />
            ) : (
               <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
                  {booking.customer?.profile ? (
                     <img
                        src={booking.customer.profile}
                        alt={booking.customer.firstName}
                        className="w-32 h-32 rounded-full object-cover border-4 border-white/20"
                     />
                  ) : (
                     <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center border-4 border-white/20">
                        <User className="w-16 h-16 text-gray-400" />
                     </div>
                  )}
               </div>
            )}

            {/* Local Video (Picture-in-Picture) */}
            {booking.callType === 'video' && (
               <div className="absolute top-4 right-4 w-32 h-44 rounded-lg overflow-hidden border-2 border-white/30 shadow-lg">
                  <video
                     ref={localVideoRef}
                     autoPlay
                     playsInline
                     muted
                     className="w-full h-full object-cover"
                  />
                  {!isVideoEnabled && (
                     <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                        <VideoOff className="w-8 h-8 text-gray-400" />
                     </div>
                  )}
               </div>
            )}

            {/* Call Info Overlay */}
            <div className="absolute top-4 left-4 space-y-2">
               {/* Customer Name */}
               <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
                  <p className="text-sm font-medium">
                     {booking.customer?.firstName} {booking.customer?.lastName}
                  </p>
               </div>

               {/* Duration & Earnings */}
               <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white space-y-1">
                  <div className="flex items-center gap-2">
                     <Clock className="w-4 h-4" />
                     <span className="text-lg font-mono">{formatDuration(duration)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-400">
                     <Wallet className="w-3 h-3" />
                     <span>+{formatCurrency(currentEarnings)}</span>
                  </div>
               </div>

               {/* Commission Info */}
               <div className="bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1 text-xs text-gray-400">
                  {t('callService.rateInfo', {
                     rate: formatCurrency(booking.minuteRate || 0),
                     commission: commissionRate,
                     defaultValue: `${formatCurrency(booking.minuteRate || 0)}/min (${commissionRate}% fee)`
                  })}
               </div>
            </div>

            {/* Connection Status */}
            {callState !== 'connected' && (
               <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="text-center">
                     <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                     <p className="text-white text-lg">
                        {callState === 'connecting'
                           ? t('callService.connecting', { defaultValue: 'Connecting...' })
                           : callState === 'ringing'
                           ? t('callService.answeringCall', { defaultValue: 'Answering call...' })
                           : t('callService.waitingForCustomer', { defaultValue: 'Waiting for customer to connect...' })}
                     </p>
                     <p className="text-gray-400 text-sm mt-2">
                        {t('callService.timeout', { seconds: waitingTimer, defaultValue: `Timeout in ${waitingTimer}s` })}
                     </p>
                  </div>
               </div>
            )}
         </div>

         {/* Controls */}
         <div className="bg-gray-900 px-4 py-6 safe-area-bottom">
            <div className="flex items-center justify-center gap-6">
               {/* Mute */}
               <Button
                  onClick={toggleAudio}
                  className={`w-14 h-14 rounded-full flex items-center justify-center ${isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'}`}
               >
                  {isAudioEnabled ? (
                     <Mic className="w-6 h-6 text-white" />
                  ) : (
                     <MicOff className="w-6 h-6 text-white" />
                  )}
               </Button>

               {/* End Call */}
               <Button
                  onClick={() => setShowEndConfirm(true)}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
               >
                  <PhoneOff className="w-8 h-8 text-white" />
               </Button>

               {/* Video Toggle (only for video calls) */}
               {booking.callType === 'video' && (
                  <Button
                     onClick={toggleVideo}
                     className={`w-14 h-14 rounded-full flex items-center justify-center ${isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'}`}
                  >
                     {isVideoEnabled ? (
                        <Video className="w-6 h-6 text-white" />
                     ) : (
                        <VideoOff className="w-6 h-6 text-white" />
                     )}
                  </Button>
               )}
            </div>
         </div>

         {/* End Call Confirmation Modal */}
         {showEndConfirm && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
               <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4">
                  <h3 className="text-lg font-semibold text-center">
                     {t('callService.endCallConfirm', { defaultValue: 'End Call?' })}
                  </h3>
                  <p className="text-gray-600 text-center text-sm">
                     {t('callService.endCallModelMessage', {
                        duration: formatDuration(duration),
                        earnings: formatCurrency(currentEarnings),
                        defaultValue: `Duration: ${formatDuration(duration)}. Your earnings: ${formatCurrency(currentEarnings)}`
                     })}
                  </p>
                  <div className="flex gap-3">
                     <Button
                        onClick={() => setShowEndConfirm(false)}
                        variant="outline"
                        className="flex-1"
                     >
                        {t('common.cancel', { defaultValue: 'Cancel' })}
                     </Button>
                     <Button
                        onClick={handleEndCall}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                     >
                        {t('callService.endCall', { defaultValue: 'End Call' })}
                     </Button>
                  </div>
               </div>
            </div>
         )}
      </div>
   )
}
