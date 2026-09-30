import { expect, test } from "bun:test"
import { COLLECTION_EVIDENCE_BUCKET } from "@neuvetra/database"
import { createStagingServer, type StagingDatabase } from "../staging/server"
import { readStagingConfig, STAGING_PROFILE } from "../staging/config"

const REF = "abcdefghijklmnopqrst"
const ORIGIN = "http://127.0.0.1:3015"
const COMPANY = "00000000-0000-4000-8000-000000000001"
const ACTOR = "00000000-0000-4000-8000-000000000002"
const UPLOAD = "00000000-0000-4000-8000-000000000003"

test("staging wrapper raises the body limit only for a collection evidence upload", async () => {
  const config = readStagingConfig({
    NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE,
    NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN,
    SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key",
    DATABASE_URL: `postgres://neuvetra_runtime:synthetic-password@db.${REF}.supabase.co:5432/postgres`,
  })
  let uploaded = 0
  const database = {
    async checkReadiness() { return { profile: STAGING_PROFILE, schemaVersion: 27 } },
    async close() {},
    async hasStagingAccess() { return true },
    async findCollectionContext(_actor: string, companyId: string) { return { companyId, setupVersionId: null, setupRevision: null, locations: [] } },
    async findCollectionEvidence() { return [] },
    async reserveCollectionEvidenceUpload(_actor: string, _company: string, input: any) { return { uploadId: input.uploadId, evidenceId: input.evidenceId, objectKey: input.objectKey, bucket: COLLECTION_EVIDENCE_BUCKET } },
    async registerCollectionEvidence(_actor: string, _company: string, input: any) { return { uploadId: input.uploadId, evidenceId: input.evidenceId, reused: false, quarantineStatus: "pending", orphanRecoveryRequired: false } },
  } as unknown as StagingDatabase
  const app = await createStagingServer(config, {
    database,
    validateUser: async () => ({ id: ACTOR, phone: null, email: null, fullName: null }),
    verifyAssets: async () => {},
    collectionEvidenceStorage: {
      async put(token, bucket, key, bytes) {
        expect(token).toBe("valid")
        expect(bucket).toBe(COLLECTION_EVIDENCE_BUCKET)
        expect(key).toBe(`${COMPANY}/original/${UPLOAD}`)
        uploaded = bytes.byteLength
      },
      async get() { throw new Error("not used") },
    },
    log: () => {},
  })
  try {
    const bytes = new Uint8Array(350_000)
    bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]) // PDF signature; the upload route validates declared types.
    const upload = await app.fetch(new Request(`${ORIGIN}/workspace-api/workspace/${COMPANY}/collection/evidence`, {
      method: "POST", headers: { origin: ORIGIN, authorization: "Bearer valid", "content-type": "application/pdf", "x-neuvetra-original-name": "large.pdf", "x-neuvetra-upload-id": UPLOAD }, body: bytes,
    }))
    expect(upload.status).toBe(201)
    expect(uploaded).toBe(bytes.byteLength)

    const ordinary = await app.fetch(new Request(`${ORIGIN}/workspace-api/workspace/${COMPANY}/setup`, {
      method: "POST", headers: { origin: ORIGIN, authorization: "Bearer valid", "content-type": "application/json" }, body: bytes,
    }))
    expect(ordinary.status).toBe(413)
  } finally { await app.close() }
})
