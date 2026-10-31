// Round 2 lane E (ACC-6; Claude, 31 October 2026): the uncertainty topic of the methodology states the published 95 percent
// confidence intervals where a factor source prints one (NETL, DOE/NETL-2024/4862, Executive Summary p. 2: 5.7–12.7 around
// 8.8 and 4.9–11.5 around 7.8 g CO2e/MJ, both transcribed twice verbatim) and, for every calculated category, why the
// uncertainty is not quantified, as CARB proposes (SB 253 staff workshop, 21 July 2026, slide 14).
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { scope3MethodologyStatement } from './scope3-methodology'
import { SCOPE3_UNCERTAINTY_TEXT } from './scope3-text'
import { SCOPE3_UNCERTAINTY_TEXT_R2E as U } from './scope3-text-r2e'

const fixture = JSON.parse(readFileSync(new URL('../../../apps/site-web/src/lib/scope3-results.fixture.json', import.meta.url), 'utf8'))
const transcriptions = JSON.parse(readFileSync(new URL('../../../tools/method-reference/sources/us-upstream-transcriptions.json', import.meta.url), 'utf8'))
const uncertainty = (category: number) => scope3MethodologyStatement(fixture.coverage.categories[category - 1], fixture.records).filter(s => s.topic === 'uncertainty').map(s => s.text)

describe('round 2 lane E (ACC-6): published ranges and the CARB "why not quantified" explanation', () => {
  test('the NETL ranges in the texts are the transcribed ci95 values, quoted verbatim in both reads, and the percent spans are right', () => {
    const value = (id: string) => transcriptions.values.find((v: { id: string }) => v.id === id)
    const distribution = value('netl2024_4862.ng_upstream.prod_through_distribution'), transmission = value('netl2024_4862.ng_upstream.prod_through_transmission')
    expect([distribution.value, distribution.ci95, distribution.agreed, transmission.value, transmission.ci95, transmission.agreed]).toEqual(['8.8', '5.7–12.7', true, '7.8', '4.9–11.5', true])
    for (const v of [distribution, transmission]) for (const quote of [v.quote1, v.quote2]) expect(quote).toContain(`95 percent mean confidence interval of ${v.ci95} g CO2e/MJ`)
    expect(U.netlDistribution).toContain('5.7–12.7 g CO2e/MJ around its 8.8 g CO2e/MJ')
    expect(U.netlTransmission).toContain('4.9–11.5 g CO2e/MJ around its 7.8 g CO2e/MJ')
    // Independent arithmetic: (low / central − 1) and (high / central − 1), rounded to whole percent.
    const span = (low: number, central: number, high: number) => `about −${Math.round((1 - low / central) * 100)}% to +${Math.round((high / central - 1) * 100)}%`
    expect(U.netlDistribution).toContain(span(5.7, 8.8, 12.7))
    expect(U.netlTransmission).toContain(span(4.9, 7.8, 11.5))
  })

  test('category 3 with natural gas upstream (3A) and electricity upstream (3B, 3C upstream) states both NETL ranges, then why it is not quantified', () => {
    const row = fixture.coverage.categories[2]
    const lines = uncertainty(3)
    expect(lines).toEqual([SCOPE3_UNCERTAINTY_TEXT[row.profile.dominantMethodType as keyof typeof SCOPE3_UNCERTAINTY_TEXT], U.netlDistribution, U.netlTransmission, U.notQuantified])
  })

  test('a category without a NETL factor gets only the qualitative sentence and the explanation; one with nothing calculated gets none', () => {
    for (const row of fixture.coverage.categories.filter((r: { category: number; profile: unknown }) => r.category !== 3 && r.profile)) {
      expect(uncertainty(row.category)).toEqual([SCOPE3_UNCERTAINTY_TEXT[row.profile.dominantMethodType as keyof typeof SCOPE3_UNCERTAINTY_TEXT], U.notQuantified])
    }
    for (const row of fixture.coverage.categories.filter((r: { profile: unknown }) => !r.profile)) expect(uncertainty(row.category)).toEqual([])
    expect(U.notQuantified).toContain('slide 14')
  })
})
