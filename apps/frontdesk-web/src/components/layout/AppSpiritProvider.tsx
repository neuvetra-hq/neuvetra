import { useRef, useEffect, type RefObject } from "react"
import { useActorRef } from "@xstate/react"
import { useSpirit } from "@/hooks/useSpirit"
import { useAppSend } from "@/pages/app/hooks/useAppMachine"
import { SpiritActorContext } from "@/hooks/useSpiritMachine"
import { createSpiritMachine } from "@/lib/spirit/spiritMachine"

interface Props {
  containerRef: RefObject<HTMLDivElement | null>
  children: React.ReactNode
}

export function AppSpiritProvider({ containerRef, children }: Props) {
  const sendApp = useAppSend()

  const { engineRef } = useSpirit(containerRef, () => {
    sendApp({ type: "SPIRIT_READY" })
  })

  // machineRef holds the machine created once — engineRef is stable and closed over by the machine.
  // useActorRef handles React Strict Mode correctly (start/stop/rehydrate lifecycle).
  const machineRef = useRef(createSpiritMachine(engineRef))
  const actor = useActorRef(machineRef.current)

  useEffect(() => {
    sendApp({ type: "REGISTER_SPIRIT", actorRef: actor })
  }, [actor, sendApp])

  return (
    <SpiritActorContext.Provider value={actor}>
      {children}
    </SpiritActorContext.Provider>
  )
}
