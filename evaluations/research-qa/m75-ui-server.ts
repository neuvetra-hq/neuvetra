import {resolve} from 'node:path'
const build=await Bun.build({entrypoints:[resolve(import.meta.dir,'m75-ui.tsx')],target:'browser',plugins:[{name:'reviewer-local-app-alias',setup(b){b.onResolve({filter:/^@\//},args=>({path:resolve(import.meta.dir,'../../apps/site-web/src',args.path.slice(2))+'.ts'}));b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:Bun.resolveSync(args.path,resolve(import.meta.dir,'../../apps/site-web'))}))}}]})
if(!build.success)throw new AggregateError(build.logs,'Reviewer component build failed')
const fixture=await Bun.file(resolve(import.meta.dir,'m75-independent-ui-fixture.json')).json()
const bundle=await build.outputs[0]!.text(),html=(await Bun.file(resolve(import.meta.dir,'m75-ui.html')).text()).replace('/evaluations/research-qa/m75-ui.tsx','/m75-ui.js').replace('<div id="root">','<script>window.__qaContext='+JSON.stringify({owner:fixture.owner,companyId:fixture.register.companyId})+'</script><div id="root">')
Bun.serve({hostname:'127.0.0.1',port:55675,fetch(request){return new Response(new URL(request.url).pathname==='/m75-ui.js'?bundle:html,{headers:{'content-type':new URL(request.url).pathname==='/m75-ui.js'?'text/javascript':'text/html'}})}})
console.log('Independent actual component harness ready on 127.0.0.1:55675')
