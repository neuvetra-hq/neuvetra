import { createContext } from 'react'

// Legacy context — superseded by SpiritActorContext in useSpiritMachine.ts
export const SpiritContext = createContext<Record<string, never>>({})
