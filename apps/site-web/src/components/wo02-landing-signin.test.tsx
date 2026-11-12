/* eslint-disable @typescript-eslint/no-explicit-any -- the harness runs the real Landing source with injected hooks, no DOM. */
// WO-02 (Claude, 11 November 2026): a failed sign-in is announced once by role="alert" placed above the actions, focus moves
// to Email, Email gets aria-invalid until it is edited, and the Sign in button stays focusable while busy. Not a browser or
// screen-reader demonstration: the tests check the rendered nodes and the focus calls.
import { expect, test } from "bun:test"
import { harness, loadComponent } from "./component-harness"
import { SIGN_IN_INPUT_ERROR, signInNoticeTone } from "@/lib/sign-in-notice"

const FAILED = "Sign-in failed. Check your invited account details."

async function landing(initial: Partial<Record<string, unknown>> = {}) {
  const calls: string[] = []
  const props: Record<string, unknown> = { ready: true, busy: false, message: "Sign in with your invited account.", email: "a@b.example", password: "x",
    onEmail: (value: string) => calls.push(`email:${value}`), onPassword: () => {}, onSignIn: () => calls.push("signIn"), onSendLink: () => calls.push("sendLink"), ...initial }
  const make = await loadComponent("./Landing.tsx", "Landing", {
    Icon: () => null, signInNoticeTone, SIGN_IN_INPUT_ERROR,
    document: { title: "", getElementById: () => null },
    window: { addEventListener() {}, removeEventListener() {}, setTimeout() {}, location: { hash: "" }, history: { replaceState() {} } },
  })
  const app = harness(make, () => props)
  await app.settle()
  const email = () => app.nodes().find(node => node.type === "input" && node.props.type === "email")!
  email().props.ref.current = { focus: () => calls.push("focus:email") }
  const form = () => app.nodes().find(node => node.type === "form")!
  const set = async (next: Record<string, unknown>) => { Object.assign(props, next); app.render(); await app.settle() }
  return { app, calls, email, form, set }
}
const alerts = (app: any) => app.nodes().filter((node: any) => node.props.role === "alert")

test("a wrong password: one alert above the actions, focus on Email, aria-invalid until Email is edited", async () => {
  const { app, calls, email, form, set } = await landing()
  form().props.onSubmit({ preventDefault() {} })
  await set({ busy: true, message: "Signing in…" })
  expect(calls).toEqual(["signIn"])
  await set({ busy: false, message: FAILED })
  expect(calls).toEqual(["signIn", "focus:email"])
  expect(email().props["aria-invalid"]).toBe(true)
  expect(alerts(app)).toHaveLength(1)
  // The alert sits before the Sign in button inside the form.
  const formChildren = form().children.flat(Infinity).filter((child: any) => child && typeof child === "object")
  const alertAt = formChildren.findIndex((child: any) => child.props.role === "alert"), submitAt = formChildren.findIndex((child: any) => child.props.type === "submit")
  expect(alertAt).toBeGreaterThanOrEqual(0)
  expect(alertAt).toBeLessThan(submitAt)
  email().props.onChange({ target: { value: "c@d.example" } })
  app.render(); await app.settle()
  expect(email().props["aria-invalid"]).toBeUndefined()
})

test("a page-load error does not move focus or mark Email invalid", async () => {
  const { calls, email, set, app } = await landing()
  await set({ message: "Private staging is unavailable. Please try again later." })
  expect(calls).toEqual([])
  expect(email().props["aria-invalid"]).toBeUndefined()
  expect(alerts(app)).toHaveLength(1)
})

test("a service error after sign-in moves focus to Email but does not call the email invalid", async () => {
  const { calls, email, form, set } = await landing()
  form().props.onSubmit({ preventDefault() {} })
  await set({ busy: true, message: "Signing in…" })
  await set({ busy: false, message: "Sign-in is unavailable. Please try again." })
  expect(calls).toEqual(["signIn", "focus:email"])
  expect(email().props["aria-invalid"]).toBeUndefined()
})

test("while busy the Sign in button stays focusable, reads Signing in… and does not submit again", async () => {
  const { app, calls, form } = await landing({ busy: true, message: "Signing in…" })
  const submit = app.nodes().find(node => node.type === "button" && node.props.type === "submit")!
  expect(submit.props.disabled).toBe(false)
  expect(submit.props["aria-disabled"]).toBe(true)
  expect(submit.children.flat(Infinity).join("")).toBe("Signing in…")
  let prevented = false
  form().props.onSubmit({ preventDefault() { prevented = true } })
  app.button("Email me a sign-in link")!.props.onClick()
  expect(prevented).toBe(true)
  expect(calls).toEqual([])
  expect(alerts(app)).toHaveLength(0)
})
