# M78 Bun loopback transport probe

Task `M78-TRANSPORT-PROBE-01`; executed 2026-09-22 by `/root/m78_transport_probe` as a critical software-engineering assignment sponsored by CTO. Requested registry route was `gpt-5.6-sol/high`; the model and effort actually applied to this execution context are not observable. Applicable lesson: L04, because a mocked fetch-options assertion would not establish TCP connection reuse.

## Result

The artificial reuse mechanism reproduced on the exact installed runtime: Bun 1.3.12, Windows x64 (`win32`, OS release `10.0.26200`). The raw HTTP/1.1 listener bound only to `127.0.0.1`, answered the first request on each TCP connection, and intentionally sent no bytes for a second request on that same connection. Every fetch had a 1,200 ms abort, every received response body was consumed, and every listener/socket was closed in `finally` cleanup.

| Variant | First responses | Server-observed TCP IDs for request 1,2 | Second outcome | Second elapsed | Cleanup |
| --- | ---: | --- | --- | --- | --- |
| default | 3/3 HTTP 200 | `1,1` in all 3 trials | 3/3 `TimeoutError`, no response bytes | 1,189.55–1,200.12 ms | 3/3 clean |
| `keepalive: false` | 3/3 HTTP 200 | `1,2` in all 3 trials | 3/3 HTTP 200 | 0.95–2.03 ms | 3/3 clean |
| `Connection: close` | 3/3 HTTP 200 | `1,2` in all 3 trials | 3/3 HTTP 200 | 0.67–1.29 ms | 3/3 clean |

For default fetch, the server observed `Connection: keep-alive` on both requests, request numbers `1,2` on TCP connection 1, and intentionally stayed silent on request 2. For `keepalive: false`, the server observed no `Connection` request header but saw request number 1 on two different connections, so the result does not rely on merely asserting an option object. For the explicit header, the server observed `Connection: close` on both requests and answered request number 1 on two different connections.

This establishes that a real reused Bun connection can remain awaiting response headers until a bounded abort when its peer stays silent, and that both opt-outs avoided reuse in this controlled Bun 1.3.12 Windows experiment. It does **not** establish that the failed hosted coverage-export request used a stale or half-open socket, that the provider received it, or that pooling caused the hosted timeout.

## Source context and limits

- Current [official Bun fetch documentation](https://bun.sh/docs/runtime/networking/fetch) says connection pooling is on by default and documents both per-request `keepalive: false` and `Connection: close` as ways to disable it. The page retrieved on 2026-09-22 advertises current Bun 1.4.2, so it is supporting current documentation rather than a byte-pinned 1.3.12 manual. Actual 1.3.12 behavior was therefore tested locally.
- Upstream [Bun issue #31894](https://github.com/oven-sh/bun/issues/31894) is a user report for Bun 1.3.14 on Linux x64/WSL2. It reports a similar silent reused-socket timeout and claims `keepalive: false` did not work there. The issue is closed as not planned. Its version, platform, and server fixture differ from this experiment; it is context, not evidence of the Neuvetra failure or a cause attribution.
- The preserved M78 failure record shows one 30,007 ms application GET timeout without response headers, zero application writes, and all four observed sessions logged out. The coordinator separately reports no matching provider completion in the filtered window, nearby exports completing in about 3.2 seconds, and 12/12 credential-free `/ready` requests succeeding across default and explicit-close variants. Those observations leave provider, server, database, and transport causes unresolved.
- Loopback HTTP omits TLS, proxies, NAT/load balancers, remote scheduling, server work, and the hosted endpoint. The server's silent behavior is deliberately induced. Three trials per variant characterize this exact process and runtime only.

## Narrow recommendation

If CTO prepares a separately reviewed transport mitigation, use `keepalive: false` on the exact long-lived Bun fetch boundary as the narrow first candidate while preserving the existing bounded abort and zero-retry policy. In this runtime it opened fresh sockets without relying on the peer honoring a `Connection: close` header. Require an actual adapter-bound test and independent review before any hosted run. Do not modify the current harness, retry the failed journey, or claim the hosted failure fixed from this probe alone. Keep explicit `Connection: close` as a separately testable fallback because Bun's current documentation supports it and its behavior was also successful here.

## Reproduction and validation

- Probe: `bun evaluations/research-qa/m78-transport-probe.ts --output evaluations/research-qa/m78-transport-probe-result.json`
- Direct boundary test: `bun test evaluations/research-qa/m78-transport-probe.test.ts` — 1 passed, 0 failed, 16 assertions. The test starts real TCP listeners and checks server-observed connection IDs and request ordinals.
- Strict targeted TypeScript: passed for the probe and direct test.
- Final source SHA-256: `a2fac92db1a3b85c26ac48722f497291b39b14fe74272487de48460581c19321` (11,548 bytes).
- Final result SHA-256: `eaf65f60f2286b1ae7a3a44c0cf974879c2b4c6d4a9ce102555360f8c60f05ff` (14,789 bytes).
- Test SHA-256: `b85d3e2b8704b45c79e97ddd7da0a14761099cb2ea5b36ca72414435218170ca` (1,806 bytes).

One intermediate packaging run completed the transport measurements and wrote its result, then the CLI summary hit an undefined logging variable. The logging defect was corrected; the final result above was generated successfully, the direct real-socket test passed, and strict TypeScript passed. No external probe network, credentials, provider, database, application, retry, harness, journal, shared ledger, Git, or deployment action occurred.
