import {expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {m78CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m78-validation';
import {runM78Continuation4ReadonlyRecovery2, evaluateM78ReadonlyRecovery2Capture, M78_READONLY_RECOVERY2_AUTH as AUTH, M78_READONLY_RECOVERY2_PATHS as PATHS, type Recovery2Admission} from '../../tools/staging/check-m78-continuation4-readonly-recovery2';

const sha = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex');
async function admission(): Promise<Recovery2Admission> {
  const paths = {
    mainText: '.superpowers/m78-hosted-continuation4.jsonl', diagnosticText: '.superpowers/m78-hosted-continuation4-diagnostics.jsonl',
    baselineResultText: 'evaluations/research-qa/m78-continuation4-baseline-independent-result.json', exerciseGateText: '.superpowers/m78-continuation4-exercise-gate.json',
    providerObservationText: 'evaluations/research-qa/m78-continuation4-failure-http-observation.json', browserObservationText: 'evaluations/research-qa/m78-continuation4-browser-http-observation.json',
    failureReviewText: 'evaluations/research-qa/m78-continuation4-exercise-failure-qa-result.json',
    failedRecoveryJournalText: '.superpowers/m78-continuation4-readonly-recovery.jsonl', failedRecoveryDiagnosticText: '.superpowers/m78-continuation4-readonly-recovery-diagnostics.jsonl', failedRecoveryReviewText: 'evaluations/research-qa/m78-readonly-failure-review2-result.json',
  };
  const evidence = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
  const sourcePins = Array.from({length: 173}, (_, i) => ({path: i ? `mock-source-${i}` : 'tools/staging/check-m78-continuation4-readonly-recovery2.ts', sha256: sha('synthetic-source')}));
  return {...evidence, currentSourcePins: sourcePins, currentSourceGateText: JSON.stringify({status: 'm78_continuation4_readonly_recovery2_source_admitted', historicalExerciseGateSha256: '9fe233c964b8c40f6c7a9871eecf75a318e7a800f2ec14570c6803288ff9dce7', sourcePins, sourcePinsSha256: sha(canonical(sourcePins)), failedRecoverySha256: sha(evidence.failedRecoveryJournalText!), failedRecoveryDiagnosticsSha256: sha(evidence.failedRecoveryDiagnosticText!), failedRecoveryReviewSha256: sha(evidence.failedRecoveryReviewText!), runtime: {commit: 'a'.repeat(40), deploymentId: 'synthetic-only', imageDigest:'sha256:'+'b'.repeat(64)}}), load: async () => 'synthetic-source'} as Recovery2Admission;
}

test('diagnostic storage failure cannot suppress cleanup of four known sessions', async () => {
  const files = new Map<string, string>(); let logouts = 0;
  const result = await runM78Continuation4ReadonlyRecovery2({
    admission: await admission(), expectedSubjects: {manager1: 'manager1', manager2: 'manager2', member: 'member', outsider: 'outsider'},
    io: {read: async path => files.get(path) ?? null, append: async (path, text) => {
      const event = path === PATHS.diagnostics ? JSON.parse(text) : null;
      if (event?.kind === 'request_intent' && event.data.route === 'auth:/auth/v1/logout') throw Error('synthetic diagnostic disk failure');
      files.set(path, (files.get(path) ?? '') + text);
    }},
    fetch: (async (url: any, init: any) => {
      if (String(url).startsWith(AUTH)) { if (String(url).includes('/logout')) {logouts++; return new Response(null, {status: 204});} return Response.json({synthetic: true}); }
      const token = new Headers(init?.headers).get('authorization');
      return Response.json({}, {status: !token ? 401 : token === 'Bearer outsider' ? 403 : 200, headers: {'cache-control': 'no-store'}});
    }) as typeof fetch,
    auth: {
      open: async (role, request) => {await request(AUTH + '/auth/v1/token', {method: 'POST'}); return {role, subject: role, authorization: 'Bearer ' + role, status: 200};},
      close: async (_session, request) => (await request(AUTH + '/auth/v1/logout?scope=local', {method: 'POST'})).status,
    },
    decoders: {scope1: async () => {throw Error('synthetic early decode refusal');}} as any,
    readLegacy: async () => {throw Error('legacy must not run');},
  });
  expect(result.status).toBe('failed');
  expect(logouts).toBe(4);
  expect(files.has(PATHS.observation)).toBe(false);
});

test('raw capture survives malformed and BOM JSON while capture-storage failure stops reads and closes sessions', async () => {
  for (const scenario of ['malformed','bom','capture_failure'] as const) {
    const files=new Map<string,string>(); let appReads=0,logouts=0;
    const raw=scenario==='bom'?new Uint8Array([239,187,191,123,125]):new TextEncoder().encode('{broken');
    const result=await runM78Continuation4ReadonlyRecovery2({
      admission:await admission(),expectedSubjects:{manager1:'manager1',manager2:'manager2',member:'member',outsider:'outsider'},
      io:{read:async p=>files.get(p)??null,append:async(p,text)=>{
        if(p===PATHS.rawCapture&&scenario==='capture_failure')throw Error('synthetic capture disk failure');
        files.set(p,(files.get(p)??'')+text);
      }},
      fetch:(async(url:any,init:any)=>{
        if(String(url).startsWith(AUTH)){
          if(String(url).includes('/logout')){logouts++;return new Response(null,{status:204});}
          return Response.json({access_token:'synthetic-secret-auth-body'});
        }
        appReads++;const auth=new Headers(init?.headers).get('authorization');
        return new Response(appReads<=2?'{}':raw,{status:!auth?401:auth==='Bearer outsider'?403:200,headers:{'cache-control':'no-store','set-cookie':'synthetic-secret-cookie'}});
      }) as typeof fetch,
      auth:{open:async(role,request)=>{const r=await request(AUTH+'/auth/v1/token',{method:'POST'});await r.body?.cancel();return{role,subject:role,authorization:'Bearer '+role,status:200};},close:async(_s,request)=>(await request(AUTH+'/auth/v1/logout?scope=local',{method:'POST'})).status},
      decoders:{scope1:async()=>{throw Error('synthetic decoded graph refusal');}} as any,
      readLegacy:async()=>{throw Error('legacy must not run');},
    });
    expect(result.status).toBe('failed');expect(logouts).toBe(4);expect(files.has(PATHS.observation)).toBe(false);
    if(scenario==='capture_failure'){expect(appReads).toBe(1);expect(files.has(PATHS.rawCapture)).toBe(false);expect(result.failureCategory).toBe('capture');}
    else{
      expect(appReads).toBe(3);const text=files.get(PATHS.rawCapture)!;
      expect(text.includes('synthetic-secret')).toBe(false);
      const captured=evaluateM78ReadonlyRecovery2Capture(text);expect(captured).toHaveLength(3);
      const last=captured.at(-1)!;const recovered=last.encoding==='base64'?Buffer.from(last.body,'base64'):Buffer.from(last.body,'utf8');
      expect(new Uint8Array(recovered)).toEqual(raw);expect(last.status).toBe('captured_unreviewed');
      expect(result.failureStage?.startsWith('decode:')).toBe(true);
    }
  }
});

test('lost token-response diagnostic preserves the known session and permits only local cleanup', async () => {
  for (const suffix of ['?scope=local', '', '?scope=global', '?scope=local&scope=global']) {
    const files = new Map<string,string>(); let tokenBodiesRead=0, cleanups=0, ordinaryRequests=0;
    const result=await runM78Continuation4ReadonlyRecovery2({
      admission:await admission(),expectedSubjects:{manager1:'manager1',manager2:'manager2',member:'member',outsider:'outsider'},
      io:{read:async p=>files.get(p)??null,append:async(p,text)=>{
        if(p===PATHS.diagnostics && JSON.parse(text).kind==='response_headers')throw Error('injected header log loss');
        files.set(p,(files.get(p)??'')+text);
      }},
      fetch:(async(url:any)=>{if(String(url).includes('/logout')){cleanups++;return new Response(null,{status:204})}ordinaryRequests++;return Response.json({token:'synthetic-token'})}) as typeof fetch,
      auth:{open:async(role,request)=>{const r=await request(AUTH+'/auth/v1/token?grant_type=password',{method:'POST'});const b:any=await r.json();expect(b.token).toBe('synthetic-token');tokenBodiesRead++;return{role,subject:role,authorization:'Bearer synthetic-token',status:200}},close:async(_s,request)=>(await request(AUTH+'/auth/v1/logout'+suffix,{method:'POST'})).status},
      readLegacy:async()=>{throw Error('legacy forbidden')},
    });
    expect(result.status).toBe('failed');expect(tokenBodiesRead).toBe(1);expect(ordinaryRequests).toBe(1);
    expect(cleanups).toBe(suffix==='?scope=local'?1:0);expect(files.has(PATHS.observation)).toBe(false);
  }
});
