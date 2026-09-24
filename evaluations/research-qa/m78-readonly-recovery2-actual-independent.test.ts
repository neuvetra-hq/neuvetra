import {expect,test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {m78CanonicalJson as canonical,validateM78InventorySave,validateM78ProcessSave,validateM78Report,validateM78Review} from '../../packages/neuvetra-database/src/m78-validation';
import {validateM71Save,validateM71Review} from '../../packages/neuvetra-database/src/m71-validation';
import {validateM73Save,validateM73Review} from '../../packages/neuvetra-database/src/m73-validation';
import {validateM74Save,validateM74Review} from '../../packages/neuvetra-database/src/m74-validation';
import {validateM75Save,validateM75Review} from '../../packages/neuvetra-database/src/m75-validation';
import {validateM76Save,validateM76Review} from '../../packages/neuvetra-database/src/m76-validation';
import {validateM76DieselSave,validateM76DieselReview} from '../../packages/neuvetra-database/src/m76-diesel-validation';
import {validateM77SourceSave,validateM77PopulationSave,validateM77Review} from '../../packages/neuvetra-database/src/m77-validation';
import {verifyM78Continuation4ReadonlyRecovery2 as verifyFrozen} from './m78-readonly-recovery2-independent-review';
import {verifyM78Continuation4ReadonlyRecovery2 as verifyCorrected} from './m78-readonly-recovery2-corrected-review';

const sha=(value:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(value).digest('hex');
const paths={
 mainText:'.superpowers/m78-hosted-continuation4.jsonl',diagnosticText:'.superpowers/m78-hosted-continuation4-diagnostics.jsonl',
 baselineResultText:'evaluations/research-qa/m78-continuation4-baseline-independent-result.json',exerciseGateText:'.superpowers/m78-continuation4-exercise-gate.json',
 providerObservationText:'evaluations/research-qa/m78-continuation4-failure-http-observation.json',browserObservationText:'evaluations/research-qa/m78-continuation4-browser-http-observation.json',failureReviewText:'evaluations/research-qa/m78-continuation4-exercise-failure-qa-result.json',
 failedRecoveryJournalText:'.superpowers/m78-continuation4-readonly-recovery.jsonl',failedRecoveryDiagnosticText:'.superpowers/m78-continuation4-readonly-recovery-diagnostics.jsonl',failedRecoveryReviewText:'evaluations/research-qa/m78-readonly-failure-review2-result.json',
 recoveryJournalText:'.superpowers/m78-continuation4-readonly-recovery2.jsonl',recoveryDiagnosticText:'.superpowers/m78-continuation4-readonly-recovery2-diagnostics.jsonl',recoveryRawCaptureText:'.superpowers/m78-continuation4-readonly-recovery2-raw-capture.jsonl',observationText:'.superpowers/m78-continuation4-readonly-recovery2-observation.json',currentSourceGateText:'.superpowers/m78-readonly-recovery2-source-gate.json',
} as const;
const texts=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await readFile(path,'utf8')]))) as Record<keyof typeof paths,string>;
const last=(text:string)=>JSON.parse(text.trimEnd().split('\n').at(-1)!).sha256;
const admission={journalSha256:sha(texts.recoveryJournalText),journalHead:last(texts.recoveryJournalText),diagnosticsSha256:sha(texts.recoveryDiagnosticText),diagnosticsHead:last(texts.recoveryDiagnosticText),rawCaptureSha256:sha(texts.recoveryRawCaptureText),rawCaptureHead:last(texts.recoveryRawCaptureText),observationSha256:sha(texts.observationText),currentSourceGateSha256:sha(texts.currentSourceGateText)};
const exercise= texts.mainText.trimEnd().split('\n').map(JSON.parse).filter((event:any)=>event.mode==='exercise'&&event.kind==='post_intent');

