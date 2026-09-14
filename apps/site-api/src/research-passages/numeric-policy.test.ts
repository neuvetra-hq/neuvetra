import { describe, expect, test } from 'bun:test'
import { validateConceptualNumbers } from './numeric-policy'

// Synthetic wording only. Copying a value into evidence must not authorize
// quantitative output in this conceptual-only preview.
const rejected = (claim: string) => expect(() => validateConceptualNumbers(claim, [claim])).toThrow('numeric_output_not_allowed')
const allowed = (claim: string) => expect(() => validateConceptualNumbers(claim, [claim])).not.toThrow()

describe('conceptual factor-value output boundary', () => {
  test('zero and nonzero factor modifiers are blocked in either common word order', () => {
    for (const claim of [
      'The certificate may have a factor of zero.',
      'The certificate may have a zero factor.',
      'The certificate may have a zero emission factor.',
      'The certificate may have a 0 factor.',
      'The certificate may have a nonzero factor.',
      'The certificate may have a non-zero emission factor.',
      'The certificate may have a non zero factor.',
      'Use a zero-factor example.',
      'Use a zero-emission-factor example.',
      'Use a non-zero-factor example.',
      'Use a 0-factor example.',
    ]) rejected(claim)
  })

  test('signed, negative and decimal factor modifiers remain quantitative even when their digits occur in the source', () => {
    for (const claim of [
      'Use a negative factor.',
      'Use a negative-emission-factor example.',
      'Use a negative one factor.',
      'Use a minus two emission factor.',
      'Use a positive factor.',
      'Use a positive three factor.',
      'Use a -1 factor.',
      'Use a +2 emission factor.',
      'Use a -0.5-factor example.',
      'Use a 0.5 emission factor.',
      'Use a 0.0-factor example.',
      'Use a 1e-3 emission factor.',
      'Use a +1.5e-2-factor example.',
      'Use a one-valued factor.',
      'Use a 5-valued emission factor.',
    ]) rejected(claim)
  })

  test('Unicode normalization and common hyphen/minus spellings do not evade factor-value checks', () => {
    for (const claim of [
      'Use a ZERO EMISSION FACTOR.',
      'Use a ０ factor.',
      'Use a zero\u2011factor example.',
      'Use a non\u2010zero emission factor.',
      'Use a zero\u2013emission\u2013factor example.',
      'Use a \u22120.5 emission factor.',
      'Use a zero\u00a0factor.',
      'Use a ＋２ emission factor.',
    ]) rejected(claim)
  })

  test('qualitative terminology, counts, source editions and unit notation remain valid', () => {
    for (const claim of [
      'Compare regional grid-average and supplier-specific emission factors.',
      'The low-carbon electricity product still needs documented emission-factor boundaries.',
      'Check non-numeric factor metadata and the factor source.',
      'Two emission factors can describe different accounting perspectives.',
      'One factor can describe the grid-average perspective.',
      'The 2023 emission factors come from a named source edition.',
      'The 2023 guidance discusses Scope 2 factors; kg CO2e/kWh is a unit notation.',
      'EPA recommends reporting two emissions totals.',
    ]) allowed(claim)
  })

  test('existing quantitative checks and the known conservative pronoun refusal are not relaxed', () => {
    for (const claim of [
      'Your emissions are 2023 kg CO2e.',
      'Your emissions are 2023.',
      'You have zero emissions.',
      'Use an emission factor of 2023.',
      'Use 2kgCO2e/kWh.',
      'Use twenty-one tonnes.',
      'Use one hundred and twelve kWh.',
      'An unusable factor: one covering only supplier-owned generation.',
    ]) rejected(claim)
    expect(() => validateConceptualNumbers('The source edition was 2099.', ['December 2023'])).toThrow('numeric_output_not_allowed')
  })
})
