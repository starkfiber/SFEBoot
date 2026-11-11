import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUsbProof} from '../vm/usb.mjs';
const proof=(version='3.24.3')=>`SFEBOOT_PROOF_BEGIN\n${version}\n6.18.58-0-virt\n/media/sda${version==='3.23.7'?'/versions/'+version:''}/apks\nconsole=ttyAMA0 sfeboot_entry=${version} modloop=/media/sda${version==='3.23.7'?'/versions/'+version:''}/boot/modloop-virt\nUSB_SYSFS=/sys/devices/platform/4010000000.pcie/pci0000:00/0000:00:01.0/usb1/1-1/1-1:1.0/host0/target0:0:0/0:0:0:0\nUSB_DRIVER=usb-storage\nUSB_MOUNT=/dev/sda /media/sda iso9660 ro,relatime 0 0\n/sbin/setup-alpine\nusage: setup-alpine [options]\nSFEBOOT_PROOF_END\n`;
test('exact USB guest receipts accept both selected userspaces',()=>{for(const v of ['3.24.3','3.23.7'])assert.equal(parseUsbProof(proof(v),v).passed,true);});
test('optical or unrelated mounted media cannot qualify USB boot',()=>{
 for(const text of [proof().replace('/usb1/','/pci1/'),proof().replace('USB_MOUNT=/dev/sda ','USB_MOUNT=/dev/sr0 '),proof().replace(' /media/sda iso9660',' /media/other iso9660'),proof().replace(' iso9660 ro,',' tmpfs ro,')])assert.equal(parseUsbProof(text,'3.24.3').passed,false);
});
test('wrong userspace, repository, selector and incomplete markers fail',()=>{
 for(const text of [proof().replace('3.24.3\n6.18','3.23.7\n6.18'),proof().replace('/media/sda/apks','/media/cdrom/apks'),proof().replace('sfeboot_entry=3.24.3','sfeboot_entry=3.23.7'),proof().replace('SFEBOOT_PROOF_END','not complete')])assert.equal(parseUsbProof(text,'3.24.3').passed,false);
 assert.equal(parseUsbProof(proof('9.99.9'),'9.99.9').passed,false);
});
test('an echoed command containing a selected release is not guest proof',()=>{assert.equal(parseUsbProof("localhost:~# printf 'SFEBOOT_PROOF_BEGIN\\n'; echo 3.24.3; echo 'USB_SYSFS=/usb1/'; echo SFEBOOT_PROOF_END\n",'3.24.3').passed,false);});
