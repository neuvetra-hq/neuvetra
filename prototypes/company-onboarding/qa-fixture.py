"""Synthetic fixture for the independent browser server on 4323 only."""
import http.client,json
c=http.client.HTTPConnection('127.0.0.1',4323)
h={'X-Neuvetra-Local':'1','Origin':'http://127.0.0.1:4323'}
c.request('GET','/api/workspace',headers=h);r=c.getresponse();h['Cookie']=r.getheader('Set-Cookie').split(';')[0];w=json.loads(r.read())
o={'company':{'legal':'QA Cedar & Alloy LLC','trading':'QA Cedar','country':'United States','region':'California','industry':'Manufacturing','role':'QA reviewer'},'period':{'start':'2025-01-01','end':'2025-12-31'},'boundary':{},'locations':[{'id':'qa-east','name':'QA East Works','locality':'Test municipality','included':'Include'},{'id':'qa-west','name':'QA West Lab','included':'Not sure'}],'entities':[],'changes':[{} for _ in range(5)],'sources':[{'answer':'Yes','names':'QA Furnace #22','location':'qa-east','notes':'Shared QA meter'}, {'answer':'No'},{'answer':'Not sure'}, {}, {'answer':'No'}],'review':{'complete':True,'needed':True,'role':'QA reviewer'}}
p={'schemaVersion':1,'catalogVersion':'uninitialized','items':{},'custom':[],'screening':{}}
h['Content-Type']='application/json';c.request('PUT','/api/workspace',json.dumps({'expectedRevision':w['revision'],'onboarding':o,'plan':p}),h);r=c.getresponse();print(r.status);r.read();c.close()
