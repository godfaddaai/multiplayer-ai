# Changelog

All notable project changes are documented here.

## [0.4.2] - 2026-08-02

Launch-readiness hardening.

### Added

- One-command installation through `brew install godfaddaai/tap/mpai`.
- macOS Keychain storage for joined-peer bearer tokens.
- Automatic migration of legacy inline peer tokens into Keychain.

### Changed

- Sharpen the product promise around cross-person, named collaboration rather
  than same-account remote control.
- Keep credential references and non-secret peer metadata in `config.json`.

### Proven

- Round-tripped a disposable credential through macOS Keychain and deleted it.
- Installed the tagged npm artifact into an isolated prefix and verified both
  `mpai` and `multiplayer-ai` report the release version.

## [0.4.1] - 2026-08-02

Launch-proof patch.

### Added

- `mpai show @peer SESSION_ID --tail N` for focused transcript reads.

### Fixed

- Suppress duplicate Claude output when the CLI emits both streamed deltas and
  a final assistant message.
- Correct public package metadata to the live GitHub repository and Pages URL.

### Proven

- Sent a named Reagan prompt from one Mac into Hudson's existing Claude Code
  session over Tailscale; Claude received the teammate label and answered in
  the exact session.

## [0.4.0] - 2026-08-02

First public alpha.

### Added

- Terminal-native <code>mpai @teammate</code> room.
- Codex and Claude Code session discovery and transcript reading.
- Attributed remote prompts in supported provider modes.
- Session list, search, switch, presence, refresh, and reconnect behavior.
- Viewer and participant roles.
- Identity-bound invitations and revocation.
- Private-by-default selected-session sharing.
- One remote prompt at a time per task and idempotency protection.
- Append-only prompt audit trail.
- macOS background service setup and health checks.

### Known limits

- macOS and Tailscale are required.
- Standalone Codex mode is view-only by default.
- Peer tokens are mode-<code>0600</code> files pending Keychain support.
- Homebrew distribution and large-team certification are not complete.
