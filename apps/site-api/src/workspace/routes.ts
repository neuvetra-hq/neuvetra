import { Elysia, t } from "elysia"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"
import { checkOrigin } from "../lib/origin-check"
import { INVENTORY_WARNINGS, type WorkspaceStore } from "./types"
import { parseSyntheticBill, SYNTHETIC_BILL_NAME, SYNTHETIC_BILL_SHA256, SYNTHETIC_BILL_SIZE } from "./synthetic-bill-parser"
import { M58_WARNINGS } from "@neuvetra/database"

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
const INVENTORY_NOT_FOUND = { error: "Inventory not found." } as const
const INVENTORY_CONFLICT = { error: "Inventory review conflicts." } as const
const INPUT_KEYS = ["companyName", "facilityName", "countryCode", "stateCode", "egridSubregion", "reportingYear", "approach"] as const
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

const inventoryResponseSchema = t.Object({
  id: t.String({ format: "uuid" }), companyId: t.String({ format: "uuid" }), boundaryId: t.String({ format: "uuid" }), calculationId: t.String({ format: "uuid" }),
  version: t.Literal(1), reportingYear: t.Literal(2023), scope: t.Literal("scope_2_location_based"),
  reviewState: t.Union([t.Literal("awaiting_review"), t.Literal("approved_bounded_draft"), t.Literal("changes_requested")]), completeness: t.Literal("incomplete"), releaseEligible: t.Literal(false),
  coverage: t.Object({ expectedFacilities: t.Literal(1), coveredFacilities: t.Literal(1), expectedPeriods: t.Literal(12), coveredPeriods: t.Literal(1), coveredMonths: t.Tuple([t.Literal("2023-01")]), missingMonths: t.Array(t.String()) }),
  warnings: t.Array(t.String()),
  line: t.Object({ facilityId: t.String({ format: "uuid" }), servicePeriodStart: t.Literal("2023-01-01"), servicePeriodEnd: t.Literal("2023-01-31"), quantityMwh: t.Literal("12.346000"), subtotalKgCo2e: t.Literal("2407.9674"), calculationResultSha256: t.String() }),
  snapshotSha256: t.String(), submittedBy: t.String({ format: "uuid" }), submittedAt: t.String(),
  decision: t.Union([t.Null(), t.Object({ id: t.String({ format: "uuid" }), decision: t.Union([t.Literal("approve_bounded_draft"), t.Literal("changes_requested")]), outcome: t.Union([t.Literal("approved_bounded_draft"), t.Literal("changes_requested")]), acknowledgedWarnings: t.Array(t.String()), reasonCode: t.Union([t.Literal("bounded_synthetic_scope_reviewed"), t.Literal("source_or_calculation_revision_required")]), decidedBy: t.String({ format: "uuid" }), decidedAt: t.String() })]),
})

