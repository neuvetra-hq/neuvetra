"""Adversarial local evidence/dispatch checks; no external services required."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest

import agent_ops


class AgentOpsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.base = self.root / 'operations/agent-improvement'
        (self.base / 'runs').mkdir(parents=True)
        (self.root / 'proof.md').write_text('Independent reproducible proof', encoding='utf-8')
        self.digest = hashlib.sha256((self.root / 'proof.md').read_bytes()).hexdigest()
        self.registry = {'schema_version': 1, 'policy_version': 'test.1',
                         'supported_models': {'test-model': ['medium', 'high']},
                         'roles': [{'id': 'engineer', 'prompt': 'proof.md', 'sponsor': 'cto',
                                    'default': {'model': 'test-model', 'effort': 'medium'},
                                    'critical': {'model': 'test-model', 'effort': 'high'},
                                    'benchmark': 'proof.md#example'}]}
        self.write('roles.json', self.registry)
        self.write('lessons.json', {'schema_version': 1, 'lessons': []})
        self.run_record = {
            'schema_version': 1, 'id': 'T1', 'role': 'engineer', 'execution_context': 'author',
            'prompt_sha256': self.digest,
            'artifacts': [{'path': 'proof.md', 'sha256': self.digest}],
            'criteria': [{'id': 'C1', 'status': 'pass', 'evidence': ['proof.md#result'], 'reason': None}],
            'review': {'reviewer_execution_context': 'reviewer', 'independent': True,
                       'verdict': 'pass', 'evidence': ['proof.md'],
                       'reviewed_artifacts': [{'path': 'proof.md', 'sha256': self.digest}]},
            'outcome': {'status': 'complete', 'first_review': 'fail', 'material_findings_open': 0,
                        'rework_cycles': 1, 'escaped_defects': None, 'repeated_findings': []},
            'compute': {'requested': {'model': 'test-model', 'effort': 'medium'},
                        'observed': {'model': None, 'effort': None}, 'observation_evidence': []},
            'metrics': dict.fromkeys(agent_ops.METRICS), 'metrics_evidence': []}

    def write(self, name, value):
        (self.base / name).write_text(json.dumps(value), encoding='utf-8')

    def check(self):
        self.write('runs/test.json', self.run_record)
        return agent_ops.validate(self.root)

    def test_complete_evidence_and_critical_dispatch(self):
        self.check()
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = agent_ops.main(['--root', str(self.root), 'dispatch', 'engineer', '--risk', 'critical'])
        self.assertEqual(code, 0)
        manifest = json.loads(output.getvalue())
        self.assertEqual(manifest['compute']['requested']['effort'], 'high')
        self.assertIsNone(manifest['compute']['observed']['model'])
        self.assertEqual(manifest['prompt_sha256'], self.digest)
        self.assertEqual(len(list((self.base / 'runs').glob('*.json'))), 1)

    def test_missing_proof_cannot_pass(self):
        self.run_record['criteria'][0]['evidence'] = []
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'requires evidence'):
            self.check()

    def test_complete_cannot_have_pending_criterion_or_material_finding(self):
        for change in ('pending', 'finding'):
            with self.subTest(change=change):
                self.run_record['criteria'][0]['status'] = 'pending' if change == 'pending' else 'pass'
                self.run_record['outcome']['material_findings_open'] = int(change == 'finding')
                with self.assertRaises(agent_ops.InvalidRecord):
                    self.check()

    def test_self_review_not_independent(self):
        self.run_record['review']['reviewer_execution_context'] = 'author'
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'independent reviewer'):
            self.check()

    def test_complete_requires_initial_review_disposition(self):
        self.run_record['outcome']['first_review'] = 'pending'
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'first-review disposition'):
            self.check()

    def test_review_cannot_be_copied_to_changed_artifact(self):
        (self.root / 'proof.md').write_text('New author version')
        self.run_record['artifacts'][0]['sha256'] = hashlib.sha256((self.root / 'proof.md').read_bytes()).hexdigest()
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'exact artifact versions'):
            self.check()

    def test_duplicate_or_missing_review_bindings_rejected(self):
        self.run_record['review']['reviewed_artifacts'] *= 2
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'Duplicate reviewed'):
            self.check()
        self.run_record['review']['reviewed_artifacts'] = []
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'exact artifact versions'):
            self.check()
        self.run_record['artifacts'] *= 2
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'Duplicate artifact'):
            self.check()

    def test_known_metric_subsets_and_durations_are_consistent(self):
        cases = ({'input_tokens': 1, 'cached_input_tokens': 20},
                 {'output_tokens': 1, 'reasoning_tokens': 20},
                 {'active_seconds': 20, 'elapsed_seconds': 1},
                 {'waiting_seconds': 20, 'elapsed_seconds': 1},
                 {'active_seconds': 6, 'waiting_seconds': 5, 'elapsed_seconds': 10},
                 {'input_tokens': 1.5})
        self.run_record['metrics_evidence'] = ['proof.md']
        for case in cases:
            with self.subTest(case=case):
                self.run_record['metrics'] = dict.fromkeys(agent_ops.METRICS)
                self.run_record['metrics'].update(case)
                with self.assertRaises(agent_ops.InvalidRecord):
                    self.check()
        self.run_record['metrics'] = dict.fromkeys(agent_ops.METRICS)
        self.run_record['metrics'].update({'input_tokens': 20, 'cached_input_tokens': 20,
                                         'active_seconds': 6, 'waiting_seconds': 4, 'elapsed_seconds': 10})
        self.check()

    def test_lesson_lifecycle_requires_effectiveness_evidence(self):
        lesson = {'id': 'L1', 'owner_role': 'engineer', 'trigger': 'Repeated defect',
                  'required_check': 'Unseen case', 'evidence': ['proof.md'],
                  'status': 'effectiveness_demonstrated'}
        for status in ('effectiveness_demonstrated', 'reverted'):
            lesson['status'] = status
            lesson.pop('rationale', None)
            self.write('lessons.json', {'schema_version': 1, 'lessons': [lesson]})
            with self.assertRaisesRegex(agent_ops.InvalidRecord, 'requires rationale'):
                self.check()
            lesson['rationale'] = 'Independent comparison result'
            lesson['effectiveness_evidence'] = []
            self.write('lessons.json', {'schema_version': 1, 'lessons': [lesson]})
            with self.assertRaisesRegex(agent_ops.InvalidRecord, 'requires evidence'):
                self.check()
            lesson['effectiveness_evidence'] = ['proof.md']
            self.write('lessons.json', {'schema_version': 1, 'lessons': [lesson]})
            self.check()

    def test_tampered_artifact_rejected(self):
        (self.root / 'proof.md').write_text('Changed after review', encoding='utf-8')
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'digest mismatch'):
            self.check()

    def test_unknown_metrics_stay_unknown_and_review_denominator_explicit(self):
        _, roles, runs = self.check()
        result = agent_ops.summarize(roles, runs)['roles']['engineer']
        self.assertEqual(result['first_review']['pass_fail_denominator'], 1)
        self.assertEqual(result['first_review']['pass'], 0)
        cost = result['metrics']['cost_usd']
        self.assertEqual(cost['unknown_count'], 1)
        self.assertEqual(cost['known_count'], 0)
        self.assertIsNone(cost['known_sum'])

    def test_invalid_metrics_rejected(self):
        for bad in (-1, True, float('nan'), float('inf'), '10'):
            with self.subTest(bad=bad):
                self.run_record['metrics']['cost_usd'] = bad
                with self.assertRaisesRegex(agent_ops.InvalidRecord, 'metric'):
                    self.check()

    def test_metrics_and_observed_compute_require_proof(self):
        self.run_record['metrics']['cost_usd'] = 0
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'metrics evidence'):
            self.check()
        self.run_record['metrics']['cost_usd'] = None
        self.run_record['compute']['observed']['model'] = 'test-model'
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'observation evidence'):
            self.check()

    def test_unknown_role_and_unsupported_effort_rejected(self):
        self.run_record['role'] = 'imaginary'
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'Unknown run role'):
            self.check()
        self.run_record['role'] = 'engineer'
        self.run_record['compute']['requested']['effort'] = 'impossible'
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'Unsupported routing effort'):
            self.check()

    def test_escape_locator_and_missing_file_rejected(self):
        for bad in ('../outside.md', 'missing.md'):
            self.run_record['criteria'][0]['evidence'] = [bad]
            with self.assertRaises(agent_ops.InvalidRecord):
                self.check()

    def test_in_progress_pending_review_is_honest(self):
        self.run_record['outcome']['status'] = 'in_progress'
        self.run_record['outcome']['first_review'] = 'pending'
        self.run_record['criteria'][0]['status'] = 'pending'
        self.run_record['criteria'][0]['evidence'] = []
        self.run_record['review'] = {'reviewer_execution_context': None, 'independent': False,
                                     'verdict': 'pending', 'evidence': []}
        _, roles, runs = self.check()
        summary = agent_ops.summarize(roles, runs)['roles']['engineer']
        self.assertEqual(summary['complete'], 0)
        self.assertEqual(summary['first_review']['pass_fail_denominator'], 0)
        self.assertEqual(summary['first_review']['pending'], 1)

    def test_blocked_requires_specific_dependency(self):
        self.run_record['outcome']['status'] = 'blocked'
        with self.assertRaisesRegex(agent_ops.InvalidRecord, 'requires blocker'):
            self.check()

    def test_cli_reports_malformed_json_without_traceback(self):
        (self.base / 'roles.json').write_text('{"schema_version":1,"schema_version":2}')
        output = io.StringIO()
        with contextlib.redirect_stderr(output):
            code = agent_ops.main(['--root', str(self.root), 'validate'])
        self.assertEqual(code, 1)
        self.assertIn('Duplicate JSON key', json.loads(output.getvalue())['error'])
        self.assertNotIn('Traceback', output.getvalue())


if __name__ == '__main__':
    unittest.main()
