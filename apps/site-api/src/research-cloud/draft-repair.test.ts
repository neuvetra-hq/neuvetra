import {test,expect} from 'bun:test'
import {analyzeDraftForRepair} from './draft-repair'
import {parseCloudDraft} from './answer-contract'
import type {Passage,Plan} from '../research-passages/types'
const p=(id:string,dependencies:string[]=[]):Passage=>({id,source_id:'source',extraction_id:'extract',title:'Synthetic source',coverage:[],text:'The synthetic source explains a conceptual relationship with an important condition. '+ 'A sufficiently long reviewed passage supports bounded conceptual discussion. '.repeat(16),sha256:'a'.repeat(64),locator:'Page 1',locator_detail:{normalization:'nfkc_whitespace_v1',spans:[]},required_passage_ids:dependencies,qualifications:['Preserve this condition.'],exclusions:[],review_status:'approved',rights_scope:'approved_internal_research_evaluation_only'})
const selected=[p('S01',['S02']),p('S02'),p('S03')]
const facets:Plan['facets']=[{id:'f1',request:'Explain a concept.',passage_ids:['S01']}]
const claim=()=>({text:'A synthetic conceptual explanation.',passage_ids:['S01'],support:[{passage_id:'S01',quote:selected[0]!.text.slice(0,90)}]})
const draft=()=>({answers:[{facet_id:'f1',claims:[claim()]}]})
test('valid authoritative draft returns no repair; nonexact quote gets diagnostics without replacement content',()=>{
  expect(analyzeDraftForRepair(draft(),selected,facets,[])).toBeNull()
  const raw=draft();raw.answers[0]!.claims[0]!.support[0]!.quote='A noncontiguous ... invented quote.'
  const packet=analyzeDraftForRepair(raw,selected,facets,[])!
  expect(packet.kind).toBe('draft_contract');expect(packet.previous_candidate_trust).toBe('untrusted')
  expect(packet.issues).toEqual([{code:'quote_not_exact',facet_id:'f1',claim_index_0based:0,passage_id:'S01',quote_index_0based:0}])
  expect(()=>parseCloudDraft(raw,selected,facets,[])).toThrow('draft_invalid')
  raw.answers[0]!.claims[0]!.text='Changed after analysis'
  expect(packet.previous_candidate.answers[0]!.claims[0]!.text).toBe('A synthetic conceptual explanation.')
  expect(Object.keys(packet.issues[0]!)).not.toContain('replacement')
})
test('numeric failure hidden behind an earlier quote error still prevents repair',()=>{
  const raw=draft();raw.answers[0]!.claims[0]!.support=[]
  raw.answers[0]!.claims.push({...claim(),text:'Your emissions are 600 kg CO2e.'})
  expect(analyzeDraftForRepair(raw,selected,facets,[])).toBeNull()
})
test('unknown citations, quotes outside own closure, extra fields and duplicate or empty groups fail closed',()=>{
  for(const mutate of [
    (r:ReturnType<typeof draft>)=>{r.answers[0]!.claims[0]!.passage_ids=['unknown']},
    (r:ReturnType<typeof draft>)=>{r.answers[0]!.claims[0]!.support[0]!.passage_id='S03'},
    (r:ReturnType<typeof draft>)=>{r.answers[0]!.claims[0]!.support[0]!.passage_id='unknown'},
    (r:ReturnType<typeof draft>)=>{Object.assign(r.answers[0]!.claims[0]!,{extra:'ignored?'})},
    (r:ReturnType<typeof draft>)=>{r.answers.push(r.answers[0]!)},
    (r:ReturnType<typeof draft>)=>{r.answers=[]},
    (r:ReturnType<typeof draft>)=>{r.answers[0]!.claims=[]},
    (r:ReturnType<typeof draft>)=>{r.answers[0]!.claims[0]!.support.push(r.answers[0]!.claims[0]!.support[0]!)},
  ]) {const raw=draft();mutate(raw);expect(analyzeDraftForRepair(raw,selected,facets,[])).toBeNull()}
  expect(analyzeDraftForRepair(draft(),[...selected,{...p('S04'),review_status:'pending'}],facets,[])).toBeNull()
})
test('known selected citation outside facet and dependency-only primary omission are diagnosable without suggested IDs',()=>{
  const wrong=draft();wrong.answers[0]!.claims[0]!.passage_ids=['S03'];wrong.answers[0]!.claims[0]!.support[0]!.passage_id='S03'
  expect(analyzeDraftForRepair(wrong,selected,facets,[])!.issues.map(i=>i.code)).toEqual(['citation_outside_facet','primary_citation_missing'])
  const dependency=draft();dependency.answers[0]!.claims[0]!.passage_ids=['S02'];dependency.answers[0]!.claims[0]!.support[0]!.passage_id='S02'
  expect(analyzeDraftForRepair(dependency,selected,facets,[])!.issues.map(i=>i.code)).toEqual(['primary_citation_missing'])
})
test('missing own anchor and exact quote bounds are diagnosed; raw quote cap stays strict',()=>{
  const missing=draft();missing.answers[0]!.claims[0]!.support=[]
  expect(analyzeDraftForRepair(missing,selected,facets,[])!.issues[0]!.code).toBe('own_quote_missing')
  for(const length of [11,901]) {
    const raw=draft();raw.answers[0]!.claims[0]!.support[0]!.quote=selected[0]!.text.slice(0,length)
    expect(analyzeDraftForRepair(raw,selected,facets,[])!.issues.map(i=>i.code)).toEqual(['quote_length_out_of_bounds'])
  }
  const huge=draft();huge.answers[0]!.claims[0]!.support[0]!.quote='x'.repeat(2001)
  expect(analyzeDraftForRepair(huge,selected,facets,[])).toBeNull()
})
test('soft contract counts and text limits diagnose while the outer16/12000/2000/32000 envelope remains closed',()=>{
  const nine=draft();nine.answers[0]!.claims=Array.from({length:9},claim)
  expect(analyzeDraftForRepair(nine,selected,facets,[])!.issues.map(i=>i.code)).toEqual(['claim_count_exceeded','facet_paragraph_count'])
  const long=draft();long.answers[0]!.claims=Array.from({length:5},()=>({...claim(),text:'x'.repeat(851)}))
  expect(analyzeDraftForRepair(long,selected,facets,[])!.issues.map(i=>i.code)).toEqual(['total_text_too_long','facet_paragraph_count',...Array(5).fill('claim_text_too_long')])
  const tooMany=draft();tooMany.answers[0]!.claims=Array.from({length:17},claim)
  expect(analyzeDraftForRepair(tooMany,selected,facets,[])).toBeNull()
  const tooLong=draft();tooLong.answers[0]!.claims[0]!.text='x'.repeat(2001)
  expect(analyzeDraftForRepair(tooLong,selected,facets,[])).toBeNull()
  const total=draft();total.answers[0]!.claims=Array.from({length:7},()=>({...claim(),text:'x'.repeat(1800)}))
  expect(analyzeDraftForRepair(total,selected,facets,[])).toBeNull()
  const utf=draft();utf.answers[0]!.claims=Array.from({length:15},()=>({...claim(),text:'界'.repeat(750)}))
  expect(Buffer.byteLength(JSON.stringify(utf))).toBeGreaterThan(32000)
  expect(analyzeDraftForRepair(utf,selected,facets,[])).toBeNull()
})
test('diagnostic ordering is stable across reordered groups and original facet requirements remain fixed',()=>{
  const f=[...facets,{id:'f2',request:'A second concept.',passage_ids:['S03']}]
  const first={facet_id:'f1',claims:[{...claim(),support:[]}]},second={facet_id:'f2',claims:[{...claim(),passage_ids:['S03'],support:[]}]}
  const a=analyzeDraftForRepair({answers:[first,second]},selected,f,[])!,b=analyzeDraftForRepair({answers:[second,first]},selected,f,[])!
  expect(a.issues).toEqual(b.issues);expect(a.issues.map(i=>i.facet_id)).toEqual(['f1','f2'])
  expect(analyzeDraftForRepair({answers:[first,first]},selected,f,[])).toBeNull()
})

test('one paragraph per facet prevents source-by-source expansion without discarding conditions',()=>{
  const raw=draft();raw.answers[0]!.claims.push(claim())
  expect(()=>parseCloudDraft(raw,selected,facets,[])).toThrow('draft_invalid')
  expect(analyzeDraftForRepair(raw,selected,facets,[])!.issues.map(i=>i.code)).toEqual(['facet_paragraph_count'])
  const consolidated=draft();consolidated.answers[0]!.claims[0]!.text='A conceptual explanation has an important condition. That condition remains in this same paragraph.'
  expect(parseCloudDraft(consolidated,selected,facets,[])[0]!.text).toContain('condition')
})
