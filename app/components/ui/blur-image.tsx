import React from "react";

interface BlurImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  isHidden?: boolean;
}

/**
 * Image component that applies a dark blur effect when `isHidden` is true.
 * Used for admin-hidden profile/gallery images.
 *
 * Defaults to native lazy-loading + async decoding — pages render dozens of
 * these; without lazy-loading a matches/discover screen pulls 20+ MB of
 * BunnyCDN gallery photos on first paint. Callers rendering above-the-fold
 * hero images can override with loading="eager".
 */
export function BlurImage({ isHidden, className, style, loading, decoding, ...props }: BlurImageProps) {
  const loadingAttr = loading ?? "lazy";
  const decodingAttr = decoding ?? "async";

  if (!isHidden) {
    return <img className={className} style={style} loading={loadingAttr} decoding={decodingAttr} {...props} />;
  }

  return (
    <img
      className={`${className || ""}`}
      style={{
        ...style,
        filter: "blur(8px) brightness(0.7)",
        WebkitFilter: "blur(8px) brightness(0.7)",
      }}
      loading={loadingAttr}
      decoding={decodingAttr}
      {...props}
    />
  );
}
