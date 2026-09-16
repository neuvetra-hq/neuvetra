/** Read-only extraction of a synthetic retained M74 head for real browser
 * semantic proof checks. This is not a native M75 save or integrity verdict. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {decodeMobileVersion} from '../../apps/site-web/src/lib/m74-api'
import {decodeCorporateVersion} from '../../apps/site-web/src/lib/m71-api'
const db=createPostgresConnection('postgres://m63_test_admin@127.0.0.1:55463/m75_ops_author_1789536693413',{tls:false,maxConnections:1})
try{
 const proof=await db.transaction(async tx=>{
  await tx.exec('SET TRANSACTION READ ONLY')
  const rows=(await tx.query<{payload:any;review:any}>(`select v.payload,r.payload review from neuvetra.mobile_diesel_heads h join neuvetra.mobile_diesel_versions v on v.id=h.version_id left join neuvetra.mobile_diesel_reviews r on r.version_id=v.id order by v.id`)).rows
  const row=rows[0];if(!row)throw Error('No retained synthetic vehicle workpaper')
  const v={...row.payload,review:row.review??null},coverageVersion=structuredClone(v.coverageVersion)
  await decodeCorporateVersion(coverageVersion,v.companyId);await decodeMobileVersion(v,v.companyId)
  return {coverageVersion,workpaperVersions:[v]}
 })
 const path='evaluations/research-qa/m75-independent-native-proof.json';await Bun.write(path,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({path,coverage:proof.coverageVersion.id,workpapers:proof.workpaperVersions.length,decoded:true}))
}finally{await db.close()}
