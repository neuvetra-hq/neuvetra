import { z } from 'zod';
import catalog from './data/naics-2022.json';

export const naics = catalog.filter(row => row.code.length === 6);
export const sectors = catalog.filter(row => row.code === row.sector);
const byCode = new Map(naics.map(row => [row.code, row]));
const sectorByCode = new Map(sectors.map(row => [row.code, row.title]));
const UNKNOWN = /^(not sure|unknown|tbd|n\/a)$/i;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;
function text(min, max, label, multiline = false) {
  return z.string({error:`Enter ${label}.`}).trim()
    .min(min, `Use at least ${min} characters for ${label}.`)
    .max(max, `Use ${max} characters or fewer.`)
    .refine(value => !CONTROL.test(value) && (multiline || !/[\r\n\t]/.test(value)), 'Remove hidden control characters.')
    .refine(value => !/[<>]/.test(value), 'Use plain text, without HTML or script markup.')
    .refine(value => min===0 || /[\p{L}\p{N}]/u.test(value), 'Include a letter or number.')
    .refine(value => min===0 || !UNKNOWN.test(value), 'This answer is still open. Add it when known.');
}
export const legalName = text(2, 200, 'the legal company name');
export const role = text(2, 120, 'the responsible role').refine(value=>/\p{L}/u.test(value),'Enter a role containing words, not only numbers.');
export const geography = text(2, 200, 'the headquarters location');
const optionalText = (max,multiline=false) => text(0,max,'this field',multiline).default('');
const optionalField = schema => z.preprocess(value=>typeof value==='string'&&!value.trim()?'':value, schema.or(z.literal('')).default(''));
const activity = z.enum([...sectors.map(row=>row.title),'Other'], {error:'Choose a business activity from the list, or choose Other.'});
export const companySchema = z.object({
  legal: legalName,
  trading: optionalText(200).refine(value=>!value||value.length>=2,'Use at least 2 characters, or leave the trading name blank.'),
  country: text(2,100,'the headquarters country or territory').refine(value=>/\p{L}/u.test(value),'Enter a country or territory name.'),
  region: optionalField(geography),
  industry: activity,
  other: optionalText(600,true),
  additional: optionalText(600,true),
  role: optionalField(role),
  naics: z.string().trim().default('').refine(value=>!value||/^\d{6}$/.test(value),'Enter a six-digit 2022 NAICS code, or leave it blank.')
    .refine(value=>!value||byCode.has(value),'This code is not in the 2022 U.S. NAICS list. Search for a current code or leave it blank.'),
}).superRefine((company,ctx)=>{
  if(company.industry==='Other' && (company.other.length<3 || UNKNOWN.test(company.other)))ctx.addIssue({code:'custom',path:['other'],message:'Describe what the business makes or does using at least 3 characters.'});
  const match=byCode.get(company.naics);
  if(match && company.industry!==sectorByCode.get(match.sector))ctx.addIssue({code:'custom',path:['naics'],message:'This code belongs to a different sector. Change the sector or choose a matching code.'});
});
export function parseCompany(company) {
  // Inactive conditional text never invalidates or enters the accepted snapshot.
  return companySchema.safeParse({...company,other:company.industry==='Other'?company.other:''});
}
export function errors(company) {
  const result=parseCompany(company);
  if(result.success)return {};
  const resultErrors={};
  for(const issue of result.error.issues)if(!resultErrors[issue.path[0]])resultErrors[issue.path[0]]=issue.message;
  return resultErrors;
}
// Draft storage accepts incomplete/invalid answers for later correction, but rejects
// malformed types. It never treats a stored draft as a validated company snapshot.
const rawRecord=z.record(z.string(),z.string().max(10000));
export const draftSchema=z.object({
  company:rawRecord,period:rawRecord,boundary:rawRecord,
  entities:z.array(rawRecord).max(500),locations:z.array(rawRecord).max(1000),
  changes:z.array(rawRecord).length(5),sources:z.array(rawRecord).length(5),
  review:z.object({complete:z.boolean().optional(),needed:z.boolean().optional(),role:z.string().max(10000).optional()}),
});
// Shared numeric primitives for later page-by-page integration. Blank is never zero.
// Decimal accounting arithmetic remains in the existing deterministic backend.
export const finiteNumber=z.number().finite();
export const positiveNumber=finiteNumber.positive();
export const negativeNumber=finiteNumber.negative();
export const nonnegativeNumber=finiteNumber.nonnegative();
export const percent=finiteNumber.min(0).max(100);
export const integer=finiteNumber.int();
export function numericForm(schema) {
  return z.string().trim().min(1,'Enter a number; blank is not zero.')
    .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/,'Enter a number using digits and a decimal point.')
    .transform(Number).pipe(schema);
}
export function findCode(code){return byCode.get(code);}
export function sectorTitle(code){return sectorByCode.get(code);}
export function searchNaics(query,sectorTitleFilter=''){
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return naics.filter(row=>(!sectorTitleFilter||sectorByCode.get(row.sector)===sectorTitleFilter)&&terms.every(term=>(row.code+' '+row.title).toLowerCase().includes(term)));
}

