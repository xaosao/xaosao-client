import { Link } from "react-router"
import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react"

export function Footer() {
  return (
    <footer className="relative bg-black dark:bg-[#1A1B3A] text-white py-10 sm:py-20 px-4 overflow-hidden transition-colors duration-300">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 lg:gap-16">
          <div className="flex items-center justify-center space-x-3 mb-4 sm:mb-4">
            <span className="text-4xl font-serif font-medium text-white tracking-wide">XaoSao</span>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Treat Me Beautiful</h3>
              <div className="w-12 sm:w-16 h-0.5 bg-rose-500 rounded-full"></div>
            </div>
            <p className="text-gray-300 leading-relaxed font-medium text-sm max-w-md">
              Discover meaningful connections with personalized matches, a safe platform, and a global community. Your
              journey to love starts here.
            </p>
          </div>

          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Quick Links</h3>
              <div className="w-12 sm:w-16 h-0.5 bg-rose-500 rounded-full"></div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <Link
                to="#"
                className="block text-gray-300 hover:text-rose transition-colors font-medium text-sm"
              >
                Features
              </Link>
              <Link
                to="#"
                className="block text-gray-300 hover:text-rose transition-colors font-medium text-sm"
              >
                FAQ
              </Link>
              <Link
                to="#"
                className="block text-gray-300 hover:text-rose transition-colors font-medium text-sm"
              >
                Contact us
              </Link>
              <Link
                to="#"
                className="block text-gray-300 hover:text-rose transition-colors font-medium text-sm"
              >
                Login
              </Link>
              <Link
                to="#"
                className="block text-gray-300 hover:text-rose transition-colors font-medium text-sm"
              >
                Register
              </Link>
            </div>
          </div>

          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Social Links</h3>
              <div className="w-12 sm:w-16 h-0.5 bg-rose-500 mb-4 sm:mb-4 rounded-full"></div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <Link
                to="#"
                className="flex items-center space-x-3 text-gray-300 hover:text-rose transition-colors font-medium text-sm"
              >
                <Facebook className="w-4 h-4 flex-shrink-0" />
                <span>Facebook</span>
              </Link>
              <Link
                to="#"
                className="flex items-center space-x-3 text-gray-300 hover:text-rose transition-colors font-medium text-sm"
              >
                <Instagram className="w-4 h-4 flex-shrink-0" />
                <span>Instagram</span>
              </Link>
              <Link
                to="#"
                className="flex items-center space-x-3 text-gray-300 hover:text-rose transition-colors font-medium text-sm"
              >
                <Linkedin className="w-4 h-4 flex-shrink-0" />
                <span>LinkedIn</span>
              </Link>
              <Link
                to="#"
                className="flex items-center space-x-3 text-gray-300 hover:text-rose transition-colors font-medium text-sm"
              >
                <Twitter className="w-4 h-4 flex-shrink-0" />
                <span>Twitter</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-12 sm:mt-16 pt-6 sm:pt-8 text-center">
          <p className="text-gray-400 font-medium text-sm">Copyright © Xaosao 2025</p>
        </div>
      </div>
    </footer>
  )
}
