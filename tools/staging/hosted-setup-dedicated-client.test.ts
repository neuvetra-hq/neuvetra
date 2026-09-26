import { afterAll, describe, expect, test } from "bun:test"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { mkdtemp, readFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { Client as PgClient } from "../../packages/neuvetra-database/node_modules/@types/pg"
import {
  createHostedSetupDedicatedClient,
  type WorkspaceSql,
} from "./hosted-setup-dedicated-client"

const { Client } = createRequire(new URL("../../packages/neuvetra-database/package.json", import.meta.url))("pg") as {
  Client: typeof PgClient
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

test("refuses implicit credentials, URL options, remote plaintext, invalid CA, and unsafe timeout bounds", async () => {
  const invalid = [
    { connectionString: "postgresql://postgres@db.invalid.example/postgres", target: { kind: "synthetic-loopback" as const } },
    { connectionString: " postgresql://postgres@127.0.0.1/postgres", target: { kind: "synthetic-loopback" as const } },
    { connectionString: "postgresql://postgres@127.0.0.1/postgres?sslmode=disable", target: { kind: "synthetic-loopback" as const } },
    { connectionString: "postgresql://postgres@127.0.0.1/postgres", target: { kind: "synthetic-loopback" as const }, transactionTimeoutMs: 99 },
    {
      connectionString: "postgresql://postgres.icockcoguyadhryzydvl:secret@aws-1-us-west-1.pooler.supabase.com:5432/postgres",
      target: { kind: "hosted-supabase" as const, expectedProjectRef: "icockcoguyadhryzydvl", caPem: "not a certificate" },
    },
    {
      connectionString: "postgresql://postgres.wrongwrongwrongwrong:secret@aws-1-us-west-1.pooler.supabase.com:5432/postgres",
      target: { kind: "hosted-supabase" as const, expectedProjectRef: "icockcoguyadhryzydvl", caPem: "not a certificate" },
    },
  ]
  for (const options of invalid) {
    await expect(createHostedSetupDedicatedClient(options)).rejects.toMatchObject({
      code: "HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED",
      message: "HOSTED_SETUP_CLIENT_CONFIGURATION_REFUSED",
    })
  }
})

const nativeBin = process.env.NEUVETRA_PG17_BIN ?? "C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin"
const native = process.env.HOSTED_SETUP_DEDICATED_CLIENT_NATIVE === "1" || await Bun.file(join(nativeBin, "postgres.exe")).exists()
const nativeProcesses: Array<() => Promise<void>> = []

afterAll(async () => {
  for (const close of nativeProcesses.reverse()) await close()
})

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("dynamic loopback port unavailable")
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return address.port
}

async function command(args: string[]): Promise<void> {
  const child = Bun.spawn(args, { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
  if (await child.exited !== 0) throw new Error(`native fixture command failed: ${args[0]}`)
}

describe.skipIf(!native)("single-use pg.Client against disposable PostgreSQL 17", () => {
  test("serializes one physical transaction, drains unawaited SQL, revokes late callbacks, and exits cleanly after server timeout", async () => {
    const root = await mkdtemp(join(tmpdir(), "hosted-setup-pg-client-"))
    const data = join(root, "data")
    const log = join(root, "postgres.log")
    const initdb = join(nativeBin, "initdb.exe")
    const pgCtl = join(nativeBin, "pg_ctl.exe")
    const postgres = join(nativeBin, "postgres.exe")
    if (!await Bun.file(initdb).exists() || !await Bun.file(pgCtl).exists() || !await Bun.file(postgres).exists()) {
      throw new Error("pinned PostgreSQL 17 toolset unavailable")
    }
    const version = Bun.spawnSync([postgres, "--version"], { stdout: "pipe", stderr: "pipe" })
    expect(new TextDecoder().decode(version.stdout)).toContain("PostgreSQL) 17.")
    const port = await freePort()
    expect(port).not.toBe(55479)
    await command([initdb, "-D", data, "-U", "postgres", "--auth=trust", "--no-locale", "--encoding=UTF8"])
    await command([pgCtl, "-D", data, "-l", log, "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"])
    let stopped = false
    const stop = async () => {
      if (stopped) return
      stopped = true
      const child = Bun.spawn([pgCtl, "-D", data, "-m", "fast", "-w", "stop"], { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
      expect(await child.exited).toBe(0)
    }
    nativeProcesses.push(stop)

    const url = `postgresql://postgres@127.0.0.1:${port}/postgres`
    const observer = new Client({ host: "127.0.0.1", port, database: "postgres", user: "postgres", application_name: "dedicated-client-observer" })
    observer.on("error", () => undefined)
    await observer.connect()
    try {
      await observer.query("create table adapter_probe(id integer primary key,payload bytea,numeric_text numeric(30,10),instant timestamptz,tags text[])")
      const applicationName = "dedicated-client-normal"
      const db = await createHostedSetupDedicatedClient({
        connectionString: url,
        target: { kind: "synthetic-loopback" },
        transactionTimeoutMs: 4_000,
        localDeadlineGraceMs: 800,
        teardownTimeoutMs: 1_000,
        applicationName,
      })
      await expect(db.query("select 1; select 2")).rejects.toMatchObject({ code: "HOSTED_SETUP_CLIENT_MULTI_RESULT_REFUSED" })
      const preflight = await db.query<{ timeout_ms: string }>("select (extract(epoch from current_setting('transaction_timeout')::interval)*1000)::bigint::text timeout_ms")
      expect(preflight.rows).toEqual([{ timeout_ms: "4000" }])
      let retained!: WorkspaceSql
      const transactionResult = await db.transaction(async tx => {
        retained = tx
        const identity = await tx.query<{ pid: number; xid: string }>("select pg_backend_pid() pid,txid_current()::text xid")
        await tx.exec("create temp table exec_batch_probe(value integer); insert into exec_batch_probe values(1)")
        const sameSession = await tx.query<{ pid: number; xid: string; rows: string }>("select pg_backend_pid() pid,txid_current()::text xid,(select count(*)::text from exec_batch_probe) rows")
        expect(sameSession.rows).toEqual([{ ...identity.rows[0]!, rows: "1" }])
        await expect(db.query("select 1")).rejects.toMatchObject({ code: "HOSTED_SETUP_CLIENT_TRANSACTION_BUSY" })
        await expect(db.transaction(async () => undefined)).rejects.toMatchObject({ code: "HOSTED_SETUP_CLIENT_TRANSACTION_BUSY" })
        void tx.query(
          "insert into adapter_probe(id,payload,numeric_text,instant,tags) values($1,$2,$3,$4,$5)",
          [1, new Uint8Array([0, 127, 255]), "12345678901234567890.1234567890", "2026-09-26T12:34:56.789Z", ["scope1", "scope2"]],
        )
        return identity.rows[0]
      })
      expect(transactionResult?.pid).toBeInteger()
      const stored = await observer.query<{ pid_count: string; payload: string; numeric_text: string; instant: string; tags: string[] }>(
        "select (select count(distinct pid)::text from pg_stat_activity where application_name=$1) pid_count,encode(payload,'hex') payload,numeric_text::text,to_char(instant at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') instant,tags from adapter_probe where id=1",
        [applicationName],
      )
      expect(stored.rows).toHaveLength(1)
      expect(stored.rows[0]?.pid_count).toBe("0")
      expect(stored.rows[0]?.payload).toBe("007fff")
      expect(stored.rows[0]?.numeric_text).toBe("12345678901234567890.1234567890")
      expect(stored.rows[0]?.tags).toEqual(["scope1", "scope2"])
      expect(stored.rows[0]?.instant).toBe("2026-09-26T12:34:56.789Z")
      await expect(retained.query("select 1")).rejects.toMatchObject({ code: "HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED" })
      await expect(db.query("select 1")).rejects.toMatchObject({ code: "HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED" })
      await db.close()
      await db.close()
      const timeoutName = "dedicated-client-server-timeout"
      const child = Bun.spawn([process.execPath, join(import.meta.dir, "hosted-setup-dedicated-client.native.ts"), url], {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      })
      const childOutcome = await Promise.race([
        child.exited.then(code => ({ code, timedOut: false })),
        sleep(8_000).then(() => ({ code: -1, timedOut: true })),
      ])
      if (childOutcome.timedOut) child.kill()
      const childStdout = await new Response(child.stdout).text()
      const childStderr = await new Response(child.stderr).text()
      expect({ ...childOutcome, stderr: childStderr }).toEqual({ code: 0, timedOut: false, stderr: "" })
      expect(JSON.parse(childStdout.trim())).toEqual({
        status: "forced_server_timeout_refused",
        code: "HOSTED_SETUP_CLIENT_CONNECTION_TERMINATED",
        sqlState: "25P04",
        lateCode: "HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED",
        retainedCode: "HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED",
      })
      await sleep(50)
      const rolledBack = await observer.query<{ rows: string; sessions: string; locks: string }>(
        "select (select count(*)::text from adapter_probe where id in (2,3,4)) rows,(select count(*)::text from pg_stat_activity where application_name=$1) sessions,(select count(*)::text from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name=$1) locks",
        [timeoutName],
      )
      expect(rolledBack.rows).toEqual([{ rows: "0", sessions: "0", locks: "0" }])
      expect(await readFile(log, "utf8")).toContain("terminating connection due to transaction timeout")
    } finally {
      await observer.end().catch(() => undefined)
      await stop()
      console.log(`Dedicated pg.Client native fixture: PostgreSQL 17; loopback port ${port}; retained ${root}`)
    }
  }, 30_000)
})
