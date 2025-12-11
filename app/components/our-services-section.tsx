

import { CreditCard, Search, Moon, Wallet } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"

export function OurServicesSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 px-4 bg-primary-foreground transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">

          <div className="w-full lg:w-1/3">
            <div className="space-y-2 text-center lg:text-left">
              <h3 className="font-semibold tracking-wide uppercase text-md">Our Services</h3>
              <h2 className="font-bold bg-gradient-to-r from-rose-400 via-rose-500 to-purple-500 bg-clip-text text-transparent leading-tight transition-all duration-500 transform drop-shadow-lg max-w-4xl mx-auto text-3xl">
                Enjoy Our Special Features
              </h2>
              <div className="pt-2 lg:pt-4 flex justify-center lg:justify-start">
                <Button className="bg-gradient-to-r from-rose-500 to-rose-500 hover:from-rose-600 hover:to-rose-600 text-white px-6 sm:px-8 py-3 sm:py-4 font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 text-sm sm:text-base rounded-lg">
                  Learn more
                </Button>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-2/3">
            <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:hidden">
              <Card className="cursor-pointer bg-white dark:bg-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl group hover:-translate-y-1">
                <CardContent className="p-6 sm:p-8">
                  <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-rose-200 dark:group-hover:bg-rose-800/30 transition-colors">
                    <CreditCard className="w-4 h-4 text-rose-500" />
                  </div>
                  <h3 className="text-md sm:text-lg font-bold transition-colors duration-300">
                    Credit System
                  </h3>
                  <div className="w-10 sm:w-12 h-1 bg-rose-500 mb-3 sm:mb-4 rounded-full"></div>
                  <p className="leading-relaxed text-sm font-medium transition-colors duration-300">
                    Use credits to send gifts and stickers, making your conversations more fun and engaging! Purchase
                    credits easily and express yourself in a unique way.
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer bg-white dark:bg-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl group hover:-translate-y-1">
                <CardContent className="p-6 sm:p-8">
                  <div className="w-14 sm:w-16 h-14 sm:h-16 bg-rose-100 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-rose-200 dark:group-hover:bg-rose-800/30 transition-colors">
                    <Search className="w-6 sm:w-8 h-6 sm:h-8 text-rose-500" />
                  </div>
                  <h3 className="text-md sm:text-lg font-bold mb-2 sm:mb-3 transition-colors duration-300">
                    Advanced Search
                  </h3>
                  <div className="w-10 sm:w-12 h-1 bg-rose-500 mb-3 sm:mb-4 rounded-full"></div>
                  <p className="leading-relaxed text-sm font-medium transition-colors duration-300">
                    Refine your search with multiple filters like age, location, profession, and interests. Easily find
                    profiles that match your preferences for a more personalized dating experience.
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer bg-white dark:bg-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl group hover:-translate-y-1">
                <CardContent className="p-6 sm:p-8">
                  <div className="w-14 sm:w-16 h-14 sm:h-16 bg-rose-100 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-rose-200 dark:group-hover:bg-rose-800/30 transition-colors">
                    <Wallet className="w-6 sm:w-8 h-6 sm:h-8 text-rose-500" />
                  </div>
                  <h3 className="text-md sm:text-lg font-bold mb-2 sm:mb-3 transition-colors duration-300">
                    Payment Gateways
                  </h3>
                  <div className="w-10 sm:w-12 h-1 bg-rose-500 mb-3 sm:mb-4 rounded-full"></div>
                  <p className="leading-relaxed text-sm font-medium transition-colors duration-300">
                    Secure and hassle-free transactions at your fingertips! Users can purchase credits easily using
                    Stripe, PayPal, Razorpay, Coingate and Paystack, ensuring a smooth and flexible payment experience.
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer bg-white dark:bg-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl group hover:-translate-y-1">
                <CardContent className="p-6 sm:p-8">
                  <div className="w-14 sm:w-16 h-14 sm:h-16 bg-rose-100 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-rose-200 dark:group-hover:bg-rose-800/30 transition-colors">
                    <Moon className="w-6 sm:w-8 h-6 sm:h-8 text-rose-500" />
                  </div>
                  <h3 className="text-md sm:text-lg font-bold mb-2 sm:mb-3 transition-colors duration-300">
                    Modern, Dark & Beautiful
                  </h3>
                  <div className="w-10 sm:w-12 h-1 bg-rose-500 mb-3 sm:mb-4 rounded-full"></div>
                  <p className="leading-relaxed text-sm font-medium transition-colors duration-300">
                    Experience the elegance of our Dark & Beautiful theme—where sleek design meets seamless
                    functionality.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="hidden lg:grid lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Card className="cursor-pointer bg-white dark:bg-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl group hover:-translate-y-1">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-start space-x-2">
                      <div className="w-10 h-10 dark:bg-rose-900/20 rounded-md flex items-center justify-center group-hover:bg-rose-200 transition-colors">
                        <CreditCard className="w-4 h-4 text-rose-500" />
                      </div>
                      <h3 className="text-md sm:text-lg font-bold transition-colors duration-300">
                        Credit System
                      </h3>
                    </div>
                    <p className="leading-relaxed text-sm font-medium transition-colors duration-300">
                      Use credits to send gifts and stickers, making your conversations more fun and engaging! Purchase
                      credits easily and express yourself in a unique way.
                    </p>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer bg-white dark:bg-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl group hover:-translate-y-1">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-start space-x-2">
                      <div className="w-10 h-10 dark:bg-rose-900/20 rounded-md flex items-center justify-center group-hover:bg-rose-200 transition-colors">
                        <Wallet className="w-4 h-4 text-rose-500" />
                      </div>
                      <h3 className="text-md sm:text-lg font-bold transition-colors duration-300">
                        Payment Gateways
                      </h3>
                    </div>
                    <p className="leading-relaxed text-sm font-medium transition-colors duration-300">
                      Secure and hassle-free transactions at your fingertips! Users can purchase credits easily using
                      Stripe, PayPal, Razorpay, Coingate and Paystack, ensuring a smooth and flexible payment
                      experience.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8 mt-32">
                <Card className="cursor-pointer bg-white dark:bg-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl group hover:-translate-y-1">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-start space-x-2">
                      <div className="w-10 h-10 dark:bg-rose-900/20 rounded-md flex items-center justify-center group-hover:bg-rose-200 transition-colors">
                        <Wallet className="w-4 h-4 text-rose-500" />
                      </div>
                      <h3 className="text-md sm:text-lg font-bold transition-colors duration-300">
                        Advanced Search
                      </h3>
                    </div>
                    <p className="leading-relaxed text-sm font-medium transition-colors duration-300">
                      Refine your search with multiple filters like age, location, profession, and interests. Easily
                      find profiles that match your preferences for a more personalized dating experience.
                    </p>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer bg-white dark:bg-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl group hover:-translate-y-1">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-start space-x-2">
                      <div className="w-10 h-10 dark:bg-rose-900/20 rounded-md flex items-center justify-center group-hover:bg-rose-200 transition-colors">
                        <Wallet className="w-4 h-4 text-rose-500" />
                      </div>
                      <h3 className="text-md sm:text-lg font-bold transition-colors duration-300">
                        Modern, Dark & Beautiful
                      </h3>
                    </div>
                    <p className="leading-relaxed text-sm font-medium transition-colors duration-300">
                      Experience the elegance of our Dark & Beautiful theme—where sleek design meets seamless
                      functionality.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
