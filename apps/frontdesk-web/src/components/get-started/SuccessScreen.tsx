// apps/web/src/components/get-started/SuccessScreen.tsx
import { motion } from "framer-motion"
import { jost, alpha } from "./types"
import { WizardButton } from "./WizardButton"
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"

interface Props {
  onDashboard: () => void
}

export function SuccessScreen({ onDashboard }: Props) {
  const light = useAppMachine((s) => s.context.currentTheme.light)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-sm mx-auto text-center pt-6 space-y-8"
    >
      <div className="flex justify-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="size-16 flex items-center justify-center"
          style={{ border: `1px solid ${alpha(light, 0.4)}`, background: alpha(light, 0.06) }}
        >
          <div className="size-2 rounded-full" style={{ background: alpha(light, 0.8) }} />
        </motion.div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] tracking-[.16em] uppercase" style={{ color: alpha(light, 0.6), ...jost }}>
          Active
        </p>
        <p className="text-sm text-white/40 leading-relaxed" style={jost}>
          Your AI receptionist is live and ready to answer calls.
          Head to your dashboard to configure business hours and review calls.
        </p>
      </div>

      <WizardButton type="button" fullWidth={false} onClick={onDashboard} className="px-10 py-3.5">
        Go to Dashboard →
      </WizardButton>
    </motion.div>
  )
}
