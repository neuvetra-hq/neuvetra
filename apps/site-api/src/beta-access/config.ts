import { BETA_ACCESS_PROFILE } from "../../../../packages/neuvetra-database/src/beta-access-contract"

export interface BetaAccessConfig {
  profile: typeof BETA_ACCESS_PROFILE
  origin: string
  databaseUrl: string
  databaseName: string
  runtimeRole: string
  port: number
}

function invalid(): never { throw new Error("Local beta access configuration is invalid.") }

/** Local-only. There is deliberately no hosted/staging environment switch or provider fallback. */
export function readBetaAccessConfig(environment: Record<string, string | undefined> = process.env): BetaAccessConfig {
  if (environment.NEUVETRA_BETA_ACCESS_ENABLED !== "local-synthetic-rehearsal" || environment.NEUVETRA_BETA_ACCESS_PROFILE !== BETA_ACCESS_PROFILE) invalid()
  const databaseName = environment.NEUVETRA_BETA_ACCESS_DATABASE ?? ""
  const runtimeRole = environment.NEUVETRA_BETA_ACCESS_RUNTIME_ROLE ?? ""
  if (!/^m80_beta_access_[a-z0-9_]{6,48}$/.test(databaseName) || !/^m80_beta_access_runtime_[a-z0-9_]{6,32}$/.test(runtimeRole)) invalid()
  let origin: URL, database: URL
  try { origin = new URL(environment.NEUVETRA_BETA_ACCESS_ORIGIN ?? ""); database = new URL(environment.NEUVETRA_BETA_ACCESS_DATABASE_URL ?? "") } catch { invalid() }
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.origin !== environment.NEUVETRA_BETA_ACCESS_ORIGIN || origin.pathname !== "/" || origin.search || origin.hash) invalid()
  if (!(["postgres:", "postgresql:"].includes(database.protocol)) || database.hostname !== "127.0.0.1" || database.port !== "55472" || decodeURIComponent(database.username) !== runtimeRole || decodeURIComponent(database.pathname.slice(1)) !== databaseName || database.search || database.hash) invalid()
  const port = Number(environment.NEUVETRA_BETA_ACCESS_PORT ?? "3080")
  if (!Number.isInteger(port) || port < 1024 || port > 65535) invalid()
  return { profile: BETA_ACCESS_PROFILE, origin: origin.origin, databaseUrl: database.toString(), databaseName, runtimeRole, port }
}
