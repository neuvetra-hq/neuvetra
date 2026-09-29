/** Single-use, non-pooled PostgreSQL 17 client for the hosted schema-22 -> 23 transaction. */
import { createRequire } from "node:module"
import type { Client as PgClient, ClientConfig, QueryResult, QueryResultRow } from "../../packages/neuvetra-database/node_modules/@types/pg"
import { validateDatabaseCaPem } from "../../packages/neuvetra-database/src/staging-tls"
import type { WorkspaceConnection, WorkspaceSql } from "../../packages/neuvetra-database/src/workspace"

export type { WorkspaceConnection, WorkspaceSql } from "../../packages/neuvetra-database/src/workspace"

const { Client } = createRequire(new URL("../../packages/neuvetra-database/package.json", import.meta.url))("pg") as {
  Client: typeof PgClient
}

export type HostedSetupDedicatedClientTarget =
  | Readonly<{ kind: "hosted-supabase"; expectedProjectRef: string; caPem: string }>
  | Readonly<{ kind: "synthetic-loopback" }>

export interface HostedSetupDedicatedClientOptions {
  connectionString: string
  target: HostedSetupDedicatedClientTarget
  connectionTimeoutMs?: number
  transactionTimeoutMs?: number
  localDeadlineGraceMs?: number
  teardownTimeoutMs?: number
  applicationName?: string
}

export const HOSTED_SETUP_DEDICATED_CLIENT_PROFILE = "neuvetra.hosted-setup.dedicated-pg-client.v1" as const
export const HOSTED_SETUP_DEDICATED_CLIENT_DEFAULTS = Object.freeze({
  connectionTimeoutMs: 15_000,
  transactionTimeoutMs: 180_000,
  localDeadlineGraceMs: 2_000,
  teardownTimeoutMs: 5_000,
  applicationName: "neuvetra-hosted-setup-schema22-to-23",
})

type ErrorCode =
  | "HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED"
  | "HOSTED_SETUP_CLIENT_CONNECT_FAILED"
  | "HOSTED_SETUP_CLIENT_SERVER_REFUSED"
  | "HOSTED_SETUP_CLIENT_SERVER_CONFIGURATION_REFUSED"
  | "HOSTED_SETUP_CLIENT_QUERY_FAILED"
  | "HOSTED_SETUP_CLIENT_MULTI_RESULT_REFUSED"
  | "HOSTED_SETUP_CLIENT_TRANSACTION_BUSY"
  | "HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED"
  | "HOSTED_SETUP_CLIENT_TRANSACTION_DEADLINE"
  | "HOSTED_SETUP_CLIENT_CONNECTION_TERMINATED"
  | "HOSTED_SETUP_CLIENT_COMMIT_OUTCOME_UNCERTAIN_DO_NOT_RETRY"

/** Public messages never include statement text, parameter values, credentials, or driver messages. */
export class HostedSetupDedicatedClientError extends Error {
  readonly code: ErrorCode
  /** PostgreSQL SQLSTATE, when the server supplied one. */
  readonly sqlState?: string

  constructor(code: ErrorCode, sqlState?: string) {
    super(code)
    this.name = "HostedSetupDedicatedClientError"
    this.code = code
    if (sqlState) this.sqlState = sqlState
  }
}

type ParsedTarget = Readonly<{
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl: ClientConfig["ssl"]
}>

type PgErrorLike = Error & { code?: unknown; severity?: unknown }
type InternalClient = PgClient & { connection: PgClient["connection"] & { stream: { destroy(error?: Error): void } } }

function fail(code: ErrorCode, source?: unknown): HostedSetupDedicatedClientError {
  const candidate = source as PgErrorLike | undefined
  const sqlState = typeof candidate?.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code) ? candidate.code : undefined
  return new HostedSetupDedicatedClientError(code, sqlState)
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const candidate = value === undefined ? fallback : value
  if (!Number.isSafeInteger(candidate) || (candidate as number) < minimum || (candidate as number) > maximum) {
    throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  }
  return candidate as number
}

function decoded(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  }
}

