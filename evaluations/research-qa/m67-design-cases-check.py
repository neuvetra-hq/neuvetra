"""Independent design-case arithmetic; no product imports or database writes."""
import hashlib,json,re
from decimal import Decimal,localcontext,ROUND_HALF_EVEN
from pathlib import Path
src=Path('evaluations/research-qa/m67-accounting-cases.json')
d=json.loads(src.read_text(encoding='utf-8-sig'))
months=[f'2023-{i:02}' for i in range(1,13)]
checks=0
def equal(actual,expected):
 global checks
 checks+=1
 assert actual==expected,(actual,expected)
def plain(v):
 t=format(v,'f')
 return t.rstrip('0').rstrip('.') if '.' in t else t
def display(v):return format(v.quantize(Decimal('0.0001'),rounding=ROUND_HALF_EVEN),'.4f')
def amount(v):return type(v) is str and re.fullmatch(r'(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,3})?',v,flags=re.ASCII) is not None and Decimal(v)<=1000000
with localcontext() as ctx:
 ctx.prec=96
 for case in d['accepted_cases']:
  e=case['expected'];rows=case['months'];equal([x['month'] for x in rows],months)
  entered=[];missing=[];monthly_displays=Decimal(0)
  for row,out in zip(rows,e['months'],strict=True):
   equal(out['month'],row['month'])
   if row['quantityKwh'] is None:
    missing.append(row['month'])
    for key in ['quantity_kwh','quantity_mwh','unrounded_kg_co2e','display_kg_co2e']:equal(out[key],None)
   else:
    equal(amount(row['quantityKwh']),True);q=Decimal(row['quantityKwh']);entered.append(q);kg=q*Decimal('0.1950402888')
    equal(out['quantity_kwh'],format(q,'.3f'));equal(out['quantity_mwh'],format(q/1000,'.6f'));equal(out['unrounded_kg_co2e'],plain(kg));equal(out['display_kg_co2e'],display(kg));monthly_displays+=Decimal(display(kg))
  q=sum(entered);kg=q*Decimal('0.1950402888')
  equal(e['quantity_kwh'],format(q,'.3f'));equal(e['quantity_mwh'],format(q/1000,'.6f'));equal(e['total_unrounded_kg_co2e'],plain(kg));equal(e['total_display_kg_co2e'],display(kg));equal(e['sum_of_monthly_displays_kg_co2e'],format(monthly_displays,'.4f'));equal(e['display_minus_sum_month_displays_kg_co2e'],format(Decimal(display(kg))-monthly_displays,'.4f'))
  equal(e['coverage'],{'knownMonths':len(entered),'missingMonths':missing,'electricityComplete':len(entered)==12});equal(e['complete'],False);equal(e['releaseEligible'],False);equal(e['evidenceBasis'],'synthetic_manual_without_linked_bills')
  equal(e['subtotal_label'],'Full-year electricity subtotal \u2014 all 12 months entered' if len(entered)==12 else 'Entered-month electricity subtotal')
  scaled=int(q*1000)*1950402888;quot,rem=divmod(scaled,10**9);quot+=rem>500000000 or (rem==500000000 and quot%2==1);equal(format(Decimal(quot)/10000,'.4f'),e['total_display_kg_co2e'])
 for case in d['rejected_cases']:
  if 'replace_january_quantity'in case:equal(amount(case['replace_january_quantity']),False)
 equal(next(c for c in d['rejected_cases'] if c['id']=='unicode_digit')['replace_january_quantity'],'\u0661')
result={'status':'passed','scope':'independent Decimal96 and integer aggregate check; no SQL/product/frontend execution','acceptedCases':len(d['accepted_cases']),'monthSlots':12*len(d['accepted_cases']),'directInvalidQuantityCases':sum('replace_january_quantity'in c for c in d['rejected_cases']),'assertions':checks,'caseCanonicalLfSha256':hashlib.sha256(src.read_bytes().decode('utf-8-sig').replace('\r\n','\n').encode()).hexdigest()}
print(json.dumps(result))
