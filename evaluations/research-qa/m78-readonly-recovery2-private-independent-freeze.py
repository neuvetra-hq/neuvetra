import hashlib,json
from pathlib import Path
files=[".superpowers/m78-readonly-recovery2-entry.ts",".superpowers/m78-private-readonly-recovery2.ps1","evaluations/research-qa/m78-readonly-recovery2-private-independent-review.ts","evaluations/research-qa/m78-readonly-recovery2-private-independent.test.ts","evaluations/research-qa/m78-readonly-recovery2-private-independent-review.md","evaluations/research-qa/m78-readonly-recovery2-private-independent-result.json"]
sha=lambda b:hashlib.sha256(b).hexdigest()
entries=[]
for path in files:
 data=Path(path).read_bytes();entries.append({'path':path,'sha256':sha(data),'text':data.decode('utf-8')})
out=Path('operations/agent-improvement/snapshots/M78-READONLY-RECOVERY2-PRIVATE-REVIEW-01-CANDIDATE1.json')
out.write_text(json.dumps({'status':'candidate','task_id':'M78-READONLY-RECOVERY2-PRIVATE-REVIEW-01','files':entries},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'path':out.as_posix(),'sha256':sha(out.read_bytes()),'files':len(entries)}))
