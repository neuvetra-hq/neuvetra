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
VALIDATOR = REPO / '.superpowers' / 'm78-continuation4-validate-exercise-for-restart.ts'
DEPLOYMENT = '0f2e99f3-67ef-4f4c-b3c3-a39c62eabc78'
QA_PATH = 'evaluations/research-qa/m78-continuation4-exercise-actual-qa-result.json'


def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


@contextlib.contextmanager
def cwd(path: Path):
    before = Path.cwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(before)


def execute(path: Path, argv: list[str], side_effect):
    with patch.object(sys, 'argv', [str(path), *argv]), patch(
        'subprocess.run', side_effect=side_effect
    ) as mocked, contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        runpy.run_path(str(path), run_name='__main__')
    return mocked


def accepted_bytes(reviewer='/root/m78_transport_probe'):
    return (json.dumps({
        'status': 'm78_independent_continuation4_exercise_passed',
        'applicationPostRequests': 37,
        'actualRestartVerified': False,
        'reviewerId': reviewer,
        'materialFindingsOpen': 0,
        'lifecycleReview': {
            'path': 'evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-repair-result.json',
            'sha256': '206130bed4adcad7fc6608d9d98fbb3f4c94d92a960abdfb8a995d816e50a7f3',
        },
    }, separators=(',', ':')) + '\n').encode()


def validated(journal: bytes):
    return {
        'status': 'restart_exercise_admission_verified',
        'journalSha256': sha(journal),
        'diagnosticsSha256': 'd' * 64,
        'rootEvaluation': {'path': 'root.json', 'sha256': 'e' * 64},
    }


