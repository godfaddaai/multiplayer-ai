# Privacy notice

Effective August 2, 2026.

mpai is local-first, self-hosted public-alpha software. It connects trusted
teammates' Macs over their existing Tailscale network. The maintainers do not
operate an mpai transcript service and the current release does not send
product analytics or AI-session content to the maintainers.

## What mpai processes

On machines where you install it, mpai may process:

- your chosen display name and teammate names;
- Tailscale user and device identity needed to bind an invitation;
- local Codex and Claude Code session identifiers, titles, workspace paths,
  timestamps, transcripts, and provider events;
- prompts a participant sends to an explicitly shared session;
- role, sharing, presence, and append-only prompt-audit metadata;
- local service, provider, version, and error metadata used for diagnostics;
- invitation and peer credentials needed to authorize a connection.

This data stays on the participating machines and their tailnet unless a user
chooses to send, publish, or back it up elsewhere. A host decides which
sessions are shared and remains responsible for the data in those sessions.

## Credentials and diagnostics

The host stores only a SHA-256 hash of an issued invitation token. A joined
peer credential is stored in macOS Keychain when available or in a local file
restricted to the current OS user when Keychain is unavailable. Config files
contain a credential reference rather than the token itself.

`mpai support-bundle` is designed to exclude prompts, transcripts, identities,
credentials, paths, task metadata, and network addresses. Review any file
before sharing it. Do not send real invitation URLs, tokens, or unredacted
transcripts in a public issue.

`mpai alpha-receipt` is a separate review-before-sharing file containing only
counts, elapsed minutes, active day/week totals, provider names, and categorized
reliability outcomes. It excludes names, identifiers, prompts, transcripts,
task metadata, paths, credentials, network addresses, and event timestamps.
The command writes the receipt locally with mode 0600 and does not upload it.

## Website and third-party services

The project website is a static GitHub Pages site and does not include mpai
product analytics. GitHub may process ordinary request, account, repository,
release-download, issue, and security-reporting data under GitHub's own terms
and privacy notice. Tailscale and the selected AI provider process data under
their own agreements; mpai does not replace those controls.

## Retention and deletion

mpai retains local configuration, sharing rules, credentials, and audit data
until a user revokes, unshares, uninstalls, or deletes the corresponding local
data. Provider transcripts follow the provider's local retention behavior.
Revoking an invite prevents future requests but cannot erase information a
teammate already viewed or copied.

## Alpha measurement

The current release has no automatic product telemetry. Creating an alpha
receipt is an explicit local action; sharing it is a separate user choice. If
networked opt-in measurement is added later, it must be off by default,
documented before collection, and limited to activation and reliability
metadata. Prompt and transcript content must not be collected for product
analytics.

## Your choices

You can:

- share selected sessions instead of all sessions;
- grant viewer access instead of participant access;
- revoke an invite or unshare a session at any time;
- inspect the source and local data before use;
- avoid creating or sharing a support bundle or alpha receipt;
- uninstall mpai when you no longer want the service running.

For a privacy or security concern, use GitHub's
[private vulnerability reporting](https://github.com/godfaddaai/multiplayer-ai/security/advisories/new)
instead of posting sensitive material publicly.

This notice describes the public alpha as shipped. A future hosted
organization control plane will require a new notice before it collects data.
