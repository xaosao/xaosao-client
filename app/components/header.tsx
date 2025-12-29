import { useNavigate } from "react-router"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"

// components
import { Button } from "./ui/button"
import LanguageSwitcher from "./LanguageSwitcher"

export function Header() {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const [isScrolled, setIsScrolled] = useState(false)
    const [hasModelToken, setHasModelToken] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY
            setIsScrolled(scrollTop > 100)
        }

        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    useEffect(() => {
        // Check for model auth token
        const modelToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('whoxa_model_auth_token='))
        setHasModelToken(!!modelToken)
    }, [])

    return (
        // <nav
        //     className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled
        //         ? "bg-[var(--background)]/95 backdrop-blur-md border-b border-[var(--border)] shadow-sm"
        //         : "bg-transparent"
        //         }`}
        // >
        <nav
            className={`fixed top-0 w-full z-50 transition-all duration-300 bg-transparent`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center space-x-2 ">
                        <img src="/images/icon.png" className="w-12 h-12" />
                        <p className="hidden sm:block text-2xl -ml-2 mt-1 text-white">Xaosao</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <LanguageSwitcher />
                        <Button
                            size="sm"
                            onClick={() => navigate(hasModelToken ? "/model" : "/model-auth/login")}
                            className="cursor-pointer border border-rose-500 bg-white text-rose-500 hover:bg-rose-500 hover:text-white px-4 font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 rounded-md"
                        >
                            {hasModelToken ? t('header.myAccount') : t('header.companionLogin')}
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    )
}
