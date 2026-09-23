"""Static review of the one-shot deployment helper. This module never executes it."""
from __future__ import annotations

import ast
import hashlib
import re
from dataclasses import dataclass

EXPECTED_SHA256 = "7ae9267f3d317b7e15c3a95c65defc4c4276713fcbf26f5203c24c37bd7c4b80"
EXPECTED_OBSERVER_SHA256 = "99cf83b8db88ad68a5734bd9cadf39220bf26f0d0540b7985ca58d6c41c95003"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def require(value: bool, message: str) -> None:
    if not value:
        raise ValueError(message)


@dataclass(frozen=True)
class SourceReview:
    sha256: str
    mutation_calls: int
    freshness_checks: int
    exclusive_outputs: int
    fixed_checks: int


def review_source(source: str, *, require_exact_hash: bool = True) -> SourceReview:
    if require_exact_hash:
        require(sha256(source) == EXPECTED_SHA256, "exact helper hash")
    tree = ast.parse(source)
    required = [
        "if not __debug__: raise RuntimeError('Optimized execution refused')",
        "admission['status']=='m78_get_route_deployment_admitted'",
        "sha(Path(pin['path']).read_bytes())==pin['sha256']",
        "any(p['path']=='.superpowers/m78-get-route-deploy-once.py'",
        "any(p['path']=='.superpowers/m78-get-route-observe-deployment.py'",
        "admission['routeSha256']=='fd9b1115130d523629e58b5fcef06fe5355eedc8afd12d6dacc998623c89ff37'",
        "rev-parse','HEAD'",
        "ci['sha']==ci['pr_head']==commit and ci['state']=='open'",
        "{c['name'] for c in ci['checks']}==required",
        "all(c['status']=='completed' and c['conclusion']=='success'",
        "any(p['path']=='.superpowers/m78-get-route-publication-checks.json'",
        "'caae59a5d5704c53b6d61f901d30dee55be01b7f890c62e7d6e5c1b1b7931417'",
        "qa['reviewerId']=='/root/m78_transport_probe'",
        "qa['status']=='m78_get_local_comparison_independently_passed'",
        "live['status']=='SUCCESS'",
        "live['meta']['commitHash']=='59cda7a62d8dcc6b554c92372e3b032577e410c9'",
        "live['meta']['imageDigest']=='sha256:fe46a0e354252026f2bcbf6672e10ec550e52a56f064ab3e75a8af17625749c9'",
        "not any(r['id']!=live['id'] and r['status'] not in ('REMOVED','FAILED','CRASHED','SKIPPED')",
        "serviceInstanceAutoDeployStatus",
        "['enabled'] is False",
        "ready=={'status':'ready','profile':'neuvetra.private-synthetic-staging.v1','schemaVersion':21,'legacyContainmentVerified':True}",
        "serviceInstanceDeployV2(environmentId:\"6642d65a-15a2-41e9-b25e-b7b01990aa28\",serviceId:\"f43abcf9-72f0-4034-828a-8d83ca26b0db\",commitSha:\"'+commit+'\")",
        "'priorDeploymentId':live['id']",
        "'priorImageDigest':live['meta']['imageDigest']",
        "'admissionSha256':sha(Path('.superpowers/m78-get-route-deployment-admission.json').read_bytes())",
        "'querySha256':sha(query_path.read_bytes())",
        "r.returncode==0,'Deployment request uncertain; inspect retained receipt, never retry blindly'",
        "not reply.get('errors') and isinstance(reply['data']['serviceInstanceDeployV2'],str)",
    ]
    for token in required:
        require(token in source, "missing contract: " + token)
    six = {
        "GHG calculation specifications and engine",
        "Offline research catalog tests",
        "Typecheck, lint, unit tests and web builds",
        "Dedicated staging image and offline runtime smoke",
        "Role routing and evidence records",
        "Native PostgreSQL worksheet and tenant regression",
    }
    for name in six:
        require(repr(name) in source, "missing CI check: " + name)

    freshness = source.count("datetime.now(timezone.utc)-datetime.fromisoformat(ci['observed_at'])")
    require(freshness == 2, "freshness must be checked twice")
    require(len(re.findall(r"total_seconds\(\)<180(?:\s|$)", source)) == 2, "freshness must be checked twice")
    require(source.count("subprocess.run(") == 1, "exactly one mutation call")
    require(source.count(".open('x'") == 2 and source.count(".open('xb'") == 1, "exclusive output modes")
    query_open = source.index("with query_path.open('x'")
    intent_open = source.index("with intent.open('x'")
    response_open = source.index("with Path('.superpowers/m78-get-route-deployment-response.json').open('xb')")
    mutation = source.index("r=subprocess.run(")
    second_freshness = source.rindex("datetime.now(timezone.utc)-datetime.fromisoformat(ci['observed_at'])")
    require(second_freshness < query_open < intent_open < response_open < mutation, "pre-mutation ordering")
    require("capture_output=True,timeout=120" in source, "captured bounded mutation")

    mutation_nodes = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name) and node.func.value.id == "subprocess" and node.func.attr == "run"]
    require(len(mutation_nodes) == 1, "one AST mutation call")
    require(not any(isinstance(node, (ast.While, ast.AsyncFor)) for node in ast.walk(tree)), "no retry loop")
    return SourceReview(sha256(source), 1, freshness, 3, len(required) + len(six))


