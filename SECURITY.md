# Security boundary

SFEBoot runs with its launching user's permissions. Only use trusted, offline disk images; QEMU parsers and filesystems are not a security sandbox. The local MCP/HTTP engine runs without administrator privileges and exposes no physical-device writer or arbitrary command execution tool. The separate, explicitly confirmed macOS physical burner requires administrator execution; never run the HTTP or MCP service as root.

The HTTP service binds IPv4 loopback, requires a bearer token, validates Host and browser Origin, and accepts small JSON requests. Do not reverse-proxy it publicly. An allowed origin plus token authorizes regular-file reads and new-file writes under your local account. No filesystem root jail or per-operation confirmation system is implemented. A bearer token is not a license to expose this endpoint on a LAN.

MCP uses local stdio and the client's account permissions. Configure it only in trusted clients. Do not place sensitive paths, tokens, disk contents or exploit payloads in public issues. A private vulnerability-reporting channel must be configured by the repository owner before soliciting sensitive reports.

Physical macOS burning is experimental and terminal-only, bound to an expiring image/device plan. Stable IORegistry identity and unmounted eligibility are mandatory; an identity mismatch requires a new reviewed plan. Physical disk cloning and remote hypervisor execution are unavailable. VSS scripts can create and delete a Windows snapshot only when separately executed locally by an administrator. Generated scripts and VM launch plans do not imply successful execution. Current support line: 0.6.x experimental.
