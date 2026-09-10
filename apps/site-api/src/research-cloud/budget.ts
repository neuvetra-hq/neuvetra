import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { hash, PassageError } from '../research-passages/release'

export interface AttemptBudget { remaining(): number; reserve(stage: string, inputSha256: string): number; maxCalls: number }

/** Each exclusive, flushed file reserves one attempt, including failed or uncertain I/O. */
export function createAttemptBudget(directory: string, policy: { runId: string; maxCalls: number; reservationUsd: number; profileSha256: string }): AttemptBudget {
  if (!path.isAbsolute(directory) || !/^[a-z0-9-]{1,100}$/.test(policy.runId) || !Number.isInteger(policy.maxCalls) || policy.maxCalls < 5 || policy.maxCalls > 200 || policy.reservationUsd !== 1 || !/^[a-f0-9]{64}$/.test(policy.profileSha256)) throw new Error('Invalid private budget policy.')
  // Bun on Windows can report EEXIST for an existing OneDrive directory.
  // Still validate its type below; existing reservations are never replaced.
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true })
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error('Invalid budget directory.')
  const expected = JSON.stringify({ schema: 1, ...policy }), policyPath = path.join(directory, 'policy.json')
  const exclusive = (file: string, value: string) => {
    const fd = openSync(file, 'wx', 0o600)
    try { writeFileSync(fd, value, 'utf8'); fsyncSync(fd) } finally { closeSync(fd) }
  }
  if (!existsSync(policyPath)) exclusive(policyPath, expected)
  if (readFileSync(policyPath, 'utf8') !== expected) throw new Error('Budget policy differs from the existing run.')
  const policySha = hash(expected)
  function count(): number {
    const files = readdirSync(directory).filter(f => f !== 'policy.json').sort()
    for (let i = 0; i < files.length; i++) {
      if (files[i] !== `attempt-${String(i + 1).padStart(3, '0')}.json`) throw new PassageError('budget_exhausted')
      try {
        const v = JSON.parse(readFileSync(path.join(directory, files[i]), 'utf8'))
        if (v.attempt !== i + 1 || v.policy_sha256 !== policySha) throw new Error()
      } catch { throw new PassageError('budget_exhausted') }
    }
    return files.length
  }
  return {
    maxCalls: policy.maxCalls,
    remaining: () => Math.max(0, policy.maxCalls - count()),
    reserve(stage, inputSha256) {
      const attempt = count() + 1
      if (attempt > policy.maxCalls || !['analyze', 'plan', 'draft', 'verify'].includes(stage) || !/^[a-f0-9]{64}$/.test(inputSha256)) throw new PassageError('budget_exhausted')
      try { exclusive(path.join(directory, `attempt-${String(attempt).padStart(3, '0')}.json`), JSON.stringify({ attempt, policy_sha256: policySha, stage, input_sha256: inputSha256, reserved_usd: 1, started_at: new Date().toISOString() })) }
      catch { throw new PassageError('budget_exhausted') }
      return attempt
    },
  }
}
