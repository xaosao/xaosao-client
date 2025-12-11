import { Heart } from "lucide-react"
import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router"

// components
import { Button } from "./ui/button"
// import { ThemeSwitcher } from "./theme-switcher"
// import LanguageSwitcher from "./LanguageSwitcher"

export function Header() {
    const navigate = useNavigate()
    const [isScrolled, setIsScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY
            setIsScrolled(scrollTop > 100)
        }

        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <nav
            className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled
                ? "bg-[var(--background)]/95 backdrop-blur-md border-b border-[var(--border)] shadow-sm"
                : "bg-transparent"
                }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center space-x-2">
                        <img src="/images/logo-pink.png" className="w-35 h-12" />
                    </div>

                    {/* <div className="hidden md:flex items-center space-x-8 uppercase">
                        <Link
                            to="#about"
                            className={`transition-colors font-medium text-xs ${isScrolled
                                ? "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                : "text-white/90 hover:text-white"
                                }`}
                        >
                            About Us
                        </Link>
                        <Link
                            to="#how-it-works"
                            className={`transition-colors font-medium text-xs ${isScrolled
                                ? "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                : "text-white/90 hover:text-white"
                                }`}
                        >
                            How It Works
                        </Link>
                        <Link
                            to="#services"
                            className={`transition-colors font-medium text-xs ${isScrolled
                                ? "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                : "text-white/90 hover:text-white"
                                }`}
                        >
                            Services
                        </Link>
                    </div> */}

                    <div className="flex items-center space-x-3">
                        {/* <LanguageSwitcher /> */}
                        {/* <ThemeSwitcher /> */}
                        <Button
                            size="sm"
                            onClick={() => navigate("/login")}
                            className="cursor-pointer hidden sm:block bg-rose-500 hover:bg-rose-600 text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                        >
                            Login
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => navigate("/model-auth/login")}
                            className="cursor-pointer border border-rose-500 bg-white text-rose-500 hover:bg-rose-500 hover:text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                        >
                            Companion Login
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    )
}
