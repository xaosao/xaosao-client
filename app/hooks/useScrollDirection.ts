import { useState, useEffect, useRef } from "react";

/**
 * Detects scroll direction — returns true when scrolling down past the threshold.
 * Used for Facebook-style "hide on scroll down, show on scroll up" UI patterns.
 */
export function useScrollDirection(threshold = 10) {
    const [isScrollingDown, setIsScrollingDown] = useState(false);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const diff = currentScrollY - lastScrollY.current;

            // Ignore tiny scroll movements
            if (Math.abs(diff) < threshold) return;

            // Only hide when scrolling down AND past initial area
            setIsScrollingDown(diff > 0 && currentScrollY > 100);
            lastScrollY.current = currentScrollY;
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [threshold]);

    return isScrollingDown;
}
