# Changelog

All notable project changes are documented here.

## [0.4.15] - 2026-08-03

Release shared rooms promptly when a teammate leaves or a provider stalls.

### Fixed

- Closing a teammate's prompt stream now aborts the exact provider operation,
  clears the per-session turn lock, and records a failed audit event.
- Managed Codex turns use the supported App Server `turn/interrupt` method on
  disconnect.
- Claude Code resumes are terminated on disconnect or after two minutes with
  no stdout or stderr progress, while retaining the 30-minute overall bound.

### Proven

- Regressions cover silent Claude cleanup, Claude disconnect cleanup, managed
  Codex interruption, failed audit recording, and immediate reuse of the same
  session after a disconnected turn.
- The packed 0.4.15 artifact has SHA-256
  `5d444f115324013e24cdc317a2b05407c9f249c596a7f9085176c62bf9eec523`.

## [0.4.14] - 2026-08-03

Collapse the host's first-room path into one guided command.

### Added

- `mpai start --name HOST --with TEAMMATE` now configures and verifies a fresh
  host, discovers its existing Codex and Claude Code sessions, asks the host to
  select exactly one, and creates a participant invite already scoped to it.
- Existing hosts can omit `--name`; scripts can use `--session SESSION_ID` to
  make the same selection explicitly without an interactive picker.

### Safety

- Every session except the selected one remains private, and non-interactive
  execution without `--session` stops before creating an invite.
- A fresh host must pass the existing doctor gate before the invitation is
  created, so setup failures do not produce a dead first-room handoff.

### Proven

- CLI regressions cover the one-command selected-session participant invite,
  version-pinned no-install guest handoff, and fail-closed non-interactive path.
- The packed 0.4.14 artifact has SHA-256
  `41b3f52819859c817bbe066703c708f3eaed8907e80471adf99a61c1c8a8e096`;
  the repository formula is pinned to that exact artifact and hash.

## [0.4.13] - 2026-08-03

Remove the invited teammate's global-install step from the first-room path.

### Added

- Session-scoped invite handoffs now lead with one exact `npx` command against
  the versioned GitHub release artifact. A teammate with Node.js 20+ can claim
  the named invite and enter the ready room without a global package install.
- The one-paste guest path uses `--no-service`: it grants no hosting capability
  and creates no LaunchAgent. The existing Homebrew plus `mpai join` path is
  printed underneath for teammates who intentionally want to host in return.

### Proven

- The exact public 0.4.12 artifact executes through `npx` from a fresh npm
  cache. The packed 0.4.13 artifact then completed a fresh-state `npx` join,
  identity and credential bootstrap, transcript render, ready-room attach, and
  clean leave against a real local HTTP server without installing hosting.
- The invite-output regression pins the 0.4.13 artifact URL, `--no-service`,
  exact private invite, and `--attach` in one recommended line.
- A release-metadata regression keeps the runtime, package manifests, formula,
  README, landing page, and public-alpha contract on the same version.
- The full suite passes 47/47 behavioral tests and syntax checks; the formula
  copy also passes Ruby syntax validation.
- The packed 0.4.13 artifact reports from both installed binaries and through
  a fresh-cache `npx` execution; its pre-release SHA-256 is
  `4f32501188f3d0ec54fd99627bf454785c5d1305680e8fe2deb869f1ae212b7c`.
- The formula copy shipped in this repository is pinned to that same artifact
  and hash instead of lagging behind the external tap.

## [0.4.12] - 2026-08-03

Shorten the invited teammate's first-room path without weakening explicit
session authorization.

### Added

- Session-scoped invite handoffs now print `mpai join '…' --attach`, so the
  teammate's one pasted join command stores identity and credentials, verifies
  the shared session, and opens its live terminal room.
- Plain `mpai join` remains non-interactive for older, empty, all-session, and
  automation-oriented flows, and still prints the exact next attach command.

### Proven

- A fresh-install CLI regression joins an isolated server, enters the exact
  shared Claude Code room, renders its saved context, and leaves cleanly from
  the same process.
- The full suite passes 46/46 behavioral tests and syntax checks.
- The exact public release asset matched SHA-256
  `d925f1890964d8fe04c53ee181afff240b8945a3be5df0356d271979d055b513`,
  installed into an isolated prefix, and reported 0.4.12 from both binaries.
- A real Hudson → Reagan viewer invite opened one explicitly shared persisted
  Codex room from the printed join command; the invite was then revoked and the
  disposable credential state deleted.
- Both live Macs upgraded to matching 0.4.12 services with reciprocal session
  reads intact, and Homebrew lifecycle run 30802423567 passed on clean macOS 26
  and Linux.

## [0.4.11] - 2026-08-03

