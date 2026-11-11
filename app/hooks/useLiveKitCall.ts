import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";

/**
 * One side of a call, over LiveKit.
 *
 * Replaces the old peer-to-peer hook. The difference that matters is not
 * audio quality: an SFU tells the server who is really in the room and
 * lets it remove them, which is what per-minute billing is made of. A
 * browser-to-browser connection can only be asked nicely to stop.
 *
 * This hook owns the media and nothing else. It never decides when a
 * call ends or what it costs — the screen asks the server that.
 */
export interface LiveKitCall {
  /** Attach to an <audio>/<video> element for the other person. */
  remoteRef: React.RefObject<HTMLMediaElement | null>;
  /** The local camera preview, for video calls. */
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  state: "idle" | "connecting" | "connected" | "reconnecting" | "closed";
  /** True once the other person's audio or video is actually flowing. */
  remoteJoined: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  error: string | null;
  toggleMic: () => void;
  toggleCamera: () => void;
  leave: () => Promise<void>;
}

export function useLiveKitCall(options: {
  serverUrl: string | null;
  token: string | null;
  video: boolean;
  /** Called when the room closes for a reason other than our own leave. */
  onDisconnected?: () => void;
}): LiveKitCall {
  const { serverUrl, token, video } = options;

  const roomRef = useRef<Room | null>(null);
  const remoteRef = useRef<HTMLMediaElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const leavingRef = useRef(false);
  const onDisconnectedRef = useRef(options.onDisconnected);
  onDisconnectedRef.current = options.onDisconnected;

  const [state, setState] = useState<LiveKitCall["state"]>("idle");
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serverUrl || !token) return;

    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const attach = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio || track.kind === Track.Kind.Video) {
        if (remoteRef.current) track.attach(remoteRef.current as any);
        setRemoteJoined(true);
      }
    };

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => attach(track))
      .on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, _pub: RemoteTrackPublication) => {
          track.detach();
        },
      )
      .on(RoomEvent.ParticipantDisconnected, () => {
        if (room.remoteParticipants.size === 0) setRemoteJoined(false);
      })
      .on(RoomEvent.ConnectionStateChanged, (connectionState) => {
        if (cancelled) return;
        switch (connectionState) {
          case ConnectionState.Connecting:
            setState("connecting");
            break;
          case ConnectionState.Connected:
            setState("connected");
            break;
          case ConnectionState.Reconnecting:
            setState("reconnecting");
            break;
          case ConnectionState.Disconnected:
            setState("closed");
            // A disconnect we did not ask for means the server ended the
            // call — out of money, the other side hung up, or the room
            // was closed. The screen asks the server which.
            if (!leavingRef.current) onDisconnectedRef.current?.();
            break;
          default:
            break;
        }
      });

    (async () => {
      try {
        setState("connecting");
        await room.connect(serverUrl, token);
        if (cancelled) return;

        await room.localParticipant.setMicrophoneEnabled(true);
        setMicEnabled(true);

        if (video) {
          await room.localParticipant.setCameraEnabled(true);
          setCameraEnabled(true);
          const camera = room.localParticipant.getTrackPublication(
            Track.Source.Camera,
          );
          if (camera?.track && localVideoRef.current) {
            camera.track.attach(localVideoRef.current);
          }
        }

        // Someone may already be in the room — subscribe to what is
        // playing rather than waiting for a future event.
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((publication) => {
            if (publication.track) attach(publication.track as RemoteTrack);
          });
        });
      } catch (err) {
        if (cancelled) return;
        setState("closed");
        setError(
          (err as Error)?.message?.includes("Permission")
            ? "Microphone access is needed for a call."
            : "Could not connect the call.",
        );
      }
    })();

    return () => {
      cancelled = true;
      leavingRef.current = true;
      room.disconnect().catch(() => undefined);
      roomRef.current = null;
    };
  }, [serverUrl, token, video]);

  const toggleMic = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isMicrophoneEnabled;
    void room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  }, []);

  const toggleCamera = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isCameraEnabled;
    void room.localParticipant.setCameraEnabled(next).then(() => {
      const camera = room.localParticipant.getTrackPublication(
        Track.Source.Camera,
      );
      if (camera?.track && localVideoRef.current) {
        camera.track.attach(localVideoRef.current);
      }
    });
    setCameraEnabled(next);
  }, []);

  const leave = useCallback(async () => {
    leavingRef.current = true;
    await roomRef.current?.disconnect().catch(() => undefined);
    setState("closed");
  }, []);

  return {
    remoteRef,
    localVideoRef,
    state,
    remoteJoined,
    micEnabled,
    cameraEnabled,
    error,
    toggleMic,
    toggleCamera,
    leave,
  };
}
