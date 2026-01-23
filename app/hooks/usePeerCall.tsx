import { useEffect, useRef, useState, useCallback } from "react";
import Peer from "peerjs";
import type { MediaConnection } from "peerjs";

export type CallState =
  | "idle"
  | "initializing"
  | "ready"
  | "calling"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "failed"
  | "missed";

export type CallType = "audio" | "video";

export interface CallParticipant {
  peerId: string;
  name: string;
  userId: string;
  stream?: MediaStream;
  isLocal: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
}

export interface UsePeerCallOptions {
  bookingId: string;
  callType: CallType;
  userId: string;
  userName: string;
  isModel: boolean;
  onCallStateChange?: (state: CallState) => void;
  onDurationUpdate?: (seconds: number) => void;
  onCallEnded?: (reason: string) => void;
  onError?: (error: Error) => void;
}

export interface UsePeerCallReturn {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localParticipant: CallParticipant | null;
  remoteParticipant: CallParticipant | null;
  duration: number;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  peerId: string | null;
  initiateCall: (remotePeerId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  endCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  cleanup: () => void;
}

// Use PeerJS Cloud Server with ICE servers for NAT traversal
// Debug level 3 for full logs during development
const PEER_CONFIG = {
  // Explicitly use PeerJS cloud server
  host: '0.peerjs.com',
  port: 443,
  secure: true,
  path: '/',
  debug: 3, // Full debug logs
  config: {
    iceServers: [
      // Google's public STUN servers
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      // Twilio STUN servers (more reliable)
      { urls: "stun:global.stun.twilio.com:3478" },
      // Free TURN servers from metered.ca
      {
        urls: "turn:a.relay.metered.ca:80",
        username: "e0c1497df2efff0944d00b7c",
        credential: "kVyOuOIHbRXGMH+8",
      },
      {
        urls: "turn:a.relay.metered.ca:80?transport=tcp",
        username: "e0c1497df2efff0944d00b7c",
        credential: "kVyOuOIHbRXGMH+8",
      },
      {
        urls: "turn:a.relay.metered.ca:443",
        username: "e0c1497df2efff0944d00b7c",
        credential: "kVyOuOIHbRXGMH+8",
      },
      {
        urls: "turn:a.relay.metered.ca:443?transport=tcp",
        username: "e0c1497df2efff0944d00b7c",
        credential: "kVyOuOIHbRXGMH+8",
      },
    ],
    // ICE candidate policy
    iceCandidatePoolSize: 10,
  },
};

export const usePeerCall = (options: UsePeerCallOptions): UsePeerCallReturn => {
  const {
    bookingId,
    callType,
    userId,
    userName,
    isModel,
    onCallStateChange,
    onDurationUpdate,
    onCallEnded,
    onError,
  } = options;

  // State
  const [callState, setCallState] = useState<CallState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localParticipant, setLocalParticipant] = useState<CallParticipant | null>(null);
  const [remoteParticipant, setRemoteParticipant] = useState<CallParticipant | null>(null);
  const [duration, setDuration] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === "video");
  const [peerId, setPeerId] = useState<string | null>(null);

  // Refs
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const incomingCallRef = useRef<MediaConnection | null>(null);

  // Update call state with callback
  const updateCallState = useCallback((newState: CallState) => {
    setCallState(newState);
    onCallStateChange?.(newState);
  }, [onCallStateChange]);

  // Initialize media stream
  const initializeMedia = useCallback(async (): Promise<MediaStream> => {
    try {
      // Check if mediaDevices is available (requires HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
        if (!isSecure) {
          throw new Error("Camera/microphone access requires HTTPS. Please use ngrok or localhost to access this page.");
        }
        throw new Error("Your browser does not support camera/microphone access.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      streamRef.current = stream;
      setLocalStream(stream);

      setLocalParticipant({
        peerId: peerRef.current?.id || "",
        name: userName,
        userId: userId,
        stream: stream,
        isLocal: true,
        isAudioEnabled: true,
        isVideoEnabled: callType === "video",
      });

      return stream;
    } catch (error) {
      console.error("Failed to get media devices:", error);
      const err = error instanceof Error ? error : new Error("Failed to access camera/microphone");
      onError?.(err);
      throw err;
    }
  }, [callType, userId, userName, onError]);

  // Initialize PeerJS with deterministic peer ID based on booking and participant type
  const initializePeer = useCallback((retryCount = 0): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Clean up existing peer first
      if (peerRef.current) {
        if (!peerRef.current.destroyed) {
          console.log("[PeerJS] Destroying existing peer before creating new one");
          peerRef.current.destroy();
        }
        peerRef.current = null;
      }

      updateCallState("initializing");

      // Generate deterministic peer ID so both parties can find each other
      // Add retry suffix if this is a retry attempt to avoid conflicts
      const participantType = isModel ? "model" : "customer";
      const basePeerId = `call_${bookingId}_${participantType}`;
      const deterministicPeerId = retryCount > 0 ? `${basePeerId}_r${retryCount}` : basePeerId;
      console.log(`[PeerJS] Initializing with peer ID: ${deterministicPeerId} (attempt ${retryCount + 1})`);
      console.log(`[PeerJS] Using config:`, JSON.stringify(PEER_CONFIG, null, 2));

      let peer: Peer;
      try {
        peer = new Peer(deterministicPeerId, PEER_CONFIG);
      } catch (err) {
        console.error("[PeerJS] Failed to create Peer instance:", err);
        const error = err instanceof Error ? err : new Error("Failed to create peer");
        onError?.(error);
        updateCallState("failed");
        reject(error);
        return;
      }

      peerRef.current = peer;

      let hasResolved = false;
      let connectionTimeout: NodeJS.Timeout | null = null;

      peer.on("open", async (id) => {
        console.log("[PeerJS] ✅ Connected to PeerJS server with ID:", id);
        hasResolved = true;
        if (connectionTimeout) clearTimeout(connectionTimeout);
        setPeerId(id);

        // Register peer ID with server for reliable discovery
        try {
          const response = await fetch("/api/call/register-peer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookingId,
              peerId: id,
              participantType: isModel ? "model" : "customer",
            }),
          });
          const result = await response.json();
          if (result.success) {
            console.log(`[PeerJS] ✅ Peer ID registered in database: ${id}`);
          } else {
            console.warn("[PeerJS] ⚠️ Failed to register peer ID:", result.error);
          }
        } catch (err) {
          console.warn("[PeerJS] ⚠️ Failed to register peer ID:", err);
        }

        updateCallState("ready");
        resolve(id);
      });

      peer.on("error", (error: any) => {
        console.error("[PeerJS] ❌ Error:", error.type, error.message);
        if (connectionTimeout) clearTimeout(connectionTimeout);

        // Handle "unavailable-id" error by retrying with a different suffix
        if (error.type === "unavailable-id" && retryCount < 3) {
          console.log(`[PeerJS] Peer ID taken, retrying with suffix (attempt ${retryCount + 2})`);
          peer.destroy();
          // Small delay before retry
          setTimeout(() => {
            initializePeer(retryCount + 1).then(resolve).catch(reject);
          }, 500);
          return;
        }

        // Handle network errors with retry
        if ((error.type === "network" || error.type === "server-error") && retryCount < 3) {
          console.log(`[PeerJS] Network error, retrying (attempt ${retryCount + 2})`);
          peer.destroy();
          setTimeout(() => {
            initializePeer(retryCount + 1).then(resolve).catch(reject);
          }, 1000 * (retryCount + 1)); // Exponential backoff
          return;
        }

        if (!hasResolved) {
          onError?.(error);
          updateCallState("failed");
          reject(error);
        }
      });

      peer.on("disconnected", () => {
        console.log("[PeerJS] ⚠️ Disconnected from server, attempting to reconnect...");
        if (!peer.destroyed) {
          peer.reconnect();
        }
      });

      peer.on("close", () => {
        console.log("[PeerJS] Connection closed");
      });

      // Handle incoming calls
      peer.on("call", (incomingCall) => {
        console.log("[PeerJS] 📞 Incoming call from:", incomingCall.peer);
        incomingCallRef.current = incomingCall;

        // Extract metadata
        const metadata = incomingCall.metadata || {};

        setRemoteParticipant({
          peerId: incomingCall.peer,
          name: metadata.userName || "Caller",
          userId: metadata.userId || "",
          isLocal: false,
          isAudioEnabled: true,
          isVideoEnabled: callType === "video",
        });

        updateCallState("ringing");
      });

      // Timeout for initial connection - 15 seconds
      connectionTimeout = setTimeout(() => {
        if (!hasResolved) {
          console.log(`[PeerJS] ⏰ Connection timeout after 15s (attempt ${retryCount + 1})`);
          if (retryCount < 2) {
            console.log("[PeerJS] Retrying...");
            peer.destroy();
            initializePeer(retryCount + 1).then(resolve).catch(reject);
          } else {
            console.error("[PeerJS] Max retries reached, giving up");
            const error = new Error("Failed to connect to PeerJS server after multiple attempts");
            onError?.(error);
            updateCallState("failed");
            reject(error);
          }
        }
      }, 15000);
    });
  }, [bookingId, callType, isModel, onError, updateCallState]);

  // Start duration timer
  const startDurationTimer = useCallback(() => {
    callStartTimeRef.current = Date.now();

    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        setDuration(elapsed);
        onDurationUpdate?.(elapsed);
      }
    }, 1000);
  }, [onDurationUpdate]);

  // Stop duration timer
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Start heartbeat to track call duration server-side
  const startHeartbeat = useCallback(() => {
    // Send heartbeat every 10 seconds
    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        await fetch("/api/call/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
            participantType: isModel ? "model" : "customer",
          }),
        });
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    }, 10000);
  }, [bookingId, isModel]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Handle call ended - MUST be defined before initiateCall and acceptCall
  const handleCallEnded = useCallback((reason: string) => {
    stopDurationTimer();
    stopHeartbeat();
    updateCallState("ended");
    onCallEnded?.(reason);
  }, [onCallEnded, stopDurationTimer, stopHeartbeat, updateCallState]);

  // Try to call a specific peer ID
  // Uses a shorter timeout (5 seconds) to allow faster cycling through attempts
  const tryCall = useCallback((remotePeerId: string, stream: MediaStream): Promise<MediaConnection> => {
    return new Promise((resolve, reject) => {
      if (!peerRef.current) {
        reject(new Error("Peer not initialized"));
        return;
      }

      console.log(`[PeerJS] Attempting to call peer: ${remotePeerId}`);

      const call = peerRef.current.call(remotePeerId, stream, {
        metadata: {
          userId,
          userName,
          bookingId,
          callType,
        },
      });

      // Set a shorter timeout (5 seconds) to allow faster retry cycles
      const callTimeout = setTimeout(() => {
        console.log(`[PeerJS] Call to ${remotePeerId} timed out (5s)`);
        call.close();
        reject(new Error("Call timeout"));
      }, 5000);

      call.on("stream", (remoteMediaStream) => {
        clearTimeout(callTimeout);
        console.log("[PeerJS] Received remote stream from:", remotePeerId);
        resolve(call);
      });

      call.on("error", (error) => {
        clearTimeout(callTimeout);
        console.error(`[PeerJS] Call error to ${remotePeerId}:`, error);
        reject(error);
      });

      call.on("close", () => {
        clearTimeout(callTimeout);
      });
    });
  }, [bookingId, callType, userId, userName]);

  // Initiate call (customer side)
  // This continuously retries calling the model until successful or total timeout (90 seconds)
  const initiateCall = useCallback(async (remotePeerId: string): Promise<void> => {
    try {
      updateCallState("calling");

      // Initialize media first
      const stream = await initializeMedia();

      if (!peerRef.current) {
        throw new Error("Peer not initialized");
      }

      // Try different peer ID variants (in case model had to retry with suffix)
      const peerIdVariants = [
        remotePeerId,
        `${remotePeerId}_r1`,
        `${remotePeerId}_r2`,
        `${remotePeerId}_r3`,
      ];

      let connectedCall: MediaConnection | null = null;
      let lastError: Error | null = null;
      const TOTAL_TIMEOUT_MS = 90000; // 90 seconds total timeout
      const RETRY_DELAY_MS = 3000; // 3 seconds between retry rounds
      const startTime = Date.now();
      let roundNumber = 0;

      // Keep retrying until successful or total timeout exceeded
      while (!connectedCall && (Date.now() - startTime) < TOTAL_TIMEOUT_MS) {
        roundNumber++;
        console.log(`[PeerJS] Call attempt round ${roundNumber}, elapsed: ${Math.floor((Date.now() - startTime) / 1000)}s`);

        for (const peerId of peerIdVariants) {
          // Check if we've exceeded total timeout
          if ((Date.now() - startTime) >= TOTAL_TIMEOUT_MS) {
            console.log("[PeerJS] Total timeout exceeded, giving up");
            break;
          }

          try {
            connectedCall = await tryCall(peerId, stream);
            if (connectedCall) {
              console.log(`[PeerJS] Successfully connected to: ${peerId}`);
              break;
            }
          } catch (error) {
            console.log(`[PeerJS] Failed to connect to ${peerId}, will retry...`);
            lastError = error instanceof Error ? error : new Error(String(error));
          }
        }

        // If connected, break out of the retry loop
        if (connectedCall) break;

        // Wait before next round of retries (unless total timeout exceeded)
        if ((Date.now() - startTime) < TOTAL_TIMEOUT_MS) {
          console.log(`[PeerJS] Round ${roundNumber} failed, waiting ${RETRY_DELAY_MS}ms before retrying...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }

      if (!connectedCall) {
        throw lastError || new Error("Failed to connect to model - timeout exceeded");
      }

      callRef.current = connectedCall;

      // Handle the stream (already received in tryCall)
      connectedCall.on("stream", (remoteMediaStream) => {
        console.log("[PeerJS] Stream handler - setting remote stream");
        setRemoteStream(remoteMediaStream);

        setRemoteParticipant(prev => prev ? {
          ...prev,
          stream: remoteMediaStream,
        } : null);

        updateCallState("connected");
        startDurationTimer();
        startHeartbeat();

        // Notify server that call started
        fetch("/api/call/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        }).catch(console.error);
      });

      connectedCall.on("close", () => {
        console.log("[PeerJS] Call closed");
        handleCallEnded("remote_hangup");
      });

      connectedCall.on("error", (error) => {
        console.error("[PeerJS] Call error:", error);
        onError?.(error);
        updateCallState("failed");
      });

      // Trigger the stream handler if we already received a stream
      // (the stream event might have fired during tryCall)
      const remoteStream = (connectedCall as any).remoteStream;
      if (remoteStream) {
        setRemoteStream(remoteStream);
        setRemoteParticipant(prev => prev ? { ...prev, stream: remoteStream } : null);
        updateCallState("connected");
        startDurationTimer();
        startHeartbeat();
        fetch("/api/call/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        }).catch(console.error);
      }

    } catch (error) {
      console.error("[PeerJS] Failed to initiate call:", error);
      const err = error instanceof Error ? error : new Error("Failed to initiate call");
      onError?.(err);
      updateCallState("failed");
      throw err;
    }
  }, [
    bookingId,
    callType,
    initializeMedia,
    onError,
    startDurationTimer,
    startHeartbeat,
    updateCallState,
    userId,
    userName,
    tryCall,
    handleCallEnded,
  ]);

  // Accept incoming call (model side)
  const acceptCall = useCallback(async (): Promise<void> => {
    try {
      if (!incomingCallRef.current) {
        throw new Error("No incoming call to accept");
      }

      updateCallState("connecting");

      // Initialize media
      const stream = await initializeMedia();

      // Answer the call with our stream
      incomingCallRef.current.answer(stream);
      callRef.current = incomingCallRef.current;

      incomingCallRef.current.on("stream", (remoteMediaStream) => {
        console.log("Received remote stream after accepting");
        setRemoteStream(remoteMediaStream);

        setRemoteParticipant(prev => prev ? {
          ...prev,
          stream: remoteMediaStream,
        } : null);

        updateCallState("connected");
        startDurationTimer();
        startHeartbeat();

        // Notify server that call started
        fetch("/api/call/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        }).catch(console.error);
      });

      incomingCallRef.current.on("close", () => {
        console.log("Call closed");
        handleCallEnded("remote_hangup");
      });

      incomingCallRef.current.on("error", (error) => {
        console.error("Call error:", error);
        onError?.(error);
        updateCallState("failed");
      });

    } catch (error) {
      console.error("Failed to accept call:", error);
      const err = error instanceof Error ? error : new Error("Failed to accept call");
      onError?.(err);
      updateCallState("failed");
      throw err;
    }
  }, [
    bookingId,
    initializeMedia,
    onError,
    startDurationTimer,
    startHeartbeat,
    updateCallState,
    handleCallEnded,
  ]);

  // End call
  const endCall = useCallback(() => {
    // Close the call connection
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }

    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    handleCallEnded("local_hangup");
  }, [handleCallEnded]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
      });

      setLocalParticipant(prev => prev ? {
        ...prev,
        isAudioEnabled: !prev.isAudioEnabled,
      } : null);
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
      });

      setLocalParticipant(prev => prev ? {
        ...prev,
        isVideoEnabled: !prev.isVideoEnabled,
      } : null);
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop timers
    stopDurationTimer();
    stopHeartbeat();

    // Close call
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }

    // Stop media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Destroy peer
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    // Reset state
    setLocalStream(null);
    setRemoteStream(null);
    setLocalParticipant(null);
    setRemoteParticipant(null);
    setDuration(0);
    setPeerId(null);
    updateCallState("idle");
  }, [stopDurationTimer, stopHeartbeat, updateCallState]);

  // Initialize peer on mount
  useEffect(() => {
    initializePeer().catch(console.error);

    return () => {
      cleanup();
    };
  }, []);

  // Handle visibility change (for when user leaves page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && callState === "connected") {
        // User left page during call - send heartbeat
        navigator.sendBeacon("/api/call/heartbeat", JSON.stringify({
          bookingId,
          participantType: isModel ? "model" : "customer",
        }));
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [bookingId, callState, isModel]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callState === "connected") {
        // Notify server that call might have ended
        navigator.sendBeacon("/api/call/end", JSON.stringify({
          bookingId,
          endedBy: isModel ? "model" : "customer",
        }));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [bookingId, callState, isModel]);

  return {
    callState,
    localStream,
    remoteStream,
    localParticipant,
    remoteParticipant,
    duration,
    isAudioEnabled,
    isVideoEnabled,
    peerId,
    initiateCall,
    acceptCall,
    endCall,
    toggleAudio,
    toggleVideo,
    cleanup,
  };
};

// Helper function to format duration
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// Helper function to calculate cost
export const calculateCallCost = (seconds: number, minuteRate: number): number => {
  const minutes = Math.ceil(seconds / 60); // Round up to nearest minute
  return Math.max(1, minutes) * minuteRate; // Minimum 1 minute
};
