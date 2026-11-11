import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const cli=fileURLToPath(new URL('../vm/collect-vss-evidence.mjs',import.meta.url));
const member=(name,value)=>{const data=Buffer.from(JSON.stringify(value));return {name,sha256:createHash('sha256').update(data).digest('hex'),base64:data.toString('base64')};};
const frame=files=>'SFEBOOT_VSS_RECEIPTS_BEGIN\n'+Buffer.from(JSON.stringify({format:'sfeboot-vss-serial-v1',files})).toString('base64')+'\nSFEBOOT_VSS_RECEIPTS_END\n';
test('VSS serial collector rejects traversal, duplicates and corrupted receipts before output',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sfeboot-vss-collector-'));try{const good=member('result.json',{passed:false});const cases=[[member('../escape.json',{})],[good,good],[{...good,sha256:'0'.repeat(64)}]];for(let i=0;i<cases.length;i++){const log=path.join(dir,i+'.log'),out=path.join(dir,'out'+i);await fs.writeFile(log,frame(cases[i]));const r=spawnSync(process.execPath,[cli,log,out],{encoding:'utf8'});assert.notEqual(r.status,0);await assert.rejects(fs.stat(out),/ENOENT/);}await assert.rejects(fs.stat(path.join(dir,'escape.json')),/ENOENT/);}finally{await fs.rm(dir,{recursive:true,force:true});}});
test('VSS serial collector preserves failed guest evidence without claiming runtime success',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sfeboot-vss-failed-'));try{const log=path.join(dir,'serial.log'),out=path.join(dir,'evidence');await fs.writeFile(log,frame([member('result.json',{passed:false,error:'VSS provider failure',cleanupVerified:false})]));let r=spawnSync(process.execPath,[cli,log,out],{encoding:'utf8'});assert.equal(r.status,1);const result=JSON.parse(await fs.readFile(path.join(out,'collection.json'),'utf8'));assert.equal(result.collected,true);assert.equal(result.passed,false);assert.equal(JSON.parse(await fs.readFile(path.join(out,'result.json'),'utf8')).error,'VSS provider failure');await fs.writeFile(path.join(out,'sentinel.txt'),'preserve');r=spawnSync(process.execPath,[cli,log,out],{encoding:'utf8'});assert.notEqual(r.status,0);assert.equal(await fs.readFile(path.join(out,'sentinel.txt'),'utf8'),'preserve');}finally{await fs.rm(dir,{recursive:true,force:true});}});
test('offline receipt collection preserves failure and rejects symlinked receipts',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sfeboot-vss-offline-'));
 try{
  const input=path.join(dir,'input');await fs.mkdir(input);
  await fs.writeFile(path.join(input,'result.json'),JSON.stringify({passed:false,cleanupVerified:false,error:'Guest test failed'}));
  const out=path.join(dir,'out');let r=spawnSync(process.execPath,[cli,'--directory',input,out],{encoding:'utf8'});
  assert.equal(r.status,1);const summary=JSON.parse(await fs.readFile(path.join(out,'collection.json'),'utf8'));
  assert.equal(summary.transport,'offline-receipt-files');assert.equal(summary.passed,false);
  await fs.symlink(path.join(input,'result.json'),path.join(input,'success.json'));
  const rejected=path.join(dir,'rejected');r=spawnSync(process.execPath,[cli,'--directory',input,rejected],{encoding:'utf8'});
  assert.notEqual(r.status,0);await assert.rejects(fs.stat(rejected),/ENOENT/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
