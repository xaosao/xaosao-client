

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "~/components/ui/button"

const testimonials = [
  {
    id: 1,
    name: "Isabella",
    location: "USA",
    image: "https://images.pexels.com/photos/371160/pexels-photo-371160.jpeg?w=400&h=400&fit=crop&crop=face",
    quote:
      "I was skeptical at first, but the perfect match really works! I found someone who shares my interests and values. So happy I joined!",
  },
  {
    id: 2,
    name: "Emma",
    location: "Canada",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
    quote:
      "Amazing platform! The matching algorithm is incredibly accurate. I met my soulmate within just two weeks of joining.",
  },
  {
    id: 3,
    name: "Sophia",
    location: "UK",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face",
    quote:
      "The best dating experience I've ever had. The community is genuine and the connections are meaningful. Highly recommend!",
  },
]

export function TestimonialSection() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  const currentTestimonial = testimonials[currentIndex]

  return (
    <section>
      <div className="bg-background py-8 text-center">
        <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent mb-6 font-serif">
          A Match Made Perfectly!
        </h2>
        <p className="text-lg max-w-3xl mx-auto px-4">
          Experience meaningful connections with like-minded individuals in a safe space.
        </p>
      </div>

      <div
        className="relative min-h-[500px] flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('/images/testimonal.jpg')`,
          backgroundAttachment: "fixed",
        }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevTestimonial}
              className="text-white hover:bg-white/10 w-12 h-12 rounded-full border border-white/20"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            <div className="flex items-center gap-12 max-w-4xl mx-auto">
              <div className="flex-shrink-0">
                <div className="w-80 h-96 rounded-3xl overflow-hidden shadow-2xl">
                  <img
                    src={currentTestimonial.image}
                    alt={currentTestimonial.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="text-white max-w-lg">
                <div className="text-6xl text-white/30 mb-4 font-serif">"</div>
                <blockquote className="text-lg md:text-2xl leading-relaxed mb-8 font-light">
                  {currentTestimonial.quote}
                </blockquote>
                <cite className="text-lg font-medium not-italic">
                  —{currentTestimonial.name} from {currentTestimonial.location}
                </cite>
                <div className="text-6xl text-white/30 mt-4 font-serif">"</div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={nextTestimonial}
              className="text-white hover:bg-white/10 w-12 h-12 rounded-full border border-white/20"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