Shorten the private first-room path without weakening explicit session access.

### Added

- `mpai invite --name TEAMMATE --role participant --session SESSION_ID`
  resolves the chosen local session and creates the named invite with that one
  session already shared.
- The printed handoff remains two lines, but the teammate's first `mpai join`
  can now confirm a ready room instead of waiting for a separate host command.

### Proven

- Config regressions require session-scoped invitations to expose only the
  chosen task and reject contradictory all-session scope.
- A CLI regression discovers a real saved Claude Code fixture by short ID,
  creates the scoped invitation, and verifies no follow-up share command is
  printed.
- The full suite passes 46/46 behavioral tests and syntax checks.
- The exact public release asset matched SHA-256
  `bff743c95d37219b0ad663294b13f8e040ca376a60c359f8733a6b261bc2f77c`,
  installed into an isolated prefix, and reported 0.4.11 from both binaries.
- Both live Macs upgraded to matching 0.4.11 services from the public asset;
  reciprocal session reads remained intact without rejoining or resharing.
- Homebrew lifecycle run 30800846625 installed the exact formula, executed
  0.4.11, passed its formula test, uninstalled it, and verified both CLI links
  were absent on clean macOS 26 and Linux.

## [0.4.10] - 2026-08-03

Harden the invite-authentication boundary and make continuous security analysis
part of every release.

### Fixed

- Bearer authorization parsing is now length-bounded and accepts only the
  generated invite token alphabet, removing a polynomial regular-expression
  path on attacker-controlled request headers.

### Proven

- A regression rejects oversized, space-containing, and non-Bearer
  credentials while preserving valid generated invites.
- The full suite passes 44/44 behavioral tests and syntax checks on Node 20 and
  Node 22.
- CodeQL extended security analysis runs on pushes, pull requests, and weekly;
  its high-severity parser finding is fixed and zero alerts remain open.
- The exact public release asset matched SHA-256
  `4a0ddb1fbe72175272cd0beabb7ac7247473ac06fb49fe1be5d42eedce57a79c`,
  installed into an isolated prefix, and reported 0.4.10 from both binaries.
- Both live Macs upgraded to matching 0.4.10 services with reciprocal session
  reads intact.
- Homebrew lifecycle run 30797200745 installed the exact formula, executed
  0.4.10, passed its formula test, uninstalled it, and verified both CLI links
  were absent on clean macOS 26 and Linux.

## [0.4.9] - 2026-08-03

Recover managed Codex prompting after a provider restart.

### Fixed

- An automatic-mode host that fell back to standalone Codex while the managed
  daemon was unavailable now promotes itself back to the managed transport
  before evaluating a remote prompt.
- Failed promotion still leaves standalone prompting blocked by default; the
  recovery path does not weaken the active-task safety boundary.
- Concurrent promotion requests share one transition instead of spawning
  competing managed connections.

### Proven

- A live two-Mac restart reproduced the stale-standalone state: reads remained
  available, the first post-restart prompt failed safely, and the mpai host
  service stayed running.
- Managed-client and HTTP regressions require standalone-to-proxy promotion to
  happen before the prompt safety check.
- The full suite passes 43/43 behavioral tests and syntax checks on Node 20 and
  Node 22.
- The exact public release asset matched SHA-256
  `83c230402a7a1d10defee9f1a869dd1141ba569278cca201979b408a70847fb5`,
  installed into an isolated prefix, and reported 0.4.9 from both binaries.
- Both live Macs upgraded to matching 0.4.9 services. Hudson then repeated the
  provider restart: the mpai PID stayed unchanged, reads fell back safely, and
  Reagan's next named prompt promoted the same host back to managed proxy and
  completed without reinstall or rejoin.
- Homebrew lifecycle run 30794006889 installed the exact formula, executed
  0.4.9, passed its formula test, uninstalled it, and verified both CLI links
  were absent on clean macOS 26 and Linux.

## [0.4.8] - 2026-08-03

Fail-closed managed Codex errors without a host crash.

### Fixed

- Managed Codex notifications named `error` no longer become Node's special
  unhandled `error` event, which terminated the mpai host service.
- A provider auth failure now rejects only the affected turn as
  `CODEX_AUTH_REQUIRED`; other failures use `CODEX_TURN_FAILED`.
- Turn-completion, provider-error, and exit listeners are removed immediately
  after either success or failure.

### Proven

- A disposable Hudson → Reagan managed-Codex prompt reached the correct native
  transcript with Hudson's attribution and reproduced the expired-token crash
  without touching a real project.
- A managed-socket regression sends an immediate auth error, requires the
  typed failure, proves all turn listeners are removed, and confirms the same
  Codex client remains usable afterward.
