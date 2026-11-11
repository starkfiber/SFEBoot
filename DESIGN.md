# SFEBoot guided interface — 0.6.1

The page starts with four plain-language tasks: check a small file, create a boot image, convert an image, and prepare a real USB. Existing artwork, SFE identity, dark navy surfaces and cyan/orange accents remain. The first working tool is a browser-only fingerprint check; its64MiB limit is visible before selection.

## Interaction decisions

- Eight engineering tabs remain accessible under More tools, rather than competing with the primary tasks.
- Local operations explain the connection requirement before the form. The setup block sits above tools and provides platform-specific install/start commands. Tokens are generated in the user's terminal, entered through a password field, kept only in JS memory and cleared on disconnect. No browser storage or token URLs.
- The ARM64 USB path has three steps: build, verified virtual copy, actual boot test. Only a successful operation advances; failed verification does not advance or imply success. Input paths are carried forward without starting the next operation automatically.
- Every result begins with a plain-language outcome and next step. Raw receipts and scripts are in a collapsed Technical details disclosure. Downloads remain available only for a current successful generation.
- Real USB planning uses inventory-derived eligible options, not free-form device identifiers. Unsupported hosts, no drives and ineligible drives have distinct empty states. The browser never performs physical erasure.
- Windows VSS remains an advanced, unqualified script workflow. Full Windows media and Setup-only testing retain separate limits. A prepared plan is not a VM boot result.
- Disconnect invalidates pending connections and operations. Per-result sequence guards prevent old results overwriting newer ones; per-button ownership prevents stale completions unlocking active work. Script downloads are cleared on disconnect/retry.

## Accessibility and fallback

Native buttons, labels and details provide keyboard access. Advanced tabs support arrows/Home/End; integration examples use simple pressed buttons. Task changes focus the selected-task heading. Status messages use live regions. Visible focus,44px controls, reduced-motion styles, wrapping layouts and320px CSS rules are retained. With JavaScript disabled, forms are hidden and a CLI download alternative is shown so sensitive form values cannot accidentally submit to the website.

## Verification scope

JS syntax and DOM behavior can be tested locally without browser-control permissions. The workflow test suite exercises real event handlers, async races, failed results, offline tools, guided transitions, device eligibility and an actual authenticated API copy. This release has no new rendered-browser visual or keyboard QA evidence while browser use is disabled in the session. CSS rules are not a substitute for measured320/390/768/1440px rendered layout checks.
