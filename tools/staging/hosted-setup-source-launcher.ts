/**
 * Refusal-only launcher boundary. This is NOT a runtime attestor.
 *
 * Current Bun/Windows tooling has no accepted mechanism that simultaneously
 * proves the complete runtime-loaded closure before application import, holds
 * that tree immutable, and authenticates publication provenance. Caller flags,
 * file hashes and static import scans cannot supply those missing authorities.
 * Keep this module independent of the application/import graph and fail before
 * reading any supplied request, importing a worker or opening a connection.
 */
export const HOSTED_SETUP_LAUNCHER_ASSESSMENT_PROFILE = "neuvetra.hosted-setup.launcher-blocked.v1" as const
export const HOSTED_SETUP_LAUNCHER_BLOCKERS = Object.freeze([
  "No reviewed pre-import complete runtime-loader observation mechanism is installed.",
  "No reviewed host-enforced immutable source tree lease spans the worker lifetime.",
  "No authenticated clean published archive and runtime/dependency provenance verifier is installed.",
] as const)

/** Diagnostic observations only; deliberately not accepted source-lock evidence. */
export function assessHostedSetupSourceLauncher() {
  return Object.freeze({
    profile: HOSTED_SETUP_LAUNCHER_ASSESSMENT_PROFILE,
    status: "blocked" as const,
    launchSupported: false as const,
    attestation: null,
    observedRuntime: typeof Bun === "undefined" ? "not-bun" : Bun.version,
    observedPlatform: process.platform,
    // API presence would not prove security or complete closure semantics.
    observedModuleGraphApi: typeof Bun === "undefined" ? "undefined" : typeof (Bun as unknown as Record<string, unknown>).ModuleGraph,
    blockers: HOSTED_SETUP_LAUNCHER_BLOCKERS,
  })
}

export class HostedSetupSourceLaunchBlocked extends Error {
  readonly code = "HOSTED_SETUP_TRUSTED_LAUNCHER_UNAVAILABLE"
  constructor() {
    super("Hosted maintenance launch refused: trusted pre-import closure, immutable tree and publication authentication remain unimplemented.")
    this.name = "HostedSetupSourceLaunchBlocked"
  }
}

/** Never consumes caller assertions as attestation, imports code or launches work. */
export function launchHostedSetupMaintenanceWorker(_untrustedRequest?: unknown): never {
  throw new HostedSetupSourceLaunchBlocked()
}

if (import.meta.main) {
  console.error(JSON.stringify(assessHostedSetupSourceLauncher()))
  process.exitCode = 78
}