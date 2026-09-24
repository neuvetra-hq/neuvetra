import {writeFile} from 'node:fs/promises';
const results=[];
for(const [label,silentReuse,disablePool] of [['healthy_default',false,false],['silent_reuse_default',true,false],['silent_reuse_fresh',true,true]]as const){
 const sockets=new Set<any>(),seen:number[]=[];let next=0;
 const server=Bun.listen({hostname:'127.0.0.1',port:0,socket:{
  open(s){s.data={id:++next,count:0,buffer:''};sockets.add(s)},
  data(s,b){const d=s.data as any;d.buffer+=Buffer.from(b).toString();if(!d.buffer.includes('\r\n\r\n'))return;d.buffer='';seen.push(d.id);d.count++;
   // Deliberately ignore the client's Connection header: all replies advertise keep-alive.
   if(!silentReuse||d.count===1)s.write('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: keep-alive\r\n\r\nok');
  },close(s){sockets.delete(s)},error(){}
 }});
 const outcomes=[];
 try{
  for(let i=0;i<2;i++){
   const start=performance.now();try{const r=await fetch(`http://127.0.0.1:${server.port}/`,{proxy:false,keepalive:!disablePool,signal:AbortSignal.timeout(1000)});outcomes.push({status:r.status,body:await r.text(),ms:Math.round(performance.now()-start)})}catch(e){outcomes.push({error:(e as Error).name,ms:Math.round(performance.now()-start)})}
   await Bun.sleep(40);
  }
 }finally{server.stop(true);for(const s of sockets)s.terminate();await Bun.sleep(50)}
 results.push({label,seen,outcomes,remainingSockets:sockets.size});
}
const [healthy,silent,fresh]=results;
if(healthy!.seen.join(',')!=='1,1'||healthy!.outcomes.some(o=>o.status!==200)||silent!.seen.join(',')!=='1,1'||silent!.outcomes[1]!.error!=='TimeoutError'||fresh!.seen.join(',')!=='1,2'||fresh!.outcomes.some(o=>o.status!==200)||results.some(r=>r.remainingSockets!==0))throw Error('Independent socket expectations failed');
const out={task:'M78-TRANSPORT-ROOT-INDEPENDENT-01',bun:Bun.version,platform:process.platform,loopbackOnly:true,serverIgnoresClientClose:true,results,providerCauseEstablished:false};
await writeFile('evaluations/research-qa/m78-transport-independent-sockets-result.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(out));
