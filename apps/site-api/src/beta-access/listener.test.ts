import { describe, expect, test } from "bun:test"
import { once } from "node:events"
import { createConnection } from "node:net"
import { startLocalBetaAccessListener } from "./listener"

async function within<T>(promise: Promise<T>, milliseconds = 1_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Listener lifecycle did not settle.")), milliseconds) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

describe("local beta access listener lifecycle", () => {
  test("errors the request stream when a peer closes an unfinished body", async () => {
    let settle!: (result: string) => void
    const requestSettled = new Promise<string>(resolve => { settle = resolve })
    const listener = await startLocalBetaAccessListener(async request => {
      try { await request.arrayBuffer(); settle("ended") }
      catch { settle("closed") }
      return new Response("done")
    })
    try {
      const socket = createConnection(listener.port, "127.0.0.1")
      await once(socket, "connect")
      socket.write("POST / HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nab")
      socket.destroy()
      expect(await within(requestSettled)).toBe("closed")
    } finally {
      await listener.stop(true)
    }
  })

  test("cancels a backpressured response body when its peer closes", async () => {
    let settle!: () => void
    let markStarted!: () => void
    const responseCancelled = new Promise<void>(resolve => { settle = resolve })
    const responseStarted = new Promise<void>(resolve => { markStarted = resolve })
    let started = false
    const listener = await startLocalBetaAccessListener(() => new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!started) { started = true; markStarted() }
        controller.enqueue(new Uint8Array(1024 * 1024))
      },
      cancel() { settle() },
    })))
    try {
      const socket = createConnection(listener.port, "127.0.0.1")
      socket.on("error", () => {})
      await once(socket, "connect")
      socket.write("GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
      await within(responseStarted)
      socket.destroy()
      await within(responseCancelled)
      expect(true).toBeTrue()
    } finally {
      await listener.stop(true)
    }
  })
})
