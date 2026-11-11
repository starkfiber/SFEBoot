#!/usr/bin/env node
import {buildUsbImage} from './usb.mjs';
const [newIso,oldIso,destination]=process.argv.slice(2);
try{console.log(JSON.stringify(await buildUsbImage({newIso,oldIso,destination}),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
