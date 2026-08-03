# Public alpha contract

Status: public source alpha 0.4.18, August 3, 2026.

## Product promise

Install once on the host, paste once on the teammate Mac, and join an
explicitly shared Codex or Claude Code session with its existing context. Both
people keep their normal AI tool and every human prompt carries a durable
identity.

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

Install and enter the guided host setup with one pasted command:

```bash
brew install godfaddaai/tap/mpai && mpai start
```

It must configure identity, find the tailnet address, install the always-on
service, discover available providers, and print one clear next action.
The GitHub install remains available for machines without Homebrew:

```bash
npm install --global https://github.com/godfaddaai/multiplayer-ai/releases/download/v0.4.18/multiplayer-ai-0.4.18.tgz && mpai start
```

Homebrew can refuse every formula before mpai runs when Apple's Command Line
Tools are outdated. Update them through System Settings, or use the exact npm
fallback above when Node.js 20+ is already installed.

An invited teammate with Node.js 20+ can start without a global install. The
recommended `npx` handoff creates their attributed local identity, stores the
peer credential outside config, checks shared-session readiness, and, when the
invite is scoped to one session, opens that ready room from the same pasted
command. It uses `--no-service`, so the guest gains no hosting capability and
no LaunchAgent. The invite also prints the permanent Homebrew path for a
teammate who intentionally wants to host sessions back. Older, empty, or
multi-session invites still print the exact next command.

## Implemented in 0.4.18

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
- A teammate disconnect now cancels the exact provider turn and releases the
  per-session prompt lock. Codex uses App Server's supported `turn/interrupt`;
  Claude terminates the exact resumed CLI child. Claude also terminates a turn
  after two minutes without stdout or stderr progress instead of holding the
  room until the 30-minute overall deadline.
- Bearer authorization parsing is length-bounded and accepts only the
  base64url alphabet used by generated invites, preventing ambiguous
  attacker-controlled regular-expression work before authentication.
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
- A session-scoped invite can atomically grant access to one explicit session,
  removing the separate post-invite share command without broadening access.
- One-command macOS service setup and provider-aware health checks.
- One-command Homebrew installation and macOS Keychain-backed peer tokens,
  including automatic migration from the legacy inline format.
- Fresh-install invite bootstrap and peer-specific attributed identity.
- A session-scoped invitation leads with one version-pinned `npx` command that
  enters the room without a global package install or background host service;
  the permanent Homebrew path remains available underneath.
- A guided `mpai start --name HOST --with TEAMMATE` host flow verifies a fresh
  host, presents its native sessions for explicit selection, creates a private
  participant invite for exactly one session, and prints that same guest paste.
  Non-interactive use fails closed unless `--session` is explicit.
- Setup's printed next step lists sessions and creates an explicit participant
  invite already scoped to the chosen session, so the safest collaboration
  path is immediately useful without broadening access.
- A stable service launcher path that survives package/runtime upgrades, plus
  a doctor check for the reachable host version.
- `mpai support-bundle`: mode-0600, metadata-only diagnostics that exclude
  prompts, transcripts, identities, credentials, paths, task metadata, and
  network addresses.
- `mpai alpha-receipt`: an explicit, local-only, mode-0600 cohort receipt with
  locally measured invite-to-first-room elapsed minutes, collaboration counts,
  active days/weeks, and provider reliability. A successful authorized room
  read stores its first timestamp locally once; the receipt exposes only elapsed
  minutes. It sends nothing and excludes prompts, transcripts,
  names, task identifiers, paths, credentials, network addresses, and event
  timestamps.
- `mpai cohort-report`: a local preview of fixed-choice cohort metadata. It
  sends nothing by default; `--submit` requires an authenticated GitHub CLI
  and interactive confirmation, while automation must also pass `--yes`.
  Arbitrary self-report text is rejected before the public comment boundary.
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
- Live 0.4.9 → 0.4.10 public-asset upgrades on Reagan and Hudson: both services
  restarted with matching 0.4.10 doctor receipts and reciprocal session reads
  remained intact.
- Live 0.4.10 → 0.4.11 public-asset upgrades on Reagan and Hudson: both services
  restarted with matching 0.4.11 doctor receipts and reciprocal session reads
  remained intact without rejoining or changing the existing share state.
- Live 0.4.11 → 0.4.12 public-asset upgrades on Reagan and Hudson: both services
  restarted with matching 0.4.12 doctor receipts and reciprocal session reads
  remained intact without rejoining or changing the existing share state.
- Live 0.4.12 → 0.4.13 public-asset upgrades on Reagan and Hudson: both services
  restarted with matching 0.4.13 doctor receipts. Hudson retained access to
  Reagan; Reagan's missing local Hudson credential was replaced by a newly
  claimed participant invite with the prior trusted all-session scope, the
  stale invite was revoked, and reciprocal session reads passed again.
