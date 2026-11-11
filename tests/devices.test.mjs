import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateDeviceRecord,simulateUsbBurn,burnMacUsb,prepareBurn,burnerInventory} from '../lib/devices.mjs';
import {vssScript} from '../lib/vss.mjs';
const device={DeviceIdentifier:'disk4',WholeDisk:true,Internal:false,OSInternalMedia:false,RemovableMedia:true,BusProtocol:'USB',VirtualOrPhysical:'Physical',Writable:true,WritableMedia:true,SystemImage:false,TotalSize:8*1024*1024,DeviceBlockSize:512,DeviceTreePath:'fixture/usb0',IORegistryEntryName:'Fixture USB',MediaName:'Fixture USB',SerialNumber:'SFE-FIXTURE-USB-0001'};
test('physical candidate validation rejects every unsafe or unknown property',()=>{assert.equal(validateDeviceRecord(device).eligible,true);for(const change of [{WholeDisk:false},{Internal:true},{Internal:undefined},{RemovableMedia:false},{BusProtocol:'Thunderbolt'},{VirtualOrPhysical:'Virtual'},{WritableMedia:false},{SystemImage:true},{DeviceIdentifier:'disk0'},{DeviceTreePath:''},{SerialNumber:undefined},{SerialNumber:'00000000'},{DeviceBlockSize:0},{MountPoint:'/Volumes/DATA'}])assert.equal(validateDeviceRecord({...device,...change}).eligible,false,JSON.stringify(change));assert.equal(validateDeviceRecord(device,[{MountPoint:'/'}]).eligible,false);assert.equal(validateDeviceRecord(device,[{Content:'Apple_APFS'}]).eligible,false);});
test('simulated burner writes real sparse regular disk and verifies image bytes',async()=>{const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'sfeboot-device-test-'));try{const data=Buffer.alloc(2*1024*1024,0x3b);data.write('SFEBoot device writer shared streaming core');const source=path.join(tmp,'source.img'),dest=path.join(tmp,'usb.img');await fs.writeFile(source,data);const result=await simulateUsbBurn({image:source,destination:dest,capacityBytes:4*1024*1024});assert.equal(result.readbackVerified,true);assert.equal(result.physicalDeviceWrite,false);assert.equal(result.sha256,createHash('sha256').update(data).digest('hex'));const disk=await fs.readFile(dest);assert.equal(disk.length,4*1024*1024);assert.ok(disk.subarray(0,data.length).equals(data));assert.ok(disk.subarray(data.length).every(v=>v===0));await assert.rejects(simulateUsbBurn({image:source,destination:dest}),/EEXIST/);assert.ok((await fs.readFile(dest)).equals(disk));}finally{await fs.rm(tmp,{recursive:true,force:true});}});
test('simulated burner rejects devices, cancellation, capacity shortfall and preserves aliases',async()=>{const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'sfeboot-device-guard-'));try{const source=path.join(tmp,'source.img');await fs.writeFile(source,Buffer.alloc(4096,9));await assert.rejects(simulateUsbBurn({image:source,destination:'/dev/disk4.img'}),/regular/);await assert.rejects(simulateUsbBurn({image:source,destination:path.join(tmp,'small.img'),capacityBytes:1}),/Capacity/);const dest=path.join(tmp,'abort.img');await assert.rejects(simulateUsbBurn({image:source,destination:dest},{signal:AbortSignal.abort()}),/cancelled/);await assert.rejects(fs.stat(dest),/ENOENT/);const alias=path.join(tmp,'alias.img');await fs.symlink(source,alias);await assert.rejects(simulateUsbBurn({image:source,destination:alias}),/EEXIST/);assert.equal((await fs.stat(source)).size,4096);}finally{await fs.rm(tmp,{recursive:true,force:true});}});
test('physical execution stays gated and system disk is rejected before device open',async()=>{await assert.rejects(burnMacUsb({plan:{},confirmation:'yes'}),/unqualified/);await assert.rejects(prepareBurn({image:'anything',device:'disk0'}),/disk0|macOS/);});
test('VSS script uses one owned ID with cleanup and rejects interpolation/traversal',()=>{const result=vssScript({volume:'c:\\',relativePath:'fixtures/probe.txt'});assert.equal(result.executed,false);assert.match(result.script,/Context='ClientAccessible'/);assert.match(result.script,/applicationConsistent=\$false/);assert.match(result.script,/Remove-CimInstance -InputObject \$item/);assert.match(result.script,/\$item.ID -ne \$createdId/);assert.match(result.script,/finally/);assert.match(result.script,/Get-FileHash -LiteralPath \$probe/);assert.doesNotMatch(result.script,/delete shadows|vssadmin|Invoke-Expression|Invoke-Command/);for(const args of [{volume:'C:\\;evil'},{volume:'C:\\',relativePath:'..\\secret'},{volume:'C:\\',relativePath:"a'; Remove-Item C:"},{volume:'C:\\',relativePath:'C:\\x'},{volume:'C:\\',relativePath:'folder.\\x'}])assert.throws(()=>vssScript(args));});