function parseTarget(options: HostedSetupDedicatedClientOptions): ParsedTarget {
  const raw = options?.connectionString
  if (typeof raw !== "string" || raw !== raw.trim() || raw.length < 1 || raw.length > 4_096 || /[\u0000-\u001f\u007f]/.test(raw)) {
    throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.search || url.hash || !url.hostname || !url.username) {
    throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  }
  const user = decoded(url.username)
  const password = decoded(url.password)
  const database = decoded(url.pathname.slice(1))
  if (!user || !database || url.pathname !== `/${encodeURIComponent(database)}` || database.includes('/')) {
    throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  }
  const port = url.port ? Number(url.port) : 5432
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")

  if (options.target?.kind === "synthetic-loopback") {
    const host = url.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
    return Object.freeze({ host, port, database, user, password, ssl: false })
  }

  if (options.target?.kind !== "hosted-supabase") throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  const ref = options.target.expectedProjectRef
  if (typeof ref !== "string" || !/^[a-z0-9]{20}$/.test(ref) || !password || database !== "postgres") {
    throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  }
  const host = url.hostname.toLowerCase()
  const direct = host === `db.${ref}.supabase.co` && user === "postgres" && port === 5432
  const transactionPooler = host === "aws-1-us-west-1.pooler.supabase.com" && user === `postgres.${ref}` && port === 5432
  if (!direct && !transactionPooler) throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  let ca: string
  try {
    ca = validateDatabaseCaPem(options.target.caPem)
  } catch {
    throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  }
  return Object.freeze({ host, port, database, user, password, ssl: Object.freeze({ rejectUnauthorized: true, ca }) })
}

function sqlText(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 8_000_000 || value.includes('\0')) {
    throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  }
  return value
}

function queryText(value: unknown): string {
  const text = sqlText(value)
  // This maintenance query surface is deliberately single-statement. The
  // migration batch belongs on exec(), whose result is never interpreted.
  if (text.includes(';')) throw fail("HOSTED_SETUP_CLIENT_MULTI_RESULT_REFUSED")
  return text
}

