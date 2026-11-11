# x86 USB boot and Windows media adapters

The x86 Alpine adapter accepts only Alpine virt 3.24.3 x86_64 with SHA256 `cdc1bc0efc64d8d611bf3733f54868172a545888dfd726f518bf279bcb0ff1af`. It rewrites GRUB and Syslinux serial boot configuration while retaining the upstream hybrid EFI/BIOS boot structure. Actual QEMU TCG tests passed on ARM64 macOS with both non-Secure-Boot UEFI and legacy BIOS. The guest had one attached storage device: QEMU XHCI USB mass storage, mounted read-only at `/media/sda`.

Exports in `x86-usb.mjs`:

- `buildX86UsbImage({iso,destination})`: new regular `.img`, verifies pinned source and private snapshot, no physical writes.
- `verifyX86UsbBoot({image,outputDirectory,firmware:'uefi'|'bios'})`: new evidence directory; returns actual exact-release, architecture, repository, command-line tokens, USB driver/sysfs/mount, installer-help and clean-process evidence. `passed:false` means failure. Requires QEMU x86, and EDK2 code+variables for UEFI. The variables file is copied to the evidence directory; original firmware is never changed.

Environment overrides: `SFEBOOT_QEMU_X86`, `SFEBOOT_X86_FIRMWARE`, `SFEBOOT_X86_VARS`. Defaults locate Homebrew or Linux OVMF firmware; distro packaging may need an explicit matching CODE/VARS pair. This version was executed only with Homebrew EDK2 on macOS, not every distro package.

## Windows builder and interactive proof

`buildWindowsUsbImage({iso,destination,expectedSha256})` accepts a caller-selected local Windows ISO and an explicit expected digest. This digest is an integrity pin supplied by the caller, not independent proof of publisher authenticity. It currently requires macOS read-only `hdiutil` mounting and APFS clonefile support for a private source snapshot. `mtools` formats a GPT Microsoft Basic Data partition as FAT32 and copies files; `wimlib-imagex` splits an oversized `sources/install.wim` into sub4GiB `.swm` members. The source ISO is never altered and a final image is published only after source verification. Source binaries retain Microsoft licenses and must not be bundled in the MIT source release.

`buildWindowsSetupImage({directory,destination,bootOnly:false})` is the lower-level directory adapter. It rejects symlinks, missing boot components and missing installation payload. Explicit `bootOnly:true` accepts a reduced Setup test tree without an install payload. Such an image can prove entry into Windows Setup/WinPE, but **cannot complete Windows installation**. It is not a substitute for full installation media and must remain labelled accordingly.

`planWindowsUsbBoot({image,outputDirectory})` returns `status:'planned'` and `executed:false`, a private firmware-variable preparation step, and QEMU arguments for an interactive Cocoa display, USB storage, no network and no install target. It never launches or claims a pass. Before a boot claim, execute the plan, observe Windows Setup, inspect the guest's USB storage, save evidence, terminate only the owned guest and verify unchanged source digest. Stop at license acceptance; do not autonomously accept it or claim a completed installation.

The Windows full ISO path and large WIM splitting remain experimental until executed against complete media. Synthetic FAT32/GPT tests establish layout/copy behavior only. Secure Boot, arbitrary Windows editions, physical Windows boot and completed Windows installations are separate qualifications.

## Upstream references

- [Microsoft: install Windows from a USB flash drive](https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/install-windows-from-a-usb-flash-drive?view=windows-10): FAT32 file-size limit and splitting installation WIM files.
- [Microsoft: Windows Server 2025 evaluation downloads](https://www.microsoft.com/en-us/evalcenter/download-windows-server-2025): source of the selected evaluation installer.
- [QEMU: USB emulation](https://www.qemu.org/docs/master/system/devices/usb.html): XHCI controller and USB storage device model.
- [Alpine x86_64 release files](https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/x86_64/): pinned Linux fixture and publisher checksum.

## Executed reduced Windows fixture (2026-11-03)

The local qualification fixture used 68 unmodified files read over normal HTTPS from Microsoft's Windows Server 2025 evaluation ISO build 26100.32230. It excluded `sources/install.wim` deliberately; the ISO was not downloaded in full and no full-ISO publisher digest was established. The 609,628,866-byte `boot.wim` has recorded SHA256 `10dc2c95b3ab050474ca7a33efa6208737bb7c39a779203abf3dd0118b9ecffb`. `wimlib-imagex verify` verified metadata and file data for both WIM images; the optional whole-WIM integrity table was absent, which is recorded rather than treated as a publisher signature.

The first1GiB fixture used a GPT EFI System partition. Firmware loaded its EFI bootloader and Windows Setup/WinPE ran, but the guest showed a USB disk with no mounted volumes and Setup reported missing media. That is a failed Windows media-layout qualification, not merely an effect of omitting install.wim. The first artifact (SHA256 `2b32f00bc2e7ed5ce599514665d67ebe247c1fd80b4644c58c4f96ec441d9e40`) remains failure evidence.

The builder was corrected to use a GPT **Microsoft Basic Data** FAT32 partition with the standard `/EFI/BOOT/BOOTX64.EFI` removable-media fallback. A regression test asserts the partition type GUID. The corrected image was built through the real MCP dispatcher (SHA256 `a11e82265c28971d88de97e964606073d6b3ebd801a688b6d87c0263e7403d07`) with the same68 original files, each read back and SHA-256 verified. It booted Windows Server Setup/WinPE10.0.26100.32230 through QEMU USB; guest DiskPart confirmed `Type: USB` and `C: SFEBOOT FAT32 Removable 1022MB Healthy`. The guest could read `C:\sources\boot.wim` (609,628,866bytes), explicitly reported `install.wim` missing, and shut down normally with the image digest unchanged. This confirms the formerly hidden-volume failure was fixed. Independent review checked both GPT CRCs, Basic Data type and exact EFI/WIM readback. The evidence includes the old failure and the corrected guest-volume screenshot; construction checks alone were insufficient.

Both fixtures deliberately exclude the installation payload. Setup still displayed the missing-media message after the volume fix; it remains a separate reduced-media limitation, not a passed full-installer workflow. The images cannot complete an OS installation and must not be labelled complete Windows installers. Guest USB-detail screenshots, final shutdown and unchanged source digest belong in the external run receipt.
