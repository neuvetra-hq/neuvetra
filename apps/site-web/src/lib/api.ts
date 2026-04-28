import { parseJsonEventStream, readUIMessageStream, uiMessageChunkSchema } from "ai"
import { supabase } from "./supabase"

export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface StreamChatCallbacks {
  /**
   * Called as text accumulates. The string passed in is the *cumulative*
   * assistant message text so far (not just the latest delta) — the
   * orchestrator can replace its working assistant message with this value
   * directly.
   */
  onTextUpdate: (text: string) => void

  /**
   * Called once per agent-emitted tool call, when the call is fully resolved
   * (input known). Tool calls fire as soon as they're complete in the stream;
   * the same call won't fire twice.
   */
  onToolCall: (toolCall: ChatToolCall) => void

  /**
   * Fires once per agent-emitted scenario directive. The scene region
   * subscribes via the orchestrator and mounts the appropriate component.
   * `id` matches a `ScenarioDescriptor.id` registered in the server's
   * scenario catalog; `props` is component-specific (e.g., `{ phone }`
   * for `collect_otp_verification`).
   */
  onScenarioActivate: (activate: { id: string; props: Record<string, unknown> }) => void
}

export type StreamChatFn = (
  messages: ChatMessage[],
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal,
) => Promise<void>

const API_BASE = import.meta.env.DEV
  ? "http://localhost:3000"
  : (import.meta.env.VITE_API_URL ?? window.location.origin)

/**
 * Streams a chat turn from the API. Resolves when the stream ends (success).
 * Throws if the HTTP response is not OK or the stream errors mid-flight.
 *
 * Wire format: AI SDK 6 UI message stream protocol. Server returns a
 * streaming Response from `streamText.toUIMessageStreamResponse()`; we
 * consume it via `readUIMessageStream`, which yields successive snapshots
 * of the building UIMessage. Each snapshot's `parts` array contains text
 * pieces (cumulative) and tool-call pieces (discrete events).
 */
export const streamChat: StreamChatFn = async (messages, callbacks, signal) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`
  }

  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages }),
    signal,
  })

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res))
  }

  if (!res.body) {
    throw new Error("Response had no body to stream")
  }

  // The HTTP body arrives as bytes (SSE-formatted JSON events). AI SDK's
  // `readUIMessageStream` expects already-parsed `UIMessageChunk` values,
  // so we run the bytes through `parseJsonEventStream` and unwrap each
  // ParseResult. Parse failures throw and abort the stream — they
  // indicate a wire-format mismatch worth surfacing rather than swallowing.
  const chunkStream = parseJsonEventStream({
    stream: res.body,
    schema: uiMessageChunkSchema,
  }).pipeThrough(
    new TransformStream({
      transform(parsed, controller) {
        if (parsed.success) {
          controller.enqueue(parsed.value)
        } else {
          controller.error(parsed.error)
        }
      },
    }),
  )

  const seenToolCallIds = new Set<string>()
  const seenScenarioActivations = new Set<string>()

  for await (const message of readUIMessageStream({
    stream: chunkStream,
    onError: (err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err)
      throw new Error(detail)
    },
    terminateOnError: true,
  })) {
    // Reconstruct accumulated text from all text parts in order.
    let text = ""
    const parts = message.parts as ReadonlyArray<UIMessagePart>
    for (const part of parts) {
      if (part.type === "text" && typeof part.text === "string") {
        text += part.text
      }
    }
    callbacks.onTextUpdate(text)

    // Surface newly-completed tool calls. A tool part is "available" when
    // its input is fully resolved.
    for (const part of parts) {
      if (typeof part.type !== "string") continue
      if (!part.type.startsWith("tool-") && !part.type.startsWith("dynamic-tool")) continue
      if (part.state !== "input-available" && part.state !== "output-available") continue
      const id = part.toolCallId
      if (!id || seenToolCallIds.has(id)) continue
      const name = extractToolName(part.type)
      if (!name) continue
      seenToolCallIds.add(id)
      callbacks.onToolCall({
        id,
        name,
        input: (part.input ?? {}) as Record<string, unknown>,
      })
    }

    // Detect scenario directives carried in tool outputs. Fire once per tool-call id.
    for (const part of parts) {
      if (typeof part.type !== "string") continue
      if (!part.type.startsWith("tool-")) continue
      if (part.state !== "output-available") continue
      const id = part.toolCallId
      if (!id || seenScenarioActivations.has(id)) continue
      // Tool outputs are typed as unknown; we read defensively for the
      // { scenario: { id, props } } shape that request_phone_verification returns.
      const output = (part as unknown as { output?: unknown }).output
      if (!output || typeof output !== "object") continue
      const scenario = (output as { scenario?: unknown }).scenario
      if (!scenario || typeof scenario !== "object") continue
      const scenarioId = (scenario as { id?: unknown }).id
      if (typeof scenarioId !== "string") continue
      const scenarioProps = (scenario as { props?: unknown }).props
      const props =
        scenarioProps && typeof scenarioProps === "object"
          ? (scenarioProps as Record<string, unknown>)
          : {}
      seenScenarioActivations.add(id)
      callbacks.onScenarioActivate({ id: scenarioId, props })
    }
  }
}

interface UIMessagePart {
  type: string
  text?: string
  state?: string
  toolCallId?: string
  input?: unknown
  output?: unknown
}

/**
 * AI SDK 6 emits tool parts with names like `tool-move_spirit`,
 * `tool-set_spirit_color`, or `dynamic-tool` for runtime-defined tools. We
 * strip the `tool-` prefix; for `dynamic-tool` the name lives on a separate
 * field (not used in pilot).
 */
function extractToolName(partType: string): string | null {
  if (partType.startsWith("tool-")) return partType.slice("tool-".length)
  return null
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.error === "string") return body.error
    if (typeof body?.message === "string") return body.message
  } catch {
    // body wasn't JSON — fall through.
  }
  return `Request failed (${res.status})`
}
