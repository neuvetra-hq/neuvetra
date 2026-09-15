"""M73 actual saved-source Decimal authority; M42's fixed fixture remains unchanged."""
from __future__ import annotations
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from decimal import Decimal, localcontext, ROUND_HALF_EVEN

DEPENDENCY_SHA='eebade88f291cec281f38efe09597a107ce24904f28782d51405e739c4d37603'
def canonical(v): return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def digest(v): return hashlib.sha256(canonical(v).encode('utf-8')).hexdigest()
def require(v):
    if not v: raise ValueError('invalid M73 calculation contract')
def keys(v,names): require(isinstance(v,dict) and set(v)==set(names.split(',')))
def exact(v):
    t=format(v,'f')
    return t.rstrip('0').rstrip('.') if '.' in t else t
def method():
    dependency=Path(__file__).with_name('stationary_natural_gas.py')
    require(hashlib.sha256(dependency.read_bytes()).hexdigest()==DEPENDENCY_SHA)
    spec=importlib.util.spec_from_file_location('m73_frozen_m42_dependency',dependency)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    return {'id':'stationary-natural-gas-combustion','version':'m73-development-v1','engineSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'dependencySha256':DEPENDENCY_SHA,'sourceSha256':m.SOURCE_SHA256,'factorSha256':m.digest(m.FACTOR),'gwpSha256':m.digest(m.GWP),'sourceTitle':'EPA GHG Emission Factors Hub 2025','sourceSheet':'Emission Factors Hub','factorCells':['C38','E38','F38','G38'],'gwpCells':['E524','E525','E526'],'noteCells':['C94','C95','C99','E523','C10','C556'],'co2KgPerMmbtu':'53.06','ch4GramsPerMmbtu':'1.0','n2oGramsPerMmbtu':'0.10','ch4Gwp':'28','n2oGwp':'265','gwpAssessment':'IPCC AR5 100-year','status':'development_candidate_not_released','releaseEligible':False,'rights':'unresolved_for_factor_release'}
def calculate(v):
    keys(v,'binding,period,fuel,heatBasis,unit,quantityMmbtu,statementSha256')
    keys(v['binding'],'coverageVersionId,coverageVersionSha256,entityId,facilityId,sourceId,boundaryDecisionId')
    for k,x in v['binding'].items(): require(isinstance(x,str) and re.fullmatch('[a-f0-9]{64}' if k.endswith('Sha256') else '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',x))
    require(v['period']=={'start':'2025-01-01','endExclusive':'2026-01-01'} and v['fuel']=='Natural Gas' and v['heatBasis']=='HHV' and v['unit']=='MMBtu')
    require(isinstance(v['quantityMmbtu'],str) and re.fullmatch(r'(?:0|[1-9][0-9]{0,11})\.[0-9]{3}',v['quantityMmbtu']))
    require(isinstance(v['statementSha256'],str) and re.fullmatch('[a-f0-9]{64}',v['statementSha256']))
    with localcontext() as ctx:
        ctx.prec=96
        q=Decimal(v['quantityMmbtu']);co2=q*Decimal('53.06');ch4=q*Decimal('1.0')/Decimal('1000');n2o=q*Decimal('0.10')/Decimal('1000');ch4e=ch4*Decimal('28');n2oe=n2o*Decimal('265');total=co2+ch4e+n2oe
        display=format(total.quantize(Decimal('0.0001'),rounding=ROUND_HALF_EVEN),'.4f')
    gas=lambda mass,unit,e:{'mass':exact(mass),'massUnit':unit,'co2e':exact(e),'co2eUnit':'kg CO2e'}
    out={'profile':'m73-decimal-result-v1','input':v,'inputSha256':digest(v),'method':method(),'gasResults':{'co2':gas(co2,'kg CO2',co2),'ch4':gas(ch4,'kg CH4',ch4e),'n2o':gas(n2o,'kg N2O',n2oe)},'total':{'unrounded':exact(total),'display':display,'unit':'kg CO2e','rounding':'half_even_4dp'}}
    return dict(out,resultSha256=digest(out))
def handle(v):
    require(isinstance(v,dict))
    if v.get('action')=='calculate':
        keys(v,'action,input');return {'status':'ok','record':calculate(v['input'])}
    keys(v,'action,records');require(v['action']=='replay_batch' and isinstance(v['records'],list) and len(v['records'])<=40)
    for record in v['records']: require(isinstance(record,dict) and calculate(record.get('input'))==record)
    return {'status':'ok','verified':len(v['records'])}
if __name__=='__main__':
    try:
        raw=sys.stdin.buffer.read(524289);require(len(raw)<=524288)
        print(canonical(handle(json.loads(raw))))
    except Exception:
        print('{"status":"error","code":"m73_calculation_unavailable"}');sys.exit(2)
