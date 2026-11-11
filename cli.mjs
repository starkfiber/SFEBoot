#!/usr/bin/env node
import fs from 'node:fs/promises';
import {callTool,VERSION} from './lib/engine.mjs';
import {startMcp} from './lib/mcp.mjs';
import {startServer} from './lib/server.mjs';
const [command,...args]=process.argv.slice(2);const output=r=>console.log(JSON.stringify(r,null,2));
try{
 if(command==='mcp')startMcp();
 else if(command==='serve'){const session=await startServer({port:Number(process.env.SFEBOOT_PORT||47831)});console.error(`SFEBoot local API: ${session.url}\nUse your SFEBOOT_TOKEN value to connect. Tokens are never logged.\nSet SFEBOOT_ALLOWED_ORIGIN=https://starkfiber.my only to connect that website.\nStop with Ctrl+C.`);process.once('SIGINT',()=>session.server.close());process.once('SIGTERM',()=>session.server.close());}
 else if(command==='capabilities')output(await callTool('capabilities'));
 else if(command==='inspect')output(await callTool('inspect_image',{source:args[0]}));
 else if(command==='copy')output(await callTool('copy_image',{source:args[0],destination:args[1],...(args[2]?{expectedSha256:args[2]}:{})}));
 else if(command==='plan')output(await callTool('plan_multiboot',JSON.parse(await fs.readFile(args[0],'utf8'))));
 else if(command==='convert')output(await callTool('convert_image',{source:args[0],destination:args[1],format:args[2],inputFormat:args[3]}));
 else if(command==='proxmox')output(await callTool('proxmox_script',JSON.parse(await fs.readFile(args[0],'utf8'))));
 else if(command==='x86-usb-build')output(await callTool('x86_usb_build',{iso:args[0],destination:args[1]}));
 else if(command==='x86-usb-verify')output(await callTool('x86_usb_verify',{image:args[0],outputDirectory:args[1],...(args[2]?{firmware:args[2]}:{})}));
 else if(command==='windows-setup-build')output(await callTool('windows_setup_build',{directory:args[0],destination:args[1]}));
 else if(command==='windows-usb-build')output(await callTool('windows_usb_build',{iso:args[0],destination:args[1],expectedSha256:args[2]}));
 else if(command==='windows-usb-plan')output(await callTool('windows_usb_plan',{image:args[0],outputDirectory:args[1]}));
 else if(command==='usb-build')output(await callTool('usb_build',{newIso:args[0],oldIso:args[1],destination:args[2]}));
 else if(command==='usb-verify')output(await callTool('usb_verify',{image:args[0],version:args[1],outputDirectory:args[2]}));
 else if(command==='usb-simulate')output(await callTool('usb_simulate',{image:args[0],destination:args[1],...(args[2]?{capacityBytes:Number(args[2])}:{})}));
 else if(command==='devices')output(await callTool('device_inventory'));
 else if(command==='burn-plan')output(await callTool('burn_prepare',{image:args[0],device:args[1]}));
 else if(command==='burn'){if(args.length!==3||args[2]!=='--experimental-hardware')throw Error('Usage: sfeboot burn PLAN.json EXACT_CONFIRMATION --experimental-hardware');const {burnMacUsb}=await import('./lib/devices.mjs');const controller=new AbortController();const cancel=()=>controller.abort();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);try{output(await burnMacUsb({plan:JSON.parse(await fs.readFile(args[0],'utf8')),confirmation:args[1],experimentalHardware:true},{signal:controller.signal}));}finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}}
 else if(command==='vss-script')output(await callTool('vss_script',{volume:args[0],...(args[1]?{relativePath:args[1]}:{})}));
 else if(command==='--version')console.log(VERSION);
 else {console.log(`SFEBoot ${VERSION}\nUsage: sfeboot capabilities\n       sfeboot x86-usb-build ALPINE_X86.iso NEW.img\n       sfeboot x86-usb-verify IMAGE.img NEW_PROOF_DIR uefi|bios\n       sfeboot windows-setup-build SETUP_ONLY_DIRECTORY NEW.img\n       sfeboot windows-usb-build WINDOWS.iso NEW.img EXPECTED_SHA256\n       sfeboot windows-usb-plan IMAGE.img NEW_PROOF_DIR\n       sfeboot inspect SOURCE\n       sfeboot copy SOURCE NEW.img [SHA256]\n       sfeboot plan CATALOG.json\n       sfeboot convert SOURCE NEW_OUTPUT raw|qcow2|vmdk|vhdx raw|qcow2\n       sfeboot proxmox SPEC.json\n       sfeboot serve\n       sfeboot mcp\n       sfeboot usb-build NEW_ALPINE.iso OLD_ALPINE.iso NEW.img\n       sfeboot usb-simulate SOURCE.img NEW.img\n       sfeboot usb-verify IMAGE.img 3.24.3|3.23.7 NEW_PROOF_DIR\n       sfeboot devices\n       sfeboot burn-plan IMAGE.img DEVICE\n       sfeboot burn PLAN.json EXACT_CONFIRMATION --experimental-hardware\n       sfeboot vss-script VOLUME [RELATIVE_FILE]\nPhysical writer is experimental and terminal-only; one-device write/readback tested, physical-machine boot untested. VSS generates a script; Windows execution is unqualified.`);if(command&&!['--help','help'].includes(command))process.exitCode=1;}
}catch(e){console.error(e.message);if(e.targetMayBeIncomplete)console.error('Target may be partially overwritten. Do not use it as boot media until rewritten and verified.');process.exitCode=1;}
