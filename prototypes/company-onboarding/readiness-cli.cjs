'use strict';
const fs=require('node:fs'),Core=require('./readiness-core.js');
try {const v=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(Core.evaluate(v.onboarding,v.plan,v.catalog,v.methods)));}
catch(error){process.stderr.write('Readiness evaluation failed.');process.exitCode=1;}
