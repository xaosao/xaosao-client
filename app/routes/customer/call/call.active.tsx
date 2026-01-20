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
import { requireUserSession } from "~/services/auths.server";
import { getCallBooking } from "~/services/call-booking.server";
import { formatCurrency } from "~/utils"

export async function loader({ params, request }: LoaderFunctionArgs) {
   const customerId = await requireUserSession(request);
   const booking = await getCallBooking(params.bookingId!);

   if (!booking) {
      throw new Response("Booking not found", { status: 404 });
   }

   if (booking.customerId !== customerId) {
      throw new Response("Unauthorized", { status: 403 });
   }

   return { booking, customerId };
}

export default function ActiveCall() {
   const navigate = useNavigate()
   const params = useParams()
   const { t } = useTranslation();
   const { booking, customerId } = useLoaderData<typeof loader>();

   const localVideoRef = useRef<HTMLVideoElement>(null);
   const remoteVideoRef = useRef<HTMLVideoElement>(null);
   const [currentCost, setCurrentCost] = useState(0);
   const [remainingMinutes, setRemainingMinutes] = useState(booking.maxMinutes || 0);
   const [showEndConfirm, setShowEndConfirm] = useState(false);

   // Initialize peer call
   const {
      callState,
      localStream,
      remoteStream,
      duration,
      isAudioEnabled,
      isVideoEnabled,
      peerId,
      initiateCall,
      endCall,
      toggleAudio,
      toggleVideo,
      cleanup,
   } = usePeerCall({
      bookingId: params.bookingId!,
      callType: booking.callType as 'audio' | 'video',
      userId: customerId,
      userName: 'Customer',
      isModel: false,
      onCallStateChange: (state) => {
         console.log('Call state changed:', state);
         if (state === 'ended' || state === 'failed') {
            navigate(`/customer/call/${params.bookingId}/summary`);
         }
      },
      onDurationUpdate: (seconds) => {
         const cost = calculateCallCost(seconds, booking.minuteRate || 0);
         setCurrentCost(cost);

         const usedMinutes = Math.ceil(seconds / 60);
         setRemainingMinutes(Math.max(0, (booking.maxMinutes || 0) - usedMinutes));
      },
      onCallEnded: (reason) => {
         console.log('Call ended:', reason);
      },
      onError: (error) => {
         console.error('Call error:', error);
      },
   });

   // Connect to model's peer when ready
   useEffect(() => {
      if (callState === 'ready' && booking.modelPeerId) {
         initiateCall(booking.modelPeerId);
      }
   }, [callState, booking.modelPeerId, initiateCall]);

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

   // Auto-end call when balance depleted
   useEffect(() => {
      if (remainingMinutes <= 0 && callState === 'connected') {
         handleEndCall();
      }
   }, [remainingMinutes, callState]);

   // Cleanup on unmount
   useEffect(() => {
      return () => {
         cleanup();
      };
   }, [cleanup]);

   // Handle end call
   const handleEndCall = useCallback(async () => {
      try {
         // End the call via API
         await fetch('/api/call/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: params.bookingId, endedBy: 'customer' }),
         });

         // End the peer connection
         endCall();

         // Navigate to summary
         navigate(`/customer/call/${params.bookingId}/summary`);
      } catch (error) {
         console.error('Error ending call:', error);
         navigate(`/customer/call/${params.bookingId}/summary`);
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
                  {booking.model?.profile ? (
                     <img
                        src={booking.model.profile}
                        alt={booking.model.firstName}
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
               {/* Model Name */}
               <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
                  <p className="text-sm font-medium">
                     {booking.model?.firstName} {booking.model?.lastName}
                  </p>
               </div>

               {/* Duration & Cost */}
               <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white space-y-1">
                  <div className="flex items-center gap-2">
                     <Clock className="w-4 h-4" />
                     <span className="text-lg font-mono">{formatDuration(duration)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                     <Wallet className="w-3 h-3" />
                     <span>{formatCurrency(currentCost)}</span>
                  </div>
               </div>

               {/* Remaining Time Warning */}
               {remainingMinutes <= 5 && (
                  <div className={`rounded-lg px-3 py-2 text-sm font-medium ${remainingMinutes <= 1 ? 'bg-red-500/80 text-white' : 'bg-amber-500/80 text-white'}`}>
                     {remainingMinutes <= 1
                        ? t('callService.balanceLow', { defaultValue: 'Low balance! Call will end soon.' })
                        : t('callService.remainingMinutes', { minutes: remainingMinutes, defaultValue: `${remainingMinutes} minutes remaining` })}
                  </div>
               )}
            </div>

            {/* Connection Status */}
            {callState !== 'connected' && (
               <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="text-center">
                     <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                     <p className="text-white text-lg">
                        {callState === 'connecting'
                           ? t('callService.connecting', { defaultValue: 'Connecting...' })
                           : t('callService.initializing', { defaultValue: 'Initializing...' })}
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
                     {t('callService.endCallMessage', {
                        duration: formatDuration(duration),
                        cost: formatCurrency(currentCost),
                        defaultValue: `Call duration: ${formatDuration(duration)}. Cost: ${formatCurrency(currentCost)}`
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
