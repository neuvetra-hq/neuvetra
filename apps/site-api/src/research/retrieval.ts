import type { AnswerStatus, Proposition, VerifiedRelease } from './types'

export const normalize = (text: string): string => text.toLowerCase().replace(/[‐‑–—-]/g, ' ').replace(/\s+/g, ' ').trim()
export const suspicious = (text: string): boolean => /ignore (?:all |any |the )?(?:previous|prior|system)|system prompt|developer message|<\/?(?:script|system|assistant)|reveal.{0,20}(?:secret|key)|execute.{0,20}(?:command|tool)|override.{0,20}instructions/i.test(text)

export interface QuestionRoute {
  status?: AnswerStatus
  missingContext: string[]
  topics: string[]
  questionKind?: 'general_concept' | 'company_specific'
}

// A deliberately narrow, inspectable boundary for the reviewed concept demo.
// This is routing, not a substitute for source-backed answers or factor selection.
export function routeQuestion(question: string): QuestionRoute {
  const text = normalize(question)
  const route = (status: AnswerStatus, missingContext: string[] = []): QuestionRoute => ({ status, missingContext, topics: [] })
  if (suspicious(text)) return route('needs_review')
  // EPA's released conceptual prose does not establish another publisher's
  // obligations or support financial/procurement decisions, even when those
  // questions contain the same method and electricity keywords.
  if (/\b(worldwide|global|globally|international|ghg protocol|mandatory|obligations?|pricing|prices?|costs?|cheapest|cheaper|expensive|financial|income|profits?|bills?|best supplier|software|platforms?|apps?|tools?|vendors?)\b/.test(text)) return route('unsupported')
  if (/\b(zero|neutral|neutrality|net zero|avoided|physical|additionality|eligible|eligibility|direct line|on site|onsite|steam|heating|cooling|organizational boundary)\b/.test(text)) return route('unsupported')
  if (/\b(calculate|compute|convert|tonnes?|tons?|co2e|kilograms?|multiply|kwh|mwh|filing|file|deadline|sb\s*25[13]|sb\s*261|law|laws|legal|legally|regulatory|statute|compliance|carb|assurance|audit)\b/.test(text)) return route('unsupported')
  if (/\b(draft|proposal|consultation|superseded|withdrawn|latest|newest|current rule)\b/.test(text)) return route('stale_or_conflicting')
  if (/\b(factor|factors|rate)\b/.test(text) && /\b(my|our|company|office|facility|which|select|use|choose)\b/.test(text)) {
    const missing: string[] = []
    if (!/\b(california|united states|u\.?s\.?|[a-z]+,\s*[a-z]{2})\b/.test(text)) missing.push('location')
    if (!/\b20\d{2}\b/.test(text)) missing.push('reporting_period')
    if (!/\b(supplier|utility|contract|tariff|rec|certificate)\b/.test(text)) missing.push('electricity_supply')
    return route(missing.length ? 'needs_input' : 'unsupported', missing)
  }
  // The reviewed release describes concepts; it cannot decide applicability to
  // a company's historical inventory or any jurisdiction-specific obligation.
  if (/\b(19|20)\d{2}\b/.test(text) || /\b(eu|europe|uk|united kingdom|china|india|canada|australia|brazil|mexico|japan|germany|france|scope\s*[13])\b/.test(text)) return route('unsupported')
  const reporting = /\b(report|reports|reporting|reported)\b/.test(text)
  if (reporting && /\b(must|required|have to|need to|should|obliged)\b/.test(text) && /\b(my|our|we|i|this company)\b/.test(text)) return route('unsupported')
  const scope2 = /\bscope\s*2\b/.test(text)
  const epaMethods = /\bepa\b/.test(text) && reporting && /\bmethods?\b/.test(text)
  const domain = scope2 || epaMethods || /\belectricity\b|\b(?:location|market) based\b/.test(text)
  if (!domain) return route('unsupported')
  const comparison = (/\b(different|differently|difference|differ|compare|comparison|contrast|versus)\b/.test(text) || (!reporting && /\b(two|both|between)\b/.test(text))) && /\b(methods?|accounting|approaches?|results?|scope\s*2)\b/.test(text)
  const location = comparison || /\blocation based\b|\b(grid|regional|average)\b/.test(text)
  const market = comparison || /\bmarket based\b|\b(contractual|supplier|certificate|rec|renewable)\b/.test(text)
  const topics = [location ? 'location_based' : '', market ? 'market_based' : ''].filter(Boolean)
  // Compound questions need every requested concept. The reviewed reporting
  // recommendation and its explanatory rationale are separate evidence topics;
  // neither a method definition nor the context checklist can stand in for them.
  if (reporting) {
    topics.push('dual_reporting')
    if (/\b(why|reason|reasons|rationale|purpose|benefit|benefits)\b/.test(text) || /\bexplain\b.{0,100}\brecommendation\b/.test(text)) topics.push('reporting_rationale')
  }
  if (!topics.length) return route('unsupported')
  const diagnosticTarget = /\b(results?|totals?|numbers?|figures?|inventory|inventories)\b/.test(text) || (/\bemissions\b/.test(text) && /\b(why|differ|different|higher|lower|discrepancy)\b/.test(text))
  const companyContext = diagnosticTarget && /\b(my|our|company|office|facility|plant|actual|measured)\b/.test(text)
  const personalDiagnostic = diagnosticTarget && /\b(?:we|i)\s+(?:got|get|have|see|reported|recorded|used|purchased)\b/.test(text)
  return { topics, missingContext: [], questionKind: companyContext || personalDiagnostic ? 'company_specific' : 'general_concept' }
}

export function retrieve(question: string, verified: VerifiedRelease, topics: string[], limit = 6): Proposition[] {
  const text = normalize(question)
  const tokens = new Set(text.match(/[a-z0-9]+/g) ?? [])
  const scored = verified.propositions.filter(item => topics.includes(item.topic)).map(item => {
    const keywordScore = item.keywords.reduce((score, keyword) => {
      const normalized = normalize(keyword)
      return score + (text.includes(normalized) ? 4 : normalized.split(' ').some(word => word.length > 3 && tokens.has(word)) ? 1 : 0)
    }, 0)
    return { item, score: keywordScore }
  }).filter(item => item.score > 0)
  scored.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id, 'en'))
  const selected = scored.slice(0, limit).map(value => value.item)
  if (topics.some(topic => !selected.some(item => item.topic === topic))) return []
  return selected
}
