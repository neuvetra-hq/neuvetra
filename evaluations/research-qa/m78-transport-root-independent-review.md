# Independent transport experiment review

September 22, 2026. Root reviewed the loopback experiment authored by `/root/m78_transport_probe`. A supplementary QA dispatch was rejected with `agent thread limit reached`; root performed the independent review instead. Root did not author the probe under review. The independent socket test below was authored and executed by root as evaluator evidence.

The author uses real loopback TCP listeners and observes per-connection request identities. The server responds to the first request and deliberately leaves a reused connection silent. Three trials each show default pooling reuses that connection and times out, while `keepalive:false` and explicit `Connection: close` each use a new connection and receive both responses. This demonstrates a controlled condition, not a spontaneous runtime defect or the actual hosted cause.

Root inspected socket buffering, response framing, body consumption and cleanup. One limitation is the author's server cooperates with the client's close header. Root independently challenged that condition in `m78-transport-independent-sockets.ts`: the peer ignores the close header and always advertises keep-alive. A healthy default control uses connection IDs1,1 and returns both bodies. A silent reused peer uses1,1 and the second request times out after1011ms. With pooling disabled, the same peer uses1,2 and returns both bodies. All listeners/sockets close. This was Bun1.3.12 on Windows, with loopback-only traffic and no credentials or application data.

Root's separate twelve public readiness reads all passed. Provider logs lack a completion for the exact failed baseline3 path within the selected window, while neighboring exports completed around3.2seconds. Missing completion logs do not prove nonarrival or exclude incomplete logs. These observations are preserved in `m78-continuation3-transport-observations.json`; they establish no definitive hosted cause.

[Bun's fetch documentation](https://bun.sh/docs/runtime/networking/fetch) describes connection pooling and the per-request disable option. [Issue31894](https://github.com/oven-sh/bun/issues/31894) reports a related reused-connection stall on a different version/platform and is closed as not planned. Its claim that the option was ineffective does not match the measured installed-version experiment here. Neither source is treated as proof of Neuvetra's incident cause.

Accept `keepalive:false` as a bounded transport hedge for a separately reviewed new verifier attempt, preserving timeout, URL/method/body/headers/signal/redirect behavior, response identity, no retries and every original accounting/auth/evidence check. This does not authorize replay of any failed journal, accept a new adapter or private wrapper, or prove successful hosted verification. Do not describe the original timeout as fixed until actual new evidence supports that outcome.

## Exact observed probe source

Root verified author result source pin a2fac92db1a3b85c26ac48722f497291b39b14fe74272487de48460581c19321 matches current probe bytes. Final author snapshot admission is recorded separately after delivery.
