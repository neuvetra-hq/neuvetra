"""Exercise actual local HTTP, SQLite and fresh-process restart boundaries."""
import base64
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import hashlib
import http.client
import http.cookiejar
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import urllib.request

from server import COOKIE, EMPTY_PLAN, MAX_BODY, MAX_FILE, MAX_EVIDENCE_TOTAL


class LocalServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='neuvetra-storage-test-')
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name) / 'workspace.sqlite3'
        self.start()

    def start(self):
        self.process = subprocess.Popen([sys.executable, '-B', str(Path(__file__).with_name('server.py')), '--port', '0', '--db', str(self.db)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        self.addCleanup(self.stop)
        line = self.process.stdout.readline().strip()
        self.assertTrue(line.startswith('Local inventory planning demo: http://127.0.0.1:'), line + (self.process.stderr.read() if self.process.poll() is not None else ''))
        self.origin = line.split('demo: ')[1]
        self.port = int(self.origin.rsplit(':', 1)[1])
        status, headers, _ = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.cookie = headers['set-cookie'].split(';')[0]
        self.assertEqual(self.cookie.split('=', 1)[0], COOKIE + '_' + str(self.port))

    def stop(self):
        self.process.terminate()
        self.process.wait(timeout=10)
        self.process.stdout.close()
        self.process.stderr.close()

    def request(self, method, path, value=None, headers=None, raw=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        request_headers = {} if headers is None else dict(headers)
        body = raw
        if value is not None:
            body = json.dumps(value).encode()
            request_headers.setdefault('Content-Type', 'application/json')
        try:
            connection.request(method, path, body=body, headers=request_headers)
            response = connection.getresponse()
            payload = response.read()
            try:
                payload = json.loads(payload)
            except (ValueError, UnicodeError):
                pass
            return response.status, {key.lower(): value for key, value in response.getheaders()}, payload
        finally:
            connection.close()

    def headers(self):
        return {'Origin': self.origin, 'Cookie': self.cookie, 'X-Neuvetra-Local': '1'}

    def get(self):
        return self.request('GET', '/api/workspace', headers=self.headers())

    def value(self, revision=0):
        return {'expectedRevision': revision, 'onboarding': {'company': {'legal': 'Fictional Example'}, 'sources': [{}, {}, {}, {}, {}], 'entities': [], 'locations': []}, 'plan': {**EMPTY_PLAN, 'catalogVersion': 'test-1', 'items': {'one': {'answer': None}}, 'custom': [], 'screening': {}}}

    def put(self, value):
        return self.request('PUT', '/api/workspace', value, self.headers())

    def upload(self, content=b'fictional,data\n1,2\n', name='example.csv', mime='text/csv'):
        return self.request('POST', '/api/evidence', {'name': name, 'mime': mime, 'contentBase64': base64.b64encode(content).decode()}, self.headers())

    def test_restart_persists_exact_workspace_history_and_null(self):
        initial = self.get()[2]
        self.assertIsNone(initial['onboarding'])
        self.assertEqual(initial['revision'], 0)
        status, _, saved = self.put(self.value())
        self.assertEqual(status, 200)
        self.assertIsNone(saved['plan']['items']['one']['answer'])
        self.stop()
        self.start()
        self.assertEqual(self.get()[2], saved)
        with closing(sqlite3.connect(self.db)) as db, db:
            history = db.execute('SELECT revision,onboarding_json,plan_json,content_sha256 FROM workspace_revision ORDER BY revision').fetchall()
            self.assertEqual([r[0] for r in history], [0, 1])
            self.assertEqual(json.loads(history[1][1]), saved['onboarding'])
            self.assertEqual(json.loads(history[1][2]), saved['plan'])
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute('DELETE FROM workspace_revision')
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("UPDATE workspace_revision SET plan_json='{}'")

    def test_concurrent_compare_and_swap_has_one_winner(self):
        with ThreadPoolExecutor(max_workers=2) as workers:
            results = list(workers.map(lambda _: self.put(self.value())[0], range(2)))
        self.assertEqual(sorted(results), [200, 409])
        self.assertEqual(self.get()[2]['revision'], 1)
        with closing(sqlite3.connect(self.db)) as db, db:
            self.assertEqual(db.execute('SELECT count(*) FROM workspace_revision').fetchone()[0], 2)

    def test_origin_host_header_and_session_protection(self):
        for changed in ({'Origin': 'https://elsewhere.example'}, {'Origin': None}, {'Cookie': None}, {'Host': 'attacker.example'}, {'X-Neuvetra-Local': None}, {'Sec-Fetch-Site': 'cross-site'}):
            headers = self.headers()
            for key, value in changed.items():
                if value is None:
                    headers.pop(key, None)
                else:
                    headers[key] = value
            self.assertEqual(self.request('PUT', '/api/workspace', self.value(), headers)[0], 403)
        self.assertEqual(self.request('GET', '/api/workspace')[0], 403)
        self.assertEqual(self.request('GET', '/api/workspace', headers={**self.headers(), 'Origin': 'https://elsewhere.example'})[0], 403)
        self.assertEqual(self.get()[2]['revision'], 0)
        status, headers, _ = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn('HttpOnly', headers['set-cookie'])
        self.assertIn('SameSite=Strict', headers['set-cookie'])
        self.assertNotIn('access-control-allow-origin', headers)

    def test_two_servers_share_cookie_jar_without_session_collision(self):
        other = subprocess.Popen([sys.executable, '-B', str(Path(__file__).with_name('server.py')), '--port', '0', '--db', str(Path(self.temp.name) / 'other.sqlite3')], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        def stop_other():
            other.terminate()
            other.wait(timeout=10)
            other.stdout.close()
            other.stderr.close()
        self.addCleanup(stop_other)
        line = other.stdout.readline().strip()
        self.assertTrue(line.startswith('Local inventory planning demo: http://127.0.0.1:'))
        other_origin = line.split('demo: ')[1]
        self.assertNotEqual(other_origin, self.origin)
        jar = http.cookiejar.CookieJar()
        browser = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(jar))
        for origin in (self.origin, other_origin):
            with browser.open(origin + '/', timeout=10) as response:
                self.assertEqual(response.status, 200)
        self.assertEqual({cookie.name for cookie in jar}, {COOKIE + '_' + self.origin.rsplit(':', 1)[1], COOKIE + '_' + other_origin.rsplit(':', 1)[1]})
        # CookieJar sends both host cookies to each port, as browsers do. Each
        # server must select only its own cookie and preserve the other session.
        for index, origin in enumerate((self.origin, other_origin, self.origin, other_origin)):
            value = self.value(revision=index // 2)
            value['onboarding']['company']['legal'] = 'First workspace' if origin == self.origin else 'Second workspace'
            request = urllib.request.Request(origin + '/api/workspace', data=json.dumps(value).encode(), headers={'Origin': origin, 'Content-Type': 'application/json', 'X-Neuvetra-Local': '1'}, method='PUT')
            with browser.open(request, timeout=10) as response:
                saved = json.load(response)
                self.assertEqual(saved['revision'], index // 2 + 1)
                self.assertEqual(saved['onboarding'], value['onboarding'])
        self.assertEqual(len(jar), 2)

    def test_static_allowlist_traversal_and_source_protection(self):
        for path in ('/server.py', '/test_server.py', '/DATABASE.md', '/.git/config', '/../index.html', '/%2e%2e/index.html', '/data/../index.html', '/data%5c..%5cindex.html', '/workspace.sqlite3', '/package.json', '/data/'):
            self.assertEqual(self.request('GET', path)[0], 404, path)
        self.assertEqual(self.request('GET', '/style.css')[0], 200)
        self.assertEqual(self.request('GET', '/data/naics-2022.json')[0], 200)

    def test_malformed_duplicate_nonfinite_and_large_json(self):
        headers = {**self.headers(), 'Content-Type': 'application/json'}
        for raw in (b'{', b'{}', b'null', b'{"expectedRevision":0,"expectedRevision":1}', b'{"x":NaN}', b'{"x":"\\ud800"}'):
            self.assertEqual(self.request('PUT', '/api/workspace', headers=headers, raw=raw)[0], 400)
        headers['Content-Length'] = str(MAX_BODY + 1)
        self.assertEqual(self.request('PUT', '/api/workspace', headers=headers, raw=b'')[0], 413)
        self.assertEqual(self.request('PUT', '/api/workspace', headers=self.headers(), raw=b'{}')[0], 415)
        self.assertEqual(self.get()[2]['revision'], 0)

    def test_shape_bounds_and_reserved_keys(self):
        values = []
        for field in ('locations', 'entities'):
            value = self.value()
            value['onboarding'][field] = [{}] * 101
            values.append(value)
        value = self.value(); value['onboarding']['sources'] = [{}] * 4; values.append(value)
        value = self.value(); value['plan']['items'] = []; values.append(value)
        value = self.value(); value['plan']['schemaVersion'] = True; values.append(value)
        value = self.value(); value['expectedRevision'] = True; values.append(value)
        for key in ('__proto__', 'constructor', 'prototype'):
            value = self.value(); value['plan']['items'][key] = {}; values.append(value)
        for value in values:
            self.assertEqual(self.put(value)[0], 400)
        self.assertEqual(self.get()[2]['revision'], 0)
        valid = self.value(); valid['onboarding']['locations'] = [{}] * 100
        self.assertEqual(self.put(valid)[0], 200)

    def test_evidence_roundtrip_hash_immutability_and_restart(self):
        content = b'Fictional evidence\nNo approval implied.'
        status, _, metadata = self.upload(content, 'note.txt', 'text/plain')
        self.assertEqual(status, 201)
        self.assertNotIn('contentBase64', metadata)
        self.assertEqual(metadata['sha256'], hashlib.sha256(content).hexdigest())
        path = '/api/evidence/' + metadata['id']
        self.assertEqual(self.request('GET', path)[0], 403)
        value = self.value(); value['plan']['items']['one']['evidenceIds'] = [metadata['id']]
        self.assertEqual(self.put(value)[0], 200)
        self.stop(); self.start()
        status, _, stored = self.request('GET', path, headers=self.headers())
        self.assertEqual(status, 200)
        self.assertEqual(base64.b64decode(stored['contentBase64']), content)
        with closing(sqlite3.connect(self.db)) as db, db:
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute('DELETE FROM evidence')
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("UPDATE evidence SET name='changed'")

    def test_missing_or_malformed_evidence_reference_rejected(self):
        for refs in (['ev_' + '0' * 32], ['elsewhere'], 'not-an-array', [None]):
            value = self.value(); value['plan']['items']['one']['evidenceIds'] = refs
            self.assertEqual(self.put(value)[0], 400)
        self.assertEqual(self.get()[2]['revision'], 0)
        self.assertEqual(self.request('GET', '/api/evidence/absent', headers=self.headers())[0], 404)

    def test_evidence_allowlist_signatures_and_size(self):
        for content, name, mime in ((b'<html>', 'bad.html', 'text/html'), (b'not-pdf', 'bad.pdf', 'application/pdf'), (b'not-png', 'bad.png', 'image/png'), (b'not-jpeg', 'bad.jpg', 'image/jpeg'), (b'\xff', 'bad.txt', 'text/plain'), (b'\x00', 'bad.csv', 'text/csv'), (b'fine', '../bad.txt', 'text/plain'), (b'', 'empty.txt', 'text/plain')):
            self.assertEqual(self.upload(content, name, mime)[0], 400)
        for content, name, mime in ((b'%PDF-1.7\nfixture', 'fixture.pdf', 'application/pdf'), (b'\x89PNG\r\n\x1a\nfixture', 'fixture.png', 'image/png'), (b'\xff\xd8\xfffixture', 'fixture.jpg', 'image/jpeg')):
            self.assertEqual(self.upload(content, name, mime)[0], 201)
        self.assertEqual(self.upload(b'a' * (MAX_FILE + 1), 'large.txt', 'text/plain')[0], 400)
        self.assertEqual(self.upload(b'a' * MAX_FILE, 'limit.txt', 'text/plain')[0], 201)

    def test_nested_ui_shapes_rejected_without_creating_revision(self):
        invalid_items = [
            None, [], {'records': [None]}, {'records': {}}, {'evidence': {}}, {'evidence': [None]},
            {'evidence': [{}]}, {'checks': []}, {'checks': {'check': 'yes'}}, {'locationIds': {}},
            {'locationIds': [None]}, {'notes': []}, {'needsReview': 'yes'}, {'equipment': {}},
            {'records': [{'notes': []}]}, {'records': [{'evidenceIds': {}}]},
        ]
        for item in invalid_items:
            with self.subTest(item=item):
                value = self.value(); value['plan']['items']['one'] = item
                self.assertEqual(self.put(value)[0], 400)
        for field in ('company', 'period', 'boundary', 'review'):
            value = self.value(); value['onboarding'][field] = None
            self.assertEqual(self.put(value)[0], 400)
        for field, malformed in (('changes', [None] * 5), ('changes', [{}] * 4), ('sources', [None] * 5)):
            value = self.value(); value['onboarding'][field] = malformed
            self.assertEqual(self.put(value)[0], 400)
        for malformed in (None, [], {'answer': []}, {'reason': {}}, {'locationIds': [1]}):
            value = self.value(); value['plan']['screening'] = {'energy': malformed}
            self.assertEqual(self.put(value)[0], 400)
        for malformed in (None, {}, {'id': 'x', 'title': [], 'scope': '1'}):
            value = self.value(); value['plan']['custom'] = [malformed]
            self.assertEqual(self.put(value)[0], 400)
        self.assertEqual(self.get()[2]['revision'], 0)

    def test_record_decimal_dates_and_incomplete_safe_drafts(self):
        invalid = [
            {'quantity': -1}, {'quantity': '1e2'}, {'quantity': '-1'}, {'quantity': '1,000'},
            {'quantity': '2', 'recordType': 'Fuel'}, {'quantity': '2', 'unit': 'gal'},
            {'quantity': []}, {'periodStart': '2025-02-29'}, {'periodStart': '2025-1-01'},
            {'periodStart': '2025-05-01', 'periodEnd': '2025-04-01'}, {'quality': 'approved'},
        ]
        for record in invalid:
            value = self.value(); value['plan']['items']['one']['records'] = [record]
            self.assertEqual(self.put(value)[0], 400, record)
        value = self.value()
        value['plan']['items']['one'].update({
            'records': [{}, {'quantity': None}, {'quantity': ''}, {'quantity': '0.00', 'unit': 'gal', 'recordType': 'Fuel', 'quality': 'unknown', 'periodStart': '2024-02-29', 'periodEnd': '2024-03-01'}],
            'checks': {'identify': False}, 'evidence': [], 'locationIds': [],
            'extension': {'safe': [None, 'pending']},
        })
        value['plan']['custom'] = [{'id': 'custom-1', 'title': 'Unusual source', 'scope': 'unknown', 'locationIds': []}]
        value['plan']['screening'] = {'energy': {'answer': 'Not sure', 'reason': '', 'locationIds': []}}
        self.assertEqual(self.put(value)[0], 200)

    def test_evidence_metadata_is_bound_to_stored_original(self):
        status, _, metadata = self.upload()
        self.assertEqual(status, 201)
        for field, wrong in (('id', 'ev_' + '0' * 32), ('name', 'forged.csv'), ('mime', 'text/plain'), ('size', 1), ('sha256', '0' * 64), ('createdAt', 'forged')):
            value = self.value()
            value['plan']['items']['one']['evidence'] = [{**metadata, field: wrong}]
            self.assertEqual(self.put(value)[0], 400, field)
        self.assertEqual(self.get()[2]['revision'], 0)
        value = self.value()
        value['plan']['items']['one'].update({'evidence': [metadata], 'evidenceIds': [metadata['id']]})
        self.assertEqual(self.put(value)[0], 200)

    def test_evidence_quota_transaction(self):
        # Direct fixture avoids transferring 50 MiB; quota is enforced over stored bytes.
        with closing(sqlite3.connect(self.db)) as db, db:
            for number in range(MAX_EVIDENCE_TOTAL // MAX_FILE):
                db.execute('INSERT INTO evidence VALUES (?,?,?,?,?,?,?,?)', ('quota-' + str(number), 'local-workspace', 'fixture.txt', 'text/plain', MAX_FILE, 'fixture', b'a' * MAX_FILE, 'fixture'))
        self.assertEqual(self.upload()[0], 413)
        with closing(sqlite3.connect(self.db)) as db, db:
            self.assertEqual(db.execute('SELECT SUM(size) FROM evidence').fetchone()[0], MAX_EVIDENCE_TOTAL)


if __name__ == '__main__':
    unittest.main(verbosity=2)
