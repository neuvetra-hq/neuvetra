import path from "node:path"
import { validateHostedTarget } from "@neuvetra/database"

export const STAGING_PROFILE = "neuvetra.private-synthetic-staging.v1" as const

export interface StagingConfig {
  profile: typeof STAGING_PROFILE
  origin: string
  projectRef: string
  reuseExistingProject: boolean
  supabaseUrl: string
  supabaseAnonKey: string
  databaseUrl: string
  databaseCaPem?: string
  databaseCaFile?: string
  webRoot: string
  port: number
  /** BF-19: request-pool connections per API instance (`NEUVETRA_STAGING_DB_POOL_SIZE`, 1-8, default 4); readiness has one more. Absent (hand-built test configs) means the adapter default, 4. */
  databasePoolSize?: number
}

/** BF-19: the request pool's default size, and the adapter's ceiling (hosted.ts refuses more than 8). */
export const STAGING_DB_POOL_SIZE_DEFAULT = 4
export const STAGING_DB_POOL_SIZE_MAX = 8

function invalid(): never { throw new Error("Private staging configuration is invalid.") }

export function readStagingConfig(environment: Record<string, string | undefined> = process.env): StagingConfig {
  if (environment.NEUVETRA_STAGING_ENABLED !== "enabled" || environment.NEUVETRA_STAGING_PROFILE !== STAGING_PROFILE || !["production", "test"].includes(environment.NODE_ENV ?? "")) invalid()
  const projectRef = environment.NEUVETRA_STAGING_PROJECT_REF ?? ""
  const reuseExistingProject = environment.NEUVETRA_STAGING_REUSE_EXISTING === "confirmed"
  if (!/^[a-z]{20}$/.test(projectRef) || (projectRef === "icockcoguyadhryzydvl" && !reuseExistingProject)) invalid()
  const supabaseUrl = `https://${projectRef}.supabase.co`
  if (environment.SUPABASE_URL !== supabaseUrl) invalid()
  const supabaseAnonKey = environment.SUPABASE_ANON_KEY ?? ""
  if (!supabaseAnonKey || supabaseAnonKey.length > 4096) invalid()
  if (!/^sb_publishable_[A-Za-z0-9_-]{20,200}$/.test(supabaseAnonKey)) {
    try {
      const parts = supabaseAnonKey.split(".")
      const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8"))
      if (parts.length !== 3 || payload.role !== "anon" || payload.ref !== projectRef) invalid()
    } catch { invalid() }
  }
  let origin: URL, database: URL
  try {
    origin = new URL(environment.NEUVETRA_STAGING_ORIGIN ?? "")
    database = new URL(environment.DATABASE_URL ?? "")
  } catch { invalid() }
  if (origin.origin !== environment.NEUVETRA_STAGING_ORIGIN || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || (origin.protocol !== "https:" && !(environment.NODE_ENV === "test" && origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname)))) invalid()
  const direct = database.hostname === `db.${projectRef}.supabase.co` && database.username === "neuvetra_runtime"
  const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(database.hostname) && database.username === `neuvetra_runtime.${projectRef}`
  if (!["postgres:", "postgresql:"].includes(database.protocol) || (!direct && !pooler) || !database.password || database.pathname !== "/postgres" || database.hash || database.search || (database.port && database.port !== "5432" && !(pooler && database.port === "6543"))) invalid()
  // BF-19: the pool size is an integer 1-8 written plainly ("4", never "04", "4.0" or ""); anything else refuses to start.
  const poolSetting = environment.NEUVETRA_STAGING_DB_POOL_SIZE
  if (poolSetting !== undefined && !new RegExp(`^[1-${STAGING_DB_POOL_SIZE_MAX}]$`).test(poolSetting)) invalid()
  const databasePoolSize = poolSetting === undefined ? STAGING_DB_POOL_SIZE_DEFAULT : Number(poolSetting)
  // The hosted adapter re-validates this target at startup; refuse here anything it would refuse there.
  try { validateHostedTarget({ connectionString: database.toString(), expectedProjectRef: projectRef, reuseExistingProject, maxConnections: databasePoolSize }) } catch { invalid() }
  const port = Number(environment.PORT ?? "3000")
  if (!Number.isInteger(port) || port < 1 || port > 65535) invalid()
  const databaseCaPem = environment.NEUVETRA_STAGING_DB_CA_PEM
  const databaseCaFile = environment.NEUVETRA_STAGING_DB_CA_FILE
  if ((databaseCaPem !== undefined && databaseCaFile !== undefined) || databaseCaPem === "" || databaseCaFile === "") invalid()
  const webRoot = path.resolve(environment.NEUVETRA_STAGING_WEB_ROOT ?? "/app/apps/site-web/dist-staging")
  return { profile: STAGING_PROFILE, origin: origin.origin, projectRef, reuseExistingProject, supabaseUrl, supabaseAnonKey, databaseUrl: database.toString(), databaseCaPem, databaseCaFile, webRoot, port, databasePoolSize }
}
