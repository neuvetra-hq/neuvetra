import { ZIP_LOOKUP_EGRID2023_SHA256, ZIP_LOOKUP_EGRID2023_URL, type Scope2Lookup } from "../calculation/scope2-authority"

type Utility = Scope2Lookup["utilities"][number]
let indexed: Promise<Map<string, Utility[]>> | null = null

function csvRows(source: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++ }
      else quoted = !quoted
    } else if (char === "," && !quoted) {
      row.push(field); field = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++
      row.push(field); field = ""
      if (row.some(value => value !== "")) rows.push(row)
      row = []
    } else field += char
  }
  if (quoted) throw new Error("ZIP lookup source is invalid.")
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

async function loadIndex(): Promise<Map<string, Utility[]>> {
  const bytes = await Bun.file(ZIP_LOOKUP_EGRID2023_URL).bytes()
  const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  if (digest !== ZIP_LOOKUP_EGRID2023_SHA256) throw new Error("ZIP lookup source is unavailable.")
  const rows = csvRows(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  if (rows.shift()?.join("|") !== "zip|state|eiaid|UtilName|SUBRGN|Predominant Utility") throw new Error("ZIP lookup source is invalid.")
  const index = new Map<string, Utility[]>()
  for (const row of rows) {
    if (row.length !== 6 || !/^\d{5}$/.test(row[0]!) || !/^(?:\d+)?$/.test(row[2]!) || !/^[A-Z0-9]+$/.test(row[4]!) || !["0", "1"].includes(row[5]!)) throw new Error("ZIP lookup source is invalid.")
    const utility = { state: row[1]!, eiaId: row[2]!, utility: row[3]!, subregion: row[4]!, predominantUtility: row[5] === "1" }
    const existing = index.get(row[0]!) ?? []
    existing.push(utility)
    index.set(row[0]!, existing)
  }
  return index
}

/** The same reviewed eGRID CSV and SHA pin used by the Scope 2 engine. */
export async function lookupCollectionZip(zip: string): Promise<Scope2Lookup> {
  if (!/^\d{5}$/.test(zip)) throw new Error("Invalid ZIP.")
  if (!indexed) indexed = loadIndex().catch(error => { indexed = null; throw error })
  const rows = (await indexed).get(zip) ?? []
  const subregions = [...new Set(rows.map(row => row.subregion))].sort()
  const utilities = [...rows].sort((a, b) => Number(b.predominantUtility) - Number(a.predominantUtility) || (a.utility < b.utility ? -1 : a.utility > b.utility ? 1 : 0))
  return { zip, subregions, utilities, needsUtilityChoice: subregions.length > 1, found: rows.length > 0, source: "EPA Power Profiler zip.csv (eGRID2023)" }
}
