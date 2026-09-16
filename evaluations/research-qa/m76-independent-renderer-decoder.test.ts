import {expect,test} from 'bun:test'
import {decodeStationaryVersion} from '../../apps/site-web/src/lib/m76-api'
import {buildM76Dependencies,deriveM76RosterFindings,deriveM76Reconciliation,m76CanonicalJson,m76StatementText,m76InputPayload,m76ContentPayload,m76VersionHashPayload} from '../../packages/neuvetra-database/src/m76-validation'
import {m76RenderReport,m76ReportSnapshot} from '../../packages/neuvetra-database/src/m76-report'
import {independentStationaryGraph,qid} from './m76-independent-graph'

const bytesHash=(v:string)=>new Bun.CryptoHasher('sha256').update(v).digest('hex')
const hash=(v:unknown)=>bytesHash(m76CanonicalJson(v))
function sealedGraph(generatorWorksheetId=qid(322)){
 const g=independentStationaryGraph(),v=g.version
 g.diesel[0].worksheetId=generatorWorksheetId
 v.dependencies=buildM76Dependencies(g.coverage,g.gas,g.diesel,hash)
 v.findings=deriveM76RosterFindings(v.activity,g.coverage)
 v.statement.locator=`m76-equipment-statement:${v.statement.id}:declared-equipment`
 v.statement.text=m76StatementText(v.activity,g.coverage);v.statement.byteLength=new TextEncoder().encode(v.statement.text).length;v.statement.sha256=bytesHash(v.statement.text)
 v.inputSha256=hash(m76InputPayload(v));v.contentSha256=hash(m76ContentPayload(v));v.versionSha256=hash(m76VersionHashPayload(v))
 return g
}

test('M76 standalone declaration decoder accepts canonical production dependency ordering',async()=>{
 // Production groups natural gas then stationary diesel. Arbitrary UUID order
 // must not make the same legitimate dependency set undecodable.
 for(const generatorId of [qid(322),qid(10)]){
  const g=sealedGraph(generatorId)
  expect(await decodeStationaryVersion(g.version,g.companyId)).toEqual(g.version)
 }
})

test('M76 report faithfully renders literal template markers and HTML-sensitive evidence',()=>{
 const g=sealedGraph(),markers=['{{rows}}','{{snapshot}}','$&',"$`","$'",'<img src=x onerror=alert(1)>']
 for(const marker of markers){
  g.version.activity.rosterStatement.issuer=marker;g.version.statement.input=g.version.activity.rosterStatement
  g.version.statement.text=m76StatementText(g.version.activity,g.coverage)
  const r=deriveM76Reconciliation(g.companyId,g.coverage,g.gas,g.diesel,g.version,[],hash),html=m76RenderReport(m76ReportSnapshot(g.version,null,r))
  expect(html.match(/<h2>Full reconciliation union<\/h2>/g)).toHaveLength(1)
  expect(html.match(/<table>/g)).toHaveLength(1)
  expect(html).not.toContain('<img src=x')
  expect(html).toContain(marker.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'))
 }
})
