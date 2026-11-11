# SFEBoot interface contract 0.6

The JSON API and stdio MCP call the same `callTool` dispatcher in `lib/engine.mjs`. Input schemas are discoverable through MCP `tools/list`; the engine validates operation arguments and rejects unknown top-level fields. Error content never signifies successful operation.

MCP implements the tools subset of protocol 2025-06-18. Protocol references:
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle

QEMU command reference: https://www.qemu.org/docs/master/tools/qemu-img.html
Proxmox command reference: https://pve.proxmox.com/pve-docs/qm.1.html

Operations are synchronous per request. There are no durable jobs, resumable transfers, streaming progress, cancellation protocol or shared server tenants in this version. The CLI conversion timeout is 30 minutes and terminates its owned qemu-img process on expiry. The caller must rerun a failed operation with a new destination after reviewing errors; never silently retry a write.

A success receipt proves only its stated scope: matching bytes for file-copy, matching guest-visible content for format conversion, arithmetic for storage planning, generated text for a Proxmox script. None proves a guest OS is bootable. The ARM64 and x86_64 VM recipes supply actual boot evidence only for their recorded CPU, firmware and media combinations.

USB build/simulation/verify share the same CLI/MCP/API dispatcher. `usb_verify` returns `passed:false` for a failed proof and preserves its evidence; never treat a completed JSON response as a successful boot. Physical `burnMacUsb` is not in tools/list or HTTP dispatch. Device plan/inspection and VSS script generation are exposed, but cannot execute a physical write or Windows snapshot.

PC tools: `x86_usb_build {iso,destination}`, `x86_usb_verify {image,outputDirectory,firmware?}` (uefi or bios), `windows_usb_build {iso,destination,expectedSha256}` and `windows_usb_plan {image,outputDirectory}`. A Windows launch plan returns `executed:false,status:planned` without claiming pass/fail for a VM that has not run. A failed verifier receipt is also MCP `isError:true`. Windows full ISO input requires an explicit trusted digest; separately prepared Setup-only media must declare its missing installation payload.

`windows_setup_build {directory,destination}` (CLI `windows-setup-build DIRECTORY NEW.img`) is explicitly Setup-only test media. It rejects source trees containing installation payload. It cannot complete Windows installation.
