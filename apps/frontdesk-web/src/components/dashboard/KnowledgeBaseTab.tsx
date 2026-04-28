import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Trash2, Plus, BookOpen, Pencil, Check, X, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

const API_URL = import.meta.env.VITE_API_URL as string

interface KBItem {
  id:        string
  question:  string
  answer:    string
  category:  string | null
  sortOrder: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Single KB item row — supports inline editing
// ---------------------------------------------------------------------------

function KBItemRow({
  item,
  onSave,
  onDelete,
}: {
  item: KBItem
  onSave: (id: string, answer: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState(item.answer)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)

  const hasPlaceholder = item.answer.includes("[") && item.answer.includes("]")

  const handleSave = async () => {
    setSaving(true)
    await onSave(item.id, draft)
    setSaving(false)
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(item.answer)
    setEditing(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete(item.id)
  }

  return (
    <div className={`rounded-xl border bg-card p-5 space-y-3 ${hasPlaceholder && !editing ? "border-amber-200 dark:border-amber-800/50" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <p className="flex-1 font-medium text-foreground text-sm leading-snug">{item.question}</p>
        <div className="flex items-center gap-1 shrink-0">
          {!editing && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => { setDraft(item.answer); setEditing(true) }}
              className="size-7 text-muted-foreground/50 hover:text-foreground"
              aria-label="Edit"
            >
              <Pencil size={13} />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleting}
            className="size-7 text-muted-foreground/40 hover:text-red-500"
            aria-label="Delete"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Check size={13} className="mr-1" />
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              <X size={13} className="mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{item.answer}</p>
          {hasPlaceholder && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
              Fill in the highlighted placeholders [in brackets] for this answer.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add form
// ---------------------------------------------------------------------------

function AddForm({ onAdd, onCancel }: { onAdd: (q: string, a: string) => Promise<void>; onCancel: () => void }) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer]     = useState("")
  const [saving, setSaving]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || !answer.trim()) return
    setSaving(true)
    await onAdd(question.trim(), answer.trim())
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="kb-question">Question</Label>
        <Input
          id="kb-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What are your business hours?"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="kb-answer">Answer</Label>
        <Textarea
          id="kb-answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="We're open Monday–Friday, 9am–5pm."
          rows={3}
          className="resize-none"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving || !question.trim() || !answer.trim()}>
          {saving ? "Saving…" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------

export function KnowledgeBaseTab() {
  const { business, session } = useAuth()
  const [items, setItems]       = useState<KBItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchItems = async () => {
    if (!business?.id) return
    const res  = await fetch(`${API_URL}/businesses/${business.id}/knowledge-base`)
    const data = await res.json() as { items: KBItem[] }
    const fetched = data.items ?? []

    // Auto-seed if empty — no button needed, just load defaults silently
    if (fetched.length === 0) {
      const seedRes    = await fetch(`${API_URL}/businesses/${business.id}/knowledge-base/seed`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      })
      const seedResult = await seedRes.json() as { seeded?: boolean; count?: number }
      if (seedResult.seeded) {
        const res2  = await fetch(`${API_URL}/businesses/${business.id}/knowledge-base`)
        const data2 = await res2.json() as { items: KBItem[] }
        setItems(data2.items ?? [])
        setLoading(false)
        return
      }
    }

    setItems(fetched)
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [business?.id])

  const handleAdd = async (question: string, answer: string) => {
    if (!business?.id) return
    const res    = await fetch(`${API_URL}/businesses/${business.id}/knowledge-base`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ question, answer }),
    })
    const result = await res.json() as { item?: KBItem; error?: string }
    if (result.error) { toast.error(result.error); return }
    setItems((prev) => [...prev, result.item!])
    setShowForm(false)
    toast.success("Added to knowledge base")
  }

  const handleSave = async (id: string, answer: string) => {
    if (!business?.id) return
    const res    = await fetch(`${API_URL}/businesses/${business.id}/knowledge-base/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ answer }),
    })
    const result = await res.json() as { item?: KBItem; error?: string }
    if (result.error) { toast.error(result.error); return }
    setItems((prev) => prev.map((i) => i.id === id ? result.item! : i))
    toast.success("Saved")
  }

  const handleDelete = async (id: string) => {
    if (!business?.id) return
    await fetch(`${API_URL}/businesses/${business.id}/knowledge-base/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
    setItems((prev) => prev.filter((i) => i.id !== id))
    toast.success("Removed")
  }

  // Group by category
  const categories = Array.from(
    new Set(items.map((i) => i.category ?? "General"))
  )
  const grouped = Object.fromEntries(
    categories.map((cat) => [cat, items.filter((i) => (i.category ?? "General") === cat)])
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const placeholderCount = items.filter(
    (i) => i.answer.includes("[") && i.answer.includes("]")
  ).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Q&A pairs your AI uses to answer callers. Click any answer to edit it.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} size="sm" className="gap-1.5 shrink-0">
          <Plus size={14} />
          Add Q&A
        </Button>
      </div>

      {/* Placeholder warning */}
      {placeholderCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            <strong>{placeholderCount} answer{placeholderCount > 1 ? "s" : ""}</strong> still have placeholders [in brackets] — click the pencil icon to fill them in with your specific details.
          </AlertDescription>
        </Alert>
      )}

      {/* Add form */}
      {showForm && (
        <AddForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {/* Empty state */}
      {items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <BookOpen className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground">No Q&A pairs yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Click "Add Q&A" to add your first entry.
          </p>
        </div>
      )}

      {/* Grouped items */}
      {items.length > 0 && categories.map((category) => (
        <section key={category} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {category}
          </h3>
          {grouped[category].map((item) => (
            <KBItemRow
              key={item.id}
              item={item}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))}
        </section>
      ))}

    </div>
  )
}
