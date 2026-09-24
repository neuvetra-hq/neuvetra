"""Independent M74 expectations. No application imports or author fixtures."""
from fractions import Fraction as F
from decimal import Decimal,localcontext,ROUND_HALF_EVEN
from pathlib import Path
from zipfile import ZipFile
import json,hashlib,xml.etree.ElementTree as E
ROOT=Path(__file__).resolve().parent
SOURCE=Path('C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-factors-hub-2025.xlsx')
SOURCE_HASH='43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7'
def exact(value):
    d=value.denominator;n=value.numerator;places=0
    while d!=1:
        divisor=2 if d%2==0 else 5 if d%5==0 else None
        assert divisor is not None
        d//=divisor
        places+=1
    scale=10**places;whole,remainder=divmod(n*scale//value.denominator,scale)
    return str(whole) if not remainder else (str(whole)+'.'+str(remainder).zfill(places)).rstrip('0')
def display(value):
    q,r=divmod(value.numerator*10000,value.denominator)
    if r*2>value.denominator or r*2==value.denominator and q%2:q+=1
    return str(q//10000)+'.'+str(q%10000).zfill(4)
def expected(gallons,miles):
    g,d=F(gallons),F(miles);co2=g*F(1021,100);ch4=d*F(95,10000)/1000;n2o=d*F(431,10000)/1000
    result={'co2MassKg':exact(co2),'ch4MassKg':exact(ch4),'n2oMassKg':exact(n2o),'ch4Co2eKg':exact(ch4*28),'n2oCo2eKg':exact(n2o*265),'totalExactKgCo2e':exact(co2+ch4*28+n2o*265),'totalDisplayKgCo2e':display(co2+ch4*28+n2o*265)}
    with localcontext() as ctx:
        ctx.prec=96;G,D=Decimal(gallons),Decimal(miles);gas=[G*Decimal('10.21'),D*Decimal('0.0095')/1000,D*Decimal('0.0431')/1000];total=gas[0]+gas[1]*28+gas[2]*265
        assert all(F(result[k])==F(v) for k,v in zip(['co2MassKg','ch4MassKg','n2oMassKg','ch4Co2eKg','n2oCo2eKg','totalExactKgCo2e'],gas+[gas[1]*28,gas[2]*265,total]))
        assert result['totalDisplayKgCo2e']==format(total.quantize(Decimal('.0001'),rounding=ROUND_HALF_EVEN),'.4f')
    return result

def source_cells():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SOURCE_HASH
    ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with ZipFile(SOURCE) as z:
        strings=[''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml'))]
        sheet=E.fromstring(z.read('xl/worksheets/sheet1.xml'));cells={x.attrib['r']:x for x in sheet.findall('.//s:c',ns)};styles=E.fromstring(z.read('xl/styles.xml'));formats={x.attrib['numFmtId']:x.attrib['formatCode'] for x in styles.findall('s:numFmts/s:numFmt',ns)};xfs=styles.find('s:cellXfs',ns)
        result=[]
        for key in ['F3','C103','D103','E103','C107','D107','E107','C255','D255','E256','F248','G248','F256','G256','E523','E524','E525','E526']:
            c=cells[key];raw=c.find('s:v',ns).text;fmt=xfs[int(c.attrib.get('s',0))].attrib.get('numFmtId','0');result.append({'cell':key,'rawXml':raw,'decoded':strings[int(raw)] if c.attrib.get('t')=='s' else raw,'numFmtId':fmt,'numFmtCode':formats.get(fmt,'General' if fmt=='0' else None)})
        lookup={r['cell']:r for r in result}
        assert lookup['D107']['rawXml']=='10.210000000000001' and '.00_' in lookup['D107']['numFmtCode']
        assert lookup['F256']['rawXml']=='9.4999999999999998E-3' and '.0000_' in lookup['F256']['numFmtCode']
        assert lookup['G256']['rawXml']=='4.3099999999999999E-2' and lookup['E256']['decoded']=='2007-2022'
        assert lookup['C255']['decoded']=='Medium- and Heavy-Duty Vehicles' and lookup['D255']['decoded']=='Diesel'
        assert [lookup[k]['decoded'] for k in ['E524','E525','E526']]==['1','28','265']
        return result
pairs=[('both_zero','0.000','0.000'),('both_minimum','0.001','0.001'),('independent_irregular','17.333','881.777'),('fuel_max_distance_min','999999999999.999','0.001'),('fuel_min_distance_max','0.001','999999999999.999'),('both_maximum','999999999999.999','999999999999.999'),('independent_midrange','543.210','12345.678'),('fuel_only_successor','543.211','12345.678'),('distance_only_successor','543.210','12345.679')]
# Solve exact half-way points using the independent rational expression, not author fixture values.
for parity,label in [(0,'new_tie_even_down'),(1,'new_tie_odd_up')]:
    for milli in range(10001,50000):
        d=F(milli,1000);value=F('2.125')*F('10.21')+d*F('0.0095')*28/1000+d*F('0.0431')*265/1000;q,r=divmod(value.numerator*10000,value.denominator)
        if r*2==value.denominator and q%2==parity:
            pairs.append((label,'2.125',format(Decimal(milli)/1000,'.3f')));break
fixtures=[{'id':i,'quantityGallons':g,'distanceMiles':d,'expected':expected(g,d)} for i,g,d in pairs]
result={'schemaVersion':1,'task':'M74-INDEPENDENT-ACCOUNTING-REVIEW','author':'/root/m72_ops','priorAuthorship':'M73 backend/helper only; no M74 method, fixture or implementation authorship','applicationImports':False,'authorFixtureImported':False,'derivation':'Fraction rational coefficients independently transcribed from verified EPA cells; integer quotient/remainder half-even; separate Decimal96 cross-check','source':{'path':str(SOURCE),'sha256':SOURCE_HASH,'byteLength':SOURCE.stat().st_size,'normalization':'Workbook displayed decimal precision independently corroborated by current EPA2025 PDF','cells':source_cells()},'numericFixtures':fixtures,'admissionCases':[{'id':'missing_fuel','gallons':None,'miles':'1.000','expected':'calculation_null'},{'id':'missing_distance','gallons':'1.000','miles':None,'expected':'calculation_null'},{'id':'missing_both','gallons':None,'miles':None,'expected':'calculation_null'},{'id':'mixed_zero_fuel','gallons':'0.000','miles':'1.000','expected':'calculation_null_or_refused_no_numeric_total'},{'id':'mixed_zero_distance','gallons':'1.000','miles':'0.000','expected':'calculation_null_or_refused_no_numeric_total'},{'id':'both_zero_supported','gallons':'0.000','miles':'0.000','expected':'zero_requires_two_compatible_zero_statements_confirmation_reason'},{'id':'positive_evidence_zero_entry','expected':'no_numeric_total'},{'id':'MY2006_MY2023','expected':'unsupported_no_numeric_total'},{'id':'nonfossil_or_unknown_blend','expected':'unsupported_no_numeric_total'},{'id':'positive_per_dimension_discrepancy','expected':'separate_reason_and_persistent_finding'},{'id':'new_source_same_physical_vehicle','expected':'duplicate_refused'},{'id':'changed_statement_reference_reuses_reserved_original','expected':'duplicate_refused'},{'id':'interstate_travel','expected':'all_vehicle_miles_included_no_CA_clipping'},{'id':'coordinated_factor_hash_forgery','expected':'replay_refused_against_trusted_method'}]}
output=ROOT/'m74-independent-accounting-expectations.json'
serialized=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
if output.exists():assert output.read_text(encoding='utf-8')==serialized,'Frozen expectations differ; create a new revision instead.'
else:output.write_text(serialized,encoding='utf-8',newline='\n')
print(json.dumps({'status':'independent_expectations_frozen','vectors':len(fixtures),'exactComparisons':len(fixtures)*7,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'ties':[x for x in fixtures if 'tie' in x['id']]}))
