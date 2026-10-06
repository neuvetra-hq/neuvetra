import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { createPostgresConnection, HostedWorkspaceDatabase, STAGING_SCHEMA_VERSION } from "./hosted"
import { migratePrivateStaging, provisionStagingRoster } from "./staging-migrations"
import { createSyntheticCompanySetup } from "./company-setup-fixture"
import { saveCompanySetup } from "./company-setup"
import type { WorkspaceConnection, WorkspaceSql } from "./workspace"

// Opt-in only: this named disposable database must be freshly created by the
// operator. Never accepts a provider or retained project database.
const urlText = process.env.SHARED_ADAPTER_TEST_DATABASE_URL
if (urlText) {
  const url = new URL(urlText)
  if (url.hostname !== "127.0.0.1" || url.username !== "m63_test_admin" || url.pathname !== "/shared_adapter_native" || !url.port || url.port === "55479" || url.search || url.hash) throw new Error("Disposable shared adapter loopback target required.")
}
const native = urlText ? describe : describe.skip
const ref = "abcdefghijklmnopqrst"
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
async function rejected(promise: Promise<unknown>): Promise<any> { const result = await promise.then(() => ({ ok: true as const }), error => ({ ok: false as const, error })); if (result.ok) throw new Error("Expected rejection"); return result.error }
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve }); return { promise, release } }
const request = () => ({ idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup: createSyntheticCompanySetup() })
const construct = (db: WorkspaceConnection) => new (HostedWorkspaceDatabase as unknown as new(db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(db, ref)
const asUser = <T>(db: HostedWorkspaceDatabase, actor: string, fn: (tx: WorkspaceSql) => Promise<T>): Promise<T> => (db as unknown as { asUser(actor: string, fn: (tx: WorkspaceSql) => Promise<T>): Promise<T> }).asUser(actor, fn)

native("shared pg adapter actual PG17/RLS lifecycle", () => {
  let operator: WorkspaceConnection
  let runtimeUrl: string
  beforeAll(async () => {
    operator = createPostgresConnection(urlText!, { tls: false, maxConnections: 2 })
    const version = Number((await operator.query<{version: string}>("select current_setting('server_version_num') version")).rows[0]!.version)
    expect(version).toBeGreaterThanOrEqual(170000); expect(version).toBeLessThan(180000)
    await operator.exec(`create role authenticated nologin; create role anon nologin;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
    await operator.exec(`create schema if not exists storage;
      create table if not exists storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
      create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated,anon; grant select,insert,update,delete on storage.objects to authenticated,anon;`)
    await migratePrivateStaging(operator, { expectedProjectRef: ref, syntheticTargetConfirmed: true })
    await operator.exec("alter role neuvetra_runtime login")
    const url = new URL(urlText!); url.username = "neuvetra_runtime"; runtimeUrl = url.toString()
  }, 30000)
  afterAll(async () => { await operator?.close() })

  for (const maxConnections of [1, 3]) {
    test(`two tenants retain subject/RLS/commit ownership with pool size ${maxConnections}`, async () => {
      const actors = [crypto.randomUUID(), crypto.randomUUID()], companies = [crypto.randomUUID(), crypto.randomUUID()]
      const outsider = crypto.randomUUID()
      await operator.query("insert into auth.users values($1),($2),($3)", [...actors, outsider])
      for (let i=0; i<2; i++) await provisionStagingRoster(operator, { expectedProjectRef: ref, workspaceId: companies[i]!, ownerUserId: actors[i]!, members: [] })
      const runtime = createPostgresConnection(runtimeUrl, { tls: false, maxConnections })
      const db = construct(runtime)
      try {
        expect((await db.checkReadiness()).schemaVersion).toBe(STAGING_SCHEMA_VERSION)
        const saves = await Promise.all(actors.map((actor,i) => db.saveCompanySetup(actor,companies[i]!,request())))
        expect(saves.map(x => x.savedVersion.revision)).toEqual([1,1])
        await Promise.all(Array.from({length: 36}, async (_, n) => {
          const i = n % 2, actor = actors[i]!, own = companies[i]!, other = companies[1-i]!
          await asUser(db, actor, async tx => {
            const before = (await tx.query<{subject:string;pid:number;xid:string}>("select current_setting('request.jwt.claim.sub') subject,pg_backend_pid() pid,pg_current_xact_id()::text xid")).rows[0]!
            expect(before.subject).toBe(actor)
            await tx.query("select pg_sleep(0.003)")
            const visible = (await tx.query<{id:string}>("select id from neuvetra.companies order by id")).rows.map(r=>r.id)
            expect(visible).toEqual([own])
            expect((await tx.query("select * from neuvetra.company_setup_versions where company_id=$1",[other])).rows).toHaveLength(0)
            const after = (await tx.query<typeof before>("select current_setting('request.jwt.claim.sub') subject,pg_backend_pid() pid,pg_current_xact_id()::text xid")).rows[0]!
            expect(after).toEqual(before)
          })
          if (n % 6 === 0) { const refused = await db.saveCompanySetup(actor, other, request()).then(() => null, error => error); expect(refused?.code).toBe("42501") }
          if (n % 5 === 0) { const refused = await db.findStagingMembershipForUser(outsider).then(() => null, error => error); expect(refused?.message).toContain("Private staging access") }
        }))
        const held = gate(), entered = gate()
        let retained!: WorkspaceSql, txPid = 0, rootFinished = false
        const transaction = asUser(db, actors[0]!, async tx => {
          retained = tx
          txPid = (await tx.query<{pid:number}>("select pg_backend_pid() pid")).rows[0]!.pid
          entered.release(); await held.promise
        })
        await entered.promise
        const rootRead = runtime.query<{pid:number;subject:string|null;role:string}>("select pg_backend_pid() pid,nullif(current_setting('request.jwt.claim.sub',true),'') subject,current_user role").then(result=>{rootFinished=true;return result})
        await pause(40)
        expect(rootFinished).toBe(maxConnections > 1)
        held.release(); await transaction
        const root = (await rootRead).rows[0]!
        expect(root.subject).toBeNull(); expect(root.role).toBe("neuvetra_runtime")
        if(maxConnections > 1) expect(root.pid).not.toBe(txPid)
        expect((await rejected(retained.query("select 1"))).message).toContain("expired")
        expect((await rejected(retained.exec("select 1"))).message).toContain("expired")
        // A rolled-back valid tenant write cannot undo another caller's commit.
        const corrections = saves.map(save=>({ ...request(), expectedRevision:1, expectedVersionId:save.savedVersion.id, correctionReason:"Synthetic adapter correction" }))
        const outcomes = await Promise.allSettled([
          asUser(db, actors[0]!, async tx=> { await saveCompanySetup(tx,actors[0]!,companies[0]!,corrections[0]); throw new Error("deliberate rollback") }),
          db.saveCompanySetup(actors[1]!,companies[1]!,corrections[1]),
        ])
        expect(outcomes[0]!.status).toBe("rejected"); expect(outcomes[1]!.status).toBe("fulfilled")
        const counts = (await operator.query<{company_id:string;count:string}>("select company_id,count(*)::text count from neuvetra.company_setup_versions where company_id=any($1::uuid[]) group by company_id",[companies])).rows
        expect(counts.find(x=>x.company_id===companies[0])?.count).toBe("1")
        expect(counts.find(x=>x.company_id===companies[1])?.count).toBe("2")
      } finally { await db.close() }
    },30000)
  }

  for (const maxConnections of [1, 3]) {
    test(`fatal tenant A transaction cannot leak its subject or undo tenant B with pool size ${maxConnections}`, async () => {
      const actors=[crypto.randomUUID(),crypto.randomUUID()],companies=[crypto.randomUUID(),crypto.randomUUID()]
      await operator.query("insert into auth.users values($1),($2)",actors)
      for(let i=0;i<2;i++) await provisionStagingRoster(operator,{expectedProjectRef:ref,workspaceId:companies[i]!,ownerUserId:actors[i]!,members:[]})
      const runtime=createPostgresConnection(runtimeUrl,{tls:false,maxConnections}),db=construct(runtime),entered=gate(),finish=gate()
      let pid=0,retained!:WorkspaceSql,lateRejected=false
      try {
        const a=asUser(db,actors[0]!,async tx=>{
          retained=tx
          pid=(await tx.query<{pid:number}>("select pg_backend_pid() pid")).rows[0]!.pid
          await saveCompanySetup(tx,actors[0]!,companies[0]!,request())
          entered.release();await finish.promise
          try {await tx.query("select 1")}catch{lateRejected=true}
        }).then(()=>"unexpected success",()=>"failed")
        await entered.promise
        const b=db.saveCompanySetup(actors[1]!,companies[1]!,request())
        await operator.query("select pg_terminate_backend($1)",[pid])
        expect(await a).toBe("failed");expect((await b).savedVersion.revision).toBe(1)
        finish.release();await pause(20);expect(lateRejected).toBe(true)
        expect((await rejected(retained.exec("select 1"))).message).toContain("expired")
        expect((await operator.query("select * from neuvetra.company_setup_versions where company_id=$1",[companies[0]])).rows).toHaveLength(0)
        await asUser(db,actors[1]!,async tx=>{
          expect((await tx.query<{subject:string}>("select current_setting('request.jwt.claim.sub') subject")).rows[0]!.subject).toBe(actors[1]!)
          expect((await tx.query<{id:string}>("select id from neuvetra.companies")).rows.map(r=>r.id)).toEqual([companies[1]!])
        })
        expect((await runtime.query<{subject:string|null}>("select nullif(current_setting('request.jwt.claim.sub',true),'') subject")).rows[0]!.subject).toBeNull()
      }finally{finish.release();await db.close()}
    },10000)
  }

  test("callback rollback promise settles before close under a bounded clock",async()=>{
    const db=createPostgresConnection(urlText!,{tls:false,maxConnections:1})
    try{
      const start=performance.now()
      const outcome=await Promise.race([db.transaction(async tx=>{await tx.query("select 1");throw new Error("direct callback rollback")}).then(()=>"unexpected success",error=>error.message),pause(1000).then(()=>"deadline")])
      expect(outcome).toBe("direct callback rollback");expect(performance.now()-start).toBeLessThan(1000)
      expect((await db.query<{n:number}>("select 1 n")).rows[0]!.n).toBe(1)
    }finally{await db.close()}
  })
  test("parameters, decimal/bigint/date/timestamp/bytea/JSON and multistatement contract", async()=> {
    const bytes = new Uint8Array([0,255,128,10])
    const row = (await operator.query<any>("select $1::bytea bytes,$2::jsonb json,$3::numeric decimal,$4::bigint large,$5::text[] labels,$6::date calendar_date,$7::timestamptz instant",[bytes,{nested:[true,null,"x"]},"12345678901234567890.123456789","9007199254740993",["x","a,b",null],"2026-09-26","2026-09-26T12:00:00.123Z"])).rows[0]
    expect(Buffer.from(row.bytes)).toEqual(Buffer.from(bytes)); expect(row.json).toEqual({nested:[true,null,"x"]})
    expect(row.decimal).toBe("12345678901234567890.123456789"); expect(row.large).toBe("9007199254740993")
    expect(row.labels).toEqual(["x","a,b",null]); expect(row.calendar_date).toBe("2026-09-26"); expect(row.instant.toISOString()).toBe("2026-09-26T12:00:00.123Z")
    expect((await rejected(operator.query("select 1; select 2"))).message).toContain("Multiple SQL results")
    await operator.exec("select 1; select 2")
    expect(()=>createPostgresConnection(urlText!+"?sslmode=disable")).toThrow("TLS overrides")
  })

  test("queued unawaited work drains before commit; caught SQL failure still rolls back", async()=> {
    await operator.exec("create table public.adapter_sentinel(value text primary key)")
    await operator.transaction(async tx => { void tx.query("insert into public.adapter_sentinel values('drained') returning pg_sleep(0.05)") })
    expect((await operator.query("select * from public.adapter_sentinel")).rows).toEqual([{value:"drained"}])
    let retained!: WorkspaceSql
    const caught = await rejected(operator.transaction(async tx=> {
      retained=tx
      await tx.query("insert into public.adapter_sentinel values('rolled-back')")
      try { await tx.query("select 1/0") } catch {}
    })); expect(caught.code).toBe("22012")
    expect((await operator.query("select * from public.adapter_sentinel where value='rolled-back'")).rows).toEqual([])
    expect((await rejected(retained.query("select 1"))).message).toContain("expired")
  })

  for(const kind of ["terminate-idle","terminate-query","transaction-timeout"] as const) {
    test(`${kind} revokes late callback, destroys failed client, releases pool capacity`, async()=> {
      const db = createPostgresConnection(urlText!,{tls:false,maxConnections:1})
      const entered=gate(), finish=gate()
      let retained!:WorkspaceSql, pid=0, lateRejected=false
      try {
        if(kind==="transaction-timeout") await db.exec("set transaction_timeout='150ms'")
        const failed = db.transaction(async tx=> {
          retained=tx
          pid=(await tx.query<{pid:number}>("select pg_backend_pid() pid")).rows[0]!.pid
          await tx.query("insert into public.adapter_sentinel values($1)",[kind])
          entered.release()
          if(kind==="terminate-query") await tx.query("select pg_sleep(10)")
          await finish.promise
          try { await tx.exec("insert into public.adapter_sentinel values('late-write')") } catch {lateRejected=true}
        })
        const settled = failed.then(()=>"unexpected success",()=>"failed")
        await entered.promise
        if(kind!=="transaction-timeout") await operator.query("select pg_terminate_backend($1)",[pid])
        expect(await Promise.race([settled,pause(2500).then(()=>"hung")])).toBe("failed")
        expect((await rejected(retained.query("select 1"))).message).toContain("expired")
        const next=(await db.query<{pid:number;subject:string|null}>("select pg_backend_pid() pid,nullif(current_setting('request.jwt.claim.sub',true),'') subject")).rows[0]!
        expect(next.pid).not.toBe(pid);expect(next.subject).toBeNull()
        finish.release();await pause(30)
        if(kind!=="terminate-query") expect(lateRejected).toBe(true)
        expect((await operator.query("select * from public.adapter_sentinel where value=any($1::text[])",[[kind,"late-write"]])).rows).toEqual([])
      } finally {finish.release();await db.close()}
    },5000)
  }

  test("close revokes a never-settling callback and rejects future SQL",async()=> {
    const db = createPostgresConnection(urlText!,{tls:false,maxConnections:1}),entered=gate()
    let tx!:WorkspaceSql
    const outcome=db.transaction(async scoped=>{tx=scoped;await scoped.query("select 1");entered.release();await new Promise(()=>{})}).then(()=>"unexpected success",()=>"closed")
    await entered.promise
    await db.close();expect(await outcome).toBe("closed")
    expect((await rejected(tx.query("select 1"))).message).toContain("expired")
    expect((await rejected(db.query("select 1"))).message).toContain("closed")
    await db.close()
  })
})