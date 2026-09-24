/**
 * Loopback-only Bun fetch pooling probe for M78-TRANSPORT-PROBE-01.
 *
 * The raw HTTP server answers the first request received on each TCP
 * connection. A second request on the same connection is recorded and then
 * intentionally receives no bytes. Each client request has a bounded abort.
 */
import { platform, release, arch } from "node:os";

const ABORT_MS = 1_200;
const IDLE_MS = 100;
const TRIALS = 3;

type VariantName = "default" | "keepalive_false" | "connection_close";
type BunFetchInit = RequestInit & { proxy?: false };

interface RequestEvent {
  connectionId: number;
  requestOnConnection: number;
  remotePort: number | null;
  requestLine: string;
  requestConnectionHeader: string | null;
  action: "responded" | "silent";
}

interface FetchOutcome {
  outcome: "response" | "error";
  elapsedMs: number;
  status: number | null;
  body: string | null;
  errorName: string | null;
  errorMessage: string | null;
}

interface TrialResult {
  trial: number;
  port: number;
  first: FetchOutcome;
  second: FetchOutcome;
  connectionsOpened: number;
  connectionIds: number[];
  requests: RequestEvent[];
  reusedConnectionObserved: boolean;
  newConnectionForSecondRequestObserved: boolean;
  socketsClosedBeforeCleanup: number[];
  cleanup: {
    listenerStopped: boolean;
    remainingTrackedSockets: number;
  };
}

const roundMs = (value: number) => Math.round(value * 100) / 100;
const sha256 = (bytes: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

function variantInit(name: VariantName): BunFetchInit {
  const common: BunFetchInit = { proxy: false };
  if (name === "keepalive_false") return { ...common, keepalive: false };
  if (name === "connection_close") {
    return { ...common, headers: { Connection: "close" } };
  }
  return common;
}

async function measuredFetch(url: string, init: BunFetchInit): Promise<FetchOutcome> {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(ABORT_MS),
    });
    const body = await response.text();
    return {
      outcome: "response",
      elapsedMs: roundMs(performance.now() - started),
      status: response.status,
      body,
      errorName: null,
      errorMessage: null,
    };
  } catch (error) {
    const value = error as { name?: string; message?: string };
    return {
      outcome: "error",
      elapsedMs: roundMs(performance.now() - started),
      status: null,
      body: null,
      errorName: value?.name ?? "UnknownError",
      errorMessage: value?.message ?? String(error),
    };
  }
}

async function runTrial(name: VariantName, trial: number): Promise<TrialResult> {
  let nextConnectionId = 0;
  let listenerStopped = false;
  const sockets = new Set<any>();
  const closedConnectionIds = new Set<number>();
  const requests: RequestEvent[] = [];

  const listener: any = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      open(socket: any) {
        socket.data = {
          connectionId: ++nextConnectionId,
          buffer: "",
          requests: 0,
        };
        sockets.add(socket);
      },
      data(socket: any, data: Uint8Array) {
        socket.data.buffer += new TextDecoder().decode(data);
        while (true) {
          const headerEnd = socket.data.buffer.indexOf("\r\n\r\n");
          if (headerEnd < 0) break;
          const rawHeaders = socket.data.buffer.slice(0, headerEnd);
          socket.data.buffer = socket.data.buffer.slice(headerEnd + 4);
          const lines = rawHeaders.split("\r\n");
          const requestLine = lines.shift() ?? "";
          const headers = new Map<string, string>();
          for (const line of lines) {
            const colon = line.indexOf(":");
            if (colon > 0) {
              headers.set(
                line.slice(0, colon).trim().toLowerCase(),
                line.slice(colon + 1).trim(),
              );
            }
          }
          socket.data.requests += 1;
          const requestOnConnection = socket.data.requests;
          const action = requestOnConnection === 1 ? "responded" : "silent";
          requests.push({
            connectionId: socket.data.connectionId,
            requestOnConnection,
            remotePort: Number.isInteger(socket.remotePort) ? socket.remotePort : null,
            requestLine,
            requestConnectionHeader: headers.get("connection") ?? null,
            action,
          });
          if (action === "responded") {
            const body = `ok:${socket.data.connectionId}:1`;
            const requestAskedToClose = (headers.get("connection") ?? "")
              .toLowerCase()
              .split(",")
              .some((token) => token.trim() === "close");
            const response =
              "HTTP/1.1 200 OK\r\n" +
              `Content-Length: ${Buffer.byteLength(body)}\r\n` +
              `Connection: ${requestAskedToClose ? "close" : "keep-alive"}\r\n` +
              "Content-Type: text/plain\r\n\r\n" +
              body;
            if (requestAskedToClose) socket.end(response);
            else socket.write(response);
          }
        }
      },
      close(socket: any) {
        closedConnectionIds.add(socket.data?.connectionId);
        sockets.delete(socket);
      },
      error() {
        // Errors are reflected by client outcomes and cleanup counts.
      },
    },
  });

  const port = listener.port as number;
  const url = `http://127.0.0.1:${port}/trial-${trial}`;
  let first: FetchOutcome;
  let second: FetchOutcome;
  try {
    first = await measuredFetch(url, variantInit(name));
    await Bun.sleep(IDLE_MS);
    second = await measuredFetch(url, variantInit(name));
    await Bun.sleep(50);
  } finally {
    listener.stop(true);
    listenerStopped = true;
    for (const socket of [...sockets]) {
      try {
        socket.terminate();
      } catch {
        try {
          socket.end();
        } catch {
          // Listener is already stopped; the final count reports any residue.
        }
      }
    }
    await Bun.sleep(25);
  }

  const firstRequest = requests[0];
  const secondRequest = requests[1];
  return {
    trial,
    port,
    first: first!,
    second: second!,
    connectionsOpened: nextConnectionId,
    connectionIds: [...new Set(requests.map((event) => event.connectionId))],
    requests,
    reusedConnectionObserved:
      Boolean(firstRequest && secondRequest) &&
      firstRequest.connectionId === secondRequest.connectionId &&
      secondRequest.requestOnConnection === 2,
    newConnectionForSecondRequestObserved:
      Boolean(firstRequest && secondRequest) &&
      firstRequest.connectionId !== secondRequest.connectionId &&
      secondRequest.requestOnConnection === 1,
    socketsClosedBeforeCleanup: [...closedConnectionIds].sort((a, b) => a - b),
    cleanup: {
      listenerStopped,
      remainingTrackedSockets: sockets.size,
    },
  };
}

