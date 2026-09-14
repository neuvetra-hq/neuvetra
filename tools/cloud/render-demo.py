"""Render explicit safe cloud test receipts; standard library, no ENV or network."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
from pathlib import Path
import re


class ReportError(ValueError):
    pass


def text(value, fallback="Not recorded"):
    return value if isinstance(value, str) and value else fallback


def escape(value):
    return html.escape(str(value), quote=True)


def unique(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ReportError("duplicate_json_key")
        value[key] = item
    return value


def read_report(path):
    path = Path(path)
    if path.suffix.lower() != ".json" or not path.is_file() or path.stat().st_size > 2_000_000:
        raise ReportError("invalid_report_file")
    raw = path.read_bytes()
    try:
        value = json.loads(raw, object_pairs_hook=unique)
    except (UnicodeError, ValueError):
        raise ReportError("invalid_report_json") from None
    if not isinstance(value, dict):
        raise ReportError("invalid_report_shape")
    # These inputs must be coordinator-sanitized observations, never auth state.
    def reject_credentials(node):
        if isinstance(node, dict):
            if any(k.lower() in {"password", "access_token", "refresh_token", "reader_jwt", "api_key", "apikey", "authorization", "secrets", "database_url"} for k in node):
                raise ReportError("credential_fields_refused")
            for child in node.values():
                reject_credentials(child)
        elif isinstance(node, list):
            for child in node:
                reject_credentials(child)
    reject_credentials(value)
    return value, hashlib.sha256(raw).hexdigest()


def digest(value):
    return value if isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) else "Not recorded"


def rows(value):
    return value if isinstance(value, list) and all(isinstance(row, dict) for row in value) else []


def evidence_card(item, candidate_ids):
    citation = item.get("citation") if isinstance(item.get("citation"), dict) else {}
    pid = text(item.get("passage_id"))
    quote = text(item.get("text"))
    qualification = item.get("qualifications")
    qualification = qualification if isinstance(qualification, list) and all(isinstance(q, str) for q in qualification) else []
    details = [("Source", text(citation.get("title"))), ("Version", text(citation.get("version"))),
               ("Locator", text(citation.get("locator"))), ("Passage SHA-256", digest(item.get("text_sha256"))),
               ("Original SHA-256", digest(citation.get("source_sha256"))), ("Extraction SHA-256", digest(citation.get("extraction_sha256")))]
    meta = "".join(f"<div><dt>{escape(label)}</dt><dd>{escape(value)}</dd></div>" for label, value in details)
    notes = "".join(f"<p class=qualification>{escape(q)}</p>" for q in qualification)
    relation = "Search candidate" if pid in candidate_ids else "Required supporting context"
    # Authenticated object URLs are deliberately not hyperlinks: this local
    # receipt viewer has no reader session or download handler.
    return f"""<article class=passage><div class=passage-top><span class=passage-id>{escape(pid)}</span><span>{relation}</span></div>
<blockquote>{escape(quote)}</blockquote>{notes}<details><summary>Inspect source &amp; integrity</summary><dl>{meta}</dl>
<p class=muted>The original remains in private storage. This offline report has no account session or download access.</p></details></article>"""


def render(roundtrip, access, publication, pins):
    cases = rows(roundtrip.get("cases"))
    checks = rows(access.get("checks"))
    objects = rows(publication.get("object_receipts"))
    vectors = rows(publication.get("vector_receipts"))
    def case_passed(case):
        result = case.get("result") if isinstance(case.get("result"), dict) else {}
        return case.get("passed") is True and result.get("status") == "evidence" and result.get("generated_answer") is False and bool(rows(result.get("evidence")))
    passed_cases = sum(case_passed(case) for case in cases)
    passed_checks = sum(check.get("passed") is True for check in checks)
    publication_ok = publication.get("status") == "verified" and publication.get("readiness_verified") is True and bool(objects) and bool(vectors) and all(v.get("vectors_verified") is True for v in vectors)
    complete = roundtrip.get("status") == "passed" and len(cases) == 3 and passed_cases == 3 and access.get("status") == "passed" and bool(checks) and passed_checks == len(checks) and publication_ok
    state = "Recorded checks passed" if complete else "Incomplete verification"
    tone = "good" if complete else "pending"
    cards = []
    for index, case in enumerate(cases):
        result = case.get("result") if isinstance(case.get("result"), dict) else {}
        evidence = rows(result.get("evidence"))
        label = text(case.get("scope_label"), "Unknown")
        label = label if label in {"A", "B"} else "Unknown"
        candidate_ids = result.get("candidate_ids") if isinstance(result.get("candidate_ids"), list) else []
        supported = case_passed(case)
        evidence_html = "".join(evidence_card(item, candidate_ids) for item in evidence) if supported else "<p class=empty>No verified evidence is displayed for this check.</p>"
        cards.append(f"""<section class=question-card data-account='{escape(label)}'><div class=question-meta><span>TEST ACCOUNT {escape(label)}</span><span>{escape(text(case.get('id'), str(index + 1)))}</span></div>
