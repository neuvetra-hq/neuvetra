import { Elysia, t } from "elysia"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"
import { checkOrigin } from "../lib/origin-check"
import type { WorkspaceStore } from "./types"
import { parseSyntheticBill, SYNTHETIC_BILL_NAME, SYNTHETIC_BILL_SHA256, SYNTHETIC_BILL_SIZE } from "./synthetic-bill-parser"

const AUTH_REQUIRED = { error: "Authentication required." } as const
const NOT_FOUND = { error: "Workspace not found." } as const
const FORBIDDEN = { error: "Forbidden." } as const
const INVALID_REQUEST = { error: "Invalid workspace request." } as const
const CREATE_FAILED = { error: "Workspace could not be created." } as const
const READ_FAILED = { error: "Workspace is unavailable." } as const
const EVIDENCE_NOT_FOUND = { error: "Evidence not found." } as const
const FILE_REJECTED = { error: "This file cannot be processed in this demo." } as const
const REVIEW_CONFLICT = { error: "This record changed; review the latest version." } as const
const NO_RESULT = { error: "No result produced." } as const
const REPLAY_FAILED = { error: "Replay could not be verified." } as const
const CALCULATION_CONFLICT = { error: "Calculation request conflicts." } as const
const INPUT_KEYS = ["companyName", "facilityName", "countryCode", "stateCode", "egridSubregion", "reportingYear", "approach"] as const

interface WorkspaceRoutesDeps {
  allowedOrigins: readonly string[]
  validateUser: (token: string) => Promise<AuthenticatedUser | null>
  store: WorkspaceStore
}

async function authenticate(request: Request, validateUser: WorkspaceRoutesDeps["validateUser"]) {
  const token = extractBearerToken(request.headers)
  if (!token) return null
  return validateUser(token)
}

function parseInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (Object.keys(body).sort().join("|") !== [...INPUT_KEYS].sort().join("|")) return null
  if (body.companyName !== "Synthetic Acme, Inc." || body.facilityName !== "Synthetic California office" || body.countryCode !== "US" || body.stateCode !== "CA" || body.egridSubregion !== "CAMX" || body.reportingYear !== 2023 || body.approach !== "operational_control") return null
  return body as unknown as {
    companyName: "Synthetic Acme, Inc."
    facilityName: "Synthetic California office"
    countryCode: "US"
    stateCode: "CA"
    egridSubregion: "CAMX"
    reportingYear: 2023
    approach: "operational_control"
  }
}

const responseSchema = t.Object({
  id: t.String(),
  companyName: t.String(),
  countryCode: t.Literal("US"),
  stateCode: t.Literal("CA"),
  facility: t.Object({
    id: t.String(),
    name: t.String(),
    egridSubregion: t.Literal("CAMX"),
  }),
  boundary: t.Object({
    id: t.String(),
    reportingYear: t.Literal(2023),
    approach: t.Literal("operational_control"),
    status: t.Literal("draft"),
    version: t.Literal(1),
  }),
})

