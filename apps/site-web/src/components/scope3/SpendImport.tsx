import { useEffect, useMemo, useState } from "react"
import { parseScope3SpendCsv, scope3DecimalSum, scope3SpendImportTemplate, type Scope3SpendImportLine, type Scope3SpendParse } from "../../../../../packages/neuvetra-database/src/scope3-spend-import"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { reasonText } from "@/lib/plain-language"
import { listCollectionActivities, saveCollectionActivity, uploadCollectionEvidence } from "@/lib/collection-api"
import { scope3NaicsGuard, SCOPE3_NAICS_GUARD_TEXT } from "@/lib/scope3-forms"
import { scope3NaicsChoices, scope3NaicsTitle } from "@/lib/scope3-naics"
// Round 2c integration (walk item 4): each dollar figure says its basis (net of credits, or purchases before credits).
import { SPEND_BASIS_TEXT_R2C } from "@/lib/scope3-text-r2c"
// Round 3 lane C (decisions 8 and 9, PR-11): suggestion confidence, withdraw suggestions, category from the account.
import { SPEND_TEXT_R3C } from "@/lib/scope3-text-r3c"
import { SPEND_IMPORT_ANCHOR, takeSpendImportFocus } from "@/lib/spend-import-target"
import {
  convertScope3SpendCurrency, importScope3SpendFile, loadScope3SpendImports, saveScope3SpendMapping, scope3SpendDuplicatePairs, scope3SpendMappingBody, withdrawScope3SpendImport,
  Scope3SpendImportApiError, SCOPE3_SPEND_TEMPLATE_PATH, type Scope3SpendImportResult, type Scope3SpendImportsView, type Scope3SpendLineView, type Scope3SpendMappingView,
} from "@/lib/scope3-spend-import-api"
import {
  scope3SpendAmountBasis, scope3SpendHoldFix, scope3SpendNaicsSuggestions, scope3SpendSuggest, spendMoney, scope3SpendOtherHolds, scope3SpendProgress, scope3SpendReviewGroups, scope3SpendSupersessionReconciliation,
  type Scope3NaicsSuggestion, type Scope3SpendReviewGroup,
} from "@/lib/scope3-spend-review"

/**
 * Spend CSV import and review (Scope 3 completion I-09; round 2 UX-1, ACC-16: Claude, 31 October 2026; DESIGN §7.3).
 * 1. Upload a ledger CSV (kept as evidence) → preview with the shared parser (every refusal, totals per currency, a line
 *    table with what will be held) → location → import → reconciliation and holds by reason.
 * 2. Review grid: a progress meter (lines and US dollars mapped), then tabs. "Needs a code": lines whose only holds a
 *    mapping resolves, grouped by vendor and GL account, with NAICS suggestions (the company's own mappings, then a keyword
 *    match on the EPA titles); one mapping per group (remembered for later files), several groups at once, or a per-line
 *    override. "Other holds": every other held line by reason, with its own fix (open the line, or withdraw it).
 *    "Possible duplicates" side by side. "Counted": what goes to the calculation.
 * 3. Supersession: each supplier or partner record beside the spend lines it replaces (amounts as recorded; never counted).
 * Never calculates emissions.
 */
const CATEGORY_WORDS: Record<number, string> = { 1: "1 · Purchased goods and services", 2: "2 · Capital goods", 4: "4 · Upstream transport", 5: "5 · Waste", 6: "6 · Business travel" }
const PAGE = 25
type Tab = "code" | "other" | "duplicates" | "counted"
type MappingChoice = { category: number; naicsCode: string; marginChoice: "with_margins" | "without_margins"; categoryConfirmed: boolean | null; activityOverlapConfirmed: boolean | null }
type MappingTarget = { scope: "group" | "line"; glAccount: string; vendor: string; description: string; mapping: Scope3SpendMappingView | null; lines: number }

const share = (part: string, whole: string) => Number(whole) > 0 ? Math.min(100, Math.round(Number(part) / Number(whole) * 1000) / 10) : 0
const matches = (query: string, ...texts: string[]) => !query.trim() || query.trim().toLowerCase().split(/\s+/).every(word => texts.some(text => text.toLowerCase().includes(word)))

