import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {webcrypto} from 'node:crypto';
import {JSDOM,VirtualConsole} from 'jsdom';
import {startServer} from '../lib/server.mjs';
// Isolated DOM/controller tests, not browser rendering or boot qualification.
const html=await fs.readFile(new URL('../website/index.html',import.meta.url),'utf8');
const app=await fs.readFile(new URL('../website/app.js',import.meta.url),'utf8');
const token='sfeboot-ui-test-token-'.padEnd(64,'x');
const capabilities={name:'SFEBoot',version:'test',interfaces:['loopback-http']};
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const settle=()=>new Promise(r=>setTimeout(r,0));
const outcome=(h,id)=>h.$(id).closest('details').previousElementSibling;
async function until(fn,detail=()=>""){const deadline=Date.now()+10000;while(Date.now()<deadline){if(fn())return;await new Promise(r=>setTimeout(r,10));}assert.ok(fn(),'Expected UI state did not arrive: '+detail());}
function harness(fetchImpl=async()=>{throw Error('Unexpected network request');},url='http://127.0.0.1:47831/'){
 const errors=[],requests=[];const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e));
 // Enable the parser's scripting flag so noscript stays inert. External resources
 // are not loaded; only our local first-party app is evaluated below.
 const dom=new JSDOM(html,{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole});const w=dom.window;
 Object.defineProperty(w,'crypto',{value:webcrypto});w.AbortSignal=AbortSignal;
 w.fetch=(...args)=>{requests.push(args);return fetchImpl(...args);};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 w.eval(app);assert.deepEqual(errors,[],'App initializes without JavaScript errors');
 const $=s=>w.document.querySelector(s);
 const submit=id=>{const form=$(id),button=form.querySelector('[type=submit]');form.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button}));return button;};
 return {w,$,submit,requests,errors,close:()=>w.close()};
}
async function connect(h){h.$('#sb-engine-url').value='http://127.0.0.1:47831';h.$('#sb-token').value=token;h.submit('#sb-connect-form');await until(()=>/connected/i.test(h.$('#sb-engine-status').textContent)&&!/disconnected/i.test(h.$('#sb-engine-status').textContent),()=>h.$('#sb-connect-result').textContent);}

