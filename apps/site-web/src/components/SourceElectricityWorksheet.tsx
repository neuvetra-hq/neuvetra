import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react"
import { LIMITATION_LABELS, WORKSHEET_LIMITATIONS, sourceWorksheetRequest, type SourceElectricityWorksheet as Worksheet, type SourceWorksheetVersion } from "@/lib/m66-api"
import { SourceWorksheetReports } from "./SourceWorksheetReports"
import { listElectricitySources, uploadElectricitySource, readElectricitySource, type ElectricitySource } from "@/lib/m66-api"
import sampleA from "../../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf?url"
import sampleB from "../../../../output/pdf/neuvetra-m66-synthetic-electricity-bill-b.pdf?url"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"

export function SourceElectricityWorksheet({ actor, workspaceId, headingRef }: { actor: HostedWorkspaceActor; workspaceId: string | null; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [sources,setSources] = useState<ElectricitySource[]>([])
  const [sourceId,setSourceId] = useState("")
  const [file,setFile] = useState<File|null>(null)
  const [confirmed,setConfirmed] = useState(false)
  const [difference,setDifference] = useState("")
  const uploadKey=useRef<{file:File;key:string}|null>(null)
  const lifecycle=useRef({active:true})
  useEffect(()=>{const state=lifecycle.current;state.active=true;return()=>{state.active=false}},[])
  const [saved, setSaved] = useState<Worksheet | null>(null)
  const [company, setCompany] = useState("Synthetic Acme, Inc.")
  const [facility, setFacility] = useState("Synthetic California office")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(Boolean(workspaceId))
  const [message, setMessage] = useState(workspaceId ? "Loading your worksheet…" : "No company workspace is assigned. Contact the staging owner.")
  const [error, setError] = useState(false)
  const [choice, setChoice] = useState<"accept_bounded_internal_draft" | "changes_requested">("accept_bounded_internal_draft")
  const [note, setNote] = useState("")
  const [acknowledged, setAcknowledged] = useState<string[]>([])
  const requestLock = useRef(false)
  const pending = useRef<{ signature: string; key: string } | null>(null)
  const actorRef = useRef(actor)
  const source=sources.find(s=>s.id===sourceId)
  const current = saved?.versions[saved.versions.length - 1]
  const manager = actor.role !== "member"
  const canReview = manager && current && current.createdBy !== actor.userId && !current.review
  const statusRef = useRef<HTMLParagraphElement>(null)

  function accept(data: Worksheet, fill = true) {
    setSaved(data)
    const latest = data.versions[data.versions.length - 1]
    if (latest && fill) { setCompany(latest.companyLabel); setFacility(latest.facilityLabel); setQuantity(latest.quantityKwh); setSourceId(latest.evidence.source.id); setDifference(latest.evidence.quantityDifferenceReason ?? "") }
    setConfirmed(false)
    setEditing(false); setReason(""); setAcknowledged([]); setNote("")
  }
  useEffect(() => {
    let alive = true
    if (!workspaceId) return
    Promise.all([sourceWorksheetRequest(actorRef.current, workspaceId),listElectricitySources(actorRef.current,workspaceId)]).then(([data,files]) => { if (alive) { setSources(files); accept(data); setMessage(data.versions.length ? "Your saved worksheet is ready." : "Enter a fictional quantity to create your first draft.") } }).catch(e => { if (alive && !actorRef.current.signal?.aborted) { setError(true); setMessage(e instanceof Error ? e.message : "Could not load the worksheet.") } }).finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [workspaceId])

  async function run(action: "read" | "create" | "corrections" | "reviews", payload?: Record<string, unknown>) {
    if (!workspaceId || requestLock.current || actor.signal?.aborted) return
    requestLock.current = true; setBusy(true); setError(false)
    const signature = JSON.stringify({ action, payload })
    if (action !== "read" && pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID() }
    try {
      const data = await sourceWorksheetRequest(actor, workspaceId, action, payload ? { ...payload, idempotencyKey: pending.current!.key } as Parameters<typeof sourceWorksheetRequest>[3] : undefined)
      actor.signal?.throwIfAborted(); if(!lifecycle.current.active)return; setSources(await listElectricitySources(actor,workspaceId)); if(!lifecycle.current.active || actor.signal?.aborted)return; accept(data); pending.current = null
      setMessage(action === "read" ? "Your saved worksheet is up to date." : action === "reviews" ? "The decision is saved for this exact version. The worksheet remains an incomplete, unreleased draft." : "The draft is saved. A different manager can now review this exact version.")
    } catch (e) { if (lifecycle.current.active && !actor.signal?.aborted) { setError(true); setMessage(e instanceof Error ? e.message : "Could not save the worksheet.") } }
    finally { requestLock.current = false; if (lifecycle.current.active && !actor.signal?.aborted) { setBusy(false); statusRef.current?.focus() } }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if(!source || !confirmed)return
    const payload = { sourceId:source.id, expectedSourceSha256:source.sha256, sourcePage:1, manualConfirmation:true, quantityDifferenceReason:Number(quantity)===Number(source.printedQuantityKwh)?null:difference, companyLabel: company, facilityLabel: facility, quantityKwh: quantity, period: "2023-01", geography: "CAMX", unit: "kWh" }
    void run(current ? "corrections" : "create", current ? { ...payload, expectedVersionId: current.id, expectedResultSha256: current.resultSha256, correctionReason: reason } : payload)
  }
  function review(event: FormEvent) { event.preventDefault(); if (current) void run("reviews", { versionId: current.id, expectedResultSha256: current.resultSha256, decision: choice, note: choice === "changes_requested" ? note : null, acknowledgedLimitations: choice === "accept_bounded_internal_draft" ? WORKSHEET_LIMITATIONS.filter(item => acknowledged.includes(item)) : [] }) }

  async function billAction(action:"upload"|"download",selected?:ElectricitySource){
    if(!workspaceId||requestLock.current||actor.signal?.aborted)return
    requestLock.current=true;setBusy(true);setError(false)
    try{
      if(action==="upload" && file){
        if(uploadKey.current?.file!==file)uploadKey.current={file,key:crypto.randomUUID()}
        const uploaded=await uploadElectricitySource(actor,workspaceId,file,uploadKey.current.key)
        const files=await listElectricitySources(actor,workspaceId)
        if(!lifecycle.current.active||actor.signal?.aborted)return
        setSources(files);setSourceId(uploaded.id);setConfirmed(false);uploadKey.current=null;setMessage("Bill retained. Download and inspect it, then manually confirm the quantity below.")
      } else if(selected){
        const bytes=await readElectricitySource(actor,selected)
        if(!lifecycle.current.active||actor.signal?.aborted)return
        const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));const link=document.createElement("a");link.href=url;link.download=selected.originalName;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
        setMessage("PDF byte integrity was checked and the file downloaded. This does not verify its contents. Open it to inspect page 1.")
      }
    }catch(e){if(lifecycle.current.active&&!actor.signal?.aborted){setError(true);setMessage(e instanceof Error?e.message:"The bill action failed.")}}
    finally{requestLock.current=false;if(lifecycle.current.active&&!actor.signal?.aborted){setBusy(false);statusRef.current?.focus()}}
  }
  return <section className="worksheet">
    <p className="worksheet-eyebrow">Private · synthetic · deterministic</p>
    <h1 ref={headingRef} tabIndex={-1}>Bill-linked electricity worksheet</h1>
    <p>Retain a supplied fictional bill, manually confirm its quantity, and ask another manager to review the source and saved calculation.</p>
    <div className="worksheet-context"><span>January 2023</span><span>United States · California · CAMX</span><span>Operational control · Location-based Scope 2</span></div>
    <p>One fictional facility only. The annual 2023 regional factor is applied to January consumption. Other months and inventory sources remain incomplete.</p>
    <p ref={statusRef} tabIndex={-1} role={error ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>
    <button type="button" disabled={busy || !workspaceId} onClick={() => void run("read")}>Refresh saved worksheet</button>
    {saved && manager && (!current || editing) && <section className="worksheet-card">
      <h2>1. Retain a fictional supporting bill</h2>
      <p>Only these two supplied test PDFs are supported. Both state 12,345 kWh for January 2023. Attaching a document does not verify its contents.</p>
      <p><a href={sampleA} download="neuvetra-m55-synthetic-electricity-bill.pdf">Download sample bill A</a> · <a href={sampleB} download="neuvetra-m66-synthetic-electricity-bill-b.pdf">Download sample bill B</a></p>
      <label>Choose a supplied fictional PDF<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);uploadKey.current=null}} /></label>
      <button type="button" disabled={busy||!file} onClick={()=>void billAction("upload")}>Upload supporting bill</button>
      <p>Maximum 256 KiB. A retained upload stays available even if you cancel an unsaved worksheet.</p>
    </section>}
    {saved && manager && (!current || editing) && <form className="worksheet-card worksheet-form" onSubmit={submit}>
      <h2>{current ? `Correct version ${current.version}` : "Create a synthetic draft"}</h2>
      <p>{current ? "Saving creates a new version. Replace the source or change the quantity, and explain the correction. Earlier sources and reviews remain in history." : "Use invented labels and quantities only. Do not enter customer data."}</p>
      <fieldset disabled={busy}>
        <label>Supporting bill<select required value={sourceId} onChange={e=>{setSourceId(e.target.value);setConfirmed(false)}}><option value="">Choose a retained bill</option>{sources.map(s=><option key={s.id} value={s.id}>{s.originalName} / {s.id.slice(0,8)}</option>)}</select></label>
        {source && <><p>Printed quantity: {source.printedQuantityKwh} kWh · Page 1</p><button type="button" onClick={()=>void billAction("download",source)}>Download selected bill to inspect</button></>}

        <label>Fictional company<input required maxLength={100} value={company} onChange={e => {setCompany(e.target.value);setConfirmed(false)}} /></label>
        <label>Fictional facility<input required maxLength={100} value={facility} onChange={e => {setFacility(e.target.value);setConfirmed(false)}} /></label>
        <label>Electricity used (kWh)<input required inputMode="decimal" maxLength={11} aria-describedby="quantity-help" value={quantity} onChange={e => {setQuantity(e.target.value);setConfirmed(false)}} /></label>
        <p id="quantity-help">Enter 0 to 1,000,000 with up to three decimal places, without commas. Zero is an explicit entry; an empty field is missing.</p>
        {source && Number(quantity)!==Number(source.printedQuantityKwh) && <label>Why does the entered quantity differ from the bill?<textarea required maxLength={500} value={difference} onChange={e=>{setDifference(e.target.value);setConfirmed(false)}} /></label>}
        <label className="worksheet-check"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />I inspected page 1 and manually confirmed this fictional entry and any difference from the printed quantity.</label>
        {current && <label>Reason for correction<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>}
        <button type="submit">{busy ? "Saving…" : current ? "Save corrected version" : "Save and calculate draft"}</button>
        {current && <button type="button" onClick={() => { accept(saved); setMessage("Correction discarded. The saved version is unchanged.") }}>Cancel correction</button>}
      </fieldset>
    </form>}
    {saved && !manager && !current && <p>A manager has not saved a worksheet yet. Your access is read-only.</p>}
    {current && <>
      <VersionCard onDownload={s=>void billAction("download",s)} busy={busy} version={current} label={editing ? "Previously saved result — unsaved edits are not calculated" : "Current saved draft"} />
      {saved && !editing && <SourceWorksheetReports key={current.id + (current.review?.id ?? "none")} actor={actor} worksheet={saved} version={current} />}
      {manager && !editing && <button type="button" disabled={busy} onClick={() => { setEditing(true); setMessage("Choose another bill or enter a corrected quantity and a reason. The saved result below will remain unchanged until you save.") }}>Correct quantity or replace bill</button>}
      {!manager && <p>Your access is read-only. A manager can correct or review this worksheet.</p>}
      {manager && current.createdBy === actor.userId && !current.review && <p>A different authorized manager must review this version. You cannot review your own entry.</p>}
      {canReview && !editing && <form className="worksheet-card worksheet-form" onSubmit={review}>
        <h2>Review version {current.version}</h2><p>Check the fictional labels, quantity and saved subtotal above. Your decision applies only to this saved version.</p>
        <fieldset disabled={busy}><legend>Decision</legend>
          <label className="worksheet-check"><input type="radio" name="review-decision" checked={choice === "accept_bounded_internal_draft"} onChange={() => setChoice("accept_bounded_internal_draft")} />Accept for bounded internal use</label>
          <label className="worksheet-check"><input type="radio" name="review-decision" checked={choice === "changes_requested"} onChange={() => setChoice("changes_requested")} />Request a correction</label>
          {choice === "accept_bounded_internal_draft" ? WORKSHEET_LIMITATIONS.map(item => <label className="worksheet-check" key={item}><input type="checkbox" required checked={acknowledged.includes(item)} onChange={e => setAcknowledged(values => e.target.checked ? [...values, item] : values.filter(v => v !== item))} />{LIMITATION_LABELS[item]}</label>) : <label>What should be corrected?<textarea required maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>}
          <button type="submit">Save review decision</button>
        </fieldset>
      </form>}
      {saved && saved.versions.length > 1 && <details className="worksheet-history"><summary>Previous versions ({saved.versions.length - 1})</summary>{saved.versions.slice(0, -1).reverse().map(v => <div key={v.id}><VersionCard onDownload={s=>void billAction("download",s)} busy={busy} version={v} label="Historical saved draft" /><SourceWorksheetReports actor={actor} worksheet={saved} version={v} /></div>)}</details>}
    </>}
    <p className="worksheet-footnote">Fictional supporting bills and manual confirmation only. This worksheet is incomplete and unreleased, with no assurance. It does not change the saved example report.</p>
  </section>
}

