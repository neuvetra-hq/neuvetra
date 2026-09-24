import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  verifyContinuation4Lifecycle,
  verifyLifecycleDiagnostics,
  type LifecycleAdmission,
} from "./m78-continuation4-lifecycle-independent-review";
import {
  M78_ACCEPTED_M77,
  M78_ACCEPTED_FAILURE,
  readM78ContinuationJournal,
  cleanM78ContinuationJournal,
  m78JournalEventLimit,
  m78VerifiedIdentity,
} from "../../tools/staging/check-m78-continuation";
import { m78CanonicalJson as canonical } from "../../packages/neuvetra-database/src/m78-validation";
import {
  verifyDiagnostics as verifyAcceptedBaselineDiagnostics,
  DISPOSITION_PIN,
} from "./m78-continuation4-baseline-independent-review";
import {
  M78_CONTINUATION4_PATHS,
  M78_CONTINUATION4_PRIOR_FAILURE,
} from "../../tools/staging/check-m78-continuation4";
import { M78_CONTINUATION3_INTERRUPTION } from "../../tools/staging/check-m78-continuation3";
import { verifyM78Continuation4BaselineAuthMethods } from "./m78-continuation4-lifecycle-qa-baseline-auth";

type AnyEvent = {
  sequence: number;
  previousSha256: string | null;
  profile: string;
  workspaceId?: string;
  mode: "baseline" | "exercise" | "revisit";
  kind: string;
  data: any;
  createdAt: string;
  sha256: string;
};

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");
const company = "8b90c706-1710-494d-b12d-02eef88eacb7";
const roles = ["manager1", "manager2", "member", "outsider"];
const gate = {
  status: "m78_continuation_candidate_reviewed",
  migrationSha256: "a".repeat(64),
  recipeSha256: "b".repeat(64),
  harnessSha256: "c".repeat(64),
  independentReviewSha256: "d".repeat(64),
  operatorRecoveryReceiptSha256: "e".repeat(64),
  reviewedApplicationCommit: "f".repeat(40),
  expectedApplicationPosts: 37,
};

function serialize(events: AnyEvent[]) {
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

function rehash(events: AnyEvent[]) {
  let previousSha256: string | null = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    event.sequence = index + 1;
    event.previousSha256 = previousSha256;
    const { sha256: _old, ...body } = event;
    event.sha256 = sha(canonical(body));
    previousSha256 = event.sha256;
  }
  return serialize(events);
}

function diagnosticFixture(
  full: boolean,
  windows?: Partial<Record<AnyEvent["mode"], { start: string; finish: string }>>,
) {
  const events: AnyEvent[] = [];
  const add = (mode: AnyEvent["mode"], kind: string, data: any) => {
    const body = {
      sequence: events.length + 1,
      previousSha256: events.at(-1)?.sha256 ?? null,
      profile: "m78-continuation4-diagnostic-v1",
      mode,
      kind,
      data,
      createdAt: new Date(Date.UTC(2026, 0, 1) + events.length * 1_000).toISOString(),
    };
    events.push({ ...body, sha256: sha(canonical(body)) });
  };
  for (const mode of (full ? ["baseline", "exercise", "revisit"] : ["baseline", "exercise"]) as AnyEvent["mode"][]) {
    add(mode, "phase_started", {
      transport: { runtime: "bun-fetch", pooling: "disabled", keepalive: false, retries: 0 },
    });
    let ordinal = 0;
    for (let index = 0; index < 16; index += 1) {
      add(mode, "request_intent", {
        ordinal: ++ordinal,
        method: "POST",
        route: index < 8 ? "auth:/auth/v1/token" : "auth:/auth/v1/logout",
      });
      add(mode, "response_headers", { ordinal, status: index < 8 ? 200 : 204, elapsedMs: 1 });
    }
    if (mode === "exercise") {
      for (let index = 0; index < 37; index += 1) {
        add(mode, "request_intent", {
          ordinal: ++ordinal,
          method: "POST",
          route: "application:/workspace-api/workspace/:id/scope1-inventory",
        });
        add(mode, "response_headers", { ordinal, status: 201, elapsedMs: 1 });
      }
    }
    add(mode, "phase_finished", {
      status: "passed",
      paused: false,
      diagnosticsHealthy: true,
      applicationPostRequests: mode === "exercise" ? 37 : 0,
      allCreatedAuthSessionsClosed: true,
    });
  }
  if (windows) {
    for (const mode of ["baseline", "exercise", "revisit"] as const) {
      const phase = events.filter((event) => event.mode === mode);
      const window = windows[mode];
      if (!phase.length || !window) continue;
      const start = Date.parse(window.start);
      const finish = Date.parse(window.finish);
      phase.forEach((event, index) => {
        event.createdAt = new Date(
          start + Math.floor(((finish - start) * index) / Math.max(1, phase.length - 1)),
        ).toISOString();
      });
    }
    rehash(events);
  }
  const text = serialize(events);
  const baselineEnd = events.findIndex(
    (event) => event.mode === "baseline" && event.kind === "phase_finished",
  );
  const baselineEvents = events.slice(0, baselineEnd + 1);
  const baselineText = serialize(baselineEvents);
  return {
    events,
    text,
    sha256: sha(text),
    head: events.at(-1)!.sha256,
    baseline: {
      diagnosticSha256: sha(baselineText),
      diagnosticHead: baselineEvents.at(-1)!.sha256,
      diagnosticEvents: baselineEvents.length,
      diagnosticRequests: baselineEvents.filter((event) => event.kind === "request_intent").length,
    },
  };
}

