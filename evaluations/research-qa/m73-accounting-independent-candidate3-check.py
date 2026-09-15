"""Targeted read-only accounting recheck of candidate3 report wrapping change."""
import argparse
from pathlib import Path
import json
import hashlib
from html.parser import HTMLParser

p=argparse.ArgumentParser()
p.add_argument('--candidate',required=True,type=Path)
p.add_argument('--fixture',required=True)
p.add_argument('--fixture-sha256',required=True)
p.add_argument('--output',required=True,type=Path)
a=p.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
checks=[]
def check(label,value):
    assert value,label
    checks.append(label)
def read(path):return json.loads(path.read_text(encoding='utf-8'))
d=a.candidate/'operations/agent-improvement/snapshots'
old_path=d/'M73-INTEGRATED-CANDIDATE2.json'
new_path=d/'M73-INTEGRATED-CANDIDATE3.json'
check('prior accepted snapshot hash',sha(old_path.read_bytes())=='2ba1377a9f7dab526072a042b9dcaaa9ca5c0d3c030773e07612afaebc121a47')
check('new snapshot hash',sha(new_path.read_bytes())=='828a77d5334a781929c55075d883883364156c49a5c16f3752b4c095ba4f69d8')
old={f['path']:f for f in read(old_path)['files']}
new=read(new_path)['files']
check('26-file candidate',len(new)==26)
changed=[]
for f in new:
    check('live snapshot bytes '+f['path'],sha((a.candidate/f['path']).read_bytes())==f['sha256'])
    if old[f['path']]['sha256']!=f['sha256']:
        changed.append(f['path'])
        check('sole CSS wrapping replacement '+f['path'],old[f['path']]['text'].replace('color:#172f2c}','color:#172f2c;overflow-wrap:anywhere}')==f['text'])
check('only expected two presentation changes',set(changed)=={'packages/neuvetra-database/src/m73-report.ts','packages/neuvetra-database/src/migrations/0016_stationary_natural_gas.sql'})
fixture_path=a.candidate/a.fixture
check('new unique fixture hash',sha(fixture_path.read_bytes())==a.fixture_sha256)
fixture=read(fixture_path)
prior_path=a.candidate/'.tmp/m73-native-fixture-candidate2.json'
check('old unique fixture remains preserved',sha(prior_path.read_bytes())=='349b4242ceb481535abf1cebfead9d869bda7463d954e8d31b3dc43a2424c50f')
prior=read(prior_path)
versions=[v for w in fixture['register']['worksheets'] for v in w['versions']]
previous=[v for w in prior['register']['worksheets'] for v in w['versions']]
def numerical(v):
    c=v['calculation']
    return None if c is None else {'method':c['method'],'gasResults':c['gasResults'],'total':c['total']}
for v in versions:
    peers=[o for o in previous if o['activity']['quantityMmbtu']==v['activity']['quantityMmbtu']]
    if peers:check('unchanged accepted numerical semantics '+v['id'],numerical(v)==numerical(peers[0]))
    check('unreleased incomplete semantics '+v['id'],v['synthetic'] is True and v['scope1Completeness']=='incomplete' and v['corporateCompleteness']=='incomplete' and v['releaseEligible'] is False and v['assurance']=='none')
report=fixture['originalReport']
html=report['html']
check('native report bytes hash and length',sha(html.encode())==report['htmlSha256'] and len(html.encode())==report['htmlByteLength'])
check('native report snapshot hash',sha(report['snapshotJson'].encode())==report['snapshotSha256'])
captured=json.loads(report['snapshotJson'])
v=next(v for v in versions if v['id']==report['versionId'])
check('native original captured version unchanged after corrections',captured['version']==dict(v,review=None) and captured['review'] is None)
check('native report applies wrapping repair', 'color:#172f2c;overflow-wrap:anywhere}' in html)
check('report incomplete upstream and assurance scope retained',all(s in html for s in ['Corporate inventory incomplete','No filing determination or external assurance','all 15 Scope 3 categories','upstream fuel emissions excluded']))
class Table(HTMLParser):
    def __init__(self):super().__init__();self.depth=0;self.rows=[];self.row=[];self.cell=None
    def handle_starttag(self,t,attrs):
        if t=='table':self.depth+=1
        if self.depth and t=='tr':self.row=[]
        if self.depth and t in ['th','td']:self.cell=''
    def handle_data(self,d):
        if self.cell is not None:self.cell+=d
    def handle_endtag(self,t):
        if self.depth and t in ['th','td']:self.row.append(self.cell);self.cell=None
        if self.depth and t=='tr':self.rows.append(self.row)
        if t=='table':self.depth-=1
table=Table();table.feed(html)
# Independently derived and accepted in candidate2 from original EPA workbook cells.
expected=[['Gas','Mass (kg)','kg CO2e'],['CO2','66331.6325','66331.6325'],['CH4','1.250125','35.0035'],['N2O','0.1250125','33.1283125']]
check('visible native gas table retains source-derived values',table.rows==expected)
check('exact and displayed source totals retained', '<dd>66399.7643125</dd>' in html and '<dd>66399.7643</dd>' in html)
result={'task':'M73-INDEPENDENT-ACCOUNTING-CANDIDATE3','candidateSnapshotSha256':sha(new_path.read_bytes()),'nativeFixtureSha256':sha(fixture_path.read_bytes()),'changedFiles':changed,'checks':checks,'checkCount':len(checks),'status':'passed','scope':'CSS-only change and affected native report accounting semantics; no browser/print visual verdict','nativeWritesPerformed':False,'priorAccountingVerdictTransfers':True}
a.output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'passed','checks':len(checks),'output':str(a.output)}))
