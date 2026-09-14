import { readVerifiedEvidencePackReportData, type EvidencePackExpectation, type EvidencePackReceipt } from "./m59"

export const M60_PROFILE = "neuvetra.synthetic.inventory-draft-report.v1" as const
export const M60_MEDIA_TYPE = "text/html; charset=utf-8" as const
export const M60_MAX_REPORT_BYTES = 65_536 as const

export interface DraftInventoryReportBuild {
  profile: typeof M60_PROFILE
  sourceArchiveSha256: string
  sourceManifestSha256: string
  sourceLineageRootSha256: string
  reportSha256: string
  reportByteLength: number
  report: Uint8Array
  verification: EvidencePackReceipt
}

const encoder = new TextEncoder()
const escapeHtml = (value:string) => value.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]!)
export const hashReportBytes = (bytes:Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex")

export function buildDraftInventoryReport(archive:Uint8Array, expectation:EvidencePackExpectation, companyName:string):DraftInventoryReportBuild {
  if(companyName!=="Synthetic Acme, Inc.") throw new Error("Draft report company is outside the fixed synthetic profile.")
  const {verification,workspace,register,inventory,m57Decision,m58Decision,calculation}=readVerifiedEvidencePackReportData(archive,expectation),r=verification.reconstructed
  if(workspace.companyName!==companyName||inventory.id!==verification.inventoryId||inventory.snapshotSha256.length!==64)throw new Error("Draft report source binding failed.")
  const rows=register.periods.map(period=>`<tr><td>${period.month}</td><td>${period.state}</td><td>${period.quantityMwh??"—"}</td><td>${period.emissionsKgCo2e??"—"}</td><td>${escapeHtml(period.state==="excluded"?`${period.reason}; no quantity; not counted; ${period.evidence!.source}; SHA-256 ${period.evidence!.sha256}; ${period.evidence!.locator}`:period.evidence?`${period.evidence.source}; SHA-256 ${period.evidence.sha256}; ${period.evidence.locator}`:`${period.reason}; ${period.formula}; basis ${period.basisMonths.join(", ")}`)}</td></tr>`).join("")
  const decision=(label:string,value:typeof m57Decision|typeof m58Decision)=>`<h3>${label}</h3><dl><dt>ID</dt><dd class="hash">${value.id}</dd><dt>Outcome</dt><dd>${value.outcome}</dd><dt>Reason</dt><dd>${value.reasonCode}</dd><dt>Acknowledged warnings</dt><dd>${value.acknowledgedWarnings.join(", ")}</dd><dt>Reviewer</dt><dd>${value.decidedBy}</dd><dt>Decided</dt><dd>${value.decidedAt}</dd></dl>`
  const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>2023 draft electricity inventory — ${escapeHtml(companyName)}</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#17231c;max-width:860px;margin:40px auto;padding:0 24px}h1{font-size:2rem}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{border-bottom:1px solid #ccd5cf;padding:10px;text-align:left;overflow-wrap:anywhere}th:last-child,td:last-child{text-align:right}.notice{background:#f5ead1;border-left:5px solid #9b6417;padding:16px}.hash{overflow-wrap:anywhere;font:12px/1.4 monospace}.status{font-weight:700}.page-header,.page-footer{display:none}@page{margin:24mm 14mm 20mm}@media print{body{margin:0;max-width:none;padding:0}.page-header,.page-footer{display:block;position:fixed;left:0;right:0;font:bold 9px/1.25 system-ui,sans-serif;overflow-wrap:anywhere}.page-header{top:-18mm}.page-footer{bottom:-15mm}.notice,table,dl{break-inside:avoid}table{font-size:9px}}</style></head><body>
<header class="page-header">DRAFT · SYNTHETIC · INCOMPLETE · UNRELEASED / NOT ELIGIBLE · NO ASSURANCE · releaseEligible=false</header><footer class="page-footer">Neuvetra M60 · DRAFT · SYNTHETIC · INCOMPLETE · UNRELEASED / NOT ELIGIBLE · NO ASSURANCE · releaseEligible=false</footer>
<main><p>Neuvetra · M60 local synthetic demonstration</p><h1>2023 draft electricity inventory</h1><p><strong>${escapeHtml(companyName)}</strong> · California, United States · operational control</p>
<div class="notice"><span class="status">Incomplete bounded draft — unreleased.</span> This report uses fictional development data and provides no assurance or filing.</div>
<h2>Location-based Scope 2 subtotal</h2><p><strong>${r.includedDisplayKgCo2e} kg CO2e</strong> from ${r.includedMwh} MWh. Exact unrounded emissions: ${r.includedKgCo2e} kg CO2e.</p>
<table><caption>Resolved 2023 electricity periods</caption><thead><tr><th>Month</th><th>Status</th><th>MWh</th><th>kg CO2e</th><th>Evidence or treatment</th></tr></thead><tbody>${rows}</tbody></table>
<table><caption>Inventory subtotal</caption><tbody><tr><th>Reported (${r.reported})</th><td>${r.reportedMwh} MWh</td><td>${r.reportedKgCo2e} kg CO2e</td></tr><tr><th>Estimated (${r.estimated})</th><td>${r.estimatedMwh} MWh</td><td>${r.estimatedKgCo2e} kg CO2e</td></tr><tr><th>Included subtotal</th><td>${r.includedMwh} MWh</td><td>${r.includedKgCo2e} kg CO2e</td></tr></tbody></table>
<h2>Method and qualifications</h2><ul><li>Scope 2 location-based electricity only, using the fixed CAMX development method and factor sealed in the evidence pack.</li><li>November is estimated as the mean of September and October reported electricity.</li><li>December is excluded because the synthetic facility is outside operational control after the lease end.</li><li>Market-based Scope 2, Scope 1, and Scope 3 are outside this draft.</li><li>The factor and method are development candidates and are not released.</li></ul>
<dl><dt>Method</dt><dd>${calculation.method.id} · ${calculation.method.version}</dd><dt>Factor</dt><dd>${calculation.factor.id} · ${calculation.factor.version} · ${calculation.factor.value} kg CO2e/MWh</dd><dt>Factor source</dt><dd>${calculation.factor.sheet}!${calculation.factor.totalOutputCell} · SHA-256 ${calculation.factor.sourceSha256}</dd><dt>GWP policy</dt><dd>${calculation.gwpPolicy.id} · ${calculation.gwpPolicy.version} · SHA-256 ${calculation.gwpPolicy.policySha256}</dd></dl>
<h2>Bounded internal decision history</h2><p>These internal decisions document review of this bounded synthetic draft. They are not assurance, verification, certification, or filing approval.</p>${decision("M57 predecessor decision",m57Decision)}${decision("M58 annual inventory decision",m58Decision)}
<h2>Verified source pack</h2><p>The exact 17-file evidence pack passed archive, manifest, lineage, and deterministic arithmetic verification before this report was generated.</p><p class="hash">Archive SHA-256: ${verification.archiveSha256}<br>Manifest SHA-256: ${verification.manifestSha256}<br>Lineage root SHA-256: ${verification.lineageRootSha256}<br>Inventory ID: ${escapeHtml(verification.inventoryId)}<br>Inventory snapshot SHA-256: ${inventory.snapshotSha256}</p>
</main></body></html>
`
  const report=encoder.encode(html);if(report.byteLength>M60_MAX_REPORT_BYTES)throw new Error("Draft report is too large.")
  return{profile:M60_PROFILE,sourceArchiveSha256:verification.archiveSha256,sourceManifestSha256:verification.manifestSha256,sourceLineageRootSha256:verification.lineageRootSha256,reportSha256:hashReportBytes(report),reportByteLength:report.byteLength,report,verification}
}
