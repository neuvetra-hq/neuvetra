import {resolve} from 'node:path'
const source=await Bun.file(new URL('./hosted-setup-01-ui-browser.ts',import.meta.url)).text()
let header=source.slice(0,source.indexOf('const build='))
header=header.replace("import {setup} from './hosted-setup-01-native-fixture'",'').replace("node_modules/playwright'","node_modules/playwright/index.mjs'")
const body=source.slice(source.indexOf('const browser=await chromium.launch'))
const nodeCode=header+'\nconst server={port:Number(process.argv[2]),stop(){}};\n'+body.replace('await Bun.write(', 'await (await import("node:fs/promises")).writeFile(')
await Bun.write(new URL('./hosted-setup-01-ui-browser-node.mjs',import.meta.url),new Bun.Transpiler({loader:'ts'}).transformSync(nodeCode))
const build=await Bun.build({entrypoints:[resolve(import.meta.dir,'hosted-setup-01-ui-entry.tsx')],target:'browser',plugins:[{name:'app-alias',setup(builder){builder.onResolve({filter:/^@\//},args=>({path:resolve('apps/site-web/src',args.path.slice(2))+'.ts'}));builder.onResolve({filter:/^react(?:-dom)?(?:\/|$)/},args=>({path:Bun.resolveSync(args.path,resolve('apps/site-web'))}))}}]})
if(!build.success)throw Error(build.logs.join('\n'));const js=await build.outputs[0]!.text()
const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:req=>new URL(req.url).pathname==='/qa.js'?new Response(js,{headers:{'content-type':'application/javascript'}}):new Response('<html><body><div id="root"></div><script type="module" src="/qa.js"></script></body></html>',{headers:{'content-type':'text/html'}})})
console.log('QA browser server port '+server.port)
const child=Bun.spawn(['C:/Users/nimab/AppData/Local/Programs/nodejs/node.exe',resolve(import.meta.dir,'hosted-setup-01-ui-browser-node.mjs'),String(server.port)],{stdout:'inherit',stderr:'inherit'})
const code=await child.exited;server.stop(true);process.exitCode=code