- The exact public 0.4.13 release asset matched SHA-256
  `4f32501188f3d0ec54fd99627bf454785c5d1305680e8fe2deb869f1ae212b7c`,
  installed into an isolated prefix, and reported 0.4.13 from both binaries and
  a separate clean-cache `npx` execution. Homebrew test-bot run 30815017446
  passed install, test, and uninstall on macOS 26 and Linux.
- The exact public 0.4.14 release asset matched SHA-256
  `41b3f52819859c817bbe066703c708f3eaed8907e80471adf99a61c1c8a8e096`,
  installed into an isolated prefix, exposed the guided `mpai start` command,
  and reported 0.4.14 from both binaries and a separate clean-cache `npx`
  execution. Homebrew test-bot run 30816937134 passed install, test, and
  uninstall on macOS 26 and Linux.
- Reagan and Hudson installed that exact public 0.4.14 artifact, restarted on
  matching provider-aware endpoints, and retained reciprocal session reads.
- The exact public 0.4.15 release asset matched SHA-256
  `5d444f115324013e24cdc317a2b05407c9f249c596a7f9085176c62bf9eec523`,
  installed into an isolated prefix, and reported 0.4.15. Homebrew test-bot run
  30818547957 passed install, test, and uninstall on macOS 26 and Linux.
- Reagan and Hudson installed that exact public 0.4.15 artifact, restarted on
  matching provider-aware endpoints, and retained reciprocal session reads.
  A live Hudson → Reagan Claude prompt was disconnected after acceptance; the
  exact resumed child disappeared and the audit recorded `prompt.failed`.
- The exact public 0.4.16 release asset matched SHA-256
  `2e5a464497319166e9f44510ab186f950122a35dad2c1a1b15037e9feb96966b`,
  installed into an isolated prefix, reported 0.4.16, and exposed
  `cohort-report`. Homebrew test-bot run 30819579277 passed install, test, and
  uninstall on macOS 26 and Linux.
- Reagan and Hudson installed that exact public 0.4.16 artifact, restarted on
  matching provider-aware endpoints, and retained reciprocal session reads.
  Reagan previewed a fixed-choice report locally, then explicitly submitted
  exactly that preview to issue #7. A preceding public label marks it as
  founder dogfood excluded from the 0/10 non-founder cohort.
- The exact public 0.4.18 release asset matched SHA-256
  `3d2ccd6391815b41147b3b79ef228c9375e7aa6cc5143e04bb1fe41990cfc6bb`,
  installed from GitHub on Reagan and Hudson, and restarted as matching 0.4.18
  endpoints. Reciprocal session reads passed. Homebrew test-bot run 30822829094
  passed install, test, and uninstall on macOS 26 and Linux.
- A fresh timing-aware, selected-session viewer invite joined from isolated
  state on Hudson and completed its first authorized Reagan room read in 0.07
  minutes. The local receipt exposed only elapsed minutes and a count; both
  disposable proof invites were revoked. Pre-0.4.18 invites remained
  unmeasured after reciprocal reads, preventing fabricated upgrade timing.
- Live paste-once receipt: Hudson used a fresh isolated state and the printed
  `mpai join '…' --attach` handoff to enter one viewer-only Reagan Codex room,
  render its persisted context, and leave. The invitation was then revoked and
  the disposable credential state deleted.
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
- The exact public 0.4.10 release asset matched SHA-256
  `4a0ddb1fbe72175272cd0beabb7ac7247473ac06fb49fe1be5d42eedce57a79c`,
  installed into an isolated prefix, and reported 0.4.10 from both binaries.
- The exact public 0.4.11 release asset matched SHA-256
  `bff743c95d37219b0ad663294b13f8e040ca376a60c359f8733a6b261bc2f77c`,
  installed into an isolated prefix, and reported 0.4.11 from both binaries.
- The exact public 0.4.12 release asset matched SHA-256
  `d925f1890964d8fe04c53ee181afff240b8945a3be5df0356d271979d055b513`,
  installed into an isolated prefix, and reported 0.4.12 from both binaries.
- Clean macOS 26 and Linux runners installed the exact 0.4.12 Homebrew formula,
  executed 0.4.12, passed its formula test, uninstalled it, and verified both
  CLI links were absent afterward in run 30802423567.
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
- Packaged 0.4.12 installs on two separate Macs with matching live services.
- Live cross-Mac proof that one teammate can list another's separate Codex and
  Claude Code sessions, open a real Claude Code transcript, and send an
  attributed Reagan prompt from one Mac into Hudson's existing session.

## Public-alpha exit gates

### P0: must close

1. **Safe active Codex attachment on every supported Codex surface.** Standalone
   sessions are view-only by default. We need a documented managed-daemon path
   for each supported surface rather than imply every active session is safely
   writable.
2. **Complete distribution (current 0.4.12 proof).** The public GitHub source, versioned release, and
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
automatic submission. Invite-to-first-room time is measured locally when the
current release observes the first successful room read; older installs can
still self-report it. Context-transfer value remains self-reported in the
first-10-team cohort.
