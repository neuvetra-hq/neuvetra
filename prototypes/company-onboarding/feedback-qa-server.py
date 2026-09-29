import gc
import hashlib
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path

from server import MAX_EVIDENCE_TOTAL, Store, validate


class FeedbackServerIndependentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.db = Path(self.temp.name) / 'feedback-qa.sqlite3'
        self.store = Store(self.db)

    def tearDown(self):
        self.store = None
        gc.collect()
        self.temp.cleanup()

    def test_duplicate_hash_reuses_one_row_atomically(self):
        content = b'independent duplicate evidence fixture\n'
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda name: self.store.add_evidence(name, 'text/plain', content), ('first.txt', 'second.txt')))
        self.assertEqual({row['id'] for row in results}, {results[0]['id']})
        self.assertEqual(sorted(row['duplicate'] for row in results), [False, True])
        with closing(sqlite3.connect(self.db)) as db:
            self.assertEqual(db.execute('select count(*) from evidence').fetchone()[0], 1)
            self.assertEqual(db.execute('select sum(size) from evidence').fetchone()[0], len(content))

    def test_duplicate_is_reused_before_quota_and_unique_file_is_refused(self):
        content = b'original evidence\n'
        original = self.store.add_evidence('original.txt', 'text/plain', content)
        with closing(sqlite3.connect(self.db)) as db:
            with db:
                remaining = MAX_EVIDENCE_TOTAL - len(content)
                index = 0
                while remaining:
                    filler_size = min(5 * 1024 * 1024, remaining)
                    filler_name = f'filler-{index}.txt'
                    filler_sha = hashlib.sha256(filler_name.encode()).hexdigest()
                    db.execute('insert into evidence values (?,?,?,?,?,?,?,?)', (f'ev_{index:032x}', 'local-workspace', filler_name, 'text/plain', filler_size, filler_sha, b'filler', '2026-09-25T12:00:00+00:00'))
                    remaining -= filler_size
                    index += 1
        reused = self.store.add_evidence('renamed.txt', 'text/plain', content)
        self.assertEqual(reused['id'], original['id'])
        self.assertTrue(reused['duplicate'])
        with self.assertRaises(Exception) as raised:
            self.store.add_evidence('new.txt', 'text/plain', b'new evidence\n')
        self.assertEqual(type(raised.exception).__name__, 'EvidenceFull')
        with closing(sqlite3.connect(self.db)) as db:
            self.assertEqual(db.execute('select count(*) from evidence').fetchone()[0], 11)
            self.assertEqual(db.execute('select sum(size) from evidence').fetchone()[0], MAX_EVIDENCE_TOTAL)

    def test_server_normalizes_grouped_quantity_and_unit_alias_with_originals(self):
        value = {
            'expectedRevision': 0,
            'onboarding': None,
            'plan': {
                'schemaVersion': 1,
                'catalogVersion': 'feedback-qa',
                'items': {'one': {'records': [{'id': 'r1', 'recordType': 'Fuel', 'quantity': '1,234.50', 'unit': 'gallons', 'quality': 'actual', 'periodStart': '2025-01-01', 'periodEnd': '2025-12-31', 'reference': 'invoice', 'notes': '', 'evidenceIds': []}]}},
                'custom': [],
                'screening': {},
            },
        }
        validate(value)
        record = value['plan']['items']['one']['records'][0]
        self.assertEqual(record['quantity'], '1234.50')
        self.assertEqual(record['quantityOriginal'], '1,234.50')
        self.assertEqual(record['unit'], 'US gallon')
        self.assertEqual(record['unitOriginal'], 'gallons')


if __name__ == '__main__':
    unittest.main(verbosity=2)
