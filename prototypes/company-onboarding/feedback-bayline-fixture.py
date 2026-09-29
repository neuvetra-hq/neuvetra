"""Seed ONLY an empty isolated Bayline test workspace through the real HTTP API."""
import http.client,json,sys
assert len(sys.argv)==2,'Supply an explicit isolated test port'
port=int(sys.argv[1])
assert 1024<=port<=65535,'Use an unprivileged test port'
assert port!=4319,'Do not modify the board preview'
c=http.client.HTTPConnection('127.0.0.1',port)
h={'X-Neuvetra-Local':'1','Origin':f'http://127.0.0.1:{port}'}
c.request('GET','/api/workspace',headers=h);r=c.getresponse();h['Cookie']=r.getheader('Set-Cookie').split(';')[0];w=json.loads(r.read());assert w['revision']==0 and w['onboarding'] is None and w['plan']=={'schemaVersion':1,'catalogVersion':'uninitialized','items':{},'custom':[],'screening':{}},'Refuse to replace anything except an exact initial empty workspace'
o={'company':{'legal':'Bayline Plumbing & Mechanical, Inc.','country':'United States','region':'California','city':'Oakland','industry':'Construction','naics':'238220','role':'Operations manager'},'period':{'start':'2025-01-01','end':'2025-12-31','first':'Yes'},'boundary':{'approach':'Operational control'},'locations':[{'id':'oakland','name':'Oakland HQ/shop','country':'United States','locality':'Oakland test shop','region':'California','purpose':'Office, shop and fleet','entity':'Reporting company','occupancy':'Leased','control':'Reporting company','included':'Include','reason':'Operated throughout reporting year','startMode':'Active from the reporting-period start','endMode':'Still active at the reporting-period end'},{'id':'reno','name':'Reno yard','country':'United States','locality':'Reno test yard','region':'Nevada','purpose':'Vehicle yard','entity':'Reporting company','occupancy':'Owned','control':'Reporting company','included':'Include','reason':'Operated throughout reporting year','startMode':'Active from the reporting-period start','endMode':'Still active at the reporting-period end'}],'entities':[],'changes':[{'answer':'No'} for _ in range(5)],'sources':[{'answer':'Yes','names':'Natural-gas water heater','location':'oakland'},{'answer':'No'},{'answer':'Yes','names':'12 gasoline vans and 2 diesel pickups','location':'Multiple locations'},{'answer':'Yes','names':'Rooftop air conditioning','location':'oakland'},{'answer':'Not sure','names':'Brazing','location':'oakland'}],'review':{'complete':True,'needed':True,'role':'Operations manager'}}
p={'schemaVersion':1,'catalogVersion':'uninitialized','items':{},'custom':[],'screening':{}}
for key in ['electricity','steam','heat','cooling']+[f'category-{i}' for i in range(1,16)]:
 yes=key in ['electricity','category-1','category-3','category-5','category-6','category-7']
 p['screening'][key]={'answer':'Yes' if yes else 'No','reason':'Included in company operations' if yes else 'No such activity in this synthetic reporting year'}
p['screening']['scope1:generator']={'answer':'No','reason':'No generators operated'}
h['Content-Type']='application/json';c.request('PUT','/api/workspace',json.dumps({'expectedRevision':w['revision'],'onboarding':o,'plan':p}),h);r=c.getresponse();assert r.status==200,r.read();r.read();c.close();print('Bayline fixture saved to isolated empty workspace')
