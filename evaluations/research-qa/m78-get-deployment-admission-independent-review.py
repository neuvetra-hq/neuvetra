"""Offline source contract for the deployment admission finalizer."""
from __future__ import annotations

import ast
import datetime as dt
import hashlib
import re

FINALIZER_SHA256 = "00d52457189a064c6c197baa6533a511251a953f63726a3b3ecc2b171b6dcba5"
DEPLOY_SHA256 = "7ae9267f3d317b7e15c3a95c65defc4c4276713fcbf26f5203c24c37bd7c4b80"
OBSERVER_SHA256 = "99cf83b8db88ad68a5734bd9cadf39220bf26f0d0540b7985ca58d6c41c95003"
COMMIT = "9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e"
ROUTE_SHA256 = "fd9b1115130d523629e58b5fcef06fe5355eedc8afd12d6dacc998623c89ff37"
INVENTORY_SHA256 = "e1d0cd97046e21b308894d5f8757f8fc1fa580550e3ec700aa7ab0e1519bbb92"
REQUIRED_CHECKS = {
    "GHG calculation specifications and engine",
    "Offline research catalog tests",
    "Typecheck, lint, unit tests and web builds",
    "Dedicated staging image and offline runtime smoke",
    "Role routing and evidence records",
    "Native PostgreSQL worksheet and tenant regression",
}


def sha(value: bytes | str) -> str:
    if isinstance(value, str):
        value = value.encode()
    return hashlib.sha256(value).hexdigest()


def require(value: object, message: str) -> None:
    if not value:
        raise ValueError(message)


def review_source(finalizer: str, deploy: str, observer: str, *, exact_hash: bool = True) -> dict[str, object]:
    if exact_hash:
        require(sha(finalizer) == FINALIZER_SHA256, "finalizer hash")
        require(sha(deploy) == DEPLOY_SHA256, "deploy hash")
        require(sha(observer) == OBSERVER_SHA256, "observer hash")
    tree = ast.parse(finalizer)
    required = [
        "if not __debug__:raise RuntimeError('Optimized execution refused')",
        f"commit='{COMMIT}'",
        f"route_sha='{ROUTE_SHA256}'",
        f"'{INVENTORY_SHA256}'",
        "len(pins)==173 and len({p['path'] for p in pins})==173",
        "if pin['path']==route:pin['sha256']=route_sha",
        "sha(Path(pin['path']).read_bytes())==pin['sha256']",
        "sha(subprocess.check_output(g+['show',commit+':'+pin['path']]))==pin['sha256']",
        f"'.superpowers/m78-get-route-deploy-once.py':'{DEPLOY_SHA256}'",
        f"'.superpowers/m78-get-route-observe-deployment.py':'{OBSERVER_SHA256}'",
        "'evaluations/research-qa/m78-get-local-comparison-result.json':'caae59a5d5704c53b6d61f901d30dee55be01b7f890c62e7d6e5c1b1b7931417'",
        "'evaluations/research-qa/m78-get-local-comparison-independent-result.json':'7aeabac30562a0f44d44b6a760b12a199bd42f6dbc360df591fb52f91a9e3b96'",
        "'evaluations/research-qa/m78-get-deployment-helper-result.json':'72363306eba69c9e3b09a4df12db8a5ebf5596799f66e9e0bdfbabaae8063f85'",
        "'evaluations/research-qa/m78-get-ci-history-independent-result.json':'35924e7cb2cbea450846c1c06722b1e20d02570e2271c26376a26084079f1851'",
        "'.github/workflows/verify.yml':'4a7810550658b732741992a79152527348f1b6fdd8c0340c5e0dc0015e7f9a14'",
        "ci['sha']==ci['pr_head']==commit and ci['state']=='open'",
        "len(ci['checks'])==6 and {c['name'] for c in ci['checks']}==required",
        "all(c['status']=='completed' and c['conclusion']=='success' for c in ci['checks'])",
        "pins.extend({'path':p,'sha256':sha(Path(p).read_bytes())} for p in [ci_path,inventory,__file__])",
        "len(pins)==len({p['path'] for p in pins})",
        "'status':'m78_get_route_deployment_admitted'",
        "'nativeReview':{'path':'evaluations/research-qa/m78-get-local-comparison-independent-result.json'",
        "'applicationWritesAuthorized':0,'databaseMigrationsAuthorized':0,'deploymentRequestsAuthorized':1",
        "Path('.superpowers/m78-get-route-deployment-admission.json').open('x'",
    ]
    for token in required:
        require(token in finalizer, "missing finalizer contract: " + token)
    require(len(re.findall(r"total_seconds\(\)<120(?:\s|$)", finalizer)) == 1, "missing finalizer contract: freshness")
    imports: set[str] = set()
    for node in tree.body:
        if isinstance(node, ast.Import):
            imports.update(name.name.split(".")[0] for name in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split(".")[0])
    require(imports <= {"json", "hashlib", "subprocess", "pathlib", "datetime"}, "network or credential import")
    subprocess_calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name) and node.func.value.id == "subprocess"]
    require(len(subprocess_calls) == 3 and all(node.func.attr == "check_output" for node in subprocess_calls), "local git reads only")
    require("subprocess.run(" not in finalizer and "urllib" not in finalizer and "['git','credential'" not in finalizer, "no external action")
    for token in [
        "admission['status']=='m78_get_route_deployment_admitted'",
        "for pin in admission['pins']",
        "any(p['path']=='.superpowers/m78-get-route-deploy-once.py'",
        "any(p['path']=='.superpowers/m78-get-route-observe-deployment.py'",
        "admission['routeSha256']",
        "admission['nativeReview']['path']",
    ]:
        require(token in deploy, "deploy interop: " + token)
    for token in ["admission=read('.superpowers/m78-get-route-deployment-admission.json')", "commit=admission['commit']", "intent['admissionSha256']"]:
        require(token in observer, "observer interop: " + token)
    return {"sourcePins": 173, "fixedPins": 7, "dynamicPins": 3, "totalPins": 183, "subprocessReadSites": 3, "writes": 1}


def validate_ci_fixture(ci: dict[str, object], now: dt.datetime) -> None:
    require(ci.get("sha") == COMMIT and ci.get("pr_head") == COMMIT and ci.get("state") == "open", "CI head")
    checks = ci.get("checks")
    require(isinstance(checks, list) and len(checks) == 6, "CI count")
    require({row.get("name") for row in checks if isinstance(row, dict)} == REQUIRED_CHECKS, "CI names")
    require(all(row.get("status") == "completed" and row.get("conclusion") == "success" for row in checks if isinstance(row, dict)), "CI success")
    observed = dt.datetime.fromisoformat(str(ci.get("observed_at")))
    age = (now - observed).total_seconds()
    require(0 <= age < 120, "CI freshness")
