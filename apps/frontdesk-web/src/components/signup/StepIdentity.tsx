import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"

const schema = z.object({
  firstName: z.string().min(1, "Enter your first name"),
  lastName: z.string().min(1, "Enter your last name"),
  phone: z
    .string()
    .min(7, "Enter your mobile number")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a valid 10-digit number"),
})

export type IdentityData = z.infer<typeof schema>

interface Props {
  onNext: (data: IdentityData) => void
  busy: boolean
}

export function StepIdentity({ onNext, busy }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<IdentityData>({
    resolver: zodResolver(schema),
  })

  return (
    <form onSubmit={handleSubmit(onNext)}>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.firstName || undefined}>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <Input id="firstName" placeholder="Jane" autoComplete="given-name" aria-invalid={!!errors.firstName || undefined} {...register("firstName")} />
            <FieldError errors={[errors.firstName]} />
          </Field>
          <Field data-invalid={!!errors.lastName || undefined}>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <Input id="lastName" placeholder="Smith" autoComplete="family-name" aria-invalid={!!errors.lastName || undefined} {...register("lastName")} />
            <FieldError errors={[errors.lastName]} />
          </Field>
        </div>

        <Field data-invalid={!!errors.phone || undefined}>
          <FieldLabel htmlFor="phone">Your mobile number</FieldLabel>
          <Input
            id="phone"
            type="tel"
            placeholder="+1 (415) 555-0100"
            autoComplete="tel"
            autoFocus
            aria-invalid={!!errors.phone || undefined}
            {...register("phone")}
          />
          <FieldDescription>We'll send a verification code to this number.</FieldDescription>
          <FieldError errors={[errors.phone]} />
        </Field>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Sending code…" : "Send verification code"}
        </Button>
      </FieldGroup>

      <p className="text-xs text-muted-foreground leading-relaxed mt-4">
        By clicking "Send verification code," you agree to receive SMS messages from Front Desk by Neuvetra, including a one-time verification code and transactional notifications such as appointment bookings, cancellations, rescheduling, callback requests, and emergency alerts related to your account. Message frequency varies based on usage. Message and data rates may apply. Reply STOP to opt out or HELP for help. For support, contact <a href="mailto:support@neuvetra.com" className="underline hover:text-foreground">support@neuvetra.com</a>. See our{" "}
        <a href="/terms" className="underline hover:text-foreground">Terms of Service</a> and{" "}
        <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
      </p>
    </form>
  )
}
