import { expect, test } from "bun:test"
import * as api from "../../apps/site-web/src/lib/m80-beta-api"
import * as state from "../../apps/site-web/src/lib/m80-beta-ui-state"

const fixture = await Bun.file("evaluations/research-qa/m80-setup-integration-independent-20260924-fixture.json").json()
const source = await Bun.file("apps/site-web/src/components/Scope1BetaSetup.tsx").text()
const stripped = source.replace(/^import[\s\S]*?from ["'][^"']+["']\r?\n/gm, "").replace("export function Scope1BetaSetup", "function Scope1BetaSetup")
const script = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h", jsxFragmentFactory: "Fragment" } } }).transformSync(stripped) + "\nreturn Scope1BetaSetup"

// Exercise the actual component and its effects with isolated transport and hook state.
function harness() {
  const slots: any[] = [], effects: any[] = [], queued: (() => void)[] = []
  const requests: { company: string; actor: any; resolve: (value: any) => void }[] = []
  let cursor = 0, tree: any
  const props: any = { actor: { userId: fixture.currentVersion.createdBy, accessToken: "original", role: "owner" }, workspaceId: fixture.fixtureAdmission.companyId, headingRef: { current: null } }
  const h = (type: any, props: any, ...children: any[]) => ({ type, props: props ?? {}, children })
  const useEffect = (fn: () => any, deps: any[]) => {
    const index = cursor++, old = effects[index]
    if (!old || deps.some((value, position) => value !== old.deps[position])) queued.push(() => { old?.cleanup?.(); effects[index] = { deps, cleanup: fn() } })
  }
  const useRef = (value: any) => { const index = cursor++; return slots[index] ?? (slots[index] = { current: value }) }
  const useState = (value: any) => { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next }] }
  const loadM80Foundation = (company: string, actor: any) => {
    let resolve!: (value: any) => void
    const promise = new Promise<any>(done => { resolve = done })
    requests.push({ company, actor, resolve })
    return promise
  }
  const bindings = { useEffect, useRef, useState, ...api, ...state, loadM80Foundation, h, Fragment: "fragment" }
  const component = new Function(...Object.keys(bindings), script)(...Object.values(bindings))
  const render = () => { cursor = 0; tree = component(props); while (queued.length) queued.shift()!(); return tree }
  const flat = (node: any): any[] => node && typeof node === "object" && node.type ? [node, ...node.children.flat(Infinity).flatMap(flat)] : []
  const nodes = () => flat(tree)
  const button = (label: string) => nodes().find(node => node.type === "button" && node.children.includes(label))
  const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); render() }
  const cleanup = () => { for (const effect of effects) effect?.cleanup?.() }
  render()
  return { requests, props, render, flush, nodes, button, cleanup }
}

const readOnly = (view: ReturnType<typeof harness>) => {
  expect(view.button("Refresh legacy setup")).toBeDefined()
  expect(view.button("Make a correction")).toBeUndefined()
  expect(view.button("Save synthetic correction")).toBeUndefined()
  expect(view.nodes().filter(node => ["input", "select", "textarea"].includes(node.type))).toEqual([])
}

test("loaded historical fixture is visible but has no correction controls", async () => {
  const view = harness()
  view.requests[0].resolve(structuredClone(fixture)); await view.flush()
  readOnly(view)
  view.cleanup()
})

test("token refresh preserves the read-only view and aborts its old request authority", async () => {
  const view = harness()
  view.requests[0].resolve(structuredClone(fixture)); await view.flush()
  view.props.actor.accessToken = "refreshed"
  view.render(); await view.flush()
  expect(view.requests).toHaveLength(1)
  expect(view.requests[0].actor.signal.aborted).toBe(true)
  readOnly(view)
  view.cleanup()
})

test("actor and workspace changes reject late loads", async () => {
  for (const kind of ["actor", "workspace"] as const) {
    const view = harness(), old = view.requests[0]
    if (kind === "actor") view.props.actor = { ...view.props.actor, userId: crypto.randomUUID() }
    else view.props.workspaceId = crypto.randomUUID()
    view.render(); await view.flush()
    expect(old.actor.signal.aborted).toBe(true)
    expect(view.button("Refresh legacy setup")).toBeUndefined()
    expect(view.requests).toHaveLength(2)
    old.resolve(structuredClone(fixture)); await view.flush()
    expect(view.button("Refresh legacy setup")).toBeUndefined()
    view.requests[1].resolve(structuredClone(fixture)); await view.flush()
    readOnly(view)
    view.cleanup()
  }
})

test("actor and workspace changes hide a loaded fixture before the next load", async () => {
  for (const kind of ["actor", "workspace"] as const) {
    const view = harness()
    view.requests[0].resolve(structuredClone(fixture)); await view.flush()
    readOnly(view)
    if (kind === "actor") view.props.actor = { ...view.props.actor, userId: crypto.randomUUID() }
    else view.props.workspaceId = crypto.randomUUID()
    view.render(); await view.flush()
    expect(view.requests[0].actor.signal.aborted).toBe(true)
    expect(view.button("Refresh legacy setup")).toBeUndefined()
    expect(view.requests).toHaveLength(2)
    view.requests[1].resolve(structuredClone(fixture)); await view.flush()
    readOnly(view)
    view.cleanup()
  }
})

test("token refresh during initial load ignores the old response", async () => {
  const view = harness()
  view.props.actor.accessToken = "new-during-load"
  view.render(); await view.flush(); await view.flush()
  expect(view.requests[0].actor.signal.aborted).toBe(true)
  expect(view.requests).toHaveLength(2)
  expect(view.requests[1].actor.accessToken).toBe("new-during-load")
  view.requests[0].resolve(structuredClone(fixture)); await view.flush()
  expect(view.button("Refresh legacy setup")).toBeUndefined()
  view.requests[1].resolve(structuredClone(fixture)); await view.flush()
  readOnly(view)
  view.cleanup()
})

test("unmount aborts and ignores a late fixture response", async () => {
  const view = harness()
  view.cleanup()
  expect(view.requests[0].actor.signal.aborted).toBe(true)
  view.requests[0].resolve(structuredClone(fixture)); await view.flush()
  expect(view.button("Refresh legacy setup")).toBeUndefined()
})

test("actor signal abortion clears a previously visible fixture", async () => {
  const view = harness(), controller = new AbortController()
  view.props.actor = { ...view.props.actor, signal: controller.signal }
  view.render()
  view.requests.at(-1)!.resolve(structuredClone(fixture)); await view.flush()
  readOnly(view)
  controller.abort(); await view.flush()
  expect(view.button("Refresh legacy setup")).toBeUndefined()
  expect(view.nodes().filter(node => ["input", "select", "textarea"].includes(node.type))).toEqual([])
  view.cleanup()
})

test("manual refresh uses current authority and remains read-only", async () => {
  const view = harness()
  view.requests[0].resolve(structuredClone(fixture)); await view.flush()
  view.props.actor.accessToken = "refreshed"
  view.render(); await view.flush()
  view.button("Refresh legacy setup").props.onClick()
  expect(view.requests).toHaveLength(2)
  expect(view.requests[1].actor.accessToken).toBe("refreshed")
  view.requests[1].resolve(structuredClone(fixture)); await view.flush()
  readOnly(view)
  view.cleanup()
})
