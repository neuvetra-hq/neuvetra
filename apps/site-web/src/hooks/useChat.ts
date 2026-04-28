import { useCallback, useEffect, useRef } from "react"
import { useActorRef, useSelector } from "@xstate/react"
import { orchestratorMachine } from "@/actors/orchestrator.machine"
import { streamChat, type ChatMessage, type ChatToolCall } from "@/lib/api"

export type { ChatMessage, ChatToolCall }

export interface UseChatOptions {
  /**
   * Called for each tool call the agent emits. Routed by the caller to the
   * appropriate downstream actor (Spirit machine for `move_spirit`, etc.).
   * Latest closure is honored — the hook keeps it in a ref so the
   * subscription doesn't re-bind every render.
   */
  onToolCall?: (toolCall: ChatToolCall) => void
  /**
   * Called for each agent-emitted scenario directive (e.g.,
   * collect_otp_verification). Same ref pattern as onToolCall.
   */
  onScenarioActivate?: (activate: { id: string; props: Record<string, unknown> }) => void
}

export interface UseChatResult {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string) => void
}

export function useChat(opts: UseChatOptions = {}): UseChatResult {
  const actorRef = useActorRef(orchestratorMachine, {
    input: { streamChat },
  })

  const messages = useSelector(actorRef, (s) => s.context.messages)
  const isLoading = useSelector(actorRef, (s) => s.matches("sending"))
  const error = useSelector(actorRef, (s) => s.context.error)

  const onToolCallRef = useRef(opts.onToolCall)
  useEffect(() => {
    onToolCallRef.current = opts.onToolCall
  }, [opts.onToolCall])

  useEffect(() => {
    const sub = actorRef.on("TOOL_CALL", (event) => {
      onToolCallRef.current?.(event.toolCall)
    })
    return () => sub.unsubscribe()
  }, [actorRef])

  const onScenarioActivateRef = useRef(opts.onScenarioActivate)
  useEffect(() => {
    onScenarioActivateRef.current = opts.onScenarioActivate
  }, [opts.onScenarioActivate])

  useEffect(() => {
    const sub = actorRef.on("SCENARIO_ACTIVATE", (event) => {
      onScenarioActivateRef.current?.(
        (event as { activate: { id: string; props: Record<string, unknown> } }).activate,
      )
    })
    return () => sub.unsubscribe()
  }, [actorRef])

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      actorRef.send({ type: "USER_MESSAGE", content: trimmed })
    },
    [actorRef],
  )

  return { messages, isLoading, error, sendMessage }
}
