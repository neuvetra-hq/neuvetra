import { afterEach, expect, test } from "bun:test"
import { loadScope3Results, Scope3ResultsApiError } from "./scope3-results-api"

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const fixture = await Bun.file(new URL("./scope3-results.fixture.json", import.meta.url)).json()
const actor = { userId: "synthetic", accessToken: "local-test-only" }

test("a deferred Scope 3 decoder still validates every successful response before returning it", async () => {
  globalThis.fetch = (async () => Response.json(fixture)) as typeof fetch
  expect(await loadScope3Results(fixture.companyId, actor)).toEqual(fixture)
  const malformed = structuredClone(fixture)
  malformed.records[0].outcome = "invented"
  globalThis.fetch = (async () => Response.json(malformed)) as typeof fetch
  await expect(loadScope3Results(fixture.companyId, actor)).rejects.toThrow("not recognized")
})

test("a failed Scope 3 request retains its status and useful error instead of attempting to decode a report", async () => {
  globalThis.fetch = (async () => Response.json({ error: "Reload the changed setup.", code: "setup_changed" }, { status: 409 })) as typeof fetch
  try { await loadScope3Results(fixture.companyId, actor); throw new Error("unexpected success") }
  catch (error) {
    expect(error).toBeInstanceOf(Scope3ResultsApiError)
    expect(error).toMatchObject({ message: "Reload the changed setup.", status: 409, code: "setup_changed" })
  }
})
