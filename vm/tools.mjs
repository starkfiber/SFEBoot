import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const variables = {tar:'MASTER_USB_TAR',xorriso:'MASTER_USB_XORRISO','qemu-system-aarch64':'MASTER_USB_QEMU'};
export function tool(name, env=process.env) {
  if (!variables[name]) throw Error('Unknown tool: '+name);
  return env[variables[name]] || name;
}
export function firmware(env=process.env) {
  let candidates = [env.MASTER_USB_FIRMWARE];
  if (!env.MASTER_USB_FIRMWARE) {
    try { candidates.push(path.join(execFileSync('brew',['--prefix','qemu'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(),'share/qemu/edk2-aarch64-code.fd')); } catch {}
    const qemu=env.MASTER_USB_QEMU;
    if(qemu && path.isAbsolute(qemu)) candidates.push(path.resolve(path.dirname(qemu),'../share/qemu/edk2-aarch64-code.fd'));
  }
  for(const candidate of candidates.filter(Boolean)) {
    try { if(fs.statSync(candidate).isFile()) return fs.realpathSync(candidate); } catch {}
  }
  throw Error('ARM64 EDK2 firmware not found. Set MASTER_USB_FIRMWARE to edk2-aarch64-code.fd from your QEMU installation.');
}
