import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

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
  onBack: () => void
}

export function StepPickNumber({ areaCode, onNext, onBack }: Props) {
  const [numbers, setNumbers] = useState<AvailableNumber[]>([])
  const [loadingNumbers, setLoadingNumbers] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const fetchNumbers = async () => {
      try {
        const res = await fetch(`${API_URL}/available-numbers?areaCode=${areaCode}`)
        const data = await res.json() as { numbers: AvailableNumber[] }
        setNumbers(data.numbers ?? [])
      } catch {
        toast.error("Failed to load available numbers")
      } finally {
        setLoadingNumbers(false)
      }
    }
    fetchNumbers()
  }, [areaCode])

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-500">
        Available numbers in the <span className="font-semibold text-neutral-900">({areaCode})</span> area:
      </p>

      {loadingNumbers ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : numbers.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 py-6 text-center text-sm text-neutral-500">
          No numbers found for area code {areaCode}.
          <Button type="button" variant="link" onClick={onBack} className="ml-1 h-auto p-0">
            Try a different area code
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {numbers.map((n) => (
            <Button
              key={n.phoneNumber}
              type="button"
              variant="outline"
              onClick={() => setSelected(n.phoneNumber)}
              className={`h-auto w-full justify-start rounded-xl border px-4 py-3.5 text-left transition-all ${
                selected === n.phoneNumber
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <div>
                <p className="font-mono text-sm font-semibold text-neutral-900">{n.friendlyName}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{n.locality}, {n.region}</p>
              </div>
            </Button>
          ))}
        </div>
      )}

      <Button
        className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
        disabled={!selected || loadingNumbers}
        onClick={() => selected && onNext(selected)}
      >
        Continue →
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="w-full text-sm text-neutral-400 hover:text-neutral-600"
      >
        ← Back
      </Button>
    </div>
  )
}
