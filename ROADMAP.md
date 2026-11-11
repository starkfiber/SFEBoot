# SFEBoot development track

- [x] MIT source, CLI, local bearer-authenticated API and read-only/planning MCP device tools.
- [x] Pinned Alpine ARM64 and x86 virtual USB qualification receipts documented.
- [x] Bounded-memory browser SHA-256 worker and local-only PWA shell.
- [ ] Arch Linux adapter: pin publisher digest/signature, inspect layout, test x86 UEFI/BIOS independently.
- [ ] Additional Linux distributions: one reviewed adapter and fixture matrix per release family.
- [ ] Full Windows installer qualification; current Setup-only proof is not installation proof.
- [ ] macOS installer adapter; do not equate macOS host support with macOS boot support.
- [ ] Signed companion installers and native Windows/Linux physical write qualification.

## Product standard
Never call a hash a boot test. Never call a plan a completed write. Never upload ISO contents to a hosted website. Keep physical erasure outside MCP/HTTP and require explicit disposable-target approval. Publish architecture/firmware/host distinctions, failures and cleanup evidence. We aim to exceed ordinary flashing tools in auditability and agent integration; no blanket claim of being better than Etcher or supporting every distro.

## Codex plugin
Install Node 22+, then `npm install -g .` from this source. Add this directory as a local Codex plugin using its manifest; its MCP command expects `sfeboot` on PATH. Alternatively configure a stdio MCP command `sfeboot` with argument `mcp`. No service credentials are embedded. The bundled skill defines operation limits. Plugin import itself still depends on the host’s supported installation flow.
