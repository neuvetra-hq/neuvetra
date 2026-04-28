// apps/web/src/pages/app/AppGetStartedPage.tsx
import { useState } from "react"
import { useNavigate, Link } from "react-router"
import { AnimatePresence, motion } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { AppPageShell } from "./AppPageShell"
import { WizardNav } from "@/components/get-started/WizardNav"
import { SuccessScreen } from "@/components/get-started/SuccessScreen"
import { StepIdentify } from "@/components/get-started/StepIdentify"
import { StepVerify } from "@/components/get-started/StepVerify"
import { StepBusiness } from "@/components/get-started/StepBusiness"
import { StepAiName } from "@/components/get-started/StepAiName"
import { StepPersonality } from "@/components/get-started/StepPersonality"
import { StepVoice } from "@/components/get-started/StepVoice"
import { StepKnowledge } from "@/components/get-started/StepKnowledge"
import { StepPickNumber } from "@/components/get-started/StepPickNumber"
import { StepActivate } from "@/components/get-started/StepActivate"
import { StepCalendar } from "@/components/get-started/StepCalendar"
import {
  STEP_CONFIG, STEPS, slideVariants,
  type IdentityData, type BusinessData, type AiConfig, type AiPersonality, type AiVoiceGender,
} from "@/components/get-started/types"

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return `+${digits}`
}

function extractAreaCode(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  const local = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits
  return local.slice(0, 3)
}

const API_URL = import.meta.env.VITE_API_URL as string

export function AppGetStartedPage() {
  const { session, business } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [success, setSuccess] = useState(false)

  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [businessData, setBusinessData] = useState<BusinessData | null>(null)
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    name: "",
    personality: "professional",
    voiceGender: "female",
  })
  const [kbSeed, setKbSeed] = useState("")
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)

  // Guard: already fully set up
  if (session && business?.status === "active") {
    return (
      <AppPageShell title="WELCOME BACK" descriptor="You're already set up">
        <div className="max-w-sm mx-auto text-center pt-8 space-y-6">
          <p
            className="text-sm text-white/40"
            style={{ fontFamily: "'Jost', sans-serif", letterSpacing: "0.04em" }}
          >
            Your AI receptionist is already live.
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-8 py-3 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            Go to Dashboard →
          </button>
        </div>
      </AppPageShell>
    )
  }

  if (success) {
    return (
      <AppPageShell title="YOU'RE LIVE" descriptor="Your AI receptionist is ready">
        <SuccessScreen onDashboard={() => navigate("/dashboard")} />
      </AppPageShell>
    )
  }

  const goTo = (next: number, dir: number) => {
    setDirection(dir)
    setStep(next)
  }
  const advance = () => goTo(step + 1, 1)
  const retreat = () => goTo(step - 1, -1)

  // No back arrow on steps 0 (IDENTIFY), 1 (VERIFY), 2 (YOUR BUSINESS)
  const canGoBack = step > STEPS.YOUR_BUSINESS

  const currentConfig = STEP_CONFIG[step]

  const renderStep = () => {
    switch (step) {
      case STEPS.IDENTIFY:
        return (
          <StepIdentify
            onNext={(data) => {
              setIdentity(data)
              advance()
            }}
          />
        )

      case STEPS.VERIFY:
        return identity ? (
          <StepVerify
            phone={toE164(identity.phone)}
            onVerified={async (uid, token) => {
              await supabase.from("users").upsert({
                id: uid,
                first_name: identity.firstName,
                last_name: identity.lastName,
                phone: toE164(identity.phone),
              })
              // Fire opt-in confirmation SMS (A2P compliance, non-blocking)
              fetch(`${API_URL}/auth/optin-confirm`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              }).catch(() => {})
              setUserId(uid)
              setAccessToken(token)
              advance()
            }}
          />
        ) : null

      case STEPS.YOUR_BUSINESS:
        return (
          <StepBusiness
            onNext={(data) => {
              setBusinessData(data)
              advance()
            }}
          />
        )

      case STEPS.AI_NAME:
        return (
          <StepAiName
            value={aiConfig.name}
            onNext={(name) => {
              setAiConfig((prev) => ({ ...prev, name }))
              advance()
            }}
          />
        )

      case STEPS.PERSONALITY:
        return (
          <StepPersonality
            value={aiConfig.personality}
            onNext={(personality: AiPersonality) => {
              setAiConfig((prev) => ({ ...prev, personality }))
              advance()
            }}
          />
        )

      case STEPS.VOICE:
        return (
          <StepVoice
            value={aiConfig.voiceGender}
            onNext={(voiceGender: AiVoiceGender) => {
              setAiConfig((prev) => ({ ...prev, voiceGender }))
              advance()
            }}
          />
        )

      case STEPS.KNOWLEDGE:
        return (
          <StepKnowledge
            value={kbSeed}
            onNext={(seed) => {
              setKbSeed(seed)
              advance()
            }}
          />
        )

      case STEPS.PICK_NUMBER:
        return identity ? (
          <StepPickNumber
            areaCode={extractAreaCode(identity.phone)}
            onNext={(number) => {
              setSelectedNumber(number)
              advance()
            }}
          />
        ) : null

      case STEPS.ACTIVATE:
        return userId && businessData && selectedNumber ? (
          <StepActivate
            userId={userId}
            userName={identity ? `${identity.firstName} ${identity.lastName}` : ""}
            businessName={businessData.businessName}
            businessType={businessData.businessType}
            phoneNumber={selectedNumber}
            aiName={aiConfig.name}
            aiPersonality={aiConfig.personality}
            aiVoiceGender={aiConfig.voiceGender}
            aiKbSeed={kbSeed}
            onSuccess={(bId) => {
              setBusinessId(bId)
              advance()
            }}
            onBack={retreat}
          />
        ) : null

      case STEPS.CALENDAR:
        return businessId && accessToken ? (
          <StepCalendar
            businessId={businessId}
            accessToken={accessToken}
            onDone={() => setSuccess(true)}
          />
        ) : null

      default:
        return null
    }
  }

  return (
    <AppPageShell title="Get Started" descriptor={currentConfig.descriptor}>
      <div
        className="max-w-sm mx-auto w-full px-6 pt-4 pb-8 -mt-6"
        style={{
          background: 'rgba(0,0,0,0.22)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          maskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 5%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 5%, black 100%)',
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
        }}
      >
        {/* Step title */}
        <p
          className="text-center uppercase text-white/90"
          style={{ fontFamily: "'Jost', sans-serif", fontSize: "clamp(1rem, 4vw, 1.5rem)", letterSpacing: "0.15em", fontWeight: 200 }}
        >
          {currentConfig.title}
        </p>

        <WizardNav
          currentStep={step}
          canGoBack={canGoBack}
          onBack={retreat}
        />


        <div className="[overflow-x:clip]">
          <AnimatePresence custom={direction} mode="wait" initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: "easeInOut" }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {step === STEPS.IDENTIFY && (
          <p
            className="text-left mt-6 text-[11px] text-white/40 tracking-[.06em]"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-blue-400/80 hover:text-blue-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        )}
      </div>
    </AppPageShell>
  )
}
