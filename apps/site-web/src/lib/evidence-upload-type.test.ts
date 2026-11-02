import { describe, expect, test } from "bun:test"
import { evidenceUploadType } from "./evidence-upload-type"

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

describe("evidence upload type", () => {
  test("declares text/csv for a .csv file reported with a known alias or no type (Windows with Excel reports application/vnd.ms-excel)", () => {
    for (const reported of ["", "application/vnd.ms-excel", "application/octet-stream", "text/plain", "application/csv", "text/x-csv", "text/comma-separated-values", "application/x-csv"])
      expect(evidenceUploadType("fuel-log.csv", reported)).toBe("text/csv")
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
