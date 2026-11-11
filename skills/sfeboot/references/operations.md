# SFEBoot 0.6 operation contract

CLI:

```sh
sfeboot capabilities
sfeboot inspect /absolute/path/source.iso
sfeboot copy /absolute/path/source.iso /absolute/path/new-copy.img
sfeboot plan catalog.json
sfeboot convert /absolute/path/disk.raw /absolute/path/new.qcow2 qcow2 raw
sfeboot proxmox reviewed-spec.json
sfeboot mcp
```

MCP tools: `capabilities {}`, `inspect_image {source}`, `copy_image {source,destination,expectedSha256?}`, `plan_multiboot {capacityBytes,images,reserveBytes?,overheadPercent?}`, `convert_image {source,destination,inputFormat,format}`, `proxmox_script {vmid,name,imagePath,memoryMiB?,cores?,storage?,bridge?}`. Read actual schemas before constructing a request. CLI copy uses positional arguments; optional expected digest is available through the API/MCP tool.

Local API: `sfeboot serve`, default `http://127.0.0.1:47831`. Set a random `SFEBOOT_TOKEN` of at least 32 characters in the launching environment. Authenticated `GET /api/capabilities`; `POST /api/tool` with JSON `{name,arguments}` and `Authorization: Bearer …`. Requests from a public site require explicit exact `SFEBOOT_ALLOWED_ORIGIN=https://starkfiber.my` and browser network permission. The local browser URL avoids cross-origin dependence. No token belongs in a client configuration committed to source.

A failed operation must be reported as failed even if it produced a log or partial receipt. Do not automatically retry writes. Resolve the cause and use a new destination. Keep output and evidence together without including personal host paths in public releases.

Future adapters should add an explicit capability ID, schema, preconditions, failure/cleanup contract and executable test cases. Reject unknown schema fields; expose unsupported combinations. Durable jobs, resumability, VM import execution, VSS and raw device writers require their own implementation and tests.

USB tools: `usb_build {newIso,oldIso,destination}`, `usb_simulate {image,destination,capacityBytes?}`, `usb_verify {image,version,outputDirectory}`. Each file/folder destination must be new. A verify receipt with `passed:false` is a failure even when the transport completed.

Device/VSS tools: `device_inventory {}`, `burn_prepare {image,device}`, `vss_script {volume,relativePath?}`. They inspect/plan/generate only. The raw physical writer is a separately confirmed terminal operation, not a callable MCP tool.

PC tools: `x86_usb_build {iso,destination}`; `x86_usb_verify {image,outputDirectory,firmware?}` with `uefi` (default) or `bios`; `windows_usb_build {iso,destination,expectedSha256}`; `windows_usb_plan {image,outputDirectory}`. CLI equivalents: `x86-usb-build ISO NEW.img`, `x86-usb-verify IMAGE NEW_PROOF_DIR uefi|bios`, `windows-usb-build ISO NEW.img SHA256`, `windows-usb-plan IMAGE NEW_PROOF_DIR`. A Windows plan is generation only. Never interpret `executed:false,status:planned` as a successful boot.

`windows_setup_build {directory,destination}` (CLI `windows-setup-build DIRECTORY NEW.img`) is explicitly Setup-only test media. It rejects source trees containing installation payload. It cannot complete Windows installation.
