import { streamText as defaultStreamText, stepCountIs } from "ai"
import type { Agent } from "../agents/types"
import type { AuthenticatedUser } from "./auth"
import { buildGreeterSystemPrompt } from "../agents/greeter"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface HandleChatInput {
  agent: Agent
  messages: ChatMessage[]
  /**
   * Optional authenticated user. If present, the chat handler passes it
   * down to the agent's prompt builder (wired in Task 5). Anonymous
   * requests omit this field.
   */
  user?: AuthenticatedUser
}

interface StreamChatDeps {
  streamText: typeof defaultStreamText
}

const defaultDeps: StreamChatDeps = {
  streamText: defaultStreamText,
}

/**
 * Generic streaming chat handler. Same code runs every agent + every sub-agent.
 *
 * Returns the AI SDK 6 `streamText` result; the route converts it to a UI
 * message stream Response via `result.toUIMessageStreamResponse()`. The UI
 * message stream protocol carries text deltas, tool-input chunks, and
 * tool-output chunks in a single ordered stream — the client consumes it via
 * `readUIMessageStream` from `ai`.
 *
 * Tracing: `experimental_telemetry: { isEnabled: true }` makes the AI SDK
 * emit OpenTelemetry spans for each model call (and tool call). The
 * LangfuseSpanProcessor (registered in `instrumentation.ts`) picks them up
 * and ships them to Langfuse — no manual wrapper needed.
 *
 * Tool calls: any tools the agent registered are surfaced inline in the
 * stream. Tools with an `execute` function get auto-resolved by the SDK so
 * the model can finish the turn with a verbal reply; the call itself still
 * appears in the stream so the client can act on it.
 */
export function streamChat(
  input: HandleChatInput,
  deps: StreamChatDeps = defaultDeps,
): ReturnType<typeof defaultStreamText> {
  const { agent, messages } = input

  return deps.streamText({
    model: agent.model,
    system:
      input.agent.id === "greeter"
        ? buildGreeterSystemPrompt(input.user)
        : input.agent.systemPrompt,
    messages,
    tools: agent.tools,
    stopWhen: stepCountIs(5),
    experimental_telemetry: {
      isEnabled: true,
      functionId: `chat:${agent.id}`,
      metadata: {
        agentId: agent.id,
        authenticated: input.user ? "true" : "false",
      },
    },
  } as any)
}
