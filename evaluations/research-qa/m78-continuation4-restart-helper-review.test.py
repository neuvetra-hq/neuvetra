import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[2]
REQUEST = REPO / '.superpowers' / 'm78-continuation4-request-restart.py'
COLLECT = REPO / '.superpowers' / 'm78-continuation4-collect-restart-startup.py'
OBSERVER = REPO / '.superpowers' / 'm78-continuation-release-observe-runtime.py'
DEPLOYMENT = '0f2e99f3-67ef-4f4c-b3c3-a39c62eabc78'


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@contextlib.contextmanager
def cwd(path: Path):
    previous = Path.cwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(previous)


class RestartHelperReview(unittest.TestCase):
    def run_script(self, path: Path, argv: list[str], completed: subprocess.CompletedProcess[bytes]):
        with patch.object(sys, 'argv', [str(path), *argv]), patch(
            'subprocess.run', return_value=completed
        ) as mocked, contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            runpy.run_path(str(path), run_name='__main__')
        return mocked

    def test_request_helper_admits_minimal_unverified_exercise_and_mutates(self):
        """Executable finding: no clean journal, 37-op, diagnostics, or actual-QA binding is required."""
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            sp = root / '.superpowers'
            sp.mkdir()
            forged_journal = (
                json.dumps({
                    'kind': 'attempt_finished',
                    'mode': 'exercise',
                    'data': {
                        'status': 'passed',
                        'allCreatedAuthSessionsClosed': True,
                        'unknownAuthSessions': 0,
                    },
                }, separators=(',', ':')) + '\n'
            ).encode()
            (sp / 'm78-hosted-continuation4.jsonl').write_bytes(forged_journal)
            accepted = {
                'status': 'm78_independent_continuation4_exercise_passed',
                'applicationPostRequests': 37,
                'actualRestartVerified': False,
                'admission': {'journalSha256': sha256(forged_journal)},
            }
            accepted_path = root / 'forged-accepted.json'
            accepted_bytes = (json.dumps(accepted, separators=(',', ':')) + '\n').encode()
            accepted_path.write_bytes(accepted_bytes)
            completed = subprocess.CompletedProcess(
                [], 0, json.dumps({'data': {'deploymentRestart': True}}).encode(), b''
            )
            with cwd(root):
                mocked = self.run_script(REQUEST, [str(accepted_path), sha256(accepted_bytes)], completed)
            self.assertEqual(mocked.call_count, 1)
            self.assertTrue((sp / 'm78-continuation-restart-requested.json').exists())
            self.assertTrue((sp / 'm78-continuation-restart-ack.json').exists())

    def test_collect_helper_ignores_tampered_exercise_acceptance_link(self):
        """Executable finding: collection does not revalidate the acceptance path/hash stored in intent."""
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            sp = root / '.superpowers'
            sp.mkdir()
            intent = {
                'schemaVersion': 1,
                'kind': 'm78_continuation4_restart_intent',
                'requestedAt': '2026-09-22T20:00:00+00:00',
                'deploymentId': DEPLOYMENT,
                'exerciseAcceptance': {'path': 'missing.json', 'sha256': '0' * 64},
            }
            ack = {'data': {'deploymentRestart': True}}
            (sp / 'm78-continuation-restart-requested.json').write_text(json.dumps(intent), encoding='utf-8')
            (sp / 'm78-continuation-restart-ack.json').write_text(json.dumps(ack), encoding='utf-8')
            provider_rows = [
                {'timestamp': '2026-09-22T20:01:00Z', 'message': json.dumps({'event': 'staging_started'})},
            ]
            completed = subprocess.CompletedProcess(
                [], 0, '\n'.join(json.dumps(row) for row in provider_rows).encode(), b''
            )
            with cwd(root):
                mocked = self.run_script(COLLECT, [], completed)
            self.assertEqual(mocked.call_count, 1)
            self.assertTrue((sp / 'm78-continuation-final-startup-logs.jsonl').exists())
            self.assertTrue((sp / 'm78-continuation-final-startup-collection.json').exists())

    def test_collector_preserves_ambiguous_provider_order_and_observer_uses_last(self):
        """Executable/static finding: multiple starts remain ambiguous and last means provider output order."""
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            sp = root / '.superpowers'
            sp.mkdir()
            intent = {
                'requestedAt': '2026-09-22T20:00:00+00:00',
                'deploymentId': DEPLOYMENT,
                'exerciseAcceptance': {'path': 'accepted.json', 'sha256': 'a' * 64},
            }
            (sp / 'm78-continuation-restart-requested.json').write_text(json.dumps(intent), encoding='utf-8')
            (sp / 'm78-continuation-restart-ack.json').write_text(
                json.dumps({'data': {'deploymentRestart': True}}), encoding='utf-8'
            )
            rows = [
                {'timestamp': '2026-09-22T20:02:00Z', 'message': json.dumps({'event': 'staging_started'})},
                {'timestamp': '2026-09-22T20:01:00Z', 'message': json.dumps({'event': 'staging_started'})},
            ]
            completed = subprocess.CompletedProcess(
                [], 0, '\n'.join(json.dumps(row) for row in rows).encode(), b''
            )
            with cwd(root):
                self.run_script(COLLECT, [], completed)
            events = [
                json.loads(line)
                for line in (sp / 'm78-continuation-final-startup-logs.jsonl').read_text().splitlines()
            ]
            self.assertEqual([e['timestamp'] for e in events], ['2026-09-22T20:02:00Z', '2026-09-22T20:01:00Z'])
            observer_text = OBSERVER.read_text(encoding='utf-8')
            self.assertIn('actualStartupEvent=starts[-1]', observer_text)


if __name__ == '__main__':
    unittest.main(verbosity=2)
