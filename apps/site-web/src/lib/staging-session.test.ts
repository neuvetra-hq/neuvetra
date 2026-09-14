import { describe, expect, test } from "bun:test"
import { decodeStagingAccess, decodeStagingConfig, STAGING_PROFILE } from "./staging-session"
import { downloadDraftInventoryReport, downloadEvidencePack, revisitSyntheticWorkspace, type HostedWorkspaceActor, type DraftInventoryReportMetadata, type EvidencePackMetadata } from "./workspace-api"

const id = "12345678-1234-4123-8123-123456789012"
const other = "22345678-1234-4123-8123-123456789012"
const project = "abcdefghijklmnopqrst"
const config = { profile: STAGING_PROFILE, supabaseUrl: `https://${project}.supabase.co`, anonKey: "sb_publishable_abcdefghijklmnopqrst12345" }

describe("private staging config and identity boundary", () => {
  test("accepts only a Supabase project and a public browser key", () => {
    expect(decodeStagingConfig(config).projectRef).toBe(project)
    for (const url of ["http://abcdefghijklmnopqrst.supabase.co", "https://abcdefghijklmnopqrst.supabase.co.evil.invalid", `https://${project}.supabase.co/path`, `https://${project}.supabase.co#credentials`]) expect(() => decodeStagingConfig({ ...config, supabaseUrl: url })).toThrow()
    for (const key of ["sb_secret_abcdefghijklmnopqrst", "", "not-a-key", `x.${btoa(JSON.stringify({ role: "service_role", ref: project }))}.x`]) expect(() => decodeStagingConfig({ ...config, anonKey: key })).toThrow()
    expect(() => decodeStagingConfig({ ...config, anonKey: `x.${btoa(JSON.stringify({ role: "anon", ref: "wrongproject" }))}.x` })).toThrow()
  })
  test("binds roster metadata to the actual authenticated user", () => {
    const access = { profile: STAGING_PROFILE, user: { id }, access: { role: "member", workspaceId: other, evidenceId: null } }
    expect(decodeStagingAccess(access, id).access.role).toBe("member")
    expect(() => decodeStagingAccess(access, other)).toThrow()
    expect(() => decodeStagingAccess({ ...access, access: { ...access.access, role: "superadmin" } }, id)).toThrow()
    expect(() => decodeStagingAccess({ ...access, access: { role: "owner", workspaceId: null, evidenceId: other } }, id)).toThrow()
    expect(() => decodeStagingAccess({ ...access, profile: "synthetic-demo" }, id)).toThrow()
  })
  test("real actor sends its own token, never the local owner token", async () => {
    const actor: HostedWorkspaceActor = { userId: id, role: "owner", accessToken: "synthetic-test-real-session-shape" }
    let authorization: string | null = null
    await expect(revisitSyntheticWorkspace(other, actor, (async (_input, init) => {
      authorization = new Headers(init?.headers).get("authorization")
      return new Response(JSON.stringify({ error: "Workspace not found." }), { status: 404 })
    }) as typeof fetch)).rejects.toThrow()
    expect(authorization).toBe(`Bearer ${actor.accessToken}`)
  })
  test("revoked access invalidates the signed-in view and cancelled identity refuses a request", async () => {
    const original = globalThis.fetch
    let invalidated = 0
    let requests = 0
    const controller = new AbortController()
    const actor: HostedWorkspaceActor = { userId: id, role: "member", accessToken: "test-session", signal: controller.signal, onUnauthorized: () => { invalidated += 1 } }
    globalThis.fetch = (async () => { requests += 1; return new Response(JSON.stringify({ error: "Unavailable." }), { status: 403 }) }) as typeof fetch
    try {
      await expect(revisitSyntheticWorkspace(other, actor)).rejects.toThrow()
      expect(invalidated).toBe(1)
      controller.abort()
      await expect(revisitSyntheticWorkspace(other, actor)).rejects.toThrow()
      expect(requests).toBe(1)
    } finally { globalThis.fetch = original }
  })
  test("late response from the old identity is discarded", async () => {
    const original = globalThis.fetch
    const controller = new AbortController()
    globalThis.fetch = (async () => { controller.abort(); return new Response("{}") }) as typeof fetch
    try { await expect(revisitSyntheticWorkspace(other, { userId: id, role: "member", accessToken: "test-session", signal: controller.signal })).rejects.toThrow() }
    finally { globalThis.fetch = original }
  })
  test("downloads cancelled after headers do not return another identity's file", async () => {
    const bytes = new TextEncoder().encode("synthetic download").buffer
    const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    for (const kind of ["report", "archive"] as const) {
      const controller = new AbortController()
      const actor: HostedWorkspaceActor = { userId: id, role: "member", accessToken: "test-session", signal: controller.signal }
      const fetcher = (async () => {
        const response = new Response(bytes, { headers: { [`x-neuvetra-${kind}-sha256`]: hash } })
        response.arrayBuffer = async () => { controller.abort(); return bytes }
        return response
      }) as typeof fetch
      const metadata = { id, companyId: id, inventoryId: other, reportByteLength: bytes.byteLength, reportSha256: hash, archiveByteLength: bytes.byteLength, archiveSha256: hash }
      let rejected = false
      try {
        if (kind === "report") await downloadDraftInventoryReport(metadata as DraftInventoryReportMetadata, actor, fetcher)
        else await downloadEvidencePack(metadata as EvidencePackMetadata, actor, fetcher)
      } catch { rejected = true }
      expect(rejected).toBe(true)
    }
  })
})
