"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useTranslation } from 'react-i18next';
import { Phone, PhoneOff, Video, User, Clock, Wallet } from "lucide-react"
import { useLoaderData, useNavigate, useParams, type LoaderFunctionArgs } from "react-router"
import Peer from "peerjs";

// components:
import { Button } from "~/components/ui/button"

// utils:
import { requireModelSession } from "~/services/model-auth.server";
import { getCallBooking } from "~/services/call-booking.server";
import { formatCurrency } from "~/utils"

const RING_TIMEOUT = 60000; // 60 seconds

// PeerJS config for early registration
const PEER_CONFIG = {
   host: '0.peerjs.com',
   port: 443,
   secure: true,
   path: '/',
   debug: 2, // Less verbose for incoming page
};

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

export default function IncomingCall() {
   const navigate = useNavigate()
   const params = useParams()
   const { t } = useTranslation();
   const { booking, modelId } = useLoaderData<typeof loader>();

   const [ringTimer, setRingTimer] = useState(60);
   const [isAccepting, setIsAccepting] = useState(false);
   const [isDeclining, setIsDeclining] = useState(false);
   const [peerReady, setPeerReady] = useState(false);
   const ringAudioRef = useRef<HTMLAudioElement | null>(null);
   const peerRef = useRef<Peer | null>(null);

   // Initialize PeerJS early to register peer ID in database
   // This allows the customer to find our peer ID before we even accept
   useEffect(() => {
      if (!params.bookingId) return;

      const initPeer = async (retryCount = 0) => {
         const basePeerId = `call_${params.bookingId}_model`;
         const peerId = retryCount > 0 ? `${basePeerId}_r${retryCount}` : basePeerId;

         console.log(`[Incoming] Initializing early peer with ID: ${peerId}`);

         try {
            const peer = new Peer(peerId, PEER_CONFIG);
            peerRef.current = peer;

            peer.on("open", async (id) => {
               console.log(`[Incoming] ✅ PeerJS connected with ID: ${id}`);

               // Register peer ID in database so customer can find us
               try {
                  const response = await fetch("/api/call/register-peer", {
                     method: "POST",
                     headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({
                        bookingId: params.bookingId,
                        peerId: id,
                        participantType: "model",
                     }),
                  });
                  const result = await response.json();
                  if (result.success) {
                     console.log(`[Incoming] ✅ Peer ID registered in database: ${id}`);
                     setPeerReady(true);
                  } else {
                     console.warn("[Incoming] ⚠️ Failed to register peer ID:", result.error);
                  }
               } catch (err) {
                  console.warn("[Incoming] ⚠️ Failed to register peer ID:", err);
               }
            });

            peer.on("error", (error: any) => {
               console.error("[Incoming] PeerJS error:", error.type, error.message);

               // Retry with different ID if unavailable
               if (error.type === "unavailable-id" && retryCount < 3) {
                  console.log(`[Incoming] Peer ID taken, retrying with suffix...`);
                  peer.destroy();
                  setTimeout(() => initPeer(retryCount + 1), 500);
               }
            });

            peer.on("disconnected", () => {
               console.log("[Incoming] PeerJS disconnected, attempting reconnect...");
               if (!peer.destroyed) {
                  peer.reconnect();
               }
            });

         } catch (err) {
            console.error("[Incoming] Failed to create peer:", err);
         }
      };

      initPeer();

      // Cleanup on unmount
      return () => {
         if (peerRef.current) {
            console.log("[Incoming] Cleaning up early peer connection");
            peerRef.current.destroy();
            peerRef.current = null;
         }
      };
   }, [params.bookingId]);

   // Play ringtone on mount
   useEffect(() => {
      // Create and play ringtone (note: path is /sound/ not /sounds/)
      ringAudioRef.current = new Audio('/sound/ringtone.mp3');
      ringAudioRef.current.loop = true;
      ringAudioRef.current.play().catch(err => {
         console.log('Could not play ringtone:', err);
      });

      return () => {
         if (ringAudioRef.current) {
            ringAudioRef.current.pause();
            ringAudioRef.current = null;
         }
      };
   }, []);

   // Ring timer countdown
   useEffect(() => {
      const countdown = setInterval(() => {
         setRingTimer(prev => {
            if (prev <= 1) {
               // Timeout - navigate away
               navigate('/model/dating');
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      return () => clearInterval(countdown);
   }, [navigate]);

   // Accept call
   const handleAcceptCall = useCallback(async () => {
      setIsAccepting(true);

      // Stop ringtone
      if (ringAudioRef.current) {
         ringAudioRef.current.pause();
      }

      try {
         const response = await fetch('/api/call/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: params.bookingId }),
         });

         const result = await response.json();

         if (result.success) {
            navigate(`/model/call/active/${params.bookingId}`);
         } else {
            console.error('Failed to accept call:', result.error);
            setIsAccepting(false);
         }
      } catch (error) {
         console.error('Error accepting call:', error);
         setIsAccepting(false);
      }
   }, [params.bookingId, navigate]);

   // Decline call
   const handleDeclineCall = useCallback(async () => {
      setIsDeclining(true);

      // Stop ringtone
      if (ringAudioRef.current) {
         ringAudioRef.current.pause();
      }

      try {
         await fetch('/api/call/decline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: params.bookingId }),
         });

         navigate('/model/dating');
      } catch (error) {
         console.error('Error declining call:', error);
         navigate('/model/dating');
      }
   }, [params.bookingId, navigate]);

   return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4">
         {/* Incoming Call Animation */}
         <div className="mb-8">
            <div className="relative">
               <div className="absolute inset-0 w-32 h-32 rounded-full bg-green-500/20 animate-ping" />
               <div className="absolute inset-0 w-32 h-32 rounded-full bg-green-500/10 animate-pulse" />
               {booking.customer?.profile ? (
                  <img
                     src={booking.customer.profile}
                     alt={booking.customer.firstName}
                     className="w-32 h-32 rounded-full object-cover border-4 border-green-500 relative z-10"
                  />
               ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center border-4 border-green-500 relative z-10">
                     <User className="w-16 h-16 text-gray-400" />
                  </div>
               )}
            </div>
         </div>

         {/* Customer Info */}
         <div className="text-center mb-4">
            <h2 className="text-2xl font-semibold text-white mb-2">
               {booking.customer?.firstName} {booking.customer?.lastName}
            </h2>
            <div className="flex items-center justify-center gap-2 text-gray-400">
               {booking.callType === 'video' ? (
                  <Video className="w-5 h-5" />
               ) : (
                  <Phone className="w-5 h-5" />
               )}
               <span>
                  {booking.callType === 'video'
                     ? t('callService.incomingVideoCall', { defaultValue: 'Incoming Video Call' })
                     : t('callService.incomingAudioCall', { defaultValue: 'Incoming Audio Call' })}
               </span>
            </div>
         </div>

         {/* Call Info */}
         <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 mb-8 text-white text-center">
            <div className="flex items-center justify-center gap-4 text-sm">
               <div className="flex items-center gap-1">
                  <Wallet className="w-4 h-4" />
                  <span>{formatCurrency(booking.minuteRate || 0)}/min</span>
               </div>
               <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{ringTimer}s</span>
               </div>
            </div>
            {/* Connection status indicator */}
            <div className="mt-2 text-xs flex items-center justify-center gap-1">
               <span className={`w-2 h-2 rounded-full ${peerReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
               <span className={peerReady ? 'text-green-400' : 'text-yellow-400'}>
                  {peerReady ? t('callService.ready', { defaultValue: 'Ready' }) : t('callService.connecting', { defaultValue: 'Connecting...' })}
               </span>
            </div>
         </div>

         {/* Action Buttons */}
         <div className="flex items-center gap-8">
            {/* Decline */}
            <div className="text-center">
               <Button
                  onClick={handleDeclineCall}
                  disabled={isDeclining || isAccepting}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center mb-2"
               >
                  <PhoneOff className="w-8 h-8 text-white" />
               </Button>
               <span className="text-gray-400 text-sm">
                  {t('callService.decline', { defaultValue: 'Decline' })}
               </span>
            </div>

            {/* Accept */}
            <div className="text-center">
               <Button
                  onClick={handleAcceptCall}
                  disabled={isAccepting || isDeclining}
                  className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center mb-2 animate-pulse"
               >
                  {booking.callType === 'video' ? (
                     <Video className="w-10 h-10 text-white" />
                  ) : (
                     <Phone className="w-10 h-10 text-white" />
                  )}
               </Button>
               <span className="text-gray-400 text-sm">
                  {t('callService.accept', { defaultValue: 'Accept' })}
               </span>
            </div>
         </div>
      </div>
   )
}
