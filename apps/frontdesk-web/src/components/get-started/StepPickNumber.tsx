// apps/web/src/components/get-started/StepPickNumber.tsx
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { jost, alpha } from "./types"
import { WizardButton } from "./WizardButton"
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"

const API_URL = import.meta.env.VITE_API_URL as string

interface AvailableNumber {
  phoneNumber: string
  friendlyName: string
  locality: string
  region: string
}

interface Props {
  areaCode: string
  onNext: (phoneNumber: string) => void
}

export function StepPickNumber({ areaCode, onNext }: Props) {
  const [numbers, setNumbers] = useState<AvailableNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const light = useAppMachine((s) => s.context.currentTheme.light)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/available-numbers?areaCode=${areaCode}`)
        const data = await res.json() as { numbers: AvailableNumber[] }
        setNumbers(data.numbers ?? [])
      } catch {
        toast.error("Failed to load available numbers")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [areaCode])

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-white/35" style={jost}>
        Available numbers near area code{" "}
        <span className="text-white/60">({areaCode})</span>
      </p>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-white/[0.02] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : numbers.length === 0 ? (
        <div className="border border-white/10 px-5 py-6 text-center">
          <p className="text-sm text-white/30" style={jost}>
            No numbers found for area code ({areaCode}).
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {numbers.map((n) => (
            <button
              key={n.phoneNumber}
              type="button"
              onClick={() => setSelected(n.phoneNumber)}
              className="w-full text-left px-5 py-3.5 border transition-colors border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
              style={selected === n.phoneNumber ? { borderColor: alpha(light, 0.5), background: alpha(light, 0.06) } : {}}
            >
              <p className="font-mono text-sm text-white/80">{n.friendlyName}</p>
              <p className="text-[10px] text-white/30 mt-0.5" style={jost}>
                {n.locality}, {n.region}
              </p>
            </button>
          ))}
        </div>
      )}

      <WizardButton
        type="button"
        disabled={!selected || loading}
        onClick={() => selected && onNext(selected)}
      >
        Continue →
      </WizardButton>
    </div>
  )
}