export function SpendImport({ companyId, actor, onChanged, onOpenRecord }: { companyId: string; actor: HostedWorkspaceActor; onChanged?: () => void; onOpenRecord?: (recordId: string) => void }) {
  const [view, setView] = useState<Scope3SpendImportsView | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array<ArrayBuffer>; type: string } | null>(null)
  const preview = useMemo<Scope3SpendParse | null>(() => file ? parseScope3SpendCsv(file.bytes, { period: view?.reportingPeriod ?? null }) : null, [file, view?.reportingPeriod])
  const [previewAll, setPreviewAll] = useState(false)
  const [locationId, setLocationId] = useState("")
  const [result, setResult] = useState<Scope3SpendImportResult | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [reload, setReload] = useState(0)
  const [tab, setTab] = useState<Tab>("code")
  const [query, setQuery] = useState("")
  const [shown, setShown] = useState(PAGE)
  const [selected, setSelected] = useState<string[]>([])
  const [withdrawal, setWithdrawal] = useState<{ importId: string; reason: string } | null>(null)
  // Round 3 lane C (PR-11): one rate per currency (US dollars per unit), its source and date, as typed.
  const [rates, setRates] = useState<Record<string, { rate: string; rateSource: string; rateDate: string }>>({})

  useEffect(() => {
    let live = true
    loadScope3SpendImports(companyId, actor).then(next => {
      if (!live) return
      setView(next); setLoadError(null); setLocationId(current => current || next.locations[0]?.id || "")
      // Round 3 lane C (PR-3): opened from the Overview, the to-do list or a category row: show the asked-for tab and come into view.
      const asked = takeSpendImportFocus()
      if (!asked) return
      setTab(asked); setShown(PAGE)
      if (typeof document !== "undefined") requestAnimationFrame(() => { const panel = document.getElementById(SPEND_IMPORT_ANCHOR), heading = panel?.querySelector("[data-spend-review-heading]") as HTMLElement | null; (heading ?? panel)?.scrollIntoView({ block: "start" }); heading?.focus({ preventScroll: true }) })
    })
      .catch(error => { if (live) {
        const problem = error instanceof Scope3SpendImportApiError && error.unavailable ? "Spend import needs database schema 30." : "Spend imports could not be loaded."
        setLoadError(problem)
      } })
    return () => { live = false }
  }, [companyId, actor, reload])

  // Round 3 lane C (decision 9, PR-4): a new file always clears the previous file's preview and errors first, and a file
  // that cannot be read says so (never a silent, stale preview).
  const choose = async (picked: File | undefined) => {
    setResult(null); setProblems([]); setMessage(null); setPreviewAll(false); setFile(null)
    if (!picked) return
    try {
      const bytes = new Uint8Array(await picked.arrayBuffer())
      setFile({ name: picked.name, bytes, type: picked.type || "text/csv" })
    } catch (error) {
      setMessage(`${SPEND_TEXT_R3C.unreadable} ${error instanceof Error ? error.message : ""}`.trim())
    }
  }
  const runImport = async () => {
    if (!file || !preview?.ok || !locationId || busy) return
    setBusy(true); setMessage(null); setProblems([])
    try {
      const upload = await uploadCollectionEvidence(companyId, new File([file.bytes], file.name, { type: "text/csv" }), crypto.randomUUID(), actor)
      const imported = await importScope3SpendFile(companyId, file.bytes, upload.receipt.evidenceId, locationId, actor)
      setResult(imported)
      setMessage(imported.replayed ? "This exact file was imported before: nothing new was saved." : `Imported ${imported.saved} spend lines.`)
      setTab("code"); setSelected([]); setReload(n => n + 1); onChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The import failed; nothing was saved.")
      if (error instanceof Scope3SpendImportApiError) setProblems(error.problems.map(p => `${p.line ? `Line ${p.line}: ` : ""}${p.message}`))
    } finally { setBusy(false) }
  }
  /** One correction per line (confirm distinct, or withdraw with a reason), each against the record's current version. */
  const withdrawImport = async () => {
    if (!withdrawal || busy || !view?.canManage || withdrawal.reason.trim().length < 3) return
    setBusy(true); setMessage(null)
    try {
      const receipt = await withdrawScope3SpendImport(companyId, withdrawal.importId, withdrawal.reason, actor)
      setMessage(receipt.message); setWithdrawal(null); setSelected([]); setResult(null)
      setReload(n => n + 1); onChanged?.()
    } catch (error) { setMessage(error instanceof Error ? error.message : "This import could not be withdrawn.") }
    finally { setBusy(false) }
  }
  const correct = async (recordIds: string[], change: "distinct" | "withdraw", withdrawalReason = "Duplicate of an earlier imported spend line.") => {
    if (busy || !view?.canManage) return
    setBusy(true); setMessage(null)
    const saved: string[] = []
    try {
      const records = await listCollectionActivities(companyId, actor)
      for (const recordId of recordIds) {
        const record = records.find(item => item.id === recordId)
        if (!record) throw new Error("The line could not be found; reload and try again.")
        const version = record.currentVersion, activity = version.activity
        const next = change === "distinct"
          ? { ...activity, payload: { ...(activity.payload as Record<string, unknown>), duplicateConfirmedDistinct: true } }
          : { ...activity, state: "withdrawn" as const, withdrawalReason }
        await saveCollectionActivity(companyId, recordId, { idempotencyKey: crypto.randomUUID(), expectedRevision: version.revision, expectedVersionId: version.id,
          correctionReason: change === "distinct" ? "Confirmed not a duplicate of the earlier imported line." : withdrawalReason === "Duplicate of an earlier imported spend line." ? "Withdrawn as a duplicate of an earlier imported line." : `Withdrawn from the spend review: ${withdrawalReason}`, activity: next as typeof activity }, actor)
        saved.push(recordId)
      }
      if (change === "withdraw" && withdrawalReason !== "Duplicate of an earlier imported spend line.") setMessage(`${recordIds.length} line${recordIds.length === 1 ? "" : "s"} withdrawn.`)
    } catch (error) {
      const problem = error instanceof Error ? error.message : "The line could not be saved."
      setMessage(`${saved.length ? `${saved.length} of ${recordIds.length} lines ${change === "withdraw" ? "withdrawn" : "confirmed distinct"}; check the remaining lines before retrying. ` : ""}${problem}`)
    } finally {
      if (saved.length) {
        // Reflect confirmed saves even when the subsequent refresh is rate-limited or unavailable.
        setView(current => current ? { ...current, lines: current.lines.map(line => !saved.includes(line.recordId) ? line : change === "withdraw"
          ? { ...line, state: "withdrawn", plan: { action: "hold", status: "withdrawn", reasons: ["record_withdrawn"] } }
          : { ...line, duplicateConfirmedDistinct: true }) } : current)
        setSelected([]); setReload(n => n + 1); onChanged?.()
      }
      setBusy(false)
    }
  }
  /** Round 3 lane C (PR-11): every held line in one currency converted on the server, in one transaction. */
  const convert = async (currency: string) => {
    const typed = rates[currency]
    if (!typed) return
    setBusy(true); setMessage(null)
    try {
      const done = await convertScope3SpendCurrency(companyId, { currency, rate: typed.rate.trim(), rateSource: typed.rateSource.trim(), rateDate: typed.rateDate }, actor)
      setMessage(SPEND_TEXT_R3C.converted(done.converted.length, currency, typed.rate.trim(), typed.rateSource.trim(), typed.rateDate, done.skipped))
      setReload(n => n + 1); onChanged?.()
    } catch (error) { setMessage(error instanceof Error ? error.message : SPEND_TEXT_R3C.convertFailed) } finally { setBusy(false) }
  }
  /** One mapping per target (a group, or one line key), saved in turn; each corrects its own lines on the server. */
  const saveMappings = async (targets: MappingTarget[], choice: MappingChoice) => {
    setBusy(true); setMessage(null)
    let corrected = 0, saved = 0
    try {
      for (const target of targets) {
        const result = await saveScope3SpendMapping(companyId, scope3SpendMappingBody(target, choice), actor)
        corrected += result.corrected.length; saved++
      }
      setMessage(`Mapping saved${targets.length > 1 ? ` for ${saved} groups` : ""}; ${corrected} line(s) corrected.`)
      setSelected([]); setReload(n => n + 1); onChanged?.()
    } catch (error) {
      setMessage(`${saved ? `${saved} of ${targets.length} mappings saved; then: ` : ""}${error instanceof Error ? error.message : "The mapping could not be saved."}`)
      if (saved) setReload(n => n + 1)
    } finally { setBusy(false) }
  }

  const groups = view ? scope3SpendReviewGroups(view) : []
  const other = view ? scope3SpendOtherHolds(view) : []
  const duplicates = view ? scope3SpendDuplicatePairs(view) : []
  const progress = view ? scope3SpendProgress(view) : null
  const supersession = view ? scope3SpendSupersessionReconciliation(view) : []
  const countedLines = view ? view.lines.filter(line => line.state === "active" && line.plan.action === "calculate") : []
  const visibleGroups = groups.filter(group => matches(query, group.vendor, group.glAccount, ...group.descriptions, ...group.glDescriptions))
  const chosen = groups.filter(group => selected.includes(group.keyInput))
  const canManage = view?.canManage !== false
  const otherCount = other.reduce((n, entry) => n + entry.lines.length, 0)
  // Round 3 lane C (PR-11): the currencies of active imported lines still held for their currency, with counts and totals.
  const foreign = view ? [...new Set(view.lines.filter(line => line.state === "active" && line.supersededBy === null && line.plan.reasons.includes("currency_not_supported")).map(line => line.currency))].sort().map(currency => {
    const mine = view.lines.filter(line => line.state === "active" && line.supersededBy === null && line.currency === currency && line.plan.reasons.includes("currency_not_supported"))
    const plain = mine.filter(line => /^-?(0|[1-9][0-9]*)(\.[0-9]{1,3})?$/.test(line.amount))
    return { currency, lines: mine.length, total: spendMoney(scope3DecimalSum(plain.map(line => line.amount)), currency) }
  }) : []
  const target = (group: Scope3SpendReviewGroup): MappingTarget => ({ scope: group.scope, glAccount: group.glAccount, vendor: group.vendor, description: group.scope === "group" ? "" : group.lines[0]!.description, mapping: group.mapping, lines: group.lines.length - group.overrides.size })
  const lineTarget = (line: Scope3SpendLineView, mapping: Scope3SpendMappingView | null): MappingTarget => ({ scope: "line", glAccount: line.glAccount, vendor: line.vendor, description: line.description, mapping, lines: 1 })
  const previewLines = preview?.lines ?? []

  return (
    <section aria-label="Spend import" className="spend-import" id={SPEND_IMPORT_ANCHOR} tabIndex={-1}>
      <div className="spend-import__head">
        <div>
          <h3 className="nv-h3">Import spend from a ledger CSV</h3>
          <p className="nv-subtle">One line per purchase. Each line becomes a spend record: calculated, or held with a reason. Lines are mapped to an EPA sector (NAICS code) by vendor and account, not one by one. Category 9 is never imported. {SPEND_TEXT_R3C.naicsEdition}</p>
        </div>
        <a className="nv-btn nv-btn--sm" href={`data:text/csv;charset=utf-8,${encodeURIComponent(scope3SpendImportTemplate())}`} download={SCOPE3_SPEND_TEMPLATE_PATH.split("/").pop()}>Download the template</a>
      </div>
      {message && <p className="spend-import__status" role="status">{message}</p>}
      {loadError && <div className="nv-notice nv-notice--error" role="status"><p>{loadError}</p><button type="button" className="nv-btn" disabled={busy} onClick={() => setReload(n => n + 1)}>Try again</button></div>}

      <div className="spend-import__step" aria-label="Upload">
        <h4 className="spend-import__step-title"><span className="spend-import__num">1</span> Choose a file and check it</h4>
        <div className="spend-import__upload">
          <label className="nv-field"><span>Spend file (CSV)</span><input aria-label="Spend file" type="file" accept=".csv,text/csv" onChange={event => void choose(event.target.files?.[0])} /></label>
          {view && <label className="nv-field"><span>Setup location</span><select aria-label="Setup location" value={locationId} onChange={event => setLocationId(event.target.value)}>{view.locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}
          <button type="button" className="nv-btn nv-btn--primary" disabled={!preview?.ok || !locationId || busy || !canManage} onClick={() => void runImport()}>Import spend lines</button>
        </div>
        {preview && !preview.ok && <div className="nv-notice nv-notice--error" role="alert"><div><p>This file can’t be imported until these are fixed (nothing was saved):</p><ul>{preview.errors.map((p, i) => <li key={i}>{p.line ? `Line ${p.line}: ` : ""}{p.message}</li>)}</ul></div></div>}
        {problems.length > 0 && <div className="nv-notice nv-notice--error" role="alert"><ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
        {preview?.ok && <div aria-label="Preview" className="spend-import__preview">
          <p>{preview.counts.rows} lines. {SPEND_BASIS_TEXT_R2C.totalsNet}: {Object.entries(preview.fileTotals).map(([currency, total]) => spendMoney(total, currency)).join("; ") || "none"}{preview.nonNumericRows ? `; ${preview.nonNumericRows} lines without a plain amount (kept and held)` : ""}.</p>
          {scope3SpendAmountBasis(previewLines).filter(row => row.creditLines > 0).map(row => <p key={row.currency} className="nv-subtle">{SPEND_BASIS_TEXT_R2C.basisLine(row.currency, spendMoney(row.purchases, row.currency), spendMoney(row.credits, row.currency), spendMoney(row.net, row.currency), row.creditLines)}</p>)}
          <ul className="spend-import__counts">
            {preview.counts.withoutNaics > 0 && <li><span className="nv-chip nv-chip--info">{preview.counts.withoutNaics} without a NAICS code</span> mapped from memory if remembered, else held for mapping</li>}
            {preview.counts.nonUsd > 0 && <li><span className="nv-chip nv-chip--warn">{preview.counts.nonUsd} in another currency</span> held: only US dollars are calculated</li>}
            {preview.counts.negative > 0 && <li><span className="nv-chip nv-chip--warn">{preview.counts.negative} negative</span> held</li>}
            {preview.counts.notANumber + preview.counts.notCalculable > 0 && <li><span className="nv-chip nv-chip--warn">{preview.counts.notANumber + preview.counts.notCalculable} without a usable amount</span> held</li>}
            {preview.counts.duplicatesInFile > 0 && <li><span className="nv-chip nv-chip--warn">{preview.counts.duplicatesInFile} repeating an earlier line of this file</span> held as possible duplicates</li>}
            {preview.counts.outsidePeriod > 0 && <li><span className="nv-chip nv-chip--warn">{preview.counts.outsidePeriod} dated outside the reporting period</span> held</li>}
          </ul>
          <div className="nv-table-wrap spend-import__table-wrap"><table className="nv-table spend-import__table" aria-label="Lines in the file">
            <thead><tr><th scope="col">Row</th><th scope="col">Date</th><th scope="col">Vendor</th><th scope="col">Account</th><th scope="col">Description</th><th scope="col" className="nv-right">Amount</th><th scope="col">On import</th></tr></thead>
            <tbody>{(previewAll ? previewLines : previewLines.slice(0, 12)).map(line => <tr key={line.row}><td data-label="Row">{line.row}</td><td data-label="Date">{line.date || "—"}</td><td data-label="Vendor">{line.vendor || "—"}</td><td data-label="Account">{line.glAccount || "—"}</td>
              <td data-label="Description">{line.description}</td><td data-label="Amount" className="nv-right nv-num">{spendMoney(line.amount, line.currency)}</td><td data-label="On import"><PreviewStatus line={line} period={view?.reportingPeriod ?? null} /></td></tr>)}</tbody>
          </table></div>
          {previewLines.length > 12 && <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm" onClick={() => setPreviewAll(!previewAll)}>{previewAll ? "Show the first 12 lines" : `Show all ${previewLines.length} lines`}</button>}
        </div>}
        {result && <div aria-label="Import result" className="spend-import__result">
          <p>{result.replayed ? "Replayed" : "Saved"}: {result.import.fileName}, {result.import.rowCount} lines; {result.calculable} go to the calculation.</p>
          <div className="nv-table-wrap spend-import__table-wrap"><table className="nv-table spend-import__table" aria-label="Reconciliation"><thead><tr><th scope="col">Currency</th><th scope="col" className="nv-right">{SPEND_BASIS_TEXT_R2C.fileTotalNet}</th><th scope="col" className="nv-right">{SPEND_BASIS_TEXT_R2C.importedTotalNet}</th><th scope="col" className="nv-right">Lines</th><th scope="col">Reconciled</th></tr></thead>
            <tbody>{result.import.reconciliation.currencies.map(row => <tr key={row.currency}><td data-label="Currency">{row.currency}</td><td data-label={SPEND_BASIS_TEXT_R2C.fileTotalNet} className="nv-right nv-num">{row.fileTotal === null ? "—" : spendMoney(row.fileTotal, row.currency)}</td><td data-label={SPEND_BASIS_TEXT_R2C.importedTotalNet} className="nv-right nv-num">{row.importedTotal === null ? "—" : spendMoney(row.importedTotal, row.currency)}</td><td data-label="Lines" className="nv-right nv-num">{row.lines}</td><td data-label="Reconciled"><span className={`nv-chip ${row.matches ? "nv-chip--ready" : "nv-chip--danger"}`}>{row.matches ? "Yes" : "No"}</span></td></tr>)}</tbody></table></div>
          {Object.keys(result.holds).length > 0 && <ul aria-label="Held lines by reason" className="spend-import__holds">{Object.entries(result.holds).sort().map(([reason, count]) => <li key={reason}>{`${count} × ${reasonText(reason)}`}</li>)}</ul>}
        </div>}
      </div>

      {view && view.imports.length > 0 && progress && <div className="spend-import__step" aria-label="Review">
        <h4 className="spend-import__step-title" tabIndex={-1} data-spend-review-heading=""><span className="spend-import__num">2</span> Map and review the lines</h4>
        <p className="nv-subtle">{view.imports.length} spend file(s) imported for {view.reportingYear ?? "this year"}; {view.mappings.length} remembered mapping(s).</p>
        <ul aria-label="Imported files" className="spend-import__counts">
          {view.imports.map(imported => {
            const active = view.lines.filter(line => line.importId === imported.id && line.state === "active").length
            return <li key={imported.id}>
              <strong>{imported.fileName}</strong> — {active} active line(s) of {imported.rowCount}.
              <button type="button" className="nv-btn nv-btn--sm" disabled={busy || !canManage || active === 0} onClick={() => setWithdrawal({ importId: imported.id, reason: "" })}>Withdraw this import</button>
              {withdrawal?.importId === imported.id && <div className="nv-notice spend-import__withdraw" aria-label={`Withdraw ${imported.fileName}`}>
                <p>Withdraw all active lines from this file. They stay in the history and no longer count in the report.</p>
                <label className="nv-field"><span>Reason for withdrawing {imported.fileName}</span><textarea aria-label={`Reason for withdrawing ${imported.fileName}`} maxLength={2000} value={withdrawal.reason} disabled={busy} onChange={event => setWithdrawal({ importId: imported.id, reason: event.target.value })} /></label>
                <div className="nv-actions">
                  <button type="button" className="nv-btn" disabled={busy || !canManage || withdrawal.reason.trim().length < 3} onClick={withdrawImport}>Confirm withdrawal</button>
                  <button type="button" className="nv-btn nv-btn--ghost" disabled={busy} onClick={() => setWithdrawal(null)}>Cancel withdrawal</button>
                </div>
              </div>}
            </li>
          })}
        </ul>
        <div className="spend-import__progress" aria-label="Mapping progress">
          <div><div className="spend-import__meter-label"><span>Lines with a code</span><strong className="nv-num">{progress.mappedLines} of {progress.lines}</strong></div>
            <div className="nv-progress" role="progressbar" aria-label="Lines with a code" aria-valuemin={0} aria-valuemax={progress.lines} aria-valuenow={progress.mappedLines}><span style={{ width: `${share(String(progress.mappedLines), String(progress.lines))}%` }} /></div></div>
          <div><div className="spend-import__meter-label"><span>{SPEND_BASIS_TEXT_R2C.meterLabel}</span><strong className="nv-num">{SPEND_BASIS_TEXT_R2C.meterOf(spendMoney(progress.usdMapped), spendMoney(progress.usdTotal))}</strong></div>
            <div className="nv-progress" role="progressbar" aria-label={SPEND_BASIS_TEXT_R2C.meterLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share(progress.usdMapped, progress.usdTotal)}><span style={{ width: `${share(progress.usdMapped, progress.usdTotal)}%` }} /></div></div>
          <p className="nv-subtle">{progress.counted} line(s) go to the calculation.{progress.otherAmountLines ? SPEND_BASIS_TEXT_R2C.otherAmounts(progress.otherAmountLines) : ""}{progress.creditLines ? ` ${SPEND_BASIS_TEXT_R2C.credits(spendMoney(progress.usdCredits), progress.creditLines, spendMoney(progress.usdNet))}` : ""}</p>
        </div>

        <div className="nv-segmented spend-import__tabs" role="group" aria-label="Spend lines to review">
          {([["code", `Needs a code (${groups.reduce((n, g) => n + g.lines.length, 0)})`], ["other", `Other holds (${otherCount})`], ["duplicates", `Possible duplicates (${duplicates.length})`], ["counted", `Counted (${countedLines.length})`]] as const)
            .map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => { setTab(key); setShown(PAGE) }}>{label}</button>)}
        </div>

        {tab === "code" && <div aria-label="Unmatched lines" className="spend-import__panel">
          {groups.length === 0 ? <p className="nv-notice nv-notice--ok">Every imported line that needed a code has one.</p> : <>
            <p className="nv-subtle">Lines grouped by vendor and GL account. One mapping covers the group and is remembered for later files; a line can be mapped differently on its own. Lines held for anything else are under “Other holds”.</p>
            <label className="nv-field spend-import__search"><span>Find a vendor, account or description</span><input aria-label="Find lines" value={query} onChange={event => { setQuery(event.target.value); setShown(PAGE) }} /></label>
            {chosen.length > 0 && <div className="spend-import__bulk" aria-label="Map selected groups">
              <SpendMappingForm key={chosen.map(group => group.keyInput).join("|")} title={`Map ${chosen.length} selected group(s): ${chosen.reduce((n, g) => n + g.lines.length, 0)} line(s)`} texts={{ vendor: chosen.length === 1 ? chosen[0]!.vendor : "", glAccount: chosen.length === 1 ? chosen[0]!.glAccount : "", glDescriptions: chosen.flatMap(g => g.glDescriptions), descriptions: chosen.flatMap(g => g.descriptions) }}
                initial={null} view={view} disabled={busy || !canManage} lines={chosen.reduce((n, g) => n + g.lines.length - g.overrides.size, 0)}
                onSave={choice => saveMappings(chosen.map(target), choice)} onCancel={() => setSelected([])} />
            </div>}
            <ul className="spend-import__groups">{visibleGroups.slice(0, shown).map(group => <li key={group.keyInput}>
              <SpendGroupRow group={group} view={view} selected={selected.includes(group.keyInput)} disabled={busy || !canManage} onOpenRecord={onOpenRecord}
                onWithdraw={reason => correct(group.lines.map(line => line.recordId), "withdraw", reason)}
                onSelect={on => setSelected(current => on ? [...current.filter(key => key !== group.keyInput), group.keyInput] : current.filter(key => key !== group.keyInput))}
                onSave={choice => saveMappings([target(group)], choice)} onSaveLine={(line, choice) => saveMappings([lineTarget(line, group.overrides.get(line.recordId) ?? null)], choice)} />
            </li>)}</ul>
            {visibleGroups.length > shown && <button type="button" className="nv-btn nv-btn--sm" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, visibleGroups.length - shown)} more groups (of {visibleGroups.length})</button>}
            {visibleGroups.length === 0 && <p>No group matches “{query}”.</p>}
          </>}
        </div>}

        {tab === "other" && <div aria-label="Other holds" className="spend-import__panel">
          {foreign.length > 0 && <div className="spend-import__convert" aria-label="Convert to US dollars">
            <h5 className="spend-import__convert-title">{SPEND_TEXT_R3C.convertTitle}</h5>
            <p className="nv-subtle">{SPEND_TEXT_R3C.convertIntro}</p>
            {foreign.map(({ currency, lines: count, total }) => {
              const typed = rates[currency] ?? { rate: "", rateSource: "", rateDate: "" }
              const set = (key: "rate" | "rateSource" | "rateDate", value: string) => setRates(current => ({ ...current, [currency]: { ...(current[currency] ?? { rate: "", rateSource: "", rateDate: "" }), [key]: value } }))
              const ready = /^(0|[1-9][0-9]{0,5})(\.[0-9]{1,8})?$/.test(typed.rate.trim()) && /[1-9]/.test(typed.rate) && typed.rateSource.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(typed.rateDate)
              return <fieldset key={currency} className="nv-fieldset spend-import__convert-row" aria-label={`Convert ${currency} to US dollars`}>
                <legend>{SPEND_TEXT_R3C.convertLegend(currency, count, total)}</legend>
                <div className="spend-import__form-grid spend-import__convert-grid">
                  <label className="nv-field"><span>{SPEND_TEXT_R3C.rateLabel(currency)}</span><input aria-label={SPEND_TEXT_R3C.rateLabel(currency)} inputMode="decimal" value={typed.rate} placeholder="e.g. 1.0823" onChange={event => set("rate", event.target.value)} /></label>
                  <label className="nv-field"><span>{SPEND_TEXT_R3C.sourceLabel}</span><input aria-label={`${currency} rate source`} value={typed.rateSource} placeholder={SPEND_TEXT_R3C.sourcePlaceholder} onChange={event => set("rateSource", event.target.value)} /></label>
                  <label className="nv-field"><span>{SPEND_TEXT_R3C.dateLabel}</span><input aria-label={`${currency} rate date`} type="date" value={typed.rateDate} onChange={event => set("rateDate", event.target.value)} /></label>
                </div>
                <div className="nv-actions"><button type="button" className="nv-btn nv-btn--primary nv-btn--sm" disabled={busy || !canManage || !ready} onClick={() => void convert(currency)}>{SPEND_TEXT_R3C.convertButton(count, currency)}</button></div>
              </fieldset>
            })}
          </div>}
          {other.length === 0 ? <p className="nv-notice nv-notice--ok">No line is held for anything else.</p> : other.map(entry => {
            const fix = scope3SpendHoldFix(entry.reason)
            return <div key={entry.reason} className="spend-import__hold" aria-label={`Held: ${entry.reason}`}>
              <div className="spend-import__hold-head"><span className="nv-chip nv-chip--warn">{entry.lines.length} line(s)</span><p><strong>{reasonText(entry.reason)}</strong></p></div>
              <p className="spend-import__fix"><span className="nv-attn-label nv-attn-label--info">How to fix</span> {fix.fix}{entry.alsoNeedsCode === 1 && entry.lines.length === 1 ? " This line also needs a code; it joins “Needs a code” once this is fixed." : entry.alsoNeedsCode === 1 ? " 1 of these also needs a code; it joins “Needs a code” once this is fixed." : entry.alsoNeedsCode ? ` ${entry.alsoNeedsCode} of these also need a code; they join “Needs a code” once this is fixed.` : ""}</p>
              <div className="nv-table-wrap spend-import__table-wrap"><table className="nv-table spend-import__table"><thead><tr><th scope="col">Line</th><th scope="col">Vendor</th><th scope="col">Description</th><th scope="col">Date</th><th scope="col" className="nv-right">Amount</th><th scope="col"><span className="nv-sr">Actions</span></th></tr></thead>
                <tbody>{entry.lines.map(line => <tr key={line.recordId}><td data-label="Line">{line.sourceId}</td><td data-label="Vendor">{line.vendor || "—"}</td><td data-label="Description">{line.description}</td><td data-label="Date">{line.lineDate ?? "—"}</td>
                  <td data-label="Amount" className="nv-right nv-num">{spendMoney(line.amount, line.currency)}</td>
                  <td data-label=""><div className="nv-actions">{onOpenRecord && <button type="button" className="nv-btn nv-btn--sm" onClick={() => onOpenRecord(line.recordId)}>Open the line</button>}
                    {fix.withdraw && <button type="button" className="nv-btn nv-btn--sm nv-btn--danger" disabled={busy || !canManage} onClick={() => void correct([line.recordId], "withdraw", reasonText(entry.reason).split(". ")[0]!.slice(0, 200))}>Withdraw</button>}</div></td></tr>)}</tbody></table></div>
            </div>
          })}
        </div>}

        {tab === "duplicates" && <div aria-label="Possible duplicates" className="spend-import__panel">
          {duplicates.length === 0 ? <p className="nv-notice nv-notice--ok">No possible duplicates are waiting.</p> : <ul className="spend-import__pairs">{duplicates.map(pair => <li key={pair.line.recordId} className="spend-import__pair">
            <p>{pair.line.sourceId} {pair.line.vendor} {spendMoney(pair.line.amount, pair.line.currency)} repeats {pair.earlierFile ?? "an earlier file"} line {pair.line.possibleDuplicateOf!.row}{pair.earlier ? ` (${pair.earlier.sourceId}, ${pair.earlier.vendor}, ${spendMoney(pair.earlier.amount, pair.earlier.currency)})` : ""}.</p>
            <div className="nv-actions"><button type="button" className="nv-btn nv-btn--sm" disabled={busy || !canManage} onClick={() => void correct([pair.line.recordId], "distinct")}>Not a duplicate</button>
              <button type="button" className="nv-btn nv-btn--sm nv-btn--danger" disabled={busy || !canManage} onClick={() => void correct([pair.line.recordId], "withdraw")}>Duplicate: withdraw</button></div>
          </li>)}</ul>}
        </div>}

        {tab === "counted" && <div aria-label="Counted lines" className="spend-import__panel">
          {countedLines.length === 0 ? <p>No imported line goes to the calculation yet.</p> : <div className="nv-table-wrap spend-import__table-wrap"><table className="nv-table spend-import__table"><thead><tr><th scope="col">Line</th><th scope="col">Vendor</th><th scope="col">Account</th><th scope="col">Description</th><th scope="col">Code</th><th scope="col" className="nv-right">Amount</th></tr></thead>
            <tbody>{countedLines.filter(line => matches(query, line.vendor, line.glAccount, line.description)).slice(0, shown).map(line => <tr key={line.recordId}><td data-label="Line">{line.sourceId}</td><td data-label="Vendor">{line.vendor || "—"}</td><td data-label="Account">{line.glAccount || "—"}</td><td data-label="Description">{line.description}</td>
              <td data-label="Code">{line.naicsCode} {scope3NaicsTitle(line.naicsCode)}</td><td data-label="Amount" className="nv-right nv-num">{spendMoney(line.amount, line.currency)}{conversionNote(line)}</td></tr>)}</tbody></table></div>}
          {countedLines.length > shown && <button type="button" className="nv-btn nv-btn--sm" onClick={() => setShown(shown + PAGE)}>Show more</button>}
        </div>}
      </div>}

      {supersession.length > 0 && <div className="spend-import__step" aria-label="Superseded lines">
        <h4 className="spend-import__step-title"><span className="spend-import__num">3</span> Spend replaced by supplier or partner figures</h4>
        <p className="nv-subtle">These spend lines are never counted: the record beside them is counted instead. Check that its figure covers the same purchases.</p>
        <ul className="spend-import__supersession">{supersession.map(row => <li key={row.recordId} className="spend-import__replace">
          <div className="spend-import__replace-head"><p><strong>{row.name || "Supplier"}</strong> · {row.kind === "partner_reported" ? "partner record" : "supplier record"} {row.sourceId} · category {row.category}</p></div>
          <dl className="spend-import__compare">
            <div><dt>Spend replaced ({row.lines.length} line{row.lines.length === 1 ? "" : "s"})</dt><dd className="nv-num">{spendMoney(row.usdTotal)}{row.otherAmounts.length ? ` + ${row.otherAmounts.join(", ")}` : ""}</dd></div>
            <div><dt>Counted instead</dt><dd className="nv-num">{row.figure}</dd></div>
          </dl>
          <div className="nv-table-wrap spend-import__table-wrap"><table className="nv-table spend-import__table"><thead><tr><th scope="col">Spend line</th><th scope="col">Description</th><th scope="col" className="nv-right">Amount</th></tr></thead>
            <tbody>{row.lines.map(line => <tr key={line.spendRecordId}><td data-label="Spend line">{line.spendSourceId}</td><td data-label="Description">{line.spendDescription}</td><td data-label="Amount" className="nv-right nv-num">{spendMoney(line.spendAmount, line.spendCurrency)}</td></tr>)}</tbody></table></div>
        </li>)}</ul>
      </div>}
    </section>
  )
}

