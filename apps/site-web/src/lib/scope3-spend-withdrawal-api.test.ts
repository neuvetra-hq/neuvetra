import { afterEach, expect, test } from "bun:test"
import { withdrawScope3SpendImport } from "./scope3-spend-import-api"

const original = globalThis.fetch
afterEach(() => { globalThis.fetch = original })
const company = "93920000-0000-4000-8000-000000000001", imported = "93920000-0000-4000-8000-0000000000a1"
const actor = { userId: "93920000-0000-4000-8000-0000000000ff", accessToken: "synthetic-test-session" }
const receipt = { profile: "neuvetra.scope3-spend-imports.v1", importId: imported, withdrawn: 2, alreadyWithdrawn: 1, message: "2 lines withdrawn; 1 already withdrawn." }

test("withdrawal sends the exact import/reason and checks its receipt binding", async () => {
  const calls: Array<{ url: string; method?: string; body: unknown }> = []
  globalThis.fetch = (async (url, init) => { calls.push({ url: String(url), method: init?.method, body: JSON.parse(String(init?.body)) }); return Response.json(receipt) }) as typeof fetch
  expect(await withdrawScope3SpendImport(company, imported, " Wrong month. ", actor)).toEqual({ importId: imported, withdrawn: 2, alreadyWithdrawn: 1, message: receipt.message })
  expect(calls).toEqual([{ url: `/workspace-api/workspace/${company}/scope3/spend-imports/${imported}/withdrawal`, method: "POST", body: { reason: "Wrong month." } }])
  for (const bad of [{ ...receipt, importId: company }, { ...receipt, withdrawn: -1 }, { ...receipt, alreadyWithdrawn: 1.5 }]) {
    globalThis.fetch = (async () => Response.json(bad)) as typeof fetch
    await expect(withdrawScope3SpendImport(company, imported, "Wrong month.", actor)).rejects.toThrow()
  }
})

test("invalid reasons never write; the server's refusal remains actionable", async () => {
  let calls = 0
  globalThis.fetch = (async () => { calls++; return Response.json({ error: "Reload this import before withdrawing it.", code: "changed" }, { status: 409 }) }) as typeof fetch
  for (const reason of ["", "no", "x".repeat(2001), "bad\u0000reason"]) await expect(withdrawScope3SpendImport(company, imported, reason, actor)).rejects.toThrow()
  expect(calls).toBe(0)
  await expect(withdrawScope3SpendImport(company, imported, "Wrong month.", actor)).rejects.toThrow("Reload this import before withdrawing it.")
  expect(calls).toBe(1)
})

test("a multiline withdrawal explanation remains valid under the server contract", async () => {
  let body: unknown
  globalThis.fetch = (async (_url, init) => { body = JSON.parse(String(init?.body)); return Response.json(receipt) }) as typeof fetch
  await withdrawScope3SpendImport(company, imported, "Wrong period.\nReplace with the corrected file.", actor)
  expect(body).toEqual({ reason: "Wrong period.\nReplace with the corrected file." })
})
