"""Local, read-only role routing and evidence accounting. No agent execution."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
import sys


class InvalidRecord(ValueError):
    """The local record does not support its declared state."""


def require(condition, message):
    if not condition:
        raise InvalidRecord(message)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def local_file(root, locator):
    require(nonempty(locator), "Expected a nonempty repository file locator")
    relative = Path(locator.split("#", 1)[0])
    require(not relative.is_absolute(), f"Expected repository-relative locator: {locator}")
    candidate = (root / relative).resolve()
    require(candidate.is_relative_to(root.resolve()), f"Locator escapes repository: {locator}")
    require(candidate.is_file(), f"Missing evidence file: {locator}")
    return candidate


def read_json(path):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f"Duplicate JSON key {key!r} in {path}")
            result[key] = value
        return result

    return json.loads(path.read_text(encoding="utf-8-sig"), object_pairs_hook=unique_pairs)


def metric(value, label):
    require(value is None or (type(value) in (int, float) and math.isfinite(value)
                             and value >= 0), f"Invalid nonnegative metric: {label}")


METRICS = ('elapsed_seconds', 'active_seconds', 'waiting_seconds', 'input_tokens',
           'cached_input_tokens', 'output_tokens', 'reasoning_tokens', 'cost_usd')


def fields(obj, required, label):
    require(isinstance(obj, dict), f"{label} must be an object")
    require(set(obj) >= set(required), f"{label} missing fields: {set(required) - set(obj)}")


def evidence(root, values, label, required=False):
    require(isinstance(values, list), f"{label} must be a list")
    require(not required or bool(values), f"{label} requires evidence")
    for value in values:
        local_file(root, value)


def sha(value):
    require(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value),
            "Expected lowercase SHA-256 digest")


def routing(value, supported):
    fields(value, ('model', 'effort'), 'compute route')
    require(isinstance(value['model'], str) and value['model'] in supported,
            'Unknown routing model')
    require(value['effort'] in supported[value['model']], 'Unsupported routing effort')


def validate(root):
    base = root / 'operations' / 'agent-improvement'
    registry = read_json(base / 'roles.json')
    fields(registry, ('schema_version', 'policy_version', 'supported_models', 'roles'), 'registry')
    require(type(registry['schema_version']) is int and registry['schema_version'] == 1,
            'Unsupported registry schema')
    require(nonempty(registry['policy_version']), 'Missing policy version')
    supported = registry['supported_models']
    require(isinstance(supported, dict) and bool(supported), 'Missing supported models')
    for model, efforts in supported.items():
        require(nonempty(model) and isinstance(efforts, list) and bool(efforts)
                and all(nonempty(e) for e in efforts), 'Malformed supported model')
    require(isinstance(registry['roles'], list) and bool(registry['roles']), 'Missing roles')
    roles = {}
    for role in registry['roles']:
        fields(role, ('id', 'prompt', 'sponsor', 'default', 'critical', 'benchmark'), 'role')
        require(nonempty(role['id']) and role['id'] not in roles, 'Missing/duplicate role ID')
        require(nonempty(role['sponsor']), 'Missing role sponsor')
        local_file(root, role['prompt'])
        local_file(root, role['benchmark'])
        routing(role['default'], supported)
        routing(role['critical'], supported)
        roles[role['id']] = role
    lessons_record = read_json(base / 'lessons.json')
    fields(lessons_record, ('schema_version', 'lessons'), 'lessons')
    require(type(lessons_record['schema_version']) is int and lessons_record['schema_version'] == 1,
            'Unsupported lesson schema')
    require(isinstance(lessons_record['lessons'], list), 'Lessons must be a list')
    lessons = set()
    for lesson in lessons_record['lessons']:
        fields(lesson, ('id', 'owner_role', 'trigger', 'required_check', 'evidence', 'status'), 'lesson')
        require(nonempty(lesson['id']) and lesson['id'] not in lessons, 'Missing/duplicate lesson ID')
        require(lesson['owner_role'] in roles, 'Unknown lesson owner role')
        require(nonempty(lesson['trigger']) and nonempty(lesson['required_check']), 'Empty lesson')
        require(lesson['status'] in ('adopted_pending_effectiveness', 'effectiveness_demonstrated', 'reverted'), 'Unsupported lesson status')
        if lesson['status'] != 'adopted_pending_effectiveness':
            require(nonempty(lesson.get('rationale')), 'Lesson lifecycle change requires rationale')
            evidence(root, lesson.get('effectiveness_evidence'), 'lesson effectiveness evidence', True)
        evidence(root, lesson['evidence'], 'lesson evidence', True)
        lessons.add(lesson['id'])
    runs = []
    seen = set()
    for path in sorted((base / 'runs').glob('*.json')):
        run = read_json(path)
        try:
            validate_run(root, run, roles, supported, lessons)
            require(run['id'] not in seen, 'Duplicate run ID')
        except (InvalidRecord, TypeError, KeyError) as exc:
            raise InvalidRecord(f'{path.name}: {exc}') from exc
        seen.add(run['id'])
        runs.append(run)
    return registry, roles, runs


def validate_run(root, run, roles, supported, lessons):
    fields(run, ('schema_version', 'id', 'role', 'execution_context', 'prompt_sha256',
                 'artifacts', 'criteria', 'review', 'outcome', 'compute', 'metrics',
                 'metrics_evidence'), 'run')
    require(type(run['schema_version']) is int and run['schema_version'] == 1, 'Unsupported run schema')
    require(nonempty(run['id']) and nonempty(run['execution_context']), 'Missing run identity')
    require(run['role'] in roles, 'Unknown run role')
    sha(run['prompt_sha256'])
    require(isinstance(run['artifacts'], list), 'Artifacts must be a list')
    artifact_map = {}
    for artifact in run['artifacts']:
        fields(artifact, ('path', 'sha256'), 'artifact')
        sha(artifact['sha256'])
        require(artifact['path'] not in artifact_map, 'Duplicate artifact path')
        artifact_map[artifact['path']] = artifact['sha256']
        require(hashlib.sha256(local_file(root, artifact['path']).read_bytes()).hexdigest()
                == artifact['sha256'], 'Artifact digest mismatch')
    require(isinstance(run['criteria'], list) and bool(run['criteria']), 'Missing acceptance criteria')
    criterion_ids = set()
    for criterion in run['criteria']:
        fields(criterion, ('id', 'status', 'evidence', 'reason'), 'criterion')
        require(nonempty(criterion['id']) and criterion['id'] not in criterion_ids, 'Missing/duplicate criterion ID')
        criterion_ids.add(criterion['id'])
        require(criterion['status'] in ('pending', 'pass', 'fail', 'not_applicable'), 'Invalid criterion status')
        require(criterion['reason'] is None or nonempty(criterion['reason']), 'Invalid criterion reason')
        evidence(root, criterion['evidence'], 'criterion evidence', criterion['status'] == 'pass')
        require(criterion['status'] != 'pass' or bool(run['artifacts']), 'Passed criterion requires artifact')
        require(criterion['status'] != 'not_applicable' or nonempty(criterion['reason']), 'N/A needs reason')
    review = run['review']
    fields(review, ('reviewer_execution_context', 'independent', 'verdict', 'evidence'), 'review')
    require(type(review['independent']) is bool, 'Independent must be boolean')
    require(review['reviewer_execution_context'] is None or nonempty(review['reviewer_execution_context']), 'Invalid reviewer')
    require(review['verdict'] in ('pending', 'pass', 'fail', 'insufficient_evidence'), 'Invalid review verdict')
    if review['independent']:
        require(nonempty(review['reviewer_execution_context'])
                and review['reviewer_execution_context'] != run['execution_context'], 'Self/missing independent reviewer')
    evidence(root, review['evidence'], 'review evidence', review['verdict'] != 'pending')
    reviewed = review.get('reviewed_artifacts', [])
    require(isinstance(reviewed, list), 'Reviewed artifacts must be a list')
    reviewed_map = {}
    for artifact in reviewed:
        fields(artifact, ('path', 'sha256'), 'reviewed artifact')
        sha(artifact['sha256'])
        local_file(root, artifact['path'])
        require(artifact['path'] not in reviewed_map, 'Duplicate reviewed artifact path')
        reviewed_map[artifact['path']] = artifact['sha256']
    outcome = run['outcome']
    fields(outcome, ('status', 'first_review', 'material_findings_open', 'rework_cycles',
                     'escaped_defects', 'repeated_findings'), 'outcome')
    require(outcome['status'] in ('in_progress', 'complete', 'blocked'), 'Invalid outcome')
    require(outcome['first_review'] in ('pending', 'pass', 'fail', 'insufficient_evidence'), 'Invalid first review')
    for name in ('material_findings_open', 'rework_cycles', 'escaped_defects'):
        value = outcome[name]
        require((value is None and name != 'material_findings_open') or
                (type(value) is int and value >= 0), f'Invalid count: {name}')
    require(isinstance(outcome['repeated_findings'], list)
            and all(value in lessons for value in outcome['repeated_findings']), 'Unknown repeated lesson')
    if outcome['status'] == 'blocked':
        require(nonempty(outcome.get('blocker')), 'Blocked outcome requires blocker')
    if outcome['status'] == 'complete':
        require(bool(run['artifacts']), 'Complete run needs artifact')
        require(all(c['status'] in ('pass', 'not_applicable') for c in run['criteria']), 'Complete run has unresolved criteria')
        require(review['independent'] and review['verdict'] == 'pass', 'Complete run needs independent passing review')
        require(outcome['material_findings_open'] == 0, 'Complete run has material findings')
        require(outcome['first_review'] != 'pending', 'Complete run needs first-review disposition')
        require(bool(reviewed_map) and reviewed_map == artifact_map,
                'Complete run needs review bound to exact artifact versions')
    compute = run['compute']
    fields(compute, ('requested', 'observed', 'observation_evidence'), 'compute')
    routing(compute['requested'], supported)
    fields(compute['observed'], ('model', 'effort'), 'observed compute')
    for name in ('model', 'effort'):
        require(compute['observed'][name] is None or nonempty(compute['observed'][name]), 'Invalid observed setting')
    evidence(root, compute['observation_evidence'], 'compute observation evidence',
             any(v is not None for v in compute['observed'].values()))
    fields(run['metrics'], METRICS, 'metrics')
    require(set(run['metrics']) == set(METRICS), 'Unknown metric fields')
    for name, value in run['metrics'].items():
        metric(value, name)
        if name.endswith('_tokens'):
            require(value is None or type(value) is int, f'Token count must be integer: {name}')
    evidence(root, run['metrics_evidence'], 'metrics evidence',
             any(value is not None for value in run['metrics'].values()))
    metrics = run['metrics']
    for subset, total in (('cached_input_tokens', 'input_tokens'), ('reasoning_tokens', 'output_tokens')):
        if metrics[subset] is not None and metrics[total] is not None:
            require(metrics[subset] <= metrics[total], f'{subset} exceeds {total}')
    for duration in ('active_seconds', 'waiting_seconds'):
        if metrics[duration] is not None and metrics['elapsed_seconds'] is not None:
            require(metrics[duration] <= metrics['elapsed_seconds'], f'{duration} exceeds elapsed_seconds')
    if all(metrics[k] is not None for k in ('active_seconds', 'waiting_seconds', 'elapsed_seconds')):
        require(metrics['active_seconds'] + metrics['waiting_seconds'] <= metrics['elapsed_seconds'],
                'Active plus waiting duration exceeds elapsed duration')


def summarize(roles, runs):
    result = {}
    for role in roles:
        selected = [r for r in runs if r['role'] == role]
        reviewed = [r for r in selected if r['outcome']['first_review'] in ('pass', 'fail')]
        result[role] = {
            'runs': len(selected),
            'complete': sum(r['outcome']['status'] == 'complete' for r in selected),
            'outcome_counts': {name: {
                'known_count': sum(r['outcome'][name] is not None for r in selected),
                'unknown_count': sum(r['outcome'][name] is None for r in selected),
                'known_sum': (sum(r['outcome'][name] for r in selected if r['outcome'][name] is not None)
                              if any(r['outcome'][name] is not None for r in selected) else None)
            } for name in ('rework_cycles', 'escaped_defects', 'material_findings_open')},
            'runs_with_repeated_findings': sum(bool(r['outcome']['repeated_findings']) for r in selected),
            'compute_observation': {
                'both_settings_known': sum(all(r['compute']['observed'][k] is not None for k in ('model', 'effort')) for r in selected),
                'any_setting_unknown': sum(any(r['compute']['observed'][k] is None for k in ('model', 'effort')) for r in selected)},
            'first_review': {
                'pass': sum(r['outcome']['first_review'] == 'pass' for r in selected),
                'pass_fail_denominator': len(reviewed),
                'pending': sum(r['outcome']['first_review'] == 'pending' for r in selected),
                'insufficient_evidence': sum(r['outcome']['first_review'] == 'insufficient_evidence' for r in selected)},
            'metrics': {name: {
                'known_count': sum(r['metrics'][name] is not None for r in selected),
                'unknown_count': sum(r['metrics'][name] is None for r in selected),
                'known_sum': (sum(r['metrics'][name] for r in selected if r['metrics'][name] is not None)
                              if any(r['metrics'][name] is not None for r in selected) else None)
            } for name in METRICS}}
    return {'roles': result, 'limitation': 'Recorded evidence only; no model causality, role grade, or savings estimate.'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('validate')
    commands.add_parser('summarize')
    dispatch = commands.add_parser('dispatch')
    dispatch.add_argument('role')
    dispatch.add_argument('--risk', choices=('routine', 'critical'), default='routine')
    dispatch.add_argument('--task-id')
    dispatch.add_argument('--executor')
    args = parser.parse_args(argv)
    try:
        registry, roles, runs = validate(args.root)
        if args.command == 'validate':
            result = {'valid': True, 'roles': len(roles), 'runs': len(runs)}
        elif args.command == 'summarize':
            result = summarize(roles, runs)
        else:
            require(args.role in roles, f'Unknown role: {args.role}')
            role = roles[args.role]
            result = {'action': 'assignment_manifest_only', 'policy_version': registry['policy_version'],
                      'role': args.role, 'sponsor': role['sponsor'], 'task_id': args.task_id,
                      'execution_context': args.executor, 'risk': args.risk,
                      'prompt': role['prompt'],
                      'prompt_sha256': hashlib.sha256(local_file(args.root, role['prompt']).read_bytes()).hexdigest(),
                      'benchmark': role['benchmark'],
                      'compute': {'requested': role['critical' if args.risk == 'critical' else 'default'],
                                  'observed': {'model': None, 'effort': None}, 'observation_evidence': []},
                      'limitation': 'No worker started or model setting enforced. Coordinator must complete bounded assignment and verify actual execution settings.'}
        print(json.dumps(result, indent=2, allow_nan=False))
        return 0
    except (InvalidRecord, OSError, ValueError, TypeError, KeyError) as exc:
        print(json.dumps({'valid': False, 'error': str(exc)}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
