/* eslint-disable @typescript-eslint/no-explicit-any -- test harness: runs a real component's source with injected hooks, no DOM. */
// BF1 (Claude, 14 October 2026): shared by bf1-regressions.test.tsx. Test-only; nothing in the app imports it.
// Same technique as StagingWorkspace.test.tsx: transpile the component, inject hooks and dependencies, drive props.
type Node = { type: unknown; props: Record<string, any>; children: any[] }

export async function loadComponent(file: string, name: string, injected: Record<string, unknown>) {
  const { instrumentEvidenceClaims } = await import("../../../../packages/neuvetra-database/src/collection-engine-input")
  const source = await Bun.file(new URL(file, import.meta.url)).text()
  const body = source.replace(/^import [\s\S]*?from "[^"]+"\n/gm, "").replace(/^export (function|const|async function)/gm, "$1").replace(/^export type .*\n/gm, "")
  const script = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h", jsxFragmentFactory: "Fragment" } } }).transformSync(body) + `\nreturn ${name}`
  return (hooks: Record<string, unknown>) => {
    const all = { instrumentEvidenceClaims, ...injected, ...hooks }
    return new Function(...Object.keys(all), script)(...Object.values(all)) as (props: unknown) => Node
  }
}

export function harness(make: (hooks: Record<string, unknown>) => (props: unknown) => Node, props: () => Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const slots: any[] = [], pending: Array<() => void> = []
  let cursor = 0, changed = false, tree: Node
  const same = (a?: unknown[], b?: unknown[]) => a?.length === b?.length && a?.every((value, index) => Object.is(value, b?.[index]))
  function useState(initial: any) {
    const index = cursor++
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
    return [slots[index], (next: any) => { const value = typeof next === "function" ? next(slots[index]) : next; if (!Object.is(value, slots[index])) { slots[index] = value; changed = true } }]
  }
  function useRef(initial: any) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }) }
  function useCallback(fn: any, deps: unknown[]) { const index = cursor++, previous = slots[index]; if (!previous || !same(previous.deps, deps)) slots[index] = { fn, deps }; return slots[index].fn }
  function useMemo(fn: any, deps: unknown[]) { const index = cursor++, previous = slots[index]; if (!previous || !same(previous.deps, deps)) slots[index] = { value: fn(), deps }; return slots[index].value }
  function useEffect(effect: () => void | (() => void), deps?: unknown[]) {
    const index = cursor++, previous = slots[index]
    if (!previous || !deps || !same(previous.deps, deps)) pending.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() } })
  }
  function useReducer(reducer: any, initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (action: any) => { const value = reducer(slots[index], action); if (!Object.is(value, slots[index])) { slots[index] = value; changed = true } }] }
  const h = (type: unknown, p: Record<string, any> | null, ...children: any[]): Node => ({ type, props: p ?? {}, children })
  const Component = make({ useState, useRef, useCallback, useMemo, useEffect, useReducer, h, Fragment: "fragment", React: { Fragment: "fragment" }, ...globals })
  function render() { cursor = 0; tree = Component(props()) }
  async function settle() {
    for (let pass = 0; pass < 200; pass++) {
      while (pending.length) pending.shift()!()
      await new Promise(resolve => setTimeout(resolve, 0))
      if (changed) { changed = false; render(); continue }
      if (!pending.length) return
    }
    throw new Error("did not settle")
  }
  function flatten(value: any): Node[] { return Array.isArray(value) ? value.flatMap(flatten) : value && typeof value === "object" && "type" in value ? [value, ...value.children.flat(Infinity).flatMap(flatten)] : [] }
  const nodes = () => flatten(tree)
  const text = () => nodes().flatMap(node => node.children.flat(Infinity).filter((item: unknown) => typeof item === "string" || typeof item === "number")).join(" ")
  const byLabel = (label: string) => nodes().find(node => node.props.label === label)
  const button = (label: string) => nodes().find(node => node.type === "button" && node.children.flat(Infinity).join("").includes(label))
  render()
  return { settle, nodes, text, byLabel, button, render }
}