const billResponseSchema = t.Object({
  id: t.String({ format: "uuid" }),
  companyId: t.String({ format: "uuid" }),
  originalName: t.Literal(SYNTHETIC_BILL_NAME),
  mediaType: t.Literal("application/pdf"),
  byteLength: t.Literal(SYNTHETIC_BILL_SIZE),
  sha256: t.Literal(SYNTHETIC_BILL_SHA256),
  parserVersion: t.Literal("m55-fixed-pdf-v1"),
  supplierName: t.Literal("Synthetic Golden State Electric"),
  accountLabel: t.Literal("SYNTHETIC-0001"),
  billNumber: t.Literal("SYN-CA-2023-01"),
  servicePeriodStart: t.Literal("2023-01-01"),
  servicePeriodEnd: t.Literal("2023-01-31"),
  sourceLocators: t.Object({
    servicePeriod: t.Object({ startByte: t.Literal(3119), endByte: t.Literal(3147) }),
    electricityKwh: t.Object({ startByte: t.Literal(3384), endByte: t.Literal(3394) }),
  }),
  state: t.Union([t.Literal("needs_review"), t.Literal("reviewed"), t.Literal("linked_draft")]),
  versions: t.Array(t.Object({
    id: t.String({ format: "uuid" }), version: t.Number(), facilityId: t.Union([t.String({ format: "uuid" }), t.Null()]),
    electricityKwh: t.String(), correctionReason: t.Union([t.String(), t.Null()]),
  })),
  draftActivity: t.Union([t.Null(), t.Object({
    id: t.String({ format: "uuid" }), billVersionId: t.String({ format: "uuid" }), quantityMwh: t.String(), status: t.Literal("draft"),
  })]),
  draftCalculation: t.Union([t.Null(), t.Object({
    id: t.String({ format: "uuid" }), activityVersionId: t.String({ format: "uuid" }), billVersionId: t.String({ format: "uuid" }),
    evidenceId: t.String({ format: "uuid" }), facilityId: t.String({ format: "uuid" }), boundaryId: t.String({ format: "uuid" }),
    billVersion: t.Literal(2), sourceQuantityKwh: t.Literal("12346.000"), normalizedQuantityMwh: t.Literal("12.346000"),
    status: t.Literal("draft"), classification: t.Literal("development_candidate"), releaseEligible: t.Literal(false),
    method: t.Object({ id: t.Literal("scope2-location-based-egrid-subregion"), version: t.Literal("2023-r2-camx-v1"), implementationSha256: t.String(), reviewedEngineSha256: t.String(), authorityRecordSha256: t.String() }),
    factor: t.Object({ id: t.Literal("epa-egrid2023-r2-camx-total-output"), version: t.Literal("eGRID2023-revision-2"), candidateSha256: t.String(), sourceSha256: t.String(), sheet: t.Literal("SRL23"), totalOutputCell: t.Literal("AI6"), value: t.Literal("195.0402888") }),
    gwpPolicy: t.Object({ id: t.Literal("epa-egrid2023-ar5-100-year"), version: t.Literal("egrid2023-technical-guide-v1"), policySha256: t.String() }),
    inputSnapshotSha256: t.String(), resultPayloadSha256: t.String(),
    total: t.Object({ unrounded: t.Literal("2407.9674055248"), display: t.Literal("2407.9674"), unit: t.Literal("kg CO2e"), rounding: t.String() }),
    gasResults: t.Record(t.String(), t.Unknown()),
    reconciliation: t.Object({ authority: t.String(), componentSum: t.Literal("2407.8330020304"), componentRoundingDelta: t.Literal("0.1344034944"), explanation: t.String() }),
    trace: t.Array(t.Record(t.String(), t.Unknown())),
    billVersionPayloadSha256: t.String(), createdBy: t.String({ format: "uuid" }), createdAt: t.String(),
    record: t.Record(t.String(), t.Unknown()),
  })]),
})

