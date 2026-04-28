// apps/web/src/components/get-started/WizardNav.tsx
import { ChevronLeft } from "lucide-react"
import { STEP_CONFIG, alpha } from "./types"
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"

interface WizardNavProps {
  currentStep: number
  canGoBack: boolean
  onBack: () => void
}

export function WizardNav({ currentStep, canGoBack, onBack }: WizardNavProps) {
  const light = useAppMachine((s) => s.context.currentTheme.light)
  return (
    <div className="flex items-center gap-4 mb-3">
      {/* Back arrow — invisible (not removed) on steps 0-2 to preserve layout */}
      <button
        type="button"
        data-testid="wizard-back"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Go back"
        className="flex items-center justify-center size-9 border border-white/15 text-white/40 hover:border-white/30 hover:text-white/70 transition-colors cursor-pointer disabled:pointer-events-none"
        style={{ visibility: canGoBack ? "visible" : "hidden" }}
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} />
      </button>

      {/* Step progress dots */}
      <div className="flex items-center gap-1.5 flex-1 justify-center">
        {STEP_CONFIG.map((_, i) => (
          <div
            key={i}
            data-testid="wizard-dot"
            className="transition-all duration-300 rounded-full"
            style={{
              width:  i === currentStep ? 24 : 12,
              height: i === currentStep ? 3 : 2,
              backgroundColor:
                i === currentStep
                  ? alpha(light, 1)
                  : i < currentStep
                  ? "rgba(255,255,255,0.5)"
                  : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </div>

      {/* Spacer mirrors the back arrow width to keep dots centered */}
      <div className="size-9" />
    </div>
  )
}
