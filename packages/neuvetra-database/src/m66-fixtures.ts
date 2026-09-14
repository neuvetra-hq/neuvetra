/** Approved fictional source identities; no inference from arbitrary PDFs. */
export const M66_SOURCE_FIXTURES = [
  {
    "fixtureId": "m55-fictional-bill-a",
    "originalName": "neuvetra-m55-synthetic-electricity-bill.pdf",
    "byteLength": 4605,
    "sha256": "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135",
    "printedQuantityKwh": "12345.000"
  },
  {
    "fixtureId": "m66-fictional-bill-b",
    "originalName": "neuvetra-m66-synthetic-electricity-bill-b.pdf",
    "byteLength": 2480,
    "sha256": "83e000a95f9e2f95473dc2cba18be0fc36810b24b9288f59b5aceb3a5ec0430f",
    "printedQuantityKwh": "12345.000"
  }
] as const