/** Round 3 lane C (PR-11): a converted line's original amount, rate, source and date (only while its amount is still the converted one). */
function conversionNote(line: Scope3SpendLineView) {
  const c = line.conversion
  if (!c || line.currency !== "USD" || line.amount !== c.usd) return null
  return <span className="nv-subtle spend-import__converted"> {SPEND_TEXT_R3C.convertedFrom(spendMoney(c.amount, c.currency), c.rate, c.currency, c.rateSource, c.rateDate)}</span>
}

/** What the import will do with a preview line (the adapter decides on save; this mirrors the parser's counts). */
function PreviewStatus({ line, period }: { line: Scope3SpendImportLine; period: { start: string; endExclusive: string } | null }) {
  const chips: Array<[string, string]> = []
  if (line.currency !== "USD") chips.push(["warn", `${line.currency}: held`])
  if (line.amountKind === "negative") chips.push(["warn", "Negative: held"])
  if (line.amountKind === "not_a_number" || line.amountKind === "not_calculable") chips.push(["warn", "Amount: held"])
  if (period && line.lineDate !== null && (line.lineDate < period.start || line.lineDate >= period.endExclusive)) chips.push(["warn", "Outside the period: held"])
  if (line.naicsCode === null) chips.push(["info", "Needs a code"])
  if (chips.length === 0) chips.push(["ready", `Code ${line.naicsCode}`])
  return <span className="spend-import__chips">{chips.map(([tone, text]) => <span key={text} className={`nv-chip nv-chip--${tone}`}>{text}</span>)}</span>
}