function parameters(values: unknown[] | undefined): unknown[] | undefined {
  if (values === undefined) return undefined
  if (!Array.isArray(values) || values.length > 100_000) throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  return values.map(value => value instanceof Uint8Array && !Buffer.isBuffer(value)
    ? Buffer.from(value.buffer, value.byteOffset, value.byteLength)
    : value)
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type Generation = {
  readonly id: number
  accepting: boolean
  revoked: boolean
  failure?: HostedSetupDedicatedClientError
  abort?: (reason: HostedSetupDedicatedClientError) => void
  readonly pending: Set<Promise<unknown>>
}

export async function createHostedSetupDedicatedClient(options: HostedSetupDedicatedClientOptions): Promise<WorkspaceConnection> {
  const target = parseTarget(options)
  const connectionTimeoutMs = boundedInteger(options.connectionTimeoutMs, HOSTED_SETUP_DEDICATED_CLIENT_DEFAULTS.connectionTimeoutMs, 100, 60_000)
  const transactionTimeoutMs = boundedInteger(options.transactionTimeoutMs, HOSTED_SETUP_DEDICATED_CLIENT_DEFAULTS.transactionTimeoutMs, 100, 900_000)
  const localDeadlineGraceMs = boundedInteger(options.localDeadlineGraceMs, HOSTED_SETUP_DEDICATED_CLIENT_DEFAULTS.localDeadlineGraceMs, 100, 30_000)
  const teardownTimeoutMs = boundedInteger(options.teardownTimeoutMs, HOSTED_SETUP_DEDICATED_CLIENT_DEFAULTS.teardownTimeoutMs, 100, 30_000)
  const applicationName = options.applicationName ?? HOSTED_SETUP_DEDICATED_CLIENT_DEFAULTS.applicationName
  if (typeof applicationName !== "string" || !/^[A-Za-z0-9_. -]{1,63}$/.test(applicationName)) {
    throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
  }

  const client = new Client({
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    password: target.password,
    ssl: target.ssl,
    application_name: applicationName,
    connectionTimeoutMillis: connectionTimeoutMs,
    keepAlive: true,
    keepAliveInitialDelayMillis: 1_000,
  }) as InternalClient

  let state: "connecting" | "ready" | "transaction" | "consumed" | "closing" | "closed" = "connecting"
  let fatal: HostedSetupDedicatedClientError | undefined
  let generation: Generation | undefined
  let serial = Promise.resolve()
  let closePromise: Promise<void> | undefined
  let generationId = 0

  const revoke = (reason?: HostedSetupDedicatedClientError) => {
    const current = generation
    if (current) {
      current.accepting = false
      current.revoked = true
      if (reason && !current.failure) current.failure = reason
      if (reason) current.abort?.(reason)
    }
  }
  const onError = (source: Error) => {
    if (state === "closing" || state === "closed") return
    fatal ??= fail("HOSTED_SETUP_CLIENT_CONNECTION_TERMINATED", source)
    revoke(fatal)
  }
  const onEnd = () => {
    if (state !== "closing" && state !== "closed") {
      fatal ??= fail("HOSTED_SETUP_CLIENT_CONNECTION_TERMINATED")
      revoke(fatal)
    }
  }
  client.on("error", onError)
  client.on("end", onEnd)

  const close = (): Promise<void> => {
    if (closePromise) return closePromise
    state = "closing"
    revoke(fatal ?? fail("HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED"))
    closePromise = (async () => {
      const ending = Promise.resolve().then(() => client.end()).catch(() => undefined)
      const completed = await Promise.race([ending.then(() => true), delay(teardownTimeoutMs).then(() => false)])
      if (!completed) {
        try { client.connection.stream.destroy() } catch { /* already gone */ }
        await Promise.race([ending, delay(Math.min(250, teardownTimeoutMs))])
      }
      client.off("error", onError)
      client.off("end", onEnd)
      state = "closed"
    })()
    return closePromise
  }

  const dispatch = <T>(operation: () => Promise<T>, guard: () => void): Promise<T> => {
    const result = serial.then(async () => {
      guard()
      try {
        return await operation()
      } catch (source) {
        const candidate = source as PgErrorLike
        if (candidate?.severity === "FATAL") {
          fatal ??= fail("HOSTED_SETUP_CLIENT_CONNECTION_TERMINATED", source)
          revoke(fatal)
          throw fatal
        }
        throw fail("HOSTED_SETUP_CLIENT_QUERY_FAILED", source)
      }
    })
    serial = result.then(() => undefined, () => undefined)
    return result
  }

  const raw = <T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) =>
    client.query<T>(sqlText(sql), parameters(params) as unknown[] | undefined) as Promise<QueryResult<T> | QueryResult<T>[]>

  try {
    await client.connect()
    const identity = await raw<{ server_version_num: string }>("select current_setting('server_version_num') server_version_num")
    if (Array.isArray(identity)) throw fail("HOSTED_SETUP_CLIENT_SERVER_REFUSED")
    const serverVersion = identity.rows[0]?.server_version_num
    if (identity.rows.length !== 1 || typeof serverVersion !== "string" || !/^\d+$/.test(serverVersion) || Number(serverVersion) < 170_000) {
      throw fail("HOSTED_SETUP_CLIENT_SERVER_REFUSED")
    }
    const configured = await raw<{ transaction_timeout: string }>(
      "select set_config('transaction_timeout',$1,false) transaction_timeout",
      [String(transactionTimeoutMs)],
    )
    const readback = await raw<{ milliseconds: string }>(
      "select (extract(epoch from current_setting('transaction_timeout')::interval)*1000)::bigint::text milliseconds",
    )
    if (Array.isArray(configured) || Array.isArray(readback) || readback.rows.length !== 1 || readback.rows[0]?.milliseconds !== String(transactionTimeoutMs)) {
      throw fail("HOSTED_SETUP_CLIENT_SERVER_CONFIGURATION_REFUSED")
    }
    state = "ready"
  } catch (source) {
    fatal ??= source instanceof HostedSetupDedicatedClientError ? source : fail("HOSTED_SETUP_CLIENT_CONNECT_FAILED", source)
    await close()
    throw fatal
  }

  const rootGuard = () => {
    if (fatal) throw fatal
    if (state === "transaction") throw fail("HOSTED_SETUP_CLIENT_TRANSACTION_BUSY")
    if (state !== "ready") throw fail("HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED")
  }

  const rootQuery = async <T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> => {
    const text = queryText(sql)
    const result = await dispatch(() => raw(text, params), rootGuard)
    if (Array.isArray(result)) throw fail("HOSTED_SETUP_CLIENT_MULTI_RESULT_REFUSED")
    return { rows: result.rows as T[] }
  }

  const rootExec = (sql: string): Promise<unknown> => dispatch(() => raw(sql), rootGuard)

  const transaction = async <T>(operation: (tx: WorkspaceSql) => Promise<T>): Promise<T> => {
    if (typeof operation !== "function") throw fail("HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED")
    rootGuard()
    state = "transaction"
    const current: Generation = { id: ++generationId, accepting: true, revoked: false, pending: new Set() }
    generation = current
    let began = false
    let commitSent = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let deadlineReject: ((reason: HostedSetupDedicatedClientError) => void) | undefined
    const deadline = new Promise<never>((_resolve, reject) => { deadlineReject = reject })
    deadline.catch(() => undefined)
    current.abort = deadlineReject
    timer = setTimeout(() => {
      const reason = fail("HOSTED_SETUP_CLIENT_TRANSACTION_DEADLINE")
      fatal ??= reason
      revoke(reason)
      deadlineReject?.(reason)
      void client.end().catch(() => undefined)
    }, transactionTimeoutMs + localDeadlineGraceMs)
    timer.unref?.()

    const txGuard = () => {
      if (fatal) throw fatal
      if (generation !== current || current.revoked || state !== "transaction") throw fail("HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED")
    }
    const track = <R>(promise: Promise<R>): Promise<R> => {
      current.pending.add(promise)
      promise.then(
        () => current.pending.delete(promise),
        source => {
          current.pending.delete(promise)
          current.failure ??= source instanceof HostedSetupDedicatedClientError ? source : fail("HOSTED_SETUP_CLIENT_QUERY_FAILED", source)
        },
      )
      promise.catch(() => undefined)
      return promise
    }
    const makeOperation = <R>(operation: () => Promise<R>): Promise<R> => {
      if (!current.accepting) return Promise.reject(fail("HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED"))
      return dispatch(operation, txGuard)
    }
    const tx = Object.freeze({
      query: <R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }> => track((async () => {
        const text = queryText(sql)
        const result = await makeOperation(() => raw(text, params))
        if (Array.isArray(result)) throw fail("HOSTED_SETUP_CLIENT_MULTI_RESULT_REFUSED")
        return { rows: result.rows as R[] }
      })()),
      exec: (sql: string): Promise<unknown> => track(makeOperation(() => raw(sql))),
    }) satisfies WorkspaceSql

    try {
      const begin = await Promise.race([dispatch(() => raw("begin isolation level read committed"), () => {
        if (fatal) throw fatal
        if (generation !== current || current.revoked || state !== "transaction") throw fail("HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED")
      }), deadline])
      if (Array.isArray(begin)) throw fail("HOSTED_SETUP_CLIENT_SERVER_CONFIGURATION_REFUSED")
      began = true
      const verified = await Promise.race([dispatch(() => raw<{ milliseconds: string; isolation: string; backend_pid: number }>(
        "select (extract(epoch from current_setting('transaction_timeout')::interval)*1000)::bigint::text milliseconds,current_setting('transaction_isolation') isolation,pg_backend_pid() backend_pid",
      ), txGuard), deadline])
      if (Array.isArray(verified) || verified.rows.length !== 1 || verified.rows[0]?.milliseconds !== String(transactionTimeoutMs) || verified.rows[0]?.isolation !== "read committed" || !Number.isInteger(verified.rows[0]?.backend_pid)) {
        throw fail("HOSTED_SETUP_CLIENT_SERVER_CONFIGURATION_REFUSED")
      }

      const callback = Promise.resolve().then(() => operation(tx))
      callback.catch(() => undefined)
      const value = await Promise.race([callback, deadline])
      current.accepting = false
      while (current.pending.size) await Promise.race([Promise.allSettled([...current.pending]), deadline])
      if (current.failure) throw current.failure
      txGuard()
      current.revoked = true
      commitSent = true
      const committed = await Promise.race([dispatch(() => raw("commit"), () => {
        if (fatal) throw fatal
        if (generation !== current || state !== "transaction") throw fail("HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED")
      }), deadline])
      if (Array.isArray(committed)) throw fail("HOSTED_SETUP_CLIENT_COMMIT_OUTCOME_UNCERTAIN_DO_NOT_RETRY")
      state = "consumed"
      await close()
      return value
    } catch (source) {
      current.accepting = false
      current.revoked = true
      const failure = source instanceof HostedSetupDedicatedClientError ? source : fail("HOSTED_SETUP_CLIENT_QUERY_FAILED", source)
      if (commitSent) {
        fatal = fail("HOSTED_SETUP_CLIENT_COMMIT_OUTCOME_UNCERTAIN_DO_NOT_RETRY", source)
      } else if (began && !fatal) {
        try { await dispatch(() => raw("rollback"), () => { if (fatal) throw fatal }) } catch { /* original failure remains authoritative */ }
      }
      state = "consumed"
      await close()
      throw fatal ?? failure
    } finally {
      if (timer) clearTimeout(timer)
      current.accepting = false
      current.revoked = true
    }
  }

  return Object.freeze({ query: rootQuery, exec: rootExec, transaction, close })
}
