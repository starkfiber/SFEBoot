# Headless Windows VSS testing

Use this reference when browser control is unavailable and testing is authorized on a disposable Windows VM. The demonstrated case provisioned a startup harness successfully; VSS execution did not occur because the Windows disk was still in first-run setup. Do not describe provisioning success as VSS qualification.

Before cloning for the test, establish that Windows setup is complete. A reported desktop can disagree with the persisted disk state: the observed disk had `SYSTEM\Setup\SystemSetupInProgress=1`, `OOBEInProgress=1`, and Panther logs launching `oobe\setup.exe`. No `started.txt` or acceptance log existed. Preserve this distinction; do not repeatedly boot the same pre-setup snapshot expecting the task to run.

Use an isolated child of a stable disk copy and private firmware variables. A hypervisor pause plus file clone is crash-consistent, not application-consistent. In the observed case, Linux NTFS mounting with `norecover` refused an unclean filesystem; it was not forced writable. Windows PE then handled the disposable copy with native filesystem semantics and installed a one-time local Group Policy startup task. Existing policy/harness files were refused. The original disk and credentials were preserved.

A real failure came from `call :main > COM1`: inability to open the output device prevented execution of the task itself. Separate task execution from reporting. Use a uniquely marked results disk and bounded receipt filenames when serial output is unavailable. Require exact post-run files, digest/provenance, test-result validation, owned startup-file cleanup and normal guest shutdown. Hypervisor exit0 after an explicit quit is not normal Windows shutdown.

The toolkit's `vm/collect-vss-evidence.mjs --directory EXTRACTED_RECEIPTS NEW_DIRECTORY` validates offline receipts and labels their transport separately. It does not prove guest execution by itself. Preserve failed attempts and do not fabricate serial frames or screenshots.

Microsoft documents the startup-file format in its [offline local Group Policy procedure](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/reset-local-password-without-agent). Only that mechanism was used; none of the account or password commands in that article were used. Setup/license/account steps remain separate user actions when required.
