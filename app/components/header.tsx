import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import LanguageSwitcher from "./LanguageSwitcher"

export function Header() {
    const navigate = useNavigate()
    const [isScrolled, setIsScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10)
        }

        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <nav
            className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? "bg-rose-500 shadow-md" : "bg-transparent"}`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate("/")}>
                        <img
                            src="/images/icon.png"
                            alt="XaoSao Icon"
                            className="w-10 h-10 mr-2 rounded-md"
                            style={{ width: '40px', height: '40px', maxWidth: '40px', maxHeight: '40px' }}
                        />
                        <img
                            src="/images/logo-white.png"
                            alt="XaoSao Logo"
                            className="w-20 h-7 mr-2 rounded-md"
                            style={{ width: '80px', height: '28px', maxWidth: '80px', maxHeight: '28px' }}
                        />
                    </div>
                    <div className="flex items-center space-x-3">
                        <LanguageSwitcher />
                    </div>
                </div>
            </div>
        </nav>
    )
}
