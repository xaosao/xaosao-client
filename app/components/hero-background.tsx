import { useState, useEffect } from "react"

const backgroundImages = [
  {
    src: "https://images.pexels.com/photos/5911151/pexels-photo-5911151.jpeg?w=1920&h=1080&fit=crop&crop=center",
    alt: "Couple with city lights at night",
  },
  {
    src: "https://images.pexels.com/photos/269583/pexels-photo-269583.jpeg?w=1920&h=1080&fit=crop&crop=center",
    alt: "Couple with city lights at night",
  },
  {
    src: "https://images.pexels.com/photos/348520/pexels-photo-348520.jpeg?w=1920&h=1080&fit=crop&crop=center",
    alt: "Couple with city lights at night",
  },
]

export function HeroBackground() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Ensure component is mounted before starting transitions
    setMounted(true)

    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length)
    }, 50000)

    return () => clearInterval(interval)
  }, [])

  // Always render with index 0 initially for SSR consistency
  return (
    <div className="absolute inset-0">
      {backgroundImages.map((image, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ${index === currentImageIndex ? "opacity-100" : "opacity-0"
            }`}
        >
          <img
            src={
              image.src ||
              "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=1920&h=1080&fit=crop&crop=center"
            }
            alt={image.alt}
            className="object-cover w-full h-full absolute inset-0"
            loading="lazy"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60"></div>
    </div>
  )
}