async function lifecycleFixture(
  full: boolean,
  options: { restartDelayMs?: number; revisitDelayAfterObservationMs?: number } = {},
) {
  const local = (await readFile(".superpowers/m78-continuation-native-20260922-run.jsonl", "utf8"))
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  const baselineScope1 = structuredClone(local[0]!.data.baseline);
  const finalScope1 = structuredClone(local.at(-1)!.data.final);
  const recipe = local.filter((event) =>
    ["post_intent", "post_outcome", "post_verified"].includes(event.kind),
  );
  const events: AnyEvent[] = [];
  let clock = Date.UTC(2026, 0, 1);
  const add = (mode: AnyEvent["mode"], kind: string, data: any) => {
    const body = {
      sequence: events.length + 1,
      previousSha256: events.at(-1)?.sha256 ?? null,
      profile: "m78-hosted-continuation-v1",
      workspaceId: company,
      mode,
      kind,
      data,
      createdAt: new Date(clock).toISOString(),
    };
    clock += 1_000;
    const event = { ...body, sha256: sha(canonical(body)) };
    events.push(event);
    return event;
  };
  add("baseline", "provenance", {
    acceptedM77: M78_ACCEPTED_M77,
    acceptedM78Failure: M78_ACCEPTED_FAILURE,
  });
  const addSessions = (mode: AnyEvent["mode"]) => {
    for (const role of roles) {
      add(mode, "auth_intent", { role });
      add(mode, "auth_outcome", { role, status: 200, tokenObserved: true, subjectMatched: true });
    }
  };
  const addLegacy = (mode: AnyEvent["mode"]) => {
    for (let requestId = 1; requestId <= 8; requestId += 1) {
      const action = requestId <= 4 ? "login" : "logout";
      add(mode, "legacy_auth_intent", { requestId, action });
      add(mode, "legacy_auth_outcome", { requestId, action, status: action === "login" ? 200 : 204 });
    }
    add(mode, "legacy_read_verified", {
      unchanged: true,
      applicationPostRequests: 0,
      allCreatedAuthSessionsClosed: true,
    });
  };
  const close = (mode: AnyEvent["mode"], attemptSequence: number, posts: number) => {
    for (const role of roles) {
      add(mode, "logout_intent", { role });
      add(mode, "logout_outcome", { role, status: 204 });
    }
    return add(mode, "attempt_finished", {
      attemptSequence,
      status: "passed",
      applicationPostRequests: posts,
      requests: mode === "exercise" ? 53 : 16,
      allCreatedAuthSessionsClosed: true,
      unknownAuthSessions: 0,
    });
  };

  const baselineStart = add("baseline", "attempt_started", { mode: "baseline", gate });
  addSessions("baseline");
  addLegacy("baseline");
  add("baseline", "baseline", {
    scope1: baselineScope1,
    registers: { retained: "baseline-registers" },
    downloads: { retained: "baseline-downloads" },
    m78bytes: { retained: "baseline-m78bytes" },
    legacy: { retained: "legacy" },
  });
  const baselineFinish = close("baseline", baselineStart.sequence, 0);
  const baselinePrefix = serialize(events);

  const exerciseStart = add("exercise", "attempt_started", { mode: "exercise", gate });
  addSessions("exercise");
  for (const event of recipe) {
    if (event.kind === "post_intent") {
      add("exercise", event.kind, {
        name: event.data.name,
        route: event.data.route,
        role: event.data.role,
        expected: event.data.expected,
      });
    } else if (event.kind === "post_outcome") {
      add("exercise", event.kind, {
        name: event.data.name,
        route: event.data.route,
        role: event.data.role,
        status: event.data.status,
        responseSha256: event.data.responseSha256,
        byteLength: event.data.byteLength,
      });
    } else {
      add("exercise", event.kind, {
        name: event.data.name,
        responseSha256: event.data.responseSha256,
        verifiedIdentity: m78VerifiedIdentity(event.data.decodedEnvelope),
      });
    }
  }
  addLegacy("exercise");
  const exercise = add("exercise", "exercise_complete", {
    scope1: finalScope1,
    registers: { retained: "baseline-registers" },
    downloads: { retained: "baseline-downloads" },
    m78bytes: { retained: "baseline-m78bytes" },
    legacy: { retained: "legacy" },
    applicationPostRequests: 37,
  });
  const exerciseFinish = close("exercise", exerciseStart.sequence, 37);

  let restartText: string | undefined;
  let restartPath: string | undefined;
  let revisitStart: AnyEvent | undefined;
  let revisitFinish: AnyEvent | undefined;
  if (full) {
    const requested = Date.parse(exerciseFinish.createdAt) + (options.restartDelayMs ?? 24 * 60 * 60 * 1_000);
    const observed = requested + 3_000;
    clock = observed + (options.revisitDelayAfterObservationMs ?? 1_000);
    revisitStart = add("revisit", "attempt_started", { mode: "revisit", gate });
    addSessions("revisit");
    addLegacy("revisit");
    add("revisit", "revisit_verified", {
      exerciseSha256: exercise.sha256,
      applicationPostRequests: 0,
      exactRetainedState: true,
    });
    revisitFinish = close("revisit", revisitStart.sequence, 0);
    restartText = `${JSON.stringify({
      status: "m78_runtime_verified",
      schemaVersion: 21,
      phase: "restart",
      commit: gate.reviewedApplicationCommit,
      restartAcknowledged: true,
      deploymentStatus: "SUCCESS",
      httpStatus: 200,
      ready: { schemaVersion: 21, status: "ready", legacyContainmentVerified: true },
      restartRequestedAt: new Date(requested).toISOString(),
      actualStartupEvent: { event: "staging_started", timestamp: new Date(requested + 1_000).toISOString() },
      startupCollection: {
        observedAt: new Date(requested + 2_000).toISOString(),
        deploymentId: "qa-deployment",
        commit: gate.reviewedApplicationCommit,
        imageDigest: `sha256:${"1".repeat(64)}`,
        logsSha256: "2".repeat(64),
      },
      observedAt: new Date(observed).toISOString(),
      deploymentId: "qa-deployment",
      imageDigest: `sha256:${"1".repeat(64)}`,
    })}\n`;
    restartPath = ".superpowers/m78-qa-restart-verified.json";
  }

  const text = serialize(events);
  const diagnostics = diagnosticFixture(full, {
    baseline: { start: baselineStart.createdAt, finish: baselineFinish.createdAt },
    exercise: { start: exerciseStart.createdAt, finish: exerciseFinish.createdAt },
    ...(revisitStart && revisitFinish
      ? { revisit: { start: revisitStart.createdAt, finish: revisitFinish.createdAt } }
      : {}),
  });
  const baselineText = `${JSON.stringify({
    status: "m78_independent_continuation4_hosted_baseline_passed",
    journalPath: ".superpowers/m78-hosted-continuation4.jsonl",
    verifiedPrefixBytes: Buffer.byteLength(baselinePrefix),
    verifiedPrefixEvents: events.findIndex((event) => event === baselineFinish) + 1,
    prefixSha256: sha(baselinePrefix),
    headSha256: baselineFinish.sha256,
    completedAt: baselineFinish.createdAt,
    ...diagnostics.baseline,
  })}\n`;
  const baselinePath = "qa://baseline-result";
  const files = new Map<string, string>([[baselinePath, baselineText]]);
  if (restartPath && restartText) files.set(restartPath, restartText);
  let revisitObservationPath: string | undefined;
  if (full) {
    revisitObservationPath = "qa://revisit-observation";
    files.set(revisitObservationPath, `${JSON.stringify({
      status: "m78_continuation4_revisit_observed",
      scope1: finalScope1,
      registers: { retained: "baseline-registers" },
      downloads: { retained: "baseline-downloads" },
      m78bytes: { retained: "baseline-m78bytes" },
      legacy: { retained: "legacy" },
    })}\n`);
  }
  const admission: LifecycleAdmission = {
    journalSha256: sha(text),
    journalHead: events.at(-1)!.sha256,
    diagnosticsSha256: diagnostics.sha256,
    diagnosticsHead: diagnostics.head,
    baselineResult: { path: baselinePath, sha256: sha(baselineText) },
    ...(restartPath && restartText
      ? { restartAttestation: { path: restartPath, sha256: sha(restartText) } }
      : {}),
    ...(revisitObservationPath
      ? { revisitObservation: { path: revisitObservationPath, sha256: sha(files.get(revisitObservationPath)!) } }
      : {}),
  };
  const load = async (path: string) => {
    const value = files.get(path);
    if (value === undefined) throw new Error(`missing QA fixture ${path}`);
    return value;
  };
  return {
    events,
    text,
    diagnostics,
    admission,
    load,
    files,
    baselinePrefix,
    baselineScope1,
    finalScope1,
    exercise,
    exerciseFinish,
    recipeNames: recipe.filter((event) => event.kind === "post_intent").map((event) => event.data.name),
  };
}

