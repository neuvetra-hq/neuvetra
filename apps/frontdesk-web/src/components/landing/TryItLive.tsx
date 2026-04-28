import { Phone, PhoneOff, Mic, MicOff, Loader2 } from "lucide-react"
import { Container } from "@/components/layout/Container"
import { useVoiceCall } from "@/hooks/useVoiceCall"

const DISPLAY_NUMBER = "(650) 830-8181"

export function TryItLive() {
  const { status, isMuted, duration, errorMessage, start, hangUp, toggleMute } = useVoiceCall()

  return (
    <section className="relative overflow-hidden bg-background py-24 md:py-32">
      {/* Radial glow behind the button */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <Container className="relative">
        <div className="mx-auto max-w-2xl text-center">
          {/* Label */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Live Demo
            </span>
          </div>

          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Hear it for yourself
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
            Call our AI receptionist right now — straight from your browser.
            No signup, no wait.
          </p>

          {/* Interactive call widget */}
          <div className="mt-12 flex flex-col items-center gap-6">
            {status === "idle" && (
              <CallIdleState onCall={start} displayNumber={DISPLAY_NUMBER} />
            )}
            {status === "connecting" && <CallConnectingState />}
            {status === "in-call" && (
              <CallActiveState
                duration={duration}
                isMuted={isMuted}
                onHangUp={hangUp}
                onToggleMute={toggleMute}
              />
            )}
            {status === "ended" && <CallEndedState />}
            {status === "error" && <CallErrorState message={errorMessage} />}
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Or call directly:{" "}
            <a
              href={`tel:+16508308181`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {DISPLAY_NUMBER}
            </a>
          </p>
        </div>
      </Container>
    </section>
  )
}

function CallIdleState({
  onCall,
  displayNumber,
}: {
  onCall: () => void
  displayNumber: string
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={onCall}
        className="group relative flex size-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        aria-label="Start call"
      >
        {/* Pulse rings */}
        <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
        <span className="absolute -inset-3 rounded-full border border-emerald-500/20" />
        <span className="absolute -inset-6 rounded-full border border-emerald-500/10" />
        <Phone className="size-9 transition-transform group-hover:scale-110" />
      </button>

      <div className="text-center">
        <p className="text-base font-semibold text-foreground">Call our AI receptionist</p>
        <p className="text-sm text-muted-foreground">{displayNumber}</p>
      </div>
    </div>
  )
}

function CallConnectingState() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex size-24 items-center justify-center rounded-full bg-muted">
        <Loader2 className="size-9 animate-spin text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Connecting…</p>
    </div>
  )
}

function CallActiveState({
  duration,
  isMuted,
  onHangUp,
  onToggleMute,
}: {
  duration: string
  isMuted: boolean
  onHangUp: () => void
  onToggleMute: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Status indicator */}
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Connected · {duration}
        </span>
      </div>

      {/* Waveform animation */}
      <div className="flex items-end gap-1" style={{ height: 32 }}>
        {[4, 10, 6, 16, 8, 20, 10, 14, 6, 18, 8, 12, 5, 16, 9].map((h, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-emerald-500/70"
            style={{
              height: h,
              animation: `wave ${0.5 + i * 0.06}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.04}s`,
            }}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMute}
          className={`flex size-14 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            isMuted
              ? "border-foreground/20 bg-muted text-muted-foreground"
              : "border-border bg-background text-foreground hover:bg-muted"
          }`}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>

        <button
          onClick={onHangUp}
          className="flex size-16 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-transform hover:scale-105 hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          aria-label="Hang up"
        >
          <PhoneOff className="size-6" />
        </button>
      </div>

      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

function CallEndedState() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex size-24 items-center justify-center rounded-full bg-muted">
        <PhoneOff className="size-9 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Call ended</p>
    </div>
  )
}

function CallErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-4 text-center">
      <p className="text-sm font-medium text-destructive">{message}</p>
    </div>
  )
}
