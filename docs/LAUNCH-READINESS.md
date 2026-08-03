# Launch-readiness scorecard

This score measures evidence that mpai can activate, protect, retain, and
support real teams. It is not a probability of virality or a valuation claim.
No point is awarded from intent, documentation alone, or founder-only opinion
when the criterion requires outside behavior.

Current evidence score: **65/100** after 0.4.3 on August 2, 2026.

## 1. Core multiplayer usefulness — 18/20

| Criterion | Points | Current evidence |
|---|---:|---|
| Provider-neutral Codex and Claude discovery/read | 4/4 | Automated adapter and hub suites; both adapters healthy on the live host |
| Terminal room, switching, search, presence, reconnect | 4/4 | Terminal-room suite and real two-Mac session listing |
| Claude exact-session attributed prompting | 4/4 | Reagan → Hudson two-Mac native Claude Code receipt |
| Managed Codex attributed prompting | 3/4 | Managed transport and attribution suites pass; two-way cross-Mac native receipt remains open |
| Durable human identity in room, provider transcript, and audit | 3/4 | Claude receipt plus server/audit suites; both-provider two-way certification remains open |

## 2. Activation and distribution — 16/20

| Criterion | Points | Current evidence |
|---|---:|---|
| Versioned GitHub release and one-command Homebrew install | 4/4 | 0.4.3 asset hash and isolated install verified; Homebrew test-bot installs pass on clean macOS 26 and Linux |
| Host setup installs and verifies a reachable matching service | 4/4 | Live 0.4.3 doctor receipt on the tailnet host |
| Fresh teammate can paste an invite without prior setup | 4/4 | Isolated CLI test reaches ready shared room with credential outside config |
| Empty-share and offline recovery print exact next action | 2/2 | Join and room paths name the host command required |
| Upgrade, rollback, and uninstall path | 2/3 | Stable launcher, documented procedures, and live service uninstall/reinstall receipt; release rollback and full package uninstall remain open |
| Ten stranger installs with median time-to-room below five minutes | 0/3 | No external cohort yet |

## 3. Trust and security boundary — 18/20

| Criterion | Points | Current evidence |
|---|---:|---|
| Tailnet-only listener and Tailscale identity binding | 4/4 | Network and identity suites |
| Private-by-default task access on list/read/presence/audit/prompt | 5/5 | Direct-access and route-wide authorization suite |
| Viewer/participant roles, revocation, collision, idempotency | 3/3 | Server suite |
| Peer secrets outside config | 3/3 | Keychain round trip, migration, and config tests |
| Redacted diagnostics | 2/2 | Real mode-0600 bundle plus sensitive-fixture exclusion suite |
| Public policy surface | 1/3 | MIT, contribution, conduct, security reporting exist; privacy/AUP and trademark review remain open |

## 4. Reliability and lifecycle — 8/20

| Criterion | Points | Current evidence |
|---|---:|---|
| Automated behavioral and syntax suite | 4/4 | 31/31 tests and syntax checks |
| Real service restart and matching-version health | 2/2 | Live 0.4.3 lifecycle receipt |
| Provider failures remain narrow and fail closed | 2/2 | Managed Codex, standalone-block, and Claude permission behavior suites |
| Sleep/wake, Wi-Fi, relay, and provider restart recovery | 0/5 | Not certified |
| 100 attach/read/leave cycles without ordering defects | 0/4 | Not run |
| One host plus two simultaneous teammates | 0/3 | Not certified |

## 5. Demand, learning, and retention — 5/20

| Criterion | Points | Current evidence |
|---|---:|---|
| Real two-Mac product proof | 2/2 | Public Reagan → Hudson recording |
| Public install, landing, release, and launch listings | 2/2 | GitHub Pages, GitHub release, Homebrew tap, Product Hunt listing |
| Safe public support loop | 1/1 | Issue templates, private security reporting, support bundle |
| Ten non-founder teams complete first room | 0/5 | No evidence yet |
| Ten non-founder teams return in a later week | 0/7 | No evidence yet |
| Opt-in metadata-only activation/reliability measurement | 0/3 | Not implemented |

## Evidence required for 98

The score can reach 98 only after all of these are proven:

1. **Closed:** Homebrew 0.4.3 installs and tests on clean macOS and Linux.
2. Harmless named prompts work in both directions for Claude Code and managed
   Codex, with each host's native transcript checked.
3. Ten people who did not build mpai install it; median existing-tailnet time
   to first shared room is below five minutes.
4. Sleep/wake, network change, relay change, provider restart, and service
   upgrade recover without reinstalling or rejoining.
5. One hundred attach/read/leave cycles preserve order and authorship.
6. One host plus two teammates passes presence, collision, per-invite sharing,
   and revocation checks.
7. Rollback and uninstall are executed on a disposable installation.
8. Privacy notice, acceptable-use policy, and trademark review are complete.
9. Ten non-founder teams return in a later week.
10. Opt-in metadata-only measurement reports activation and reliability without
    collecting prompt or transcript content.

The separate probability of a massive outcome should rise only when outside
activation and retention evidence rises. Shipping more features by itself does
not justify moving that probability.
