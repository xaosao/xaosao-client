import type { ReactNode, MouseEvent } from "react";
import { useEffect } from "react";

type ModalProps = {
    children: ReactNode;
    onClose: () => void;
    className?: string;
};

export default function Modal({ children, onClose, className }: ModalProps) {
    const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
        onClose();
    };

    const handleModalClick = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    // Lock body scroll and set viewport meta tag for mobile
    useEffect(() => {
        // Save original scroll position before fixing the body
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        // Save original body styles
        const originalOverflow = document.body.style.overflow;
        const originalPosition = document.body.style.position;
        const originalWidth = document.body.style.width;
        const originalTop = document.body.style.top;

        // Lock body scroll - use top offset to maintain visual position
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.top = `-${scrollY}px`;

        // Set viewport meta for mobile browser UI auto-hide
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        const originalContent = viewportMeta?.getAttribute('content');

        if (viewportMeta) {
            viewportMeta.setAttribute(
                'content',
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
            );
        }

        // Cleanup
        return () => {
            // Restore body styles
            document.body.style.overflow = originalOverflow;
            document.body.style.position = originalPosition;
            document.body.style.width = originalWidth;
            document.body.style.top = originalTop;

            // Restore scroll position
            window.scrollTo(scrollX, scrollY);

            if (viewportMeta && originalContent) {
                viewportMeta.setAttribute('content', originalContent);
            }
        };
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-10 backdrop-blur-sm"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
        >
            <div
                className={`bg-white rounded shadow p-2 sm:p-6 animate-fade-in overflow-y-auto max-h-screen ${className ?? "max-w-lg w-full"}`}
                onClick={handleModalClick}
                style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                }}
            >
                {children}
            </div>
        </div>
    );
}
