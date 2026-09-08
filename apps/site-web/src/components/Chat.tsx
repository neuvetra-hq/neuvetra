import { useEffect, useRef, useState, type FormEvent } from "react"
import type { UseChatResult } from "@/hooks/useChat"
import { ChatMessage } from "@/components/ChatMessage"

export interface ChatProps {
  /** Lifted from App so layout decisions can read chat state too. */
  chat: UseChatResult
}

const JOST = "'Jost Variable', 'Jost', sans-serif"

// Icons mirror the existing App.tsx ChatInput definitions (lucide-style, 1.8 stroke).
// SendIcon is new — replaces the prior non-functional VoiceWaveIcon submit button.

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 12l18-9-4 9 4 9-18-9z" />
    </svg>
  )
}

function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="rounded-2xl bg-white/5 px-4 py-3 text-white/60">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:200ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:400ms]" />
        </span>
      </div>
    </div>
  )
}

export function Chat({ chat }: ChatProps) {
  const { messages, isLoading, error, sendMessage } = chat
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the message list to bottom on new content.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    })
  }, [messages, isLoading])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = input
    setInput("")
    sendMessage(value)
  }

  const hasMessages = messages.length > 0 || isLoading

  return (
    <div
      className="pointer-events-auto flex w-full max-w-2xl flex-col gap-4"
      style={{ fontFamily: JOST }}
    >
      {hasMessages && (
        <div
          ref={scrollRef}
          role="log"
          aria-label="Conversation with Iris"
          aria-live="polite"
          className="chat-scroll flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-1 py-2"
        >
          {messages.map((m, i) => (
            <ChatMessage key={i} message={m} />
          ))}
          {isLoading && <TypingIndicator />}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400/80" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex w-full items-center gap-1 rounded-full px-2 py-2 shadow-[0_12px_44px_rgba(0,0,0,0.2)] backdrop-blur-md transition-colors focus-within:border-white/40 sm:gap-2 sm:px-3"
        style={{
          background: "rgba(0, 0, 0, 0.32)",
          border: "1px solid rgba(120, 170, 220, 0.30)",
        }}
      >
        <button
          type="button"
          aria-label="Attach"
          title="Attachments are not available yet"
          disabled
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white/25 cursor-default"
        >
          <PlusIcon />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything"
          aria-label="Message Iris"
          disabled={isLoading}
          className="flex-1 min-w-0 bg-transparent px-2 text-white placeholder:text-white/45 outline-none disabled:opacity-50"
          style={{
            fontFamily: JOST,
            fontWeight: 300,
            fontSize: "1rem",
            letterSpacing: "0.02em",
          }}
        />

        <button
          type="button"
          aria-label="Dictate"
          title="Dictation is not available yet"
          disabled
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white/25 cursor-default"
        >
          <MicIcon />
        </button>

        <button
          type="submit"
          aria-label="Send"
          disabled={isLoading || !input.trim()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/70 text-black transition-colors duration-150 hover:bg-white/85 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  )
}
