import { readdir, readFile, rename } from "node:fs/promises"
await rename(new URL("../dist-staging/staging.html", import.meta.url), new URL("../dist-staging/index.html", import.meta.url))

// Round 2 lane E (ENG-13; Claude, 31 October 2026): the bundle budget. The build fails when the entry chunk grows past its
// budget, or when the Scope 3 record forms, data-quality editor or spend import are bundled into it again (they load on
// first use, components/scope3/lazy-forms.tsx). Measured on 31 October 2026: entry 1,687.86 kB raw, 457.39 kB gzip
// (wave 5: 1,741.42 / 469.41 kB); the budget leaves about 2% for ordinary growth. Raise it only with a reason in the log.
// Round 2 integration (31 October 2026; log s3/log/integration-r2.md): lanes B, C and D added the Results to-do list,
// filters, readiness gate and frozen-report code to the merged tree (entry 1,731,409 bytes, 474,942 gzip). The frozen report
// versions now load on first use too (Scope3ReportVersions, about 27 kB), which brings the entry to 1,704,883 bytes and
// 467,661 gzip: inside the raw budget, 1,661 bytes over the gzip one. The gzip budget is raised to 470,000 for that merged
// growth (0.5% headroom); the raw budget is unchanged.
const BUDGET = { entryBytes: 1_720_000, entryGzipBytes: 470_000 }
// Completion acceptance keeps 10 kB free under the unchanged budget, using this platform's actual compressor.
const REQUIRED_GZIP_HEADROOM = 10_000
const LAZY = [["Scope3RecordForm", "Supplier-specific purchase (Scope 3)"], ["SpendImport", "Import spend"], ["DataQualityEditor", "Why these ratings differ from the method defaults"],
  ["Scope3ReportVersions", "Prepare report version"]] as const
const assets = new URL("../dist-staging/assets/", import.meta.url)
const html = await readFile(new URL("../dist-staging/index.html", import.meta.url), "utf8")
const entryName = /<script[^>]+src="[^"]*assets\/([^"]+\.js)"/.exec(html)?.[1]
if (!entryName) throw new Error("bundle budget: the entry script is not named in index.html")
const entry = await readFile(new URL(entryName, assets))
const gzip = Bun.gzipSync(entry).byteLength
const files = await readdir(assets)
const problems: string[] = []
if (entry.byteLength > BUDGET.entryBytes) problems.push(`entry chunk ${entryName} is ${entry.byteLength} bytes, over the ${BUDGET.entryBytes}-byte budget`)
if (gzip > BUDGET.entryGzipBytes) problems.push(`entry chunk ${entryName} is ${gzip} bytes gzipped, over the ${BUDGET.entryGzipBytes}-byte budget`)
else if (BUDGET.entryGzipBytes - gzip < REQUIRED_GZIP_HEADROOM) problems.push(`entry chunk ${entryName} leaves ${BUDGET.entryGzipBytes - gzip} gzip bytes free; at least ${REQUIRED_GZIP_HEADROOM} are required`)
const entryText = entry.toString("utf8")
for (const [chunk, marker] of LAZY) {
  if (!files.some(file => file.startsWith(`${chunk}-`) && file.endsWith(".js"))) problems.push(`${chunk} has no chunk of its own`)
  if (entryText.includes(marker)) problems.push(`${chunk} is bundled into the entry chunk (found “${marker}”)`)
}
// Round 2 polish (lane D, 31 October 2026; ENG-13 follow-up): the 1,016 NAICS titles (src/lib/scope3-naics-titles.ts,
// about 58 kB) load with the spend form and spend import chunks, never with the entry chunk.
const NAICS_MARKER = "Other Similar Organizations (except Business, Professional, Labor, and Political Organizations)"
if (entryText.includes(NAICS_MARKER)) problems.push("the NAICS titles are bundled into the entry chunk")
const lazyTexts = await Promise.all(files.filter(file => file.endsWith(".js") && file !== entryName).map(file => readFile(new URL(file, assets), "utf8")))
if (!lazyTexts.some(text => text.includes(NAICS_MARKER))) problems.push("the NAICS titles are in no lazy chunk")
if (problems.length) { console.error(`Bundle budget failed:\n- ${problems.join("\n- ")}`); process.exit(1) }
console.log(`Bundle budget: entry ${entryName} ${entry.byteLength} bytes (budget ${BUDGET.entryBytes}), gzip ${gzip} (budget ${BUDGET.entryGzipBytes}); lazy chunks: ${LAZY.map(([chunk]) => chunk).join(", ")}`)