def review_observer_source(source: str, *, require_exact_hash: bool = True) -> SourceReview:
    if require_exact_hash:
        require(sha256(source) == EXPECTED_OBSERVER_SHA256, "exact observer hash")
    tree = ast.parse(source)
    required = [
        "if not __debug__:raise RuntimeError('Optimized execution refused')",
        "reply=read('.superpowers/m78-get-route-deployment-response.json')",
        "not reply.get('errors') and isinstance(reply['data']['serviceInstanceDeployV2'],str)",
        "intent['commit']==commit",
        "intent['admissionSha256']==hashlib.sha256(Path('.superpowers/m78-get-route-deployment-admission.json').read_bytes()).hexdigest()",
        "['deployment','list','--project','119f3652-9d84-4d16-983c-1a17c0fd1aaa','--service','f43abcf9-72f0-4034-828a-8d83ca26b0db','--environment','6642d65a-15a2-41e9-b25e-b7b01990aa28','--json']",
        "row=next(r for r in rows if r['id']==deployment)",
        "if row['status']!='SUCCESS'",
        "row['meta']['commitHash']==commit",
        "re.fullmatch('sha256:[a-f0-9]{64}',row['meta']['imageDigest'])",
        "not any(r['id']!=deployment and r['status'] not in ('REMOVED','FAILED','CRASHED','SKIPPED')",
        "['enabled'] is False",
        "ready=={'status':'ready','profile':'neuvetra.private-synthetic-staging.v1','schemaVersion':21,'legacyContainmentVerified':True}",
        "'status':'m78_get_route_deployed_runtime_verified'",
        "'deploymentCollectionSha256':hashlib.sha256(raw).hexdigest()",
        "'deploymentCollectionPath':'.superpowers/m78-get-route-deployment-collection.json'",
        "'recoveryExecuted':False,'restartExecuted':False,'revisitExecuted':False",
        "Path('.superpowers/m78-get-route-deployment-collection.json').open('xb')",
        "Path('.superpowers/m78-get-route-deployment-verified.json').open('x'",
    ]
    for token in required:
        require(token in source, "missing observer contract: " + token)
    require(source.count("subprocess.check_output(") == 2, "observer read calls")
    require("subprocess.run(" not in source, "observer must not mutate provider")
    progress = source.index("m78-get-route-deployment-progress.json")
    non_success = source.index("if row['status']!='SUCCESS'")
    collection = source.index("m78-get-route-deployment-collection.json').open('xb')")
    verified = source.index("m78-get-route-deployment-verified.json').open('x'")
    require(progress < non_success < collection < verified, "observer output ordering")
    mutation_names = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name) and node.func.value.id == "subprocess" and node.func.attr == "run"]
    require(not mutation_names, "observer mutation call")
    return SourceReview(sha256(source), 0, 0, 2, len(required))
