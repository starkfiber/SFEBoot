---
name: sfeboot
description: Inspect, copy and convert offline disk-image files, plan multiboot capacity, generate reviewed Proxmox import scripts and build and prove USB boot paths using SFEBoot CLI or MCP.
---

# SFEBoot

Use the installed `sfeboot` command or run `node cli.mjs` from its source distribution. Start with `sfeboot capabilities`; discover MCP schemas through `tools/list` when connected. Read [the operation contract](references/operations.md) for argument shapes and result interpretation.

Prefer a direct MCP tool when available; otherwise use the CLI with argument arrays, never constructed shell commands containing user paths. The local HTTP API is an alternate transport, not a public remote execution service. Keep its bearer token in process memory, out of URLs, logs and browser storage.

## Match the operation to the evidence

- Inspect returns a streaming SHA-256 receipt; it cannot establish bootability or publisher authenticity.
- Clone means a verified copy between regular files. Existing destination files and device paths are rejected.
- Convert uses QEMU on offline raw or self-contained unencrypted QCOW2 inputs. Supported output containers are raw, QCOW2, VMDK and VHDX. Preserve room for the private source snapshot plus output. Logical-content comparison is distinct from boot qualification.
- Proxmox produces a script for review. It does not connect to a server, choose guest firmware automatically or start a VM. Review the selected host, new VM ID, storage and network before separately authorized execution.
- The USB recipe now qualifies two pinned Alpine ARM64 live installer environments after file-backed burn/readback through actual QEMU USB mass storage on macOS. Use `usb_build`, `usb_simulate`, then `usb_verify` for each entry. Require exact release, repository, USB driver/sysfs ancestry/mount, installer help, clean shutdown and unchanged image. A GPT/EFI hybrid with ISO9660 filesystem can be a real USB disk transport; do not confuse filesystem type with device transport. The tested topology has one attached storage device and fixed `/media/sda` paths. Read [USB acceptance](references/usb-acceptance.md) before extending it.

Treat tool output as evidence with a scope. Record input digests, host and guest architecture, tool versions, selected adapter, output identity, exact success/failure and cleanup. A method is reusable only within its measured assumptions. Keep failures and corrections in project-owned continuity.

## Extend deliberately

For a new adapter, consult its current upstream specification, define capabilities and unsupported cases, then test file-backed or disposable VM fixtures before physical devices. Preserve existing successful adapters and test new behavior independently. Never infer permission to erase a drive or run a remote script from a general request to improve the project.

The macOS raw writer is experimental, terminal-only, and qualified only for one-device image-prefix write/readback and subsequent QEMU boot of captured bytes. MCP/HTTP expose inventory and planning, never the destructive operation. Require an explicit user-selected disposable target, stable identity/serial, exact current plan confirmation, unmounted eligibility and separate experimental opt-in. Do not weaken missing-serial rejection. Windows VSS currently generates a ClientAccessible acceptance probe with exact-owned-snapshot cleanup; no Windows execution has been proved. Never call that a verified backup or application-consistent snapshot system. Keep host OS, guest OS, CPU, firmware, Secure Boot, storage layout and boot method separate in qualification records. Future-proofing means versioned contracts and migration tests, not promising support for unknown protocols.

The original SFEBoot source is MIT. Generated OS images retain upstream component licenses. Do not place third-party installer binaries or host secrets in the source release. SFE/Moontek project material stays in project-owned storage; do not write it to Kanika Memory or retained shared jobs.

## x86 and Windows evidence

Use `x86_usb_build` then `x86_usb_verify` separately for `uefi` and `bios`. The pinned Alpine 3.24.3 x86_64 adapter has actual QEMU USB proof for both. UEFI uses matching CODE and an owned copy of VARS firmware; do not modify the shared firmware template. Require exact command-line tokens: substring matches can falsely accept a different release or boot-file path.

Use `windows_usb_build` only with a trusted local ISO and explicit expected SHA256. The digest proves selected bytes, not the publisher by itself. `windows_usb_plan` generates a reviewed local launch plan with no installation target or network; it does not launch the VM or prove boot. Keep full installer media separate from an explicitly reduced Setup-only test image: the latter lacks install payload and cannot complete OS installation. Never automatically accept Windows license terms or create account credentials through the UI.

For VSS runtime qualification, use the supplied full-Windows VM acceptance fixture. Require frozen snapshot content despite live-file mutation, generated probe success, missing-file failure with cleanup, preservation of a separately owned sentinel and pre-existing snapshots, and exact final snapshot IDs. WinPE boot is not a VSS acceptance case. Keep legal/account handoffs and unverified runtime outcomes explicit.

For browser-independent Windows testing, read [headless VSS lessons](references/headless-vss.md). Startup-harness provisioning has been demonstrated, but first-run Windows setup prevented VSS execution. Use the offline receipt collector only with a matching execution/provenance record. Never turn a successful provisioning step into a successful-test label.
