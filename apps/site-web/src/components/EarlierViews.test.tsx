// WO-07: #/earlier is a static, read-only list of the retired milestone views.
import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EarlierViews } from "./EarlierViews"

const visited: string[] = []
const html = renderToStaticMarkup(createElement(EarlierViews, { headingRef: { current: null }, onNavigate: view => { visited.push(view) } }))
const text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ")

test("the heading and introduction say the views are retired and read-only", () => {
  expect(html).toMatch(/<h1 tabindex="-1">Earlier workspace views \(retired\)<\/h1>/)
  expect(text).toContain("These milestone views were replaced by Company setup, Activity & evidence and Results & report. They’re listed for reference only; no data is shown and nothing can be changed here.")
})

test("each of the 14 retired views has a plain name, a Retired chip and a link to the view that replaced it", () => {
  expect(html.match(/<li>/g)).toHaveLength(14)
  expect(html.match(/>Retired</g)).toHaveLength(14)
  expect(html.match(/Use instead: <a /g)).toHaveLength(14)
  const targets = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1])
  expect(new Set(targets)).toEqual(new Set(["#/setup", "#/activity", "#/results"]))
})

test("no milestone code, button or form appears", () => {
  expect(text).not.toMatch(/\(M\d/)
  expect(text).not.toMatch(/\bM\d{2}\b/)
  expect(html).not.toMatch(/<(button|form|input|select|textarea)\b/)
})
