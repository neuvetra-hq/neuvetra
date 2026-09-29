import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createPostgresConnection } from '../../packages/neuvetra-database/src/hosted'
import { captureApplicationState, validateApplicationSnapshot, verifyExactSource21 } from '../../.superpowers/m80-backup-core'

const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex')
const canonical = (v: any): string => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v)
const same = (a: any, b: any) => canonical(a) === canonical(b)
const check = (v: unknown, label: string) => { if (!v) throw new Error(label) }
const bag = (rows: any[]) => rows.map(canonical).sort()
const scopes = (rows: any[]) => {
  check(rows.every(r => typeof r.schema === 'string' && r.schema.length > 0), 'malformed ACL scope')
  return rows.filter(r => r.schema === '*' || r.schema === 'neuvetra')
}
const project = (s: any) => {
  const x = structuredClone(s)
  delete x.contentSha256; delete x.metadataSha256; delete x.applicationStateSha256
  x.inventory.defaultAcls = bag(scopes(x.inventory.defaultAcls))
  x.internalTriggers = bag(x.internalTriggers)
  return x
}
const accepted = JSON.parse(await readFile('operations/agent-improvement/snapshots/M80-BACKUP-REHEARSAL-PREP-20260924-CANDIDATE3.json', 'utf8'))
for (const a of accepted.artifacts) check(sha(await readFile(a.path)) === a.sha256, 'accepted source changed')
const archive = '.superpowers/m80-backup-hosted-20260925-001.dpapi'
check(sha(await readFile(archive)) === 'cad84e68dac90cb703814f9ff10bb116c615ebe13c860f54d630910ece8483fd', 'archive pin')
const p = Bun.spawn(['C:/Users/nimab/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe', '-NoProfile', '-NonInteractive', '-File', '.superpowers/m80-backup-seal.ps1', '-Mode', 'Unseal', '-ArchivePath', archive], { stdout: 'pipe', stderr: 'pipe' })
const [text, , exit] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited])
check(exit === 0, 'unseal refused')
const source = validateApplicationSnapshot(JSON.parse(text), 'cdcf897468466a05897b745784e8057cec18ed999f3bb7ffa733d8425b0cb270').state
const db = createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m80_backup_foundation_1790303149992', { tls: false, maxConnections: 1 })
let restored: typeof source
try {
  restored = await db.transaction(async tx => {
    await tx.exec('set transaction isolation level repeatable read read only')
    await verifyExactSource21(tx, 'm80_backup_foundation_1790303149992', 'local')
    return captureApplicationState(tx)
  })
} finally { await db.close() }
const acls = source.inventory.defaultAcls as any[]
const restoredAcls = restored.inventory.defaultAcls as any[]
const sourceBag = bag(source.internalTriggers)
const restoredBag = bag(restored.internalTriggers)
check(acls.length === 27 && restoredAcls.length === 0, 'actual ACL count')
check(scopes(acls).length === 0 && scopes(restoredAcls).length === 0, 'actual application/global ACL scope')
check(source.internalTriggers.length === 998 && restored.internalTriggers.length === 998, 'actual trigger count')
check(same(sourceBag, restoredBag) && !same(source.internalTriggers, restored.internalTriggers), 'actual trigger multiset/order')
check(same(project(source), project(restored)), 'unexplained metadata/content difference')
const controls: string[] = []
const accepts = (name: string, changed: any) => { check(same(project(source), project(changed)), name); controls.push(name) }
const refuses = (name: string, changed: any) => { check(!same(project(source), project(changed)), name); controls.push(name) }
let x = structuredClone(restored); x.internalTriggers.reverse(); accepts('trigger permutation', x)
x = structuredClone(restored); x.internalTriggers.pop(); refuses('missing trigger occurrence', x)
x = structuredClone(restored); x.internalTriggers.push(structuredClone(x.internalTriggers[0]!)); refuses('added duplicate occurrence', x)
x = structuredClone(restored); x.internalTriggers[0]!.enabled = 'D'; refuses('changed trigger enabled state', x)
x = structuredClone(restored); x.internalTriggers[0]!.constraintName += '_qa_changed'; refuses('changed constraint identity', x)
x = structuredClone(restored); x.internalTriggers[0]!.tableName += '_qa_changed'; refuses('changed trigger relation', x)
x = structuredClone(restored); (x.inventory.defaultAcls as any[]).push({ schema: 'qa_external', owner: 'qa', kind: 'r', acl: 'synthetic' }); accepts('explicit external schema ACL', x)
for (const schema of ['*', 'neuvetra']) {
  x = structuredClone(restored); (x.inventory.defaultAcls as any[]).push({ schema, owner: 'qa', kind: 'r', acl: 'synthetic' }); refuses('retained ACL addition ' + schema, x)
  const left = structuredClone(source); (left.inventory.defaultAcls as any[]).push({ schema, owner: 'qa', kind: 'r', acl: 'before' })
  const right = structuredClone(left); (right.inventory.defaultAcls as any[]).at(-1).acl = 'after'
  check(!same(project(left), project(right)), 'retained ACL change'); controls.push('retained ACL change ' + schema)
  ;(right.inventory.defaultAcls as any[]).pop(); check(!same(project(left), project(right)), 'retained ACL loss'); controls.push('retained ACL loss ' + schema)
}
x = structuredClone(restored); x.tableSecurity[0]!.acl += '_qa_changed'; refuses('existing table ACL change', x)
x = structuredClone(restored); x.schemaSecurity[0]!.acl += '_qa_changed'; refuses('application schema ACL change', x)
x = structuredClone(restored); x.migrationReceipts[0]!.sha256 = '0'.repeat(64); refuses('migration receipt change', x)
let malformedRefused = false
try { scopes([{ schema: null }]) } catch { malformedRefused = true }
check(malformedRefused, 'invalid scope must refuse'); controls.push('malformed ACL scope')
console.log(JSON.stringify({ profile: 'neuvetra.m80.independent-readonly-normalization-diagnosis.v1', acceptedSourcePins: accepted.artifacts.length, sourceAclRows: acls.length, restoredAclRows: restoredAcls.length, sourceGlobalOrApplicationAclRows: scopes(acls).length, restoredGlobalOrApplicationAclRows: scopes(restoredAcls).length, allExcludedAclsHaveExplicitExternalSchema: true, sourceTriggerRows: sourceBag.length, restoredTriggerRows: restoredBag.length, triggerMultisetExactIncludingMultiplicity: true, rawTriggerOrderDiffers: true, distinctTriggerSemanticRows: new Set(sourceBag).size, allOtherCapturedStateExact: true, contentSha256: source.contentSha256, pureInMemoryControls: controls, readOnly: true, localConnectionsClosed: true, repairImplemented: false, migrationAuthorized: false }))