/** One group of lines that need a code: header, suggestions and mapping form when open, its lines with per-line overrides. */
function SpendGroupRow({ group, view, selected, disabled, onSelect, onSave, onSaveLine, onOpenRecord, onWithdraw }: { group: Scope3SpendReviewGroup; view: Scope3SpendImportsView; selected: boolean; disabled: boolean; onSelect: (on: boolean) => void
  onSave: (choice: MappingChoice) => Promise<void>; onSaveLine: (line: Scope3SpendLineView, choice: MappingChoice) => Promise<void>; onOpenRecord?: (recordId: string) => void; onWithdraw: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [lineOpen, setLineOpen] = useState<string | null>(null)
  // Round 3 lane C (decision 8): the row shows only a confident suggestion (the company's vendor memory or a curated term);
  // a non-purchase or energy group offers withdrawal; the category comes from the account and is shown for confirmation.
  // Each line's description counts once (a group's commonest purchase leads its suggestion).
  const suggested = scope3SpendSuggest({ ...group, descriptions: group.lines.map(line => line.description) }, view)
  const top = suggested.suggestions[0]
  const confident = top && (top.confidence === "high" || top.confidence === "medium") ? top : undefined
  // A line's own category from the file wins; else the remembered mapping's; else the one suggested from the account or code.
  const fileCategory = group.lines.find(line => line.mappingSource === "unmatched" && line.category !== 1)?.category
  const initialCategory = group.mapping?.category ?? fileCategory ?? suggested.category.value
  const label = `${group.vendor || "(no vendor)"} · ${group.glAccount ? `account ${group.glAccount}` : "no account"}`
  return (
    <div className={`spend-import__group${selected ? " is-selected" : ""}`} aria-label={`Mapping for ${label}`}>
      <div className="spend-import__group-head">
        <label className="nv-check spend-import__select"><input type="checkbox" aria-label={`Select ${label}`} checked={selected} disabled={disabled} onChange={event => onSelect(event.target.checked)} /><span className="nv-sr">Select</span></label>
        <div className="spend-import__group-main">
          <p className="spend-import__group-title"><strong>{group.vendor || "(no vendor)"}</strong> <span className="nv-subtle">{group.glAccount ? `· account ${group.glAccount}` : "· no account"}{group.glDescriptions.length ? ` ${group.glDescriptions.join(", ")}` : ""}</span></p>
          <p className="nv-subtle spend-import__group-desc">{group.descriptions.slice(0, 4).join(" · ")}{group.descriptions.length > 4 ? ` · and ${group.descriptions.length - 4} more` : ""}</p>
          {suggested.withdraw && !open && <div className="spend-import__suggest-line spend-import__withdraw-suggest"><span className="nv-chip nv-chip--warn nv-chip--plain">{SPEND_TEXT_R3C.withdrawChip(suggested.withdraw.kind)}</span> <span>{SPEND_TEXT_R3C.withdrawWhy(suggested.withdraw.kind, suggested.withdraw.why)}</span>
            <button type="button" className="nv-btn nv-btn--sm nv-btn--danger" disabled={disabled} onClick={() => void onWithdraw(SPEND_TEXT_R3C.withdrawReason(suggested.withdraw!.kind, suggested.withdraw!.why))}>{SPEND_TEXT_R3C.withdrawButton(group.lines.length)}</button></div>}
          {!suggested.withdraw && confident && !open && <p className="spend-import__suggest-line"><span className="nv-chip nv-chip--info nv-chip--plain">Suggested</span> {confident.code} {confident.title}{suggested.category.value !== 1 ? ` · ${CATEGORY_WORDS[suggested.category.value]}` : ""} <span className="nv-subtle">· {confident.why}</span></p>}
          {!suggested.withdraw && !confident && !group.mapping && !open && <p className="nv-subtle spend-import__suggest-line">{SPEND_TEXT_R3C.noConfident}</p>}
          {group.mapping && <p className="nv-subtle">Remembered: {group.mapping.naicsCode} {scope3NaicsTitle(group.mapping.naicsCode)}</p>}
        </div>
        <div className="spend-import__group-side">
          <span className="nv-num spend-import__amount">{group.usdTotal === "0" && group.lines.some(line => line.currency !== "USD") ? "—" : spendMoney(group.usdTotal)}</span>
          <span className="nv-subtle">{group.lines.length} line{group.lines.length === 1 ? "" : "s"}</span>
          <button type="button" className={`nv-btn nv-btn--sm${open ? "" : " nv-btn--primary"}`} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close" : "Map"}</button>
        </div>
      </div>
      {open && <div className="spend-import__group-body">
        <SpendMappingForm title={`Map ${group.lines.length - group.overrides.size} line(s) of ${group.vendor || "this account"}`} texts={group} view={view} disabled={disabled} lines={group.lines.length - group.overrides.size}
          initial={group.mapping ? { category: group.mapping.category, naicsCode: group.mapping.naicsCode, marginChoice: group.mapping.marginChoice } : { category: initialCategory, naicsCode: "", marginChoice: "with_margins" }}
          categoryWhy={group.mapping ? null : fileCategory ? null : suggested.category.why}
          onSave={async choice => { await onSave(choice); setOpen(false) }} onCancel={() => setOpen(false)} />
        <div className="nv-table-wrap spend-import__table-wrap"><table className="nv-table spend-import__table" aria-label={`Lines of ${label}`}>
          <thead><tr><th scope="col">Line</th><th scope="col">Date</th><th scope="col">Description</th><th scope="col" className="nv-right">Amount</th><th scope="col"><span className="nv-sr">Actions</span></th></tr></thead>
          <tbody>{group.lines.map(line => <tr key={line.recordId}><td data-label="Line">{line.sourceId}</td><td data-label="Date">{line.lineDate ?? "—"}</td><td data-label="Description">{line.description}{group.overrides.has(line.recordId) ? <span className="nv-subtle"> · mapped on its own: {group.overrides.get(line.recordId)!.naicsCode}</span> : null}</td>
            <td data-label="Amount" className="nv-right nv-num">{spendMoney(line.amount, line.currency)}{conversionNote(line)}</td>
            <td data-label=""><div className="nv-actions"><button type="button" className="nv-btn nv-btn--ghost nv-btn--sm" disabled={disabled} onClick={() => setLineOpen(lineOpen === line.recordId ? null : line.recordId)}>{lineOpen === line.recordId ? "Cancel" : "Map this line differently"}</button>
              {onOpenRecord && <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm" onClick={() => onOpenRecord(line.recordId)}>Open</button>}</div></td></tr>)}</tbody>
        </table></div>
        {lineOpen && (() => { const line = group.lines.find(item => item.recordId === lineOpen); return line ? <SpendMappingForm key={line.recordId} title={`Map only ${line.sourceId}: ${line.description}`} texts={{ vendor: line.vendor, glAccount: line.glAccount, glDescriptions: line.glDescription ? [line.glDescription] : [], descriptions: [line.description] }}
          view={view} disabled={disabled} lines={1} initial={null} onSave={async choice => { await onSaveLine(line, choice); setLineOpen(null) }} onCancel={() => setLineOpen(null)} /> : null })()}
      </div>}
    </div>
  )
}

/** Category, suggested or searched NAICS code, margins and the confirmations a code needs; one save for the target lines. */
function SpendMappingForm({ title, texts, view, initial, lines, disabled, onSave, onCancel, categoryWhy }: { title: string; texts: { vendor: string; glAccount: string; glDescriptions: readonly string[]; descriptions: readonly string[] }; view: Scope3SpendImportsView
  initial: { category: number; naicsCode: string; marginChoice: "with_margins" | "without_margins" } | null; lines: number; disabled: boolean; onSave: (choice: MappingChoice) => Promise<void>; onCancel: () => void; categoryWhy?: string | null }) {
  // Round 3 lane C (decision 8): with no saved mapping, the form starts in the category the account or code suggests.
  const inferred = initial ? null : scope3SpendSuggest(texts, view).category
  const [category, setCategory] = useState(initial?.category ?? inferred?.value ?? 1)
  const [query, setQuery] = useState("")
  const [naicsCode, setNaicsCode] = useState(initial?.naicsCode ?? "")
  const [margin, setMargin] = useState<"with_margins" | "without_margins">(initial?.marginChoice ?? "with_margins")
  const [confirmed, setConfirmed] = useState(false)
  const [overlap, setOverlap] = useState(false)
  const suggestions: Scope3NaicsSuggestion[] = scope3SpendNaicsSuggestions(texts, category, view, 5)
  const choices = scope3NaicsChoices(category, query, 40)
  const guard = scope3NaicsGuard(category, naicsCode || null)
  const fallback = category !== 1 && category !== 2
  return (
    <fieldset className="nv-fieldset spend-import__form" aria-label={title}>
      <legend>{title}</legend>
      <div className="spend-import__form-grid">
        <label className="nv-field"><span>Category</span><select aria-label="Category" value={category} onChange={event => { setCategory(Number(event.target.value)); setNaicsCode(""); setConfirmed(false) }}>{[1, 2, 4, 5, 6].map(c => <option key={c} value={c}>{CATEGORY_WORDS[c]}</option>)}</select>
          {(categoryWhy ?? inferred?.why) && <small className="nv-field__hint">{SPEND_TEXT_R3C.categoryWhy(categoryWhy ?? inferred!.why!)}</small>}</label>
        <label className="nv-field"><span>Margins</span><select aria-label="Margins" value={margin} onChange={event => setMargin(event.target.value as typeof margin)}><option value="with_margins">With margins (purchaser price)</option><option value="without_margins">Without margins (producer price at the factory gate)</option></select>
          {margin === "without_margins" && <small className="nv-field__hint">Each line must then be confirmed as bought at the factory gate, or it is held.</small>}</label>
      </div>
      {suggestions.length > 0 && <div className="spend-import__suggestions" role="group" aria-label="Suggested codes">
        <span className="nv-field__hint">Suggested codes</span>
        {suggestions.map(s => <button key={s.code} type="button" className="spend-import__suggestion" aria-pressed={naicsCode === s.code} onClick={() => { setNaicsCode(s.code); setConfirmed(false) }}>
          <span className="spend-import__suggestion-code nv-num">{s.code}</span> <span>{s.title}</span> {s.confidence === "weak" || s.confidence === "low" ? <span className="nv-chip nv-chip--plain">{SPEND_TEXT_R3C.confidence[s.confidence]}</span> : null} <span className="nv-subtle">· {s.why}</span></button>)}
      </div>}
      <div className="spend-import__form-grid">
        <label className="nv-field"><span>{SPEND_TEXT_R3C.searchLabel}</span><input aria-label="Search NAICS" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. lawyers, couriers, software" /></label>
        <label className="nv-field"><span>{SPEND_TEXT_R3C.codeLabel}</span><select aria-label="NAICS code" value={naicsCode} onChange={event => { setNaicsCode(event.target.value); setConfirmed(false) }}><option value="">Choose a code</option>
          {naicsCode && !choices.some(choice => choice.code === naicsCode) && <option value={naicsCode}>{naicsCode} {scope3NaicsTitle(naicsCode)}</option>}
          {choices.map(choice => <option key={choice.code} value={choice.code}>{choice.code} {choice.title}</option>)}</select></label>
      </div>
      {guard && <label className="nv-check"><input aria-label="Category confirmed" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>This is {SCOPE3_NAICS_GUARD_TEXT[guard]}. Count these purchases in category {category} anyway.</span></label>}
      {fallback && <label className="nv-check"><input aria-label="No overlapping activity records" type="checkbox" checked={overlap} onChange={event => setOverlap(event.target.checked)} /><span>No distance, waste or travel record covers these purchases</span></label>}
      <div className="nv-actions">
        <button type="button" className="nv-btn nv-btn--primary" disabled={disabled || !naicsCode} onClick={() => void onSave({ category, naicsCode, marginChoice: margin, categoryConfirmed: fallback ? null : guard ? confirmed : false, activityOverlapConfirmed: fallback ? overlap : null })}>Save mapping for {lines} line(s)</button>
        <button type="button" className="nv-btn nv-btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </fieldset>
  )
}