- The exact public release asset matched SHA-256
  `78eb0d4e6f3c5cdc9d3149472fb28719857d7df83d91bb92083a0a5abf8f1af5`,
  installed into an isolated prefix, and reported 0.4.8 from both binaries.
- The supported Node 22 Homebrew formula was explicitly installed, executed,
  tested, and uninstalled on clean macOS 26 and Linux runners; both CLI links
  were absent afterward. Both live Macs restarted on matching 0.4.8 services;
  replaying the remote auth failure left the host PID unchanged and reciprocal
  reads healthy.

## [0.4.7] - 2026-08-03

Participant-first onboarding without broader sharing.

### Fixed

- `mpai setup` now prints an explicit participant invite command with
  selected-session sharing. Following the CLI's own next step no longer
  creates a view-only invite that blocks the first named teammate prompt.
- Viewer remains the default role for bare `mpai invite` commands, preserving
  least privilege when the host has not explicitly chosen collaboration.

### Proven

- A CLI regression test exercises fresh setup output and requires the exact
  private participant invite command.
- The exact public release asset matched SHA-256
  `352eda0c4215d5ee5588aa0476e6b5c59a6ba9f9f6241e34c5beb6c15714073f`,
  installed into an isolated prefix, and printed the collaboration-ready next
  step from the packaged CLI.
- Homebrew formula-install jobs passed on macOS 26 and Linux, and both live
  Macs restarted on matching 0.4.7 services with reciprocal reads intact.

## [0.4.6] - 2026-08-03

Privacy-safe cohort measurement.

### Added

- `mpai alpha-receipt` writes a mode-0600, review-before-sharing JSON receipt
  with activation elapsed minutes, collaboration counts, active days/weeks,
  provider outcomes, and categorized reliability.
- The receipt is never transmitted automatically and excludes prompts,
  transcripts, names, task identifiers, paths, credentials, network addresses,
  and event timestamps.

### Proven

- Synthetic sensitive fixtures confirm the receipt retains useful activation
  and reliability evidence without serializing collaboration content or
  identifiers.
- An isolated CLI run produced a valid mode-0600 receipt and explicitly
  reported that nothing was sent.

## [0.4.5] - 2026-08-02

Fast, actionable teammate-offline recovery.

### Fixed

- Peer connection and response-header attempts now stop after ten seconds
  instead of leaving a first-time user at an apparently frozen command.
- Connection failures and timeouts now become one privacy-safe
  `PEER_UNREACHABLE` error with exact checks for Mac wake state, Tailscale, and
  the mpai host service.
- The connection deadline ends when a prompt stream is established, so a
  legitimate long-running Claude Code or Codex response is not interrupted.

### Proven

- Dedicated tests cover refused connections, a peer that never responds, the
  recovery message, removal of network/credential details, and a valid prompt
  stream that outlives the connection deadline.

## [0.4.4] - 2026-08-02

Non-interactive host credential repair.

### Fixed

- Legacy credential migration no longer blocks an SSH-managed macOS host when
  its login Keychain is unavailable.
- Credential reads now follow each peer's recorded storage backend instead of
  assuming one global backend for the process.

### Added

- A mode-0600 local credential fallback outside config, used only when the
  preferred Keychain write fails.
- Explicit join output when the protected local fallback is selected.

### Proven

- Primary-success and Keychain-unavailable fallback tests cover write, routed
  read, stale-fallback removal, and file permissions.
- The failed Hudson upgrade left his 0.4.0 service and inline legacy state
  untouched, providing the live reproduction for this patch.
- The 0.4.4 candidate then migrated Hudson to the mode-0600 fallback, removed
  the inline token, restarted through the stable launcher, reported matching
  provider/service health, and preserved two-way Reagan ↔ Hudson session reads.

## [0.4.3] - 2026-08-02

First-use reliability and supportability.

### Added

- Fresh-install invite bootstrap: `mpai join` can establish local identity,
  secure peer storage, reciprocal hosting, and shared-session readiness.
- Peer-specific joined identity so the local prompt label matches the name the
  host records.
- `mpai support-bundle` with metadata-only health and categorized failures.
- Running service reachability and version checks in `mpai doctor`.

### Fixed

- Launch agents now execute the stable installed `mpai` launcher rather than
  pinning a version-specific package source or Node executable.
- Setup preserves an existing custom host port.
- Invite output contains the exact receiver commands and exact selected-share
  recovery step.

### Proven

- A fresh isolated state directory joined a mock teammate, stored no token in
  config, found a shared session, and printed the attach command.
- A real mode-0600 support bundle retained provider/service diagnostics while
  excluding prompts, transcripts, identities, paths, credentials, task IDs,
  and network addresses.

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
