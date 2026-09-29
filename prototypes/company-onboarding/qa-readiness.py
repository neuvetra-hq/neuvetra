"""Independent readiness boundary review; synthetic temporary servers only."""
import hashlib, json, shutil, sqlite3, subprocess, tempfile, unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from test_server import LocalServerTests as Harness
from server import encoded
class ReadinessBoundaryQA(unittest.TestCase):
    setUp=Harness.setUp
    start=Harness.start
    stop=Harness.stop
    request=Harness.request
    headers=Harness.headers
    get=Harness.get
    value=Harness.value
    put=Harness.put
    upload=Harness.upload
    def save(self,revision=0,**extra):
        return self.request('POST','/api/readiness',{'expectedRevision':revision,**extra},self.headers())
    def test_unknowns_never_ready(self):
        status,_,r=self.request('GET','/api/readiness',headers=self.headers())
        self.assertEqual(status,200)
        self.assertEqual(r['workspaceRevision'],0)
        self.assertIs(r['result']['readyForCalculation'],False)
        self.assertTrue(r['result']['globalIssues'])
        self.assertTrue(all(not i['readyForCalculation'] for i in r['result']['items']))
    def test_client_forgery(self):
        for extra in ({'result':{'readyForCalculation':True}},{'methods':{'status':'approved'}},{'onboarding':{}},{'inputSha256':'f'*64}):
            self.assertEqual(self.save(**extra)[0],400)
        self.assertEqual(self.request('GET','/api/readiness/history',headers=self.headers())[2]['snapshots'],[])
        v=self.value();v['plan'].update(readyForCalculation=True,methodApproval='approved')
        self.assertEqual(self.put(v)[0],200)
        r=self.save(1);self.assertEqual(r[0],201)
        self.assertIs(r[2]['result']['readyForCalculation'],False)
    def test_lineage_history_conflict_restart_immutability(self):
        v=self.value();self.assertEqual(self.put(v)[0],200)
        status,_,first=self.save(1);self.assertEqual(status,201)
        self.assertEqual(first['inputSha256'],hashlib.sha256(json.dumps({'onboarding':v['onboarding'],'plan':v['plan']},ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest())
        for field,name in [('methodsSha256','readiness-methods.json'),('catalogSha256','collection-catalog.json')]:
            self.assertEqual(first[field],hashlib.sha256((Path(__file__).parent/'data'/name).read_bytes()).hexdigest())
        self.assertEqual(first['inputs'],{'onboarding':v['onboarding'],'plan':v['plan']})
        artifacts=first['artifacts']
        self.assertEqual(hashlib.sha256(artifacts['methodsUtf8'].encode('utf-8')).hexdigest(),first['methodsSha256'])
        self.assertEqual(hashlib.sha256(artifacts['catalogUtf8'].encode('utf-8')).hexdigest(),first['catalogSha256'])
        engine=''.join(artifacts['engineFiles'][n] for n in ('readiness-core.js','plan-core.js','readiness-cli.cjs')).encode('utf-8')
        self.assertEqual(hashlib.sha256(engine).hexdigest(),first['engineSha256'])
        with tempfile.TemporaryDirectory() as replay_dir:
            replay_root=Path(replay_dir)
            for name,source in artifacts['engineFiles'].items():(replay_root/name).write_text(source,encoding='utf-8')
            replay_input={**first['inputs'],'catalog':json.loads(artifacts['catalogUtf8']),'methods':json.loads(artifacts['methodsUtf8'])}
            replay=subprocess.run([shutil.which('node'),str(replay_root/'readiness-cli.cjs')],input=encoded(replay_input),capture_output=True,check=True,timeout=15)
            self.assertEqual(json.loads(replay.stdout),first['result'])
        self.assertEqual(self.save(1)[2],first)
        v['expectedRevision']=1;v['onboarding']['company']['legal']='Second QA Company'
        self.assertEqual(self.put(v)[0],200);self.assertEqual(self.save(1)[0],409)
        second=self.save(2)[2];self.assertNotEqual(second['inputSha256'],first['inputSha256'])
        self.stop();self.start()
        self.assertEqual(self.request('GET','/api/readiness/'+first['id'],headers=self.headers())[2],first)
        self.assertEqual(len(self.request('GET','/api/readiness/history',headers=self.headers())[2]['snapshots']),2)
        with closing(sqlite3.connect(self.db)) as db,db:
            with self.assertRaises(sqlite3.IntegrityError):db.execute('DELETE FROM readiness_snapshot')
            with self.assertRaises(sqlite3.IntegrityError):db.execute("UPDATE readiness_snapshot SET snapshot_json='{}'")
    def test_concurrent_snapshot_idempotency(self):
        with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda _:self.save(),range(4)))
        self.assertTrue(all(r[0]==201 for r in results))
        self.assertEqual(len({r[2]['id'] for r in results}),1)
        self.assertEqual(len(self.request('GET','/api/readiness/history',headers=self.headers())[2]['snapshots']),1)
    def test_api_protections(self):
        self.assertEqual(self.request('POST','/api/readiness',{'expectedRevision':0},{'X-Neuvetra-Local':'1','Origin':self.origin})[0],403)
        self.assertEqual(self.request('GET','/api/readiness')[0],403)
        self.assertEqual(self.request('GET','/api/readiness',headers={**self.headers(),'Origin':'https://other.example'})[0],403)
        for revision in (True,-1,'0',None,1.5):self.assertEqual(self.save(revision)[0],400)
        self.assertEqual(self.request('GET','/api/readiness/rd_missing',headers=self.headers())[0],404)
    def test_details_shape_unknown_keys_and_preservation(self):
        for details in (None,[],True,'approved',{'x':{}},{'x':1},{'x':'a'*4001}):
            v=self.value();v['plan']['items']['one']['readinessDetails']=details
            self.assertEqual(self.put(v)[0],400)
        v=self.value();v['plan']['items']['one']['readinessDetails']={'future-review-field':'Preserve exact unknown string'}
        self.assertEqual(self.put(v)[0],200)
        self.assertEqual(self.get()[2]['plan']['items']['one']['readinessDetails'],v['plan']['items']['one']['readinessDetails'])
del Harness
if __name__=='__main__':unittest.main(verbosity=2)
