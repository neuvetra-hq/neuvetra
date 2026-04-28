// apps/web/src/components/get-started/StepPersonality.tsx
import { jost, alpha } from "./types"
import type { AiPersonality } from "./types"
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"

const OPTIONS: { value: AiPersonality; label: string; description: string }[] = [
  { value: "professional", label: "Professional", description: "Precise and courteous — focused on efficiency" },
  { value: "friendly",     label: "Friendly",     description: "Warm and approachable — puts callers at ease" },
  { value: "empathetic",   label: "Empathetic",   description: "Attentive and caring — ideal for healthcare" },
  { value: "concise",      label: "Concise",      description: "Brief and direct — respects everyone's time" },
]

interface Props {
  value: AiPersonality
  onNext: (personality: AiPersonality) => void
}

export function StepPersonality({ value, onNext }: Props) {
  const light = useAppMachine((s) => s.context.currentTheme.light)
  return (
    <div className="space-y-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onNext(opt.value)}
          className="w-full text-left px-5 py-4 border transition-colors border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
          style={value === opt.value ? { borderColor: alpha(light, 0.5), background: alpha(light, 0.06) } : {}}
        >
          <p
            className="text-[11px] font-semibold tracking-[.1em] uppercase mb-1"
            style={{ color: value === opt.value ? alpha(light, 0.9) : "rgba(255,255,255,0.6)", fontFamily: "'Jost', sans-serif" }}
          >
            {opt.label}
          </p>
          <p className="text-xs text-white/30" style={jost}>
            {opt.description}
          </p>
        </button>
      ))}
    </div>
  )
}
