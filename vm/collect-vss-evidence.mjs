import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {vssScript} from '../lib/vss.mjs';
const args=process.argv.slice(2),directoryMode=args[0]==='--directory';
const [serialFile,destination]=directoryMode?args.slice(1):args;
if(!serialFile||!destination)throw Error('Usage: node vm/collect-vss-evidence.mjs [--directory] SERIAL_LOG_OR_RECEIPT_DIRECTORY NEW_DIRECTORY');
const names=new Set(['result.json','success.json','missing-file.json','ownership.json','success.stderr.txt','missing-file.stderr.txt']);
let payload;
if(directoryMode){
 const st=await fs.lstat(serialFile);if(!st.isDirectory()||st.isSymbolicLink())throw Error('Use an extracted receipt directory');
 const files=[];
 for(const name of names){
  const file=path.join(serialFile,name);let stat;try{stat=await fs.lstat(file);}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536)throw Error('Receipt must be a bounded regular file');
  const data=await fs.readFile(file);if(data.length>65536)throw Error('Receipt exceeds64KiB');
  files.push({name,sha256:createHash('sha256').update(data).digest('hex'),base64:data.toString('base64')});
 }
 payload={format:'sfeboot-vss-serial-v1',files};
}else{
const st=await fs.stat(serialFile);if(!st.isFile()||st.size>4*1024*1024)throw Error('Use a regular serial log of at most4MiB');
const log=await fs.readFile(serialFile,'utf8');
const matches=[...log.matchAll(/SFEBOOT_VSS_RECEIPTS_BEGIN\r?\n([A-Za-z0-9+/=\r\n]+?)\r?\nSFEBOOT_VSS_RECEIPTS_END/g)];
if(!matches.length)throw Error('No complete guest receipt frame');
const frame=matches.at(-1)[1].replace(/[\r\n]/g,'');if(frame.length>1024*1024)throw Error('Frame exceeds1MiB');
payload=JSON.parse(Buffer.from(frame,'base64').toString('utf8'));
}
if(payload.format!=='sfeboot-vss-serial-v1'||!Array.isArray(payload.files)||payload.files.length>6)throw Error('Invalid receipt envelope');
const decoded=new Map();const sha=data=>createHash('sha256').update(data).digest('hex');
for(const f of payload.files){if(!names.has(f.name)||decoded.has(f.name)||typeof f.base64!=='string'||f.base64.length>90000||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64))throw Error('Unexpected or duplicate file');const bytes=Buffer.from(f.base64,'base64');if(bytes.length>65536||bytes.toString('base64')!==f.base64||sha(bytes)!==f.sha256)throw Error('Receipt hash mismatch');decoded.set(f.name,bytes);}
if(!decoded.has('result.json'))throw Error('Missing result');
const read=name=>JSON.parse(decoded.get(name).toString('utf8').replace(/^\uFEFF/,''));
const result=read('result.json'),checks={};
checks.completeSet=['success.json','missing-file.json','ownership.json'].every(name=>decoded.has(name));
checks.reportedPass=result.passed===true&&result.cleanupVerified===true&&result.probeExecuted===true;
checks.isolation=result.snapshotIsolationVerified===true&&result.frozenSha256===sha('SFEBoot deterministic VSS fixture v1')&&result.expectedSha256===sha('SFEBoot live fixture changed after sentinel snapshot v2');
checks.cleanup=result.snapshotHashMatched===true&&result.unrelatedSnapshotsPreserved===true&&result.failureCleanupVerified===true&&result.applicationConsistent===false;
checks.baseline=Array.isArray(result.initialShadowIds)&&Array.isArray(result.finalShadowIds)&&JSON.stringify([...result.initialShadowIds].sort())===JSON.stringify([...result.finalShadowIds].sort());
checks.host=typeof result.host?.Caption==='string'&&typeof result.host?.BuildNumber==='string'&&typeof result.host?.OSArchitecture==='string';
checks.productionProbe=result.probeSha256===sha(vssScript({volume:'C:\\',relativePath:'SFEBootVssFixture/probe.txt'}).script)&&result.missingFileProbeSha256===sha(vssScript({volume:'C:\\',relativePath:'SFEBootVssFixture/missing.txt'}).script);
if(checks.completeSet){const guid=x=>typeof x==='string'&&/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i.test(x);const good=read('success.json'),bad=read('missing-file.json');checks.success=result.successExitCode===0&&good.snapshotCreated===true&&good.cleanupVerified===true&&good.fileSha256===result.expectedSha256&&guid(good.shadowId)&&good.shadowId!==result.sentinelShadowId&&good.applicationConsistent===false;checks.failure=Number.isInteger(result.failureExitCode)&&result.failureExitCode>0&&bad.snapshotCreated===true&&bad.cleanupVerified===true&&typeof bad.error==='string'&&bad.error.length>0&&guid(bad.shadowId)&&bad.shadowId!==result.sentinelShadowId&&bad.shadowId!==good.shadowId&&bad.applicationConsistent===false;checks.ownership=guid(result.sentinelShadowId)&&read('ownership.json').sentinelShadowId===result.sentinelShadowId;}
const passed=Object.values(checks).every(Boolean);const out=path.resolve(destination);await fs.mkdir(out);
for(const [name,bytes] of decoded)await fs.writeFile(path.join(out,name),bytes,{flag:'wx'});
const summary={collected:true,passed,checks,transport:directoryMode?'offline-receipt-files':'guest-COM1',source:'Receipt consistency checks; requires matching VM execution and transport provenance, not standalone attestation',host:result.host??null};
await fs.writeFile(path.join(out,'collection.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary,null,2));if(!passed)process.exitCode=1;
