import { Link } from "react-router"
import { useTranslation } from "react-i18next"
import { Facebook, MessageCircle, PhoneForwarded, Youtube } from "lucide-react"

const PHONE_NUMBER = "8562093033918"

export function Footer() {
  const { t } = useTranslation()

  const handleWhatsAppClick = () => {
    window.open(`https://wa.me/${PHONE_NUMBER}`, "_blank")
  }

  const handlePhoneCall = () => {
    window.open(`tel:+${PHONE_NUMBER}`, "_self")
  }

  return (
    <footer className="relative bg-black dark:bg-[#1A1B3A] text-white py-10 px-4 overflow-hidden transition-colors duration-300">
      <div className="absolute inset-0 z-0">
        <div
          className="w-full h-full bg-cover bg-center bg-no-repeat opacity-30"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=1200&h=400&fit=crop&crop=center')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/80 to-black/90" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-12 lg:gap-16">
          <div className="flex items-start justify-center space-x-2 cursor-pointer">
            <img
              src="/images/icon.png"
              alt="XaoSao Icon"
              className="w-10 h-10 rounded-md"
              style={{ width: '40px', height: '40px', maxWidth: '40px', maxHeight: '40px' }}
            />
            <img
              src="/images/logo-white.png"
              alt="XaoSao Logo"
              className="w-20 h-7 mr-2 rounded-md"
              style={{ width: '80px', height: '28px', maxWidth: '80px', maxHeight: '28px' }}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-4">
              <h3 className="text-lg text-white">{t('footer.tagline')}</h3>
              <div className="w-12 sm:w-16 h-0.5 bg-rose-500 rounded-full"></div>
            </div>
            <p className="text-gray-300 leading-relaxed text-sm max-w-md">
              {t('footer.description')}
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-center justify-center space-x-2 cursor-pointer">
            <div className="mb-4">
              <h3 className="text-lg text-white">{t('footer.socialLinks')}</h3>
              <div className="w-12 sm:w-16 h-0.5 bg-rose-500 mb-4 sm:mb-4 rounded-full"></div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <Link
                to="https://www.facebook.com/profile.php?id=61585969554361"
                target="_blank"
                className="flex items-center space-x-3 text-gray-300 hover:text-rose-400 transition-colors font-medium text-sm"
              >
                <Facebook className="w-4 h-4 flex-shrink-0" />
                <span>Facebook</span>
              </Link>
              <Link
                to="https://www.youtube.com/@xaosao-%E0%BB%80%E0%BA%8A%E0%BA%BB%E0%BB%88%E0%BA%B2%E0%BA%AA%E0%BA%B2%E0%BA%A7"
                target="_blank"
                className="flex items-center space-x-3 text-gray-300 hover:text-rose-400 transition-colors font-medium text-sm"
              >
                <Youtube className="w-4 h-4 flex-shrink-0" />
                <span>Youtube</span>
              </Link>
              <button
                onClick={handleWhatsAppClick}
                className="flex items-center space-x-3 text-gray-300 hover:text-green-400 transition-colors font-medium text-sm cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span>{t('footer.whatsapp')}</span>
              </button>
              <button
                onClick={handlePhoneCall}
                className="flex items-center space-x-3 text-gray-300 hover:text-blue-400 transition-colors font-medium text-sm cursor-pointer"
              >
                <PhoneForwarded className="w-4 h-4 flex-shrink-0" />
                <span>{t('footer.phoneCall')}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-12 sm:mt-16 pt-6 sm:pt-8 text-center">
          <p className="text-gray-400 font-medium text-sm">{t('footer.copyright')}</p>
        </div>
      </div>
    </footer>
  )
}
