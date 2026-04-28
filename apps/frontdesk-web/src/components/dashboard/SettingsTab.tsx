import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { KnowledgeBaseTab } from "@/components/dashboard/KnowledgeBaseTab"

const API_URL = import.meta.env.VITE_API_URL as string

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const
type Day = typeof DAYS[number]

const TIMEZONES = [
  { value: "America/New_York",    label: "Eastern Time (ET) — New York, Miami" },
  { value: "America/Chicago",     label: "Central Time (CT) — Chicago, Dallas" },
  { value: "America/Denver",      label: "Mountain Time (MT) — Denver, Salt Lake City" },
  { value: "America/Phoenix",     label: "Mountain Time — Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT) — Los Angeles, Seattle" },
  { value: "America/Anchorage",   label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu",    label: "Hawaii Time (HT)" },
  { value: "Europe/London",       label: "London (GMT/BST)" },
  { value: "Europe/Paris",        label: "Central European Time (CET)" },
  { value: "Asia/Dubai",          label: "Gulf Standard Time (GST) — Dubai" },
  { value: "Asia/Kolkata",        label: "India Standard Time (IST)" },
  { value: "Asia/Singapore",      label: "Singapore Time (SGT)" },
  { value: "Australia/Sydney",    label: "Australian Eastern Time (AET)" },
] as const

interface DayHours {
  open: boolean
  from: string
  to: string
}

type BusinessHours = Record<Day, DayHours>

const DEFAULT_HOURS: BusinessHours = {
  Monday:    { open: true,  from: "09:00", to: "17:00" },
  Tuesday:   { open: true,  from: "09:00", to: "17:00" },
  Wednesday: { open: true,  from: "09:00", to: "17:00" },
  Thursday:  { open: true,  from: "09:00", to: "17:00" },
  Friday:    { open: true,  from: "09:00", to: "17:00" },
  Saturday:  { open: false, from: "09:00", to: "14:00" },
  Sunday:    { open: false, from: "09:00", to: "14:00" },
}

export function SettingsTab() {
  const { business, session } = useAuth()
  const navigate = useNavigate()
  const [hours, setHours]               = useState<BusinessHours>(DEFAULT_HOURS)
  const [timezone, setTimezone]         = useState("America/Los_Angeles")
  const [saving, setSaving]             = useState(false)
  const [agentName, setAgentName]       = useState("")
  const [businessName, setBusinessName] = useState("")
  const [ownerPhone, setOwnerPhone]     = useState("")
  const [collectAddress, setCollectAddress] = useState(false)
  const [agentSaving, setAgentSaving]   = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting]         = useState(false)

  useEffect(() => {
    if (!business?.aiConfig) return
    const cfg = business.aiConfig
    if (cfg.agentName)     setAgentName(cfg.agentName as string)
    if (cfg.businessName)  setBusinessName(cfg.businessName as string)
    if (cfg.ownerPhone)    setOwnerPhone(cfg.ownerPhone as string)
    setCollectAddress(!!(cfg.collectAddress as boolean | undefined))
    if (cfg.businessHours) setHours(cfg.businessHours as BusinessHours)
    if (cfg.timezone)      setTimezone(cfg.timezone as string)
  }, [business?.id])

  const handleSaveAgent = async () => {
    if (!business?.id) return
    setAgentSaving(true)
    try {
      const res  = await fetch(`${API_URL}/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ aiConfig: { agentName, businessName, ownerPhone, collectAddress } }),
      })
      const data = await res.json() as { updated?: boolean; error?: string }
      if (data.error) throw new Error(data.error)
      toast.success("Agent settings saved")
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to save")
    } finally {
      setAgentSaving(false)
    }
  }

  const updateDay = (day: Day, patch: Partial<DayHours>) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  const handleSaveHours = async () => {
    if (!business?.id) return
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ aiConfig: { businessHours: hours, timezone } }),
      })
      const data = await res.json() as { updated?: boolean; error?: string }
      if (data.error) throw new Error(data.error)
      toast.success("Settings saved")
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const res  = await fetch(`${API_URL}/billing/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!data.success) throw new Error(data.error ?? "Deletion failed")
      await supabase.auth.signOut()
      navigate("/", { replace: true })
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to delete account")
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  return (
    <div className="space-y-10 max-w-2xl">

      {/* ── AI Agent ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI Agent</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Customize how your AI receptionist introduces itself and who to call in an emergency.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agent-name">Agent name</Label>
            <Input
              id="agent-name"
              placeholder="e.g. Alex"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              How the AI introduces itself — "Hi, I'm Alex, calling on behalf of…"
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="business-display-name">Business display name</Label>
            <Input
              id="business-display-name"
              placeholder={`e.g. ${business?.name?.split(" ").slice(0, 2).join(" ") ?? "Nima's Plumbing"}`}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The name the AI uses when speaking with callers. Leave blank to use your full registered business name.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emergency-phone">Emergency contact number</Label>
            <Input
              id="emergency-phone"
              placeholder="e.g. +14155551234"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              If a caller reports an emergency, the AI will immediately transfer to this number.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 py-1">
            <div className="space-y-0.5">
              <Label htmlFor="collect-address">Collect customer address</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, the AI will ask for the customer's full address during booking and attach it to the calendar event.
              </p>
            </div>
            <Switch
              id="collect-address"
              checked={collectAddress}
              onCheckedChange={setCollectAddress}
            />
          </div>
        </div>

        <Button onClick={handleSaveAgent} disabled={agentSaving}>
          {agentSaving ? "Saving…" : "Save agent settings"}
        </Button>
      </section>

      {/* ── Business Hours ───────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Business Hours</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your AI will mention these hours when callers ask. It still answers calls 24/7.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select
              items={TIMEZONES.map((tz) => ({ label: tz.label, value: tz.value }))}
              value={timezone}
              onValueChange={(v) => { if (v) setTimezone(v) }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              All appointment times will be booked in this timezone.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {DAYS.map((day, i) => (
            <div
              key={day}
              className={`flex items-center gap-4 px-5 py-3.5 ${i < DAYS.length - 1 ? "border-b border-border" : ""}`}
            >
              <Switch
                checked={hours[day].open}
                onCheckedChange={(open) => updateDay(day, { open })}
              />
              <span className={`w-24 text-sm font-medium ${hours[day].open ? "text-foreground" : "text-muted-foreground"}`}>
                {day}
              </span>
              {hours[day].open ? (
                <div className="flex items-center gap-2 text-sm">
                  <Input
                    type="time"
                    value={hours[day].from}
                    onChange={(e) => updateDay(day, { from: e.target.value })}
                    className="w-auto px-2.5 py-1.5 text-sm"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={hours[day].to}
                    onChange={(e) => updateDay(day, { to: e.target.value })}
                    className="w-auto px-2.5 py-1.5 text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Closed</span>
              )}
            </div>
          ))}
        </div>

        <Button onClick={handleSaveHours} disabled={saving}>
          {saving ? "Saving…" : "Save hours"}
        </Button>
      </section>

      {/* ── Knowledge Base ───────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Q&amp;A pairs your AI uses to answer callers about your business.
          </p>
        </div>
        <KnowledgeBaseTab />
      </section>

      {/* ── Danger Zone ──────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Permanent actions that cannot be undone.
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-card p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Delete my account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cancels your subscription, releases your AI phone number, and permanently deletes all your data.
            </p>
          </div>

          {!deleteConfirm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              Delete my account
            </Button>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Are you sure?</p>
              <p className="text-xs text-red-600 dark:text-red-300">
                This will immediately cancel your Stripe subscription, release your Twilio number, and delete all calls, messages, and settings. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {deleting ? "Deleting…" : "Yes, delete everything"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
