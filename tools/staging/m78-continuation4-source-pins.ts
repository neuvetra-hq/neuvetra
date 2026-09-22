import {readFile} from 'node:fs/promises';
import {m78Continuation3SourcePins,M78_CONTINUATION3_EVIDENCE_PINS} from './m78-continuation3-source-pins';
import {M78_CONTINUATION4_PATHS,M78_CONTINUATION4_PRIOR_FAILURE} from './check-m78-continuation4';
const sha=(bytes:Uint8Array)=>new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
export const M78_CONTINUATION4_EVIDENCE_PINS=[...M78_CONTINUATION3_EVIDENCE_PINS,{path:M78_CONTINUATION4_PATHS.actualFailedMain,sha256:M78_CONTINUATION4_PRIOR_FAILURE.mainSha256},{path:M78_CONTINUATION4_PATHS.actualFailedDiagnostics,sha256:M78_CONTINUATION4_PRIOR_FAILURE.diagnosticsSha256},{path:M78_CONTINUATION4_PATHS.failedReview,sha256:M78_CONTINUATION4_PRIOR_FAILURE.reviewSha256}]as const;
export async function m78Continuation4SourcePins(){
 const receipt='evaluations/research-qa/m78-continuation3-preparation-source-pins.json',bytes=await readFile(receipt);if(sha(bytes)!=='95c254bdacfe072c9c2b5ec658c6cb44b565715ac69427a6988fb7396c891035')throw Error('Admitted continuation3 source receipt changed');
 const base=await m78Continuation3SourcePins();if(base.length!==166||JSON.stringify(base)!==JSON.stringify(JSON.parse(bytes.toString())))throw Error('Admitted166 source changed');
 const extra=await Promise.all([receipt,'tools/staging/check-m78-continuation4.ts','tools/staging/check-m78-continuation4.test.ts','tools/staging/m78-continuation4-source-pins.ts',M78_CONTINUATION4_PATHS.failedMain,M78_CONTINUATION4_PATHS.failedDiagnostics,M78_CONTINUATION4_PATHS.failedReview].map(async path=>({path,sha256:sha(await readFile(path))})));
 return[...base,...extra].sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
if(import.meta.main)console.log(JSON.stringify(await m78Continuation4SourcePins()));
