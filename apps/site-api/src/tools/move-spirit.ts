import { tool, jsonSchema } from "ai"

export type SpiritDirection = "up" | "down" | "left" | "right"

export interface MoveSpiritInput {
  direction: SpiritDirection
}

/**
 * The Spirit is the brand-level visual avatar (a Three.js particle field) on
 * the Site homepage. The agent invokes this tool when the user asks to move
 * it. The "execute" returns a trivial acknowledgement so the model can finish
 * the turn with a verbal reply; the actual visual move happens client-side
 * when the orchestrator routes the tool call to the Spirit XState actor.
 *
 * Pilot scope (2026-04-27): four cardinal directions only. M2 promotes this
 * to the full scenario architecture; for now it's a single primitive tool
 * exercising the agent → tool-call → orchestrator → Spirit-actor path.
 */
export const moveSpiritTool = tool({
  description:
    "Move the Spirit visual avatar (the brand orb on the page) in a cardinal direction. Use when the user asks to move the Spirit, the avatar, or the orb up, down, left, or right. After invoking, briefly acknowledge in plain language what you did — do not narrate the technical action.",
  inputSchema: jsonSchema<MoveSpiritInput>({
    type: "object",
    properties: {
      direction: {
        type: "string",
        enum: ["up", "down", "left", "right"],
        description: "Cardinal direction to move the Spirit.",
      },
    },
    required: ["direction"],
    additionalProperties: false,
  }),
  execute: async ({ direction }) => ({ acknowledged: true, direction }),
})
