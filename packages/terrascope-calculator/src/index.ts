// STUB — package contents missing. See README.md and apps/terrascope-api/CLAUDE.md.
// These exports satisfy TypeScript module resolution so the rest of the monorepo
// typechecks. Any runtime use of these will throw.

const notRestored = (): never => {
  throw new Error(
    "@terrascope/calculator is empty — package contents were not preserved during " +
      "the 2026-04-28 monorepo move. See packages/terrascope-calculator/README.md for recovery."
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dbFactorResolver: any = notRestored
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const calculateScope1Combustion: any = notRestored
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const calculateScope1Fugitive: any = notRestored
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const calculateScope2Location: any = notRestored
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const calculateScope2Market: any = notRestored

export class FactorNotFoundError extends Error {
  constructor(message?: string) {
    super(message ?? "FactorNotFoundError stub — @terrascope/calculator not restored")
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CalculationContext = any

// Inventory is used as both a class (instantiated) and a type. Class satisfies both.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Inventory {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  constructor(..._args: any[]) {
    notRestored()
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  addScope1(..._args: any[]): void { notRestored() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  addScope2Location(..._args: any[]): void { notRestored() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  addScope2Market(..._args: any[]): void { notRestored() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  addScope3(..._args: any[]): void { notRestored() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any { return notRestored() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  totals(): any { return notRestored() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get summary(): any { return notRestored() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get auditTrail(): any { return notRestored() }
}
