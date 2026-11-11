# Third-party components

The MIT license covers the original SFEBoot source code, documentation and website in this repository. This source distribution contains no operating-system images, GRUB binaries, firmware, QEMU, xorriso, mtools or wimlib binaries. It does not relicense them.

The optional VM recipe consumes separately downloaded Alpine Linux images and invokes locally installed tools:

| Component | Upstream licensing and source |
| --- | --- |
| Alpine Linux images | Multiple independently licensed packages; consult [Alpine packages](https://pkgs.alpinelinux.org/packages) and [aports source/build recipes](https://gitlab.alpinelinux.org/alpine/aports). |
| GNU GRUB | GPL-3.0-or-later; [GNU GRUB](https://www.gnu.org/software/grub/) and [Alpine recipe](https://gitlab.alpinelinux.org/alpine/aports/-/blob/3.24-stable/main/grub/APKBUILD). |
| QEMU | GPLv2 with component-specific terms; [QEMU license](https://www.qemu.org/docs/master/about/license.html). |
| EDK2 firmware | Component-specific license notices supplied by the firmware distribution; [EDK2 source](https://github.com/tianocore/edk2). |
| xorriso | GPLv2-or-later; [libburnia project](https://www.gnu.org/software/xorriso/). |
| mtools | GPL-3.0-or-later for the invoked tools; [GNU mtools](https://www.gnu.org/software/mtools/). Separately installed, not bundled. |
| wimlib-imagex | GPL-3.0-or-later for the invoked program; component-specific terms apply to libraries; [wimlib](https://wimlib.net/). Separately installed, not bundled. |
| Microsoft Windows / Windows Server media | Proprietary Microsoft evaluation or product terms apply. Obtain media from [Microsoft](https://www.microsoft.com/en-us/evalcenter/download-windows-server-2025); no Microsoft binaries or license rights are included in this MIT source release. |

The builder preserves Alpine's boot chain and remasters its media. A generated ISO is therefore **not an MIT-only artifact**. Anyone redistributing generated images must satisfy the upstream licenses, notices and applicable corresponding-source obligations for the exact redistributed components. This repository supplies a source-only release, not a compliance-qualified binary ISO release.

The pinned SHA-256 values establish matching downloaded bytes. No GPG signature verification is implemented. There is no affiliation with Alpine, GNU, QEMU, Apple, Microsoft or balena.

Windows Setup-only test images and full installer images remain Microsoft media, not MIT artifacts. Evaluation access does not establish redistribution permission. The public release contains source and receipts without OS payloads.

Development-only dependency: jsdom30.1.3 (MIT), installed separately through the pinned npm lockfile for DOM workflow tests. Its transitive packages retain their own licenses. Installed dependencies are not bundled in the source ZIP or global runtime package.
