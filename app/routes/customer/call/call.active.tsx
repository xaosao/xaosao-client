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
   const hasInitiatedCallRef = useRef(false); // Prevent double-calling
   const [currentCost, setCurrentCost] = useState(0);
   const [remainingMinutes, setRemainingMinutes] = useState(booking.maxMinutes || 0);
   const [showEndConfirm, setShowEndConfirm] = useState(false);
   const [connectionError, setConnectionError] = useState<string | null>(null);
   const [retryCount, setRetryCount] = useState(0);

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
         console.log('[Customer] Call state changed:', state);
         // Only navigate to summary when call actually ended (after being connected)
         if (state === 'ended') {
            navigate(`/customer/call/summary/${params.bookingId}`);
         }
         // On failed, retry a few times before giving up
         if (state === 'failed' && retryCount < 3) {
            setRetryCount(prev => prev + 1);
            setConnectionError('Connection failed, retrying...');
         } else if (state === 'failed') {
            // After 3 retries, navigate to summary
            navigate(`/customer/call/summary/${params.bookingId}`);
         }
         // Clear error when successfully connected
         if (state === 'connected') {
            setConnectionError(null);
         }
      },
      onDurationUpdate: (seconds) => {
         const cost = calculateCallCost(seconds, booking.minuteRate || 0);
         setCurrentCost(cost);

         const usedMinutes = Math.ceil(seconds / 60);
         setRemainingMinutes(Math.max(0, (booking.maxMinutes || 0) - usedMinutes));
      },
      onCallEnded: (reason) => {
         console.log('[Customer] Call ended:', reason);
      },
      onError: (error) => {
         console.error('[Customer] Call error:', error);
         setConnectionError(error.message);
      },
   });

   // State for model's peer ID from database
   const [modelPeerId, setModelPeerId] = useState<string | null>(null);
   const peerPollingRef = useRef<NodeJS.Timeout | null>(null);

   // Debug: Log call state changes
   useEffect(() => {
      console.log('[Customer] 📊 Call state:', callState, '| Peer ID:', peerId, '| Model Peer ID:', modelPeerId);
   }, [callState, peerId, modelPeerId]);

   // Poll for model's peer ID from database
   // Wait until model has ACCEPTED the call (callStatus === "connecting") before calling
   useEffect(() => {
      if (callState !== 'ready' || modelPeerId || hasInitiatedCallRef.current) return;

      console.log('[Customer] ⏳ Polling for model peer ID and acceptance...');

      const pollForModelPeer = async () => {
         try {
            const response = await fetch(`/api/call/booking?id=${params.bookingId}`);
            const result = await response.json();

            // Wait for BOTH: model's peer ID AND model has accepted (callStatus is "connecting" or "in_call")
            const status = result.booking?.callStatus;
            const isAccepted = status === 'connecting' || status === 'in_call';

            if (result.success && result.booking?.modelPeerId && isAccepted) {
               console.log('[Customer] ✅ Model accepted! Peer ID:', result.booking.modelPeerId, 'Status:', status);
               setModelPeerId(result.booking.modelPeerId);
               if (peerPollingRef.current) {
                  clearInterval(peerPollingRef.current);
                  peerPollingRef.current = null;
               }
            } else if (result.booking?.modelPeerId && !isAccepted) {
               console.log('[Customer] Model peer registered but not yet accepted, waiting... Status:', status);
            } else {
               console.log('[Customer] Model peer ID not yet registered, retrying...');
            }
         } catch (error) {
            console.error('[Customer] Error polling for model peer:', error);
         }
      };

      // Poll every 1 second for faster discovery
      pollForModelPeer(); // First attempt
      peerPollingRef.current = setInterval(pollForModelPeer, 1000);

      return () => {
         if (peerPollingRef.current) {
            clearInterval(peerPollingRef.current);
            peerPollingRef.current = null;
         }
      };
   }, [callState, modelPeerId, params.bookingId]);

   // Connect to model's peer when we have their peer ID
   useEffect(() => {
      if (callState === 'ready' && modelPeerId && !hasInitiatedCallRef.current) {
         hasInitiatedCallRef.current = true;
         console.log('[Customer] ✅ PeerJS ready, my ID:', peerId);
         console.log('[Customer] 📞 Model accepted! Waiting 1s for peer to stabilize...');

         // Small delay to ensure model's active page peer is fully ready
         const callDelay = setTimeout(() => {
            console.log('[Customer] 📞 Now calling model peer ID:', modelPeerId);
            initiateCall(modelPeerId).catch(err => {
               console.error('[Customer] ❌ initiateCall error:', err);
               setConnectionError(err.message || 'Failed to initiate call');
            });
         }, 1000);

         return () => clearTimeout(callDelay);
      }
   }, [callState, modelPeerId, initiateCall, peerId]);

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
            body: JSON.stringify({ bookingId: params.bookingId, endedBy: 'customer' }),
         });

         // End the peer connection
         endCall();

         // Navigate to summary
         navigate(`/customer/call/summary/${params.bookingId}`);
      } catch (error) {
         console.error('Error ending call:', error);
         navigate(`/customer/call/summary/${params.bookingId}`);
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
                  <div className="text-center px-4">
                     {/* Show error icon for security/permission errors */}
                     {connectionError && connectionError.includes('HTTPS') ? (
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                           <span className="text-2xl">🔒</span>
                        </div>
                     ) : callState === 'failed' ? (
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                           <span className="text-2xl">❌</span>
                        </div>
                     ) : (
                        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                     )}
                     <p className="text-white text-lg">
                        {connectionError && connectionError.includes('HTTPS')
                           ? t('callService.securityError', { defaultValue: 'Security Error' })
                           : callState === 'failed'
                           ? t('callService.connectionFailed', { defaultValue: 'Connection Failed' })
                           : callState === 'calling'
                           ? t('callService.callingModel', { defaultValue: 'Calling model...' })
                           : callState === 'connecting'
                           ? t('callService.connecting', { defaultValue: 'Connecting...' })
                           : callState === 'ready'
                           ? t('callService.preparingCall', { defaultValue: 'Preparing call...' })
                           : t('callService.connectingToServer', { defaultValue: 'Connecting to server...' })}
                     </p>
                     {(callState === 'idle' || callState === 'initializing') && !connectionError && (
                        <p className="text-gray-400 text-sm mt-2">
                           {t('callService.establishingConnection', { defaultValue: 'Establishing secure connection...' })}
                        </p>
                     )}
                     {callState === 'ready' && !connectionError && !modelPeerId && (
                        <p className="text-gray-400 text-sm mt-2">
                           {t('callService.waitingForModelReady', { defaultValue: 'Waiting for model to be ready...' })}
                        </p>
                     )}
                     {callState === 'ready' && !connectionError && modelPeerId && (
                        <p className="text-gray-400 text-sm mt-2">
                           {t('callService.requestingPermission', { defaultValue: 'Requesting camera/microphone access...' })}
                        </p>
                     )}
                     {callState === 'calling' && !connectionError && (
                        <p className="text-gray-400 text-sm mt-2">
                           {t('callService.waitingForModelToAnswer', { defaultValue: 'Waiting for model to answer...' })}
                        </p>
                     )}
                     {connectionError && (
                        <p className={`text-sm mt-2 max-w-sm ${connectionError.includes('HTTPS') ? 'text-red-400' : 'text-amber-400'}`}>
                           {connectionError}
                        </p>
                     )}
                     {callState === 'failed' && !connectionError && (
                        <p className="text-gray-400 text-sm mt-2">
                           {t('callService.checkConnection', { defaultValue: 'Please check your internet connection and try again.' })}
                        </p>
                     )}
                     {retryCount > 0 && callState === 'failed' && (
                        <p className="text-gray-400 text-xs mt-1">
                           {t('callService.retryAttempt', { count: retryCount, defaultValue: `Attempt ${retryCount + 1}/4` })}
                        </p>
                     )}
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