export function createWorkspaceRoutes(deps: WorkspaceRoutesDeps) {
  return new Elysia({ prefix: "/workspace" })
    .post("/:id/bills", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser)
      if (!user) { set.status = 401; return AUTH_REQUIRED }
      try {
        if (!await deps.store.findById(user.id, params.id)) { set.status = 404; return NOT_FOUND }
        if (!await deps.store.canManage(user.id, params.id)) { set.status = 403; return FORBIDDEN }
      } catch { set.status = 503; return READ_FAILED }
      if (!body || typeof body !== "object" || Object.keys(body).join("|") !== "file" || !(body as { file?: unknown }).file || !((body as { file: unknown }).file instanceof File)) {
        set.status = 422; return FILE_REJECTED
      }
      const file = (body as { file: File }).file
      const bytes = new Uint8Array(await file.arrayBuffer())
      try { await parseSyntheticBill(file.name, file.type, bytes) }
      catch { set.status = 422; return FILE_REJECTED }
      try { return await deps.store.ingestBill(user.id, params.id, bytes, SYNTHETIC_BILL_SHA256) }
      catch { set.status = 503; return READ_FAILED }
    }, { body: t.Unknown(), response: { 200: billResponseSchema, 401: t.Object({ error: t.String() }), 403: t.Object({ error: t.String() }), 404: t.Object({ error: t.String() }), 422: t.Object({ error: t.String() }), 503: t.Object({ error: t.String() }) } })
    .post("/:id/bills/:evidenceId/corrections", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser)
      if (!user) { set.status = 401; return AUTH_REQUIRED }
      let existing
      let workspace
      let canManage
      try {
        existing = await deps.store.findBill(user.id, params.id, params.evidenceId)
        workspace = await deps.store.findById(user.id, params.id)
        canManage = await deps.store.canManage(user.id, params.id)
      } catch { set.status = 503; return READ_FAILED }
      if (!existing) { set.status = 404; return EVIDENCE_NOT_FOUND }
      if (!canManage) { set.status = 403; return FORBIDDEN }
      const value = body as Record<string, unknown>
      if (!workspace || !value || Object.keys(value).sort().join("|") !== "electricityKwh|facilityId|priorVersionId|reason" || value.facilityId !== workspace.facility.id || value.electricityKwh !== "12346.000" || value.reason !== "Synthetic review exercise") {
        set.status = 422; return INVALID_REQUEST
      }
      if (value.priorVersionId !== existing.versions[0]?.id) { set.status = 409; return REVIEW_CONFLICT }
      try { return await deps.store.correctBill(user.id, params.id, params.evidenceId, value.facilityId as string) }
      catch { set.status = 409; return REVIEW_CONFLICT }
    }, { body: t.Unknown(), response: { 200: billResponseSchema, 401: t.Object({ error: t.String() }), 403: t.Object({ error: t.String() }), 404: t.Object({ error: t.String() }), 409: t.Object({ error: t.String() }), 422: t.Object({ error: t.String() }), 503: t.Object({ error: t.String() }) } })
    .post("/:id/bills/:evidenceId/link", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser)
      if (!user) { set.status = 401; return AUTH_REQUIRED }
      let workspace
      let bill
      let canManage
      try {
        workspace = await deps.store.findById(user.id, params.id)
        bill = await deps.store.findBill(user.id, params.id, params.evidenceId)
        canManage = await deps.store.canManage(user.id, params.id)
      } catch { set.status = 503; return READ_FAILED }
      if (!workspace || !bill) { set.status = 404; return EVIDENCE_NOT_FOUND }
      if (!canManage) { set.status = 403; return FORBIDDEN }
      const value = body as Record<string, unknown>
      if (!value || Object.keys(value).sort().join("|") !== "billVersionId|boundaryId" || value.boundaryId !== workspace.boundary.id || value.billVersionId !== bill.versions.find((version) => version.version === 2)?.id || (bill.state !== "reviewed" && bill.state !== "linked_draft")) {
        set.status = 422; return INVALID_REQUEST
      }
      try { return await deps.store.linkBill(user.id, params.id, params.evidenceId, value.boundaryId as string) }
      catch { set.status = 409; return REVIEW_CONFLICT }
    }, { body: t.Unknown(), response: { 200: billResponseSchema, 401: t.Object({ error: t.String() }), 403: t.Object({ error: t.String() }), 404: t.Object({ error: t.String() }), 409: t.Object({ error: t.String() }), 422: t.Object({ error: t.String() }), 503: t.Object({ error: t.String() }) } })
    .post("/:id/bills/:evidenceId/calculate", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser)
      if (!user) { set.status = 401; return AUTH_REQUIRED }
      let bill
      let canManage
      try {
        bill = await deps.store.findBill(user.id, params.id, params.evidenceId)
        canManage = await deps.store.canManage(user.id, params.id)
      } catch { set.status = 503; return READ_FAILED }
      if (!bill) { set.status = 404; return EVIDENCE_NOT_FOUND }
      if (!canManage) { set.status = 403; return FORBIDDEN }
      const value = body as Record<string, unknown>
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).join("|") !== "idempotencyKey" || typeof value.idempotencyKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.idempotencyKey)) {
        set.status = 422; return INVALID_REQUEST
      }
      if (!bill.draftActivity || bill.state !== "linked_draft") { set.status = 409; return REVIEW_CONFLICT }
      try { return await deps.store.calculateBill(user.id, params.id, params.evidenceId, value.idempotencyKey) }
      catch (error) { if (error instanceof Error && error.message === "Calculation request conflicts.") { set.status = 409; return CALCULATION_CONFLICT }; set.status = 503; return NO_RESULT }
    }, { body: t.Unknown(), response: { 200: billResponseSchema, 401: t.Object({ error: t.String() }), 403: t.Object({ error: t.String() }), 404: t.Object({ error: t.String() }), 409: t.Object({ error: t.String() }), 422: t.Object({ error: t.String() }), 503: t.Object({ error: t.String() }) } })
    .post("/:id/bills/:evidenceId/calculate/replay", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser)
      if (!user) { set.status = 401; return AUTH_REQUIRED }
      let bill
      let canManage
      try {
        bill = await deps.store.findBill(user.id, params.id, params.evidenceId)
        canManage = await deps.store.canManage(user.id, params.id)
      } catch { set.status = 503; return READ_FAILED }
      if (!bill) { set.status = 404; return EVIDENCE_NOT_FOUND }
      if (!canManage) { set.status = 403; return FORBIDDEN }
      const value = body as Record<string, unknown>
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== "idempotencyKey|record" || typeof value.idempotencyKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.idempotencyKey) || !bill.draftActivity || !bill.draftCalculation || JSON.stringify(value.record) !== JSON.stringify(bill.draftCalculation.record)) { set.status = 409; return REPLAY_FAILED }
      try { return await deps.store.calculateBill(user.id, params.id, params.evidenceId, value.idempotencyKey) }
      catch { set.status = 503; return NO_RESULT }
    }, { body: t.Unknown(), response: { 200: billResponseSchema, 401: t.Object({ error: t.String() }), 403: t.Object({ error: t.String() }), 404: t.Object({ error: t.String() }), 409: t.Object({ error: t.String() }), 422: t.Object({ error: t.String() }), 503: t.Object({ error: t.String() }) } })
    .get("/:id/bills/:evidenceId", async ({ params, request, set }) => {
      const origin = request.headers.get("origin")
      if (origin && !deps.allowedOrigins.includes(origin)) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser)
      if (!user) { set.status = 401; return AUTH_REQUIRED }
      try {
        const bill = await deps.store.findBill(user.id, params.id, params.evidenceId)
        if (!bill) { set.status = 404; return EVIDENCE_NOT_FOUND }
        return bill
      } catch { set.status = 503; return READ_FAILED }
    }, { response: { 200: billResponseSchema, 401: t.Object({ error: t.String() }), 403: t.Object({ error: t.String() }), 404: t.Object({ error: t.String() }), 503: t.Object({ error: t.String() }) } })
    .post(
      "/",
      async ({ body, request, set }) => {
        if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) {
          set.status = 403
          return FORBIDDEN
        }
        const user = await authenticate(request, deps.validateUser)
        if (!user) {
          set.status = 401
          return AUTH_REQUIRED
        }
        const input = parseInput(body)
        if (!input) {
          set.status = 422
          return INVALID_REQUEST
        }
        try {
          const workspace = await deps.store.create(user.id, input)
          set.status = 201
          return workspace
        } catch {
          set.status = 409
          return CREATE_FAILED
        }
      },
      {
        body: t.Unknown(),
        response: {
          201: responseSchema,
          401: t.Object({ error: t.String() }),
          403: t.Object({ error: t.String() }),
          409: t.Object({ error: t.String() }),
          422: t.Object({ error: t.String() }),
        },
      },
    )
    .get(
      "/:id",
      async ({ params, request, set }) => {
        const origin = request.headers.get("origin")
        if (origin && !deps.allowedOrigins.includes(origin)) {
          set.status = 403
          return FORBIDDEN
        }
        const user = await authenticate(request, deps.validateUser)
        if (!user) {
          set.status = 401
          return AUTH_REQUIRED
        }
        let workspace
        try {
          workspace = await deps.store.findById(user.id, params.id)
        } catch {
          set.status = 503
          return READ_FAILED
        }
        if (!workspace) {
          set.status = 404
          return NOT_FOUND
        }
        return workspace
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
        response: {
          200: responseSchema,
          401: t.Object({ error: t.String() }),
          403: t.Object({ error: t.String() }),
          404: t.Object({ error: t.String() }),
          503: t.Object({ error: t.String() }),
        },
      },
    )
}
