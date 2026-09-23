import hashlib,json
from pathlib import Path
files=["evaluations/research-qa/m78-readonly-failure-review2-fixture.ts","evaluations/research-qa/m78-readonly-failure-review2.test.ts","evaluations/research-qa/m78-readonly-failure-review2.md","evaluations/research-qa/m78-readonly-failure-review2-result.json"]
sha=lambda b:hashlib.sha256(b).hexdigest()
entries=[]
for path in files:
 data=Path(path).read_bytes();entries.append({'path':path,'sha256':sha(data),'text':data.decode('utf-8')})
out=Path('operations/agent-improvement/snapshots/M78-READONLY-FAILURE-REVIEW-02-CANDIDATE2.json')
out.write_text(json.dumps({'status':'candidate','task_id':'M78-READONLY-FAILURE-REVIEW-02','files':entries},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'path':out.as_posix(),'sha256':sha(out.read_bytes()),'files':len(entries)}))
