import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {vssScript} from '../lib/vss.mjs';
const destination=process.argv[2];
if (!destination) throw Error('Usage: node vm/prepare-vss-probes.mjs NEW_DIRECTORY');
const root=path.resolve(destination);
await fs.mkdir(root); // Refuse existing outputs.
for (const [name,relativePath] of [['vss-probe.ps1','SFEBootVssFixture/probe.txt'],['vss-missing-file.ps1','SFEBootVssFixture/missing.txt']]) {
  await fs.writeFile(path.join(root,name),vssScript({volume:'C:\\',relativePath}).script,{flag:'wx'});
}
for (const name of ['vss-acceptance.ps1','vss-export.ps1']) await fs.copyFile(fileURLToPath(new URL(name,import.meta.url)),path.join(root,name));
console.log(JSON.stringify({destination:root,executed:false,scope:'Prepared guest probes only; Windows runtime proof requires acceptance run'},null,2));
