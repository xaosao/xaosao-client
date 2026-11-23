import { useEffect, useRef } from "react";

/**
 * A looping call sound (the model's ringtone, the customer's ringback)
 * that plays while `enabled` and stops the moment it is not.
 *
 * Browsers may refuse to start audio that no tap asked for — a ring that
 * arrives over the socket is exactly that case — so when `play()` is
 * refused the sound starts on the next tap or key instead.
 *
 * The tones are synthesized files in /public/sound (no licensed audio),
 * the same ones the app uses.
 */
export function useLoopingSound(src: string, enabled: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const audio = new Audio(src);
    audio.loop = true;
    audioRef.current = audio;

    const start = () => {
      audio.play().catch(() => {
        /* still blocked; the next gesture retries */
      });
    };
    const onGesture = () => {
      start();
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };

    audio.play().catch(() => {
      window.addEventListener("pointerdown", onGesture);
      window.addEventListener("keydown", onGesture);
    });

    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [src, enabled]);

  /** Stop right away, e.g. the instant Answer is tapped. */
  return () => {
    audioRef.current?.pause();
  };
}

/**
 * A short tick and vibration for mute / unmute, so the change is felt as
 * well as seen. Vibration only exists on Android browsers.
 */
export function playToggleFeedback() {
  if (typeof window === "undefined") return;
  try {
    navigator.vibrate?.(30);
  } catch {
    /* not supported */
  }
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1400;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
    osc.onended = () => void ctx.close();
  } catch {
    /* no audio; the button change is still visible */
  }
}
