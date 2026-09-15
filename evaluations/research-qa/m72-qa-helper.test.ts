import { expect, test } from "bun:test"
import { canonical, parseM72Input, runM72Journey } from "../../tools/staging/check-m72-hosted"

const HOST = "https://www.neuvetra.ai", AUTH = "https://icockcoguyadhryzydvl.supabase.co"
const raw = () => ({ mode: "baseline", env: { SUPABASE_URL: AUTH, SUPABASE_ANON_KEY: "sb_publishable_" + "A".repeat(30) }, roster: { workspaceId: "72000000-0000-4000-8000-000000000010" }, accounts: ["manager1", "manager2", "member", "outsider"].map((role, i) => ({ role, id: `72000000-0000-4000-8000-00000000000${i + 1}`, email: `fictional-${i}@example.invalid`, password: "offline-placeholder" })) })
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
const history = (input: ReturnType<typeof parseM72Input>) => ({ schemaVersion: 1 as const, host: HOST as "https://www.neuvetra.ai", workspaceId: input.roster.workspaceId, attempts: [] })

test("input accepts only existing auth boundary, complete distinct roster and explicit mode", () => {
  expect(parseM72Input(raw()).mode).toBe("baseline")
  for (const mutate of [(v: any) => { v.mode = "write" }, (v: any) => { delete v.mode }, (v: any) => { v.env.SUPABASE_URL = "https://other.invalid" }, (v: any) => { v.accounts.pop() }, (v: any) => { v.accounts[1].id = v.accounts[0].id }]) {
    const value = raw(); mutate(value); expect(() => parseM72Input(value)).toThrow()
  }
})
test("canonical snapshots disregard object key order but preserve array order and values", () => {
  expect(canonical({ z: [1, 2], a: 3 })).toBe(canonical({ a: 3, z: [1, 2] }))
  expect(canonical({ z: [1, 2] })).not.toBe(canonical({ z: [2, 1] }))
})
test("exercise without baseline and revisit without passed exercise refuse before any network", async () => {
  for (const mode of ["exercise", "revisit"] as const) {
    const input = parseM72Input({ ...raw(), mode }); let calls = 0; let saved: any
    const prior = history(input)
    if (mode === "revisit") Object.assign(prior, { baseline: { records: {}, downloads: {} } })
    const result = await runM72Journey(input, { load: async () => prior, save: async v => { saved = v }, fetch: (async () => { calls++; throw new Error("must not call") }) as any })
    expect(result.status).toBe("failed"); expect(result.stage).toBe("mode_preconditions"); expect(calls).toBe(0); expect(saved.attempts).toHaveLength(1)
  }
})
test("baseline cannot overwrite earlier accepted evidence", async () => {
  const input = parseM72Input(raw()), baseline = { records: { sentinel: "saved" }, downloads: {} }; let saved: any, calls = 0
  const result = await runM72Journey(input, { load: async () => ({ ...history(input), baseline }), save: async v => { saved = v }, fetch: (async () => { calls++; throw new Error("must not call") }) as any })
  expect(result.status).toBe("failed"); expect(calls).toBe(0); expect(saved.baseline).toEqual(baseline)
})
test("unreadable or wrongly bound receipt is never overwritten", async () => {
  const input = parseM72Input(raw()); let saves = 0, calls = 0
  for (const load of [async () => { throw new Error("unreadable prior") }, async () => ({ ...history(input), workspaceId: "72000000-0000-4000-8000-000000000099" })]) {
    const result = await runM72Journey(input, { load, save: async () => { saves++ }, fetch: (async () => { calls++; throw new Error("must not call") }) as any })
    expect(result.stage).toBe("receipt_load"); expect(result.status).toBe("failed")
  }
  expect(saves).toBe(0); expect(calls).toBe(0)
})
test("wrong authenticated subject closes acquired session and excludes secrets from receipts", async () => {
  const input = parseM72Input(raw()); let saved: any; const calls: string[] = []; const secret = "SECRET_ACCESS_TOKEN_OFFLINE"
  const mock = async (url: string | URL | Request) => {
    const route = String(url); calls.push(route)
    if (route.endsWith("/ready")) return response({ status: "ready", profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: 14, legacyContainmentVerified: true })
    if (route.endsWith("/config")) return response({ profile: "neuvetra.private-synthetic-staging.v1", supabaseUrl: AUTH, anonKey: input.env.SUPABASE_ANON_KEY })
    if (route.includes("/token?")) return response({ access_token: secret, user: { id: input.accounts[1].id } })
    if (route.includes("/logout?")) return new Response(null, { status: 204 })
    throw new Error("unexpected call")
  }
  const result = await runM72Journey(input, { load: async () => null, save: async v => { saved = v }, fetch: mock as any })
  expect(result.status).toBe("failed"); expect(result.stage).toBe("sign_in_manager1"); expect(result.allCreatedAuthSessionsClosed).toBe(true)
  expect(calls.at(-1)).toContain("logout?scope=local"); expect(calls).toHaveLength(4)
  const receipt = JSON.stringify(saved); for (const value of [secret, input.accounts[0].password, input.accounts[0].email, input.env.SUPABASE_ANON_KEY]) expect(receipt).not.toContain(value)
})
test("readiness failure and receipt failure expose only bounded diagnostics", async () => {
  const input = parseM72Input(raw())
  const result = await runM72Journey(input, { load: async () => null, save: async () => { throw new Error("secret filesystem detail") }, fetch: (async () => { throw new Error("secret network detail") }) as any })
  expect(result).toEqual({ status: "failed", mode: "baseline", stage: "receipt_save", applicationPostRequests: 0, allCreatedAuthSessionsClosed: true })
})
