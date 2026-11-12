// WO-11: the report versions table names its approval as internal, not external assurance, and is a focusable region.
import { expect, test } from "bun:test"

const source = await Bun.file(new URL("./scope3/Scope3ReportVersions.tsx", import.meta.url)).text()

test("the approval column header says internal approval, not external assurance", () => {
  expect(source).toContain('APPROVAL_HEADING = "Internal approval (by your company — not external assurance)"')
  expect(source).toContain("<th>{APPROVAL_HEADING}</th>")
})
test("every scroll wrapper in the versions panel is a labelled, focusable region", () => {
  const wrappers = source.match(/<div className="nv-report__scroll[^>]*>/g) ?? []
  expect(wrappers).toHaveLength(2)
  for (const tag of wrappers) { expect(tag).toContain('role="region"'); expect(tag).toContain("aria-label="); expect(tag).toContain("tabIndex={0}") }
})
