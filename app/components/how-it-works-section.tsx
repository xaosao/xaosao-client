import { UserPlus, Search, User, MessageCircle } from "lucide-react"

export function HowItWorksSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 px-4 bg-gray-50 dark:bg-[var(--dark-navy)] overflow-hidden transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-2">
          <h3 className="font-semibold tracking-wide uppercase text-md">
            How It Works
          </h3>
          <h2 className="text-2xl sm:text-7xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent mb-6 font-serif">
            Discover, Connect, Grow: A Guide to Creating Meaningful Bonds
          </h2>
        </div>

        <div className="hidden lg:block relative max-w-6xl mx-auto">
          <div className="flex justify-center items-center">
            <div className="relative">
              <div className="relative z-10 w-56 h-[450px] bg-black rounded-[3rem] p-2 shadow-2xl">
                <div className="w-full h-full bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-900/30 dark:to-pink-800/30 rounded-[2.5rem] overflow-hidden relative">
                  <div className="absolute inset-4 flex items-center justify-center">
                    <img
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-EbfevOCsOfKga5nr6N4PXCPMzaNxXu.png"
                      alt="Happy couple in dating app"
                      width={200}
                      height={380}
                      className="rounded-2xl object-cover"
                    // priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute top-0 left-0 max-w-xs">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center shadow-xl flex-shrink-0">
                <UserPlus className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold transition-colors duration-300 text-3xl">
                  Register
                </h3>
                <p className="text-sm leading-relaxed font-medium transition-colors duration-300">
                  Sign up in just a few simple steps and become part of a vibrant community looking for meaningful
                  connections.
                </p>
              </div>
            </div>
          </div>

          <div className="absolute top-0 right-0 max-w-xs">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-xl flex-shrink-0">
                <Search className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold transition-colors duration-300 text-3xl">
                  Find The Match
                </h3>
                <p className="text-sm leading-relaxed font-medium transition-colors duration-300">
                  Explore potential matches based on compatibility, shared interests, and preferences.
                </p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 max-w-xs">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center shadow-xl flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold transition-colors duration-300 tracking-normal text-3xl">
                  Create a Profile
                </h3>
                <p className="text-sm leading-relaxed font-medium transition-colors duration-300">
                  Showcase your personality by adding photos and sharing your interests to help others get to know you
                  better.
                </p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 right-0 max-w-xs">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center shadow-xl flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold transition-colors duration-300 text-3xl">
                  Initiate Conversation
                </h3>
                <p className="text-sm leading-relaxed font-medium transition-colors duration-300">
                  Take the first step by sending a message and start building a connection that could turn into
                  something special!
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:hidden">
          <div className="hidden sm:flex justify-center mb-12">
            <div className="relative">
              <div className="w-48 sm:w-56 h-[380px] sm:h-[450px] bg-black rounded-[3rem] p-2 shadow-2xl">
                <div className="w-full h-full bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-900/30 dark:to-pink-800/30 rounded-[2.5rem] overflow-hidden relative">
                  <div className="absolute inset-4 flex items-center justify-center">
                    <img
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-EbfevOCsOfKga5nr6N4PXCPMzaNxXu.png"
                      alt="Happy couple in dating app"
                      width={180}
                      height={340}
                      className="rounded-2xl object-cover"
                    // priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            <div className="flex items-start space-x-4">
              <div className="w-14 sm:w-16 h-14 sm:h-16 bg-pink-500 rounded-full flex items-center justify-center shadow-xl flex-shrink-0">
                <UserPlus className="w-6 sm:w-8 h-6 sm:h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 transition-colors duration-300">
                  Register
                </h3>
                <p className="text-sm leading-relaxed font-medium transition-colors duration-300">
                  Sign up in just a few simple steps and become part of a vibrant community looking for meaningful
                  connections.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-14 sm:w-16 h-14 sm:h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-xl flex-shrink-0">
                <Search className="w-6 sm:w-8 h-6 sm:h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 transition-colors duration-300">
                  Find The Match
                </h3>
                <p className="text-sm leading-relaxed font-medium transition-colors duration-300">
                  Explore potential matches based on compatibility, shared interests, and preferences.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-14 sm:w-16 h-14 sm:h-16 bg-teal-500 rounded-2xl flex items-center justify-center shadow-xl flex-shrink-0">
                <User className="w-6 sm:w-8 h-6 sm:h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 transition-colors duration-300">
                  Create a Profile
                </h3>
                <p className="text-sm leading-relaxed font-medium transition-colors duration-300">
                  Showcase your personality by adding photos and sharing your interests to help others get to know you
                  better.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-14 sm:w-16 h-14 sm:h-16 bg-purple-500 rounded-2xl flex items-center justify-center shadow-xl flex-shrink-0">
                <MessageCircle className="w-6 sm:w-8 h-6 sm:h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 transition-colors duration-300">
                  Initiate Conversation
                </h3>
                <p className="text-sm leading-relaxed font-medium transition-colors duration-300">
                  Take the first step by sending a message and start building a connection that could turn into
                  something special!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
