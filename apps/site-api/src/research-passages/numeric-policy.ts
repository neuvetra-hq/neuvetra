import { PassageError } from './release'

const scopeReference = /\bscope[\s-]*2\b/gi
const literals = (value: string): string[] => [...value.matchAll(/(?<![\p{L}\p{N}_])[-+]?\d+(?:[.,]\d+)*(?:[eE][-+]?\d+)?(?![\p{L}\p{N}_])/gu)].map(match => match[0].replaceAll(',', ''))
const numberWord = String.raw`(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)`
const amount = String.raw`(?:[-+]?\d+(?:[.,]\d+)*(?:[eE][-+]?\d+)?(?:\s+(?:hundred|thousand|million|billion))?|${numberWord}(?:[ -]+(?:and[ -]+)?${numberWord})*)`
const unit = String.raw`(?:kwh|mwh|gwh|wh|kilowatt[ -]?hours?|megawatt[ -]?hours?|joules?|gj|mj|(?:tonnes?|tons?|t|kilograms?|kg|grams?|g|pounds?|lbs?)(?:\s*co2e?)?|co2e?)`
const quantity = new RegExp(String.raw`\b${amount}\s*${unit}\b`, 'i')
const zeroEmissions = /\b(?:zero|0)\s+emissions?\b/i
const resultPredicate = new RegExp(String.raw`\b(?:emissions?|factors?|intensity|consumption|usage|activity|footprint|total)(?:\s+[a-z-]+){0,4}(?:\s+(?:is|are|was|were|equals?|totals?|of)\s+|\s*[=:]\s*)(?:about\s+|approximately\s+)?${amount}\b`, 'i')

/**
 * Output-side provenance and dimensional guard for conceptual research only.
 * This does not calculate values or prove semantics. It deliberately withholds
 * quantitative examples/results even if copied from evidence; unit names and
 * source edition years without a result quantity remain usable.
 */
export function validateConceptualNumbers(claim: string, evidenceAndVersions: string[]): void {
  const withoutScopeLabel = claim.normalize('NFKC').replace(scopeReference, 'scope reference')
  const approvedNumbers = new Set(evidenceAndVersions.flatMap(value => literals(value.normalize('NFKC').replace(scopeReference, 'scope reference'))))
  if (literals(withoutScopeLabel).some(number => !approvedNumbers.has(number)) || quantity.test(withoutScopeLabel) || zeroEmissions.test(withoutScopeLabel) || resultPredicate.test(withoutScopeLabel)) throw new PassageError('numeric_output_not_allowed')
}
