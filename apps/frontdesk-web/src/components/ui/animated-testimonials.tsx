"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, Star } from "lucide-react"

export interface Testimonial {
  quote: string
  name: string
  business: string
  stars: number
}

interface AnimatedTestimonialsProps {
  testimonials: Testimonial[]
  autoplay?: boolean
  interval?: number
}

export function AnimatedTestimonials({
  testimonials,
  autoplay = true,
  interval = 5000,
}: AnimatedTestimonialsProps) {
  const [active, setActive] = useState(0)

  const handleNext = useCallback(() => {
    setActive((prev) => (prev + 1) % testimonials.length)
  }, [testimonials.length])

  const handlePrev = useCallback(() => {
    setActive((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }, [testimonials.length])

  useEffect(() => {
    if (!autoplay) return
    const timer = setInterval(handleNext, interval)
    return () => clearInterval(timer)
  }, [autoplay, handleNext, interval])

  const current = testimonials[active]
  const words = current.quote.split(" ")

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">

        {/* Left — stacked cards */}
        <div className="relative h-72 md:h-80">
          {testimonials.map((t, i) => {
            const offset = i - active
            const absOffset = Math.abs(offset)
            return (
              <motion.div
                key={i}
                onClick={() => setActive(i)}
                animate={{
                  opacity: i === active ? 1 : Math.max(0, 0.6 - absOffset * 0.15),
                  scale: i === active ? 1 : 1 - absOffset * 0.04,
                  rotate: i === active ? 0 : offset * 2.5,
                  y: i === active ? 0 : offset * 8,
                  zIndex: i === active ? 20 : testimonials.length - absOffset,
                }}
                transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-muted p-8 shadow-sm"
              >
                {/* Stars */}
                <div className="flex gap-1">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="size-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                {/* Avatar */}
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary ring-4 ring-primary/20">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>

                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.business}</p>
                </div>

                {/* Short quote preview on inactive cards */}
                {i !== active && (
                  <p className="line-clamp-2 text-center text-xs text-muted-foreground/70 italic">
                    "{t.quote.slice(0, 60)}…"
                  </p>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Right — animated quote */}
        <div className="flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Opening quote mark */}
              <div className="mb-4 text-6xl leading-none text-primary/20 font-serif select-none">"</div>

              {/* Animated word-by-word reveal */}
              <p className="text-xl font-medium leading-relaxed text-foreground md:text-2xl">
                {words.map((word, i) => (
                  <motion.span
                    key={`${active}-${i}`}
                    initial={{ opacity: 0, filter: "blur(6px)", y: 4 }}
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: i * 0.018,
                      ease: "easeOut",
                    }}
                    className="mr-[0.25em] inline-block"
                  >
                    {word}
                  </motion.span>
                ))}
              </p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: words.length * 0.018 + 0.1 }}
                className="mt-6"
              >
                <p className="font-semibold text-foreground">{current.name}</p>
                <p className="text-sm text-muted-foreground">{current.business}</p>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={handlePrev}
              aria-label="Previous testimonial"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              onClick={handleNext}
              aria-label="Next testimonial"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowRight className="size-4" />
            </button>

            {/* Progress dots */}
            <div className="ml-auto flex gap-1.5">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  aria-label={`Go to testimonial ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === active ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
