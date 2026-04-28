import { Phone, PhoneOff, Mic, MicOff, Loader2 } from "lucide-react"
import { useLocation } from "react-router"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useVoiceCallContext } from "@/contexts/VoiceCallContext"

const MARKETING_PATHS = ["/", "/contact"]
function isMarketingRoute(pathname: string) {
  return MARKETING_PATHS.includes(pathname) || pathname.startsWith("/industries")
}

const DEMO_NUMBER = "+1 (650) 433-9442"

export function CallFAB() {
  const { status, isMuted, duration, errorMessage, start, hangUp, toggleMute } = useVoiceCallContext()
  const { pathname } = useLocation()
  const onMarketing = isMarketingRoute(pathname)

  // Nothing to show: not on marketing routes and no active call
  if (!onMarketing && status === "idle") return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* In-call panel — always visible when call is active */}
      {status === "in-call" && (
        <div className="flex flex-col items-end gap-3 rounded-2xl border border-border bg-background px-5 py-4 shadow-xl ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-end gap-0.5" style={{ height: 20 }}>
              {[4, 10, 6, 16, 8, 14, 6, 12, 8, 16].map((h, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-green-500/70"
                  style={{
                    height: h,
                    animation: `wave ${0.5 + i * 0.07}s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.04}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-sm font-semibold tabular-nums text-green-500">{duration}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
              className={`flex size-9 items-center justify-center rounded-full border transition-colors focus-visible:outline-none ${
                isMuted
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>
            <button
              onClick={hangUp}
              aria-label="Hang up"
              className="flex size-9 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-transform hover:scale-105 hover:bg-red-400 focus-visible:outline-none"
            >
              <PhoneOff className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error / ended message */}
      {(status === "error" || status === "ended") && (
        <div className="rounded-xl border border-border bg-background px-4 py-2.5 shadow-xl ring-1 ring-white/10">
          <p className="text-xs font-medium text-muted-foreground">
            {status === "ended" ? "Call ended" : errorMessage}
          </p>
        </div>
      )}

      {/* FAB button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={status === "idle" ? start : undefined}
                disabled={status === "connecting"}
                aria-label="Call our AI receptionist"
                className={`flex size-12 items-center justify-center rounded-full shadow-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  status === "in-call"
                    ? "bg-green-500 ring-2 ring-green-500/50 ring-offset-2 ring-offset-background hover:bg-green-600 focus-visible:ring-green-500"
                    : status === "connecting"
                    ? "cursor-wait bg-green-500/70 focus-visible:ring-green-500"
                    : "bg-green-500 hover:scale-110 hover:bg-green-600 focus-visible:ring-green-500"
                }`}
              />
            }
          >
            {status === "connecting" ? (
              <Loader2 className="size-5 animate-spin text-white" />
            ) : status === "in-call" ? (
              <Phone className="size-5 animate-pulse text-white" strokeWidth={2.2} />
            ) : (
              <Phone className="size-5 text-white" strokeWidth={2.2} />
            )}
          </TooltipTrigger>

          {status === "idle" && (
            <TooltipContent side="top" sideOffset={12} className="flex flex-col gap-1 px-4 py-3 shadow-xl ring-1 ring-white/10">
              <span className="text-xs font-medium opacity-75">Click to call · or dial from your phone</span>
              <span className="text-sm font-bold text-primary">{DEMO_NUMBER}</span>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}
