"""Read-only independent EPA-cell oracle and candidate/native-result review.
No application fixtures are used as expected numerical values; no database writes.
"""
import argparse
import copy
from decimal import Decimal as D, localcontext, ROUND_HALF_EVEN
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as E
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--candidate', required=True, type=Path)
parser.add_argument('--workbook', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--snapshot', default='operations/agent-improvement/snapshots/M73-INTEGRATED-CANDIDATE1.json')
parser.add_argument('--snapshot-sha256', default='383ad6db367ec3dbfaac80c0279afad7b00917c5a053be8e5efd8b4210ffb1a5')
parser.add_argument('--native-fixture', default='.tmp/m73-native-fixture.json')
parser.add_argument('--native-sha256', default=None)
args = parser.parse_args()
sha = lambda b: hashlib.sha256(b).hexdigest()
canonical = lambda v: json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
digest = lambda v: sha(canonical(v).encode())
checks = []
def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)

check('original EPA workbook SHA256', sha(args.workbook.read_bytes()) == '43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7')
with zipfile.ZipFile(args.workbook) as z:
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    strings = [''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml'))]
    cells = {}
    for c in E.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:c', ns):
        v = c.find('s:v', ns)
        if v is not None:
            cells[c.get('r')] = strings[int(v.text)] if c.get('t') == 's' else v.text
    sheet = E.fromstring(z.read('xl/workbook.xml')).find('s:sheets/s:sheet', ns).get('name')
check('original fuel and sheet', cells['C38'] == 'Natural Gas' and sheet == 'Emission Factors Hub')
check('original gas units', cells['E36'] == 'kg CO2 per mmBtu' and cells['F36'] == 'g CH4 per mmBtu' and cells['G36'] == 'g N2O per mmBtu')
check('HHV and combustion-only notes', 'higher heating values (HHV)' in cells['C94'] and '100 percent' in cells['C95'] and 'do not represent upstream emissions' in cells['C99'])
check('AR5 100-year evidence', cells['E523'] == '100-Year GWP' and 'AR5' in cells['C10'] and '100-year' in cells['C556'])

# Expectations are derived from original literal XML cells before candidate reads.
def expected(quantity):
    with localcontext() as ctx:
        ctx.prec = 96
        q = D(quantity)
        masses = [q * D(cells['E38']), q * D(cells['F38']) / 1000, q * D(cells['G38']) / 1000]
        co2e = [masses[i] * D(cells[cell]) for i, cell in enumerate(['E524', 'E525', 'E526'])]
        total = sum(co2e)
        return {'quantityMmbtu': quantity, 'gasMassKg': dict(zip(['co2', 'ch4', 'n2o'], map(str, masses))), 'gasCo2eKg': dict(zip(['co2', 'ch4', 'n2o'], map(str, co2e))), 'totalExactKgCo2e': str(total), 'displayKgCo2e': format(total.quantize(D('.0001'), rounding=ROUND_HALF_EVEN), '.4f')}
oracle = [expected(q) for q in ['1250.125', '1500.125', '0.100', '0.300', '999999999999.999', '0.000']]
snapshot_path = args.candidate / args.snapshot
snapshot = json.loads(snapshot_path.read_text(encoding='utf-8'))
check('frozen snapshot SHA256', sha(snapshot_path.read_bytes()) == args.snapshot_sha256)
check('snapshot exactly 26 files', len(snapshot['files']) == 26)
for f in snapshot['files']:
    check('frozen bytes: ' + f['path'], sha((args.candidate/f['path']).read_bytes()) == f['sha256'])
native_path = args.candidate / args.native_fixture
if args.native_sha256:
    check('native fixture expected SHA256', sha(native_path.read_bytes()) == args.native_sha256)
native = json.loads(native_path.read_text(encoding='utf-8'))
engine = args.candidate / 'apps/site-api/src/calculation/m73_stationary_natural_gas.py'
def engine_call(payload):
    env = {'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONIOENCODING': 'utf-8', 'PATH': os.environ.get('PATH', ''), 'SYSTEMROOT': os.environ.get('SYSTEMROOT', '')}
    run = subprocess.run([sys.executable, '-B', str(engine)], input=canonical(payload).encode(), capture_output=True, env=env, timeout=5)
    return run.returncode, json.loads(run.stdout)

def calculation_check(c, label):
    e = expected(c['input']['quantityMmbtu'])
    for gas in ['co2', 'ch4', 'n2o']:
        check(label + ' ' + gas + ' gas mass', D(c['gasResults'][gas]['mass']) == D(e['gasMassKg'][gas]))
        check(label + ' ' + gas + ' CO2e', D(c['gasResults'][gas]['co2e']) == D(e['gasCo2eKg'][gas]))
        check(label + ' ' + gas + ' explicit mass units', c['gasResults'][gas]['massUnit'] == 'kg ' + gas.upper())
    check(label + ' exact total', D(c['total']['unrounded']) == D(e['totalExactKgCo2e']))
    check(label + ' display half-even', c['total']['display'] == e['displayKgCo2e'] and c['total']['rounding'] == 'half_even_4dp' and c['total']['unit'] == 'kg CO2e')
    check(label + ' result digest', c['resultSha256'] == digest({k:v for k,v in c.items() if k != 'resultSha256'}))
    check(label + ' input digest', c['inputSha256'] == digest(c['input']))
    m = c['method']
    check(label + ' source pin', m['sourceSha256'] == sha(args.workbook.read_bytes()))
    check(label + ' method candidate status', m['status'] == 'development_candidate_not_released' and m['releaseEligible'] is False)
    for field, cell in [('co2KgPerMmbtu','E38'),('ch4GramsPerMmbtu','F38'),('n2oGramsPerMmbtu','G38'),('ch4Gwp','E525'),('n2oGwp','E526')]:
        check(label + ' source-linked ' + field, D(m[field]) == D(cells[cell]))

versions = [v for w in native['register']['worksheets'] for v in w['versions']]
seen = set()
for w in native['register']['worksheets']:
    prior = None
    for v in w['versions']:
        a, c = v['activity'], v['calculation']
        label = 'native ' + v['id']
        seen.add(a['quantityMmbtu'])
        check(label + ' limitations', v['synthetic'] is True and v['scope1Completeness'] == 'incomplete' and v['corporateCompleteness'] == 'incomplete' and v['releaseEligible'] is False and v['assurance'] == 'none')
        check(label + ' saved coverage hash binding', a['binding']['coverageVersionId'] == v['coverageVersion']['id'] and a['binding']['coverageVersionSha256'] == v['coverageVersion']['versionSha256'])
        if prior:
            check(label + ' predecessor linkage', v['previousVersionId'] == prior['id'] and v['previousVersionSha256'] == prior['versionSha256'] and v['correctionReason'] is not None)
            check(label + ' inherited contributor provenance', set(prior['contributorIds']) <= set(v['contributorIds']))
        if a['quantityMmbtu'] is None:
            check(label + ' missing is not zero', c is None and any(f['code'] == 'activity_missing' for f in v['findings']))
        else:
            calculation_check(c, label)
            statement = v['statement']
            check(label + ' evidence bytes/hash/length', sha(statement['text'].encode()) == statement['sha256'] and len(statement['text'].encode()) == statement['byteLength'])
            check(label + ' engine evidence binding', c['input']['statementSha256'] == statement['sha256'] and c['input']['binding'] == a['binding'])
            if a['quantityMmbtu'] == '0.000':
                check(label + ' explicit compatible zero', a['statement']['statedQuantityMmbtu'] == '0.000' and bool(a['zeroReason']) and a['manualConfirmation'])
            if a['quantityMmbtu'] != a['statement']['statedQuantityMmbtu']:
                check(label + ' discrepancy retained', bool(a['discrepancyReason']) and any(f['code'] == 'activity_statement_discrepancy' for f in v['findings']))
        if v['review']:
            check(label + ' separate contributor review', v['review']['reviewerId'] not in v['contributorIds'])
        prior = v
check('native all assigned quantity vectors present', {None, '0.000', '1250.125', '1500.125', '0.100', '0.300', '999999999999.999'} <= seen)
seed = next(v['calculation']['input'] for v in versions if v['calculation'])
for e in oracle:
    payload = dict(seed, quantityMmbtu=e['quantityMmbtu'])
    code, result = engine_call({'action':'calculate','input':payload})
    check('actual engine succeeds ' + e['quantityMmbtu'], code == 0)
    calculation_check(result['record'], 'engine ' + e['quantityMmbtu'])
for field, value in [('quantityMmbtu',None),('quantityMmbtu','1000000000000.000'),('quantityMmbtu','1e3'),('quantityMmbtu','0.0001'),('quantityMmbtu','-1.000'),('fuel','Renewable Natural Gas'),('heatBasis','LHV'),('unit','therm'),('period',{'start':'2024-01-01','endExclusive':'2025-01-01'})]:
    code, _ = engine_call({'action':'calculate','input':dict(seed, **{field:value})})
    check('actual engine refuses ' + field + '=' + str(value), code != 0)
records = [v['calculation'] for v in versions if v['calculation']]
code, result = engine_call({'action':'replay_batch','records':records})
check('actual engine replays all native calculations', code == 0 and result['verified'] == len(records))
for field in ['total','method']:
    fake = copy.deepcopy(records[0])
    if field == 'total': fake['total']['unrounded'] = '0'
    else: fake['method']['sourceSha256'] = '0' * 64
    fake['resultSha256'] = digest({k:v for k,v in fake.items() if k != 'resultSha256'})
    code, _ = engine_call({'action':'replay_batch','records':[fake]})
    check('actual replay refuses coordinated ' + field + ' and hash change', code != 0)
report = native['originalReport']
check('original native HTML exact hash/length', sha(report['html'].encode()) == report['htmlSha256'] and len(report['html'].encode()) == report['htmlByteLength'])
check('original native report snapshot digest', sha(report['snapshotJson'].encode()) == report['snapshotSha256'])
captured = json.loads(report['snapshotJson'])
first = next(v for v in versions if v['id'] == report['versionId'])
check('original unreviewed report remains original after review/corrections', captured['version'] == dict(first, review=None) and captured['review'] is None)
check('report incomplete/upstream/assurance wording', all(t in report['html'] for t in ['Corporate inventory incomplete','No filing determination or external assurance','all 15 Scope 3 categories','upstream fuel emissions excluded','66399.7643125']))
output = {'taskId':'M73-INDEPENDENT-ACCOUNTING','candidateSnapshotSha256':sha(snapshot_path.read_bytes()),'sourceWorkbookSha256':sha(args.workbook.read_bytes()),'nativeFixtureSha256':sha(native_path.read_bytes()),'originalCells':{k:cells[k] for k in ['F3','C38','E36','F36','G36','E38','F38','G38','C94','C95','C99','E523','E524','E525','E526','C10','C556']},'independentOracle':oracle,'nativeVersionCount':len(versions),'nativeCalculationCount':len(records),'checks':checks,'status':'passed','count':len(checks),'databaseMutations':False,'observedModel':None,'observedEffort':None,'tokens':None,'cost':None}
args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status':'passed','checks':len(checks),'nativeVersions':len(versions),'nativeCalculations':len(records),'output':str(args.output)}))
