const path=require('node:path');
const deps=process.argv[2];
const esbuild=deps?require(path.join(deps,'esbuild@0.27.7/node_modules/esbuild')):require('esbuild');
const zod=deps?path.join(deps,'zod@4.3.6/node_modules/zod/index.js'):require.resolve('zod');
esbuild.buildSync({entryPoints:[path.join(__dirname,'validation.js')],bundle:true,format:'iife',globalName:'CompanyValidation',outfile:path.join(__dirname,'validation.bundle.js'),minify:true,platform:'browser',alias:{zod},legalComments:'eof'});
