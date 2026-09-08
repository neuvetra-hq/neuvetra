/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test"
import { createClient } from "@supabase/supabase-js"
import { findBusinessMembership, loadOwnedBusiness, loadUserProfile } from "./account-data"

const userId = "00000000-0000-0000-0000-000000000001"
const businessId = "00000000-0000-0000-0000-000000000002"

function createTestClient(rows: unknown[]) {
  const requests: { url: URL; headers: Headers }[] = []
  const client = createClient("http://127.0.0.1:54321", "test-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        requests.push({ url: new URL(String(input)), headers: new Headers(init?.headers) })
        return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } })
      },
    },
  })
  return { client, requests }
}

describe("account data after the FrontDesk schema migration", () => {
  test("loads the shared profile from public", async () => {
    const { client, requests } = createTestClient([
      { id: userId, first_name: "Test", last_name: "Owner", phone: "+14155550100" },
    ])

    expect(await loadUserProfile(client, userId)).toEqual({
      id: userId, firstName: "Test", lastName: "Owner", phone: "+14155550100",
    })
    expect(requests[0].headers.get("accept-profile")).toBe("public")
    expect(requests[0].url.pathname).toBe("/rest/v1/users")
    expect(requests[0].url.searchParams.get("id")).toBe(`eq.${userId}`)
  })

  test("loads the owner's business from frontdesk with the existing membership filters", async () => {
    const { client, requests } = createTestClient([
      { businesses: { id: businessId, name: "Test Business", status: "active", ai_config: { agentName: "Alex" } } },
    ])

    expect(await loadOwnedBusiness(client, userId)).toEqual({
      id: businessId,
      name: "Test Business",
      status: "active",
      businessType: null,
      twilioNumber: null,
      stripePlanId: null,
      stripeSubscriptionId: null,
      aiConfig: { agentName: "Alex" },
    })
    expect(requests[0].headers.get("accept-profile")).toBe("frontdesk")
    expect(requests[0].url.pathname).toBe("/rest/v1/business_members")
    expect(requests[0].url.searchParams.get("user_id")).toBe(`eq.${userId}`)
    expect(requests[0].url.searchParams.get("role")).toBe("eq.owner")
    expect(requests[0].url.searchParams.get("limit")).toBe("1")
  })

  test("both signup flows can find an existing membership in frontdesk", async () => {
    const { client, requests } = createTestClient([{ business_id: businessId }])

    expect(await findBusinessMembership(client, userId)).toEqual({ business_id: businessId })
    expect(requests[0].headers.get("accept-profile")).toBe("frontdesk")
    expect(requests[0].url.searchParams.get("user_id")).toBe(`eq.${userId}`)
    expect(requests[0].url.searchParams.has("role")).toBe(false)
  })

  test("an account without a profile or membership still returns null", async () => {
    const { client } = createTestClient([])

    expect(await loadUserProfile(client, userId)).toBeNull()
    expect(await loadOwnedBusiness(client, userId)).toBeNull()
    expect(await findBusinessMembership(client, userId)).toBeNull()
  })

  test("product reads do not change subsequent shared identity requests", async () => {
    const { client, requests } = createTestClient([])

    await loadOwnedBusiness(client, userId)
    await loadUserProfile(client, userId)
    await client.from("users").select("id").eq("id", userId)

    expect(requests.map(({ headers }) => headers.get("accept-profile"))).toEqual([
      "frontdesk", "public", "public",
    ])
  })
})
