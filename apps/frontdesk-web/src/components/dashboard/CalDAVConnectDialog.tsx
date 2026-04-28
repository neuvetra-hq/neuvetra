import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

const API_URL = import.meta.env.VITE_API_URL as string

type Preset = "apple" | "fastmail" | "nextcloud" | "other"

const PRESETS: Record<Preset, { label: string; serverUrl: string; serverEditable: boolean; passwordLabel: string; usernameLabel: string; helpText?: string }> = {
  apple: {
    label:          "Apple iCloud",
    serverUrl:      "https://caldav.icloud.com",
    serverEditable: false,
    usernameLabel:  "Apple ID (email)",
    passwordLabel:  "App-specific password",
    helpText:       "Generate one at appleid.apple.com → Sign-In and Security → App-Specific Passwords",
  },
  fastmail: {
    label:          "Fastmail",
    serverUrl:      "https://caldav.fastmail.com",
    serverEditable: false,
    usernameLabel:  "Fastmail email",
    passwordLabel:  "App password",
    helpText:       "Create one in Fastmail → Settings → Privacy & Security → App Passwords",
  },
  nextcloud: {
    label:          "Nextcloud",
    serverUrl:      "",
    serverEditable: true,
    usernameLabel:  "Username",
    passwordLabel:  "Password",
  },
  other: {
    label:          "Other CalDAV server",
    serverUrl:      "",
    serverEditable: true,
    usernameLabel:  "Username",
    passwordLabel:  "Password",
  },
}

interface CalDAVConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected: (providerEmail: string) => void
  /** Override business ID + auth token (used during onboarding before AuthContext is populated) */
  businessId?: string
  accessToken?: string
}

export function CalDAVConnectDialog({
  open, onOpenChange, onConnected,
  businessId: businessIdProp, accessToken: accessTokenProp,
}: CalDAVConnectDialogProps) {
  const { business, session } = useAuth()
  const resolvedBusinessId   = businessIdProp ?? business?.id ?? ""
  const resolvedAccessToken  = accessTokenProp ?? session?.access_token ?? ""
  const [preset, setPreset]       = useState<Preset>("apple")
  const [serverUrl, setServerUrl] = useState(PRESETS.apple.serverUrl)
  const [username, setUsername]   = useState("")
  const [password, setPassword]   = useState("")
  const [loading, setLoading]     = useState(false)

  const cfg = PRESETS[preset]

  const handlePresetChange = (value: string) => {
    const p = value as Preset
    setPreset(p)
    setServerUrl(PRESETS[p].serverUrl)
  }

  const handleConnect = async () => {
    if (!resolvedBusinessId) return
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      toast.error("Please fill in all fields")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/calendar/caldav/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolvedAccessToken}`,
        },
        body: JSON.stringify({
          businessId: resolvedBusinessId,
          serverUrl:  serverUrl.trim(),
          username:   username.trim(),
          password:   password.trim(),
        }),
      })
      const data = await res.json() as { connected?: boolean; providerEmail?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to connect")
      toast.success("Calendar connected!")
      onConnected(data.providerEmail ?? username)
      onOpenChange(false)
      setUsername("")
      setPassword("")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect CalDAV Calendar</DialogTitle>
          <DialogDescription>
            Connect Apple iCloud, Fastmail, Nextcloud, or any CalDAV-compatible calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Provider select */}
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select
              items={Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label }))}
              value={preset}
              onValueChange={(v) => { if (v) handlePresetChange(v) }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.entries(PRESETS).map(([value, p]) => (
                    <SelectItem key={value} value={value}>{p.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Server URL */}
          <div className="space-y-1.5">
            <Label htmlFor="caldav-server">Server URL</Label>
            <Input
              id="caldav-server"
              placeholder="https://caldav.example.com"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              disabled={!cfg.serverEditable}
              className={!cfg.serverEditable ? "opacity-60" : ""}
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="caldav-username">{cfg.usernameLabel}</Label>
            <Input
              id="caldav-username"
              placeholder={cfg.usernameLabel}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="caldav-password">{cfg.passwordLabel}</Label>
            <Input
              id="caldav-password"
              type="password"
              placeholder={cfg.passwordLabel}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {cfg.helpText && (
              <p className="text-xs text-muted-foreground">{cfg.helpText}</p>
            )}
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={handleConnect} disabled={loading}>
            {loading ? "Connecting…" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
