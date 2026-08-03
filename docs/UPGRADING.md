# Upgrade, rollback, and uninstall

The newest public alpha is the only supported version. Keep configuration and
audit state under `~/.multiplayer-ai`; Homebrew upgrades do not rewrite it.
Joined-peer tokens remain in macOS Keychain.

## Upgrade

```bash
brew update
brew upgrade godfaddaai/tap/mpai
mpai service install
mpai doctor
```

The service launch agent points at the stable installed `mpai` launcher rather
than a versioned package source path or Node executable. Homebrew installations
therefore keep `/opt/homebrew/bin/mpai` stable across formula versions.
Reinstalling the service after an upgrade restarts it immediately on the new
version. `mpai doctor` fails the host-endpoint check when the CLI and running
service versions differ.

Before asking for help, create and review a metadata-only bundle:

```bash
mpai support-bundle
```

## Roll back temporarily

Homebrew can extract a previous formula from the tap's Git history into a
personal local tap:

```bash
brew tap-new local/mpai-rollback
brew extract --version=0.4.2 godfaddaai/tap/mpai local/mpai-rollback
brew unlink mpai
brew install local/mpai-rollback/mpai@0.4.2
brew link --overwrite --force mpai@0.4.2
mpai service install
mpai doctor
```

Replace `0.4.2` with the intended released version. This preserves state. Move
forward again by unlinking and uninstalling the extracted formula, then linking
or reinstalling `godfaddaai/tap/mpai` and reinstalling the service.

## Uninstall

Stop the always-on host before removing the package:

```bash
mpai service uninstall
brew uninstall godfaddaai/tap/mpai
```

This intentionally preserves `~/.multiplayer-ai` and joined-peer Keychain
items so a reinstall can recover. Review and remove those separately only when
you intentionally want to destroy local identity, invitations, audit history,
and peer access.

The service-only uninstall/reinstall sequence was executed on the live Reagan
host: the LaunchAgent disappeared, status reported stopped, reinstall restored
the endpoint, and `mpai doctor` again reported matching-version Codex and Claude
Code health. A separate Hudson 0.4.0 → 0.4.4 candidate upgrade failed safely
when Keychain was unavailable, then succeeded through the protected fallback
without losing reciprocal access.

The exact public 0.4.5 asset was then installed on Reagan and Hudson. Both
services restarted with matching 0.4.5 doctor receipts and reciprocal session
reads remained intact. Hudson's interactive shell still had a legacy 0.4.0
prototype symlink ahead of the stable install; the two explicit launcher
symlinks were repaired after verifying their exact targets, so both the shell
and LaunchAgent now resolve the same 0.4.5 package.

On August 3, 2026, both hosts were upgraded again from the exact public 0.4.6
release asset. Their services restarted with matching 0.4.6 doctor receipts,
reciprocal read-only session access remained intact, and `mpai alpha-receipt`
produced a local mode-0600, `not-sent` receipt on each host.

Both hosts then upgraded from the exact public 0.4.7 release asset. Their
services restarted with matching 0.4.7 doctor receipts and reciprocal
read-only session access remained intact. The patch changes only setup's
printed first-invite guidance; stored identities, invitations, and audit state
were preserved.

Both hosts then upgraded from the exact public 0.4.8 release asset. Their
services restarted with matching 0.4.8 doctor receipts and reciprocal access
remained intact. A live managed-Codex auth failure returned a scoped error to
the teammate without restarting the host service, proving the crash repair on
the public artifact.

Both hosts later upgraded from the exact public 0.4.11 release asset through
their isolated npm global prefixes. The stable launchers and stored peer state
were preserved, both services restarted with matching 0.4.11 doctor receipts,
and reciprocal session reads remained intact without rejoining or resharing.

The same public-asset process upgraded both hosts to 0.4.12. Stable launchers,
stored peer state, and existing share rules were preserved; both services
restarted with matching doctor receipts and reciprocal reads remained intact.

Both hosts then upgraded from the exact public 0.4.13 asset and restarted on
matching 0.4.13 endpoints. Hudson retained read access to Reagan. Reagan's old
Hudson peer credential was absent locally, so a replacement participant invite
with the prior trusted all-session scope was claimed and the stale invite was
revoked. Reciprocal reads then passed without rebuilding either host identity
or service configuration.

Both hosts then upgraded from the exact public 0.4.14 asset and restarted on
matching 0.4.14 endpoints. Reagan's service ran as PID 8152 and Hudson's as PID
86187; both provider-aware doctor checks passed, and reciprocal one-session
lists succeeded without reinstalling identities, rejoining, or changing share
configuration.

On August 2, 2026, the exact public GitHub release assets were exercised in an
isolated npm prefix: 0.4.4 installed, configured state was created, the package
rolled back to 0.4.3, recovered forward to 0.4.4, and was fully uninstalled.
Both installed binaries and the package directory were absent afterward while
the state file remained. Full Homebrew package removal remains a separate
distribution-specific disposable-install gate.
