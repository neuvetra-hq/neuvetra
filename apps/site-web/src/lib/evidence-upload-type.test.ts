import { describe, expect, test } from "bun:test"
import { evidencePackZip, evidenceUploadType } from "./evidence-upload-type"

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

describe("evidence upload type", () => {
  test("declares text/csv for a .csv file reported with a known alias or no type (Windows with Excel reports application/vnd.ms-excel)", () => {
    for (const reported of ["", "application/vnd.ms-excel", "application/octet-stream", "text/plain", "application/csv", "text/x-csv", "text/comma-separated-values", "application/x-csv"])
      expect(evidenceUploadType("fuel-log.csv", reported)).toBe("text/csv")
  })

  test("compares the reported type without parameters and accepts text/x-comma-separated-values (CSV-1)", () => {
    for (const reported of ["text/plain; charset=utf-8", "TEXT/PLAIN;charset=UTF-8", "application/vnd.ms-excel; charset=windows-1252", "text/x-comma-separated-values", "text/x-comma-separated-values; charset=utf-8"])
      expect(evidenceUploadType("fuel-log.csv", reported)).toBe("text/csv")
    expect(evidenceUploadType("bill.pdf", "application/octet-stream; name=bill.pdf")).toBe("application/pdf")
    expect(evidenceUploadType("fuel-log.csv", "text/csv; charset=utf-8")).toBe("text/csv; charset=utf-8")
    expect(evidenceUploadType("fuel-log.csv", "image/png; charset=utf-8")).toBe("image/png; charset=utf-8")
    expect(evidenceUploadType("notes.txt", "text/x-comma-separated-values")).toBe("text/x-comma-separated-values")
  })

  test("reads the extension case-insensitively and only from the last dot", () => {
    expect(evidenceUploadType("FUEL-LOG.CSV", "application/vnd.ms-excel")).toBe("text/csv")
    expect(evidenceUploadType("Bill.PDF", "")).toBe("application/pdf")
    expect(evidenceUploadType("archive.csv.zip", "application/vnd.ms-excel")).toBe("application/vnd.ms-excel")
    expect(evidenceUploadType("csv", "application/vnd.ms-excel")).toBe("application/vnd.ms-excel")
  })

  test("declares the spreadsheet, PDF and image types only when the browser reported no type", () => {
    for (const reported of ["", "application/octet-stream"]) {
      expect(evidenceUploadType("meters.xlsx", reported)).toBe(XLSX)
      expect(evidenceUploadType("bill.pdf", reported)).toBe("application/pdf")
      expect(evidenceUploadType("meter.png", reported)).toBe("image/png")
      expect(evidenceUploadType("meter.jpg", reported)).toBe("image/jpeg")
      expect(evidenceUploadType("meter.jpeg", reported)).toBe("image/jpeg")
    }
    expect(evidenceUploadType("meters.xlsx", "application/vnd.ms-excel")).toBe("application/vnd.ms-excel")
    expect(evidenceUploadType("bill.pdf", "text/plain")).toBe("text/plain")
  })

  test("keeps a type the browser already reported correctly", () => {
    expect(evidenceUploadType("fuel-log.csv", "text/csv")).toBe("text/csv")
    expect(evidenceUploadType("meters.xlsx", XLSX)).toBe(XLSX)
    expect(evidenceUploadType("bill.pdf", "application/pdf")).toBe("application/pdf")
  })

  test("never replaces a different explicit type and leaves other files for the server to decide", () => {
    expect(evidenceUploadType("fuel-log.csv", "image/png")).toBe("image/png")
    expect(evidenceUploadType("bill.pdf", "image/jpeg")).toBe("image/jpeg")
    expect(evidenceUploadType("old-meters.xls", "application/vnd.ms-excel")).toBe("application/vnd.ms-excel")
    expect(evidenceUploadType("notes.txt", "text/plain")).toBe("text/plain")
    expect(evidenceUploadType("notes", "")).toBe("")
    expect(evidenceUploadType("archive.zip", "")).toBe("")
  })
})

describe("evidence-pack ZIP for replay (CSV-4)", () => {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])

  test("sends a .zip file however the computer labels it as application/zip with the same bytes and name", async () => {
    for (const reported of ["application/zip", "application/x-zip-compressed", "application/x-zip", "application/octet-stream", ""]) {
      for (const name of ["neuvetra-m59-pack.zip", "NEUVETRA-M59-PACK.ZIP", "neuvetra-m59-pack (1).zip"]) {
        const zip = evidencePackZip(new File([bytes], name, { type: reported }))
        expect(zip?.type).toBe("application/zip")
        expect(zip?.name).toBe(name)
        expect(new Uint8Array(await zip!.arrayBuffer())).toEqual(bytes)
      }
    }
  })

  test("keeps a file reported as application/zip as it is", () => {
    const file = new File([bytes], "download", { type: "application/zip" })
    expect(evidencePackZip(file)).toBe(file)
  })

  test("refuses files that are not a ZIP by name or by type", () => {
    for (const [name, reported] of [["neuvetra-m59-pack.pdf", ""], ["neuvetra-m59-pack", "application/octet-stream"], ["neuvetra-m59-pack.zip.csv", "application/x-zip-compressed"], ["neuvetra-m59-pack.zip", "text/plain"], ["neuvetra-m59-pack.zip", "application/pdf"], ["neuvetra-m59-pack.zip ", ""]] as const)
      expect(evidencePackZip(new File([bytes], name, { type: reported }))).toBeNull()
  })
})
