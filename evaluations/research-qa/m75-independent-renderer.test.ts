import {expect,test} from 'bun:test'
import {m75RenderReport,m75ReportSnapshot} from '../../packages/neuvetra-database/src/m75-report'
import {buildM75Dependencies,deriveM75RosterFindings,deriveM75Reconciliation,m75CanonicalJson} from '../../packages/neuvetra-database/src/m75-validation'
import {independentGraph,qaHash} from './m75-independent-scenarios'

function snapshot(){const g=independentGraph(),cv=g.coverage.versions[0],heads=g.mobile.worksheets.map((w:any)=>w.versions[0]),hash=(v:unknown)=>qaHash(m75CanonicalJson(v));g.version.dependencies=buildM75Dependencies(cv,heads,hash);g.reviews[0].dependencies=structuredClone(g.version.dependencies);g.version.findings=deriveM75RosterFindings(g.version.activity,cv);const result=deriveM75Reconciliation(g.companyId,cv,heads,g.version,g.reviews,hash);return m75ReportSnapshot(g.version,g.reviews[0],result)}

test('M75 independent report retains literal template markers and replacement metacharacters in user evidence',()=>{
 const s=snapshot();s.version.statement!.input.issuer='QA {{rows}} $&';s.version.statement!.input.reference="QA $` $' $$ {{snapshot}}"
 const html=m75RenderReport(s)
 expect(html).toContain('<dd>QA {{rows}} $&amp; / QA $` $&#39; $$ {{snapshot}}</dd>')
 expect((html.match(/<table>/g)??[]).length).toBe(1)
 expect(html).toContain('<h2>Full reconciliation union</h2><table>')
})

test('M75 independent report escapes evidence and finding markup and preserves explicit limitations',()=>{
 const s=snapshot();s.version.statement!.input.issuer='<script>alert("x")</script>';s.reconciliation.rows[0]!.findings.push({code:'qa_markup',rowKey:s.reconciliation.rows[0]!.rowKey,message:'<img src=x onerror="alert(1)">',blocking:true})
 const html=m75RenderReport(s);expect(html).not.toContain('<script>');expect(html).not.toContain('<img ');expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');expect(html).toContain('No emissions aggregation.');expect(html).toContain('Scope 1 and the corporate inventory remain incomplete.');expect(html).toContain('No external assurance.');expect(html).toContain("default-src 'none'")
})
