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
                        <img src="/images/icon.png" className="w-10 h-10 mr-2 rounded-md" />
                        {/* <p className={`text-2xl mt-1 ${isScrolled ? "text-white" : "text-rose-500"}`}>Xaosao</p> */}
                        {isScrolled ? <img src="/images/logo-white.png" className="w-20 h-7 mr-2 rounded-md" /> : <img src="/images/logo-white.png" className="w-20 h-7 mr-2 rounded-md" />}
                    </div>
                    <div className="flex items-center space-x-3">
                        <LanguageSwitcher />
                    </div>
                </div>
            </div>
        </nav>
    )
}
