/** Bounded machine diagnostics, not draft approval or a content repair. The
 * caller may spend one correction allowance on a whole redraft, then must run
 * parseCloudDraft and a fresh complete source review. No model calls occur here.
 */
import { dependencyClosure, PassageError, record } from '../research-passages/release'
import { validateConceptualNumbers } from '../research-passages/numeric-policy'
import type { Passage, Plan } from '../research-passages/types'
import { answerLimits, parseCloudDraft } from './answer-contract'

export type DraftRepairCode = 'claim_count_exceeded' | 'facet_paragraph_count' | 'claim_text_too_long' | 'total_text_too_long'
  | 'citation_outside_facet' | 'primary_citation_missing' | 'own_quote_missing' | 'quote_length_out_of_bounds' | 'quote_not_exact'
export interface DraftRepairIssue {
  code: DraftRepairCode; facet_id: string | null; claim_index_0based: number | null
  passage_id: string | null; quote_index_0based: number | null
}
interface CandidateClaim { text: string; passage_ids: string[]; support: { passage_id: string; quote: string }[] }
interface Candidate { answers: { facet_id: string; claims: CandidateClaim[] }[] }
export interface DraftRepairPacket {
  kind: 'draft_contract'; previous_candidate_trust: 'untrusted'; previous_candidate: Candidate; issues: DraftRepairIssue[]
}
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v,k))
const string = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const ids = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length > 0 && v.length <= max && v.every(id=>string(id,120)) && new Set(v).size === v.length

export function analyzeDraftForRepair(raw: unknown, selected: Passage[], facets: Plan['facets'], versions: string[]): DraftRepairPacket | null {
  try {
    const serialized = JSON.stringify(raw)
    if (typeof serialized !== 'string' || Buffer.byteLength(serialized,'utf8') > 32000) return null
    if (!record(raw) || !exact(raw,['answers']) || !Array.isArray(raw.answers) || !raw.answers.length || !facets.length || facets.length > 16
      || raw.answers.length !== facets.length || new Set(facets.map(f=>f.id)).size !== facets.length) return null
    if (!selected.length || selected.length > 32 || new Set(selected.map(p=>p.id)).size !== selected.length
      || selected.some(p=>!string(p.id,120) || typeof p.text !== 'string' || p.review_status !== 'approved' || p.rights_scope !== 'approved_internal_research_evaluation_only')
      || !versions.every(v=>typeof v==='string')) return null
    const available = new Set(selected.map(p=>p.id)), eligible = new Map<string,Set<string>>()
    for (const facet of facets) {
      if (!string(facet.id,120) || !ids(facet.passage_ids,32) || facet.passage_ids.some(id=>!available.has(id))) return null
      eligible.set(facet.id,new Set(dependencyClosure(facet.passage_ids,selected).map(p=>p.id)))
    }
    const groups = new Map<string,CandidateClaim[]>(); let total=0,count=0
    for (const group of raw.answers) {
      if (!record(group) || !exact(group,['facet_id','claims']) || !string(group.facet_id,120) || !eligible.has(group.facet_id)
        || groups.has(group.facet_id) || !Array.isArray(group.claims) || !group.claims.length) return null
      for (const item of group.claims) {
        if (!record(item) || !exact(item,['text','passage_ids','support']) || !string(item.text,2000) || !ids(item.passage_ids,8)
          || item.passage_ids.some(id=>!available.has(id)) || !Array.isArray(item.support) || item.support.length > answerLimits.maxQuotes) return null
        count++; total+=item.text.length
        if (count>16 || total>12000) return null
        const own=dependencyClosure(item.passage_ids,selected),seen=new Set<string>()
        for (const quote of item.support) {
          if (!record(quote) || !exact(quote,['passage_id','quote']) || !string(quote.passage_id,120) || typeof quote.quote!=='string'
            || quote.quote.length>2000 || !own.some(p=>p.id===quote.passage_id)) return null
          const key=JSON.stringify([quote.passage_id,quote.quote]);if(seen.has(key))return null;seen.add(key)
        }
        // Check every claim before diagnosing other failures: a prior length or
        // quote error must never conceal a prohibited quantitative result.
        validateConceptualNumbers(item.text,[...own.map(p=>p.text),...versions])
      }
      groups.set(group.facet_id,group.claims as CandidateClaim[])
    }
    // Authoritative validation remains the decision boundary. Unexpected error
    // classes, empty drafts and numeric refusals do not become repair requests.
    try { parseCloudDraft(raw,selected,facets,versions); return null }
    catch(error) { if (!(error instanceof PassageError) || error.code!=='draft_invalid') return null }
    const issues: DraftRepairIssue[]=[]
    const add=(code:DraftRepairCode,facet_id:string|null=null,claim_index_0based:number|null=null,passage_id:string|null=null,quote_index_0based:number|null=null)=>issues.push({code,facet_id,claim_index_0based,passage_id,quote_index_0based})
    if(count>answerLimits.maxClaims)add('claim_count_exceeded')
    if(total>answerLimits.totalCharacters)add('total_text_too_long')
    for(const facet of facets) {
      if(groups.get(facet.id)!.length !== 1)add('facet_paragraph_count',facet.id)
      for(const [index,item] of groups.get(facet.id)!.entries()) {
        if(item.text.length>answerLimits.claimCharacters)add('claim_text_too_long',facet.id,index)
        for(const id of item.passage_ids) if(!eligible.get(facet.id)!.has(id))add('citation_outside_facet',facet.id,index,id)
        if(!item.passage_ids.some(id=>facet.passage_ids.includes(id)))add('primary_citation_missing',facet.id,index)
        for(const [quoteIndex,quote] of item.support.entries()) {
          if(quote.quote.trim().length<12 || quote.quote.length>answerLimits.quoteCharacters)add('quote_length_out_of_bounds',facet.id,index,quote.passage_id,quoteIndex)
          if(!selected.find(p=>p.id===quote.passage_id)!.text.includes(quote.quote))add('quote_not_exact',facet.id,index,quote.passage_id,quoteIndex)
        }
        for(const id of item.passage_ids) if(!item.support.some(q=>q.passage_id===id))add('own_quote_missing',facet.id,index,id)
      }
    }
    return issues.length ? {kind:'draft_contract',previous_candidate_trust:'untrusted',previous_candidate:JSON.parse(serialized) as Candidate,issues} : null
  } catch { return null }
}
