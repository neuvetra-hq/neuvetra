import type { ButtonHTMLAttributes } from "react"
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"
import { alpha, jost } from "./types"

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { fullWidth?: boolean }

export function WizardButton({ fullWidth = true, className = "", style, ...props }: Props) {
  const light = useAppMachine((s) => s.context.currentTheme.light)
  return (
    <button
      className={`py-3 text-[11px] font-medium tracking-[.18em] uppercase transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""} ${className}`}
      style={{
        color:      "rgba(255,255,255,0.92)",
        background:  alpha(light, 0.15),
        border:      `1px solid ${alpha(light, 0.5)}`,
        boxShadow:   `0 0 18px ${alpha(light, 0.25)}, inset 0 0 12px ${alpha(light, 0.08)}`,
        textShadow:  `0 0 12px ${alpha(light, 0.6)}`,
        ...jost,
        ...style,
      }}
      {...props}
    />
  )
}
