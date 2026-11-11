#!/usr/bin/env node
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {copyImage,planMultiboot} from './master-usb.mjs';
export async function buildPack({catalog,destination,signal}){
 if(!catalog||!Array.isArray(catalog.images))throw Error('Catalog images required');
 const images=[];
 for(const image of catalog.images){if(!image||typeof image.id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(image.id))throw Error('Image IDs must be lowercase safe filename identifiers');const source=await fs.realpath(image.source);const stat=await fs.stat(source);if(!stat.isFile())throw Error('Each image source must be a regular file');images.push({...image,source,bytes:stat.size});}
 const plan=planMultiboot({...catalog,images});if(!plan.fits)throw Error('Catalog does not fit planned capacity');
 const dest=path.resolve(destination);if(/^\/dev(?:\/|$)/.test(dest)||/^\\\\[?.]\\/.test(destination))throw Error('Device paths disabled');
 await fs.mkdir(dest);const statusPath=path.join(dest,'status.json');const status={schemaVersion:1,state:'building',bootable:false,createdAt:new Date().toISOString()};await fs.writeFile(statusPath,JSON.stringify(status,null,2)+'\n',{flag:'wx'});
 try{
  await fs.mkdir(path.join(dest,'images'));const entries=[];
  for(const image of images){const copy=await copyImage({source:image.source,destination:path.join(dest,'images',image.id+'.img'),expectedSha256:image.sha256,signal});entries.push({id:image.id,title:image.title||image.id,os:image.os,architecture:image.architecture||'unspecified',path:'images/'+image.id+'.img',sha256:copy.sha256,bytes:copy.bytes,adapter:'unimplemented',bootSupport:'unverified'});}
  const menu={schemaVersion:1,kind:'multiboot-catalog',bootloaderInstalled:false,entries};await fs.writeFile(path.join(dest,'menu.json'),JSON.stringify(menu,null,2)+'\n',{flag:'wx'});await fs.writeFile(path.join(dest,'storage-plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
  await fs.writeFile(statusPath,JSON.stringify({...status,state:'verified-files-only',finishedAt:new Date().toISOString()},null,2)+'\n');return {directory:dest,verifiedImages:entries.length,bootable:false,menu};
 }catch(error){await fs.writeFile(statusPath,JSON.stringify({...status,state:'failed',error:error.message},null,2)+'\n');throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const [catalogFile,destination]=process.argv.slice(2);if(!catalogFile||!destination){console.error('Usage: node pack.mjs <catalog.json> <NEW pack-directory>');process.exitCode=1;}else{const controller=new AbortController();process.once('SIGINT',()=>controller.abort());fs.readFile(catalogFile,'utf8').then(JSON.parse).then(catalog=>buildPack({catalog,destination,signal:controller.signal})).then(result=>console.log(JSON.stringify(result,null,2))).catch(e=>{console.error(e.message);process.exitCode=1});}}
