import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const MiB=1024*1024;
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
async function run(file,args,input){return await new Promise((resolve,reject)=>{const c=spawn(file,args,{stdio:['pipe','pipe','pipe']});let out='',err='';const timer=setTimeout(()=>c.kill('SIGKILL'),15000);c.on('error',reject);c.stdout.on('data',d=>{out+=d;if(out.length>8*MiB)c.kill('SIGKILL');});c.stderr.on('data',d=>err+=d);c.on('close',code=>{clearTimeout(timer);code===0?resolve(out):reject(Error(`${path.basename(file)} failed: ${err.slice(0,300)}`));});c.stdin.end(input);});}
// diskutil subcommands require -plist immediately after verb, not at the end.
async function plist(verb,...args){return JSON.parse(await run('/usr/bin/plutil',['-convert','json','-o','-','-'],await run('/usr/sbin/diskutil',[verb,'-plist',...args])));}
// Parse only the property-list types produced by ioreg; no external entity resolution.
export function parseRegistryPlist(xml){
 if(typeof xml!=='string'||xml.length>8*MiB)throw Error('Invalid registry archive');
 const tokens=xml.match(/<[^>]+>|[^<]+/g)||[];let i=0;
 const skip=()=>{while(i<tokens.length&&(/^[\s]*$/.test(tokens[i])||/^<\?|^<!|^<\/?plist\b/.test(tokens[i])))i++;};
 const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,e)=>e[0]==='#'?String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e]));
 function value(depth=0){if(depth>64)throw Error('Registry archive too deep');skip();const tag=tokens[i++];
  if(tag==='<dict>'){const o=Object.create(null);for(;;){skip();if(tokens[i]==='</dict>'){i++;return o;}if(tokens[i++]!=='<key>')throw Error('Invalid registry dictionary');let k='';while(i<tokens.length&&tokens[i]!=='</key>')k+=tokens[i++];if(tokens[i++]!=='</key>')throw Error('Invalid registry key');k=decode(k);if(Object.hasOwn(o,k))throw Error('Duplicate registry key');o[k]=value(depth+1);}}
  if(tag==='<array>'){const a=[];for(;;){skip();if(tokens[i]==='</array>'){i++;return a;}a.push(value(depth+1));}}
  if(/^<(true|false)\s*\/>$/.test(tag||''))return tag.includes('true');
  const m=/^<(string|integer|data|real|date)(\s*\/)?>(?:)$/.exec(tag||'');if(!m)throw Error('Unsupported registry archive tag');if(m[2])return '';
  let text='';while(i<tokens.length&&tokens[i]!==`</${m[1]}>`)text+=tokens[i++];if(tokens[i++]!==`</${m[1]}>`)throw Error('Unclosed registry value');
  if(m[1]==='integer'){const n=Number(text);if(!/^-?\d+$/.test(text.trim()))throw Error('Invalid registry integer');return Number.isSafeInteger(n)?n:text.trim();}if(m[1]==='real')return Number(text);return decode(text);
 }
 const result=value();skip();if(i!==tokens.length)throw Error('Trailing registry data');return result;
}
export function resolveUsbIdentity(registry,info){
 const matches=[];const usbNodes=[];
 function walk(n,anc=[]){if(!n||typeof n!=='object')return;if(n.IOObjectClass==='IOUSBHostDevice')usbNodes.push(n);if(n['BSD Name']===info.DeviceIdentifier)matches.push({node:n,anc});for(const child of n.IORegistryEntryChildren||[])walk(child,[...anc,n]);}
 for(const n of Array.isArray(registry)?registry:[registry])walk(n);
 if(matches.length!==1)throw Error('USB registry disk match missing or ambiguous');
 const {node,anc}=matches[0],usb=[...anc].reverse().find(n=>n.IOObjectClass==='IOUSBHostDevice');
 if(!usb||node.IOObjectClass!=='IOMedia'||node.Whole!==true||node.Size!==info.TotalSize||node.IORegistryEntryName!==info.IORegistryEntryName)throw Error('USB registry media identity mismatch');
 const serial=usb['USB Serial Number']||usb.kUSBSerialNumberString;
 if(typeof serial!=='string'||!/^[-a-zA-Z0-9._:]{4,128}$/.test(serial)||/^(0+|f+|unknown|none)$/i.test(serial))throw Error('USB registry stable serial missing');
 if(usb['USB Serial Number']&&usb.kUSBSerialNumberString&&usb['USB Serial Number']!==usb.kUSBSerialNumberString)throw Error('USB registry serial conflict');
 if(info.SerialNumber&&info.SerialNumber!==serial)throw Error('diskutil and USB registry serial conflict');
 if(usbNodes.filter(n=>(n['USB Serial Number']||n.kUSBSerialNumberString)===serial).length!==1)throw Error('USB registry serial is not unique');
 if(!Number.isInteger(usb.idVendor)||!Number.isInteger(usb.idProduct)||usb.idVendor<=0||usb.idVendor>65535||usb.idProduct<0||usb.idProduct>65535||!Number.isSafeInteger(usb.IORegistryEntryID)||!Number.isSafeInteger(node.IORegistryEntryID))throw Error('USB registry identifiers missing');
 return {serial,vendorId:usb.idVendor,productId:usb.idProduct,usbRegistryId:usb.IORegistryEntryID,mediaRegistryId:node.IORegistryEntryID,source:'IOService exact BSD-name media ancestry'};
}
async function enrichIdentity(info){if(info.BusProtocol!=='USB'||info.Internal!==false)return info;try{const registry=parseRegistryPlist(await run('/usr/sbin/ioreg',['-a','-l','-p','IOService','-r','-c','IOUSBHostDevice']));const usbIdentity=resolveUsbIdentity(registry,info);return {...info,SerialNumber:usbIdentity.serial,UsbIdentity:usbIdentity};}catch(e){return {...info,SerialNumber:undefined,UsbIdentityError:e.message};}}
function diskId(device){if(typeof device!=='string'||!/^disk[1-9][0-9]*$/.test(device))throw Error('An explicit whole disk identifier such as disk4 is required; disk0 and raw paths are prohibited');return device;}
export function validateDeviceRecord(info,partitionInfos=[]){
 const reasons=[];
 if(info.WholeDisk!==true)reasons.push('not-whole-disk');
 if(info.Internal!==false||info.OSInternalMedia===true)reasons.push('internal-or-unknown');
 if(info.RemovableMedia!==true)reasons.push('nonremovable-or-unknown');
 if(info.BusProtocol!=='USB')reasons.push('not-usb');
 if(info.VirtualOrPhysical!=='Physical')reasons.push('not-physical');
 if(info.Writable!==true||info.WritableMedia!==true)reasons.push('not-writable');
 if(info.SystemImage!==false)reasons.push('system-image-or-unknown');
 if(!/^disk[1-9][0-9]*$/.test(info.DeviceIdentifier||''))reasons.push('prohibited-identifier');
 if(!Number.isSafeInteger(info.TotalSize)||info.TotalSize<=0||!Number.isSafeInteger(info.DeviceBlockSize)||info.DeviceBlockSize<512)reasons.push('invalid-size');
 if(!info.DeviceTreePath||!info.IORegistryEntryName)reasons.push('missing-device-identity');
 if(typeof info.SerialNumber!=='string'||!/^[-a-zA-Z0-9._:]{4,128}$/.test(info.SerialNumber)||/^(0+|f+|unknown|none)$/i.test(info.SerialNumber))reasons.push('missing-stable-hardware-serial');
 if([info,...partitionInfos].some(p=>p.MountPoint||p.Mounted===true))reasons.push('mounted');
 if(partitionInfos.some(p=>/APFS|CoreStorage/i.test(p.Content||'')||p.APFSContainerReference))reasons.push('apfs-or-corestorage-unqualified');
 return {eligible:reasons.length===0,reasons};
}
function identity(info){return {device:info.DeviceIdentifier,bytes:info.TotalSize,blockBytes:info.DeviceBlockSize,bus:info.BusProtocol,tree:info.DeviceTreePath,registry:info.IORegistryEntryName,mediaName:info.MediaName||'',serial:info.SerialNumber||null,usbIdentity:info.UsbIdentity||null};}
async function inspectDevice(device){device=diskId(device);const info=await enrichIdentity(await plist('info',device)),list=await plist('list',device);const ids=new Set();const collect=x=>{if(!x||typeof x!=='object')return;if(typeof x.DeviceIdentifier==='string'&&x.DeviceIdentifier!==device)ids.add(x.DeviceIdentifier);for(const v of Object.values(x))if(typeof v==='object')collect(v);};collect(list);const partitions=[];for(const id of ids)partitions.push(await plist('info',id));return {info,partitions,...validateDeviceRecord(info,partitions)};}
export async function burnerInventory(){if(process.platform!=='darwin')return {supported:false,platform:process.platform,qualification:'macOS hardware adapter only; unsupported on this host',devices:[]};const listing=await plist('list','physical');const devices=[];for(const d of listing.AllDisksAndPartitions||[]){const id=d.DeviceIdentifier;if(!/^disk[1-9][0-9]*$/.test(id||''))continue;const item=await inspectDevice(id);if(item.info.Internal===false)devices.push({...identity(item.info),...validateDeviceRecord(item.info,item.partitions),identityHash:hash(identity(item.info)),...(item.info.UsbIdentityError?{identityError:item.info.UsbIdentityError}:{})});}return {supported:true,qualification:'experimental; one-device image-prefix write/readback and captured-image QEMU boot verified; no physical firmware or full-capacity qualification',devices};}
async function sourceFile(image){if(typeof image!=='string'||image.startsWith('/dev/')||!image)throw Error('Regular source image required');const resolved=await fs.realpath(image);if(resolved.startsWith('/dev/'))throw Error('Device source prohibited');const h=await fs.open(resolved,'r');const s=await h.stat();if(!s.isFile()||s.size<=0){await h.close();throw Error('Nonempty regular source image required');}return {path:resolved,handle:h,stat:s};}
async function hashHandle(h,size,signal){const digest=createHash('sha256'),b=Buffer.alloc(MiB);let pos=0;while(pos<size){if(signal?.aborted)throw Error('Burn cancelled during verification');const {bytesRead}=await h.read(b,0,Math.min(b.length,size-pos),pos);if(!bytesRead)throw Error('Unexpected end of input');digest.update(b.subarray(0,bytesRead));pos+=bytesRead;}return digest.digest('hex');}
export async function prepareBurn({image,device}){if(process.platform!=='darwin')throw Error('Physical burner planning requires macOS');const d=await inspectDevice(device);if(!d.eligible)throw Error('Device rejected: '+d.reasons.join(', '));const source=await sourceFile(image);try{if(source.stat.size>d.info.TotalSize||source.stat.size%d.info.DeviceBlockSize!==0)throw Error('Image must fit and be aligned to device block size');const sha256=await hashHandle(source.handle,source.stat.size);const after=await source.handle.stat();if(source.stat.size!==after.size||source.stat.mtimeMs!==after.mtimeMs||source.stat.ctimeMs!==after.ctimeMs)throw Error('Source changed during preparation');const plan={schemaVersion:1,kind:'macos-usb-burn',image:source.path,imageBytes:source.stat.size,imageSha256:sha256,device:identity(d.info),deviceIdentityHash:hash(identity(d.info)),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),qualification:'experimental-unqualified-physical-hardware',destructive:true,tailPolicy:'Only image bytes written; remaining device bytes retained. No repartitioning or repair.'};return {...plan,confirmation:'ERASE '+d.info.DeviceIdentifier+' '+plan.deviceIdentityHash.slice(0,16)+' '+sha256.slice(0,16)};}finally{await source.handle.close();}}
async function writeVerified(source,target,size,expectedSha256,signal){const h=createHash('sha256'),b=Buffer.alloc(MiB);let offset=0;while(offset<size){if(signal?.aborted)throw Error('Burn cancelled; target may be partially overwritten');const {bytesRead}=await source.read(b,0,Math.min(MiB,size-offset),offset);if(!bytesRead)throw Error('Source ended during write');h.update(b.subarray(0,bytesRead));let written=0;while(written<bytesRead){if(signal?.aborted)throw Error('Burn cancelled; target may be partially overwritten');const r=await target.write(b,written,bytesRead-written,offset+written);if(!r.bytesWritten)throw Error('Target write made no progress');written+=r.bytesWritten;}offset+=bytesRead;}if(h.digest('hex')!==expectedSha256)throw Error('Source changed while writing; target must not be used');await target.sync();const readback=await hashHandle(target,size,signal);if(readback!==expectedSha256)throw Error('Readback mismatch; target must not be used');return {bytes:size,sha256:readback,readbackVerified:true};}
export async function simulateUsbBurn({image,destination,capacityBytes}, {signal}={}){const source=await sourceFile(image);let target,targetIdentity;try{capacityBytes??=source.stat.size;if(!Number.isSafeInteger(capacityBytes)||capacityBytes<source.stat.size)throw Error('Capacity must fit the source image');if(typeof destination!=='string'||!destination.endsWith('.img')||destination.startsWith('/dev/'))throw Error('New regular .img destination required');const parent=await fs.realpath(path.dirname(path.resolve(destination)));if(parent==='/dev'||parent.startsWith('/dev/'))throw Error('Device destinations prohibited');destination=path.join(parent,path.basename(destination));target=await fs.open(destination,'wx+');targetIdentity=await target.stat();await target.truncate(capacityBytes);const digest=await hashHandle(source.handle,source.stat.size);const result=await writeVerified(source.handle,target,source.stat.size,digest,signal);const after=await source.handle.stat();if(after.size!==source.stat.size||after.mtimeMs!==source.stat.mtimeMs||after.ctimeMs!==source.stat.ctimeMs)throw Error('Source changed during simulated burn');return {...result,destination,capacityBytes,targetType:'regular-file-usb-emulation',physicalDeviceWrite:false,bootability:'not-established'};}catch(e){if(target){await target.close();target=null;try{const current=await fs.lstat(destination);if(current.isFile()&&current.dev===targetIdentity.dev&&current.ino===targetIdentity.ino)await fs.unlink(destination);}catch{}}throw e;}finally{await source.handle.close();await target?.close();}}
export async function burnMacUsb({plan,confirmation,experimentalHardware=false},{signal}={}){
 if(experimentalHardware!==true)throw Error('Physical writer is unqualified: explicit experimentalHardware:true and exact confirmation required; no automatic/API use');
 if(process.platform!=='darwin'||process.getuid?.()!==0)throw Error('Physical writer requires local macOS administrator execution');
 if(!plan||plan.kind!=='macos-usb-burn'||plan.schemaVersion!==1||plan.qualification!=='experimental-unqualified-physical-hardware')throw Error('Invalid burn plan');
 if(typeof plan.expiresAt!=='string'||!Number.isFinite(Date.parse(plan.expiresAt))||Date.parse(plan.expiresAt)<Date.now()||Date.parse(plan.expiresAt)>Date.now()+600000)throw Error('Burn plan expired or invalid');
 const d=await inspectDevice(plan.device?.device);if(!d.eligible||hash(identity(d.info))!==plan.deviceIdentityHash||JSON.stringify(identity(d.info))!==JSON.stringify(plan.device))throw Error('Device identity or mount state changed');
 const required='ERASE '+d.info.DeviceIdentifier+' '+plan.deviceIdentityHash.slice(0,16)+' '+plan.imageSha256?.slice(0,16);if(confirmation!==required||plan.confirmation!==required)throw Error('Exact plan confirmation required');
 if(!Number.isSafeInteger(plan.imageBytes)||plan.imageBytes<=0||plan.imageBytes>d.info.TotalSize||plan.imageBytes%d.info.DeviceBlockSize||!/^[a-f0-9]{64}$/.test(plan.imageSha256||''))throw Error('Invalid source identity');
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'sfeboot-burn-'));let target,snapshot,writeStarted=false;
 try{const source=await sourceFile(plan.image);try{const snapshotPath=path.join(tmp,'source.img');snapshot=await fs.open(snapshotPath,'wx+');const actual=await hashHandle(source.handle,source.stat.size);if(actual!==plan.imageSha256||source.stat.size!==plan.imageBytes)throw Error('Source no longer matches plan');await writeVerified(source.handle,snapshot,source.stat.size,actual,signal);const after=await source.handle.stat();if(after.size!==source.stat.size||after.mtimeMs!==source.stat.mtimeMs||after.ctimeMs!==source.stat.ctimeMs)throw Error('Source changed during private snapshot');}finally{await source.handle.close();}
 const fresh=await inspectDevice(d.info.DeviceIdentifier);if(!fresh.eligible||hash(identity(fresh.info))!==plan.deviceIdentityHash)throw Error('Device changed before opening');
 const raw='/dev/r'+d.info.DeviceIdentifier;const before=await fs.lstat(raw);if(!before.isCharacterDevice()||before.isSymbolicLink())throw Error('Expected a raw character device');target=await fs.open(raw,constants.O_RDWR|constants.O_NOFOLLOW);const opened=await target.stat();if(!opened.isCharacterDevice()||opened.rdev!==before.rdev)throw Error('Opened device identity mismatch');const final=await inspectDevice(d.info.DeviceIdentifier);if(!final.eligible||hash(identity(final.info))!==plan.deviceIdentityHash)throw Error('Device changed before write');
 writeStarted=true;const result=await writeVerified(snapshot,target,plan.imageBytes,plan.imageSha256,signal);const afterWrite=await inspectDevice(d.info.DeviceIdentifier);if(!afterWrite.eligible||hash(identity(afterWrite.info))!==plan.deviceIdentityHash)throw Error('Device identity or mount state changed during write/readback');return {...result,device:plan.device,physicalDeviceWrite:true,qualification:'experimental-physical-write-readback-only',bootability:'not-established',tailPolicy:plan.tailPolicy};
 }catch(e){e.writeStarted=writeStarted;e.targetMayBeIncomplete=writeStarted;throw e;}finally{await target?.close();await snapshot?.close();await fs.rm(tmp,{recursive:true,force:true});}
}