const errorResponseSchema = t.Object({ error: t.String() })
const annualTotalsSchema = t.Object({
  reportedMwh:t.Literal("126.788000"),reportedKgCo2e:t.Literal("24728.7681363744"),reportedDisplayKgCo2e:t.Literal("24728.7681"),
  estimatedMwh:t.Literal("12.493000"),estimatedKgCo2e:t.Literal("2436.6383279784"),estimatedDisplayKgCo2e:t.Literal("2436.6383"),
  includedMwh:t.Literal("139.281000"),includedKgCo2e:t.Literal("27165.4064643528"),includedDisplayKgCo2e:t.Literal("27165.4065"),
})
const annualCountsSchema=t.Object({expected:t.Literal(12),resolved:t.Number(),reported:t.Number(),estimated:t.Number(),excluded:t.Number(),missing:t.Number(),calculationBearing:t.Number()})
const annualEvidenceSchema=t.Object({source:t.String(),sha256:t.String({pattern:"^[0-9a-f]{64}$"}),locator:t.String()})
const annualPeriodSchema=t.Object({month:t.String(),state:t.Union([t.Literal("missing"),t.Literal("reported"),t.Literal("estimated"),t.Literal("excluded")]),version:t.Union([t.Literal(1),t.Literal(2)]),quantityMwh:t.Union([t.String(),t.Null()]),emissionsKgCo2e:t.Union([t.String(),t.Null()]),evidence:t.Union([annualEvidenceSchema,t.Null()]),reason:t.Union([t.String(),t.Null()]),method:t.Union([t.String(),t.Null()]),formula:t.Union([t.String(),t.Null()]),basisMonths:t.Array(t.String())})
const annualRegisterResponseSchema=t.Object({id:t.String({format:"uuid"}),companyId:t.String({format:"uuid"}),boundaryId:t.String({format:"uuid"}),previousInventoryVersionId:t.String({format:"uuid"}),version:t.Union([t.Literal(1),t.Literal(2)]),reportingYear:t.Literal(2023),facilityId:t.String({format:"uuid"}),status:t.Union([t.Literal("incomplete"),t.Literal("resolved_with_exceptions")]),counts:annualCountsSchema,periods:t.Array(annualPeriodSchema,{minItems:12,maxItems:12}),totals:t.Union([annualTotalsSchema,t.Null()]),fixtureSha256:t.Union([t.String({pattern:"^[0-9a-f]{64}$"}),t.Null()]),snapshotSha256:t.String({pattern:"^[0-9a-f]{64}$"}),createdBy:t.String({format:"uuid"}),createdAt:t.String()})
const annualInventoryResponseSchema=t.Object({id:t.String({format:"uuid"}),companyId:t.String({format:"uuid"}),boundaryId:t.String({format:"uuid"}),previousInventoryVersionId:t.String({format:"uuid"}),registerId:t.String({format:"uuid"}),registerSnapshotSha256:t.String({pattern:"^[0-9a-f]{64}$"}),version:t.Literal(2),reportingYear:t.Literal(2023),scope:t.Literal("scope_2_location_based"),periodResolution:t.Literal("resolved_with_exceptions"),overallInventoryCompleteness:t.Literal("incomplete"),releaseEligible:t.Literal(false),counts:annualCountsSchema,totals:annualTotalsSchema,warnings:t.Array(t.String()),snapshotSha256:t.String({pattern:"^[0-9a-f]{64}$"}),submittedBy:t.String({format:"uuid"}),submittedAt:t.String(),decision:t.Union([t.Null(),t.Object({id:t.String({format:"uuid"}),decision:t.Union([t.Literal("approve_bounded_annual_location_draft"),t.Literal("changes_requested")]),outcome:t.Union([t.Literal("approved_bounded_annual_location_draft"),t.Literal("changes_requested")]),reasonCode:t.Union([t.Literal("bounded_annual_location_register_reviewed"),t.Literal("source_or_calculation_revision_required")]),acknowledgedWarnings:t.Array(t.String()),decidedBy:t.String({format:"uuid"}),decidedAt:t.String()})])})
const evidencePackMetadataSchema=t.Object({id:t.String({format:"uuid"}),companyId:t.String({format:"uuid"}),inventoryId:t.String({format:"uuid"}),profile:t.Literal("neuvetra.synthetic.inventory-evidence-pack.v1"),manifestSha256:t.String({pattern:"^[0-9a-f]{64}$"}),lineageRootSha256:t.String({pattern:"^[0-9a-f]{64}$"}),archiveSha256:t.String({pattern:"^[0-9a-f]{64}$"}),archiveByteLength:t.Integer({minimum:1,maximum:262144}),entryCount:t.Literal(17),createdBy:t.String({format:"uuid"}),createdAt:t.String()})
const evidencePackReceiptSchema=t.Object({status:t.Literal("verified_match"),profile:t.Literal("neuvetra.synthetic.inventory-evidence-pack.v1"),archiveSha256:t.String({pattern:"^[0-9a-f]{64}$"}),manifestSha256:t.String({pattern:"^[0-9a-f]{64}$"}),lineageRootSha256:t.String({pattern:"^[0-9a-f]{64}$"}),entryCount:t.Literal(17),inventoryId:t.String({format:"uuid"}),reconstructed:t.Object({expected:t.Literal(12),reported:t.Literal(10),estimated:t.Literal(1),excluded:t.Literal(1),missing:t.Literal(0),reportedMwh:t.Literal("126.788000"),reportedKgCo2e:t.Literal("24728.7681363744"),estimatedMwh:t.Literal("12.493000"),estimatedKgCo2e:t.Literal("2436.6383279784"),includedMwh:t.Literal("139.281000"),includedKgCo2e:t.Literal("27165.4064643528"),includedDisplayKgCo2e:t.Literal("27165.4065")}),overallInventoryCompleteness:t.Literal("incomplete"),releaseEligible:t.Literal(false)})
function evidencePackMetadata(pack:Awaited<ReturnType<NonNullable<WorkspaceRoutesDeps["store"]["findAnnualEvidencePack"]>>>){if(!pack)throw new Error("missing");const{archive:_archive,...metadata}=pack;return metadata}
const draftReportMetadataSchema=t.Object({id:t.String({format:"uuid"}),companyId:t.String({format:"uuid"}),inventoryId:t.String({format:"uuid"}),evidencePackId:t.String({format:"uuid"}),profile:t.Literal("neuvetra.synthetic.inventory-draft-report.v1"),inventorySnapshotSha256:t.String({pattern:"^[0-9a-f]{64}$"}),sourceArchiveSha256:t.String({pattern:"^[0-9a-f]{64}$"}),sourceManifestSha256:t.String({pattern:"^[0-9a-f]{64}$"}),sourceLineageRootSha256:t.String({pattern:"^[0-9a-f]{64}$"}),reportSha256:t.String({pattern:"^[0-9a-f]{64}$"}),reportByteLength:t.Integer({minimum:1,maximum:65536}),createdBy:t.String({format:"uuid"}),createdAt:t.String()})
function draftReportMetadata(report:Awaited<ReturnType<NonNullable<WorkspaceRoutesDeps["store"]["findDraftInventoryReport"]>>>){if(!report)throw new Error("missing");const{report:_bytes,...metadata}=report;return metadata}

