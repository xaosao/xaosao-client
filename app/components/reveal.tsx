import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper.
 *
 * Fades + slides its children into view the first time they cross the
 * viewport (IntersectionObserver). Reset-once semantics: once revealed
 * the element stays visible even if the user scrolls back up.
 *
 * Pairs with the `.reveal-*` keyframes defined in app.css:
 *   - direction="up"    (default) — slides 24px up
 *   - direction="left"            — slides 24px in from left
 *   - direction="right"           — slides 24px in from right
 *   - direction="fade"            — pure opacity fade, no translation
 *
 * `delay` lets grids of children stagger by a fixed step (usually 80ms).
 *
 * SSR-safe: renders in the pre-reveal state on the server, then the
 * observer takes over on the client. Reduces layout shift and respects
 * `prefers-reduced-motion`.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  threshold = 0.15,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  direction?: "up" | "left" | "right" | "fade";
  delay?: number;
  threshold?: number;
  as?: "div" | "section" | "article" | "li";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect the user's motion preference — no animation, just show it.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  const state = visible ? "reveal-in" : "reveal-out";
  const dir = `reveal-${direction}`;

  return (
    <Tag
      ref={ref as never}
      className={`${state} ${dir} ${className}`.trim()}
      style={{
        transitionDelay: visible ? `${delay}ms` : "0ms",
        animationDelay: visible ? `${delay}ms` : "0ms",
      }}
    >
      {children}
    </Tag>
  );
}