class RestartHelperRepairReview(unittest.TestCase):
    def fixture(self):
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        (root / '.superpowers').mkdir()
        qa = root / QA_PATH
        qa.parent.mkdir(parents=True)
        raw = accepted_bytes()
        qa.write_bytes(raw)
        journal = (json.dumps({
            'kind': 'attempt_finished', 'mode': 'exercise',
            'data': {'status': 'passed', 'allCreatedAuthSessionsClosed': True, 'unknownAuthSessions': 0},
        }, separators=(',', ':')) + '\n').encode()
        (root / '.superpowers/m78-hosted-continuation4.jsonl').write_bytes(journal)
        return temporary, root, raw, journal

    def test_exact_admission_precedes_one_exact_restart_and_second_attempt_refuses(self):
        temporary, root, qa, journal = self.fixture()
        with temporary:
            calls = []
            def fake(args, **kwargs):
                calls.append(args)
                if args[0].endswith('bun.exe'):
                    return subprocess.CompletedProcess(args, 0, json.dumps(validated(journal)).encode(), b'')
                self.assertIn(f'deploymentRestart(id:"{DEPLOYMENT}")', args[3])
                return subprocess.CompletedProcess(args, 0, json.dumps({'data': {'deploymentRestart': True}}).encode(), b'')
            with cwd(root):
                execute(REQUEST, [QA_PATH, sha(qa)], fake)
                with self.assertRaises(AssertionError):
                    execute(REQUEST, [QA_PATH, sha(qa)], fake)
            provider = [args for args in calls if args[0].endswith('bunx.exe') and args[2] == 'api']
            self.assertEqual(len(provider), 1)
            intent = json.loads((root / '.superpowers/m78-continuation-restart-requested.json').read_text())
            self.assertEqual(intent['exerciseAcceptance'], {'path': QA_PATH, 'sha256': sha(qa)})
            self.assertEqual(intent['validatedExercise'], validated(journal))

    def test_validation_refusal_writes_no_intent_and_never_calls_provider(self):
        temporary, root, qa, _journal = self.fixture()
        with temporary:
            def fake(args, **kwargs):
                raise subprocess.CalledProcessError(1, args)
            with cwd(root), self.assertRaises(subprocess.CalledProcessError):
                execute(REQUEST, [QA_PATH, sha(qa)], fake)
            self.assertFalse((root / '.superpowers/m78-continuation-restart-requested.json').exists())
            self.assertFalse((root / '.superpowers/m78-continuation-restart-ack.json').exists())

    def test_unassigned_reviewer_is_refused_before_validation_or_provider(self):
        temporary, root, _qa, _journal = self.fixture()
        with temporary:
            forged = accepted_bytes('/unregistered-reviewer')
            (root / QA_PATH).write_bytes(forged)
            with cwd(root), patch('subprocess.run') as mocked, self.assertRaises(AssertionError):
                with patch.object(sys, 'argv', [str(REQUEST), QA_PATH, sha(forged)]), contextlib.redirect_stdout(io.StringIO()):
                    runpy.run_path(str(REQUEST), run_name='__main__')
            self.assertEqual(mocked.call_count, 0)
            validator = VALIDATOR.read_text(encoding='utf-8')
            self.assertIn("qa.reviewerId === '/root/m78_transport_probe'", validator)
            self.assertIn("qa.lifecycleReview?.path ===", validator)

    def test_collection_revalidates_exact_link_and_persists_one_sanitized_start(self):
        temporary, root, qa, journal = self.fixture()
        with temporary:
            intent = {
                'deploymentId': DEPLOYMENT,
                'requestedAt': '2026-09-22T20:00:00+00:00',
                'exerciseAcceptance': {'path': QA_PATH, 'sha256': sha(qa)},
                'validatedExercise': validated(journal),
            }
            (root / '.superpowers/m78-continuation-restart-requested.json').write_text(json.dumps(intent))
            (root / '.superpowers/m78-continuation-restart-ack.json').write_text(json.dumps({'data': {'deploymentRestart': True}}))
            calls = []
            def fake(args, **kwargs):
                calls.append(args)
                if args[0].endswith('bun.exe'):
                    return subprocess.CompletedProcess(args, 0, json.dumps(validated(journal)).encode(), b'')
                row = {'timestamp': '2026-09-22T20:01:00Z', 'message': json.dumps({'event': 'staging_started', 'secret': 'discard'})}
                return subprocess.CompletedProcess(args, 0, json.dumps(row).encode(), b'')
            with cwd(root):
                execute(COLLECT, [], fake)
            saved = (root / '.superpowers/m78-continuation-final-startup-logs.jsonl').read_text()
            self.assertNotIn('secret', saved)
            self.assertEqual(json.loads(saved), {'event': 'staging_started', 'timestamp': '2026-09-22T20:01:00Z'})
            collection = json.loads((root / '.superpowers/m78-continuation-final-startup-collection.json').read_text())
            self.assertEqual(collection['exerciseAcceptance'], intent['exerciseAcceptance'])
            self.assertEqual(collection['validatedExercise'], intent['validatedExercise'])

    def test_collection_refuses_multiple_unique_startups_without_evidence_files(self):
        temporary, root, qa, journal = self.fixture()
        with temporary:
            intent = {
                'deploymentId': DEPLOYMENT,
                'requestedAt': '2026-09-22T20:00:00+00:00',
                'exerciseAcceptance': {'path': QA_PATH, 'sha256': sha(qa)},
                'validatedExercise': validated(journal),
            }
            (root / '.superpowers/m78-continuation-restart-requested.json').write_text(json.dumps(intent))
            (root / '.superpowers/m78-continuation-restart-ack.json').write_text(json.dumps({'data': {'deploymentRestart': True}}))
            def fake(args, **kwargs):
                if args[0].endswith('bun.exe'):
                    return subprocess.CompletedProcess(args, 0, json.dumps(validated(journal)).encode(), b'')
                rows = [
                    {'timestamp': '2026-09-22T20:01:00Z', 'message': json.dumps({'event': 'staging_started'})},
                    {'timestamp': '2026-09-22T20:02:00Z', 'message': json.dumps({'event': 'staging_started'})},
                ]
                return subprocess.CompletedProcess(args, 0, '\n'.join(json.dumps(row) for row in rows).encode(), b'')
            with cwd(root), self.assertRaisesRegex(AssertionError, 'Ambiguous startup events'):
                execute(COLLECT, [], fake)
            self.assertFalse((root / '.superpowers/m78-continuation-final-startup-logs.jsonl').exists())
            self.assertFalse((root / '.superpowers/m78-continuation-final-startup-collection.json').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
