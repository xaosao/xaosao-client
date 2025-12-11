import { ArrowRight, Heart, LogIn, User } from "lucide-react";
import type { Route } from "./+types/home";

// components
import { Header } from "~/components/header";
// import { Footer } from "~/components/footer";
import { Button } from "~/components/ui/button";
import { DynamicSlogan } from "~/components/dynamic-slogan";
import { HeroBackground } from "~/components/hero-background";
// import { AboutUsSection } from "~/components/about-us-section";
// import { MatchingSection } from "~/components/matching-section";
// import { TestimonialSection } from "~/components/testimonial-section";
// import { HowItWorksSection } from "~/components/how-it-works-section";
// import { OurServicesSection } from "~/components/our-services-section";
import { useNavigate } from "react-router";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "XaoSao Client" },
    { name: "description", content: "Welcome to XaoSao!" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: "Hello from Vercel" };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate()
  return (
    <div className="fullscreen safe-area min-h-screen bg-background text-foreground transition-colors duration-300 font-serif">
      <Header />

      <section className="relative min-h-screen flex items-center justify-center">
        <HeroBackground />

        <div className="w-full relative z-10 px-2 mx-auto text-center lg:px-8 leading-3 space-y-6">
          <DynamicSlogan />

          <p className="text-white max-w-4xl mx-auto leading-relaxed px-4 text-sm sm:text-md uppercase">
            Join millions of people finding meaningful connections and lasting relationships.
          </p>

          <div className="flex gap-4 justify-center items-center max-w-md mx-auto">
            <Button
              size="lg"
              className="cursor-pointer w-auto bg-rose-500 hover:bg-rose-600 text-white px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium shadow-xl hover:shadow-pink-500/25 transition-all duration-300 transform hover:scale-105 border-0 rounded-lg"
              onClick={() => navigate("/register")}
            >
              <User className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce" />
              Get Started
            </Button>
            <Button
              size="lg"
              className="flex sm:hidden cursor-pointer w-auto border-border px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium shadow-xl hover:shadow-pink-500/25 transition-all duration-300 transform hover:scale-105 border-0 rounded-lg"
              onClick={() => navigate("/login")}
            >
              <LogIn className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              Login
            </Button>
          </div>

          <div className="mt-6 sm:mt-8 flex items-center justify-around sm:justify-center space-x-2 sm:space-x-6 text-sm sm:text-md text-white lowercase sm:uppercase">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
              <span className="font-light">Free to join</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
              <span className="font-light">Verified profiles</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
              <span className="font-light">Safe & secure</span>
            </div>
          </div>
        </div>
      </section>

      {/* <div className="hidden sm:block"> */}
      {/* <div >
        <MatchingSection />

        <AboutUsSection />

        <HowItWorksSection />

        <OurServicesSection />

        <TestimonialSection />

        <Footer />
      </div> */}
    </div>
  )
}
