#!/usr/bin/env node
import {tool} from './tools.mjs';
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const [newArg,oldArg,outArg]=process.argv.slice(2);if(!newArg||!oldArg||!outArg)throw Error('Usage: node build.mjs ALPINE_3.24.3_ISO ALPINE_3.23.7_ISO NEW_OUTPUT.iso');
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const inputs=[{version:'3.24.3',path:fs.realpathSync(newArg),sha256:'e34603080e942e9ebc670689eee77dd7a6551c823a6ff5a299e308ded268098f'},{version:'3.23.7',path:fs.realpathSync(oldArg),sha256:'69188d10c12b53558efff8535835a26b1542839e47dbb86f557ecb75d4fc5b70'}];for(const input of inputs){if(!fs.statSync(input.path).isFile()||input.path.startsWith('/dev/'))throw Error('Regular input file required');if(sha(input.path)!==input.sha256)throw Error('Publisher checksum mismatch: '+input.version);}
const output=path.join(fs.realpathSync(path.dirname(path.resolve(outArg))),path.basename(outArg));if(!output.endsWith('.iso')||output.startsWith('/dev/')||fs.existsSync(output))throw Error('New regular .iso output path required');
const buildDir=output+'.build';fs.mkdirSync(buildDir);const old=path.join(buildDir,'old');fs.mkdirSync(old);const config=fileURLToPath(new URL('./grub.cfg',import.meta.url));const log=path.join(buildDir,'build.log');const logfd=fs.openSync(log,'wx');
let result={schemaVersion:1,startedAt:new Date().toISOString(),inputs,output,configSha256:sha(config),status:'building'};
try{execFileSync(tool('tar'),['-xf',inputs[1].path,'-C',old,'boot','apks'],{stdio:['ignore',logfd,logfd]});const args=['-indev',inputs[0].path,'-outdev',output,'-map',config,'/boot/grub/grub.cfg','-map',path.join(old,'boot'),'/versions/3.23.7/boot','-map',path.join(old,'apks'),'/versions/3.23.7/apks','-boot_image','any','replay','-commit'];result.xorrisoArgs=args;execFileSync(tool('xorriso'),args,{stdio:['ignore',logfd,logfd]});result={...result,status:'built-not-yet-boot-verified',imageSha256:sha(output),bytes:fs.statSync(output).size,finishedAt:new Date().toISOString()};}
catch(e){result={...result,status:'failed',error:e.message};throw e;}
finally{fs.closeSync(logfd);fs.writeFileSync(path.join(buildDir,'receipt.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));
