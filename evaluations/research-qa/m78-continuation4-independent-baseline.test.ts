import { expect, test } from "bun:test";
import { verifyDiagnostics, DISPOSITION_PIN } from "./m78-continuation4-baseline-independent-review";
import { M78_CONTINUATION4_PATHS, M78_CONTINUATION4_PRIOR_FAILURE } from "../../tools/staging/check-m78-continuation4";
import { M78_CONTINUATION3_INTERRUPTION } from "../../tools/staging/check-m78-continuation3";
import { m78CanonicalJson as canonical } from "../../packages/neuvetra-database/src/m78-validation";

const sha = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

function diagnosticEvents() {
  const events: Array<{ kind: string; data: Record<string, unknown> }> = [{
    kind: "phase_started",
    data: {
      priorFailure: {
        ...M78_CONTINUATION4_PRIOR_FAILURE,
        main: M78_CONTINUATION4_PATHS.failedMain,
        diagnostics: M78_CONTINUATION4_PATHS.failedDiagnostics,
        review: M78_CONTINUATION4_PATHS.failedReview,
      },
      transport: { runtime: "bun-fetch", pooling: "disabled", keepalive: false, retries: 0 },
      journal: ".superpowers/m78-hosted-continuation4.jsonl",
      interruption: { ...M78_CONTINUATION3_INTERRUPTION },
      disposition: { ...DISPOSITION_PIN },
    },
  }];
  for (let ordinal = 1; ordinal <= 16; ordinal += 1) {
    events.push({
      kind: "request_intent",
      data: {
        ordinal,
        method: "POST",
        route: `auth:/auth/v1/${ordinal <= 8 ? "token" : "logout"}`,
      },
    });
    events.push({
      kind: "response_headers",
      data: { ordinal, status: ordinal <= 8 ? 200 : 204, elapsedMs: 1 },
    });
  }
  events.push({
    kind: "phase_finished",
    data: {
      status: "passed",
      diagnosticsHealthy: true,
      paused: false,
      applicationPostRequests: 0,
      allCreatedAuthSessionsClosed: true,
    },
  });
  return events;
}

function freeze(events: ReturnType<typeof diagnosticEvents>) {
  let previousSha256: string | null = null;
  const lines = events.map((event, index) => {
    const body = {
      sequence: index + 1,
      previousSha256,
      profile: "m78-continuation4-diagnostic-v1",
      mode: "baseline",
      ...event,
      createdAt: new Date(100_000 + index).toISOString(),
    };
    previousSha256 = sha(canonical(body));
    return JSON.stringify({ ...body, sha256: previousSha256 });
  });
  const text = `${lines.join("\n")}\n`;
  return { text, sha256: sha(text), head: previousSha256! };
}

test("independent baseline review rejects a rehashed success claim containing the prior no-header timeout", () => {
  const events = diagnosticEvents();
  const outcome = events.find(
    (event) => event.kind === "response_headers" && event.data.ordinal === 10,
  )!;
  outcome.kind = "request_error";
  outcome.data = { ordinal: 10, category: "timeout", elapsedMs: 30_007 };
  const frozen = freeze(events);
  expect(() => verifyDiagnostics(frozen.text, frozen.sha256, frozen.head, 16)).toThrow();

  const missingLogout = diagnosticEvents();
  const lastLogout = missingLogout.find(
    (event) => event.kind === "request_intent" && event.data.ordinal === 16,
  )!;
  lastLogout.data.route = "application:/ready";
  lastLogout.data.method = "GET";
  const rehashed = freeze(missingLogout);
  expect(() => verifyDiagnostics(rehashed.text, rehashed.sha256, rehashed.head, 16)).toThrow();
});
