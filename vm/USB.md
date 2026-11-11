# USB adapter

`usb.mjs` exports `buildUsbImage({newIso,oldIso,destination})` and `verifyUsbBoot({image,version,outputDirectory})`. CLI wrappers are `build-usb.mjs` and `verify-usb.mjs`. The same functions are used by SFEBoot's tool dispatcher.

The builder creates a new `.img` GPT/EFI hybrid image from checksum-pinned Alpine ARM64 3.24.3 and 3.23.7 sources. It uses private snapshots, does not overwrite existing targets, and requires space for snapshots/extraction/output. OS and bootloader components retain their original licenses. No OS payloads ship in the source distribution.

The verifier requires ARM64 macOS/HVF with QEMU and EDK2. The sole storage device is a read-only raw backing image attached to `qemu-xhci` + `usb-storage` with `media=disk` and `removable=on`. It observes the real menu and exact selected live environment, repository, modloop, USB sysfs ancestry, driver and mounted filesystem. Failure returns `passed:false`; CLI wrapper exits nonzero. No physical disk is selected or touched.

Qualified: two Alpine ARM64 live installer boots from virtual USB, including an image written/readback-verified through the regular-file burner simulation. Unqualified: physical hardware, multiple-storage discovery, x86/Windows/macOS installers, persistence, Secure Boot and OS installation. Fixed `/media/sda` paths are appropriate only for the tested single-device topology until a device-discovery adapter is qualified.
