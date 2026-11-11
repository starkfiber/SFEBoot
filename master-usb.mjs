#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const MiB=1024*1024;
function positiveInteger(n,name){if(!Number.isSafeInteger(n)||n<=0)throw Error(`${name} must be a positive safe integer`);return n;}
function localFile(value){if(typeof value!=='string'||!value.trim()||/^\\\\[?.]\\/.test(value)||/^\/dev(?:\/|$)/.test(value))throw Error('Only regular file paths are supported; device paths are disabled');if(value.split(/[\\/]/).some(part=>/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))throw Error('Windows device names are disabled');return path.resolve(value);}
async function hashHandle(handle,signal){const hash=createHash('sha256');const buffer=Buffer.alloc(MiB);let position=0;for(;;){if(signal?.aborted)throw Error('Copy aborted');const {bytesRead}=await handle.read(buffer,0,buffer.length,position);if(!bytesRead)break;hash.update(buffer.subarray(0,bytesRead));position+=bytesRead;}return {sha256:hash.digest('hex'),bytes:position};}
async function removeOwned(file,identity){if(!identity)return;try{const current=await fs.lstat(file);if(current.dev===identity.dev&&current.ino===identity.ino&&current.isFile())await fs.unlink(file);}catch(e){if(e.code!=='ENOENT')throw e;}}

/** Copy into a NEW regular image file only. No device backends or bootloader are implemented. */
export async function copyImage({source,destination,expectedSha256,signal,onProgress,chunkBytes=MiB}){
  positiveInteger(chunkBytes,'chunkBytes');if(chunkBytes>16*MiB)throw Error('chunkBytes exceeds 16 MiB');
  source=localFile(source);destination=localFile(destination);
  if(!/\.(img|iso|bin)$/i.test(destination))throw Error('Destination must have .img, .iso or .bin extension');
  if(source===destination)throw Error('Source and destination must differ');
  if(expectedSha256&&!/^[a-f0-9]{64}$/i.test(expectedSha256))throw Error('Expected digest must be SHA-256 hex');
  if(signal?.aborted)throw Error('Copy aborted');
  source=await fs.realpath(source);
  if(/^\/dev(?:\/|$)/.test(source)||(await fs.stat(source)).isFile()===false)throw Error('Source must be a regular file');
  const sourceHandle=await fs.open(source,'r');let destHandle,manifestHandle,destIdentity,manifestIdentity;
  const manifestPath=destination+'.manifest.json';
  try{
    const before=await sourceHandle.stat();if(!before.isFile())throw Error('Source must be a regular file');if(!before.size)throw Error('Source image is empty');
    // Canonical parent inspection prevents alias paths into /dev. Exclusive opens never replace existing entries.
    const parent=await fs.realpath(path.dirname(destination));if(/^\/dev(?:\/|$)/.test(parent))throw Error('Device destinations are disabled');
    destination=path.join(parent,path.basename(destination));
    manifestHandle=await fs.open(manifestPath,'wx');manifestIdentity=await manifestHandle.stat();
    destHandle=await fs.open(destination,'wx+');destIdentity=await destHandle.stat();if(!destIdentity.isFile())throw Error('Destination is not a regular file');
    const hash=createHash('sha256');const buffer=Buffer.alloc(chunkBytes);let bytes=0;
    for(;;){
      if(signal?.aborted)throw Error('Copy aborted');
      if(bytes>=before.size)break;
      const {bytesRead}=await sourceHandle.read(buffer,0,Math.min(buffer.length,before.size-bytes),bytes);if(!bytesRead)break;
      hash.update(buffer.subarray(0,bytesRead));let written=0;
      while(written<bytesRead){const {bytesWritten}=await destHandle.write(buffer,written,bytesRead-written,bytes+written);if(!bytesWritten)throw Error('Zero-byte write');written+=bytesWritten;}
      bytes+=bytesRead;await onProgress?.({bytes,total:before.size});
    }
    if(signal?.aborted)throw Error('Copy aborted');
    const after=await sourceHandle.stat();if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs||bytes!==before.size)throw Error('Source changed during copy');
    const sha256=hash.digest('hex');if(expectedSha256&&sha256!==expectedSha256.toLowerCase())throw Error('Source checksum does not match expected digest');
    await destHandle.sync();const readback=await hashHandle(destHandle,signal);if(readback.sha256!==sha256||readback.bytes!==bytes)throw Error('Readback verification failed');
    if(signal?.aborted)throw Error('Copy aborted');
    const result={schemaVersion:1,product:'SFEBoot file-image engine',createdAt:new Date().toISOString(),hostPlatform:process.platform,source,destination,bytes,sha256,readbackVerified:true,bootability:'not-established',deviceWrite:false};
    await manifestHandle.writeFile(JSON.stringify(result,null,2)+'\n');await manifestHandle.sync();
    return {...result,manifestPath};
  }catch(error){
    await destHandle?.close();destHandle=undefined;await manifestHandle?.close();manifestHandle=undefined;
    await removeOwned(destination,destIdentity);await removeOwned(manifestPath,manifestIdentity);throw error;
  }finally{await sourceHandle.close();await destHandle?.close();await manifestHandle?.close();}
}

