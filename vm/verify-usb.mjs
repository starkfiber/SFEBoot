#!/usr/bin/env node
import {verifyUsbBoot} from './usb.mjs';
const [image,version,outputDirectory]=process.argv.slice(2);
try{const r=await verifyUsbBoot({image,version,outputDirectory});console.log(JSON.stringify(r,null,2));if(!r.passed)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}
