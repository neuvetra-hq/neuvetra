import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { isResearchAnswer } from "@/lib/research-api"
import { loadReviewedDemoCases, REVIEWED_DEMO_MANIFEST } from "@/data/reviewed-demo"

const siteWebDirectory = path.resolve(import.meta.dir, "../..")
describe("preserved reviewed demo", () => {
  test("the three checked-in development artifacts match their accepted hashes and order", async () => {
    expect(REVIEWED_DEMO_MANIFEST.map((item) => item.id)).toEqual(["W11", "W03", "EPA14-B01"])
    for (const item of REVIEWED_DEMO_MANIFEST) {
      const bytes = await readFile(path.join(siteWebDirectory, item.artifact))
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(item.responseSha256)
      expect(isResearchAnswer(JSON.parse(bytes.toString("utf8")))).toBe(true)
    }
  })

  test("the loader reads only local replay files and returns the exact accepted contracts", async () => {
    const requested: string[] = []
    const localFetch = async (input: string | URL | Request) => {
      const url = String(input)
      requested.push(url)
      const name = url.split("/").at(-1)
      const bytes = await readFile(path.join(siteWebDirectory, "src/data/reviewed-demo-artifacts", String(name)))
      return new Response(bytes, { status: 200, headers: { "content-type": "application/json" } })
    }
    const cases = await loadReviewedDemoCases(localFetch as typeof fetch, "/")
    expect(requested).toEqual(["/src/data/reviewed-demo-artifacts/W11.bin", "/src/data/reviewed-demo-artifacts/W03.bin", "/src/data/reviewed-demo-artifacts/EPA14-B01.bin"])
    expect(cases.map((item) => [item.id, item.answer.status, item.answer.claims.length, item.answer.evidence.length])).toEqual([
      ["W11", "needs_input", 0, 0],
      ["W03", "qualified", 3, 2],
      ["EPA14-B01", "unsupported", 0, 0],
    ])
    expect(cases[0]?.answer.missing_context).toEqual(["referenced_subject"])
    expect(cases[1]?.answer.evidence.map((item) => item.locator)).toEqual(["PDF page 4 / printed page 1", "PDF page 9 / printed page 6"])
    expect(cases[2]?.answer.scope_gaps?.[0]?.question_fragment).toContain("specified renewable energy purchases")
  })

  test("a changed artifact fails closed", async () => {
    const changedFetch = async (input: string | URL | Request) => {
      const name = String(input).split("/").at(-1)
      const bytes = await readFile(path.join(siteWebDirectory, "src/data/reviewed-demo-artifacts", String(name)))
      const changed = Buffer.from(bytes)
      changed[0] = changed[0] === 123 ? 91 : 123
      return new Response(changed, { status: 200 })
    }
    await expect(loadReviewedDemoCases(changedFetch as typeof fetch, "/")).rejects.toThrow("artifact hash mismatch")
  })
})
