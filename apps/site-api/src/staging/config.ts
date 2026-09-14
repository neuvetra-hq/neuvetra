import path from "node:path"

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
}

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
  const port = Number(environment.PORT ?? "3000")
  if (!Number.isInteger(port) || port < 1 || port > 65535) invalid()
  const databaseCaPem = environment.NEUVETRA_STAGING_DB_CA_PEM
  const databaseCaFile = environment.NEUVETRA_STAGING_DB_CA_FILE
  if ((databaseCaPem !== undefined && databaseCaFile !== undefined) || databaseCaPem === "" || databaseCaFile === "") invalid()
  const webRoot = path.resolve(environment.NEUVETRA_STAGING_WEB_ROOT ?? "/app/apps/site-web/dist-staging")
  return { profile: STAGING_PROFILE, origin: origin.origin, projectRef, reuseExistingProject, supabaseUrl, supabaseAnonKey, databaseUrl: database.toString(), databaseCaPem, databaseCaFile, webRoot, port }
}
