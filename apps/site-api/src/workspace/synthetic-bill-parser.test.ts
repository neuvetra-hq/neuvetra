import { describe, expect, test } from "bun:test"
import { parseSyntheticBill, SYNTHETIC_BILL_NAME } from "./synthetic-bill-parser"

const fixture = new URL("../../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf", import.meta.url)
const manifestFile = new URL("../../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.manifest.json", import.meta.url)

describe("M55 isolated fixed PDF parser", () => {
  test("extracts the exact synthetic statement fields", async () => {
    const bytes = new Uint8Array(await Bun.file(fixture).arrayBuffer())
    expect(await parseSyntheticBill(SYNTHETIC_BILL_NAME, "application/pdf", bytes)).toEqual({
      supplierName: "Synthetic Golden State Electric",
      accountLabel: "SYNTHETIC-0001",
      billNumber: "SYN-CA-2023-01",
      servicePeriodStart: "2023-01-01",
      servicePeriodEnd: "2023-01-31",
      electricityKwh: "12345.000",
      parserVersion: "m55-fixed-pdf-v1",
      sourceLocators: {
        servicePeriod: { startByte: 3119, endByte: 3147 },
        electricityKwh: { startByte: 3384, endByte: 3394 },
      },
    })
  })

  test("binds the checked-in manifest to the exact fixture", async () => {
    const bytes = new Uint8Array(await Bun.file(fixture).arrayBuffer())
    const manifest = await Bun.file(manifestFile).json() as { filename: string; mediaType: string; byteLength: number; sha256: string; parserVersion: string; customerData: boolean; fictional: boolean }
    expect(manifest).toMatchObject({ filename: SYNTHETIC_BILL_NAME, mediaType: "application/pdf", byteLength: bytes.byteLength, parserVersion: "m55-fixed-pdf-v1", customerData: false, fictional: true })
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(manifest.sha256)
  })

  test("rejects changed bytes, wrong type, wrong name and missing data", async () => {
    const original = new Uint8Array(await Bun.file(fixture).arrayBuffer())
    const changed = original.slice()
    changed[100] ^= 1
    await expect(parseSyntheticBill(SYNTHETIC_BILL_NAME, "application/pdf", changed)).rejects.toThrow("not the fixed")
    await expect(parseSyntheticBill("other.pdf", "application/pdf", original)).rejects.toThrow("not the fixed")
    await expect(parseSyntheticBill(SYNTHETIC_BILL_NAME, "text/plain", original)).rejects.toThrow("not the fixed")
    await expect(parseSyntheticBill(SYNTHETIC_BILL_NAME, "application/pdf", original.slice(0, -1))).rejects.toThrow("not the fixed")
  })
})
