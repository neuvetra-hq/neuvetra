import hashlib,json,pathlib

files=[
 'evaluations/research-qa/m78-readonly-recovery2-independent-review.ts',
 'evaluations/research-qa/m78-readonly-recovery2-corrected-review.ts',
 '.superpowers/m78-readonly-recovery2-corrected-evaluate.ts',
 '.superpowers/m78-readonly-recovery2-corrected-evaluation.json',
 'evaluations/research-qa/m78-readonly-recovery2-actual-independent.test.ts',
 'evaluations/research-qa/m78-readonly-recovery2-actual-independent-review.md',
 'evaluations/research-qa/m78-readonly-recovery2-actual-independent-result.json',
]
entries=[]
for path in files:
 data=pathlib.Path(path).read_bytes()
 entries.append({'path':path,'sha256':hashlib.sha256(data).hexdigest(),'text':data.decode('utf-8')})
out={'status':'candidate','task_id':'M78-READONLY-RECOVERY2-ACTUAL-REVIEW-01','files':entries}
target=pathlib.Path('operations/agent-improvement/snapshots/M78-READONLY-RECOVERY2-ACTUAL-REVIEW-01-CANDIDATE1.json')
target.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
print(hashlib.sha256(target.read_bytes()).hexdigest())
