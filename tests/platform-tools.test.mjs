import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {callTool,tools} from '../lib/engine.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'sfeboot-platform-'));
const image=path.join(root,'fixture.img');await fs.writeFile(image,Buffer.alloc(4096,7));
test('platform dispatcher rejects incompatible firmware and incorrect publisher input',async()=>{
 await assert.rejects(callTool('x86_usb_verify',{image,outputDirectory:path.join(root,'bad'),firmware:'secureboot'}),/Invalid argument/);
 await assert.rejects(callTool('x86_usb_build',{iso:image,destination:path.join(root,'x86.img')}),/checksum/);
 if(process.platform==='darwin')await assert.rejects(callTool('windows_usb_build',{iso:image,destination:path.join(root,'windows.img'),expectedSha256:'0'.repeat(64)}),/checksum/);
 assert.deepEqual((await fs.readdir(root)).sort(),['fixture.img']);
});
test('public platform tools cannot invoke a physical writer or VSS execution',async()=>{
 for(const name of ['physical_write','burn_execute','vss_execute','usb_readback'])await assert.rejects(callTool(name,{}),/Unknown tool/);
 assert.ok(tools.some(t=>t.name==='windows_usb_plan'));
 assert.ok(tools.some(t=>t.name==='x86_usb_verify'));
});
test.after(()=>fs.rm(root,{recursive:true,force:true}));
