import { describe, expect, test } from "bun:test"
import { getSupabaseConfig } from "./supabase-config"

describe("optional homepage auth configuration", () => {
  test("keeps the homepage available when configuration is missing or still an example", () => {
    expect(getSupabaseConfig()).toBeNull()
    expect(getSupabaseConfig("https://auth.example.test")).toBeNull()
    expect(getSupabaseConfig("https://<your-project>.supabase.co", "<anon-public-key>")).toBeNull()
    expect(getSupabaseConfig("not a URL", "test-only-key")).toBeNull()
    expect(getSupabaseConfig("file:///auth", "test-only-key")).toBeNull()
  })

  test("accepts configured hosted or local auth without making a request", () => {
    expect(getSupabaseConfig(" https://auth.example.test ", " test-only-key ")).toEqual({
      url: "https://auth.example.test",
      anonKey: "test-only-key",
    })
    expect(getSupabaseConfig("http://localhost:54321", "test-only-key")?.url).toBe("http://localhost:54321")
  })
})
