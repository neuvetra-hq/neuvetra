import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  M78_CONTINUATION4_PATHS as P,
  m78Continuation4NoPoolFetch,
  m78Continuation4PauseFetch,
  parseM78Continuation4Input,
  runM78Continuation4,
} from "../../tools/staging/check-m78-continuation4";
import {
  M78_CONTINUATION3_PATHS as P3,
  m78Continuation3DiagnosticFetch,
} from "../../tools/staging/check-m78-continuation3";
import { M78_ACCEPTED_M77 } from "../../tools/staging/check-m78-continuation";

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");
const AUTH = "https://icockcoguyadhryzydvl.supabase.co";
const APP = "https://www.neuvetra.ai";
const digest = "a".repeat(64);

test("portable public adapter preserves request and response identity, disables pooling, and never retries", async () => {
  const signal = AbortSignal.timeout(30_000);
  const body = new Uint8Array([1, 2, 3]);
  const headers = new Headers({ "x-synthetic": "value" });
  const request = new Request(`${APP}/ready`);
  const response = new Response("unread");
  let calls = 0;
  let seenRaw: RequestInfo | URL | undefined;
  let seenInit: RequestInit | undefined;
  const wrapped = m78Continuation4NoPoolFetch(
    (async (raw: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      seenRaw = raw;
      seenInit = init;
      return response;
    }) as unknown as typeof fetch,
  );
  expect(
    await wrapped(request, {
      method: "POST",
      body,
      headers,
      signal,
      redirect: "error",
      keepalive: true,
    }),
  ).toBe(response);
  expect(calls).toBe(1);
  expect(seenRaw).toBe(request);
  expect(seenInit).toMatchObject({
    method: "POST",
    body,
    headers,
    signal,
    redirect: "error",
    keepalive: false,
  });
  expect(response.bodyUsed).toBeFalse();

  const failing = m78Continuation4NoPoolFetch(
    (async () => {
      calls += 1;
      throw new DOMException("bounded", "TimeoutError");
    }) as unknown as typeof fetch,
  );
  await expect(failing(`${APP}/ready`, { signal })).rejects.toThrow();
  expect(calls).toBe(2);
});

test("portable stop and diagnostic layers keep one no-pool logout available without reading bodies", async () => {
  let stopped = true;
  let calls = 0;
  const response = new Response("unread");
  const base = m78Continuation4NoPoolFetch(
    (async (_raw: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      expect(init?.keepalive).toBeFalse();
      return response;
    }) as unknown as typeof fetch,
  );
  const paused = m78Continuation4PauseFetch(base, {
    read: async () => (stopped ? "" : null),
  });
  const events: Array<{ kind: string; data: unknown }> = [];
  const observed = m78Continuation3DiagnosticFetch(paused.fetch, async (kind, data) => {
    events.push({ kind, data });
  });
  await expect(observed.fetch(`${APP}/ready`)).rejects.toThrow();
  stopped = false;
  await expect(observed.fetch(`${APP}/ready`)).rejects.toThrow();
  expect(
    await observed.fetch(`${AUTH}/auth/v1/logout?scope=local`, { method: "POST" }),
  ).toBe(response);
  expect(calls).toBe(1);
  expect(response.bodyUsed).toBeFalse();
  expect(events.map((event) => event.kind)).toEqual([
    "request_intent",
    "request_error",
    "request_intent",
    "request_error",
    "request_intent",
    "response_headers",
  ]);
});

