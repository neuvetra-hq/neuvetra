import { createContext, useContext } from "react"
import { useSelector } from "@xstate/react"
import type { Actor, SnapshotFrom } from "xstate"
import type { createSpiritMachine } from "@/lib/spirit/spiritMachine"

type SpiritActor = Actor<ReturnType<typeof createSpiritMachine>>
export type SpiritSnapshot = SnapshotFrom<ReturnType<typeof createSpiritMachine>>

export const SpiritActorContext = createContext<SpiritActor | null>(null)

export function useSpiritMachine<T>(selector: (s: SpiritSnapshot) => T): T {
  const actor = useContext(SpiritActorContext)
  if (!actor) throw new Error("useSpiritMachine must be used inside AppLayout")
  return useSelector(actor, selector)
}

export function useSpiritSend() {
  const actor = useContext(SpiritActorContext)
  if (!actor) throw new Error("useSpiritSend must be used inside AppLayout")
  return actor.send
}
