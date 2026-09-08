import { describe, expect, test } from "bun:test"
import { isResearchAnswer, publisherUrl } from "./research-api"

const unavailable = {
  status: "unavailable", message: "Research answering is unavailable.", claims: [], evidence: [], sources: [],
  release: null, provider: { mode: "disabled", model: null }, missing_context: [],
}
const supported = {
  status: "supported", message: "Reviewed explanation.",
  claims: [{ id: "P01", text: "Reviewed statement", qualifications: [], evidence_ids: ["E01"] }],
  evidence: [{ id: "E01", source_id: "epa", locator: "Page 1", excerpt: "Source words" }],
  sources: [{ id: "epa", title: "EPA guidance", version: "2023", status: "published_guidance", canonical_url: "https://www.epa.gov/example.pdf" }],
  release: { id: "pilot", version: "1" }, provider: { mode: "live", model: "model" }, missing_context: [],
}

describe("research response boundary", () => {
  test("accepts the honest disabled response", () => expect(isResearchAnswer(unavailable)).toBe(true))
  test("rejects a model draft without the server answer contract", () => expect(isResearchAnswer({ decision: "answer", claims: [{ text: "Draft" }] })).toBe(false))
  test("rejects a prototype-key status", () => expect(isResearchAnswer({ ...unavailable, status: "toString" })).toBe(false))
  test("accepts a complete linked answer", () => expect(isResearchAnswer(supported)).toBe(true))
  test("rejects factual claims in a withheld response or with a disabled provider", () => {
    expect(isResearchAnswer({ ...supported, status: "needs_review" })).toBe(false)
    expect(isResearchAnswer({ ...supported, provider: unavailable.provider })).toBe(false)
    expect(isResearchAnswer({ ...supported, release: null })).toBe(false)
  })
  test("rejects unresolved references, extra evidence and repeated claim IDs", () => {
    expect(isResearchAnswer({ ...supported, evidence: [] })).toBe(false)
    expect(isResearchAnswer({ ...supported, sources: [] })).toBe(false)
    expect(isResearchAnswer({ ...supported, evidence: [...supported.evidence, { ...supported.evidence[0], id: "E02" }] })).toBe(false)
    expect(isResearchAnswer({ ...supported, claims: [...supported.claims, ...supported.claims] })).toBe(false)
  })
  test("requires qualifications and input requests to match the response state", () => {
    expect(isResearchAnswer({ ...supported, status: "qualified" })).toBe(false)
    expect(isResearchAnswer({ ...supported, missing_context: ["location"] })).toBe(false)
    expect(isResearchAnswer({ ...unavailable, status: "needs_input", missing_context: ["reporting_period"] })).toBe(true)
    expect(isResearchAnswer({ ...unavailable, status: "needs_input", missing_context: ["provider_api_key"] })).toBe(false)
  })
  test("rejects missing or malformed evidence structure", () => {
    expect(isResearchAnswer({ ...unavailable, evidence: [{ id: "E01", excerpt: "Text" }] })).toBe(false)
    expect(isResearchAnswer({ ...unavailable, claims: [{ id: "P01", text: "Text", qualifications: null, evidence_ids: [] }] })).toBe(false)
  })
  test("rejects executable, insecure and credential-bearing citation links", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,hello", "http://example.com", "https://user:secret@example.com", "//example.com", "https://unapproved.example", "https://www.epa.gov.unapproved.example", "https://www.epa.gov:444"]) expect(publisherUrl(url)).toBeNull()
  })
  test("keeps a valid publisher page locator", () => expect(publisherUrl("https://www.epa.gov/example.pdf#page=4")).toBe("https://www.epa.gov/example.pdf#page=4"))
})
