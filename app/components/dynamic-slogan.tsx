import { useState, useEffect } from "react"

const slogans = [
    "Find love — not just a date.",
    "Your perfect match is waiting!",
    "Love is just a swipe away.",
    "Connecting hearts, creating magic!",
    "Where souls meet and hearts unite.",
    "Discover your happily-ever-after.",
    "Every love story starts here.",
    "Find your person, find your peace.",
];

export function DynamicSlogan() {
    const [currentSlogan, setCurrentSlogan] = useState(0)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // Ensure component is mounted before starting transitions
        setMounted(true)

        const interval = setInterval(() => {
            setCurrentSlogan((prev) => (prev + 1) % slogans.length)
        }, 20000)

        return () => clearInterval(interval)
    }, [])

    // Always render the same initial content for SSR consistency
    return (
        <h2 className="text-3xl sm:text-10xl font-bold bg-gradient-to-r from-white to-white bg-clip-text text-transparent mb-2 font-serif uppercase">
            {slogans[currentSlogan]}
        </h2>
    )
}