test('browser-only capacity and file checks work without an engine or network',async()=>{
 const h=harness();try{
  h.$('#sb-capacity').value='32';h.$('#sb-image-size').value='12';h.submit('#sb-plan-form');assert.match(h.$('#sb-plan-result').textContent,/fits/i);
  h.$('#sb-capacity').value='2';h.submit('#sb-plan-form');assert.match(outcome(h,'#sb-plan-result').textContent,/larger drive|short/i);
  h.$('#sb-image-size').value='0';assert.equal(h.$('#sb-plan-form').checkValidity(),false);
  const data=new Uint8Array([1,2,3]);const file={name:'sample.bin',size:3,arrayBuffer:async()=>data.buffer};Object.defineProperty(h.$('#sb-file'),'files',{configurable:true,value:[file]});h.$('#sb-file').dispatchEvent(new h.w.Event('change'));await until(()=>!h.$('#sb-save-receipt').disabled);
  assert.match(h.$('#sb-file-result').textContent,/039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81/);assert.equal(h.requests.length,0);
 }finally{h.close();}
});
test('connection rejects a remote engine URL and never sends its token',async()=>{
 const h=harness();try{h.$('#sb-engine-url').value='https://example.com';h.$('#sb-token').value=token;h.submit('#sb-connect-form');await settle();assert.equal(h.requests.length,0);assert.match(h.$('#sb-connect-result').textContent,/loopback|local|127\.0\.0\.1/i);}finally{h.close();}
});
test('disconnect cancels the effect of an older pending connection',async()=>{
 const pending=deferred(),h=harness(()=>pending.promise);try{h.$('#sb-token').value=token;h.submit('#sb-connect-form');h.$('#sb-disconnect').click();pending.resolve(response(capabilities));await settle();await settle();assert.match(h.$('#sb-engine-status').textContent,/disconnected|not connected/i);assert.equal(h.$('#sb-token').value,'');}finally{h.close();}
});
test('failed VSS retry clears the old downloadable script',async()=>{
 let calls=0;const h=harness(async url=>url.endsWith('/api/capabilities')?response(capabilities):++calls===1?response({result:{script:'# review only',executed:false}}):response({error:'fixture rejection'},400));try{
  await connect(h);h.$('#sb-vss-form [name=volume]').value='C:\\';h.submit('#sb-vss-form');await until(()=>!h.$('#sb-save-vss').disabled);
  const button=h.submit('#sb-vss-form');assert.equal(h.$('#sb-save-vss').disabled,true);await until(()=>!button.disabled);assert.equal(h.$('#sb-save-vss').disabled,true);assert.match(outcome(h,'#sb-vss-result').textContent,/fixture rejection/);
 }finally{h.close();}
});
test('disconnect prevents a pending tool response restoring a script download',async()=>{
 const pending=deferred(),h=harness(async url=>url.endsWith('/api/capabilities')?response(capabilities):pending.promise);try{
  await connect(h);h.$('#sb-vss-form [name=volume]').value='C:\\';h.submit('#sb-vss-form');h.$('#sb-disconnect').click();pending.resolve(response({result:{script:'# stale',executed:false}}));await settle();await settle();assert.equal(h.$('#sb-save-vss').disabled,true);assert.doesNotMatch(h.$('#sb-vss-result').textContent,/# stale/);
 }finally{h.close();}
});
test('failed boot verification is visibly failed',async()=>{
 const h=harness(async url=>url.endsWith('/api/capabilities')?response(capabilities):response({result:{passed:false,error:'Guest release mismatch'}}));try{
  await connect(h);const form=h.$('#sb-usb-verify-form');form.querySelector('[name=image]').value='/tmp/test.img';form.querySelector('[name=outputDirectory]').value='/tmp/proof';const b=h.submit('#sb-usb-verify-form');await until(()=>!b.disabled);assert.match(outcome(h,'#sb-usb-result').textContent,/failed|did not pass/i);assert.equal(outcome(h,'#sb-usb-result').dataset.state,'error');assert.match(h.$('#sb-usb-result').textContent,/Guest release mismatch/);
 }finally{h.close();}
});
test('website form reaches real authenticated API and verifies a real copied file',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sfeboot-ui-api-')),source=path.join(dir,'source.img'),destination=path.join(dir,'copy.img');await fs.writeFile(source,Buffer.from('SFEBoot UI to real API fixture'));
 const {server,url}=await startServer({port:0,token});const h=harness((url,init)=>fetch(url,init),url+'/');
 try{
  h.$('#sb-engine-url').value=url;h.$('#sb-token').value=token;h.submit('#sb-connect-form');await until(()=>/connected/i.test(h.$('#sb-engine-status').textContent)&&!/disconnected/i.test(h.$('#sb-engine-status').textContent),()=>h.$('#sb-connect-result').textContent);
  h.$('#sb-clone-form [name=source]').value=source;h.$('#sb-clone-form [name=destination]').value=destination;const b=h.submit('#sb-clone-form');await until(()=>!b.disabled);assert.deepEqual(await fs.readFile(destination),await fs.readFile(source));assert.match(h.$('#sb-clone-result').textContent,/readbackVerified/);assert.ok(h.requests.some(([url,init])=>url.endsWith('/api/tool')&&JSON.parse(init.body).name==='copy_image'));
  h.$('#sb-disconnect').click();assert.equal(h.$('#sb-token').value,'');assert.equal(h.w.localStorage.length,0);assert.equal(h.w.sessionStorage.length,0);
 }finally{h.close();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

test('task choices, connection guidance and keyboard tabs expose one active task',()=>{
 const h=harness();try{
  assert.equal(h.$('#sb-panel-inspect').hidden,false);assert.equal(h.$('#sb-engine-needed').hidden,true);
  h.$('[data-choose="usb"]').click();assert.equal(h.$('#sb-panel-usb').hidden,false);assert.equal(h.$('#sb-panel-inspect').hidden,true);assert.equal(h.$('#sb-engine-needed').hidden,false);assert.equal(h.$('#sb-usb-build-form [type=submit]').disabled,true);
  h.$('#sb-open-setup').click();assert.equal(h.$('#sb-connection').open,true);assert.equal(h.w.document.activeElement,h.$('#sb-engine-url'));
  h.$('#sb-tab-usb').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'End',bubbles:true}));const tabs=[...h.w.document.querySelectorAll('[data-panel]')];assert.equal(tabs.at(-1).getAttribute('aria-selected'),'true');assert.equal(h.w.document.activeElement,tabs.at(-1));
  assert.equal([...h.w.document.querySelectorAll('.sb-panel')].filter(p=>!p.hidden).length,1);h.$('[data-snippet="mcp"]').click();assert.equal(h.$('[data-snippet="mcp"]').getAttribute('aria-pressed'),'true');assert.notEqual(h.$('[data-snippet="mcp"]').getAttribute('role'),'tab');assert.match(h.$('#sb-code').textContent,/mcpServers/);h.w.initSFEBoot();assert.equal(h.w.document.querySelectorAll('.sb-outcome').length,h.w.document.querySelectorAll('pre[id$="-result"]').length);
 }finally{h.close();}
});
test('guided USB stages advance only on success and carry the created paths forward',async()=>{
 let fail=true;const h=harness(async url=>url.endsWith('/api/capabilities')?response(capabilities):response({result:fail?{passed:false,error:'fixture failure'}:{passed:true}}));try{
  await connect(h);h.$('[data-choose="usb"]').click();h.$('#sb-usb-build-form [name=newIso]').value='/tmp/new.iso';h.$('#sb-usb-build-form [name=oldIso]').value='/tmp/old.iso';h.$('#sb-usb-build-form [name=destination]').value='/tmp/built.img';
  let b=h.submit('#sb-usb-build-form');await until(()=>!b.disabled);assert.equal(h.$('[data-usb-stage="0"]').hidden,false);assert.notEqual(h.$('#sb-usb-verify-form [name=image]').value,'/tmp/built.img');
  fail=false;b=h.submit('#sb-usb-build-form');await until(()=>!b.disabled);assert.equal(h.$('[data-usb-stage="1"]').hidden,false);assert.equal(h.$('#sb-usb-simulate-form [name=image]').value,'/tmp/built.img');
  h.$('#sb-usb-simulate-form [name=destination]').value='/tmp/copied.img';b=h.submit('#sb-usb-simulate-form');await until(()=>!b.disabled);assert.equal(h.$('[data-usb-stage="2"]').hidden,false);assert.equal(h.$('#sb-usb-verify-form [name=image]').value,'/tmp/copied.img');
 }finally{h.close();}
});
test('reconnect releases old busy state without an older completion unlocking a newer request',async()=>{
 const old=deferred(),newer=deferred();let calls=0;const h=harness(async url=>url.endsWith('/api/capabilities')?response(capabilities):++calls===1?old.promise:newer.promise);
 try{
  await connect(h);h.$('#sb-vss-form [name=volume]').value='C:\\';h.submit('#sb-vss-form');h.$('#sb-disconnect').click();await connect(h);const b=h.$('#sb-vss-form [type=submit]');assert.equal(b.disabled,false);
  h.submit('#sb-vss-form');assert.equal(b.disabled,true);old.resolve(response({result:{script:'# old',executed:false}}));await settle();await settle();assert.equal(b.disabled,true);assert.equal(h.$('#sb-save-vss').disabled,true);
  newer.resolve(response({result:{script:'# current',executed:false}}));await until(()=>!b.disabled);assert.match(h.$('#sb-vss-result').textContent,/# current/);assert.equal(h.$('#sb-save-vss').disabled,false);
 }finally{h.close();}
});
test('a late result cannot replace a newer operation sharing the same result area',async()=>{
 const old=deferred();let calls=0;const h=harness(async url=>url.endsWith('/api/capabilities')?response(capabilities):++calls===1?old.promise:response({result:{passed:false,error:'newest failed'}}));
 try{
  await connect(h);h.$('#sb-x86-build-form [name=iso]').value='/tmp/alpine.iso';h.$('#sb-x86-build-form [name=destination]').value='/tmp/built.img';h.submit('#sb-x86-build-form');
  h.$('#sb-x86-verify-form [name=image]').value='/tmp/previous.img';h.$('#sb-x86-verify-form [name=outputDirectory]').value='/tmp/proof';const b=h.submit('#sb-x86-verify-form');await until(()=>!b.disabled);
  old.resolve(response({result:{passed:true}}));await settle();await settle();assert.equal(outcome(h,'#sb-x86-result').dataset.state,'error');assert.match(h.$('#sb-x86-result').textContent,/newest failed/);assert.equal(h.$('#sb-x86-verify-form [name=image]').value,'/tmp/previous.img');
 }finally{h.close();}
});
test('USB device picker exposes only eligible selections and clears them on disconnect',async()=>{
 const inventory={supported:true,devices:[{device:'disk4',bytes:134217728000,mediaName:'Disposable USB',eligible:true,reasons:[]},{device:'disk5',bytes:64000000000,mediaName:'Mounted USB',eligible:false,reasons:['mounted']}]};
 const h=harness(async url=>url.endsWith('/api/capabilities')?response(capabilities):response({result:inventory}));try{
  await connect(h);h.$('[data-choose="device"]').click();const b=h.$('#sb-list-devices');b.click();await until(()=>!b.disabled);
  const select=h.$('#sb-burn-plan-form [name=device]');assert.equal(select.tagName,'SELECT');const eligible=[...select.options].find(o=>o.value==='disk4'),ineligible=[...select.options].find(o=>o.value==='disk5');assert.ok(eligible);assert.equal(eligible.disabled,false);assert.ok(!ineligible||ineligible.disabled);assert.match(eligible.textContent,/Disposable USB/);
  select.value='disk4';h.$('#sb-disconnect').click();assert.equal(select.value,'');assert.ok(![...select.options].some(o=>o.value==='disk4'));
 }finally{h.close();}
});
