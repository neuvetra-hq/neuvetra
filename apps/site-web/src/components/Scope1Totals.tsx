import type {M78Reconciliation,M78Rollup,M78Register} from '../../../../packages/neuvetra-database/src/m78-contract'

function RollupTable({title,rows}:{title:string;rows:M78Rollup[]}){
  return <section className="scope1-rollup"><h4>{title}</h4>{rows.length?<div className="scope1-table-wrap"><table><thead><tr><th scope="col">Name</th><th scope="col">Gross kg CO2e</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><th scope="row">{row.label}</th><td>{row.kgCo2eDisplay}</td></tr>)}</tbody></table></div>:<p>No eligible contribution is available for this view.</p>}</section>
}

export function Scope1Totals({reconciliation,register}:{reconciliation:M78Reconciliation;register:M78Register}){
  const totals=reconciliation.totals??reconciliation.knownSourceSubtotal
  const blockers=reconciliation.findings.filter(finding=>finding.classification==='functional_blocker')
  const release=reconciliation.findings.filter(finding=>finding.classification==='release_blocker')
  const corporate=reconciliation.findings.filter(finding=>finding.classification==='corporate_gap')
  const resolved=reconciliation.findings.filter(finding=>finding.classification==='resolved_bounded')
  const coverage=register.coverageVersion.snapshot
  return <section className="scope1-totals" aria-label="Scope 1 reconciliation">
    <h3>{reconciliation.status==='reconciled_bounded_synthetic'?'Reconciled synthetic Scope 1 candidate':'Scope 1 incomplete'}</h3>
    <p>Gross direct emissions for calendar 2025. Candidate methods are not released; this is not external assurance.</p>
    <p>{reconciliation.sourceUnion.length} discovered source records · {blockers.length} unresolved workflow findings · {release.length} release findings</p>
    {blockers.length>0&&<section><h4>What needs attention</h4><ul>{blockers.map((finding,index)=><li key={index}>{finding.message}{finding.origin.recordId&&<span> · {coverage.sources.find(source=>source.id===finding.origin.recordId)?.name??finding.origin.recordId}</span>}</li>)}</ul></section>}
    {totals?<>
      <h4>{reconciliation.totals?'Gross company candidate total':'Known-source subtotal — coverage incomplete'}</h4>
      <p className="scope1-number"><strong>{totals.company.kgCo2eDisplay}</strong> kg CO2e</p>
      {!reconciliation.totals&&<p>This subtotal includes eligible contributions only. Missing or unsupported sources remain unresolved and are not counted as zero.</p>}
      <div className="scope1-table-wrap"><table><caption>Gas-specific contributions</caption><thead><tr><th scope="col">Gas</th><th scope="col">Emitted kg of gas</th><th scope="col">Gross kg CO2e, unrounded</th></tr></thead><tbody>{totals.gasLines.map(line=><tr key={line.gas}><th scope="row">{line.gas}{line.gasKind==='blend'&&<span> · blend</span>}</th><td>{line.massKgExact}</td><td>{line.kgCo2eExact}</td></tr>)}</tbody></table></div>
      {totals.gasLines.some(line=>line.gasKind==='blend')&&<p>Blend mass is reported as a blend. Constituent gas quantities have not been inferred.</p>}
      <RollupTable title="Source contributions" rows={totals.sourceRows.map(row=>{const source=coverage.sources.find(s=>s.id===row.id),physical=reconciliation.sourceUnion.find(s=>s.sourceId===row.id)?.physicalId;return {...row,label:[row.label,coverage.entities.find(e=>e.id===source?.entityId)?.legalName,coverage.facilities.find(f=>f.id===source?.facilityId)?.name,physical].filter(Boolean).join(' · ')}})}/>
      <p>Stationary diesel uses a default heating-value estimate. Fugitive quantities use servicing-balance estimates; they are not measured annual leakage.</p>
      <RollupTable title="Facilities — organizational attribution" rows={totals.facilityRows.map(row=>({...row,label:`${row.label} · ${coverage.entities.find(entity=>entity.id===coverage.facilities.find(facility=>facility.id===row.id)?.entityId)?.legalName??'Entity unresolved'}`}))}/>
      <RollupTable title="Entities" rows={totals.entityRows}/>
      <p>Totals use unrounded contributions, then round once to four decimal places. Company display minus the sum of source displays: {totals.displayRoundingDelta} kg CO2e. No offsets or avoided emissions are deducted.</p>
    </>:<p>A combined CO2e subtotal cannot yet be established from compatible, eligible source results.</p>}
    <details><summary>Complete discovered-source list ({reconciliation.sourceUnion.length})</summary><ul>{reconciliation.sourceUnion.map((row,index)=><li key={index}>{coverage.sources.find(source=>source.id===row.sourceId)?.name??row.physicalId??'Unmatched source'} · {row.family} · {coverage.entities.find(entity=>entity.id===row.entityId)?.legalName??'Entity unresolved'} · {coverage.facilities.find(facility=>facility.id===row.facilityId)?.name??'Location unresolved'}</li>)}</ul></details>
    <details><summary>Release and wider corporate gaps ({release.length+corporate.length})</summary><p>These findings remain open even when the demonstration reconciles.</p><ul>{[...release,...corporate].map((finding,index)=><li key={index}>{finding.message}</li>)}</ul></details>
    <details><summary>Findings resolved by retained evidence ({resolved.length})</summary><ul>{resolved.map((finding,index)=><li key={index}>{finding.message} · {finding.resolution?.ruleId}</li>)}</ul></details>
  </section>
}
