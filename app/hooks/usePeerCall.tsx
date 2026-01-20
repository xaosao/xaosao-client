import { useEffect, useRef, useState, useCallback } from "react";
import Peer, { MediaConnection } from "peerjs";

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

// Use PeerJS Cloud Server (free tier)
const PEER_CONFIG = {
  // Using PeerJS Cloud server - no custom server needed
  // You can also configure your own server if needed:
  // host: "your-peerjs-server.com",
  // port: 9000,
  // secure: true,
  debug: 1, // 0 = no logs, 1 = errors, 2 = warnings, 3 = all
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

  // Initialize PeerJS
  const initializePeer = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (peerRef.current && !peerRef.current.destroyed) {
        resolve(peerRef.current.id);
        return;
      }

      updateCallState("initializing");

      const peer = new Peer(PEER_CONFIG);
      peerRef.current = peer;

      peer.on("open", (id) => {
        console.log("PeerJS connected with ID:", id);
        setPeerId(id);
        updateCallState("ready");
        resolve(id);
      });

      peer.on("error", (error) => {
        console.error("PeerJS error:", error);
        onError?.(error);
        updateCallState("failed");
        reject(error);
      });

      peer.on("disconnected", () => {
        console.log("PeerJS disconnected, attempting to reconnect...");
        if (!peer.destroyed) {
          peer.reconnect();
        }
      });

      peer.on("close", () => {
        console.log("PeerJS connection closed");
      });

      // Handle incoming calls
      peer.on("call", (incomingCall) => {
        console.log("Incoming call from:", incomingCall.peer);
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
    });
  }, [callType, onError, updateCallState]);

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

  // Initiate call (customer side)
  const initiateCall = useCallback(async (remotePeerId: string): Promise<void> => {
    try {
      updateCallState("calling");

      // Initialize media first
      const stream = await initializeMedia();

      if (!peerRef.current) {
        throw new Error("Peer not initialized");
      }

      // Call the remote peer
      const call = peerRef.current.call(remotePeerId, stream, {
        metadata: {
          userId,
          userName,
          bookingId,
          callType,
        },
      });

      callRef.current = call;

      call.on("stream", (remoteMediaStream) => {
        console.log("Received remote stream");
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

      call.on("close", () => {
        console.log("Call closed");
        handleCallEnded("remote_hangup");
      });

      call.on("error", (error) => {
        console.error("Call error:", error);
        onError?.(error);
        updateCallState("failed");
      });

    } catch (error) {
      console.error("Failed to initiate call:", error);
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
  ]);

  // Handle call ended
  const handleCallEnded = useCallback((reason: string) => {
    stopDurationTimer();
    stopHeartbeat();
    updateCallState("ended");
    onCallEnded?.(reason);
  }, [onCallEnded, stopDurationTimer, stopHeartbeat, updateCallState]);

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
