# ARM64 optical VM recipe

On Apple silicon macOS, install QEMU and xorriso. The builder also requires ISO-capable bsdtar (macOS `/usr/bin/tar` supports this).

Download official sources:
- https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/aarch64/alpine-virt-3.24.3-aarch64.iso
- https://dl-cdn.alpinelinux.org/alpine/v3.23/releases/aarch64/alpine-virt-3.23.7-aarch64.iso

```sh
node vm/build.mjs alpine-virt-3.24.3-aarch64.iso alpine-virt-3.23.7-aarch64.iso NEW-master.iso
node vm/verify-boot.mjs NEW-master.iso 3.24.3 proof-3.24
node vm/verify-boot.mjs NEW-master.iso 3.23.7 proof-3.23
```

Tools resolve through PATH. Optional overrides are MASTER_USB_TAR, MASTER_USB_XORRISO, MASTER_USB_QEMU and MASTER_USB_FIRMWARE (retained legacy names for recipe compatibility). The firmware override points to QEMU's edk2-aarch64-code.fd.

The recipe checks publisher SHA-256 values, not GPG signatures. Original qualified image SHA-256: b83266e4f48d163074dde3b6a908aba764a4db794be719731706ec81adb28d7a. Rebuild timestamps can change the digest. Both original boots were executed; no promise of bit-for-bit reproducibility.

The bootloader menu retains the original Master USB lab name so evidence remains attributable. The new SFEBoot interfaces wrap this independently qualified lab recipe; renaming a menu is not new boot proof.
