import { forwardRef, useState, type TextareaHTMLAttributes } from "react"
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"
import { alpha } from "./types"

interface DarkTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean
}

export const DarkTextarea = forwardRef<HTMLTextAreaElement, DarkTextareaProps>(
  ({ className = "", hasError, style, onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const light = useAppMachine((s) => s.context.currentTheme.light)

    return (
      <textarea
        ref={ref}
        className={[
          "w-full bg-white/[0.07] border px-4 py-3 text-sm text-white resize-none",
          "placeholder:text-white/35 focus:outline-none transition-colors",
          hasError ? "border-red-400/50" : "border-white/20",
          className,
        ].join(" ")}
        style={{
          fontFamily: "'Jost', sans-serif",
          letterSpacing: "0.02em",
          ...(focused && !hasError ? { borderColor: alpha(light, 0.5) } : {}),
          ...style,
        }}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e)  => { setFocused(false); onBlur?.(e) }}
        {...props}
      />
    )
  }
)
DarkTextarea.displayName = "DarkTextarea"
