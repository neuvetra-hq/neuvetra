/** Read-only Candidate3 import-graph review; no database/provider/package actions. */
import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve, relative } from "node:path"
const root = resolve(import.meta.dir, "../..")
const expected = "77aba791a6b48e1306138a1bb62cddb16ee99ab4ee4531802921ffbe07a51f7c"
const digest = (v: Uint8Array | string) => new Bun.CryptoHasher("sha256").update(v).digest("hex")
const candidate = await readFile(resolve(root, "operations/agent-improvement/snapshots/M80-BETA-ACCESS-IMPLEMENTATION-20260925-CANDIDATE3.json"))
if (digest(candidate) !== expected) throw new Error("Frozen snapshot differs")
for (const f of JSON.parse(candidate.toString("utf8")).files) {
  const actual = await readFile(resolve(root, f.path))
  if (digest(actual) !== f.sha256 || !actual.equals(Buffer.from(f.text, "utf8"))) throw new Error("Frozen file differs")
}
const scanner = new Bun.Transpiler({ loader: "ts", target: "bun" })
const seen = new Set<string>(), edges: { from: string; to: string }[] = [], missing: string[] = []
async function visit(path: string) {
  path = resolve(path)
  if (seen.has(path)) return
  seen.add(path)
  if (path.endsWith(".json")) return
  const source = await readFile(path, "utf8")
  for (const imp of scanner.scanImports(source)) {
    let target: string | undefined
    if (imp.path === "@neuvetra/database") target = resolve(root, "packages/neuvetra-database/src/index.ts")
    else if (imp.path.startsWith(".")) target = resolve(dirname(path), imp.path)
    if (!target) continue
    const attempts = [target, target + ".ts", target + ".tsx", target + ".json", resolve(target, "index.ts")]
    let found: string | undefined
    for (const entry of attempts) if (await Bun.file(entry).exists()) { found = entry; break }
    if (!found) { missing.push(`${relative(root, path)}:${imp.path}`); continue }
    edges.push({ from: relative(root, path).replaceAll("\\", "/"), to: relative(root, found).replaceAll("\\", "/") })
    await visit(found)
  }
}
await visit(resolve(root, "packages/neuvetra-database/src/index.ts"))
await visit(resolve(root, "apps/site-api/src/staging/server.ts"))
const graph = [...seen].map(p => relative(root, p).replaceAll("\\", "/")).sort()
const docker = await readFile(resolve(root, "Dockerfile.staging"), "utf8")
const runtimeSection = docker.slice(docker.indexOf("FROM python:"))
const copied = new Set(runtimeSection.split(/\r?\n/).filter(l => l.startsWith("COPY ") && !l.startsWith("COPY --")).flatMap(l => l.split(/\s+/).slice(1, -1)))
const ignore = await readFile(resolve(root, "Dockerfile.staging.dockerignore"), "utf8")
const graphDatabaseFiles = graph.filter(p => p.startsWith("packages/neuvetra-database/src/"))
const copyMissing = graphDatabaseFiles.filter(p => !copied.has(p))
const ignored = graphDatabaseFiles.filter(p => !ignore.split(/\r?\n/).includes("!" + p))
const betaEdges = edges.filter(e => e.to.includes("beta-access"))
const build = await Bun.build({ entrypoints: [resolve(root, "packages/neuvetra-database/src/index.ts"), resolve(root, "apps/site-api/src/staging/server.ts")], target: "bun", packages: "external", write: false })
const result = { candidateSha256: expected, exactFiles: JSON.parse(candidate.toString()).files.length, graphFiles: graph.length, databaseGraphFiles: graphDatabaseFiles.length, missingImports: missing, betaEdges, databaseCopyMissing: copyMissing, databaseIgnoreMissing: ignored, localBundleSuccess: build.success, limitations: "Static local source graph and bundler only; not a Linux container build, package installation, or remote CI result." }
await writeFile(resolve(root, "evaluations/research-qa/m80-beta-access-independent-20260925-review3-graph.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify(result))