function VersionCard({ version: v, label, onDownload, busy }: { version: SourceWorksheetVersion; label: string; onDownload:(source:ElectricitySource)=>void; busy:boolean }) {
  return <article className="worksheet-card"><p className="worksheet-eyebrow">{label} · Version {v.version}</p><h2>{v.companyLabel}</h2><p>{v.facilityLabel}</p>
    <p>Supporting bill: {v.evidence.source.originalName} · Page {v.evidence.page}</p>
    <p>Printed quantity: {v.evidence.source.printedQuantityKwh} kWh. Entered quantity: {v.quantityKwh} kWh.</p>
    {v.evidence.quantityDifferenceReason && <p>Quantity difference: {v.evidence.quantityDifferenceReason}</p>}
    <button type="button" disabled={busy} onClick={()=>onDownload(v.evidence.source)}>Download retained bill for version {v.version}</button>
    <details><summary>Supporting bill fingerprint</summary><p className="worksheet-fingerprint">{v.evidence.source.sha256}</p><p>Manually confirmed at {v.evidence.confirmedAt}. This attachment does not verify the bill.</p></details>
    <dl className="worksheet-result"><div><dt>January electricity</dt><dd>{v.quantityKwh} kWh</dd></div><div><dt>Location-based subtotal</dt><dd>{v.total.display} <small>kg CO2e</small></dd></div></dl>
    <p>{v.review ? v.review.decision === "accept_bounded_internal_draft" ? "Accepted for bounded internal use — still incomplete and unreleased." : "Correction requested by another manager." : "Awaiting a different manager’s review."}</p>
    {v.correctionReason && <p>Correction reason: {v.correctionReason}</p>}{v.review?.note && <p>Reviewer’s note: {v.review.note}</p>}
    <details><summary>Calculation and saved-version details</summary><dl className="worksheet-details"><dt>Converted electricity</dt><dd>{v.quantityMwh} MWh</dd><dt>Candidate factor</dt><dd>{v.method.factorValue} {v.method.factorUnit} · eGRID2023 revision 2 · SRL23, AI6</dd><dt>Exact subtotal before display rounding</dt><dd>{v.total.unrounded} kg CO2e</dd><dt>Display rounding</dt><dd>Four decimal places, half to even. Decimal precision does not establish measurement certainty.</dd><dt>Saved input fingerprint</dt><dd>{v.inputSha256}</dd><dt>Saved result fingerprint</dt><dd>{v.resultSha256}</dd>{v.review && <><dt>Review fingerprint</dt><dd>{v.review.decisionSha256}</dd></>}</dl></details>
  </article>
}
