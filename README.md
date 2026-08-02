<p align="center">
  <img src="https://raw.githubusercontent.com/reaganroo22/multiplayer-ai/main/site/favicon.svg" width="72" height="72" alt="mpai logo">
</p>

<h1 align="center">mpai</h1>

<p align="center">
  <strong>Your teammate's AI session. On your terminal.</strong><br>
  Make existing Codex and Claude Code work multiplayer without moving the team into a new IDE.
</p>

<p align="center">
  <a href="https://github.com/reaganroo22/multiplayer-ai/actions/workflows/ci.yml"><img alt="CI status" src="https://github.com/reaganroo22/multiplayer-ai/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/reaganroo22/multiplayer-ai/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/reaganroo22/multiplayer-ai?include_prereleases&style=flat"></a>
  <a href="./LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-0b0d12.svg"></a>
  <a href="https://reaganroo22.github.io/multiplayer-ai/"><img alt="View landing page" src="https://img.shields.io/badge/see_the_product-7687ff.svg"></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/reaganroo22/multiplayer-ai/main/site/og-card.png" alt="mpai shows Alex joining Maya's native Codex session from a separate terminal" width="100%">
</p>

> [!IMPORTANT]
> mpai is a public alpha for trusted teammates on macOS. It uses your existing
> Tailscale network and exposes only sessions the host explicitly shares. Read
> the [current alpha boundary](./docs/PUBLIC-ALPHA.md) before using it with
> sensitive work.

## The idea

AI coding tools are still mostly single-player. One person can be forty turns
deep in a useful Codex or Claude Code conversation while everyone else gets a
summary, a screen share, or a finished pull request.

mpai adds the missing team layer:

~~~text
$ mpai @maya

  MAYA'S SHARED SESSIONS
  1  Codex         Release hardening             2m
  2  Claude Code   Auth handoff                  18m

  Following: Maya, Alex

  MAYA
  Trace the invite boundary before we cut the alpha.

  CODEX
  I found the shared access check. The direct-read test is missing.

  ALEX → CODEX
  Add the test, then run only the server suite.
~~~

The host keeps using the native agent. The teammate sees the same persisted
context and can add a turn with their own name attached.

## Quickstart

### Requirements

- macOS
- Node.js 20+
- Tailscale connected on both Macs
- An authenticated current <code>codex</code> and/or <code>claude</code> CLI

### 1. Install on both Macs

~~~bash
npm install --global github:reaganroo22/multiplayer-ai
mpai setup --name "Your Name"
~~~

<code>mpai setup</code> configures identity, discovers available providers,
installs the background service, and runs health checks.

### 2. Invite a teammate

On Maya's Mac:

~~~bash
mpai invite --name Alex --role participant --share selected
mpai share SESSION_ID --with Alex
~~~

Send the printed <code>mpai://...</code> invite URL to Alex through a channel
you trust. It contains a secret. Do not paste it into an issue, terminal
recording, or public chat.

On Alex's Mac:

~~~bash
mpai join 'mpai://100.x.y.z:7337/join?token=...'
mpai @maya
~~~

For a trusted cofounder relationship where both people intentionally share all
present and future sessions:

~~~bash
mpai share all --with Alex
~~~

Return to selected sharing at any time:

~~~bash
mpai unshare all --with Alex
mpai share SESSION_ID --with Alex
~~~

## What works in 0.4.1

- One task and event model across Codex and Claude Code
- Native session discovery and transcript reading
- A live terminal room with named participants
- Exact session switching, search, and reconnect notices
- Attributed remote prompts in supported provider modes
- Viewer and participant roles
- Private-by-default session sharing and invite revocation
- Tailscale identity binding
- One remote turn at a time per task
- Append-only prompt audit trail
- A macOS background service and provider-aware health checks

## Room commands

~~~text
/sessions        list this teammate's shared sessions
/find auth       search titles and workspaces
/switch 2        follow session 2
/open abc123     follow by session prefix
/who             show named people in this room
/refresh         read the newest native transcript
/leave           return to your shell
~~~

Scriptable commands are available too:

