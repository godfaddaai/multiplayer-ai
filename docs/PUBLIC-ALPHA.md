# Public alpha contract

Status: public source alpha 0.4.1, August 2, 2026.

## Product promise

Install once, run `mpai @teammate`, and join an explicitly shared Codex or
Claude Code session with its existing context. Both people keep their normal AI
tool and every human prompt carries a durable identity.

The public alpha is terminal-first. It is not a browser product, replacement
IDE, raw shell-sharing tool, employee-monitoring product, or hosted transcript
warehouse.

## Initial customer

- Mac-based, AI-native software teams with 2–10 active collaborators.
- At least one Codex or Claude Code user on each side.
- A shared Tailscale network.
- A concrete need to pair, unblock, hand off, review, or steer work already in
  progress inside an agent session.

## Installation

Install directly from GitHub, then let one command finish the machine setup:

```bash
npm install --global github:reaganroo22/multiplayer-ai
mpai setup --name Alex
```

It must configure identity, find the tailnet address, install the always-on
service, discover available providers, and print one clear next action.
Homebrew distribution remains the target for the next release:

```bash
brew install mpai/tap/mpai
mpai setup --name Alex
```

## Implemented in 0.4.1

- Provider-neutral Codex and Claude Code discovery and transcript reading.
- Exact Claude Code resume and a Codex App Server integration.
- Live terminal rooms, named prompts, streaming output, presence, session
  switching, search, and reconnect notices.
- Viewer and participant roles, Tailscale identity binding, invite revocation,
  idempotency, one remote prompt per task, and an append-only audit trail.
- Private-by-default new invites. The server hides unshared titles,
  transcripts, presence, audit events, and prompt routes even when a caller
  knows an exact task ID.
- Selected-session and intentional all-session sharing.
- One-command macOS service setup and provider-aware health checks.
- Packaged 0.4 installs on two separate Macs.
- Live cross-Mac proof that one teammate can list another's separate Codex and
  Claude Code sessions, open a real Claude Code transcript, and send an
  attributed Reagan prompt from one Mac into Hudson's existing session.

## Public-alpha exit gates

### P0: must close

1. **Safe active Codex attachment on every supported Codex surface.** Standalone
   sessions are view-only by default. We need a documented managed-daemon path
   for each supported surface rather than imply every active session is safely
   writable.
2. **Complete distribution.** The public GitHub source and versioned release are
   available. Add a Homebrew tap, upgrade command, rollback path, and uninstall
   verification.
3. **Credential storage.** Move peer bearer tokens from a mode-0600 JSON file to
   macOS Keychain; keep only references and non-secret metadata in config.
4. **Two-way provider certification.** Run harmless attributed prompt receipts
   in both directions for Claude Code and managed Codex, with the native
   transcript visible on the host.
5. **Lifecycle reliability.** Certify laptop sleep/wake, Wi-Fi changes, tailnet
   relay changes, provider restarts, partial transcript writes, duplicate
   events, and service upgrades while a room is open.
6. **Three-person concurrency.** Dogfood one host plus two teammates, including
   presence, prompt collision, revocation, and per-invite sharing.
7. **Redacted diagnostics.** Add `mpai support-bundle` with versions, health,
   recent structured errors, and no tokens or transcript contents.
8. **Release identity and policy.** The public name, repository, MIT license,
   contribution policy, and responsible disclosure path exist. Complete a
   trademark check, privacy notice, and acceptable-use policy before a hosted
   organization control plane.

### P1: should close

- Automatic update notification without silent mutation.
- Friendly teammate-offline and no-shared-session recovery instructions.
- Session pinning and explicit titles.
- Opt-in, metadata-only alpha telemetry for activation and reliability.
- A short guided demo that creates a disposable shared QA session.

## Alpha acceptance gates

- Ten clean installs by people who did not build the product.
- Median install-to-first-shared-room time under five minutes for an existing
  tailnet user.
- 100 attach/read/leave cycles with no leaked, duplicated, or reordered human
  messages.
- Zero access to an unshared session across list, direct read, presence, audit,
  and prompt tests.
- Every remote prompt shows the correct human in both `mpai` and the provider's
  native transcript.
- A denied tool approval remains denied and is visibly reported.
- Sleep/wake and provider restart recover without reinstalling or rejoining.
- Revocation takes effect on the next request.

## Alpha learning metrics

- Team activation: first teammate joined and first session shared.
- Time to first room and time to first named teammate prompt.
- Weekly teams with at least three room opens.
- Percentage of room opens followed by a human message.
- Repeat pairing across more than one session and more than one provider.
- Self-reported context-transfer time avoided.
- Reliability by provider, transport, and reconnect reason.

No transcript contents should be collected for product analytics.
