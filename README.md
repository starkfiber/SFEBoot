# SFEBoot

MIT-licensed local image workbench by Stark Fiber Enterprise. [Try the workbench](https://starkfiber.my/boot) · [Roadmap](ROADMAP.md)

Version 0.7 adds browser SHA-256 hashing in bounded 4 MiB chunks and an installable offline workbench shell. ISO bytes are never uploaded. The CLI, loopback API, MCP server and Codex plugin share the local engine. Physical writing remains a separate, explicitly confirmed terminal operation. Linux distribution and Windows support is limited to the exact evidence in `docs/QUALIFICATION.json`; Arch and macOS installer support are roadmap items.


**Image engineering, from your terminal, browser connection, or AI tools.**

SFEBoot is an MIT-licensed toolkit for image engineering and evidence-based boot testing. Its CLI, authenticated local HTTP API and MCP server share one implementation. Qualified cases include the pinned ARM64 Alpine pair, Alpine x86_64 under UEFI and BIOS, one physical USB write/readback followed by QEMU boot of the recovered bytes, and Windows Server 2025 Setup-only USB boot with source-volume access. Complete Windows installation and VSS runtime remain unqualified; the physical writer is experimental. See the exact boundaries in [qualification](docs/QUALIFICATION.json).

## 0.6.1 usability update

The website starts with a task chooser and keeps advanced tools out of the main path. Local operations explain connection setup before they can run. The ARM64 USB workflow guides build, verified copy and boot test; results use plain-language status with expandable technical details. Disconnect and retry handling discard stale responses.

Windows VSS remains unqualified. The new offline receipt collector supports a headless test transport, but the recorded full Windows VM remained in first-run setup and never executed the VSS task. Read [VSS acceptance](vm/VSS.md) and the [headless lessons](skills/sfeboot/references/headless-vss.md) before retrying.

## Install and start

Requires Node.js 22 or later. From this source directory:

```sh
npm install -g .
sfeboot capabilities
sfeboot inspect /absolute/path/image.iso
sfeboot copy /absolute/path/image.iso /absolute/path/NEW-copy.img
sfeboot plan catalog.example.json
```

For boot recipes, install QEMU and xorriso separately. Windows media construction also needs mtools; splitting large installation WIM files requires wimlib-imagex. The full-ISO adapter currently uses macOS read-only hdiutil and APFS clonefile support. These tools and OS payloads are not bundled.

No npm package dependencies. The package is installable from source; publication to the npm registry is not claimed. You can use `node cli.mjs` instead of global installation.

### Convert disk images

Install QEMU using your platform's normal package manager. `qemu-img` must be on PATH, or set `SFEBOOT_QEMU_IMG` to its absolute executable path.

```sh
sfeboot convert source.raw NEW-disk.qcow2 qcow2 raw
sfeboot convert source.qcow2 NEW-disk.vhdx vhdx qcow2
```

Inputs: raw and self-contained, unencrypted qcow2. Outputs: raw, qcow2, vmdk and vhdx. Inputs with qcow2 backing references or incompatible features are rejected before QEMU runs. Other source container adapters, including multi-file VMDK and VHDX input, are not yet qualified.

Conversion first creates a stable private source snapshot. Allow free disk space for that snapshot plus the converted output. It then writes into a private temporary directory, compares guest-visible content with QEMU, rechecks the source hash and exclusively links the completed output into the new destination. Existing files are never overwritten. Use offline images that no other application is modifying. Operations trust the local account and filesystem; this is not a sandbox for hostile images or hostile concurrent filesystem mutation. Converting a container does not change CPU architecture, install drivers, make an OS bootable, or convert an installer ISO into a VM disk.

### Browser and HTTP API

```sh
SFEBOOT_TOKEN="your-random-secret-at-least-32-characters" sfeboot serve
```

The local API listens only on `127.0.0.1:47831`. Set `SFEBOOT_TOKEN` to a strong random secret of at least 32 characters before launch. Keep it private; the server never logs it. Open the printed local URL for the browser UI and enter the token in the connection form. `SFEBOOT_PORT` changes the port.

- `GET /api/capabilities` with `Authorization: Bearer TOKEN`
- `POST /api/tool` with the same authorization, `Content-Type: application/json`, and `{"name":"inspect_image","arguments":{"source":"/absolute/path/image.iso"}}`

Only one operation runs at a time. Additional operations receive 409. HTTP bodies are limited to 1 MiB; image data stays on disk and is not uploaded. Errors return JSON with an `error` field. Results return `{"result": ...}` except the capabilities endpoint, which returns the capability object directly.

By default, browser access is limited to the API's own local origin. To explicitly connect the SFEBoot website, start with `SFEBOOT_ALLOWED_ORIGIN=https://starkfiber.my`. The service still requires the token and validates the Host header. HTTPS-to-localhost access also depends on the browser's mixed-content and local-network permissions; support across all browsers is not claimed. No token belongs in a URL, website analytics or persistent browser storage. The public website cannot operate on local files until you start and connect this local service.

The HTTP API is a JSON API, **not an HTTP MCP transport**. MCP is provided over stdio below.

### MCP

Configure your MCP client with an absolute Node executable and the absolute CLI path:

```json
{
  "mcpServers": {
    "sfeboot": {
      "command": "node",
      "args": ["/absolute/path/sfeboot/cli.mjs", "mcp"]
    }
  }
}
```

Seventeen tools: `capabilities`, `inspect_image`, `copy_image`, `plan_multiboot`, `convert_image`, `proxmox_script`, `usb_build`, `usb_simulate`, `usb_verify`, `device_inventory`, `burn_prepare`, `vss_script`, `x86_usb_build`, `x86_usb_verify`, `windows_usb_build`, `windows_setup_build`, `windows_usb_plan`. The destructive physical writer is deliberately terminal-only and is not an MCP or HTTP tool. The stdio server negotiates protocol `2025-06-18`, requires initialization, and sends only JSON-RPC on stdout. It implements the tools subset; it does not advertise subscriptions, prompts, resources, authentication over stdio or remote access. Installing an MCP server authorizes it to use your local account's filesystem; use a client/workspace you trust.

### Proxmox script generation

```json
{"vmid":901,"name":"sfeboot-lab","imagePath":"/var/lib/vz/template/iso/disk.qcow2","memoryMiB":2048,"cores":2,"storage":"local-lvm","bridge":"vmbr0"}
```

Save as `proxmox.json`, then run `sfeboot proxmox proxmox.json`. The output contains a reviewable shell script to create a new VM and import an existing host image. SFEBoot does not SSH, run the script, start the VM, choose boot firmware, attach the imported disk automatically, or claim a successful Proxmox deployment. The script has not been executed on Proxmox. Review resource IDs, storage, network, guest architecture and firmware with your administrator.

## ARM64 USB boot lab

No USB drive is needed for this path. Install QEMU and xorriso on an ARM64 Mac, download the pinned Alpine virt inputs documented in [USB instructions](vm/USB.md), and run:

```sh
sfeboot usb-build alpine-virt-3.24.3-aarch64.iso alpine-virt-3.23.7-aarch64.iso NEW-usb.img
sfeboot usb-simulate NEW-usb.img NEW-written-usb.img
sfeboot usb-verify NEW-written-usb.img 3.24.3 NEW-proof-324
sfeboot usb-verify NEW-written-usb.img 3.23.7 NEW-proof-323
```

The writer uses streaming writes, flush and full readback. The verifier presents the written image to a QEMU XHCI USB mass-storage controller with `media=disk`, checks the exact guest release, USB driver/sysfs ancestry and mounted media, runs installer help, and requires clean shutdown. Both entries actually passed this pipeline. The image uses GPT/EFI hybrid layout and an ISO9660 filesystem; a filesystem type is distinct from the USB transport.

Qualification is the exact single-storage QEMU topology (`/media/sda`) on ARM64 macOS. It is not universal firmware support, persistence, arbitrary ISO support, or proof that physical USB hardware works. See [qualification summary](docs/QUALIFICATION.json).

### Physical burner and Windows VSS

`sfeboot devices` is read-only. `sfeboot burn-plan IMAGE.img diskN` prepares an expiring, digest- and device-bound plan for an eligible external removable USB. The separate `sfeboot burn PLAN.json EXACT_CONFIRMATION --experimental-hardware` command implements the raw writer and requires local macOS administrator execution. It refuses unknown identity/serial, mounted devices, internal disks and changed plans. One approved physical device passed image-prefix write/readback and captured-byte QEMU boot in this release. Stable USB serials are resolved through exact IORegistry media ancestry and checked against diskutil geometry and registry identity. Missing or ambiguous identity is rejected; do not weaken the checks to make a drive pass.

`sfeboot vss-script 'C:\' 'Users/you/Documents/example.txt'` generates a reviewable local Windows PowerShell probe. It creates one crash-consistent ClientAccessible snapshot, optionally hashes a file through its device path, and cleans up exactly its own ShadowID. It has not been executed on Windows here. It is not a full-volume backup, disk clone, persistent mounted snapshot or application-writer-coordinated VSS implementation. See [device/VSS operations](docs/DEVICES.md).

## Previous optical VM recipe

The `vm/` recipe retains the qualified ARM64 optical-image milestone: one real GRUB menu, Alpine 3.24.3 and 3.23.7 live environments, exact guest identity, installer help and clean shutdown in QEMU on Apple silicon macOS. It does not prove virtual USB, physical USB, x86, Apple hardware startup, Secure Boot, or an installed OS.

Download the two official Alpine ARM64 virt images separately; `vm/build.mjs` checks pinned SHA-256 values. Refer to [VM instructions](docs/VM.md). No OS or firmware binaries are included in this source distribution.

## Verify

```sh
npm ci
npm test
```

The core and catalog tests use temporary regular files. Website controller tests use the pinned jsdom development dependency (Node22.22.2+,24.15+ or26+); they exercise DOM workflows and a real local API file copy, not rendered browser layout. The new integration suite actually calls the MCP subprocess, exercises the authenticated HTTP API and converts synthetic disk images with QEMU. If `qemu-img` is absent, conversion is visibly skipped; it must be installed for a full conversion proof. Passing on one host does not establish cross-platform qualification.

## Current boundaries and roadmap

Implemented: file hashing, verified file-copy cloning, storage planning, offline container conversion, local API, stdio MCP and Proxmox script generation. Qualified cases include the ARM64 Alpine pair, Alpine x86_64 under UEFI and BIOS, one physical USB write/readback followed by virtual boot of captured bytes, and Windows Server 2025 Setup-only USB boot and source-volume access.

Next qualification work: broader physical USB hardware and physical-machine boot; disposable Windows NTFS VSS execution/cleanup; complete Windows installer media; independent Windows/Linux hosts; safe additional image adapters; reviewed Proxmox execution; native desktop packaging. The current physical writer and VSS probe are experimental, not certified working hardware/platform support. Protocols are versioned and evidence-backed; no promise of future-century compatibility.

## License

Original source, docs and website: MIT. [Third-party notices](THIRD_PARTY_NOTICES.md) cover separately installed/downloaded dependencies. Source licensing does not relicense generated OS images. See [contribution guidance](CONTRIBUTING.md) and [security notes](SECURITY.md).

## Agent skill

The reusable skill is `skills/sfeboot/SKILL.md`. Copy its enclosing `sfeboot` folder into your agent’s skills directory, then ask it to use SFEBoot. The skill describes measured operation boundaries, receipts and adapter qualification. It cannot remove model/provider limits.

## Website and artwork

The standalone lab is in `website/` and is served by `sfeboot serve`. Public launch: https://starkfiber.my/boot. The source ZIP is downloadable there. Original artwork provenance and prompt are in [ARTWORK.md](ARTWORK.md). The website is original code; no reference-site code or assets are bundled.

## PC boot lab (0.6)

```sh
sfeboot x86-usb-build /path/to/alpine-virt-3.24.3-x86_64.iso /path/to/new-x86.img
sfeboot x86-usb-verify /path/to/new-x86.img /path/to/new-uefi-proof uefi
sfeboot x86-usb-verify /path/to/new-x86.img /path/to/new-bios-proof bios
sfeboot windows-usb-build /path/to/windows.iso /path/to/new-windows.img EXPECTED_ISO_SHA256
sfeboot windows-usb-plan /path/to/new-windows.img /path/to/new-windows-proof
```

The pinned Alpine x86_64 image passed actual QEMU USB mass-storage boot with both UEFI and BIOS on this Apple-silicon host through CPU emulation. Exact-release, architecture, repository, boot arguments, USB driver/mount and clean shutdown are checked. Source image SHA-256: `86bd89b3aaf8a5b7cae4cc24dca201160790503ef4df57d9b58d5f90484cded1`. This does not establish Secure Boot or physical PC compatibility.

Windows media construction and interactive launch planning are separate from boot qualification. The full ISO builder uses a private APFS clone, read-only mounting, FAT32/GPT and WIM splitting; its complete-media path is experimental. Setup-only test media explicitly omits the installation payload and cannot install Windows. See [x86/Windows adapter details](vm/X86-WINDOWS.md). Windows VSS requires a full installed guest; [the acceptance fixture](vm/VSS.md) tests frozen content, generated-script success/failure, and owned snapshot cleanup. Preparing the fixture alone is not a VSS runtime pass.

`sfeboot windows-setup-build SETUP_ONLY_DIRECTORY NEW.img` exposes the explicit reduced-media builder. MCP/API equivalent: `windows_setup_build {directory,destination}`. It never includes installation payload; use only for a labelled Setup boot test.

## Physical USB write/readback qualification

A user-approved 134.2 GB USB device was written on macOS using the experimental terminal writer. All 187,039,744 image bytes were flushed and read back with the expected SHA-256; a separate raw-device capture matched again. Both Alpine ARM64 entries then booted from that captured file through QEMU USB storage. This is one-device write/readback evidence plus virtual boot of the actual recovered bytes. It is **not** a physical-PC boot test, a full-capacity flash test, a secure erasure, or universal hardware qualification. Bytes beyond the image prefix were retained. Device serials remain only in local evidence.

## Executed Windows Setup-only USB case

The actual `windows_setup_build` MCP tool produced a 1 GiB GPT/FAT32 image from official Windows Server 2025 evaluation boot files. QEMU UEFI booted it as USB mass storage into Windows Setup/WinPE 10.0.26100.32230. Guest diskpart confirmed Type USB, and `C:SFEBOOT` FAT32 removable healthy; guest file access read the 609,628,866-byte boot.wim. An initial ESP-only layout hid the volume; switching to Microsoft Basic Data fixed this, with a regression test and retained failed-case evidence.

The image deliberately omits install.wim. Setup still shows a missing-media/driver message, so this proves USB boot, mount and source-file access—not a usable complete installer, Windows installation, Windows 11 compatibility or VSS. The full-ISO and large-WIM splitting pathway remains experimental and unexecuted against full media.
