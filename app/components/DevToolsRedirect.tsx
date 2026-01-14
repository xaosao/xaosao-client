"use client";

import { useEffect } from "react";

const DevToolsRedirect = () => {
  useEffect(() => {
    const detectDevTools = () => {
      if (window.innerWidth < 768) return; // Ignore mobile users

      const threshold = 160;

      const checkDevTools = () => {
        if (
          window.outerWidth - window.innerWidth > threshold ||
          window.outerHeight - window.innerHeight > threshold
        ) {
          window.location.href = "https://google.com";
        }
      };

      const devToolsCheck = setInterval(() => {
        console.profile();
        console.profileEnd();

        if (console.clear) {
          console.clear();
        }

        checkDevTools();
      }, 1000);

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

      window.addEventListener("resize", checkDevTools);
      window.addEventListener("keydown", detectKeyPress);

      return () => {
        clearInterval(devToolsCheck);
        window.removeEventListener("resize", checkDevTools);
        window.removeEventListener("keydown", detectKeyPress);
      };
    };

    detectDevTools();
  }, []);

  return null;
};

export default DevToolsRedirect;