test('simulated source append during write is rejected and owned partial image removed',async()=>{const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'sfeboot-device-mutation-'));try{const source=path.join(tmp,'source.img'),dest=path.join(tmp,'usb.img');await fs.writeFile(source,Buffer.alloc(4096,7));let changed=false;const signal={get aborted(){if(!changed){appendFileSync(source,Buffer.from([8]));changed=true;}return false;}};await assert.rejects(simulateUsbBurn({image:source,destination:dest},{signal}),/Source changed/);await assert.rejects(fs.stat(dest),/ENOENT/);}finally{await fs.rm(tmp,{recursive:true,force:true});}});

test('IORegistry resolver ties a unique serial to exact whole BSD media ancestry',async()=>{
 const {resolveUsbIdentity}=await import('../lib/devices.mjs');
 const media={IOObjectClass:'IOMedia','BSD Name':'disk4',Whole:true,Size:device.TotalSize,IORegistryEntryName:device.IORegistryEntryName,IORegistryEntryID:21};
 const usb={IOObjectClass:'IOUSBHostDevice','USB Serial Number':device.SerialNumber,kUSBSerialNumberString:device.SerialNumber,idVendor:1165,idProduct:4660,IORegistryEntryID:20,IORegistryEntryChildren:[media]};
 const resolved=resolveUsbIdentity([usb],device);assert.equal(resolved.serial,device.SerialNumber);assert.equal(resolved.mediaRegistryId,21);
 assert.throws(()=>resolveUsbIdentity([{...usb,IORegistryEntryChildren:[{...media,'BSD Name':'disk5'}]}],device),/missing/);
 assert.throws(()=>resolveUsbIdentity([usb,usb],device),/ambiguous/);
 assert.throws(()=>resolveUsbIdentity([usb,{...usb,IORegistryEntryChildren:[]}],device),/not unique/);
 for(const patch of [{Size:1},{Whole:false},{IOObjectClass:'NotMedia'},{IORegistryEntryName:'Other'}])assert.throws(()=>resolveUsbIdentity([{...usb,IORegistryEntryChildren:[{...media,...patch}]}],device),/mismatch/);
 for(const patch of [{'USB Serial Number':'unknown',kUSBSerialNumberString:'unknown'},{kUSBSerialNumberString:'DIFFERENT'},{idVendor:undefined}])assert.throws(()=>resolveUsbIdentity([{...usb,...patch}],device));
 assert.throws(()=>resolveUsbIdentity([usb],{...device,SerialNumber:'CONFLICT'}),/conflict/);
});
test('IORegistry plist parser handles archive types without resolving entities',async()=>{
 const {parseRegistryPlist}=await import('../lib/devices.mjs');
 const value=parseRegistryPlist('<?xml version="1.0"?><!DOCTYPE plist PUBLIC "x" "https://never-fetch.invalid"><plist version="1.0"><array><dict><key>name</key><string>USB &amp; device</string><key>children</key><array><true/><false/><integer>123</integer><integer>18446744073709551615</integer><data>AA==</data><string/></array></dict></array></plist>');
 assert.equal(value[0].name,'USB & device');assert.deepEqual(value[0].children,[true,false,123,'18446744073709551615','AA==','']);
 assert.throws(()=>parseRegistryPlist('<plist><dict><key>a</key><true/><key>a</key><false/></dict></plist>'),/Duplicate/);
 assert.throws(()=>parseRegistryPlist('<plist><array><evil/></array></plist>'),/Unsupported/);
});

test('physical readback rejects invalid plans before opening a device',async()=>{
 const {exportUsbReadback}=await import('../lib/devices.mjs');
 await assert.rejects(exportUsbReadback({plan:{},destination:'/tmp/not-created.img'}),/Invalid readback plan|macOS/);
 await assert.rejects(exportUsbReadback({plan:{kind:'macos-usb-burn',schemaVersion:1,imageBytes:512,imageSha256:'a'.repeat(64),device:{device:'disk0'}},destination:'/tmp/not-created.img'}),/disk0|macOS/);
});
