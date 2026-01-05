import type React from "react"
import { Button } from "~/components/ui/button"
import { useState, useRef, useEffect } from "react"

export default function VerifyOTPPage() {
    const [otp, setOtp] = useState(["", "", "", "", "", ""])
    const [timeLeft, setTimeLeft] = useState(60)
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    const backgroundImages = [
        "https://images.pexels.com/photos/7534073/pexels-photo-7534073.jpeg",
        "https://images.pexels.com/photos/4241304/pexels-photo-4241304.jpeg",
    ]

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length)
        }, 5000)
        return () => clearInterval(interval)
    }, [backgroundImages.length])

    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [timeLeft])

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) return

        const newOtp = [...otp]
        newOtp[index] = value
        setOtp(newOtp)

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        console.log("OTP:", otp.join(""))
    }

    const handleResend = () => {
        setTimeLeft(60)
        console.log("Resending OTP...")
    }

    return (
        <div className="fullscreen safe-area relative overflow-hidden">
            <div className="absolute inset-0">
                {backgroundImages.map((image, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-1000 ${index === currentImageIndex ? "opacity-100" : "opacity-0"
                            }`}
                        style={{
                            backgroundImage: `url(${image})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                        }}
                    />
                ))}
                {/* Light overlay for better text readability */}
                {/* <div className="absolute inset-0 bg-black/10" /> */}
            </div>


            <div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-11/12 h-11/12
                            bg-black/50 backdrop-blur-md shadow-2xl p-4 sm:p-8 flex flex-col justify-center rounded-lg z-20
                            lg:top-0 lg:right-0 lg:left-auto lg:translate-x-0 lg:translate-y-0 lg:w-2/5 lg:h-full lg:rounded-none">

                <div className="space-y-6">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-rose-500 mb-2">
                            Almost There!
                        </h1>
                        <p className="text-gray-400">Enter the 6-digit code sent to your phone number to verify your identity</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="flex justify-center space-x-1 sm:space-x-3">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => (inputRefs.current[index] = el)}
                                    type="text"
                                    // inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className="w-12 h-12 text-center text-lg font-semibold bg-gray-800/50 border-2 border-gray-600 text-white rounded-lg focus:border-rose-500 focus:ring-2 focus:ring-pink-500/20 focus:outline-none transition-colors"
                                />
                            ))}
                        </div>

                        <Button
                            type="submit"
                            className="text-xs uppercase w-full bg-rose-500 text-white py-3 font-medium shadow-lg hover:shadow-rose-500/25 transition-all duration-300"
                            disabled={otp.some((digit) => !digit)}
                        >
                            Verify Code
                        </Button>
                    </form>

                    <div className="text-center">
                        {timeLeft > 0 ? (
                            <p className="text-sm text-gray-400">Resend code in {timeLeft}s</p>
                        ) : (
                            <button onClick={handleResend} className="cursor-pointer text-sm text-rose-500 hover:text-rose-600 font-medium">
                                Resend Code
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
