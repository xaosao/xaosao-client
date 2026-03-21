"use client";

import { useEffect } from "react";

const DevToolsRedirect = () => {
  useEffect(() => {
    // Only run on desktop browsers — mobile doesn't have dev tools in the same way
    if (typeof window === "undefined" || window.innerWidth < 768) return;

    const detectKeyPress = (event: KeyboardEvent) => {
      if (
        event.key === "F12" ||
        (event.ctrlKey && event.shiftKey && event.key === "I") ||
        (event.ctrlKey && event.shiftKey && event.key === "J") ||
        (event.ctrlKey && event.key === "U")
      ) {
        window.location.href = "https://google.com";
      }
    };

    window.addEventListener("keydown", detectKeyPress);
    return () => {
      window.removeEventListener("keydown", detectKeyPress);
    };
  }, []);

  return null;
};

export default DevToolsRedirect;
