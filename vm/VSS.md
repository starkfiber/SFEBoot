# Windows VSS VM acceptance

Run on a disposable **fully installed Windows VM**, with Windows PowerShell 5.1, administrator rights, NTFS `C:\`, and a functioning VSS provider. WinPE installer boot is a different acceptance case. This fixture does not prove a backup/restore product or application-writer consistency.

Prepare the guest scripts on the host:

```sh
node vm/prepare-vss-probes.mjs /new/guest-probes
```

Transfer the directory using a read-only ISO or another explicitly selected local transfer method. In an elevated Windows PowerShell console, run:

```powershell
& 'D:\vss-acceptance.ps1' -EvidenceDirectory 'C:\SFEBootVssEvidence-001'
```

Use the actual CD drive letter. The evidence directory and `C:\SFEBootVssFixture` must not already exist. Review the scripts before execution. If local execution policy requires changes, do not silently weaken it; use the host's approved script-signing or execution workflow.

The fixture records Windows version/build/architecture and generated probe hashes. It owns a sentinel `ClientAccessible` shadow, changes the live fixture, and checks the sentinel retains the old bytes. It then executes the generated SFEBoot probe, requires the new file hash, tests a missing-file error with successful snapshot cleanup, checks the sentinel and all pre-existing shadows survived, deletes only its own sentinel and fixture, and compares the final shadow IDs to the initial baseline. `result.json.passed` and `cleanupVerified` must both be true, alongside the raw success and failure receipts. Keep these receipts with VM configuration, media provenance, and a visible runtime screenshot.

`ownership.json` journals the exact sentinel ID for interruption recovery. Production probes also return their owned IDs. Process termination can bypass `finally`: never bulk-delete shadows, and do not call a run successful when evidence or cleanup is missing. Test source generation alone does not qualify Windows VSS runtime.

Microsoft documents `ClientAccessible` as a persistent context without application-writer coordination; the adapter deliberately makes no application-consistency claim. See [Win32_ShadowCopy.Create](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/vsswmi/create-method-in-class-win32-shadowcopy) and [shadow copy contexts](https://learn.microsoft.com/en-us/windows/win32/vss/shadow-copy-context-configurations).

## Export receipts without networking

After the acceptance command finishes, run the accompanying exporter in the guest:

```powershell
& 'D:\vss-export.ps1' -EvidenceDirectory 'C:\SFEBootVssEvidence-001'
```

It sends only six predefined receipt/log filenames, each at most64KiB, to the VM's COM1 serial device. Configure the emulator with a local serial-file backend; no guest network or host directory sharing is required. The envelope contains original file bytes and SHA-256 digests between explicit markers. On the host:

```sh
node vm/collect-vss-evidence.mjs /path/to/serial.log /new/evidence-directory
```

The collector refuses existing output directories, unexpected filenames, duplicate members and digest mismatches, and verifies expected fixture hashes, raw success/failure cleanup, baseline shadow IDs and the exact generated probe hashes. A valid envelope is a consistency check, not independent attestation: retain the matching real VM configuration, source provenance and visible runtime screenshot. Missing or failed guest tests remain failed, even when some receipts were exported successfully.

## Offline receipt transport

When guest serial reporting is unavailable, a separately attached, uniquely marked results disk can carry the same six receipt files. Shut the guest down normally before read-only extraction. Retain the VM invocation, provisioning record, results-disk digest, exact extraction paths, and startup-task cleanup record with the extracted files. Do not infer test execution from a successful VM exit or from provisioning files alone.

```sh
node vm/collect-vss-evidence.mjs --directory /path/to/extracted-receipts /new/evidence-directory
```

This uses the same semantic checks as serial collection and labels the transport `offline-receipt-files`. It rejects symlinked or oversized receipt files. Matching hashes alone are not runtime attestation. A headless run needs a documented chain from the executed guest to the recovered results; it does not require a simulated UI screenshot.
