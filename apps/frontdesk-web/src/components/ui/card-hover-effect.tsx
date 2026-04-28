"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface HoverItem {
  title: string
  description: string
  link: string
  category?: string
  thumbnail?: string
  gradient?: string
}

export function HoverEffect({
  items,
  className,
}: {
  items: HoverItem[]
  className?: string
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {items.map((item, idx) => (
        <a
          key={item.link}
          href={item.link}
          className="group relative block h-full w-full p-1"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Shared animated background highlight */}
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.span
                className="absolute inset-0 block rounded-2xl bg-primary/10"
                layoutId="industryHoverBg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.1 } }}
              />
            )}
          </AnimatePresence>

          {/* Industry card */}
          <div className="relative h-52 overflow-hidden rounded-xl border border-border transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-lg group-hover:shadow-primary/10">
            {/* Category gradient fallback */}
            <div className={cn("absolute inset-0 bg-gradient-to-br", item.gradient ?? "from-neutral-800 to-neutral-600")} />

            {/* Real photo */}
            {item.thumbnail && (
              <img
                src={item.thumbnail}
                alt={item.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => { e.currentTarget.style.display = "none" }}
              />
            )}

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/30" />

            {/* Text */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-sm font-bold text-white">{item.title}</h3>
              <p className="mt-1 max-h-0 overflow-hidden text-xs leading-relaxed text-white/80 transition-all duration-300 group-hover:max-h-12">
                {item.description}
              </p>
            </div>

            {/* Category badge */}
            {item.category && (
              <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur-sm">
                {item.category}
              </div>
            )}
          </div>
        </a>
      ))}
    </div>
  )
}
