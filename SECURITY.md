# Security policy

mpai is an early public alpha that exposes explicitly shared local AI coding
sessions to trusted teammates over an existing Tailscale network.

## Supported versions

Only the newest prerelease receives security fixes.

| Version | Supported |
|---|---|
| 0.4.x | Yes |
| Earlier | No |

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability.

Use the repository's
[private vulnerability reporting](https://github.com/godfaddaai/multiplayer-ai/security/advisories/new)
flow. Include:

- affected version and commit;
- operating system, Node.js version, and provider mode;
- the smallest safe reproduction;
- expected and observed authorization behavior;
- whether a token, transcript, account, or device identity may have been
  exposed.

Do not include a real invite URL, raw token, unredacted transcript, tailnet
address, or personal account identifier. We will acknowledge a complete report
as soon as practical and coordinate disclosure after a fix is available.

## Current trust boundary

- Tailscale authenticates the connecting network user and device.
- An mpai invite authorizes a role and binds to the first Tailscale identity
  that uses it.
- New invites default to selected-session access.
- The host remains the source of truth for task access.
- The host stores only a SHA-256 hash of issued invite tokens.
- The peer currently stores its raw token in a mode-<code>0600</code> config
  file. Moving it to macOS Keychain is an open alpha gate.
- The service has no arbitrary shell, task deletion, archival, or remote
  approval endpoint.
- Codex approvals from remote turns are declined.
- Claude remote turns use <code>dontAsk</code>; operations that require an
  interactive permission prompt are denied.
- The optional diagnostic web view binds to loopback and does not receive raw
  peer tokens.

## Not yet certified

The alpha is not yet security-certified for large organizations, regulated
workloads, untrusted collaborators, shared OS accounts, hostile local users, or
public-internet exposure. Do not bypass Tailscale or bind the collaboration
service to a public interface.
