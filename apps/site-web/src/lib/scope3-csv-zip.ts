import { SCOPE3_CSV_SECTIONS } from "../../../../packages/neuvetra-database/src/scope3-report-csv"
import { SCOPE3_CSV_TEXT_R3D } from "./scope3-text-r3d"

/**
 * Round 3 lane D (PR-13; Claude, 31 October 2026): the Scope 3 CSV as a ZIP of one CSV per section. The single-file CSV is
 * unchanged (it is the bytes a frozen version stores); this only splits it. Each section file is that section's header row
 * and rows, byte for byte; the notes and column definitions (the `#` lines) go to one notes file. The ZIP is written
 * uncompressed ("stored"), with UTF-8 names, so no library is needed. Loaded only when the user asks for the ZIP.
 */

/** The CSV's records (quote-aware: a quoted cell may hold a comma, a quote or a line break), each without its line end. */
export function scope3CsvRecords(csv: string): string[] {
  const out: string[] = []
  let start = 0, quoted = false
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]
    if (c === "\"") quoted = !quoted
    else if (c === "\n" && !quoted) { out.push(csv.slice(start, i).replace(/\r$/, "")); start = i + 1 }
  }
  if (start < csv.length) out.push(csv.slice(start).replace(/\r$/, ""))
  return out
}
const firstCell = (record: string) => { if (!record.startsWith("\"")) return record.split(",", 1)[0]!; const end = record.indexOf("\",", 1); return (end < 0 ? record.slice(1, -1) : record.slice(1, end)).replace(/""/g, "\"") }

export interface Scope3CsvSectionFile { name: string; section: string | null; text: string }
/**
 * Splits the documented CSV (layout version 2: `#` notes, then sections in `SCOPE3_CSV_SECTIONS` order, each starting with
 * its own header row whose first cell is "Section") into a notes file and one file per section. Throws when the CSV does
 * not have that layout, so a split can never put a row in the wrong file.
 */
export function scope3CsvSectionFiles(csv: string, baseName: string): Scope3CsvSectionFile[] {
  const notes: string[] = [], sections: Array<{ section: string; rows: string[] }> = []
  for (const record of scope3CsvRecords(csv)) {
    const first = firstCell(record)
    if (first.startsWith("#") || first.startsWith("'#")) { if (sections.length) throw new Error("A note line follows the sections."); notes.push(record); continue }
    if (first === "Section") { const section = SCOPE3_CSV_SECTIONS[sections.length]; if (!section) throw new Error("More sections than the layout lists."); sections.push({ section, rows: [record] }); continue }
    const current = sections[sections.length - 1]
    if (!current || first !== current.section) throw new Error(`A ${first} row is outside its section.`)
    current.rows.push(record)
  }
  if (sections.length !== SCOPE3_CSV_SECTIONS.length) throw new Error("The CSV does not have every section.")
  const pad = (n: number) => String(n).padStart(2, "0")
  return [
    { name: `${baseName}/${SCOPE3_CSV_TEXT_R3D.notesFile}`, section: null, text: [SCOPE3_CSV_TEXT_R3D.readme(SCOPE3_CSV_SECTIONS), ...notes].join("\n") + "\n" },
    ...sections.map((item, i) => ({ name: `${baseName}/${pad(i + 1)}-${item.section.toLowerCase()}.csv`, section: item.section, text: item.rows.join("\n") + "\n" })),
  ]
}

const CRC_TABLE = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0 } return table })()
export function scope3Crc32(bytes: Uint8Array): number { let c = 0xffffffff; for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

/** A ZIP archive (stored, no compression; UTF-8 names) of the given files, with the DOS time of `when`. */
export function scope3Zip(files: ReadonlyArray<{ name: string; text: string }>, when: Date): Uint8Array {
  const encoder = new TextEncoder(), parts: Uint8Array[] = [], central: Uint8Array[] = []
  const time = (when.getUTCHours() << 11) | (when.getUTCMinutes() << 5) | Math.floor(when.getUTCSeconds() / 2)
  const date = ((Math.max(1980, when.getUTCFullYear()) - 1980) << 9) | ((when.getUTCMonth() + 1) << 5) | when.getUTCDate()
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.name), data = encoder.encode(file.text), crc = scope3Crc32(data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true)
    local.setUint16(10, time, true); local.setUint16(12, date, true); local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true)
    local.setUint16(26, name.length, true); local.setUint16(28, 0, true)
    const head = new DataView(new ArrayBuffer(46))
    head.setUint32(0, 0x02014b50, true); head.setUint16(4, 20, true); head.setUint16(6, 20, true); head.setUint16(8, 0x0800, true); head.setUint16(10, 0, true)
    head.setUint16(12, time, true); head.setUint16(14, date, true); head.setUint32(16, crc, true); head.setUint32(20, data.length, true); head.setUint32(24, data.length, true)
    head.setUint16(28, name.length, true); head.setUint32(42, offset, true)
    parts.push(new Uint8Array(local.buffer), name, data); central.push(new Uint8Array(head.buffer), name)
    offset += 30 + name.length + data.length
  }
  const size = central.reduce((n, part) => n + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)], out = new Uint8Array(all.reduce((n, part) => n + part.length, 0))
  let at = 0
  for (const part of all) { out.set(part, at); at += part.length }
  return out
}

/** The ZIP of a Scope 3 CSV, one file per section, in a folder named after the single-file CSV. */
export function scope3CsvZip(csv: string, fileName: string, when: Date): Uint8Array {
  return scope3Zip(scope3CsvSectionFiles(csv, fileName.replace(/\.csv$/, "")), when)
}
