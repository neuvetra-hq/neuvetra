import { useState, type RefObject } from "react"
import { createSyntheticWorkspace, revisitSyntheticWorkspace, type CompanyWorkspace, type WorkspaceActor } from "@/lib/workspace-api"

const STORAGE_KEY = "neuvetra:m54:synthetic-workspace-id"

export function CompanyWorkspaceDemo({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [actor, setActor] = useState<WorkspaceActor>("owner")
  const [workspace, setWorkspace] = useState<CompanyWorkspace | null>(null)
  const [savedId, setSavedId] = useState(() => window.localStorage.getItem(STORAGE_KEY) ?? "")
  const [message, setMessage] = useState("Ready to create the fixed synthetic workspace.")
  const [busy, setBusy] = useState(false)

  async function run(action: "create" | "revisit") {
    setBusy(true)
    setWorkspace(null)
    try {
      const result = action === "create"
        ? await createSyntheticWorkspace(actor)
        : await revisitSyntheticWorkspace(savedId, actor)
      setWorkspace(result)
      setSavedId(result.id)
      window.localStorage.setItem(STORAGE_KEY, result.id)
      setMessage(action === "create" ? "Workspace created in one transaction." : "The saved workspace was revisited.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The workspace is unavailable.")
    } finally {
      setBusy(false)
    }
  }

  function changeActor(next: WorkspaceActor) {
    setActor(next)
    setWorkspace(null)
    setMessage(next === "owner" ? "Synthetic owner selected." : next === "outsider" ? "Synthetic outsider selected." : "Signed out.")
  }

  return (
    <section className="workspace-demo" aria-labelledby="workspace-heading">
      <div className="workspace-demo-heading">
        <div>
          <p className="research-eyebrow">Stage 4 development demonstration</p>
          <h1 id="workspace-heading" ref={headingRef} tabIndex={-1}>A company boundary begins with a tenant boundary.</h1>
          <p className="research-intro">Create and revisit one fixed synthetic California company. A second identity sees the same safe “not found” response as an unknown workspace.</p>
        </div>
        <span className="research-outline-label">Local · synthetic · memory only</span>
      </div>

      <div className="workspace-identity" role="group" aria-label="Synthetic identity">
        {(["owner", "outsider", "signed_out"] as const).map((item) => (
          <button type="button" key={item} disabled={busy} aria-pressed={actor === item} onClick={() => changeActor(item)}>
            {item === "owner" ? "Signed-in owner" : item === "outsider" ? "Other tenant" : "Signed out"}
          </button>
        ))}
      </div>

      <div className="workspace-actions">
        <button className="research-primary-button" type="button" disabled={busy || actor !== "owner" || Boolean(savedId)} onClick={() => run("create")}>Create synthetic workspace</button>
        <button className="research-secondary-button" type="button" disabled={busy || !savedId} onClick={() => run("revisit")}>Revisit saved workspace</button>
        <button className="research-text-link" type="button" disabled={busy || !savedId} onClick={() => { window.localStorage.removeItem(STORAGE_KEY); setSavedId(""); setWorkspace(null); setMessage("Saved browser pointer cleared; database rows were not changed.") }}>Clear browser pointer</button>
      </div>

      <p className="workspace-message" role="status" aria-live="polite">{busy ? "Checking the tenant boundary…" : message}</p>

      {workspace && (
        <div className="workspace-record">
          <div><span>Company</span><strong>{workspace.companyName}</strong><small>{workspace.countryCode} / {workspace.stateCode}</small></div>
          <div><span>Facility</span><strong>{workspace.facility.name}</strong><small>eGRID subregion {workspace.facility.egridSubregion}</small></div>
          <div><span>Boundary</span><strong>{workspace.boundary.reportingYear} · Operational control</strong><small>Draft · version {workspace.boundary.version}</small></div>
        </div>
      )}

      <p className="workspace-boundary-note">Development evidence only. No customer data, upload, production database, factor release, filing or assurance is involved.</p>
    </section>
  )
}
