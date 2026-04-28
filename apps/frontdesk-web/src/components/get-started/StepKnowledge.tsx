// apps/web/src/components/get-started/StepKnowledge.tsx
import { useState } from "react"
import { DarkTextarea } from "./DarkTextarea"
import { WizardButton } from "./WizardButton"
import { jost, jostLabel } from "./types"

interface Props {
  value: string
  onNext: (seed: string) => void
}

export function StepKnowledge({ value, onNext }: Props) {
  const [text, setText] = useState(value)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[12px] uppercase text-white/95" style={jostLabel}>
          About your business
        </label>
        <DarkTextarea
          rows={6}
          placeholder="We're a dental office open Mon-Fri 9am-5pm. We offer cleanings, fillings, and cosmetic work. New patients welcome. Our number is (415) 555-0100."
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-[10px] text-white/20 leading-relaxed" style={jost}>
          Your AI will use this to answer common questions. You can always add more in Settings.
        </p>
      </div>

      <WizardButton type="button" onClick={() => onNext(text)}>
        Continue →
      </WizardButton>

      <button
        type="button"
        onClick={() => onNext("")}
        className="w-full py-2 text-[10px] tracking-[.1em] uppercase text-white/20 hover:text-white/40 transition-colors"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        Skip for now
      </button>
    </div>
  )
}
