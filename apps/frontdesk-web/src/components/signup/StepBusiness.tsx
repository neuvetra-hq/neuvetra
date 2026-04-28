import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel, FieldError } from "@/components/ui/field"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

const schema = z.object({
  businessName: z.string().min(2, "Enter your business name"),
  businessType: z.enum(["medical", "dental", "spa", "salon", "plumbing", "legal", "real_estate", "other"] as const, {
    error: "Select a business type",
  }),
})

export type BusinessData = z.infer<typeof schema>

const BUSINESS_TYPE_LABELS: Record<BusinessData["businessType"], string> = {
  medical: "Medical / Healthcare",
  dental: "Dental",
  spa: "MedSpa / Wellness",
  salon: "Salon & Beauty",
  plumbing: "Plumbing & Trades",
  legal: "Legal",
  real_estate: "Real Estate",
  other: "Other",
}

interface Props {
  onNext: (data: BusinessData) => void
}

export function StepBusiness({ onNext }: Props) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<BusinessData>({
    resolver: zodResolver(schema),
  })

  return (
    <form onSubmit={handleSubmit(onNext)}>
      <FieldGroup>
        <Field data-invalid={!!errors.businessName || undefined}>
          <FieldLabel htmlFor="businessName">Business name</FieldLabel>
          <Input id="businessName" placeholder="Sunrise MedSpa" aria-invalid={!!errors.businessName || undefined} {...register("businessName")} />
          <FieldError errors={[errors.businessName]} />
        </Field>

        <Field data-invalid={!!errors.businessType || undefined}>
          <FieldLabel>Business type</FieldLabel>
          <Controller
            control={control}
            name="businessType"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.businessType || undefined}>
                  <SelectValue placeholder="Select a type…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(BUSINESS_TYPE_LABELS) as [BusinessData["businessType"], string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.businessType]} />
        </Field>

        <Button type="submit" className="w-full">Continue →</Button>
      </FieldGroup>
    </form>
  )
}
