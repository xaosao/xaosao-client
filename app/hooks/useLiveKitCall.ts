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
  /**
   * The other person's audio and video go to SEPARATE elements.
   *
   * They used to share one: attaching a video track to the element that
   * already held the audio replaced it, so when a voice call switched to
   * video the far side saw nothing. One sink per kind avoids that.
   */
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  /** The local camera preview, for video calls. */
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  state: "idle" | "connecting" | "connected" | "reconnecting" | "closed";
  /** True once the other person's audio or video is actually flowing. */
  remoteJoined: boolean;
  /** True while the other side is actually publishing video. */
  remoteVideo: boolean;
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
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const leavingRef = useRef(false);
  const onDisconnectedRef = useRef(options.onDisconnected);
  onDisconnectedRef.current = options.onDisconnected;

  const [state, setState] = useState<LiveKitCall["state"]>("idle");
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [remoteVideo, setRemoteVideo] = useState(false);
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
      if (track.kind === Track.Kind.Audio) {
        if (remoteAudioRef.current) track.attach(remoteAudioRef.current);
        setRemoteJoined(true);
      } else if (track.kind === Track.Kind.Video) {
        if (remoteVideoRef.current) track.attach(remoteVideoRef.current);
        setRemoteJoined(true);
        // A call that started as voice can gain video later, so this is
        // watched rather than assumed from the call type.
        setRemoteVideo(true);
      }
    };

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => attach(track))
      .on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, _pub: RemoteTrackPublication) => {
          track.detach();
          if (track.kind === Track.Kind.Video) setRemoteVideo(false);
        },
      )
      .on(RoomEvent.ParticipantDisconnected, () => {
        if (room.remoteParticipants.size === 0) {
          setRemoteJoined(false);
          setRemoteVideo(false);
        }
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

        // The underlying error used to be swallowed into one sentence,
        // "Could not connect the call.", which says nothing a person can
        // act on and nothing a developer can debug. Keep it in the
        // console and name the cases that have a real remedy.
        console.error("[call] could not start media", err);

        const e = err as { name?: string; message?: string };
        const name = e?.name ?? "";
        const message = e?.message ?? "";
        const says = (needle: string) =>
          name.includes(needle) || message.includes(needle);

        if (says("NotFound") || says("DevicesNotFound")) {
          // No capture device at all — common on a desktop without a
          // headset. Nothing about the call is wrong.
          setError("noDevice");
        } else if (says("NotAllowed") || says("Permission") || says("Denied")) {
          setError("denied");
        } else if (says("NotReadable") || says("TrackStart") || says("AbortError")) {
          // Another app holds the microphone.
          setError("deviceBusy");
        } else if (
          typeof window !== "undefined" &&
          !window.isSecureContext
        ) {
          // getUserMedia only exists on https or localhost. Opening the
          // dev server over a LAN address is the usual way to land here.
          setError("insecure");
        } else {
          setError("connect");
        }
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

  /**
   * Turn our own camera on or off, mid-call.
   *
   * The attach does NOT happen here. The preview element only exists
   * once `cameraEnabled` is true, so attaching in this callback ran
   * against a ref that was still null and the preview stayed black —
   * and because the room and the React state then disagreed, the next
   * press computed the wrong `next` and the camera could not be turned
   * off again. The effect below attaches once the element is really on
   * the page, and the state is only set after the room agrees.
   */
  const toggleCamera = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isCameraEnabled;
    void room.localParticipant
      .setCameraEnabled(next)
      .then(() => setCameraEnabled(room.localParticipant.isCameraEnabled))
      .catch((err) => {
        console.error("[call] could not switch the camera", err);
        setCameraEnabled(room.localParticipant.isCameraEnabled);
      });
  }, []);

  const leave = useCallback(async () => {
    leavingRef.current = true;
    await roomRef.current?.disconnect().catch(() => undefined);
    setState("closed");
  }, []);

  /**
   * Keep the local preview wired to whatever the camera is publishing.
   *
   * Runs after render, so the element is on the page by the time we
   * attach, and re-runs whenever the camera is switched.
   */
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    const camera = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = camera?.track;
    if (cameraEnabled && track && localVideoRef.current) {
      track.attach(localVideoRef.current);
      return () => {
        track.detach();
      };
    }
  }, [cameraEnabled, state]);

  return {
    remoteAudioRef,
    remoteVideoRef,
    localVideoRef,
    state,
    remoteJoined,
    remoteVideo,
    micEnabled,
    cameraEnabled,
    error,
    toggleMic,
    toggleCamera,
    leave,
  };
}
