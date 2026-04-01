import React from "react";

interface BlurImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  isHidden?: boolean;
}

/**
 * Image component that applies a dark blur effect when `isHidden` is true.
 * Used for admin-hidden profile/gallery images.
 */
export function BlurImage({ isHidden, className, style, ...props }: BlurImageProps) {
  if (!isHidden) {
    return <img className={className} style={style} {...props} />;
  }

  return (
    <img
      className={`${className || ""}`}
      style={{
        ...style,
        filter: "blur(8px) brightness(0.7)",
        WebkitFilter: "blur(8px) brightness(0.7)",
      }}
      {...props}
    />
  );
}
