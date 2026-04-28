// apps/web/src/components/get-started/types.ts
import type { CSSProperties } from "react"

export type IdentityData = {
  firstName: string
  lastName: string
  phone: string
}

export type BusinessData = {
  businessName: string
  businessType:
    | "medical" | "dental" | "spa" | "salon"
    | "plumbing" | "legal" | "real_estate" | "other"
}

export type AiPersonality = "professional" | "friendly" | "empathetic" | "concise"
export type AiVoiceGender = "male" | "female"

export type AiConfig = {
  name: string
  personality: AiPersonality
  voiceGender: AiVoiceGender
}

export const STEP_CONFIG = [
  { title: "IDENTIFY",      descriptor: "Let's start with you" },
  { title: "VERIFY",        descriptor: "Check your messages" },
  { title: "YOUR BUSINESS", descriptor: "Tell us about your business" },
  { title: "NAME YOUR AI",  descriptor: "What should your receptionist be called?" },
  { title: "PERSONALITY",   descriptor: "How should your AI sound?" },
  { title: "VOICE",         descriptor: "Choose a voice" },
  { title: "KNOWLEDGE",     descriptor: "What should your AI know?" },
  { title: "YOUR NUMBER",   descriptor: "Pick a local number" },
  { title: "ACTIVATE",      descriptor: "7-day free trial · cancel any time" },
  { title: "CALENDAR",      descriptor: "Connect your calendar" },
] as const

export const STEPS = {
  IDENTIFY:      0,
  VERIFY:        1,
  YOUR_BUSINESS: 2,
  AI_NAME:       3,
  PERSONALITY:   4,
  VOICE:         5,
  KNOWLEDGE:     6,
  PICK_NUMBER:   7,
  ACTIVATE:      8,
  CALENDAR:      9,
} as const

// Direction-aware slide variants for Framer Motion AnimatePresence
export const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "55%" : "-55%",
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? "-55%" : "55%",
    opacity: 0,
  }),
}

// Converts a hex color + 0–1 opacity to rgba()
export function alpha(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

// Shared Jost inline style used across all step components
export const jost: CSSProperties = {
  fontFamily: "'Jost', sans-serif",
  letterSpacing: "0.02em",
}

export const jostLabel: CSSProperties = {
  fontFamily: "'Jost', sans-serif",
  letterSpacing: "0.12em",
}
