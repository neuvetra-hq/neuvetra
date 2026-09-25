import { createServer, type IncomingMessage, type ServerResponse } from "node:http"

export interface LocalBetaAccessListener {
  readonly port: number
  stop(closeActiveConnections?: boolean): Promise<void>
}

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(name, item)
    else if (value !== undefined) headers.set(name, value)
  }
  return headers
}

function requestBody(request: IncomingMessage): ReadableStream<Uint8Array> {
  let cancelled = false
  let cleanup = () => {}
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let ended = false
      cleanup = () => {
        request.off("data", onData)
        request.off("end", onEnd)
        request.off("error", onError)
        request.off("close", onClose)
      }
      const onData = (chunk: Buffer) => {
        if (cancelled) return
        controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength))
        if ((controller.desiredSize ?? 1) <= 0) request.pause()
      }
      const onEnd = () => { ended = true; if (!cancelled) controller.close(); cleanup() }
      const onError = (error: Error) => { if (!cancelled) controller.error(error); cleanup() }
      const onClose = () => {
        if (!cancelled && !ended) controller.error(new Error("Request closed before its body completed."))
        cleanup()
      }
      request.on("data", onData)
      request.once("end", onEnd)
      request.once("error", onError)
      request.once("close", onClose)
    },
    pull() { request.resume() },
    cancel() {
      cancelled = true
      cleanup()
      if (request.readableEnded || request.destroyed) return
      let discarded = 0
      let finished = false
      const finish = (destroy: boolean) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        request.off("data", onDiscard)
        request.off("end", onDone)
        request.off("close", onDone)
        request.off("error", onDone)
        if (destroy && !request.destroyed) request.destroy()
      }
      const onDiscard = (chunk: Buffer) => { discarded += chunk.byteLength; if (discarded > 6144) finish(true) }
      const onDone = () => finish(false)
      const timer = setTimeout(() => finish(true), 50)
      request.on("data", onDiscard)
      request.once("end", onDone)
      request.once("close", onDone)
      request.once("error", onDone)
      request.resume()
    },
  })
}

function waitForDrain(output: ServerResponse): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = output.socket
    const cleanup = () => {
      output.off("drain", onDrain)
      output.off("close", onClose)
      output.off("error", onError)
      socket?.off("close", onClose)
    }
    const onDrain = () => { cleanup(); resolve(true) }
    const onClose = () => { cleanup(); resolve(false) }
    const onError = (error: Error) => { cleanup(); reject(error) }
    output.once("drain", onDrain)
    output.once("close", onClose)
    output.once("error", onError)
    socket?.once("close", onClose)
    if (output.destroyed || output.writableEnded || socket?.destroyed) onClose()
  })
}

async function writeResponse(response: Response, output: ServerResponse): Promise<void> {
  output.statusCode = response.status
  for (const [name, value] of response.headers) output.setHeader(name, value)
  const closeConnection = response.headers.get("connection")?.toLowerCase() === "close"
  if (closeConnection) {
    output.shouldKeepAlive = false
    output.setHeader("connection", "close")
    const socket = output.socket
    if (socket) output.once("finish", () => socket.end())
  }
  if (!response.body) { output.end(); return }
  const reader = response.body.getReader()
  const socket = output.socket
  let peerClosed = output.destroyed
  let cancellation: Promise<void> | undefined
  const onPeerClose = () => {
    peerClosed = true
    cancellation ??= reader.cancel("HTTP peer closed.")
  }
  output.once("close", onPeerClose)
  socket?.once("close", onPeerClose)
  try {
    while (!peerClosed) {
      const { done, value } = await reader.read()
      if (done) break
      if (!output.write(value) && !await waitForDrain(output)) break
    }
    if (peerClosed) await (cancellation ??= reader.cancel("HTTP peer closed."))
    else output.end()
  } catch (error) {
    if (!output.destroyed) output.destroy(error instanceof Error ? error : undefined)
  } finally {
    output.off("close", onPeerClose)
    socket?.off("close", onPeerClose)
    reader.releaseLock()
  }
}

/** Explicit local-only listener composition. Importing this module never starts a listener. */
export async function startLocalBetaAccessListener(fetch: (request: Request) => Response | Promise<Response>, port = 0): Promise<LocalBetaAccessListener> {
  const server = createServer(async (incoming, output) => {
    try {
      const address = server.address()
      if (!address || typeof address === "string") throw new Error("Local listener address unavailable.")
      const method = incoming.method ?? "GET"
      const body = method === "GET" || method === "HEAD" ? undefined : requestBody(incoming)
      const request = new Request(`http://127.0.0.1:${address.port}${incoming.url ?? "/"}`, {
        method,
        headers: requestHeaders(incoming),
        ...(body ? { body, duplex: "half" } : {}),
      } as RequestInit)
      await writeResponse(await fetch(request), output)
    } catch {
      incoming.pause()
      if (!output.headersSent) {
        output.shouldKeepAlive = false
        const socket = output.socket
        if (socket) output.once("finish", () => socket.end())
        output.writeHead(400, { connection: "close", "content-type": "application/json; charset=utf-8", "cache-control": "no-store" })
        output.end(JSON.stringify({ error: "Invalid request." }))
      } else output.destroy()
    }
  })
  server.requestTimeout = 5_000
  server.headersTimeout = 5_000
  server.keepAliveTimeout = 1_000
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve() })
  })
  const address = server.address()
  if (!address || typeof address === "string") { server.close(); throw new Error("Local listener address unavailable.") }
  return {
    port: address.port,
    async stop(closeActiveConnections = false) {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING" ? reject(error) : resolve())
        if (closeActiveConnections) server.closeAllConnections()
      })
    },
  }
}
