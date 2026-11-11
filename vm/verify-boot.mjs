#!/usr/bin/env node
import {tool, firmware} from './tools.mjs';
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const [isoArg,version='3.24.3',outArg='boot-proof']=process.argv.slice(2);if(!isoArg||!['3.24.3','3.23.7'].includes(version))throw Error('Usage: node verify-boot.mjs ISO 3.24.3|3.23.7 NEW_OUTPUT_DIRECTORY');
if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('This verifier currently requires an ARM64 Mac with HVF; other hosts are unqualified');
const firmwarePath=firmware();
const iso=fs.realpathSync(isoArg),out=path.resolve(outArg);if(!fs.statSync(iso).isFile()||iso.startsWith('/dev/'))throw Error('Regular image file required');fs.mkdirSync(out,{recursive:false});
const args=['-machine','virt','-accel','hvf','-cpu','host','-smp','2','-m','1024','-bios',firmwarePath,'-drive',`file=${iso},format=raw,if=none,id=installer,media=cdrom,readonly=on`,'-device','virtio-scsi-pci','-device','scsi-cd,drive=installer','-display','none','-serial','stdio','-monitor','none','-nic','none','-no-reboot'];
const qemu=tool('qemu-system-aarch64');const child=spawn(qemu,args,{stdio:['pipe','pipe','pipe']});let transcript='',stderr='',phase='menu',timedOut=false;
fs.writeFileSync(path.join(out,'invocation.json'),JSON.stringify({qemu,args,pid:child.pid,startedAt:new Date().toISOString(),imageSha256:createHash('sha256').update(fs.readFileSync(iso)).digest('hex')},null,2));
const clean=s=>s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\r/g,'');
const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},120000);
child.stdout.on('data',chunk=>{transcript+=chunk.toString();fs.appendFileSync(path.join(out,'serial.raw.log'),chunk);const t=clean(transcript);
 if(phase==='menu'&&t.includes('Master USB - Alpine Linux 3.24.3 installer')&&t.includes('Master USB - Alpine Linux 3.23.7 installer')){phase='booting';fs.writeFileSync(path.join(out,'menu.txt'),t);setTimeout(()=>child.stdin.write(version==='3.23.7'?'\x1b[B\r':'\r'),300);}
 if(phase==='booting'&&/login:\s*$/.test(t)){phase='login';child.stdin.write('root\r');}
 if(phase==='login'&&/localhost:~#\s*$/.test(t)){phase='commands';child.stdin.write("printf '\\nPROOF_BEGIN\\n'; cat /etc/alpine-release; uname -r; cat /etc/apk/repositories; cat /proc/cmdline; command -v setup-alpine; setup-alpine -h; printf '\\nPROOF_END\\n'; poweroff\r");}
});
child.stderr.on('data',d=>stderr+=d);child.on('error',e=>stderr+=e.message);
child.on('close',(code,signal)=>{clearTimeout(timer);const text=clean(transcript);fs.writeFileSync(path.join(out,'serial.txt'),text);fs.writeFileSync(path.join(out,'stderr.log'),stderr);const proof=text.match(/^PROOF_BEGIN\n([\s\S]*?)^PROOF_END$/m)?.[1]||'';const passed=!timedOut&&code===0&&proof.split('\n')[0]===version&&proof.split('\n')[2]===(version==='3.24.3'?'/media/cdrom/apks':'/media/cdrom/versions/3.23.7/apks')&&proof.includes('master_usb_entry=alpine-'+version)&&proof.includes('/sbin/setup-alpine')&&proof.includes('usage:');const result={passed,version,phase,exitCode:code,signal,timedOut,childExited:true,proof,scope:'ARM64 UEFI GRUB menu -> selected Alpine live installer environment; no OS installation or host disk write'};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!passed)process.exitCode=1;});
