import { setup } from "xstate"
import { greeterAgent } from "../agents/greeter"
import type { Agent } from "../agents/types"

/**
 * The top-level conversation machine.
 *
 * M1: one state (greeter), no transitions. The chat handler uses
 * `greeterAgent` directly without consulting the machine — but the machine
 * is in place so M2+ can add specialist states + handoff transitions
 * without refactoring callers.
 *
 * M2 expansion sketch:
 *   states: {
 *     greeter: { on: { SIGN_IN_COMPLETE: "specialistRouter" } },
 *     specialistRouter: { always: [{ guard: ..., target: "frontdeskSpecialist" }, ...] },
 *     frontdeskSpecialist: { ... },
 *     terrascopeSpecialist: { ... },
 *   }
 */
export const conversationMachine = setup({
  types: {
    context: {} as { activeAgent: Agent },
    events: {} as { type: "NEXT" }, // M2 will replace with real events
  },
}).createMachine({
  id: "conversation",
  initial: "greeter",
  context: {
    activeAgent: greeterAgent,
  },
  states: {
    greeter: {
      // M2: adds `on: { SIGN_IN_COMPLETE: "specialistRouter" }` etc.
    },
  },
})
