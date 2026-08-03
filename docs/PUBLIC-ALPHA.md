# Public alpha contract

Status: public source alpha 0.4.9, August 3, 2026.

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
- Consultants and agencies may pilot mpai commercially when the client owns or
  explicitly controls the host environment, tailnet membership, invite, and
  session-sharing decision. The public alpha is not yet enterprise-certified.

## Installation

Install with Homebrew, then let one command finish the machine setup:

```bash
brew install godfaddaai/tap/mpai
mpai setup --name Alex
```

It must configure identity, find the tailnet address, install the always-on
service, discover available providers, and print one clear next action.
The GitHub install remains available for machines without Homebrew:

```bash
npm install --global https://github.com/godfaddaai/multiplayer-ai/releases/download/v0.4.9/multiplayer-ai-0.4.9.tgz
```

Homebrew can refuse every formula before mpai runs when Apple's Command Line
Tools are outdated. Update them through System Settings, or use the exact npm
fallback above when Node.js 20+ is already installed.

An invited teammate can start from a completely fresh install. `mpai join`
creates their attributed local identity, stores the peer credential outside
config, installs their host service on macOS, checks shared-session readiness,
and prints the exact attach command.

## Implemented in 0.4.9

- Provider-neutral Codex and Claude Code discovery and transcript reading.
- Exact Claude Code resume and a Codex App Server integration.
- Live terminal rooms, named prompts, streaming output, presence, session
  switching, search, and reconnect notices.
- A ten-second peer connection/response-header deadline that becomes a
  privacy-safe `PEER_UNREACHABLE` error with exact wake, Tailscale, and host
  service recovery steps without timing out an established prompt stream.
- Managed Codex authentication and provider failures stay scoped to the active
  turn instead of emitting Node's process-fatal `error` event and crashing the
  host service.
- An automatic-mode host that temporarily fell back to standalone Codex now
  promotes itself back to the managed daemon before a remote prompt when the
  managed socket returns. If promotion fails, standalone prompting remains
  blocked by default.
- Viewer and participant roles, Tailscale identity binding, invite revocation,
  idempotency, one remote prompt per task, and an append-only audit trail.
- Private-by-default new invites. The server hides unshared titles,
  transcripts, presence, audit events, and prompt routes even when a caller
  knows an exact task ID.
- Selected-session and intentional all-session sharing.
- One-command macOS service setup and provider-aware health checks.
- One-command Homebrew installation and macOS Keychain-backed peer tokens,
  including automatic migration from the legacy inline format.
- Fresh-install invite bootstrap and peer-specific attributed identity.
- Setup's printed next step creates an explicit participant invite with
  selected-session sharing, so the safest collaboration path does not
  accidentally strand a new team in view-only mode.
- A stable service launcher path that survives package/runtime upgrades, plus
  a doctor check for the reachable host version.
- `mpai support-bundle`: mode-0600, metadata-only diagnostics that exclude
  prompts, transcripts, identities, credentials, paths, task metadata, and
  network addresses.
- `mpai alpha-receipt`: an explicit, local-only, mode-0600 cohort receipt with
  activation elapsed minutes, collaboration counts, active days/weeks, and
  provider reliability. It sends nothing and excludes prompts, transcripts,
  names, task identifiers, paths, credentials, network addresses, and event
  timestamps.
- Per-peer credential backend routing and a mode-0600 file fallback when a
  non-interactive macOS host cannot access Keychain.
- Live 0.4.0 → 0.4.4 Hudson upgrade proof: initial Keychain failure left the
  old service intact; fallback migration removed the inline token, preserved
  reciprocal access, and produced a redacted mode-0600 support receipt.
- Live 0.4.4 → 0.4.5 public-asset upgrades on Reagan and Hudson: both services
  restarted with matching doctor receipts, Hudson's shadowing 0.4.0 shell
  launcher was replaced, and reciprocal session reads remained intact.
- Live 0.4.5 → 0.4.6 public-asset upgrades on Reagan and Hudson: both services
  restarted with matching 0.4.6 doctor receipts, reciprocal session reads
  remained intact, and each host produced a local mode-0600 alpha receipt that
  was not transmitted.
- Live 0.4.6 → 0.4.7 public-asset upgrades on Reagan and Hudson: both services
  restarted with matching 0.4.7 doctor receipts and reciprocal session reads
  remained intact.
- Live 0.4.7 → 0.4.8 public-asset upgrades on Reagan and Hudson: both services
  restarted with matching 0.4.8 doctor receipts and reciprocal session reads
  remained intact.
- Live 0.4.8 → 0.4.9 public-asset upgrades on Reagan and Hudson: both services
  restarted with matching 0.4.9 doctor receipts and reciprocal session reads
  remained intact.
- A disposable Hudson → Reagan managed-Codex prompt reproduced an expired-token
  failure after the attributed turn reached the native transcript. On 0.4.8,
  the replay returned the actionable auth error while the host PID and both
  peers' read access remained unchanged.
