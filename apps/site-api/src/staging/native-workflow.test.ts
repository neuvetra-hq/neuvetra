import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { parse } from "yaml"

type Step = { run?: string; env?: Record<string, string> }

test("native capacity reports run after legacy fixture copies without dropping staged suites", () => {
  const workflow = parse(readFileSync(new URL("../../../../.github/workflows/verify.yml", import.meta.url), "utf8")) as {
    jobs: { "native-postgres": { steps: Step[] } }
  }
  const steps = workflow.jobs["native-postgres"].steps
  const scope3 = ["scope3-postgres", "scope3-reports-postgres", "scope3-round2-postgres", "scope3-round3-postgres"]
    .map(name => `apps/site-api/src/staging/${name}.test.ts`)
  const staged = ["apps/site-api/src/staging/postgres.test.ts", ...scope3,
    ...["m66", "m67", "m68", "m71"].map(name => `apps/site-api/src/workspace/${name}-postgres.test.ts`)]
  const commands = steps.flatMap(step => (step.run ?? "").split(/\s+/))
  for (const suite of staged) expect(commands.filter(word => word === suite)).toHaveLength(1)

  // Full-cap reports exceed the old fixture copier's single-jsonb limit. Keep those
  // reports intact, but create all historical fixtures before their capacity run.
  const capacityIndex = steps.findIndex(step => step.run?.includes(scope3[3]!))
  expect(capacityIndex).toBe(steps.length - 1)
  const capacity = steps[capacityIndex]!
  for (const suite of scope3) expect(capacity.run!.split(/\s+/)).toContain(suite)
  expect(capacity.env?.M63_API_TEST_DATABASE_URL).toBe("postgres://m63_test_admin@127.0.0.1:55463/m63_integration")
})