export const locationStartModes=['Active from the reporting-period start','Specific coverage start date','Not sure'];
export const locationEndModes=['Still active at the reporting-period end','Specific coverage end date','Not sure'];
const locationText=(min,max)=>z.string({error:'Enter an answer, or enter Not sure.'}).trim().min(min,`Use at least ${min} characters, or enter Not sure.`).max(max,`Use ${max} characters or fewer.`).refine(v=>!CONTROL.test(v)&&!/[<>]/.test(v),'Use plain text without markup or hidden control characters.');
const optionalDate=z.iso.date({error:'Enter a valid calendar date.'}).or(z.literal('')).default('');
export function locationModes(location){return {...location,startMode:location.startMode||(location.from?'Specific coverage start date':''),endMode:location.endMode||(location.to?'Specific coverage end date':'')};}
export function locationPeriod(period){
  if(!z.iso.date().safeParse(period.start).success||!z.iso.date().safeParse(period.end).success||period.start>period.end)return {error:'Choose a valid reporting start and end date in Reporting period before confirming location coverage.'};
  if(period.start<'2025-01-01')return {error:'This reporting period begins before 2025. The dates are retained, but location coverage needs review before continuing.'};
  return {min:period.start,max:period.end};
}
export function locationSchema(period,entities){
  const bounds=locationPeriod(period);
  return z.object({
    id:z.string().min(1),name:locationText(2,200),country:locationText(2,100),
    locality:locationText(3,500),region:optionalText(200),purpose:locationText(3,600),
    entity:z.string({error:'Choose a reporting entity, Other or Not sure.'}).refine(v=>entities.includes(v)||['Other','Not sure'].includes(v),'Choose a current reporting entity, Other or Not sure.'),
    otherEntity:optionalText(200),occupancy:z.enum(['Owned','Leased','Shared','Other','Not sure'],{error:'Choose an occupancy arrangement.'}),
    control:z.enum(['Reporting company','Related entity','Landlord','Shared control','Other','Not sure'],{error:'Choose who operates or controls the equipment.'}),
    operator:optionalText(600,true),included:z.enum(['Include','Exclude — review needed','Not sure'],{error:'Choose an inclusion decision or Not sure.'}),
    reason:locationText(3,600),startMode:z.enum(locationStartModes,{error:'Choose when coverage starts, or Not sure.'}),
    endMode:z.enum(locationEndModes,{error:'Choose when coverage ends, or Not sure.'}),
    from:optionalDate,to:optionalDate,opened:optionalDate,
  }).superRefine((l,ctx)=>{
    const issue=(key,message)=>ctx.addIssue({code:'custom',path:[key],message});
    if(l.entity==='Other'&&l.otherEntity.trim().length<2)issue('otherEntity','Name the entity, or enter Not sure.');
    if(['Related entity','Landlord','Shared control','Other'].includes(l.control)&&l.operator.trim().length<3)issue('operator','Identify the operator or explain the control arrangement, or enter Not sure.');
    if(bounds.error)return;
    for(const [key,mode,expected] of [['from','startMode',locationStartModes[1]],['to','endMode',locationEndModes[1]]]){
      if(l[mode]===expected){if(!l[key])issue(key,'Enter the coverage date, or select Not sure.');else if(l[key]<bounds.min||l[key]>bounds.max)issue(key,`Use a date from ${bounds.min} through ${bounds.max}. The previous value has been kept for correction.`);}
    }
    const start=l.startMode===locationStartModes[0]?bounds.min:l.startMode===locationStartModes[1]?l.from:'';
    const end=l.endMode===locationEndModes[0]?bounds.max:l.endMode===locationEndModes[1]?l.to:'';
    if(start&&end&&end<start)issue('to','Coverage cannot end before it starts.');
    if(l.opened&&start&&l.opened>start)issue('opened','The original opening date cannot be after the coverage start.');
  });
}
export function locationErrors(location,period,entities){
  const l=locationModes(location);
  // Preserve inactive saved values in the raw draft, but do not treat them as coverage.
  const candidate={...l,from:l.startMode===locationStartModes[1]?l.from:'',to:l.endMode===locationEndModes[1]?l.to:'',otherEntity:l.entity==='Other'?l.otherEntity:''};
  const result=locationSchema(period,entities).safeParse(candidate);
  if(result.success)return {};
  const issues={};for(const issue of result.error.issues)if(!issues[issue.path[0]])issues[issue.path[0]]=issue.message;
  return issues;
}
