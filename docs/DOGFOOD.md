# Two-Mac dogfood acceptance

## Host preparation

1. Confirm Tailscale is online with `tailscale ip -4`.
2. Run `mpai doctor`; at least one provider adapter must be available.
3. Confirm `mpai list` includes both Codex and Claude Code work when both CLIs
   have local sessions.
4. Create a participant invite specifically named for the teammate with
   selected-session sharing.
5. Confirm the background service was installed by `mpai setup`.
6. Share one Codex session and one Claude Code session with `mpai share`.
7. Run `mpai @TEAMMATE` from the same terminal or IDE terminal used for AI
   work.

## Teammate flow

1. Join the invite from the intended tailnet account.
2. Confirm the terminal room prints the host’s Codex and Claude Code sessions.
3. Confirm it attaches to the newest session and mirrors the native transcript.
4. Use `/sessions` and `/switch` to open one session from each provider.
5. Use `/who` and confirm named remote followers appear.
6. Type a harmless context-only prompt into each provider’s room.
7. Confirm the native transcript contains
   `[Multiplayer teammate: NAME]`.
8. Confirm streamed output and `mpai audit @HOST` identify both the teammate and
   provider.
9. Revoke the invite on the host and confirm the next request is rejected.

## Fail-closed checks

- A viewer invite cannot prompt.
- A selected-session invite cannot list, read, follow, audit, or prompt an
  unshared session, including when its exact provider-qualified ID is known.
- A token copied to a second tailnet identity is rejected after first claim.
- Two simultaneous remote prompts to one task result in one accepted request
  and one `409 PROMPT_CONFLICT`.
- Reusing an idempotency key returns `409` and does not start another turn.
- A Codex command or file approval requested by a remote turn is declined.
- A Claude operation that requires an interactive permission prompt is denied
  by `dontAsk`.
- `/leave` removes the teammate’s presence record and returns to the same shell.
- The optional diagnostic browser interface is unavailable on tailnet and
  public interfaces; it binds only to loopback.
- Stopping `mpai` does not stop or modify either native AI application.

## Current concurrency boundaries

Codex Desktop may launch its primary app server over private stdio. The managed
daemon supports shared clients; standalone fallback supports discovery and
idle-task resume only. Do not use the standalone override to race an active
Desktop task.

Claude Code supports resuming one session from more than one terminal and
documents that messages interleave. The server prevents two simultaneous
remote turns to the same task, but it cannot lock a separate local Claude Code
process. Treat the live room and named presence as the human coordination
signal before sending a turn into an actively running session.

## Live managed-Codex receipt — August 3, 2026

The public 0.4.8 installations completed one direction of the physical
two-Mac managed-Codex gate without touching an existing work session:

1. Hudson's Mac started a dedicated temporary Codex task through the managed
   app-server and seeded it with a harmless exact-response prompt.
2. Hudson explicitly shared only that provider-qualified task with Reagan.
3. Reagan used `mpai prompt @Hudson codex:...` from the other Mac over
   Tailscale. The terminal streamed `Reagan → Codex`, the exact expected reply,
   and a completed terminal state.
4. Hudson's native persisted transcript contained the full
   `[Multiplayer teammate: Reagan]` turn and response. The remote audit showed
   matching `prompt.received` and `prompt.completed` records attributed to
   Reagan and the Codex task.
5. Hudson unshared the task. A subsequent exact-ID read from Reagan was denied
   with `This AI session has not been shared with you`.
6. Both public 0.4.8 services remained healthy; Hudson was running the Codex
   `proxy` adapter after the service restart.

The reciprocal Hudson → Reagan managed-Codex direction is still open. Reagan's
managed daemon rejected the disposable proof turn with `CODEX_AUTH_REQUIRED`
because its ChatGPT refresh token was stale, while mpai kept the host service
healthy. Reauthenticate that daemon before attempting the reciprocal receipt;
do not weaken the standalone prompting boundary to manufacture a pass.

The subsequent public 0.4.9 lifecycle replay closed the provider-restart
subcase. Hudson's managed daemon stopped while mpai service PID 38042 stayed
running; the same remote list remained readable through the safe standalone
fallback. After the daemon returned, Reagan's next named remote prompt caused
that unchanged service to promote back to `proxy` and completed with the exact
expected response. No mpai reinstall or peer rejoin occurred. The native
transcript and audit contained the matching Reagan turn, and the task was
unshared and denied again after verification.

The public 0.4.10 security release then upgraded both Macs and restarted both
services on matching 0.4.10 endpoints. Reagan could still list Hudson's shared
sessions, and Hudson could still list Reagan's, without rejoining or changing
the existing share configuration.

The public 0.4.11 release then upgraded both isolated npm-prefix installations
and restarted both services on matching 0.4.11 endpoints. Each doctor check
reported healthy Codex and Claude Code adapters, and reciprocal session lists
still worked without rejoining or changing the existing share configuration.
The release adds an atomic session-scoped invite; it does not broaden any
previous invitation.

The public 0.4.12 release upgraded both hosts again with matching doctor
receipts and reciprocal reads. A fresh isolated Hudson state then consumed a
viewer-only invitation to one Reagan proof session. The printed
`mpai join '…' --attach` command stored the credential outside config, rendered
the persisted Codex context, entered the room, and left cleanly. The invite was
revoked and its disposable local state deleted immediately afterward.

The public 0.4.13 release upgraded both hosts from the exact public asset and
restarted matching-version services. Hudson could still list Reagan's shared
sessions. Reagan's stored Hudson peer no longer had a local credential, so
Hudson issued a new participant invite with the same trusted all-session scope;
Reagan claimed it, the stale invite was revoked, and Reagan could list Hudson's
sessions again. This proves scoped credential rotation and reciprocal recovery,
but it is founder dogfood rather than outside activation evidence.

The public 0.4.14 release then upgraded both hosts from the exact public asset.
Reagan restarted on PID 8152 and Hudson on PID 86187; both doctor receipts
reported matching 0.4.14 endpoints with Codex and Claude Code available.
Reagan → Hudson and Hudson → Reagan session lists both passed after restart.
The guided `mpai start` regression proves one selected-session participant
invite and a fail-closed non-interactive path, but this still does not count as
one of the ten required non-founder activations.

## Deterministic reliability soak

`test/soak.test.js` runs 100 complete protocol cycles through a real local HTTP
server and `MpaiClient`. Each cycle lists and attaches to the shared Claude Code
task, establishes named presence, reads the ordered transcript, sends a unique
attributed turn, reads the resulting transcript, and leaves. The test rejects
duplicated message IDs, reordered timestamps/events, incorrect teammate or
provider authorship, stale presence, missing audit pairs, and duplicate request
IDs. It runs as part of `npm test`.

This closes the deterministic protocol soak. It does not substitute for the
open physical lifecycle matrix: sleep/wake, Wi-Fi and DERP changes, provider
restart, or one-host/two-teammate concurrency.

`test/concurrency.test.js` adds a real HTTP one-host/two-client proof with two
isolated simulated tailnet identities. It verifies different per-invite task
views, two named people present in the same room, one accepted and one rejected
overlapping prompt, revocation of only the intended teammate, and continued
access for the unaffected teammate. This is the deterministic concurrency
gate; the physical third-Mac receipt remains open.
