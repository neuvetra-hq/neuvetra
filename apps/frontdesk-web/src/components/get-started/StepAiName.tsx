// apps/web/src/components/get-started/StepAiName.tsx
import { useState } from "react"
import { DarkInput } from "./DarkInput"
import { WizardButton } from "./WizardButton"
import { jostLabel } from "./types"

interface Props {
  value: string
  onNext: (name: string) => void
}

export function StepAiName({ value, onNext }: Props) {
  const [name, setName] = useState(value)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) onNext(name.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[12px] uppercase text-white/95" style={jostLabel}>
          AI name
        </label>
        <DarkInput
          placeholder="Aria"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p
          className="text-[10px] text-white/20 leading-relaxed"
          style={{ fontFamily: "'Jost', sans-serif" }}
        >
          Your callers will hear: "Hi, I'm {name || "Aria"} — how can I help you today?"
        </p>
      </div>

      <WizardButton type="submit" disabled={!name.trim()}>
        Continue →
      </WizardButton>
    </form>
  )
}
