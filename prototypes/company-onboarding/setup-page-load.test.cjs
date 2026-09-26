'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

const root=__dirname;

function element(){
 return {dataset:{},style:{},classList:{add(){},remove(){}},children:[],hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',files:[],
  setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){},showModal(){},close(){},after(){},append(){},replaceChildren(){},
  querySelector(){return element()},querySelectorAll(){return []},closest(){return null}};
}

test('the complete setup page restores, migrates, and edits a saved legal-name location',async()=>{
 const legal='Example, Inc.';
 const saved={company:{legal,trading:'Example',country:'United States',industry:'Utilities'},period:{start:'2025-01-01',end:'2025-12-31',first:'Yes'},boundary:{hasParent:'No',approach:'Operational control',operations:'All operations'},entities:[],locations:[{name:'Main depot',country:'United States',locality:'Oakland, CA',purpose:'Fleet base',entity:legal,occupancy:'Owned',control:'Reporting company',operator:'Example operations',included:'Include',reason:'Operated by reporting company',startMode:'Active before reporting period',endMode:'Still active'}],changes:Array.from({length:5},()=>({answer:'No'})),sources:Array.from({length:5},()=>({answer:'No'})),review:{}};
 const listeners={};
 const elements=new Map();
 const document={
  querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector)},
  querySelectorAll(){return []},createElement(){return element()},
  addEventListener(type,handler){(listeners[type]??=[]).push(handler)}
 };
 const storage=new Map([['neuvetra-company-intake-preview-v1',JSON.stringify({version:1,data:saved})]]);
 const context=vm.createContext({console,document,crypto:webcrypto,structuredClone,confirm:()=>true,location:{assign(){}},
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  fetch:async()=>({ok:true,json:async()=>({revision:1,onboarding:saved,plan:{}})}),setTimeout,clearTimeout,URL,Blob,btoa:value=>Buffer.from(value,'binary').toString('base64')});
 context.window=context;
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const scripts=[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(scripts,['validation.bundle.js','company.js','locations.js','app.js','bridge.js']);
 for(const script of scripts)vm.runInContext(fs.readFileSync(path.join(root,script),'utf8'),context,{filename:script});
 assert.match(elements.get('#steps').innerHTML,/Company/);
 assert.match(elements.get('#questions').innerHTML,/Legal company name/);
 let location=JSON.parse(vm.runInContext('JSON.stringify(data.locations[0])',context));
 assert.match(location.id,/^loc-/);
 assert.equal(location.entity,'Reporting company');
 assert.equal(location.originalEntity,legal);
 assert.equal(JSON.parse(storage.get('neuvetra-company-intake-preview-v1')).data.locations.length,1);
 for(const handler of listeners.input||[])handler({target:{dataset:{path:'locations.0.name'},type:'text',value:'Updated depot'}});
 location=JSON.parse(vm.runInContext('JSON.stringify(data.locations[0])',context));
 assert.equal(location.name,'Updated depot');
 assert.equal(JSON.parse(storage.get('neuvetra-company-intake-preview-v1')).data.locations[0].name,'Updated depot');
});
