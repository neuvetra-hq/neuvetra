// STUB — package contents missing. See README.md and apps/terrascope-api/CLAUDE.md.
// These exports satisfy TypeScript module resolution so the rest of the monorepo
// typechecks. Any runtime use of these will throw.

const notRestored = (): never => {
  throw new Error(
    "@terrascope/database is empty — package contents were not preserved during " +
      "the 2026-04-28 monorepo move. See packages/terrascope-database/README.md for recovery."
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = new Proxy({}, { get: () => notRestored() })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const companies: any = notRestored
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ghgReports: any = notRestored
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const emissionFactors: any = notRestored
