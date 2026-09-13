import { afterEach, describe, expect, test } from "bun:test"
import { createDevelopmentWorkspaceServer, M54_OUTSIDER_TOKEN, M54_OWNER_TOKEN } from "./server"

const ORIGIN = "http://127.0.0.1:5174"
const body = {
  companyName: "Synthetic Acme, Inc.",
  facilityName: "Synthetic California office",
  countryCode: "US",
  stateCode: "CA",
  egridSubregion: "CAMX",
  reportingYear: 2023,
  approach: "operational_control",
}

describe("M54 composed development server", () => {
  let close: (() => Promise<void>) | undefined
  const originalEnabled = Bun.env.M54_SYNTHETIC_WORKSPACE
  const originalRuntime = Bun.env.NODE_ENV
  afterEach(async () => {
    await close?.()
    close = undefined
    if (originalEnabled === undefined) delete Bun.env.M54_SYNTHETIC_WORKSPACE
    else Bun.env.M54_SYNTHETIC_WORKSPACE = originalEnabled
    if (originalRuntime === undefined) delete Bun.env.NODE_ENV
    else Bun.env.NODE_ENV = originalRuntime
  })

  test("creates, revisits and withholds the same real SQL-backed workspace", async () => {
    Bun.env.M54_SYNTHETIC_WORKSPACE = "enabled"
    Bun.env.NODE_ENV = "test"
    const { app, database } = await createDevelopmentWorkspaceServer()
    close = () => database.close()
    const createdResponse = await app.handle(new Request("http://localhost/workspace", {
      method: "POST",
      headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }))
    expect(createdResponse.status).toBe(201)
    const created = await createdResponse.json() as { id: string }

    const ownerResponse = await app.handle(new Request(`http://localhost/workspace/${created.id}`, {
      headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}` },
    }))
    expect(ownerResponse.status).toBe(200)

    const outsiderResponse = await app.handle(new Request(`http://localhost/workspace/${created.id}`, {
      headers: { origin: ORIGIN, authorization: `Bearer ${M54_OUTSIDER_TOKEN}` },
    }))
    expect(outsiderResponse.status).toBe(404)
    expect(await outsiderResponse.json()).toEqual({ error: "Workspace not found." })
  })

  test("requires both an explicit enable flag and a development/test runtime", async () => {
    for (const [enabled, runtime] of [[undefined, "development"], ["enabled", undefined], ["enabled", "staging"], ["enabled", "production"]] as const) {
      if (enabled === undefined) delete Bun.env.M54_SYNTHETIC_WORKSPACE
      else Bun.env.M54_SYNTHETIC_WORKSPACE = enabled
      if (runtime === undefined) delete Bun.env.NODE_ENV
      else Bun.env.NODE_ENV = runtime
      await expect(createDevelopmentWorkspaceServer()).rejects.toThrow("explicit development/test enable flag")
    }
  })
})
