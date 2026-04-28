import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { ChevronDown } from "lucide-react"

interface Topic {
  id: string
  title: string
  content: React.ReactNode
}

function Accordion({ topics }: { topics: Topic[] }) {
  const [open, setOpen] = useState<string | null>(topics[0]?.id ?? null)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
      {topics.map((topic) => (
        <div key={topic.id}>
          <button
            onClick={() => setOpen(open === topic.id ? null : topic.id)}
            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
          >
            <span className="text-sm font-medium text-foreground">{topic.title}</span>
            <ChevronDown
              size={16}
              className={`shrink-0 text-muted-foreground transition-transform ${open === topic.id ? "rotate-180" : ""}`}
            />
          </button>
          {open === topic.id && (
            <div className="px-5 pb-5 text-sm text-muted-foreground space-y-2">
              {topic.content}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function HelpTab() {
  const { business } = useAuth()
  const number = business?.twilioNumber

  const callForwardingTopics: Topic[] = [
    {
      id: "iphone",
      title: "iPhone",
      content: (
        <ol className="space-y-1 list-decimal list-inside">
          <li>Open <strong>Settings</strong></li>
          <li>Tap <strong>Phone</strong></li>
          <li>Tap <strong>Call Forwarding</strong> and turn it on</li>
          <li>Enter your AI number: <span className="font-mono font-semibold text-foreground">{number ?? "your AI number"}</span></li>
        </ol>
      ),
    },
    {
      id: "android",
      title: "Android",
      content: (
        <ol className="space-y-1 list-decimal list-inside">
          <li>Open the <strong>Phone</strong> app</li>
          <li>Tap ⋮ <strong>Menu → Settings → Calls</strong></li>
          <li>Tap <strong>Call forwarding → Forward when unanswered</strong></li>
          <li>Enter your AI number: <span className="font-mono font-semibold text-foreground">{number ?? "your AI number"}</span></li>
        </ol>
      ),
    },
    {
      id: "carrier",
      title: "AT&T / T-Mobile / Verizon (dial code)",
      content: (
        <div className="space-y-2">
          <p>Dial this code directly from your phone to forward unanswered calls:</p>
          {number ? (
            <p className="font-mono text-base font-semibold text-foreground bg-muted rounded-lg px-4 py-2 inline-block">
              *71{number.replace(/\D/g, "").slice(-10)}
            </p>
          ) : (
            <p className="font-mono text-base font-semibold text-foreground bg-muted rounded-lg px-4 py-2 inline-block">
              *71[your 10-digit AI number]
            </p>
          )}
          <p className="text-xs">To cancel forwarding, dial <span className="font-mono">*73</span>.</p>
        </div>
      ),
    },
    {
      id: "voip",
      title: "VoIP / Office phone system",
      content: (
        <p>
          Contact your VoIP provider or phone system administrator and ask them to forward calls to{" "}
          <span className="font-mono font-semibold text-foreground">{number ?? "your AI number"}</span>{" "}
          when unanswered. Most providers support this in their admin portal under <strong>Call Routing</strong> or <strong>Hunt Groups</strong>.
        </p>
      ),
    },
  ]

  const productTopics: Topic[] = [
    {
      id: "how-it-works",
      title: "How does Front Desk work?",
      content: (
        <div className="space-y-2">
          <p>Front Desk gives your business a dedicated AI phone number. When a caller rings and you don't answer, the call forwards to your AI number where your AI receptionist picks up.</p>
          <p>The AI can answer questions about your business, check your calendar availability, and book appointments — all in a natural conversation.</p>
        </div>
      ),
    },
    {
      id: "what-can-ai-do",
      title: "What can my AI receptionist do?",
      content: (
        <ul className="space-y-1.5 list-disc list-inside">
          <li>Answer questions about your business hours, services, and pricing</li>
          <li>Check your calendar and book appointments (when a calendar is connected)</li>
          <li>Reschedule or cancel existing appointments</li>
          <li>Take a callback request when scheduling is unavailable</li>
          <li>Transfer the caller to you in case of an emergency</li>
        </ul>
      ),
    },
    {
      id: "knowledge-base",
      title: "How does the AI know about my business?",
      content: (
        <p>
          Your AI pulls from the <strong>Knowledge Base</strong> you configure in Settings. It contains Q&amp;A pairs — things like your pricing, services, parking, and policies. The more you fill in, the better your AI performs. Go to <strong>Settings → Knowledge Base</strong> to review and edit.
        </p>
      ),
    },
    {
      id: "missed-call",
      title: "What happens if the AI can't answer a question?",
      content: (
        <p>
          If the caller asks something the AI doesn't know, it will politely say it doesn't have that information and offer to take a callback request so you can follow up. Callback requests appear in the <strong>Messages</strong> tab.
        </p>
      ),
    },
    {
      id: "notifications",
      title: "Will I be notified when something happens?",
      content: (
        <ul className="space-y-1.5 list-disc list-inside">
          <li>You'll get an SMS when a new appointment is booked, rescheduled, or cancelled</li>
          <li>Callback requests appear in the Messages tab with the caller's name and number</li>
          <li>All calls are logged in the Call Logs tab with a summary</li>
        </ul>
      ),
    },
    {
      id: "billing-faq",
      title: "How does billing work?",
      content: (
        <div className="space-y-2">
          <p>Your plan includes a set number of AI minutes per month. Each call deducts from your included minutes based on the call duration (rounded up to the nearest minute).</p>
          <p>If you exceed your included minutes, overage is charged automatically at your plan's per-minute rate at the end of your billing period.</p>
          <p>You can view your current usage and switch plans anytime in the <strong>Billing</strong> tab.</p>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Help</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Setup guides and answers to common questions about Front Desk.
        </p>
      </div>

      {/* Call forwarding */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Setting up call forwarding</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Forward missed calls from your existing business number to your AI Front Desk number
            {number ? <> — <span className="font-mono font-semibold text-foreground">{number}</span></> : ""}.
          </p>
        </div>
        <Accordion topics={callForwardingTopics} />
      </section>

      {/* Product FAQ */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Frequently asked questions</h2>
        <Accordion topics={productTopics} />
      </section>

      {/* Support CTA */}
      <section className="rounded-xl border border-border bg-muted/40 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Still have a question?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Our team usually responds within a few hours.</p>
        </div>
        <a
          href="mailto:support@neuvetra.com"
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          Contact support →
        </a>
      </section>
    </div>
  )
}