function summarize(name: VariantName, trials: TrialResult[]) {
  const firstResponses = trials.filter(
    (trial) => trial.first.outcome === "response" && trial.first.status === 200,
  ).length;
  const secondResponses = trials.filter(
    (trial) => trial.second.outcome === "response" && trial.second.status === 200,
  ).length;
  const secondTimeouts = trials.filter(
    (trial) =>
      trial.second.outcome === "error" &&
      ["TimeoutError", "AbortError"].includes(trial.second.errorName ?? ""),
  ).length;
  const reusedConnections = trials.filter((trial) => trial.reusedConnectionObserved).length;
  const freshSecondConnections = trials.filter(
    (trial) => trial.newConnectionForSecondRequestObserved,
  ).length;
  const cleanups = trials.filter(
    (trial) => trial.cleanup.listenerStopped && trial.cleanup.remainingTrackedSockets === 0,
  ).length;
  return {
    name,
    trialCount: trials.length,
    firstResponses,
    secondResponses,
    secondTimeouts,
    reusedConnections,
    freshSecondConnections,
    cleanups,
    allFirstBodiesConsumed: trials.every((trial) => trial.first.body?.startsWith("ok:")),
    allSecondResponseBodiesConsumed: trials
      .filter((trial) => trial.second.outcome === "response")
      .every((trial) => trial.second.body?.startsWith("ok:")),
  };
}

export async function runM78TransportProbe(trialsPerVariant = TRIALS) {
  const startedAt = new Date().toISOString();
  const variants: Record<VariantName, TrialResult[]> = {
    default: [],
    keepalive_false: [],
    connection_close: [],
  };
  for (const name of Object.keys(variants) as VariantName[]) {
    for (let trial = 1; trial <= trialsPerVariant; trial += 1) {
      variants[name].push(await runTrial(name, trial));
    }
  }
  const summary = Object.fromEntries(
    (Object.keys(variants) as VariantName[]).map((name) => [name, summarize(name, variants[name])]),
  ) as Record<VariantName, ReturnType<typeof summarize>>;

  const mechanismReproduced =
    summary.default.reusedConnections === trialsPerVariant &&
    summary.default.secondTimeouts === trialsPerVariant;
  const keepaliveFalsePreventedReuse =
    summary.keepalive_false.freshSecondConnections === trialsPerVariant &&
    summary.keepalive_false.secondResponses === trialsPerVariant;
  const connectionClosePreventedReuse =
    summary.connection_close.freshSecondConnections === trialsPerVariant &&
    summary.connection_close.secondResponses === trialsPerVariant;
  const cleanupComplete = Object.values(summary).every(
    (value) => value.cleanups === trialsPerVariant,
  );

  const sourceBytes = await Bun.file(import.meta.path).bytes();
  const result = {
    schemaVersion: 1,
    taskId: "M78-TRANSPORT-PROBE-01",
    profile: "m78-bun-loopback-fetch-pooling-v1",
    startedAt,
    finishedAt: new Date().toISOString(),
    environment: {
      bunVersion: Bun.version,
      platform: platform(),
      osRelease: release(),
      architecture: arch(),
    },
    bounds: {
      network: "127.0.0.1 loopback only",
      abortMs: ABORT_MS,
      idleBeforeSecondRequestMs: IDLE_MS,
      trialsPerVariant,
      responseBodiesConsumed: true,
      externalNetworkUsedByProbe: false,
    },
    source: {
      path: "evaluations/research-qa/m78-transport-probe.ts",
      sha256: sha256(sourceBytes),
      byteLength: sourceBytes.byteLength,
    },
    variants,
    summary,
    findings: {
      mechanismReproduced,
      keepaliveFalsePreventedReuse,
      connectionClosePreventedReuse,
      cleanupComplete,
      conclusion: mechanismReproduced
        ? "Bun reused a real loopback TCP connection and the second request remained without response headers until the bounded abort."
        : "The specific reused-connection timeout mechanism was not reproduced in every bounded trial.",
    },
  };

  return result;
}

async function main() {
  const result = await runM78TransportProbe();
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (output) await Bun.write(output, serialized);
  console.log(
    JSON.stringify({
      output: output ?? null,
      outputSha256: sha256(serialized),
      findings: result.findings,
      summary: result.summary,
    }),
  );
  if (
    !result.findings.cleanupComplete ||
    Object.values(result.summary).some(
      (value) => value.firstResponses !== result.bounds.trialsPerVariant,
    )
  ) {
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
