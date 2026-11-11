# Contributing to SFEBoot

Keep changes scoped, document their supported host/guest/firmware combination, and attach reproducible evidence. Run `npm ci` to install the pinned test dependencies, then `npm test` with QEMU installed for conversion checks and mtools for Windows FAT32 layout/readback checks. Missing optional tools can cause skips; record them instead of describing that run as full qualification. Actual boot and Windows VSS acceptance are separate executed workflows, not implied by the source test suite. Never commit image payloads, credentials, device identifiers, user disk contents or private infrastructure records.

New format adapters must reject external dependencies unless they are explicitly reviewed and contained. New writers must start with disposable image files and virtual devices. Physical-disk operations require a separate design and exact target confirmation; do not weaken the existing regular-file boundary.

A protocol, generated script or configured CI workflow is not proof that a platform works. Preserve failed test cases and qualify the repaired behavior. Add the license and source obligations for any newly redistributed third-party component.

Contributions to the original project code are licensed under MIT. No project data belongs in Kanika Memory or retained shared compute jobs.

Website controller tests use jsdom (Node22.22.2+,24.15+ or26+) without a real browser. They cover task navigation, stale request/disconnect handling and a form-to-real-API file-copy integration. They do not establish rendered layout, browser local-network permission behavior, firmware boot or Windows VSS runtime.
