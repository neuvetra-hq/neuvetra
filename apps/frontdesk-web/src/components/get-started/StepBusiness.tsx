// apps/web/src/components/get-started/StepBusiness.tsx
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ChevronDown } from "lucide-react"
import { WizardButton } from "./WizardButton"
import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { DarkInput } from "./DarkInput"
import { jostLabel } from "./types"
import type { BusinessData } from "./types"

const BUSINESS_TYPES = [
  ["medical",      "Medical / Healthcare"],
  ["dental",       "Dental"],
  ["spa",          "MedSpa / Wellness"],
  ["salon",        "Salon & Beauty"],
  ["plumbing",     "Plumbing & Trades"],
  ["legal",        "Legal"],
  ["real_estate",  "Real Estate"],
  ["other",        "Other"],
] as const

const schema = z.object({
  businessName: z.string().min(2, "Enter your business name"),
  businessType: z.enum(
    ["medical", "dental", "spa", "salon", "plumbing", "legal", "real_estate", "other"],
    { error: "Select a business type" }
  ),
})

interface Props {
  onNext: (data: BusinessData) => void
}

export function StepBusiness({ onNext }: Props) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<BusinessData>({
    resolver: zodResolver(schema),
  })
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState("")
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const inButton = buttonRef.current?.contains(target)
      const inPortal = portalRef.current?.contains(target)
      if (!inButton && !inPortal) setOpen(false)
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [])

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-3">
      <div className="space-y-1.5">
        <label className="block text-[12px] uppercase text-white/95" style={jostLabel}>
          Business name
        </label>
        <DarkInput
          placeholder="Sunrise MedSpa"
          hasError={!!errors.businessName}
          {...register("businessName")}
        />
        {errors.businessName && (
          <p className="text-[10px] text-red-400/70">{errors.businessName.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-[12px] uppercase text-white/95" style={jostLabel}>
          Business type
        </label>
        <Controller
          control={control}
          name="businessType"
          render={({ field }) => (
            <>
              <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                className={[
                  "w-full bg-white/[0.07] border px-4 py-3 text-sm text-left flex items-center justify-between transition-colors",
                  errors.businessType
                    ? "border-red-400/50"
                    : "border-white/20 hover:border-white/35",
                ].join(" ")}
                style={{ fontFamily: "'Jost', sans-serif" }}
              >
                <span className={selectedLabel ? "text-white" : "text-white/35"}>
                  {selectedLabel || "Select a type…"}
                </span>
                <ChevronDown className="size-4 text-white/95 shrink-0" strokeWidth={1.5} />
              </button>

              {open && dropPos && createPortal(
                <div
                  ref={portalRef}
                  style={{
                    position: "fixed",
                    top: dropPos.top,
                    left: dropPos.left,
                    width: dropPos.width,
                    zIndex: 9999,
                  }}
                  className="border border-white/20 bg-[#0f0f10] max-h-64 overflow-y-auto"
                >
                  {BUSINESS_TYPES.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        field.onChange(value)
                        setSelectedLabel(label)
                        setOpen(false)
                      }}
                      className="w-full px-4 py-3 text-sm text-left text-white/95 hover:text-white hover:bg-white/[0.03] transition-colors"
                      style={{ fontFamily: "'Jost', sans-serif" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </>
          )}
        />
        {errors.businessType && (
          <p className="text-[10px] text-red-400/70">{errors.businessType.message}</p>
        )}
      </div>

      <WizardButton type="submit" className="mt-1">
        Continue →
      </WizardButton>
    </form>
  )
}