- The exact public 0.4.8 release asset matched SHA-256
  `78eb0d4e6f3c5cdc9d3149472fb28719857d7df83d91bb92083a0a5abf8f1af5`,
  installed into an isolated prefix, and reported 0.4.8 from both binaries.
- The exact public 0.4.9 release asset matched SHA-256
  `83c230402a7a1d10defee9f1a869dd1141ba569278cca201979b408a70847fb5`,
  installed into an isolated prefix, and reported 0.4.9 from both binaries.
- Clean macOS 26 and Linux runners installed the exact 0.4.9 Homebrew formula,
  executed 0.4.9, passed its formula test, uninstalled it, and verified both
  CLI links were absent afterward in run 30794006889.
- On the public 0.4.9 artifact, Hudson's managed Codex daemon stopped while the
  mpai service PID stayed unchanged and shared reads fell back safely. After
  the daemon returned, Reagan's next named remote prompt promoted that same
  service back to managed proxy and completed without reinstall or rejoin.
- Disposable public-artifact lifecycle proof: install 0.4.4, preserve configured
  state while rolling back to 0.4.3, recover forward to 0.4.4, then uninstall
  the package with both installed binaries removed and state retained.
- A 100-cycle local HTTP server/client soak covering attach, attributed turn,
  transcript read, and leave. All message/event order, unique IDs, teammate
  authorship, presence cleanup, and 200 audit records remained correct.
- A deterministic one-host/two-teammate HTTP proof using two isolated simulated
  tailnet identities. Per-invite visibility, simultaneous named presence,
  same-task prompt collision, unaffected-peer continuity, and revocation pass;
  a physical third-Mac receipt remains open.
- Packaged 0.4.9 installs on two separate Macs with matching live services.
- Live cross-Mac proof that one teammate can list another's separate Codex and
  Claude Code sessions, open a real Claude Code transcript, and send an
  attributed Reagan prompt from one Mac into Hudson's existing session.

## Public-alpha exit gates

### P0: must close

1. **Safe active Codex attachment on every supported Codex surface.** Standalone
   sessions are view-only by default. We need a documented managed-daemon path
   for each supported surface rather than imply every active session is safely
   writable.
2. **Complete distribution (current 0.4.9 proof).** The public GitHub source, versioned release, and
   Homebrew tap are available, and services launch through the stable installed
   CLI instead of a versioned package source or Node executable. Service
   stop/remove/reinstall is live-verified. Public release-asset rollback and
   full package uninstall are disposable-prefix verified. The supported Node 22
   Homebrew formula installs, executes, tests, and uninstalls on clean macOS and
   Linux, with both installed CLI links verified absent afterward.
3. **Credential storage (closed in 0.4.4).** Peer bearer tokens live in macOS
   Keychain when available. Non-interactive hosts fall back to a mode-0600
   local store, config retains only a routed reference and non-secret metadata,
   and legacy inline tokens migrate on first load.
4. **Two-way provider certification.** Run harmless attributed prompt receipts
   in both directions for Claude Code and managed Codex, with the native
   transcript visible on the host.
5. **Lifecycle reliability.** Certify laptop sleep/wake, Wi-Fi changes, tailnet
   relay changes, provider restarts, partial transcript writes, duplicate
   events, and service upgrades while a room is open.
6. **Three-person concurrency.** The real-server/two-client protocol proof now
   covers presence, prompt collision, revocation, and per-invite sharing.
   Complete the gate with one physical host plus two teammate devices.
7. **Redacted diagnostics (closed in 0.4.3).** `mpai support-bundle` includes
   versions, service/provider health, aggregate task/audit counts, and
   categorized recent failures without tokens or transcript contents.
8. **Release identity and policy.** The public name, repository, MIT license,
   contribution policy, responsible disclosure path, privacy notice, and
   acceptable-use policy exist. The [preliminary name screen](./NAME-SCREEN.md)
   found material adjacent use of the uppercase MPAI acronym in AI standards;
   qualified trademark clearance remains required before a hosted organization
   control plane.

### P1: should close

- Automatic update notification without silent mutation.
- Friendly teammate-offline and no-shared-session recovery instructions.
- Session pinning and explicit titles.
- The local review-before-sharing alpha receipt is implemented; automatic
  opt-in collection remains open.
- A short guided demo that creates a disposable shared QA session.

## Alpha acceptance gates

- Ten clean installs by people who did not build the product.
- Median install-to-first-shared-room time under five minutes for an existing
  tailnet user.
- 100 attach/read/leave cycles with no leaked, duplicated, or reordered human
  messages. This protocol gate is closed by the deterministic local soak;
  physical network transitions remain part of lifecycle certification.
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
The local `mpai alpha-receipt` covers the machine-verifiable subset without
automatic collection. Install-to-room time and context-transfer value remain
self-reported in the first-10-team cohort.