// Read-only capture of the exact written prefix for a later VM boot test.
// This is deliberately separate from generic image inspection and MCP tools.
export async function exportUsbReadback({plan,destination},{signal}={}){
 if(process.platform!=='darwin')throw Error('USB readback requires macOS');
 if(!plan||plan.kind!=='macos-usb-burn'||plan.schemaVersion!==1||!Number.isSafeInteger(plan.imageBytes)||plan.imageBytes<=0||!/^[a-f0-9]{64}$/.test(plan.imageSha256||''))throw Error('Invalid readback plan');
 const d=await inspectDevice(plan.device?.device);if(!d.eligible||hash(identity(d.info))!==plan.deviceIdentityHash||JSON.stringify(identity(d.info))!==JSON.stringify(plan.device)||plan.imageBytes>d.info.TotalSize||plan.imageBytes%d.info.DeviceBlockSize)throw Error('Readback device identity or mount state changed');
 if(typeof destination!=='string'||!destination.endsWith('.img')||destination.startsWith('/dev/'))throw Error('New regular .img readback destination required');
 const parent=await fs.realpath(path.dirname(path.resolve(destination)));if(parent==='/dev'||parent.startsWith('/dev/'))throw Error('Device destinations prohibited');destination=path.join(parent,path.basename(destination));
 let source,target,owned;
 try{
  const raw='/dev/r'+d.info.DeviceIdentifier;const before=await fs.lstat(raw);if(!before.isCharacterDevice()||before.isSymbolicLink())throw Error('Expected raw character device');
  source=await fs.open(raw,constants.O_RDONLY|constants.O_NOFOLLOW);const opened=await source.stat();if(!opened.isCharacterDevice()||opened.rdev!==before.rdev)throw Error('Opened readback device identity mismatch');
  const fresh=await inspectDevice(d.info.DeviceIdentifier);if(!fresh.eligible||hash(identity(fresh.info))!==plan.deviceIdentityHash)throw Error('Readback device changed before reading');
  target=await fs.open(destination,'wx+');owned=await target.stat();const result=await writeVerified(source,target,plan.imageBytes,plan.imageSha256,signal);
  const after=await inspectDevice(d.info.DeviceIdentifier);if(!after.eligible||hash(identity(after.info))!==plan.deviceIdentityHash)throw Error('Readback device changed during reading');
  return {...result,destination,device:plan.device,physicalDeviceWrite:false,physicalDeviceRead:true,scope:'exact image prefix only; physical boot not established',bootability:'not-established'};
 }catch(e){if(target){await target.close();target=null;try{const current=await fs.lstat(destination);if(current.isFile()&&current.dev===owned.dev&&current.ino===owned.ino)await fs.unlink(destination);}catch{}}throw e;
 }finally{await source?.close();await target?.close();}
}
