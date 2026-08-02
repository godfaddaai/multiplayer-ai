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
