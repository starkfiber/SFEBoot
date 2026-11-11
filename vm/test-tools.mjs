import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {tool,firmware} from './tools.mjs';
assert.equal(tool('xorriso',{}),'xorriso');
assert.equal(tool('xorriso',{MASTER_USB_XORRISO:'/custom/xorriso'}),'/custom/xorriso');
assert.throws(()=>tool('unknown',{}),/Unknown tool/);
assert.throws(()=>firmware({MASTER_USB_FIRMWARE:'/nonexistent/master-usb-firmware'}),/firmware not found/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'master-usb-tools-'));
try {const file=path.join(dir,'firmware.fd');fs.writeFileSync(file,'fixture');assert.equal(firmware({MASTER_USB_FIRMWARE:file}),fs.realpathSync(file));}
finally {fs.rmSync(dir,{recursive:true,force:true});}
console.log(JSON.stringify({passed:5,scope:'tool and firmware resolution'}));
