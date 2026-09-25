import {readFile} from 'node:fs/promises'
import {sha,hash,check,exactKeys,digest} from '../../.superpowers/m80-backup-core'
const snapshot=JSON.parse(await readFile('operations/agent-improvement/snapshots/M80-BACKUP-REHEARSAL-PREP-20260924-CANDIDATE3.json','utf8'))
const source=snapshot.artifacts.find((a:any)=>a.path.endsWith('hosted-entry.ts')).text as string
const constants=Object.fromEntries([...source.matchAll(/(?:export )?const (\w+) = "([^"]*)"(?: as const)?/g)].map(m=>[m[1],m[2]]))
const code=source.slice(source.indexOf('export async function validateAcceptedPreparationEvidence'),source.indexOf('async function assertPrivateNewPath')).replace('export async','async')
const bindings={...constants,readFile,sha,hash,check,exactKeys,digest}
const path='evaluations/research-qa/m80-backup-rehearsal-independent-20260924-candidate3-review.json',pin={path,sha256:sha(await readFile(path))}
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor
await new AsyncFunction(...Object.keys(bindings),new Bun.Transpiler({loader:'ts'}).transformSync(code)+';await validateAcceptedPreparationEvidence();await validateBackupHelperReview('+JSON.stringify(pin)+',"429ac122e20aec4230300ef092d9534a7cd912ec39ee65d2c6e33f8b040faf07");')(...Object.values(bindings))
await Bun.write('evaluations/research-qa/m80-backup-rehearsal-independent-20260924-candidate3-canonical.json',JSON.stringify({status:'pass',actualCanonicalReview:pin,actualFrozenPrivateValidatorAccepted:true,boundary:'Actual canonical review and accepted preparation files; exact frozen private validator; read-only no DB/network'},null,2)+'\n')
console.log('Actual canonical transport review accepted by exact frozen private validator')
