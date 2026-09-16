import {resolve} from 'node:path'
const build=await Bun.build({entrypoints:[resolve(import.meta.dir,'m76-ui.tsx')],target:'browser',plugins:[{name:'reviewer-local-app-alias',setup(b){b.onResolve({filter:/^@\//},args=>({path:resolve(import.meta.dir,'../../apps/site-web/src',args.path.slice(2))+'.ts'}));b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:Bun.resolveSync(args.path,resolve(import.meta.dir,'../../apps/site-web'))}))}}]})
if(!build.success)throw new AggregateError(build.logs,'Reviewer component build failed')
const fixture=await Bun.file(resolve(import.meta.dir,'m76-independent-ui-fixture.json')).json(),bundle=await build.outputs[0]!.text()
const html='<!doctype html><html><head><meta charset="utf-8"><title>Independent M76 component harness</title></head><body><script>window.__qaContext='+JSON.stringify({owner:fixture.owner,companyId:fixture.register.companyId})+'</script><div id="root"></div><script type="module" src="/m76-ui.js"></script></body></html>'
Bun.serve({hostname:'127.0.0.1',port:55676,fetch(request){const js=new URL(request.url).pathname==='/m76-ui.js';return new Response(js?bundle:html,{headers:{'content-type':js?'text/javascript':'text/html'}})}})
console.log('Independent actual component harness ready on 127.0.0.1:55676')
