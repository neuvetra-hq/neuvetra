import hashlib,json,pathlib

files=[
 '.superpowers/m78-readonly-recovery2-admit.py',
 '.superpowers/m78-readonly-recovery2-source-closure.ts',
 '.superpowers/m78-get-route-refresh-for-recovery2.py',
 '.superpowers/m78-readonly-recovery2-evaluate.ts',
 'evaluations/research-qa/m78-readonly-recovery2-root-result.json',
 'evaluations/research-qa/m78-readonly-recovery2-admission-independent.test.py',
 'evaluations/research-qa/m78-readonly-recovery2-admission-independent-review.md',
 'evaluations/research-qa/m78-readonly-recovery2-admission-independent-result.json',
]
entries=[]
for path in files:
 data=pathlib.Path(path).read_bytes()
 entries.append({'path':path,'sha256':hashlib.sha256(data).hexdigest(),'text':data.decode('utf-8')})
out={'status':'candidate','task_id':'M78-READONLY-RECOVERY2-ADMISSION-REVIEW-01','files':entries}
target=pathlib.Path('operations/agent-improvement/snapshots/M78-READONLY-RECOVERY2-ADMISSION-REVIEW-01-CANDIDATE1.json')
target.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
print(hashlib.sha256(target.read_bytes()).hexdigest())
