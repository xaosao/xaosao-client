import { Heart } from "lucide-react"

export function AboutUsSection() {
  return (
    <section className="py-10 sm:py-24 px-4 bg-primary-foreground overflow-hidden transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-2">
            <div className="space-y-2">
              <h3 className="font-semibold tracking-wide uppercase text-md">About us</h3>
              <h2 className="text-2xl sm:text-7xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent mb-6 font-serif">
                Love Made Simple, Connections Made Real.
              </h2>
            </div>
            <p className="text-primary text-lg leading-relaxed max-w-2xl font-normal transition-colors duration-300">
              Finding love should be simple, secure, and exciting. Our platform is designed to connect like-minded
              individuals, fostering genuine relationships that last. With advanced search, user-friendly features, and
              a commitment to privacy, we make your dating journey effortless. Whether you're looking for friendship,
              romance, or a lifelong partner, we're here to help you every step of the way. Start exploring and let
              meaningful connections unfold!
            </p>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-80 h-80 bg-pink-100 dark:bg-pink-900/20 rounded-full opacity-60 transition-colors duration-300"></div>
              <div className="absolute w-60 h-60 bg-pink-200 dark:bg-pink-800/20 rounded-full opacity-40 top-8 right-8 transition-colors duration-300"></div>
              <div className="absolute w-40 h-40 bg-pink-300 dark:bg-pink-700/20 rounded-full opacity-30 bottom-12 left-12 transition-colors duration-300"></div>
            </div>
            <div className="relative z-10">
              <img
                src="https://images.pexels.com/photos/9883888/pexels-photo-9883888.jpeg?w=400&h=400&fit=crop&crop=face"
                alt="Happy couple sharing a romantic moment"
                width={500}
                height={400}
                // priority
                className="rounded-lg"
              />
            </div>

            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-16 right-12 animate-float">
                <Heart className="w-8 h-8 text-pink-400 fill-current opacity-80" />
              </div>
              <div className="absolute top-32 right-4 animate-float-delayed">
                <Heart className="w-6 h-6 text-red-400 fill-current opacity-70" />
              </div>
              <div className="absolute bottom-24 right-16 animate-float-slow">
                <Heart className="w-7 h-7 text-pink-500 fill-current opacity-75" />
              </div>

              <div className="absolute top-24 left-8 animate-float-delayed">
                <Heart className="w-5 h-5 text-red-300 fill-current opacity-60" />
              </div>
              <div className="absolute bottom-32 left-4 animate-float">
                <Heart className="w-6 h-6 text-pink-300 fill-current opacity-65" />
              </div>
              <div className="absolute top-48 right-2 animate-float-slow">
                <Heart className="w-4 h-4 text-red-400 fill-current opacity-70" />
              </div>
              <div className="absolute top-8 left-16 animate-float">
                <Heart className="w-3 h-3 text-pink-400 fill-current opacity-50" />
              </div>
              <div className="absolute bottom-16 right-8 animate-float-delayed">
                <Heart className="w-4 h-4 text-red-300 fill-current opacity-55" />
              </div>
              <div className="absolute top-40 left-2 animate-float-slow">
                <Heart className="w-3 h-3 text-pink-500 fill-current opacity-60" />
              </div>
              <div className="absolute bottom-8 left-12 animate-float">
                <Heart className="w-5 h-5 text-red-400 fill-current opacity-65" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
