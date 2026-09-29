"""Independent public-boundary checks; isolated server and temporary SQLite only."""
import base64
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
import hashlib
import http.client
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent

class IndependentHTTP(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='neuvetra-independent-qa-')
        self.db = Path(self.tmp.name) / 'qa.sqlite3'
        self.start()

    def start(self):
        self.proc = subprocess.Popen([sys.executable, '-B', str(ROOT/'server.py'), '--port', '0', '--db', str(self.db)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        line = self.proc.stdout.readline().strip()
        self.origin = line.split('demo: ')[1]
        self.port = int(self.origin.rsplit(':',1)[1])
        code, heads, _ = self.req('GET','/')
        self.assertEqual(code,200)
        self.cookie = heads['set-cookie'].split(';')[0]

    def stop(self):
        self.proc.terminate(); self.proc.wait(timeout=5)
        self.proc.stdout.close(); self.proc.stderr.close()

    def tearDown(self):
        self.stop(); self.tmp.cleanup()

    def req(self,method,path,value=None,headers=None,raw=None):
        h={'Origin':self.origin,'Cookie':getattr(self,'cookie',''),'X-Neuvetra-Local':'1'}
        h.update(headers or {})
        if value is not None: raw=json.dumps(value).encode(); h['Content-Type']='application/json'
        conn=http.client.HTTPConnection('127.0.0.1',self.port,timeout=5)
        try:
            conn.request(method,path,body=raw,headers=h)
            r=conn.getresponse(); data=r.read()
            try: data=json.loads(data)
            except (ValueError,UnicodeError): pass
            return r.status,dict(r.getheaders()).__class__((k.lower(),v) for k,v in r.getheaders()),data
        finally: conn.close()

    def payload(self,revision=0):
        return {'expectedRevision':revision,'onboarding':{'company':{'legal':'Independent QA <> & café'},'period':{'start':'2025-01-01','end':'2025-12-31'},'locations':[{'id':'qa-east','name':'East QA works'}],'sources':[{'answer':''},{'answer':'No'},{'answer':'Not sure'},{'answer':'Yes'},{}]},'plan':{'schemaVersion':1,'catalogVersion':'independent-qa','items':{'qa':{'records':[{'quantity':'0','recordType':'Gas','unit':'therm'},{'quantity':''},{'quantity':None}]}},'custom':[],'screening':{}}}

    def test_initial_empty_and_exact_roundtrip_restart(self):
        code,_,initial=self.req('GET','/api/workspace'); self.assertEqual(code,200)
        self.assertIsNone(initial['onboarding']); self.assertEqual(initial['plan']['items'],{})
        value=self.payload(); code,_,saved=self.req('PUT','/api/workspace',value);self.assertEqual(code,200)
        self.assertEqual(saved['onboarding'],value['onboarding']);self.assertEqual(saved['plan'],value['plan'])
        oldcookie=self.cookie; self.stop();self.start()
        self.assertEqual(self.req('GET','/api/workspace')[2],saved)
        self.assertEqual(self.req('PUT','/api/workspace',self.payload(1),headers={'Cookie':oldcookie})[0],403)
        with closing(sqlite3.connect(self.db)) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM workspace_revision').fetchone()[0],2)

    def test_duplicate_save_compare_and_swap(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            outcomes=list(pool.map(lambda _:self.req('PUT','/api/workspace',self.payload())[0],range(8)))
        self.assertEqual(sorted(outcomes),[200]+[409]*7)
        self.assertEqual(self.req('GET','/api/workspace')[2]['revision'],1)

    def test_unknown_keys_reserved_keys_and_bad_nested_container(self):
        for key in ['__proto__','constructor','prototype']:
            value=self.payload();value['plan']['items']['qa'][key]={'polluted':True}
            self.assertEqual(self.req('PUT','/api/workspace',value)[0],400)
        for sources in [[],[{}]*6,[None]*5]:
            value=self.payload();value['onboarding']['sources']=sources
            self.assertEqual(self.req('PUT','/api/workspace',value)[0],400)

    def test_evidence_original_and_link_integrity(self):
        original=b'QA,quantity\nzero,0\nunknown,\n'
        value={'name':'qa.csv','mime':'text/csv','contentBase64':base64.b64encode(original).decode()}
        code,_,meta=self.req('POST','/api/evidence',value);self.assertEqual(code,201)
        self.assertEqual(meta['sha256'],hashlib.sha256(original).hexdigest())
        received=self.req('GET','/api/evidence/'+meta['id'])[2]
        self.assertEqual(base64.b64decode(received['contentBase64']),original)
        saved=self.payload();saved['plan']['items']['qa']['evidenceIds']=[meta['id']]
        self.assertEqual(self.req('PUT','/api/workspace',saved)[0],200)
        saved['expectedRevision']=1;saved['plan']['items']['qa']['evidenceIds']=['ev_'+'f'*32]
        self.assertEqual(self.req('PUT','/api/workspace',saved)[0],400)
        self.stop();self.start();self.assertEqual(self.req('GET','/api/evidence/'+meta['id'])[2],received)

    def test_ui_breaking_nested_shapes_rejected(self):
        for field,bad in [('records',[None]),('evidence',{}),('locationIds',{})]:
            with self.subTest(field=field):
                value=self.payload(self.req('GET','/api/workspace')[2]['revision']);value['plan']['items']['qa'][field]=bad
                self.assertEqual(self.req('PUT','/api/workspace',value)[0],400)
        value=self.payload(self.req('GET','/api/workspace')[2]['revision']);value['onboarding']['period']=None
        self.assertEqual(self.req('PUT','/api/workspace',value)[0],400)

    def test_evidence_limits_and_active_content(self):
        for name,mime,body in [('run.html','text/html',b'<script>x</script>'),('../qa.txt','text/plain',b'qa'),('fake.pdf','application/pdf',b'not a pdf'),('nul.txt','text/plain',b'a\x00b'),('large.txt','text/plain',b'x'*(5*1024*1024+1))]:
            self.assertIn(self.req('POST','/api/evidence',{'name':name,'mime':mime,'contentBase64':base64.b64encode(body).decode()})[0],(400,413))

    def test_host_origin_session_and_static_paths(self):
        for headers in [{'Origin':'https://outside.invalid'},{'Host':'outside.invalid'},{'Sec-Fetch-Site':'cross-site'},{'X-Neuvetra-Local':'0'},{'Cookie':'neuvetra_local_session=wrong'}]:
            self.assertEqual(self.req('PUT','/api/workspace',self.payload(),headers)[0],403)
        for path in ['/server.py','/DATABASE.md','/package.json','/../server.py','/%2e%2e/server.py','/data/%2e%2e/server.py','/data%5c..%5cserver.py','/.git/config']:
            self.assertEqual(self.req('GET',path)[0],404,path)

    def test_all_plan_assets_resolve(self):
        for path in ['/plan.html','/plan-ui.js','/plan-core.js','/plan.css','/data/collection-catalog.json']:
            self.assertEqual(self.req('GET',path)[0],200,path)

    def test_static_symlink_escape(self):
        target=Path(self.tmp.name)/'outside.js';target.write_text('QA sentinel outside static root')
        link=ROOT/'qa-static-escape.js'
        if link.exists() or link.is_symlink(): self.skipTest('QA symlink name already in use')
        try: link.symlink_to(target)
        except OSError as e: self.skipTest('OS did not allow symlink creation: '+str(e.winerror if hasattr(e,'winerror') else e.errno))
        try: self.assertEqual(self.req('GET','/qa-static-escape.js')[0],404)
        finally: link.unlink()

if __name__=='__main__': unittest.main(verbosity=2)
