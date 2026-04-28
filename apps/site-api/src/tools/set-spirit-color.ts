import { tool, jsonSchema } from "ai"

export const SPIRIT_COLOR_NAMES = [
  "red",
  "green",
  "blue",
  "white",
  "purple",
  "orange",
  "yellow",
  "pink",
  "cyan",
] as const

export type SpiritColorName = (typeof SPIRIT_COLOR_NAMES)[number]

export interface SetSpiritColorInput {
  color: SpiritColorName
}

/**
 * Sets the Spirit's color palette to one of a small fixed set. The mapping
 * from named color → hex pair lives client-side in App.tsx — the agent only
 * picks the name, the orchestrator routes the choice to the Spirit machine's
 * CHANGE_COLORS event, and the existing visual lerp pipeline handles the
 * transition.
 *
 * Pilot scope (2026-04-27): exercises the same agent → tool → orchestrator →
 * actor path as `move_spirit`, with a more visually obvious effect for
 * smoke-testing.
 */
export const setSpiritColorTool = tool({
  description:
    "Set the Spirit visual avatar's color. Use when the user asks to change the Spirit's color, the orb's color, or the avatar's color. Pick the closest named color from the supported set. After invoking, briefly acknowledge in plain language — don't narrate the technical action.",
  inputSchema: jsonSchema<SetSpiritColorInput>({
    type: "object",
    properties: {
      color: {
        type: "string",
        enum: [...SPIRIT_COLOR_NAMES],
        description:
          "One of the supported color names. If the user asks for a hue not in this list, pick the nearest one.",
      },
    },
    required: ["color"],
    additionalProperties: false,
  }),
  execute: async ({ color }) => ({ acknowledged: true, color }),
})