export function createWorkspaceRoutes(deps: WorkspaceRoutesDeps) {
  return new Elysia({ prefix: "/workspace" })
    .post("/:id/annual-inventories/:inventoryId/evidence-packs", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status=403; return FORBIDDEN }
      const user=await authenticate(request,deps.validateUser); if(!user){set.status=401;return AUTH_REQUIRED}
      let canManage;try{canManage=await deps.store.canManage(user.id,params.id)}catch{set.status=404;return NOT_FOUND}if(!canManage){set.status=403;return FORBIDDEN}
      const value=body as Record<string,unknown>;const exact=value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).sort().join("|")==="expectedInventorySnapshotSha256|idempotencyKey"
      if(!UUID_V4.test(params.id)||!UUID_V4.test(params.inventoryId)||!exact||typeof value.expectedInventorySnapshotSha256!=="string"||!/^[0-9a-f]{64}$/.test(value.expectedInventorySnapshotSha256)||typeof value.idempotencyKey!=="string"||!UUID_V4.test(value.idempotencyKey)){set.status=422;return INVALID_REQUEST}
      try { const pack=await deps.store.createAnnualEvidencePack!(user.id,params.id,params.inventoryId,value.expectedInventorySnapshotSha256,value.idempotencyKey);set.status=201;return evidencePackMetadata(pack) }
      catch(error){set.status=error instanceof Error&&error.message.includes("conflict")?409:503;return set.status===409?REPLAY_FAILED:READ_FAILED}
    },{body:t.Object({expectedInventorySnapshotSha256:t.String({pattern:"^[0-9a-f]{64}$"}),idempotencyKey:t.String({format:"uuid"})},{additionalProperties:false}),response:{201:evidencePackMetadataSchema,401:errorResponseSchema,403:errorResponseSchema,409:errorResponseSchema,422:errorResponseSchema,503:errorResponseSchema}})
    .get("/:id/annual-inventories/:inventoryId/evidence-packs/current",async({params,request,set})=>{
      const origin=request.headers.get("origin");if(origin&&!deps.allowedOrigins.includes(origin)){set.status=403;return FORBIDDEN}const user=await authenticate(request,deps.validateUser);if(!user){set.status=401;return AUTH_REQUIRED}
      try{const pack=await deps.store.findAnnualEvidencePack!(user.id,params.id,params.inventoryId);if(!pack){set.status=404;return NOT_FOUND}return evidencePackMetadata(pack)}catch{set.status=503;return READ_FAILED}
    },{response:{200:evidencePackMetadataSchema,401:errorResponseSchema,403:errorResponseSchema,404:errorResponseSchema,503:errorResponseSchema}})
    .get("/:id/annual-inventories/:inventoryId/evidence-packs/:packId/download",async({params,request,set})=>{
      const origin=request.headers.get("origin");if(origin&&!deps.allowedOrigins.includes(origin)){set.status=403;return FORBIDDEN}const user=await authenticate(request,deps.validateUser);if(!user){set.status=401;return AUTH_REQUIRED}
      try{const pack=await deps.store.findAnnualEvidencePack!(user.id,params.id,params.inventoryId);if(!pack||pack.id!==params.packId){set.status=404;return NOT_FOUND}const body=pack.archive.slice().buffer as ArrayBuffer;return new Response(body,{headers:{"content-type":"application/zip","content-disposition":`attachment; filename="neuvetra-m59-${pack.inventoryId}.zip"`,"etag":`"${pack.archiveSha256}"`,"x-neuvetra-archive-sha256":pack.archiveSha256,"cache-control":"private, no-store"}})}catch{set.status=503;return READ_FAILED}
    })
    .post("/:id/annual-inventories/:inventoryId/evidence-packs/:packId/replay", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status=403; return FORBIDDEN }
      const user=await authenticate(request,deps.validateUser); if(!user){set.status=401;return AUTH_REQUIRED}
      const value=body as Record<string,unknown>;const exact=value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).join("|")==="file";const file=exact?value.file:null
      if(!UUID_V4.test(params.id)||!UUID_V4.test(params.inventoryId)||!UUID_V4.test(params.packId)||!(file instanceof File)||file.size<1||file.size>262144){set.status=422;return INVALID_REQUEST}
      try { const pack=await deps.store.findAnnualEvidencePack!(user.id,params.id,params.inventoryId);if(!pack||pack.id!==params.packId){set.status=404;return NOT_FOUND};return await deps.store.replayAnnualEvidencePack!(user.id,params.id,params.inventoryId,params.packId,new Uint8Array(await file.arrayBuffer())) }
      catch { set.status=409; return REPLAY_FAILED }
    },{body:t.Unknown(),response:{200:evidencePackReceiptSchema,401:errorResponseSchema,403:errorResponseSchema,404:errorResponseSchema,409:errorResponseSchema,422:errorResponseSchema}})
    .post("/:id/annual-inventories/:inventoryId/draft-reports",async({body,params,request,set})=>{if(!checkOrigin(request.headers,deps.allowedOrigins).allowed){set.status=403;return FORBIDDEN}const user=await authenticate(request,deps.validateUser);if(!user){set.status=401;return AUTH_REQUIRED}let canManage;try{canManage=await deps.store.canManage(user.id,params.id)}catch{set.status=404;return NOT_FOUND}if(!canManage){set.status=403;return FORBIDDEN}const value=body as Record<string,unknown>,keys="evidencePackId|expectedArchiveSha256|expectedInventorySnapshotSha256|idempotencyKey";if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).sort().join("|")!==keys||typeof value.evidencePackId!=="string"||!UUID_V4.test(value.evidencePackId)||typeof value.idempotencyKey!=="string"||!UUID_V4.test(value.idempotencyKey)||typeof value.expectedArchiveSha256!=="string"||!/^[0-9a-f]{64}$/.test(value.expectedArchiveSha256)||typeof value.expectedInventorySnapshotSha256!=="string"||!/^[0-9a-f]{64}$/.test(value.expectedInventorySnapshotSha256)){set.status=422;return INVALID_REQUEST}try{const report=await deps.store.createDraftInventoryReport!(user.id,params.id,params.inventoryId,value.evidencePackId,value.expectedInventorySnapshotSha256,value.expectedArchiveSha256,value.idempotencyKey);set.status=201;return draftReportMetadata(report)}catch(error){set.status=error instanceof Error&&(error.message.includes("required")||error.message.includes("conflict"))?409:503;return set.status===409?REPLAY_FAILED:READ_FAILED}}, {body:t.Unknown(),response:{201:draftReportMetadataSchema,401:errorResponseSchema,403:errorResponseSchema,409:errorResponseSchema,422:errorResponseSchema,503:errorResponseSchema}})
    .get("/:id/annual-inventories/:inventoryId/draft-reports/current",async({params,request,set})=>{const origin=request.headers.get("origin");if(origin&&!deps.allowedOrigins.includes(origin)){set.status=403;return FORBIDDEN}const user=await authenticate(request,deps.validateUser);if(!user){set.status=401;return AUTH_REQUIRED}try{const report=await deps.store.findDraftInventoryReport!(user.id,params.id,params.inventoryId);if(!report){set.status=404;return NOT_FOUND}return draftReportMetadata(report)}catch{set.status=503;return READ_FAILED}},{response:{200:draftReportMetadataSchema,401:errorResponseSchema,403:errorResponseSchema,404:errorResponseSchema,503:errorResponseSchema}})
    .get("/:id/annual-inventories/:inventoryId/draft-reports/:reportId/download",async({params,request,set})=>{const origin=request.headers.get("origin");if(origin&&!deps.allowedOrigins.includes(origin)){set.status=403;return FORBIDDEN}const user=await authenticate(request,deps.validateUser);if(!user){set.status=401;return AUTH_REQUIRED}try{const report=await deps.store.findDraftInventoryReport!(user.id,params.id,params.inventoryId);if(!report||report.id!==params.reportId){set.status=404;return NOT_FOUND}return new Response(report.report.slice().buffer as ArrayBuffer,{headers:{"content-type":"text/html; charset=utf-8","content-disposition":`attachment; filename="neuvetra-m60-${report.inventoryId}.html"`,"x-neuvetra-report-sha256":report.reportSha256,"cache-control":"private, no-store"}})}catch{set.status=503;return READ_FAILED}})
    .post("/:id/annual-registers/2023", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser); if (!user) { set.status = 401; return AUTH_REQUIRED }
      let canManage; try { canManage = await deps.store.canManage(user.id, params.id) } catch { set.status = 503; return READ_FAILED }
      if (!canManage) { set.status = 403; return FORBIDDEN }
      const value = body as Record<string, unknown>
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== "idempotencyKey|previousInventoryVersionId" || typeof value.previousInventoryVersionId !== "string" || typeof value.idempotencyKey !== "string" || !UUID_V4.test(value.previousInventoryVersionId) || !UUID_V4.test(value.idempotencyKey)) { set.status = 422; return INVALID_REQUEST }
      try { set.status = 201; return await deps.store.createAnnualRegister!(user.id, params.id, value.previousInventoryVersionId, value.idempotencyKey) }
      catch (error) { set.status = error instanceof Error && (error.message.includes("conflict") || error.message.includes("predecessor")) ? 409 : 503; return set.status === 409 ? INVENTORY_CONFLICT : READ_FAILED }
    }, { body: t.Unknown(), response: { 201: annualRegisterResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema, 422: errorResponseSchema, 503: errorResponseSchema } })
    .get("/:id/annual-registers/2023", async ({ params, request, set }) => {
      const origin = request.headers.get("origin"); if (origin && !deps.allowedOrigins.includes(origin)) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser); if (!user) { set.status = 401; return AUTH_REQUIRED }
      try { const registers = await deps.store.findAnnualRegisters!(user.id, params.id); if (!registers.length) { set.status = 404; return INVENTORY_NOT_FOUND }; return registers }
      catch { set.status = 503; return READ_FAILED }
    }, { response: { 200: t.Array(annualRegisterResponseSchema), 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 503: errorResponseSchema } })
    .post("/:id/annual-registers/:registerId/complete", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser); if (!user) { set.status = 401; return AUTH_REQUIRED }
      let canManage; try { canManage = await deps.store.canManage(user.id, params.id) } catch { set.status = 503; return READ_FAILED }
      if (!canManage) { set.status = 403; return FORBIDDEN }
      const value = body as Record<string, unknown>
      if (!UUID_V4.test(params.registerId) || !value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== "expectedRegisterSnapshotSha256|fixtureId|idempotencyKey" || value.fixtureId !== "m58-fixed-electricity-register-2023-v1" || typeof value.expectedRegisterSnapshotSha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.expectedRegisterSnapshotSha256) || typeof value.idempotencyKey !== "string" || !UUID_V4.test(value.idempotencyKey)) { set.status = 422; return INVALID_REQUEST }
      try { set.status = 201; return await deps.store.completeAnnualRegister!(user.id, params.id, params.registerId, value.expectedRegisterSnapshotSha256, value.idempotencyKey) }
      catch (error) { set.status = error instanceof Error && error.message.includes("conflict") ? 409 : 503; return set.status === 409 ? INVENTORY_CONFLICT : READ_FAILED }
    }, { body: t.Unknown(), response: { 201: annualRegisterResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema, 422: errorResponseSchema, 503: errorResponseSchema } })
    .post("/:id/annual-inventories/2023/scope2/versions", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser); if (!user) { set.status = 401; return AUTH_REQUIRED }
      let canManage; try { canManage = await deps.store.canManage(user.id, params.id) } catch { set.status = 503; return READ_FAILED }
      if (!canManage) { set.status = 403; return FORBIDDEN }
      const value = body as Record<string, unknown>
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== "idempotencyKey|registerId" || typeof value.registerId !== "string" || !UUID_V4.test(value.registerId) || typeof value.idempotencyKey !== "string" || !UUID_V4.test(value.idempotencyKey)) { set.status = 422; return INVALID_REQUEST }
      try { set.status = 201; return await deps.store.createAnnualInventory!(user.id, params.id, value.registerId, value.idempotencyKey) }
      catch (error) { set.status = error instanceof Error && (error.message.includes("conflict") || error.message.includes("required")) ? 409 : 503; return set.status === 409 ? INVENTORY_CONFLICT : READ_FAILED }
    }, { body: t.Unknown(), response: { 201: annualInventoryResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema, 422: errorResponseSchema, 503: errorResponseSchema } })
    .get("/:id/annual-inventories/2023/scope2", async ({ params, request, set }) => {
      const origin = request.headers.get("origin"); if (origin && !deps.allowedOrigins.includes(origin)) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser); if (!user) { set.status = 401; return AUTH_REQUIRED }
      try { const inventory = await deps.store.findAnnualInventory!(user.id, params.id); if (!inventory) { set.status = 404; return INVENTORY_NOT_FOUND }; return inventory }
      catch { set.status = 503; return READ_FAILED }
    }, { response: { 200: annualInventoryResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 503: errorResponseSchema } })
    .post("/:id/annual-inventories/:inventoryId/decisions", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser); if (!user) { set.status = 401; return AUTH_REQUIRED }
      let canManage; try { canManage = await deps.store.canManage(user.id, params.id) } catch { set.status = 503; return READ_FAILED }
      if (!canManage) { set.status = 403; return FORBIDDEN }
      const value = body as Record<string, unknown>
      const exact = value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === "acknowledgedWarnings|decision|expectedInventorySnapshotSha256|idempotencyKey|reasonCode"
      const approval = value?.decision === "approve_bounded_annual_location_draft" && value.reasonCode === "bounded_annual_location_register_reviewed" && JSON.stringify(value.acknowledgedWarnings) === JSON.stringify(M58_WARNINGS)
      const changes = value?.decision === "changes_requested" && value.reasonCode === "source_or_calculation_revision_required" && Array.isArray(value.acknowledgedWarnings) && value.acknowledgedWarnings.length === 0
      if (!UUID_V4.test(params.inventoryId) || !exact || typeof value.idempotencyKey !== "string" || !UUID_V4.test(value.idempotencyKey) || typeof value.expectedInventorySnapshotSha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.expectedInventorySnapshotSha256) || (!approval && !changes)) { set.status = 422; return INVALID_REQUEST }
      try { set.status = 201; return await deps.store.reviewAnnualInventory!(user.id, params.id, params.inventoryId, value as any) }
      catch (error) { set.status = error instanceof Error && (error.message.includes("conflict") || error.message.includes("contract")) ? 409 : 503; return set.status === 409 ? INVENTORY_CONFLICT : READ_FAILED }
    }, { body: t.Unknown(), response: { 201: annualInventoryResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema, 422: errorResponseSchema, 503: errorResponseSchema } })
    .post("/:id/inventories/2023/scope2/versions", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser)
      if (!user) { set.status = 401; return AUTH_REQUIRED }
      let canManage
      try { canManage = await deps.store.canManage(user.id, params.id) } catch { set.status = 503; return READ_FAILED }
      if (!canManage) { set.status = 403; return FORBIDDEN }
      const value = body as Record<string, unknown>
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== "calculationId|idempotencyKey" || typeof value.calculationId !== "string" || typeof value.idempotencyKey !== "string" || !UUID_V4.test(value.calculationId) || !UUID_V4.test(value.idempotencyKey)) { set.status = 422; return INVALID_REQUEST }
      try { set.status = 201; return await deps.store.createInventory!(user.id, params.id, value.calculationId, value.idempotencyKey) }
      catch (error) { if (error instanceof Error && error.message.includes("conflict")) { set.status = 409; return INVENTORY_CONFLICT }; set.status = 503; return READ_FAILED }
    }, { body: t.Unknown(), response: { 201: inventoryResponseSchema, 401: t.Object({ error: t.String() }), 403: t.Object({ error: t.String() }), 409: t.Object({ error: t.String() }), 422: t.Object({ error: t.String() }), 503: t.Object({ error: t.String() }) } })
    .get("/:id/inventories/2023/scope2", async ({ params, request, set }) => {
      const origin = request.headers.get("origin"); if (origin && !deps.allowedOrigins.includes(origin)) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser); if (!user) { set.status = 401; return AUTH_REQUIRED }
      try { const inventory = await deps.store.findInventory!(user.id, params.id); if (!inventory) { set.status = 404; return INVENTORY_NOT_FOUND }; return inventory }
      catch { set.status = 503; return READ_FAILED }
    }, { response: { 200: inventoryResponseSchema, 401: t.Object({ error: t.String() }), 403: t.Object({ error: t.String() }), 404: t.Object({ error: t.String() }), 503: t.Object({ error: t.String() }) } })
    .post("/:id/inventories/:inventoryId/decisions", async ({ body, params, request, set }) => {
      if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) { set.status = 403; return FORBIDDEN }
      const user = await authenticate(request, deps.validateUser); if (!user) { set.status = 401; return AUTH_REQUIRED }
      let canManage; try { canManage = await deps.store.canManage(user.id, params.id) } catch { set.status = 503; return READ_FAILED }
      if (!canManage) { set.status = 403; return FORBIDDEN }
      if (!UUID_V4.test(params.inventoryId)) { set.status = 422; return INVALID_REQUEST }
      const value = body as Record<string, unknown>
      const exactKeys = value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === "acknowledgedWarnings|decision|expectedInventorySnapshotSha256|idempotencyKey|reasonCode"
      const uuid = typeof value?.idempotencyKey === "string" && UUID_V4.test(value.idempotencyKey)
      const sha = typeof value?.expectedInventorySnapshotSha256 === "string" && /^[0-9a-f]{64}$/.test(value.expectedInventorySnapshotSha256)
      const approval = value?.decision === "approve_bounded_draft" && value.reasonCode === "bounded_synthetic_scope_reviewed" && JSON.stringify(value.acknowledgedWarnings) === JSON.stringify(INVENTORY_WARNINGS)
      const changes = value?.decision === "changes_requested" && value.reasonCode === "source_or_calculation_revision_required" && Array.isArray(value.acknowledgedWarnings) && value.acknowledgedWarnings.length === 0
      if (!exactKeys || !uuid || !sha || (!approval && !changes)) { set.status = 422; return INVALID_REQUEST }
      try { set.status = 201; return await deps.store.decideInventory!(user.id, params.id, params.inventoryId, value as any) }
      catch (error) { if (error instanceof Error && (error.message.includes("conflict") || error.message.includes("contract mismatch"))) { set.status = 409; return INVENTORY_CONFLICT }; set.status = 503; return READ_FAILED }
    }, { body: t.Unknown(), response: { 201: inventoryResponseSchema, 401: t.Object({ error: t.String() }), 403: t.Object({ error: t.String() }), 409: t.Object({ error: t.String() }), 422: t.Object({ error: t.String() }), 503: t.Object({ error: t.String() }) } })
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
