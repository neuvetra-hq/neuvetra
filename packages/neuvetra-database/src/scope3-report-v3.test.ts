import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildScope3ReportDocument, scope3ReportText, scope3ReportCsv, validateScope3ReportDocument } from './scope3-report-document'
import { scope3Readiness, scope3VisibleReviewFlags, type Scope3ResultsDocument } from './scope3-trace'
import { scope3MethodologyStatement } from './scope3-methodology'
import { scope3Csv } from './scope3-report-csv'
import { SCOPE3_DISCLOSURE_TEXT_R2A, SCOPE3_DISCLOSURE_TEXT_R3A } from './scope3-text'
const fixture = (): Scope3ResultsDocument => JSON.parse(readFileSync(new URL('../../../apps/site-web/src/lib/scope3-results.fixture.json', import.meta.url), 'utf8'))
const labels = {kind:(x:string)=>x,reason:(x:string)=>x,period:(a:any,b:any)=>`${a} to ${b}`}
const build = (results:Scope3ResultsDocument) => buildScope3ReportDocument({results,reportingYear:2025,revision:1,setupVersionId:'93100000-0000-4000-8000-0000000000c1',consolidationApproach:'operational_control',preparedBy:'93100000-0000-4000-8000-0000000000a1',preparedAt:'2026-10-31T10:00:00.000Z',previous:null})
const hash=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex')
describe('report v3 acceptance',()=>{
 test('untouched-delivery v2 golden opens with its original bytes',()=>{
  const bytes=readFileSync(new URL('./testdata/scope3-report-v2-golden.json',import.meta.url)); const g=JSON.parse(bytes.toString());
  expect(hash(bytes)).toBe('afe721888ac7f8b5ec5bcec0096756045bc3825cf03697be7bc2f9a88398ad0f');
  expect(hash(g.reportText)).toBe(g.reportSha256);expect(hash(g.csvText)).toBe(g.csvSha256);
  expect(validateScope3ReportDocument(JSON.parse(g.reportText),g.companyId).profile).toBe('neuvetra.scope3-report.v2');
 })
 test('included category without records remains an acknowledged open issue with a complete assessment',()=>{
  const f=fixture(), row=structuredClone(f.coverage.categories[3]!); row.screening.decision='included';
  row.assessment={...structuredClone(f.coverage.categories.find(r=>r.assessment)!.assessment!),withinCategoryExclusions:[]};
  expect(scope3Readiness([row],[]).openIssues).toContainEqual({category:4,code:'included_category_has_no_records'});
  row.assessment.withinCategoryExclusions=[{noteCode:'building_other_energy_sources_not_included',justification:'No data available',magnitudeKind:'not_quantifiable',magnitudeTCo2e:null,basis:'No meter available'}];
  expect(scope3Readiness([row],[]).openIssues).toContainEqual({category:4,code:'included_category_has_no_records'});
  row.assessment.withinCategoryExclusions[0]!.noteCode='third_party_facilities_not_included';
  expect(scope3Readiness([row],[]).openIssues).toContainEqual({category:4,code:'included_category_has_no_records'});
  row.screening.decision='excluded'; expect(scope3Readiness([row],[]).openIssues).not.toContainEqual({category:4,code:'included_category_has_no_records'});
  row.status='input_needed'; expect(scope3Readiness([row],[]).openIssues).toContainEqual({category:4,code:'input_needed'});
 })
 test('new documents write v3 and freeze the new readiness issue',()=>{
  const f=fixture(); f.readiness={ready:false,openIssues:[{category:10,code:'included_category_has_no_records'} as any]};
  const d=build(f); expect(d.profile).toBe('neuvetra.scope3-report.v3');
  expect(validateScope3ReportDocument(JSON.parse(scope3ReportText(d)),f.companyId).results.readiness).toEqual(f.readiness);
  expect(scope3ReportCsv(d,labels)).toContain('No records for an included category');
 })
 test('outside-period, excluded and withdrawn records cannot close the included-category gap',()=>{
  const f=fixture(), row=structuredClone(f.coverage.categories[3]!); row.screening.decision='included'; row.status='no_records';
  row.assessment=structuredClone(f.coverage.categories.find(r=>r.assessment)!.assessment!);
  const line=structuredClone(f.records[0]!); line.category=4; line.result=null;
  for (const variant of [
   {...line,outcome:'outside_period' as const},
   {...line,outcome:'held' as const,plan:{...line.plan,status:'excluded' as const}},
   {...line,outcome:'held' as const,plan:{...line.plan,status:'withdrawn' as const}},
  ]) expect(scope3Readiness([row],[variant]).openIssues).toContainEqual({category:4,code:'included_category_has_no_records'});
  // A27 still discloses an optional pending activity without downgrading an otherwise covered category.
  expect(scope3Readiness([row],[{...line,outcome:'held',plan:{...line.plan,status:'method_pending',optional:true}}]).openIssues)
   .not.toContainEqual({category:4,code:'included_category_has_no_records'});
 })
 test('methodology and CSV use the capped label and grouped narrative figures',()=>{
  const f=fixture(),row=f.coverage.categories.find(r=>r.profile)!; const p=row.profile!;
  p.dataQuality.overall.label='good'; row.dataQualityLabel={label:'fair',engineLabel:'good',capped:true,reasons:['lines_not_quantified']};
  p.deflationEffect={display:'20438.1954',unrounded:'20438.1954'} as any;
  const words=scope3MethodologyStatement(row,f.records).map(s=>s.text).join(' ');
  expect(words).toContain('20,438.1954'); expect(words).not.toContain('overall Good');
  const csv=scope3Csv(f,labels); expect(csv).not.toContain('overall Good');
 })
 test('category 10 states the partner-only limitation and never implies missing processor data is zero',()=>{
  const f=fixture(),row=f.coverage.categories[9]!;row.screening.decision='included';
  const words=scope3MethodologyStatement(row,[]).map(s=>s.text).join(' ');
  expect(words).toContain('average-data processing estimate');expect(words).toContain('processor data');expect(words).toContain('not zero');
 })
 test('new accounting disclosures qualify recharge, inflation and oil-proxy uncertainty',()=>{
  expect(SCOPE3_DISCLOSURE_TEXT_R3A.end_of_life_remaining_charge_memo_upper_bound).toContain('no recharge');
  expect(SCOPE3_DISCLOSURE_TEXT_R2A.price_index_latest_published_year_used).toContain('If prices rose');
  expect(SCOPE3_DISCLOSURE_TEXT_R2A.oil_fired_upstream_proxied_by_ulsd).toContain('uncertain direction');
 })
 test('currency provenance is legible in CSV and frozen independently of subsequent edits; malformed provenance is refused',()=>{
  const f=fixture(),line=f.records[0]!; line.kind='purchase_spend';line.derivedFrom=null;
  line.quantity={value:'120',unit:'USD'};line.currencyConversion={currency:'EUR',amount:'100',rate:'1.2',usd:'120',rateSource:'ECB reference',rateDate:'2025-02-03'};
  const doc=build(f), text=scope3ReportText(doc),csv=scope3ReportCsv(doc,labels);
  expect(csv).toContain('Currency conversion: EUR 100 × 1.2 USD per EUR = USD 120 (rate source: ECB reference; rate date: 2025-02-03');
  expect(csv).toContain('Currency conversion provenance');
  line.currencyConversion.rateSource='Later edit';
  const frozen=validateScope3ReportDocument(JSON.parse(text),f.companyId);
  expect(frozen.results.records.find(r=>r.kind==='purchase_spend')!.currencyConversion!.rateSource).toBe('ECB reference');
  const bad=JSON.parse(text);bad.results.records.find((r:any)=>r.kind==='purchase_spend').currencyConversion.rate='2';
  expect(()=>validateScope3ReportDocument(bad,f.companyId)).toThrow();
 })
 test('review prompts use the same count and category thresholds',()=>{
  const f=fixture(),row=f.coverage.categories[0]!;row.screening.decision='included';row.reviewFlags=['largest_record_over_tenth_of_category','category_over_half_of_known_total','spend_based_dominant'] as any;
  row.counts.calculated=4;row.counts.partialBoundary=0;
  const one=[{subtotal:{display:'0'} as any}],two=[...one,...one];
  expect(scope3VisibleReviewFlags(row,one)).toEqual(['spend_based_dominant']);
  row.counts.calculated=5;expect(scope3VisibleReviewFlags(row,two)).toEqual(row.reviewFlags);
  expect(scope3MethodologyStatement(row,f.records,one).filter(s=>s.topic==='review').length).toBe(2);
 })
 test('superseded EEIO methodology states stored memo and replacement, outside totals',()=>{
  const f=fixture(),row=f.coverage.categories[0]!,line=structuredClone(f.records[0]!);row.screening.decision='included';line.category=1;
  line.supersededSpendMemo={supersededBy:'supplier-1',status:'calculated',wouldBe:{display:'20438.1954',unrounded:'20438.1954'},methodVersionId:null,inputSha256:null,resultSha256:null,reasons:[],replacing:{co2e:{display:'2000.0000',unrounded:'2000'},spendLines:1,wouldBeTotalUnrounded:'20438.1954'},reviewFlags:['superseding_figure_review']} as any;
  const words=scope3MethodologyStatement(row,[line]).map(s=>s.text).join(' ');
  expect(words).toContain('20,438.1954 kg CO2e would have been calculated');expect(words).toContain('outside every total');expect(words).toContain('supplier-1');expect(words).toContain('2,000.0000');
  expect(scope3MethodologyStatement(row,[]).some(s=>s.topic==='memo')).toBe(false);
 })
})
