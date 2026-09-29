import { Icon } from "./Icon"

/** Short, closable orientation above the setup and activity screens. Copy only; the screens themselves are unchanged. */
export function PanelGuide({ kind, onAsk }: { kind: "setup" | "collection"; onAsk: () => void }) {
  if (kind === "setup") return <details className="nv-guide" open>
    <summary><Icon name="info" size={18} />Before you start: what company setup needs</summary>
    <div className="nv-guide__body">
      <ol>
        <li>Your legal name, country and the reporting year (usually January 1 – December 31).</li>
        <li>Your boundary approach — most companies use operational control.</li>
        <li>Every site you used during the year, including leased space, and who runs its equipment.</li>
        <li>Yes/no answers about the kinds of sources you have: heating, generators, vehicles, cooling.</li>
      </ol>
      <p><strong>Your answers are saved when you choose “Save setup” (or “Save correction”) in the last section, 07 Review.</strong> Anything you’re unsure of can stay “Not sure yet”; it stays visible for review. <button type="button" className="nv-link" onClick={onAsk}>Ask about boundaries or sites</button></p>
    </div>
  </details>
  return <details className="nv-guide" open>
    <summary><Icon name="info" size={18} />How to add a record (about two minutes each)</summary>
    <div className="nv-guide__body">
      <ol>
        <li>Upload the bill or log under <strong>Private evidence</strong> at the bottom of this page.</li>
        <li>Under <strong>New activity record</strong>, choose the activity type, then the site and the account, meter or equipment ID.</li>
        <li>Enter the dates and the amount and unit exactly as printed on the document.</li>
        <li>Tick the uploaded file under “Evidence linked to this version”, then <strong>Save activity</strong>.</li>
      </ol>
      <p>Missing details are listed under “Input needed”. You can save now and come back — nothing missing is counted as zero. <button type="button" className="nv-link" onClick={onAsk}>Ask about a field</button></p>
    </div>
  </details>
}
