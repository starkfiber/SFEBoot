# USB acceptance learned from real execution

Qualified image SHA-256: 881b9042429aa1356cdd1ecfee31da2cf5bfc84bebfa630a42a4c2d8fb7f969d, 187,039,744 bytes. Build pinned Alpine 3.24.3/3.23.7 ARM64 inputs, stream-write a new image-backed USB, flush/read back, boot each entry through QEMU virt/HVF + XHCI + usb-storage with media=disk. Both passed, read-only VM media, no host or install-target disks.

Require guest `usb-storage` driver and sysfs USB ancestry for the actual source device, exact `/dev/sda` mount at `/media/sda`, exact selected userspace/repository/modloop, installer-help output, normal poweroff, zero QEMU exit, and unchanged image digest. Checking version text anywhere in a transcript can accidentally accept echoed commands. An unrelated mount row is not proof that the boot source is USB. Unsupported selectors must fail before launching.

Independently validate protective MBR, both GPT header/table CRCs, EFI loader and original payload hashes. Filesystem remains ISO9660, while firmware and guest see USB mass storage; do not label it CD-ROM because of its filesystem. A larger physical target may need GPT adjustment; this has not been qualified. More disks can change enumeration and break fixed /media/sda paths.

The first builder cleanup failed because extracted ISO directories were read-only. Only the private owned temporary tree is made writable for cleanup; never chmod arbitrary user inputs. Preserve inputs and completed outputs, exclusively publish new image paths, and reject existing targets. Check temp cleanup on missing tools and failure.

Virtual transport proves that virtual hardware path only. A separate, explicitly authorized physical USB write/readback test subsequently passed, and both ARM64 entries booted from the captured bytes in QEMU. This does not establish physical-computer boot. Windows VSS script generation tests do not prove snapshot creation or cleanup on Windows. Keep those qualification rows separate.

## 0.6 x86 lessons

The pinned Alpine 3.24.3 x86_64 hybrid image passed real USB boot under both UEFI and BIOS on ARM64 macOS QEMU TCG. EDK2 must be supplied as separate read-only CODE and private writable VARS pflash drives; the initial single `-bios` invocation did not boot successfully. CPU emulation is slower than native HVF.

Use token boundaries for selector and modloop command-line checks. Independent review demonstrated false positives with `sfeboot_entry=3.24.30` and a `modloop-virt-WRONG` suffix; both must fail. Attach child listeners before awaiting evidence writes so a missing executable cannot cause an unhandled error or orphan. A missing-QEMU test now preserves a failed receipt and reports child exit.

Device discovery must match exact BSD IOMedia identity through USB IORegistry ancestry, then require matching capacity, registry name and a unique stable serial. Product name and USB port alone are insufficient. Include registry-instance identity so unplug/replug invalidates an existing burn plan. Keep exact device serials in local receipts, not public source.

## Windows volume visibility regression

The first Windows Setup-only GPT image booted its EFI loader and WinPE but used a single EFI System Partition, which WinPE did not expose as a normal source volume. Actual diskpart evidence showed USB transport but no volumes. Changing the partition type to Microsoft Basic Data while retaining FAT32 and `/EFI/BOOT/BOOTX64.EFI` preserved UEFI boot and exposed `C: SFEBOOT`, FAT32, Removable, Healthy. Require firmware boot, guest USB type, normal volume enumeration and source-file access as separate gates. An empty default CD-ROM device is not the USB source. The reduced image has no installation payload; Setup still reports missing media, so no complete-installer or installation claim follows from this test.
