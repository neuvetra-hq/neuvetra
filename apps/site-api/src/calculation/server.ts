import { Elysia } from "elysia"
import path from "node:path"

const LOOPBACK_HOST = "127.0.0.1"
const PORT = 3014
const ALLOWED_ORIGIN = "http://127.0.0.1:5174"
const MAX_BODY_BYTES = 64_000
const enginePath = path.join(import.meta.dir, "stationary_natural_gas.py")

let engineBusy = false

export async function runEngine(payload: unknown) {
  const encoded = JSON.stringify(payload)
  if (encoded.length > 16_384) return { status: "error", error: { code: "request_too_large", field: "request", message: "The local calculation request is too large." } }
  if (engineBusy) return { status: "error", error: { code: "calculator_busy", field: "system", message: "The local calculator is busy; wait for the current calculation to finish." } }
  engineBusy = true
  const python = Bun.env.NEUVETRA_PYTHON?.trim() || "python"
  const process = Bun.spawn([python, enginePath], {
    stdin: new Blob([encoded]),
    stdout: "pipe",
    stderr: "pipe",
    env: { PATH: Bun.env.PATH ?? "", PYTHONIOENCODING: "utf-8" },
  })
  const timer = setTimeout(() => process.kill(), 2_000)
  try {
    const [exitCode, stdout] = await Promise.all([process.exited, new Response(process.stdout).text()])
    if (stdout.length > 64_000) throw new Error("oversized engine response")
    const decoded = JSON.parse(stdout)
    if (exitCode === 0 || (exitCode === 2 && decoded?.status === "error")) return decoded
  } catch {
    // Return the same finite server error for timeout or malformed output.
  } finally {
    clearTimeout(timer)
    engineBusy = false
  }
  return { status: "error", error: { code: "calculation_unavailable", field: "system", message: "The local deterministic calculator is unavailable." } }
}

function originAllowed(request: Request) {
  return request.headers.get("origin") === ALLOWED_ORIGIN
}

export function createCalculationRoutes() {
  return new Elysia({ prefix: "/calculation", normalize: false })
    .onRequest(({ set }) => { set.headers["cache-control"] = "no-store" })
    .get("/status", () => ({ status: "ready", mode: "local_synthetic_development", provider_requests: false, persistence: false }))
    .post("/run", async ({ body, request, set }) => {
      if (!originAllowed(request)) {
        set.status = 403
        return { status: "error", error: { code: "forbidden", field: "origin", message: "This development endpoint accepts only the local Neuvetra preview." } }
      }
      const response = await runEngine(body)
      if (response?.status === "error") {
        const code = response.error?.code
        set.status = code === "calculator_busy" ? 429 : code === "calculation_unavailable" ? 503 : code === "replay_hash_mismatch" || code === "replay_binding_mismatch" ? 409 : 422
      }
      return response
    }, { parse: "json" })
}

if (import.meta.main) {
  new Elysia().use(createCalculationRoutes()).listen({ hostname: LOOPBACK_HOST, port: PORT, maxRequestBodySize: MAX_BODY_BYTES })
  console.info(`Neuvetra deterministic calculation demo listening on http://${LOOPBACK_HOST}:${PORT}`)
}