function validateIntent(name:string,value:unknown){
 if(name==='m78_factual_corporate_successor')return validateM71Save(value);if(name==='m78_corporate_separate_review')return validateM71Review(value);
 if(name.startsWith('m78_rebind_natural_gas_'))return validateM73Save(value);if(name.startsWith('m78_review_natural_gas_'))return validateM73Review(value);
 if(name.startsWith('m78_rebind_mobile_diesel_'))return validateM74Save(value);if(name.startsWith('m78_review_mobile_diesel_'))return validateM74Review(value);
 if(name.startsWith('m78_rebind_stationary_diesel_'))return validateM76DieselSave(value);if(name.startsWith('m78_review_stationary_diesel_'))return validateM76DieselReview(value);
 if(name==='m78_rebind_fugitive_discovery')return validateM77PopulationSave(value);if(name.startsWith('m78_rebind_fugitive_'))return validateM77SourceSave(value);if(name.startsWith('m78_review_fugitive_'))return validateM77Review(value);
 if(name==='m78_rebind_fleet_discovery')return validateM75Save(value);if(name==='m78_review_fleet_discovery')return validateM75Review(value);
 if(name==='m78_rebind_stationary_discovery')return validateM76Save(value);if(name==='m78_review_stationary_discovery')return validateM76Review(value);
 if(name==='m78_complete_process_discovery')return validateM78ProcessSave(value);if(name==='m78_current_inventory_successor')return validateM78InventorySave(value);
 if(name.includes('report'))return validateM78Report(value);if(name==='m78_process_separate_review'||name==='m78_inventory_separate_review')return validateM78Review(value);
 throw Error('unknown recipe validator '+name);
}

test('frozen evaluator failure is exact and corrected evaluator accepts the immutable actual evidence',async()=>{
 await expect(verifyFrozen(texts,admission)).rejects.toThrow('Exact fields required.');
 const value=await verifyCorrected(texts,admission);
 expect(value).toEqual({status:'m78_independent_continuation4_readonly_recovery2_passed',journalEvents:19,diagnosticEvents:195,rawCaptureEvents:81,requests:97,applicationPostRequests:0,addedTypedRecords:37,reports:5,rosterArtifactReads:24,sourceUnion:10,grossKgCo2eExact:'126850.17632025',allCreatedAuthSessionsClosed:true,unknownAuthSessions:0,actualRecoveryAccepted:true,restartAuthorizedByThisResult:false,revisitAuthorizedByThisResult:false,hostedCalls:0});
},15_000);

test('correction is exactly the one dispatch-order insertion',async()=>{
 const frozen=await readFile('evaluations/research-qa/m78-readonly-recovery2-independent-review.ts','utf8');
 const corrected=await readFile('evaluations/research-qa/m78-readonly-recovery2-corrected-review.ts','utf8');
 const anchor="if(name.startsWith('m78_rebind_fugitive_'))return validateM77SourceSave(value);";
 expect(corrected).toBe(frozen.replace(anchor,"if(name==='m78_rebind_fugitive_discovery')return validateM77PopulationSave(value);"+anchor));
 expect(sha(corrected)).toBe('c45f948482a53b9e2f2ba87c1b754bb70a6f2ced079dbf8b4d85657d7b77fa78');
});

test('all 37 actual payloads use their intended validators and exact-field mutations are refused',()=>{
 expect(exercise).toHaveLength(37);
 for(const [index,event] of exercise.entries()){
  expect(()=>validateIntent(event.data.name,event.data.request),`actual operation ${index+1} ${event.data.name}`).not.toThrow();
  expect(()=>validateIntent(event.data.name,{...event.data.request,qaUnexpectedField:true}),`mutated operation ${index+1} ${event.data.name}`).toThrow();
 }
 const discovery=exercise.find((event:any)=>event.data.name==='m78_rebind_fugitive_discovery')!;
 expect(()=>validateM77SourceSave(discovery.data.request)).toThrow('Exact fields required.');
 expect(()=>validateM77PopulationSave(discovery.data.request)).not.toThrow();
});

test('root corrected output is an exact serialization of the independently recomputed pass',async()=>{
 const output=JSON.parse(await readFile('.superpowers/m78-readonly-recovery2-corrected-evaluation.json','utf8'));
 const value=await verifyCorrected(texts,admission);
 expect(output.evaluatorSha256).toBe('c45f948482a53b9e2f2ba87c1b754bb70a6f2ced079dbf8b4d85657d7b77fa78');
 expect(output.entrySha256).toBe('0ed90e01eb37c7e48301ed2b1ba28b6f133f03664abe46d83579dceb78e44056');
 expect(output.admission).toEqual(admission);
 const {observedAt:_,admission:__,evaluatorSha256:___,entrySha256:____,...actual}=output;
 expect(canonical(actual)).toBe(canonical(value));
},15_000);
