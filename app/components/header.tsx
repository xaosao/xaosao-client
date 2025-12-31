// components
import LanguageSwitcher from "./LanguageSwitcher"

export function Header() {

    return (
        <nav
            className={`fixed top-0 w-full z-50 transition-all duration-300 bg-transparent`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center space-x-2 ">
                        <img src="/images/icon.png" className="w-10 h-10 mr-2 rounded-md" />
                        <p className="hidden sm:block text-2xl mt-1 text-white">Xaosao</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <LanguageSwitcher />
                    </div>
                </div>
            </div>
        </nav>
    )
}
