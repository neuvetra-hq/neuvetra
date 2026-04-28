import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import industriesData from "@/data/industries.json"

const INDUSTRY_OPTIONS = [
  ...industriesData.industries.map((i) => ({ value: i.id, label: i.name })),
  { value: "other", label: "Other" },
]

const schema = z.object({
  businessName: z.string().min(2, "Enter your business name"),
  businessType: z.string().min(1, "Select a business type"),
  businessPhone: z
    .string()
    .min(7, "Enter your business phone number")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a valid 10-digit phone number"),
})

type FormValues = z.infer<typeof schema>

// What gets passed to the next step — includes derived areaCode
export type BusinessInfoData = FormValues & { areaCode: string }

function extractAreaCode(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  // Handle +1XXXXXXXXXX or 1XXXXXXXXXX
  const local = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits
  return local.slice(0, 3)
}

interface Props {
  defaultValues?: Partial<FormValues>
  onNext: (data: BusinessInfoData) => void
}

export function StepBusinessInfo({ defaultValues, onNext }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const onSubmit = (data: FormValues) => {
    onNext({ ...data, areaCode: extractAreaCode(data.businessPhone) })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <FieldGroup>
        <Field data-invalid={!!errors.businessName || undefined}>
          <FieldLabel htmlFor="businessName">Business name</FieldLabel>
          <Input
            id="businessName"
            placeholder="Sunrise MedSpa"
            className="h-11 px-4 rounded-xl text-sm"
            aria-invalid={!!errors.businessName || undefined}
            {...register("businessName")}
          />
          <FieldError errors={[errors.businessName]} />
        </Field>

        <Field data-invalid={!!errors.businessType || undefined}>
          <FieldLabel>Business type</FieldLabel>
          <Controller
            control={control}
            name="businessType"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger
                  className="w-full rounded-xl px-4 text-sm h-11"
                  aria-invalid={!!errors.businessType || undefined}
                >
                  <SelectValue placeholder="Select a type…" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.businessType]} />
        </Field>

        <Field data-invalid={!!errors.businessPhone || undefined}>
          <FieldLabel htmlFor="businessPhone">Business phone number</FieldLabel>
          <Input
            id="businessPhone"
            type="tel"
            placeholder="(415) 555-0100"
            className="h-11 px-4 rounded-xl text-sm"
            aria-invalid={!!errors.businessPhone || undefined}
            {...register("businessPhone")}
          />
          <FieldDescription>
            We'll provision a new AI number in the same area code as your existing number.
          </FieldDescription>
          <FieldError errors={[errors.businessPhone]} />
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        className="w-full h-11 rounded-xl text-sm font-medium mt-2"
      >
        Continue →
      </Button>
    </form>
  )
}
