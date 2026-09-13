export const SYNTHETIC_BILL_SHA256 = "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135"
export const SYNTHETIC_BILL_NAME = "neuvetra-m55-synthetic-electricity-bill.pdf"
export const SYNTHETIC_BILL_SIZE = 4605

export interface SyntheticBillExtraction {
  supplierName: "Synthetic Golden State Electric"
  accountLabel: "SYNTHETIC-0001"
  billNumber: "SYN-CA-2023-01"
  servicePeriodStart: "2023-01-01"
  servicePeriodEnd: "2023-01-31"
  electricityKwh: "12345.000"
  parserVersion: "m55-fixed-pdf-v1"
  sourceLocators: {
    servicePeriod: { startByte: number; endByte: number }
    electricityKwh: { startByte: number; endByte: number }
  }
}

const REQUIRED_PDF_TEXT = new Map([
  ["SYNTHETIC GOLDEN STATE ELECTRIC", 1],
  ["SYNTHETIC DEVELOPMENT FIXTURE - NOT A REAL UTILITY BILL", 1],
  ["Synthetic California office", 1],
  ["SYNTHETIC-0001", 1],
  ["SYN-CA-2023-01", 1],
  ["January 1 - January 31, 2023", 1],
  ["12,345 kWh", 2],
] as const)

export async function parseSyntheticBill(name: string, mediaType: string, bytes: Uint8Array): Promise<SyntheticBillExtraction> {
  if (name !== SYNTHETIC_BILL_NAME || mediaType !== "application/pdf" || bytes.byteLength !== SYNTHETIC_BILL_SIZE) {
    throw new Error("The supplied file is not the fixed M55 synthetic bill.")
  }
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  if (hash !== SYNTHETIC_BILL_SHA256) throw new Error("The supplied file is not the fixed M55 synthetic bill.")
  const source = new TextDecoder("latin1").decode(bytes)
  for (const [expected, count] of REQUIRED_PDF_TEXT) {
    if (source.split(expected).length - 1 !== count) throw new Error("The synthetic bill text contract is incomplete or ambiguous.")
  }
  const periodText = "January 1 - January 31, 2023"
  const electricityText = "12,345 kWh"
  return {
    supplierName: "Synthetic Golden State Electric",
    accountLabel: "SYNTHETIC-0001",
    billNumber: "SYN-CA-2023-01",
    servicePeriodStart: "2023-01-01",
    servicePeriodEnd: "2023-01-31",
    electricityKwh: "12345.000",
    parserVersion: "m55-fixed-pdf-v1",
    sourceLocators: {
      servicePeriod: { startByte: source.indexOf(periodText), endByte: source.indexOf(periodText) + periodText.length },
      electricityKwh: { startByte: source.indexOf(electricityText), endByte: source.indexOf(electricityText) + electricityText.length },
    },
  }
}
