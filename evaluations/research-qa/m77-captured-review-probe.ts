/** Independent client-only captured-review binding challenge, actual fictional records. */
import {createM77AuthorDatabase,serveM77Fixture} from '../../tools/staging/m77-backend-fixture'
import {decodeFugitiveRegister} from '../../apps/site-web/src/lib/m77-api'
import {m77CanonicalJson,m77Hash,m77BytesHash,m77RenderReport,m77ReportHashPayload} from '../../packages/neuvetra-database/src/index'
const f=await createM77AuthorDatabase('m77_author_qa_review_'+Date.now()),s=await serveM77Fixture(f,0),path='apps/site-web/src/lib/m77-api.ts',pin=m77BytesHash(await Bun.file(path).text())
try{
 const response=await s.server.fetch(new Request(`http://127.0.0.1:${s.server.port}/workspace/${f.companyId}/fugitive-sources`,{headers:{origin:'http://localhost:4186',authorization:'Bearer synthetic-m77-owner'}}));if(response.status!==200)throw Error('Native baseline unavailable.')
 const r=await decodeFugitiveRegister(await response.json(),f.companyId),forged=structuredClone(r),report=forged.worksheets.flatMap(w=>w.reports).find(x=>JSON.parse(x.snapshotJson).review!==null)!,snapshot=JSON.parse(report.snapshotJson)
 snapshot.review.note='COORDINATED-UNSAVED-REVIEW-NOTE';const {decisionSha256,...review}=snapshot.review;snapshot.review.decisionSha256=m77Hash({companyId:f.companyId,...review});report.snapshotJson=m77CanonicalJson(snapshot);report.snapshotSha256=m77BytesHash(report.snapshotJson);report.html=m77RenderReport(snapshot);report.htmlSha256=m77BytesHash(report.html);report.htmlByteLength=new TextEncoder().encode(report.html).length;report.reportSha256=m77Hash(m77ReportHashPayload(report))
 let accepted=false;try{await decodeFugitiveRegister(forged,f.companyId);accepted=true}catch{}
 const authoritative=r.worksheets.flatMap(w=>w.versions).find(v=>v.id===report.versionId)!,result={status:accepted?'captured_review_finding_reproduced':'captured_review_forgery_refused',database:f.name,createdAt:new Date().toISOString(),browserApiSha256:pin,currentApiUnchanged:pin===m77BytesHash(await Bun.file(path).text()),sameRetainedVersionCore:true,differentCapturedReviewDecisionSha256:snapshot.review.decisionSha256!==authoritative.review!.decisionSha256,registerAccepted:accepted,scope:'client_register_object_only; native_backend_and_download_transport_unmodified',hostedEvidence:false}
 await Bun.write('evaluations/research-qa/m77-captured-review-probe-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{await s.close()}