function repinJournal(fixture: Awaited<ReturnType<typeof lifecycleFixture>>) {
  fixture.text = rehash(fixture.events);
  fixture.admission.journalSha256 = sha(fixture.text);
  fixture.admission.journalHead = fixture.events.at(-1)!.sha256;
}
test("supplement: evaluator accepts two swapped same-kind version identities", async () => {
  const fixture = await lifecycleFixture(false);
  const verified = fixture.events.filter((event) => event.kind === "post_verified");
  const first = verified.find((event) =>
    event.data.name === "m78_rebind_natural_gas_625a3fd6-4218-426c-97fa-69c1fee862b4"
  )!;
  const second = verified.find((event) =>
    event.data.name === "m78_rebind_natural_gas_76e4e7e0-f4c9-40bd-b133-21e534401cae"
  )!;
  const firstIdentity = structuredClone(first.data.verifiedIdentity);
  const secondIdentity = structuredClone(second.data.verifiedIdentity);
  expect(firstIdentity.worksheetId).not.toBe(secondIdentity.worksheetId);
  expect(firstIdentity.id).not.toBe(secondIdentity.id);

  first.data.verifiedIdentity = secondIdentity;
  second.data.verifiedIdentity = firstIdentity;
  repinJournal(fixture);

  const swapped = fixture.events
    .filter((event) => event.kind === "post_verified")
    .map((event) => canonical(event.data.verifiedIdentity));
  expect(new Set(swapped)).toHaveLength(37);
  expect(first.data.name).toContain("625a3fd6-4218-426c-97fa-69c1fee862b4");
  expect(first.data.verifiedIdentity.worksheetId).toBe(secondIdentity.worksheetId);

  const result = await verifyContinuation4Lifecycle(
    fixture.text,
    fixture.diagnostics.text,
    fixture.admission,
    fixture.load,
  );
  expect(result.status).toBe("m78_independent_continuation4_exercise_passed");
});
