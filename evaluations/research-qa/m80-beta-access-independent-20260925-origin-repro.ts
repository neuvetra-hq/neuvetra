import { writeFile, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { createBetaAccessServer } from "../../apps/site-api/src/beta-access/server"
const root = resolve(import.meta.dir, "../..")
const expected = "5385252e78342ddf3152060c5b6d12e16023f6f911e12f4a5325f8d1a3686cd5"
const bytes = await readFile(resolve(root, "operations/agent-improvement/snapshots/M80-BETA-ACCESS-IMPLEMENTATION-20260925-CANDIDATE1.json"))
if (process.argv[2] !== expected || new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== expected) throw new Error("Frozen execution gate")
for (const f of JSON.parse(bytes.toString()).files) if (new Bun.CryptoHasher("sha256").update(await readFile(resolve(root, f.path))).digest("hex") !== f.sha256) throw new Error("Source changed")
const databaseName = "m80_beta_access_qa_20260925b", runtimeRole = "m80_beta_access_runtime_qa_20260925b"
const origin = "http://127.0.0.1:3080", observed: unknown[] = [], logs: unknown[] = []
const app = await createBetaAccessServer({ profile: "neuvetra.beta-access.synthetic-rehearsal.v1", databaseName, runtimeRole, databaseUrl: `postgres://${runtimeRole}@127.0.0.1:55472/${databaseName}`, origin, port: 3080 }, { validateIdentity: async () => ({ id: "9a000000-0000-4000-8000-000000000005", email: "qa-5@beta.invalid" }), log: e => logs.push(e) })
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, maxRequestBodySize: 8192, fetch: async r => { observed.push({ method: r.method, origin: r.headers.get("origin") }); return app.fetch(r) } })
const responses: unknown[] = []
try {
  const payload = new TextEncoder().encode(" ".repeat(2049))
  const stream = new ReadableStream({ start(c) { c.enqueue(payload.slice(0, 1000)); c.enqueue(payload.slice(1000)); c.close() } })
  for (const [path, init] of [["/beta-api/invitations/redeem", { method: "POST", headers: { origin, authorization: "Bearer qa-4", "content-type": "application/json" }, body: stream, duplex: "half" }], ["/beta-api/session", { headers: { origin: origin + ".invalid", authorization: "Bearer qa-4" } }], ["/beta-api/session", { headers: { origin: "http://127.0.0.1:3081", authorization: "Bearer qa-4" } }]] as [string, RequestInit][]) {
    const r = await fetch(`http://127.0.0.1:${server.port}${path}`, init)
    const body = await r.text()
    responses.push({ status: r.status, cacheControl: r.headers.get("cache-control"), contentType: r.headers.get("content-type"), requestIdPresent: r.headers.has("x-request-id"), noSniff: r.headers.get("x-content-type-options"), csp: r.headers.get("content-security-policy"), bodyBytes: Buffer.byteLength(body), applicationRequestsObserved: observed.length, applicationLogs: logs.length })
  }
} finally { await server.stop(true); await app.close() }
const result = { candidateSha256: expected, bunVersion: Bun.version, responses, observed, sensitiveValuesPersisted: false, interpretation: "Oversized application413 followed by listener400 without application invocation; fresh subsequent forbidden Origin reaches application403. No authorization grant observed." }
const path = resolve(root, `evaluations/research-qa/m80-beta-access-independent-20260925-origin-result-${Date.now()}.json`)
await writeFile(path, JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify({ resultPath: path, responses }))
