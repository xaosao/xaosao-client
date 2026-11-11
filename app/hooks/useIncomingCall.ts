import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

import { useChatSocket } from "./useChatSocket";

/**
 * Answer the phone.
 *
 * A model with the site open gets taken to the ringing screen the moment
 * a customer calls. The push notification does the same job for a model
 * whose phone is in their pocket; whichever arrives first wins, and the
 * second is ignored because the screen is keyed by session id.
 *
 * Mounted once, in the model layout, so it is listening wherever they
 * happen to be in the app.
 */
export function useIncomingCall(enabled: boolean) {
  const navigate = useNavigate();
  const handled = useRef<string | null>(null);

  useChatSocket({
    userType: "model",
    enabled,
    onIncomingCall: (payload) => {
      if (!payload?.session_id || handled.current === payload.session_id) return;
      handled.current = payload.session_id;
      navigate(`/model/call/incoming/${payload.session_id}`);
    },
  });

  // A model who answers, hangs up and is called again by the same person
  // must ring again, so forget the last call once it is over.
  useEffect(() => {
    const clear = () => {
      handled.current = null;
    };
    window.addEventListener("focus", clear);
    return () => window.removeEventListener("focus", clear);
  }, []);
}