/** Storage estimate and compatibility catalog only; does not partition or create boot media. */
export function planMultiboot({capacityBytes,images,reserveBytes=512*MiB,overheadPercent=2}){
  positiveInteger(capacityBytes,'capacityBytes');positiveInteger(reserveBytes,'reserveBytes');
  if(!Array.isArray(images)||images.length===0)throw Error('At least one image is required');
  if(!Number.isFinite(overheadPercent)||overheadPercent<0||overheadPercent>100)throw Error('overheadPercent must be 0..100');
  const ids=new Set();let imageBytes=0;const catalog=images.map(image=>{
    if(!image||typeof image.id!=='string'||!image.id.trim()||ids.has(image.id))throw Error('Image IDs must be nonempty and unique');ids.add(image.id);
    positiveInteger(image.bytes,'image.bytes');imageBytes+=image.bytes;if(!Number.isSafeInteger(imageBytes))throw Error('Image size sum exceeds safe integer range');
    if(!['windows','macos','linux','other'].includes(image.os))throw Error('Unsupported OS classification');
    const constraints=[];if(image.bytes>4294967295)constraints.push('Image exceeds FAT32 single-file limit; storage/boot adapter must address this.');
    if(image.os==='macos')constraints.push('Requires compatible Mac and Apple installer workflow; generic ISO multiboot is not established.');
    if(image.os==='windows')constraints.push('Firmware/architecture matching and Windows setup adapter required; large WIM may require splitting.');
    return {...image,bootSupport:'unverified',constraints};
  });
  const overheadBytes=Math.ceil(imageBytes*overheadPercent/100),requiredBytes=imageBytes+reserveBytes+overheadBytes;if(!Number.isSafeInteger(requiredBytes))throw Error('Required size exceeds safe integer range');
  return {schemaVersion:1,mode:'storage-estimate-only',capacityBytes,imageBytes,reserveBytes,overheadBytes,requiredBytes,remainingBytes:capacityBytes-requiredBytes,fits:requiredBytes<=capacityBytes,catalog,bootMenuImplemented:false};
}

async function cli(){const [command,...args]=process.argv.slice(2);if(command==='copy'){if(args.length<2||args.length>3)throw Error('copy <source> <NEW destination.img> [expected SHA-256]');const controller=new AbortController();process.once('SIGINT',()=>controller.abort());console.log(JSON.stringify(await copyImage({source:args[0],destination:args[1],expectedSha256:args[2],signal:controller.signal}),null,2));}else if(command==='plan'){if(args.length!==1)throw Error('plan <catalog.json>');const result=planMultiboot(JSON.parse(await fs.readFile(args[0],'utf8')));console.log(JSON.stringify(result,null,2));if(!result.fits)process.exitCode=2;}else throw Error('Usage: master-usb.mjs copy <source> <NEW destination.img> [sha256] | plan <catalog.json>');}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)cli().catch(e=>{console.error(e.message);process.exitCode=1});
