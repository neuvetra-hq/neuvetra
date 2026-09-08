import ReactMarkdown from "react-markdown"
import type { ChatMessage as ChatMessageType } from "@/hooks/useChat"

export interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={[
          "max-w-[92%] break-words rounded-2xl px-4 py-3 text-left leading-relaxed sm:max-w-[85%]",
          isUser
            ? "bg-white/10 text-white"
            : "bg-white/5 text-white/90",
        ].join(" ")}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm md:text-base">
            {message.content}
          </p>
        ) : (
          <div className="text-sm md:text-base [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_a]:text-blue-200 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-white">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
