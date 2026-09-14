import { useEffect, useRef, useState } from "react"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import type { ElectricityWorksheet, WorksheetVersion } from "@/lib/m64-api"
import { createWorksheetReport, listWorksheetReports, readWorksheetReportHtml, type WorksheetReport } from "@/lib/m65-api"

export function WorksheetReports({actor, worksheet, version}: {actor:HostedWorkspaceActor; worksheet:ElectricityWorksheet; version:WorksheetVersion}) {
  const [reports,setReports] = useState<WorksheetReport[]>([])
  const [selected,setSelected] = useState<WorksheetReport|null>(null)
  const [html,setHtml] = useState("")
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState("")
  const [error,setError] = useState(false)
  const lock = useRef(false)
  const requestKey = useRef<{signature:string; key:string}|null>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const status = useRef<HTMLParagraphElement>(null)
  const lifecycle = useRef({active:true})
  useEffect(() => { const state=lifecycle.current; state.active=true; return () => { state.active=false } }, [])
  const allowed = () => !actor.signal?.aborted
  async function run(action:"list"|"create"|"open"|"print"|"download", report?:WorksheetReport) {
    if (lock.current || !allowed()) return
    lock.current = true; setBusy(true); setError(false)
    const state = lifecycle.current
    const active = () => state.active && allowed()
    try {
      if (action === "list") {
        const list = await listWorksheetReports(actor,worksheet)
        if (!active()) return
        setReports(list.filter(r=>r.sourceVersionId===version.id)); setMessage("Saved reports refreshed. Each report retains its review state at creation.")
      } else if (action === "create") {
        const payload = {sourceVersionId:version.id,expectedInputSha256:version.inputSha256,expectedResultSha256:version.resultSha256,expectedReviewId:version.review?.id ?? null,expectedReviewSha256:version.review?.decisionSha256 ?? null}
        const signature = JSON.stringify(payload)
        if (requestKey.current?.signature !== signature) requestKey.current = {signature,key:crypto.randomUUID()}
        const saved = await createWorksheetReport(actor,worksheet,{...payload,idempotencyKey:requestKey.current.key})
        const body = await readWorksheetReportHtml(actor,worksheet,saved)
        if (!active()) return
        setReports(previous=>[saved,...previous.filter(r=>r.id!==saved.id)]); setSelected(saved); setHtml(body); requestKey.current=null
        setMessage("Report saved and verified. Later worksheet changes will not change this snapshot.")
      } else if (report) {
        // Reauthorize and verify the exact bytes for every open, print and download action.
        const body = await readWorksheetReportHtml(actor,worksheet,report)
        if (!active()) return
        setSelected(report); setHtml(body)
        if (action === "download") {
          const url=URL.createObjectURL(new Blob([body],{type:"text/html;charset=utf-8"})); const link=document.createElement("a")
          link.href=url; link.download=`synthetic-worksheet-v${version.version}-${report.id}.html`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
          setMessage("The verified HTML report was downloaded. It remains a synthetic, incomplete draft.")
        } else if (action === "print") {
          // The already displayed frame has the same verified immutable bytes.
          if (selected?.id !== report.id || html !== body || !frame.current?.contentWindow) throw new Error("Open this report before printing.")
          frame.current.contentWindow.print(); setMessage("Print preview requested. Browser print settings may change page layout.")
        } else setMessage("Saved report verified. Its review state is the snapshot at creation, not a live approval.")
      }
    } catch(e) { if(active()) {setError(true);setMessage(e instanceof Error ? e.message : "The report is unavailable.")} }
    finally { lock.current=false; if(active()){setBusy(false);status.current?.focus()} }
  }
  return <section className="worksheet-reports" aria-label={`Reports for version ${version.version}`}>
    <h3>Report for version {version.version}</h3>
    <p>Create a readable snapshot of this saved quantity and its worksheet review. The report itself has no separate approval.</p>
    <div className="worksheet-report-actions">
      {actor.role !== "member" && <button type="button" disabled={busy} onClick={()=>void run("create")}>Create report for version {version.version}</button>}
      <button type="button" disabled={busy} onClick={()=>void run("list")}>Find saved reports for version {version.version}</button>
    </div>
    {message && <p ref={status} tabIndex={-1} role={error ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>}
    {reports.length > 0 && <ul className="worksheet-report-list">{reports.map(r=><li key={r.id}><button type="button" disabled={busy} onClick={()=>void run("open",r)}>Open report Â· {new Date(r.createdAt).toLocaleString()} Â· {r.reviewState === "unreviewed" ? "Worksheet unreviewed" : r.reviewState === "changes_requested" ? "Worksheet correction requested" : "Worksheet accepted for bounded use"}</button></li>)}</ul>}
    {selected && html && <div className="worksheet-report-view">
      <p>Saved report for version {version.version}. Review state was captured when this report was created.</p>
      <div className="worksheet-report-actions"><button type="button" disabled={busy} onClick={()=>void run("print",selected)}>Print report</button><button type="button" disabled={busy} onClick={()=>void run("download",selected)}>Download HTML report</button><button type="button" disabled={busy} onClick={()=>{setHtml("");setSelected(null)}}>Close report</button></div>
      <details><summary>Report fingerprint</summary><p className="worksheet-fingerprint">{selected.reportSha256}</p></details>
      <iframe ref={frame} title={`Synthetic electricity report for version ${version.version}`} sandbox="allow-same-origin allow-modals" srcDoc={html} />
      <p>Saved or printed copies cannot be recalled if account access later changes.</p>
    </div>}
  </section>
}
