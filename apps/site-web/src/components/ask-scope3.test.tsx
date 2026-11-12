/* eslint-disable @typescript-eslint/no-explicit-any */
// WO-03: the Ask drawer answers "Do you calculate Scope 3?" from the workspace's Scope 3 state, shows each answer's
// review date, and is still a modal that closes on Escape.
import { expect, test } from "bun:test"
import * as help from "@/lib/help-content"
import { progressAnswer } from "@/lib/journey-status"
import { harness, loadComponent } from "./component-harness"

async function drawer(status: any, statusFailed = false) {
  const listeners: Record<string, (event: any) => void> = {}
  let closed = 0
  const api = { ...help, progressAnswer, Icon: () => null, document: { activeElement: null, addEventListener: (name: string, fn: any) => { listeners[name] = fn }, removeEventListener() {} }, window: { setTimeout: () => 0 } }
  const make = await loadComponent("./AskNeuvetra.tsx", "AskNeuvetra", api)
  const app = harness(make, () => ({ open: true, onClose: () => { closed++ }, panel: "home", status, statusFailed, onNavigate: () => {} }))
  await app.settle()
  const ask = async (question: string) => { app.nodes().find(node => node.type === "input")!.props.onChange({ target: { value: question } }); await app.settle(); app.nodes().find(node => node.type === "form")!.props.onSubmit({ preventDefault() {} }); await app.settle() }
  return { app, ask, listeners, closed: () => closed }
}

test("Scope 3 on: the on-answer and its review date", async () => {
  const { app, ask } = await drawer({ scope3: true })
  await ask("Do you calculate Scope 3?")
  expect(app.text()).toContain("Yes, in beta. Neuvetra calculates draft Scope 3 figures")
  expect(app.text().replace(/\s+/g, " ")).toContain(`Reviewed ${help.HELP_REVIEWED_ON}`)
  expect(app.text()).not.toContain("isn’t switched on")
})

test("Scope 3 off: the off-answer", async () => {
  const { app, ask } = await drawer({})
  await ask("Do you calculate Scope 3?")
  expect(app.text()).toContain("Scope 3 isn’t switched on in this workspace.")
  expect(app.text()).not.toContain("Yes, in beta")
})

test("status not loaded or failed: neutral wording, and Escape still closes the modal", async () => {
  for (const [status, failed] of [[null, false], [null, true], [{ scope3: true }, true]] as const) {
    const { app, ask, listeners, closed } = await drawer(status, failed)
    await ask("Do you calculate Scope 3?")
    expect(app.text()).toContain("depends on your workspace")
    expect(app.text()).not.toMatch(/Yes, in beta|isn’t switched on/)
    expect(app.nodes().some(node => node.props.role === "dialog" && node.props["aria-modal"] === "true")).toBe(true)
    listeners.keydown!({ key: "Escape" })
    expect(closed()).toBe(1)
  }
})
