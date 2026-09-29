/** Supervised native child for one forced-timeout lifecycle on one pg.Client. */
import { createHostedSetupDedicatedClient, type WorkspaceSql } from "./hosted-setup-dedicated-client"

const url = process.argv[2]
if (!url) throw new Error("synthetic loopback URL required")

const db = await createHostedSetupDedicatedClient({
  connectionString: url,
  target: { kind: "synthetic-loopback" },
  transactionTimeoutMs: 350,
  localDeadlineGraceMs: 1_500,
  teardownTimeoutMs: 1_000,
  applicationName: "dedicated-client-server-timeout",
})
let retained!: WorkspaceSql
let release!: () => void
const blocked = new Promise<void>(resolve => { release = resolve })
let observeLate!: (value: unknown) => void
const late = new Promise<unknown>(resolve => { observeLate = resolve })
const operation = db.transaction(async tx => {
  retained = tx
  await tx.query(
    "insert into adapter_probe(id,payload,numeric_text,instant,tags) values(2,$1,1,now(),array['timeout'])",
    [new Uint8Array([2])],
  )
  await blocked
  try {
    await tx.query("insert into adapter_probe(id,payload,numeric_text,instant,tags) values(3,'x',1,now(),array['late'])")
    observeLate("accepted")
  } catch (error) {
    observeLate(error)
  }
})
let failure: unknown
try { await operation } catch (error) { failure = error }
release()
const lateFailure = await late
let retainedFailure: unknown
try { await retained.exec("insert into adapter_probe(id,payload,numeric_text,instant,tags) values(4,'x',1,now(),array['later'])") } catch (error) { retainedFailure = error }
await db.close()
const code = (failure as { code?: unknown } | undefined)?.code
const sqlState = (failure as { sqlState?: unknown } | undefined)?.sqlState
const lateCode = (lateFailure as { code?: unknown } | undefined)?.code
const retainedCode = (retainedFailure as { code?: unknown } | undefined)?.code
if (!['HOSTED_SETUP_CLIENT_CONNECTION_TERMINATED', 'HOSTED_SETUP_CLIENT_TRANSACTION_DEADLINE'].includes(String(code))) throw new Error("server timeout was not surfaced")
if (lateCode !== "HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED" || retainedCode !== "HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED") throw new Error("late callback capability was not permanently revoked")
console.log(JSON.stringify({ status: "forced_server_timeout_refused", code, sqlState: typeof sqlState === "string" ? sqlState : null, lateCode, retainedCode }))
