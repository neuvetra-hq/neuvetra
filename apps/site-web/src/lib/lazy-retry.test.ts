// Round 2c integration (Claude, 31 October 2026; lane D's walk, R2-polish.md "Out of my scope" 6). After a new release the
// lazily loaded Scope 3 chunks have new file names, so a page opened before it fails to load them ("Failed to fetch
// dynamically imported module …"). Every lazy chunk now retries once; if the retry fails too, the form's place shows a
// plain "A newer version is available — reload" message with a Reload button instead of an error.
import { describe, expect, test } from "bun:test"
import { lazyChunkWithRetry } from "./lazy-retry"
import { LAZY_TEXT_R2C } from "./scope3-text-r2c"
import { harness, loadComponent } from "../components/component-harness"

const Form = () => null
const Notice = () => null
const failing = (times: number) => {
  let calls = 0
  return { load: async () => { calls++; if (calls <= times) throw new TypeError("Failed to fetch dynamically imported module: /assets/Scope3RecordForm-abc123.js"); return Form }, calls: () => calls }
}

describe("lazy chunks after a new release (round 2c)", () => {
  test("a chunk that loads is used as it is, loaded once", async () => {
    const chunk = failing(0)
    expect(await lazyChunkWithRetry(chunk.load, Notice, { wait: async () => {} })).toEqual({ default: Form })
    expect(chunk.calls()).toBe(1)
  })
  test("a failed load is retried once after a short wait; a retry that loads is used", async () => {
    const chunk = failing(1), waits: number[] = []
    expect(await lazyChunkWithRetry(chunk.load, Notice, { wait: async ms => { waits.push(ms) } })).toEqual({ default: Form })
    expect([chunk.calls(), waits]).toEqual([2, [500]])
  })
  test("when the retry fails too, the reload notice stands in for the form (never an error, never a third attempt)", async () => {
    const chunk = failing(5), seen: unknown[] = []
    expect(await lazyChunkWithRetry(chunk.load, Notice, { wait: async () => {}, report: error => seen.push(error) })).toEqual({ default: Notice })
    expect(chunk.calls()).toBe(2)
    expect(String(seen[0])).toContain("Failed to fetch dynamically imported module")
  })
  test("every lazy chunk of the Scope 3 screens goes through the retry, with the reload notice as its fallback", async () => {
    const source = await Bun.file(new URL("../components/scope3/lazy-forms.tsx", import.meta.url)).text()
    const lazies = source.match(/\blazy\(/g) ?? []
    expect(lazies.length).toBe(5)
    expect(source.match(/\blazy\(\(\) => lazyChunkWithRetry\(\(\) => import\("\.\/[A-Za-z0-9]+"\)\.then\(module => module\.[A-Za-z0-9]+\), NewerVersionNotice\)\)/g)?.length).toBe(lazies.length)
  })
  test("the notice says a newer version is available and its button reloads the page", async () => {
    const reloads: number[] = []
    const make = await loadComponent("./scope3/lazy-forms.tsx", "NewerVersionNotice", { lazy: () => () => null, Suspense: "suspense", lazyChunkWithRetry, LAZY_TEXT_R2C, window: { location: { reload: () => reloads.push(1) } } })
    const app = harness(make, () => ({}))
    await app.settle()
    expect(app.text()).toContain(LAZY_TEXT_R2C.newerVersion)
    expect(LAZY_TEXT_R2C.newerVersion).toStartWith("A newer version is available — reload")
    app.button(LAZY_TEXT_R2C.reload)!.props.onClick()
    expect(reloads).toEqual([1])
    expect(app.nodes().find(node => node.props.role === "alert")).toBeDefined()
  })
})
