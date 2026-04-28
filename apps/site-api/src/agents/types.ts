import type { LanguageModel, ToolSet } from "ai"

/**
 * Agent abstraction — every agent (greeter, specialists, sub-agents) is a
 * config object satisfying this interface. The chat handler is generic over
 * Agent: it reads model + systemPrompt + tools and calls AI SDK accordingly.
 *
 * Tools and subAgents are present in the type but unused in M1. M2 wires
 * tools (greeter's phone-capture); M4 wires sub-agents.
 */
export interface Agent {
  /** Stable identifier — appears in Langfuse traces, drives XState routing. */
  id: string
  /** Stable prompt key for Langfuse tracing — `name:version` shape. */
  promptKey: string
  /** The system prompt as a code constant. M1 source of truth. */
  systemPrompt: string
  /** The Vercel AI SDK model to call. Switching providers = swap this. */
  model: LanguageModel
  /** Tool definitions for AI SDK's `tools` parameter. M1: empty (`{}`). */
  tools: ToolSet
  /**
   * Sub-agents this agent can invoke as tools. M1: empty.
   * Each sub-agent is itself an Agent (recursive).
   */
  subAgents: Agent[]
}
