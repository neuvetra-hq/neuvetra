"""Isolated synthetic publisher tests: every Git/subprocess operation is injected."""
import contextlib, hashlib, importlib.util, io, json, os, pathlib, subprocess, tempfile
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[2]
HELPER=ROOT/'.superpowers/m80-publish-normalized-upgrade.py'
PIN='903e71a94b14569a33c848ab3c0fef0342498962140b2ba0edd5f9d4b16ca959'
assert hashlib.sha256(HELPER.read_bytes()).hexdigest()==PIN
cases=[]
for scenario in ['success','existing_intent','bad_review','changed_bytes','private_path','dirty_index','staged_hash','whitespace_failure','push_uncertain','remote_unconfirmed']:
    spec=importlib.util.spec_from_file_location('publisher_under_test',HELPER); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    with tempfile.TemporaryDirectory(prefix='m80-publication-qa-') as directory:
        old=os.getcwd(); os.chdir(directory)
        try:
            mod.ROOT=pathlib.Path(directory).resolve(); pathlib.Path('.superpowers').mkdir(); pathlib.Path('docs').mkdir(); mod.REVIEW.parent.mkdir(parents=True)
            p='docs/synthetic.txt' if scenario!='private_path' else '.superpowers/synthetic.txt'; data=b'synthetic only\n';pathlib.Path(p).write_bytes(data)
            files=[{'path':p,'sha256':mod.sha(data),'bytes':len(data)}]
            m={'base_commit':mod.BASE,'profile':'m80.normalized-upgrade-publication-manifest.v1','file_count':1,'files':files}
            mod.MANIFEST.write_text(json.dumps(m),encoding='utf8'); mh=mod.sha(mod.MANIFEST.read_bytes())
            r={'reviewer':'/root/m80_foundation_runtime_qa','verdict':'pass_exact_normalized_upgrade_publication_manifest_only','manifest':{'path':mod.MANIFEST.as_posix(),'sha256':mh}}
            if scenario=='bad_review': r['reviewer']='/root'
            mod.REVIEW.write_text(json.dumps(r),encoding='utf8');rh=mod.sha(mod.REVIEW.read_bytes())
            if scenario=='existing_intent':mod.INTENT.write_bytes(b'prior')
            if scenario=='changed_bytes':pathlib.Path(p).write_bytes(b'changed')
            calls=[]; synced=[]; committed=False; pushed=False; staged=False; real_sync=os.fsync
            def sync(fd): synced.append(fd); return real_sync(fd)
            def fake_git(*args):
                global committed,pushed,staged
                calls.append(list(args)); cmd=args[0]
                if cmd=='rev-parse':return ((mod.BASE if args[1]=='HEAD^' or not committed else 'a'*40)+'\n').encode()
                if cmd=='branch':return b'codex/corporate-mvp\n'
                if cmd=='ls-remote':return ((('b'*40 if scenario=='remote_unconfirmed' else 'a'*40) if pushed else mod.BASE)+'\tref\n').encode()
                if cmd=='diff' and '--name-only' in args:return ((p+'\n') if staged or scenario=='dirty_index' else '').encode()
                if cmd=='add':
                    assert mod.INTENT.exists() and mod.PATHSPEC.exists() and len(synced)>=2
                    staged=True;return b''
                if cmd=='show':return b'wrong' if scenario=='staged_hash' and not committed else data
                if cmd=='diff' and '--check' in args:
                    if scenario=='whitespace_failure':raise subprocess.CalledProcessError(2,['MOCK-diff'])
                    return b''
                if cmd=='commit':committed=True;return b''
                if cmd=='diff-tree':return (p+'\n').encode()
                if cmd=='push':
                    pushed=True
                    if scenario=='push_uncertain':raise subprocess.CalledProcessError(1,['MOCK-push'])
                    return b''
                raise AssertionError(args)
            refused=False
            with patch.object(mod,'git',fake_git),patch.object(mod.subprocess,'run',return_value=None),patch.object(mod.os,'fsync',sync),patch.object(mod.sys,'argv',['publisher',mh,rh]),contextlib.redirect_stdout(io.StringIO()):
                try:mod.main()
                except (RuntimeError,subprocess.CalledProcessError):refused=True
                before=len(calls)
                if mod.INTENT.exists():
                    try:mod.main();raise AssertionError('replayed')
                    except RuntimeError:pass
                    assert len(calls)==before
            mutations=[c[0] for c in calls if c[0] in ['add','commit','push']]
            assert mutations.count('commit')<=1 and mutations.count('push')<=1
            assert refused==(scenario!='success')
            assert mod.RECEIPT.exists()==(scenario=='success')
            if scenario in ['staged_hash','whitespace_failure']:assert mutations==['add'] and mod.INTENT.exists()
            if scenario in ['push_uncertain','remote_unconfirmed']:assert mutations==['add','commit','push'] and mod.INTENT.exists()
            if scenario in ['existing_intent','bad_review','changed_bytes','private_path','dirty_index']:assert mutations==[]
            cases.append({'case':scenario,'pass':True,'mock_mutations':mutations,'replay_refused_before_git':mod.INTENT.exists(),'durable_sync_calls':len(synced)})
        finally:os.chdir(old)
result={'helper_sha256':PIN,'cases':cases,'all_git_and_subprocess_calls_injected':True,'actual_provider_git_network_db_actions':0}
out=ROOT/'evaluations/research-qa/m80-normalized-upgrade-publication-independent-20260925-publisher-checks.json';out.write_bytes((json.dumps(result,indent=2)+'\n').encode());print(json.dumps({'passed':len(cases),'helper_sha256':PIN}))
