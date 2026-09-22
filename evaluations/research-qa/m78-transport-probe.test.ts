import { expect, test } from "bun:test";
import { runM78TransportProbe } from "./m78-transport-probe";

test(
  "real Bun fetches expose reuse and both pooling opt-outs through loopback TCP IDs",
  async () => {
    const result = await runM78TransportProbe(1);

    expect(result.environment.bunVersion).toBe("1.3.12");
    expect(result.bounds.network).toBe("127.0.0.1 loopback only");
    expect(result.bounds.externalNetworkUsedByProbe).toBeFalse();

    const defaultTrial = result.variants.default[0]!;
    expect(defaultTrial.first.outcome).toBe("response");
    expect(defaultTrial.second.outcome).toBe("error");
    expect(defaultTrial.requests.map((event) => event.connectionId)).toEqual([1, 1]);
    expect(defaultTrial.requests.map((event) => event.requestOnConnection)).toEqual([1, 2]);
    expect(defaultTrial.requests[1]!.action).toBe("silent");

    const keepaliveTrial = result.variants.keepalive_false[0]!;
    expect(keepaliveTrial.second.outcome).toBe("response");
    expect(keepaliveTrial.requests.map((event) => event.connectionId)).toEqual([1, 2]);
    expect(keepaliveTrial.requests.map((event) => event.requestOnConnection)).toEqual([1, 1]);

    const closeTrial = result.variants.connection_close[0]!;
    expect(closeTrial.second.outcome).toBe("response");
    expect(closeTrial.requests.map((event) => event.connectionId)).toEqual([1, 2]);
    expect(closeTrial.requests.map((event) => event.requestConnectionHeader)).toEqual([
      "close",
      "close",
    ]);
    expect(closeTrial.requests.map((event) => event.requestOnConnection)).toEqual([1, 1]);

    expect(result.findings).toMatchObject({
      mechanismReproduced: true,
      keepaliveFalsePreventedReuse: true,
      connectionClosePreventedReuse: true,
      cleanupComplete: true,
    });
  },
  10_000,
);
