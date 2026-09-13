import { describe, expect, test } from "bun:test"
import type { AuthenticatedUser } from "../lib/auth"
import { createWorkspaceRoutes } from "./routes"
import type { CompanyWorkspace, SyntheticBill, WorkspaceStore } from "./types"

const ORIGIN = "http://127.0.0.1:5174"
const OWNER = "11111111-1111-4111-8111-111111111111"
const OUTSIDER = "22222222-2222-4222-8222-222222222222"
const WORKSPACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const fixture: CompanyWorkspace = {
  id: WORKSPACE_ID,
  companyName: "Synthetic Acme, Inc.",
  countryCode: "US",
  stateCode: "CA",
  facility: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Synthetic California office",
    egridSubregion: "CAMX",
  },
  boundary: {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    reportingYear: 2023,
    approach: "operational_control",
    status: "draft",
    version: 1,
  },
}
const billFixture: SyntheticBill = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", companyId: WORKSPACE_ID,
  originalName: "neuvetra-m55-synthetic-electricity-bill.pdf", mediaType: "application/pdf", byteLength: 4605,
  sha256: "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135", parserVersion: "m55-fixed-pdf-v1",
  supplierName: "Synthetic Golden State Electric", accountLabel: "SYNTHETIC-0001", billNumber: "SYN-CA-2023-01",
  servicePeriodStart: "2023-01-01", servicePeriodEnd: "2023-01-31",
  sourceLocators: { servicePeriod: { startByte: 3119, endByte: 3147 }, electricityKwh: { startByte: 3384, endByte: 3394 } },
  state: "needs_review", versions: [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", version: 1, facilityId: null, electricityKwh: "12345.000", correctionReason: null }], draftActivity: null,
}

function setup() {
  const owners = new Map<string, string>()
  const store: WorkspaceStore = {
    async create(userId) {
      owners.set(fixture.id, userId)
      return fixture
    },
    async findById(userId, workspaceId) {
      return owners.get(workspaceId) === userId ? fixture : null
    },
    async canManage(userId, workspaceId) { return owners.get(workspaceId) === userId },
    async ingestBill() { throw new Error("not configured") },
    async correctBill() { throw new Error("not configured") },
    async linkBill() { throw new Error("not configured") },
    async findBill() { return null },
  }
  const users: Record<string, AuthenticatedUser> = {
    owner: { id: OWNER, phone: null, email: null, fullName: null },
    outsider: { id: OUTSIDER, phone: null, email: null, fullName: null },
  }
  return createWorkspaceRoutes({
    allowedOrigins: [ORIGIN],
    validateUser: async (token) => users[token] ?? null,
    store,
  })
}

const body = {
  companyName: "Synthetic Acme, Inc.",
  facilityName: "Synthetic California office",
  countryCode: "US",
  stateCode: "CA",
  egridSubregion: "CAMX",
  reportingYear: 2023,
  approach: "operational_control",
}

function request(path: string, token?: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set("origin", ORIGIN)
  if (token) headers.set("authorization", `Bearer ${token}`)
  return new Request(`http://localhost${path}`, { ...init, headers })
}

describe("M54 authenticated workspace route", () => {
  test("creates from the authenticated identity without accepting an owner override", async () => {
    const app = setup()
    const response = await app.handle(request("/workspace", "owner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(fixture)

    const injected = await app.handle(request("/workspace", "owner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, userId: OUTSIDER }),
    }))
    expect(injected.status).toBe(422)
    const foreign = await app.handle(request(`/workspace/${WORKSPACE_ID}`, "outsider"))
    expect(foreign.status).toBe(404)
  })

  test("requires a valid bearer identity", async () => {
    const app = setup()
    for (const token of [undefined, "invalid"]) {
      const response = await app.handle(request("/workspace", token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }))
      expect(response.status).toBe(401)
    }
  })

  test("returns a bounded error when workspace creation fails", async () => {
    const app = createWorkspaceRoutes({
      allowedOrigins: [ORIGIN],
      validateUser: async () => ({ id: OWNER, phone: null, email: null, fullName: null }),
      store: {
        create: async () => { throw new Error("private database detail") },
        findById: async () => null,
        canManage: async () => false,
        ingestBill: async () => { throw new Error("not configured") },
        correctBill: async () => { throw new Error("not configured") },
        linkBill: async () => { throw new Error("not configured") },
        findBill: async () => null,
      },
    })
    const response = await app.handle(request("/workspace", "owner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }))
    expect(response.status).toBe(409)
    expect(await response.text()).not.toContain("private database detail")
  })

  test("returns the same absence response for unknown and foreign workspaces", async () => {
    const app = setup()
    await app.handle(request("/workspace", "owner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }))
    const foreign = await app.handle(request(`/workspace/${WORKSPACE_ID}`, "outsider"))
    const unknown = await app.handle(request("/workspace/ffffffff-ffff-4fff-8fff-ffffffffffff", "outsider"))
    expect(foreign.status).toBe(404)
    expect(await foreign.json()).toEqual(await unknown.json())
  })

  test("returns a bounded error when workspace lookup fails", async () => {
    const app = createWorkspaceRoutes({
      allowedOrigins: [ORIGIN],
      validateUser: async () => ({ id: OWNER, phone: null, email: null, fullName: null }),
      store: {
        create: async () => fixture,
        findById: async () => { throw new Error("private database detail") },
        canManage: async () => false,
        ingestBill: async () => { throw new Error("not configured") },
        correctBill: async () => { throw new Error("not configured") },
        linkBill: async () => { throw new Error("not configured") },
        findBill: async () => null,
      },
    })
    const response = await app.handle(request(`/workspace/${WORKSPACE_ID}`, "owner"))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain("private database detail")
  })

  test("allows an authenticated same-origin browser read when Origin is omitted", async () => {
    const app = setup()
    await app.handle(request("/workspace", "owner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }))
    const response = await app.handle(new Request(`http://localhost/workspace/${WORKSPACE_ID}`, {
      headers: { authorization: "Bearer owner" },
    }))
    expect(response.status).toBe(200)
  })

  test("rejects an untrusted browser origin before auth or store access", async () => {
    const app = setup()
    const response = await app.handle(new Request(`http://localhost/workspace/${WORKSPACE_ID}`, {
      headers: { origin: "https://example.invalid", authorization: "Bearer owner" },
    }))
    expect(response.status).toBe(403)
  })

  test("bounds role-lookup failures on correction and link routes", async () => {
    const app = createWorkspaceRoutes({
      allowedOrigins: [ORIGIN],
      validateUser: async () => ({ id: OWNER, phone: null, email: null, fullName: null }),
      store: {
        create: async () => fixture,
        findById: async () => fixture,
        canManage: async () => { throw new Error("private database detail") },
        ingestBill: async () => billFixture,
        correctBill: async () => billFixture,
        linkBill: async () => billFixture,
        findBill: async () => billFixture,
      },
    })
    for (const [path, body] of [
      [`/workspace/${WORKSPACE_ID}/bills/${billFixture.id}/corrections`, { facilityId: fixture.facility.id, priorVersionId: billFixture.versions[0].id, electricityKwh: "12346.000", reason: "Synthetic review exercise" }],
      [`/workspace/${WORKSPACE_ID}/bills/${billFixture.id}/link`, { boundaryId: fixture.boundary.id, billVersionId: billFixture.versions[0].id }],
    ] as const) {
      const response = await app.handle(request(path, "owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))
      expect(response.status).toBe(503)
      expect(await response.text()).not.toContain("private database detail")
    }
  })
})