~~~bash
mpai list @maya
mpai show @maya 1234abcd --tail 6
mpai prompt @maya 1234abcd "Check the retry boundary."
mpai audit @maya
~~~

## How it works

~~~mermaid
flowchart LR
    A["Alex's terminal"] -->|"named prompt"| M["mpai"]
    M -->|"Tailscale identity + invite role"| H["Maya's Mac"]
    H --> C["Native Codex session"]
    H --> D["Native Claude Code session"]
    H -.->|"explicitly shared sessions only"| A
~~~

mpai is a coordination layer above the providers:

~~~text
start → listTasks → readTask → prompt(event stream) → close
~~~

Tasks keep provider-qualified IDs such as <code>codex:&lt;id&gt;</code> and
<code>claude:&lt;id&gt;</code>. The terminal room and peer protocol do not need
provider-specific UI. See [PROVIDERS.md](./docs/PROVIDERS.md).

### Claude Code

mpai reads the local Claude Code CLI session store and uses Claude Code's
supported headless resume path for attributed turns. The teammate input is
persisted as:

~~~text
[Multiplayer teammate: Alex]
The actual prompt
~~~

The alpha targets local Claude Code CLI sessions, not every Claude surface.

### Codex

The strongest mode connects to the managed local Codex daemon so native clients
and mpai can share one app server. If that daemon is absent, mpai can list and
read persisted tasks through a standalone server, but remote prompting is
disabled by default to avoid racing an active Desktop task.

~~~bash
codex app-server daemon bootstrap --remote-control
mpai serve --codex-mode proxy
codex --remote unix://
~~~

## Security, plainly

- The collaboration service listens on the Tailscale address, not every
  interface.
- Network identity comes from Tailscale; authorization comes from an
  identity-bound invite and role.
- New invitations default to selected-session access.
- Unshared titles, transcripts, presence, audit events, and prompt routes stay
  hidden.
- The host stores only a SHA-256 hash of an issued invite token.
- There is no endpoint for arbitrary shell execution, deletion, archival, or
  remote approval delegation.
- Codex remote approvals are declined. Claude remote turns use
  <code>dontAsk</code>, so an operation that needs an interactive permission
  prompt is denied.

Peer tokens currently live in a mode-<code>0600</code> local config file.
macOS Keychain storage is a public-alpha gate, not a completed feature. Read
[SECURITY.md](./SECURITY.md) for threat boundaries and reporting.

## Alpha limits

This is useful enough to dogfood and early enough to break:

- macOS and an existing tailnet are required.
- Safe Codex prompting depends on the managed-daemon path. Standalone Codex is
  view-only by default.
- The Claude integration targets the local CLI session store.
- Homebrew distribution, Keychain storage, sleep/wake certification,
  three-person concurrency proof, and redacted support bundles remain open.
- It is not yet certified for 100-person organizations.

Every release gate is tracked in [PUBLIC-ALPHA.md](./docs/PUBLIC-ALPHA.md).

## Development

~~~bash
git clone https://github.com/reaganroo22/multiplayer-ai.git
cd multiplayer-ai
npm install
npm run verify
npm link
mpai doctor
~~~

The local protocol dashboard under <code>src/web/</code> is diagnostic-only.
The product interface is <code>mpai</code> in the terminal.

See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Roadmap

- [ ] macOS Keychain-backed peer credentials
- [ ] Homebrew tap, upgrade, rollback, and uninstall
- [ ] Safe attachment across supported active Codex surfaces
- [ ] Redacted <code>mpai support-bundle</code>
- [ ] Three-person concurrency certification
- [ ] Linux support
- [ ] Provider SDK and additional coding agents
- [ ] Organization directory, RBAC, SSO/SCIM, policy, and audit export

## Why this can matter

The bet is not merely that AI coding is large. It is that teams now operate
many powerful single-user agents while context, authorship, and steering remain
fragmented across individual sessions.

The evidence, competitive landscape, bottom-up scenarios, and falsification
tests are documented in [MARKET-THESIS.md](./docs/MARKET-THESIS.md).

## License

[MIT](./LICENSE) © mpai contributors