async function localFixture() {
  const files = new Map<string, string>();
  const [interruptedMain, interruptedDiagnostics, failedMain, failedDiagnostics, failedReview] =
    await Promise.all([
      readFile("tools/staging/m78-continuation3-interrupted-main.jsonl", "utf8"),
      readFile("tools/staging/m78-continuation3-interrupted-diagnostics.jsonl", "utf8"),
      readFile(P.failedMain, "utf8"),
      readFile(P.failedDiagnostics, "utf8"),
      readFile(P.failedReview, "utf8"),
    ]);
  files.set(P3.interrupted, interruptedMain);
  files.set(P3.interruptedDiagnostics, interruptedDiagnostics);
  files.set(P.actualFailedMain, failedMain);
  files.set(P.actualFailedDiagnostics, failedDiagnostics);
  files.set(P.failedMain, failedMain);
  files.set(P.failedDiagnostics, failedDiagnostics);
  files.set(P.failedReview, failedReview);

  const receiptText = await readFile(P3.disposition, "utf8");
  const receipt = JSON.parse(receiptText) as {
    evidencePins: Array<{ path: string; sha256: string }>;
  };
  for (const pin of receipt.evidencePins) files.set(pin.path, await readFile(pin.path, "utf8"));
  files.set(P3.disposition, receiptText);
  const input = parseM78Continuation4Input({
    mode: "baseline",
    acceptedM77: M78_ACCEPTED_M77,
    gate: {
      status: "m78_continuation_candidate_reviewed",
      migrationSha256: sha(
        await readFile("packages/neuvetra-database/src/migrations/0021_scope1_inventory.sql"),
      ),
      recipeSha256: sha(await readFile("tools/staging/m78-continuation-plan.ts")),
      harnessSha256: sha(await readFile("tools/staging/check-m78-continuation.ts")),
      independentReviewSha256: digest,
      operatorRecoveryReceiptSha256: digest,
      reviewedApplicationCommit: "b".repeat(40),
      expectedApplicationPosts: 37,
    },
    env: { SUPABASE_URL: AUTH, SUPABASE_ANON_KEY: `sb_publishable_${"a".repeat(30)}` },
    roster: { workspaceId: "8b90c706-1710-494d-b12d-02eef88eacb7" },
    accounts: ["manager1", "manager2", "member", "outsider"].map((role, index) => ({
      role,
      id: `78000000-0000-4000-8000-00000000000${index}`,
      email: `${role}@synthetic.invalid`,
      password: "synthetic-only",
    })),
    interruptionDisposition: { path: P3.disposition, sha256: sha(receiptText) },
  });
  return {
    files,
    input,
    io: {
      read: async (path: string) => files.get(path) ?? null,
      append: async (path: string, line: string, exclusive: boolean) => {
        expect([P.journal, P.diagnostics]).toContain(path as never);
        expect(exclusive).toBe(!files.has(path));
        files.set(path, (files.get(path) ?? "") + line);
      },
    },
  };
}

test("local-only composed stop after three logins closes all three sessions through no-pool transport", async () => {
  const fixture = await localFixture();
  const before = new Map(fixture.files);
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let login = 0;
  let logout = 0;
  let applicationPosts = 0;
  const transport = (async (raw: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(raw);
    calls.push({ url, init });
    expect(init.keepalive).toBeFalse();
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("error");
    if (url === `${APP}/ready`) {
      return Response.json({
        status: "ready",
        schemaVersion: 21,
        profile: "neuvetra.private-synthetic-staging.v1",
        legacyContainmentVerified: true,
      });
    }
    if (url === `${APP}/workspace-api/config`) {
      return Response.json(
        {
          profile: "neuvetra.private-synthetic-staging.v1",
          supabaseUrl: AUTH,
          anonKey: fixture.input.env.SUPABASE_ANON_KEY,
        },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (url === `${AUTH}/auth/v1/token?grant_type=password`) {
      const account = fixture.input.accounts[login++]!;
      if (login === 3) fixture.files.set(P.stop, "");
      return Response.json({ access_token: `synthetic-qa4-token-${login}`, user: { id: account.id } });
    }
    if (url === `${AUTH}/auth/v1/logout?scope=local`) {
      logout += 1;
      return new Response(null, { status: 204 });
    }
    if (init.method === "POST") applicationPosts += 1;
    throw new Error(`unexpected transport ${url}`);
  }) as typeof fetch;

  const result = await runM78Continuation4(fixture.input, {
    io: fixture.io,
    fetch: transport,
  });
  const main = fixture.files
    .get(P.journal)!
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  const diagnostics = fixture.files
    .get(P.diagnostics)!
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));

  expect(result).toMatchObject({
    status: "failed",
    paused: true,
    applicationPostRequests: 0,
    allCreatedAuthSessionsClosed: true,
  });
  expect([login, logout, applicationPosts]).toEqual([3, 3, 0]);
  expect(calls).toHaveLength(8);
  expect(calls.every((call) => call.init.keepalive === false)).toBeTrue();
  expect(main.at(-1)?.kind).toBe("attempt_finished");
  expect(main.at(-1)?.data.unknownAuthSessions).toBe(0);
  expect(diagnostics.at(-1)?.data).toMatchObject({
    status: "failed",
    paused: true,
    applicationPostRequests: 0,
    allCreatedAuthSessionsClosed: true,
  });
  expect(diagnostics[0]?.data.transport).toEqual({
    runtime: "bun-fetch",
    pooling: "disabled",
    keepalive: false,
    retries: 0,
  });
  expect(JSON.stringify(diagnostics)).not.toContain("synthetic-qa4-token");
  for (const [path, bytes] of before) expect(fixture.files.get(path), path).toBe(bytes);
});