<h3>{escape(text(case.get('question')))}</h3><p class=case-state>{'Verified source passages returned' if supported else 'Check incomplete · evidence withheld'}</p>{evidence_html}
<div class=release>Release SHA-256 <code>{escape(digest(result.get('release_sha256')))}</code></div></section>""")
    if not cards:
        cards.append("<section class=question-card><h3>No question results recorded</h3><p>Provide the safe roundtrip receipt to populate this report.</p></section>")
    check_html = "".join(f"<li><span class={'check-good' if c.get('passed') is True else 'check-pending'}>{'Passed' if c.get('passed') is True else 'Incomplete'}</span><span>{escape(text(c.get('description'), text(c.get('id'))).replace('_', ' '))}</span></li>" for c in checks)
    pin_html = "".join(f"<div><dt>{escape(name)}</dt><dd><code>{escape(digest(value))}</code></dd></div>" for name, value in pins.items())
    observed = text(roundtrip.get("finished_at"), text(roundtrip.get("observed_at")))
    payload = {"state": state, "tone": tone, "passed_cases": passed_cases, "case_count": len(cases),
               "passed_checks": passed_checks, "check_count": len(checks), "object_count": len(objects) if publication_ok else "—",
               "namespace_count": len(vectors) if publication_ok else "—", "questions": "".join(cards), "checks": check_html or "<li>No access checks recorded.</li>",
               "pins": pin_html, "observed": escape(observed), "publication": "Verified by readback" if publication_ok else "Incomplete"}
    return re.sub(r"\{\{([a-z_]+)\}\}", lambda match: str(payload[match[1]]), TEMPLATE)


TEMPLATE = """<!doctype html>
<html lang=en><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>
<meta http-equiv=Content-Security-Policy content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<title>Neuvetra · Cloud evidence demonstration</title><style>
:root{color-scheme:light;--ink:#173a2c;--muted:#5d7166;--green:#17603c;--line:#dce5dc;--pale:#edf4ea;--paper:#f8faf6}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}button,summary{font:inherit}button:focus-visible,summary:focus-visible{outline:3px solid #92b645;outline-offset:4px}.wrap{max-width:1120px;margin:auto;padding:0 30px}.fiction{padding:9px 20px;background:#dfeaca;color:#355020;text-align:center;font-size:11px;letter-spacing:.12em;font-weight:750}.mast{display:flex;align-items:center;justify-content:space-between;padding:30px 0;border-bottom:1px solid var(--line)}.brand{font-size:26px;letter-spacing:-1.1px;font-weight:720}.brand b{display:inline-block;background:var(--green);color:white;border-radius:50% 50% 50% 10%;width:28px;height:28px;margin-right:10px;vertical-align:-3px}.mast small{color:var(--muted);font-size:12px}.hero{padding:66px 0 36px;max-width:770px}.eyebrow{font-size:11px;letter-spacing:.16em;font-weight:750;color:var(--green);text-transform:uppercase}h1{font-size:clamp(36px,5vw,61px);line-height:1.09;letter-spacing:-2.5px;font-weight:570;margin:17px 0 24px}h1 em{font-style:normal;color:var(--green)}.intro{font-size:18px;max-width:655px;color:var(--muted)}.badge{display:inline-block;font-size:12px;font-weight:650;padding:7px 13px;border-radius:30px}.good{color:#205132;background:#e1eedc}.pending{color:#71571b;background:#f7edcb}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin:6px 0 40px}.metric{background:white;padding:23px}.metric strong{display:block;font-size:31px;line-height:1.2;font-weight:600}.metric span{font-size:12px;color:var(--muted)}.flow{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;border-bottom:1px solid var(--line);padding:0 0 38px;margin-bottom:45px}.flow div{font-size:13px;color:var(--muted)}.flow b{display:block;color:var(--ink);font-size:14px;margin-bottom:5px}.flow i{font-size:10px;color:#78916f;font-style:normal;letter-spacing:.12em}h2{font-size:29px;letter-spacing:-.8px;line-height:1.2;margin:10px 0}.section-head p{margin:10px 0 23px;color:var(--muted);max-width:790px}.filters{display:flex;gap:7px;margin:22px 0}.filters button{background:transparent;border:1px solid #cbd8ca;color:var(--ink);font-size:13px;border-radius:25px;padding:9px 18px;cursor:pointer}.filters button[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:white}.question-card{background:white;border:1px solid var(--line);border-radius:16px;padding:28px;margin-bottom:22px}.question-meta{display:flex;justify-content:space-between;gap:10px;font-size:10px;font-weight:750;letter-spacing:.1em;color:var(--muted)}h3{font-size:23px;line-height:1.4;letter-spacing:-.5px;margin:16px 0 8px;max-width:850px}.case-state{font-size:12px;color:var(--green);margin:0 0 24px}.passage{background:#f5f8f2;border:1px solid #e4eade;border-radius:10px;padding:21px;margin-top:12px}.passage-top{display:flex;gap:12px;align-items:center;color:var(--muted);font-size:11px}.passage-id{background:white;border:1px solid var(--line);border-radius:5px;padding:2px 8px;font-weight:700;color:var(--green)}blockquote{margin:15px 0;font-size:16px;line-height:1.75;max-width:940px}summary{cursor:pointer;color:var(--green);font-size:12px;padding:4px 0;font-weight:620}details[open] summary{margin-bottom:13px}dl{margin:0}dl>div{display:grid;grid-template-columns:160px 1fr;gap:16px;border-top:1px solid var(--line);padding:9px 0;font-size:12px}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}.muted,.qualification{font-size:12px;color:var(--muted)}.qualification{border-left:2px solid #b1c7a0;padding-left:12px}.release{font-size:10px;color:var(--muted);margin-top:22px;overflow-wrap:anywhere}.release code{margin-left:6px}code{font:11px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}.review{margin:35px 0;background:#edf3e8;padding:27px;border-radius:14px}.review h2{font-size:23px}.review p{color:var(--muted);font-size:14px;max-width:840px}.checks{list-style:none;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:9px 28px}.checks li{font-size:12px;display:flex;align-items:baseline;gap:12px}.check-good,.check-pending{font-size:10px;min-width:60px;color:var(--green)}.check-pending{color:#8a6522}.receipt{padding:25px 0;border-top:1px solid var(--line)}footer{padding:27px 0 36px;color:var(--muted);font-size:11px;display:flex;gap:15px;justify-content:space-between}[hidden]{display:none!important}.empty{color:#806425}@media(max-width:720px){.wrap{padding:0 19px}.hero{padding-top:43px}h1{letter-spacing:-1.5px}.metrics{grid-template-columns:repeat(2,1fr)}.metric{padding:19px}.flow{grid-template-columns:1fr 1fr;gap:18px}.question-card{padding:20px}h3{font-size:20px}.passage{padding:16px}.mast small{max-width:125px;text-align:right}.checks{grid-template-columns:1fr}dl>div{grid-template-columns:1fr;gap:4px}footer{display:block}}
</style></head><body><div class=fiction>FICTIONAL TEST DATA · PRIVATE CLOUD INTEGRATION DEMONSTRATION</div><main class=wrap>
<header class=mast><div class=brand><b aria-hidden=true></b>Neuvetra</div><small>Evidence infrastructure<br>Recorded test results</small></header>
<section class=hero><div class=eyebrow>From a question to its original evidence</div><h1>Your evidence,<br><em>kept in context.</em></h1><p class=intro>A recorded demonstration of cloud retrieval, private source storage and account boundaries using fictional electricity records.</p><span class='badge {{tone}}'>{{state}}</span></section>
<section class=metrics aria-label='Recorded check counts'><div class=metric><strong>{{passed_cases}} / {{case_count}}</strong><span>question checks passed</span></div><div class=metric><strong>{{passed_checks}} / {{check_count}}</strong><span>access checks passed</span></div><div class=metric><strong>{{object_count}}</strong><span>private objects verified</span></div><div class=metric><strong>{{namespace_count}}</strong><span>vector namespaces verified</span></div></section>
<section class=flow aria-label='Tested data flow'><div><i>01 · IDENTITY</i><b>Account boundary</b>Supabase authenticates the reader and resolves its permitted records.</div><div><i>02 · DISCOVERY</i><b>Find candidate passages</b>Pinecone searches within the selected account and release.</div><div><i>03 · EVIDENCE</i><b>Resolve private originals</b>Supabase rows and stored bytes supply source text and required context.</div><div><i>04 · INTEGRITY</i><b>Check before display</b>The reader verifies hashes and source locations before returning passages.</div></section>
<section class=section-head><div class=eyebrow>Explore the recorded results</div><h2>Three questions. Two test accounts.</h2><p>These are returned source passages, not AI-written answers. Filters below change only this saved report; they do not sign into an account or make a live query.</p></section>
<div class=filters role=group aria-label='Filter recorded account results'><button type=button data-filter=all aria-pressed=true>All results</button><button type=button data-filter=A aria-pressed=false>Account A · Juniper</button><button type=button data-filter=B aria-pressed=false>Account B · Boreal</button></div>
<div id=results>{{questions}}</div>
<section class=review><div class=eyebrow>What this milestone establishes</div><h2>A test of the evidence connection.</h2><p>The displayed records test the cloud storage and retrieval path. They contain fictional content, not regulatory guidance. A tiny corpus does not establish useful search ranking, and these checks do not validate generated-answer quality, emissions calculations or production readiness.</p><details><summary>Inspect all recorded access checks · {{passed_checks}} / {{check_count}}</summary><ul class=checks>{{checks}}</ul></details></section>
<section class=receipt><details><summary>Inspect report provenance</summary><p class=muted>Input file SHA-256 values bind this page to its saved receipts. Publication: {{publication}}. Roundtrip observation: {{observed}}.</p><dl>{{pins}}</dl></details></section>
<footer><span>Neuvetra · California &amp; U.S. greenhouse-gas research</span><span>Offline report · no credentials · no live requests</span></footer></main>
<script>document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));document.querySelectorAll('[data-account]').forEach(item=>{item.hidden=filter!=='all'&&item.dataset.account!==filter;});}));</script></body></html>
"""


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--roundtrip", required=True)
    parser.add_argument("--access", required=True)
    parser.add_argument("--publication", required=True)
    parser.add_argument("--out", default="evaluations/cloud-integration/demo.html")
    args = parser.parse_args(argv)
    reports = [read_report(path) for path in (args.roundtrip, args.access, args.publication)]
    page = render(*(record for record, _ in reports), dict(zip(("Roundtrip receipt", "Access receipt", "Publication receipt"), (pin for _, pin in reports))))
    target = Path(args.out)
    if target.suffix.lower() != ".html":
        raise ReportError("html_output_required")
    with target.open("x", encoding="utf-8", newline="\n") as output:
        output.write(page)
    print(json.dumps({"status": "rendered", "output": str(target), "sha256": hashlib.sha256(page.encode()).hexdigest(), "network_calls": 0}))


if __name__ == "__main__":
    try:
        main()
    except (ReportError, OSError) as error:
        print(json.dumps({"status": "failed", "error": str(error) if isinstance(error, ReportError) else "file_operation_failed"}))
        raise SystemExit(1) from None
