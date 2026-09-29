import { useState } from "react"
import { Icon } from "./Icon"

const KEY = (kind: string) => `neuvetra:guide:${kind}`
function remembered(kind: string): boolean | null {
  try { const value = window.localStorage.getItem(KEY(kind)); return value === "open" ? true : value === "closed" ? false : null } catch { return null }
}

/** Short, closable orientation above the setup and activity screens. Copy only; the screens themselves are unchanged. */
export function PanelGuide({ kind, defaultOpen, onAsk }: { kind: "setup" | "collection"; defaultOpen: boolean; onAsk: () => void }) {
  const [open, setOpen] = useState(() => remembered(kind) ?? defaultOpen)
  function toggle(next: boolean) { setOpen(next); try { window.localStorage.setItem(KEY(kind), next ? "open" : "closed") } catch { /* private mode: keep the in-page choice only */ } }
  const summary = kind === "setup" ? "What company setup needs, and when it saves" : "How to add a record (about two minutes each)"
  return <details className="nv-guide" open={open} onToggle={event => toggle((event.currentTarget as HTMLDetailsElement).open)}>
    <summary><Icon name="info" size={18} />{summary}</summary>
    {kind === "setup" ? <div className="nv-guide__body">
      <ol>
        <li>Your legal name, country and the reporting year (usually January 1 – December 31).</li>
        <li>Your boundary approach — most companies use operational control.</li>
        <li>Every site you used during the year, including leased space, and who runs its equipment.</li>
        <li>Yes/no answers about the kinds of sources you have: heating, generators, vehicles, cooling.</li>
      </ol>
      <p><strong>Your answers are saved when you choose “Save setup” (or “Save correction”) in the last section, 07 Review.</strong> Anything you’re unsure of can stay “Not sure yet”; it stays visible for review. <button type="button" className="nv-link" onClick={onAsk}>Ask about boundaries or sites</button></p>
    </div> : <div className="nv-guide__body">
      <ol>
        <li>Upload the bill or log under <strong>Private evidence</strong> at the bottom of this page.</li>
        <li>Under <strong>New activity record</strong>, choose the activity type, then the site and the account, meter or equipment ID.</li>
        <li>Enter the dates and the amount as a plain number without commas (8450, not 8,450). Use one of the units listed under the unit field — for example therm, MMBtu or ccf for gas, kWh or MWh for electricity.</li>
        <li>Tick the uploaded file under “Evidence linked to this version”, then <strong>Save activity</strong>.</li>
      </ol>
      <p>Missing details are listed under “Input needed”. You can save now and come back — nothing missing is counted as zero. <button type="button" className="nv-link" onClick={onAsk}>Ask about a field</button></p>
    </div>}
  </details>
}
