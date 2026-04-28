import { setup, assign, fromCallback, enqueueActions } from "xstate"
import type { ChatMessage, ChatToolCall, StreamChatFn } from "@/lib/api"

/**
 * Frontend conversation orchestrator.
 *
 * Streaming-aware (AI SDK 6 UI message protocol):
 *   - On USER_MESSAGE, append the user message and invoke `streamChat`.
 *   - The streaming actor sends back TEXT_UPDATE events as text accumulates,
 *     TOOL_CALL_RECEIVED events as tools resolve, and STREAM_DONE / STREAM_ERROR
 *     when the turn ends.
 *   - The orchestrator EMITs `TOOL_CALL` events upward; the React layer
 *     subscribes via `actor.on('TOOL_CALL', ...)` and routes to whatever
 *     downstream actor needs the call (today: the Spirit machine).
 *
 * Why emit (not sendTo): keeps the orchestrator decoupled from any specific
 * downstream actor. M2 will register multiple downstream actors (sceneActor,
 * specialist agents, etc.) and the routing decision lives in the React layer
 * where actor refs are available.
 */

export interface OrchestratorInput {
  streamChat: StreamChatFn
}

export interface OrchestratorContext {
  messages: ChatMessage[]
  error: string | null
  streamChat: StreamChatFn
}

export type OrchestratorEvent =
  | { type: "USER_MESSAGE"; content: string }
  | { type: "TEXT_UPDATE"; text: string }
  | { type: "TOOL_CALL_RECEIVED"; toolCall: ChatToolCall }
  | {
      type: "SCENARIO_ACTIVATE_RECEIVED"
      activate: { id: string; props: Record<string, unknown> }
    }
  | { type: "STREAM_DONE" }
  | { type: "STREAM_ERROR"; message: string }

export type OrchestratorEmitted =
  | { type: "TOOL_CALL"; toolCall: ChatToolCall }
  | {
      type: "SCENARIO_ACTIVATE"
      activate: { id: string; props: Record<string, unknown> }
    }

export const orchestratorMachine = setup({
  types: {} as {
    context: OrchestratorContext
    events: OrchestratorEvent
    input: OrchestratorInput
    emitted: OrchestratorEmitted
  },
  actors: {
    streamingChat: fromCallback<
      // The actor reports back via these event shapes.
      OrchestratorEvent,
      { messages: ChatMessage[]; streamChat: StreamChatFn }
    >(({ input, sendBack }) => {
      const controller = new AbortController()

      void (async () => {
        try {
          await input.streamChat(
            input.messages,
            {
              onTextUpdate: (text) => sendBack({ type: "TEXT_UPDATE", text }),
              onToolCall: (toolCall) =>
                sendBack({ type: "TOOL_CALL_RECEIVED", toolCall }),
              onScenarioActivate: (activate) =>
                sendBack({ type: "SCENARIO_ACTIVATE_RECEIVED", activate }),
            },
            controller.signal,
          )
          sendBack({ type: "STREAM_DONE" })
        } catch (err) {
          if (controller.signal.aborted) return
          const message =
            err instanceof Error ? err.message : "Something went wrong."
          sendBack({ type: "STREAM_ERROR", message })
        }
      })()

      return () => controller.abort()
    }),
  },
  actions: {
    appendUserMessage: assign(({ context, event }) => {
      const e = event as Extract<OrchestratorEvent, { type: "USER_MESSAGE" }>
      const trimmed = e.content.trim()
      return {
        messages: [
          ...context.messages,
          { role: "user" as const, content: trimmed },
        ],
        error: null,
      }
    }),
    /**
     * On every TEXT_UPDATE, replace (or create) the trailing assistant message
     * with the latest cumulative text. Streaming = we keep overwriting the
     * same message slot as text grows.
     */
    upsertAssistantMessage: assign(({ context, event }) => {
      const e = event as Extract<OrchestratorEvent, { type: "TEXT_UPDATE" }>
      const messages = [...context.messages]
      const last = messages[messages.length - 1]
      if (last && last.role === "assistant") {
        messages[messages.length - 1] = { role: "assistant", content: e.text }
      } else {
        messages.push({ role: "assistant", content: e.text })
      }
      return { messages }
    }),
    emitToolCall: enqueueActions(({ event, enqueue }) => {
      const e = event as Extract<OrchestratorEvent, { type: "TOOL_CALL_RECEIVED" }>
      enqueue.emit({ type: "TOOL_CALL", toolCall: e.toolCall })
    }),
    emitScenarioActivate: enqueueActions(({ event, enqueue }) => {
      const e = event as Extract<OrchestratorEvent, { type: "SCENARIO_ACTIVATE_RECEIVED" }>
      enqueue.emit({ type: "SCENARIO_ACTIVATE", activate: e.activate })
    }),
    setError: assign(({ event }) => {
      const e = event as Extract<OrchestratorEvent, { type: "STREAM_ERROR" }>
      return { error: e.message }
    }),
  },
}).createMachine({
  id: "orchestrator",
  context: ({ input }) => ({
    messages: [],
    error: null,
    streamChat: input.streamChat,
  }),
  initial: "idle",
  states: {
    idle: {
      on: {
        USER_MESSAGE: {
          target: "sending",
          actions: "appendUserMessage",
        },
      },
    },
    sending: {
      invoke: {
        src: "streamingChat",
        input: ({ context }) => ({
          messages: context.messages,
          streamChat: context.streamChat,
        }),
      },
      on: {
        TEXT_UPDATE: { actions: "upsertAssistantMessage" },
        TOOL_CALL_RECEIVED: { actions: "emitToolCall" },
        SCENARIO_ACTIVATE_RECEIVED: { actions: "emitScenarioActivate" },
        STREAM_DONE: { target: "idle" },
        STREAM_ERROR: { target: "idle", actions: "setError" },
      },
    },
  },
})
