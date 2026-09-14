import { describe, expect, test } from "bun:test"
import { M58_FACTOR, M58_FIXTURE_BYTES, M58_FIXTURE_SHA256, M58_REPORTED, M58_TOTALS, displayKg, multiplyMwh } from "./m58"

function addDecimal(values: string[], places: number) {
  const total=values.reduce((sum,value)=>{const [whole,fraction=""]=value.split(".");return sum+BigInt(`${whole}${fraction.padEnd(places,"0")}`)},0n)
  const raw=total.toString().padStart(places+1,"0");return `${raw.slice(0,-places)}.${raw.slice(-places)}`
}

describe("M58 exact annual register arithmetic",()=>{
  test("pins the fixed fictional source bytes",async()=>{
    const bytes=new Uint8Array(await Bun.file(new URL("../../../data/synthetic/m58-electricity-register-2023.json",import.meta.url)).arrayBuffer())
    expect(bytes.byteLength).toBe(M58_FIXTURE_BYTES)
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(M58_FIXTURE_SHA256)
    expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchObject({fixtureId:"m58-fixed-electricity-register-2023-v1",november:{quantityMwh:"12.493000",basisMonths:["2023-09","2023-10"]},closureMemo:{reason:"outside_operational_control_after_lease_end",controlEnded:"2023-11-30"}})
  })
  test("uses exact integers and rounds only for display",()=>{
    expect(M58_FACTOR).toBe("195.0402888")
    expect(addDecimal(M58_REPORTED.map(([,quantity])=>quantity),6)).toBe(M58_TOTALS.reportedMwh)
    expect(addDecimal(M58_REPORTED.map(([,quantity])=>multiplyMwh(quantity)),10)).toBe(M58_TOTALS.reportedKgCo2e)
    expect(multiplyMwh("12.493000")).toBe(M58_TOTALS.estimatedKgCo2e)
    expect(addDecimal([M58_TOTALS.reportedMwh,M58_TOTALS.estimatedMwh],6)).toBe(M58_TOTALS.includedMwh)
    expect(addDecimal([M58_TOTALS.reportedKgCo2e,M58_TOTALS.estimatedKgCo2e],10)).toBe(M58_TOTALS.includedKgCo2e)
    expect(displayKg(M58_TOTALS.includedKgCo2e)).toBe(M58_TOTALS.includedDisplayKgCo2e)
  })
})
