# Launch-readiness scorecard

This score measures evidence that mpai can activate, protect, retain, and
support real teams. It is not a probability of virality or a valuation claim.
No point is awarded from intent, documentation alone, or founder-only opinion
when the criterion requires outside behavior.

Current evidence score: **75/100** after the public 0.4.8 deployment,
release-artifact lifecycle/100-cycle soak receipts, deterministic
one-host/two-teammate concurrency proof, and the privacy-safe local alpha
receipt on August 3, 2026.

## 1. Core multiplayer usefulness — 18/20

| Criterion | Points | Current evidence |
|---|---:|---|
| Provider-neutral Codex and Claude discovery/read | 4/4 | Automated adapter and hub suites; both adapters healthy on the live host |
| Terminal room, switching, search, presence, reconnect | 4/4 | Terminal-room suite and real two-Mac session listing |
| Claude exact-session attributed prompting | 4/4 | Reagan → Hudson two-Mac native Claude Code receipt |
| Managed Codex attributed prompting | 3/4 | Managed transport and attribution suites pass; two-way cross-Mac native receipt remains open |
| Durable human identity in room, provider transcript, and audit | 3/4 | Claude receipt plus server/audit suites; both-provider two-way certification remains open |

## 2. Activation and distribution — 17/20

| Criterion | Points | Current evidence |
|---|---:|---|
| Versioned GitHub release and one-command Homebrew install | 4/4 | 0.4.8 public asset hash plus isolated install verified; Homebrew test-bot installs the formula on clean macOS 26 and Linux |
| Host setup installs and verifies a reachable matching service | 4/4 | Matching-version 0.4.8 doctor receipts on the live Reagan and Hudson hosts; setup prints an explicit participant invite with selected-session sharing |
| Fresh teammate can paste an invite without prior setup | 4/4 | Isolated CLI test reaches ready shared room with credential outside config |
| Empty-share and offline recovery print exact next action | 2/2 | Join names the share command; connection/header attempts stop after ten seconds with privacy-safe wake, Tailscale, and host-service recovery steps while established prompt streams remain open |
| Upgrade, rollback, and uninstall path | 3/3 | Stable launcher and live service reinstall receipt plus a disposable public-asset 0.4.4 → 0.4.3 → 0.4.4 rollback and full package uninstall with state preserved |
| Ten stranger installs with median time-to-room below five minutes | 0/3 | No external cohort yet |

## 3. Trust and security boundary — 19/20

| Criterion | Points | Current evidence |
|---|---:|---|
| Tailnet-only listener and Tailscale identity binding | 4/4 | Network and identity suites |
| Private-by-default task access on list/read/presence/audit/prompt | 5/5 | Direct-access and route-wide authorization suite |
| Viewer/participant roles, revocation, collision, idempotency | 3/3 | Server suite |
| Peer secrets outside config | 3/3 | Keychain round trip, per-peer backend routing, mode-0600 fallback, migration, and config tests |
| Redacted diagnostics | 2/2 | Real mode-0600 bundle plus sensitive-fixture exclusion suite |
| Public policy surface | 2/3 | MIT, contribution, conduct, security reporting, privacy, and acceptable-use policies exist; the preliminary name screen found material adjacent MPAI standards use, so qualified trademark clearance remains open |

## 4. Reliability and lifecycle — 15/20

| Criterion | Points | Current evidence |
|---|---:|---|
| Automated behavioral and syntax suite | 4/4 | 41/41 tests and syntax checks |
| Real service restart and matching-version health | 2/2 | Live Reagan and Hudson 0.4.8 public-asset installs, service restarts, matching doctor receipts, and reciprocal session reads |
| Provider failures remain narrow and fail closed | 2/2 | Managed Codex auth-error replay returned an actionable turn failure without changing the host PID; standalone-block and Claude permission behavior suites pass |
| Upgrade, sleep/wake, Wi-Fi, relay, and provider restart recovery | 1/5 | Live Hudson 0.4.4 migration failed safely then recovered; both hosts upgraded through 0.4.8 and restarted with reciprocal access intact; other lifecycle transitions remain open |
| 100 attach/read/leave cycles without ordering defects | 4/4 | Real local HTTP server/client soak passed 100 attach, attributed turn, read, and leave cycles with ordered transcripts/events, unique IDs, correct authorship/presence, and 200 ordered audit records |
| One host plus two simultaneous teammates | 2/3 | Real local HTTP server with two isolated simulated tailnet identities passes per-invite visibility, simultaneous named presence, prompt collision, unaffected-peer continuity, and revocation; physical third-Mac certification remains open |

## 5. Demand, learning, and retention — 6/20

| Criterion | Points | Current evidence |
|---|---:|---|
| Real two-Mac product proof | 2/2 | Public Reagan → Hudson recording |
| Public install, landing, release, and launch listings | 2/2 | GitHub Pages, GitHub release, Homebrew tap, Product Hunt listing |
| Safe public support loop | 1/1 | Issue templates, private security reporting, support bundle |
| Ten non-founder teams complete first room | 0/5 | No evidence yet |
| Ten non-founder teams return in a later week | 0/7 | No evidence yet |
| Opt-in metadata-only activation/reliability measurement | 1/3 | Public 0.4.6 local review-before-sharing receipt, synthetic leak-exclusion test, public-artifact install, and live mode-0600 receipts on both hosts; automatic consented collection and non-founder cohort evidence remain open |

## Evidence required for 98

The score can reach 98 only after all of these are proven:

1. **Closed:** Homebrew 0.4.8 installs and tests on clean macOS and Linux.
2. Harmless named prompts work in both directions for Claude Code and managed
   Codex, with each host's native transcript checked.
3. Ten people who did not build mpai install it; median existing-tailnet time
   to first shared room is below five minutes.
4. Sleep/wake, network change, relay change, provider restart, and service
   upgrade recover without reinstalling or rejoining.
5. **Closed:** one hundred local server/client attach, attributed turn, read,
   and leave cycles preserve order, unique IDs, authorship, presence cleanup,
   and audit pairing. A later physical-network soak remains valuable but does
   not reopen this deterministic protocol gate.
6. One host plus two teammates passes presence, collision, per-invite sharing,
   and revocation checks. The deterministic real-server/two-client gate is
   closed; a physical third Mac is still required for the final point.
7. Rollback and uninstall are executed on a disposable installation.
8. Privacy notice, acceptable-use policy, and trademark review are complete.
9. Ten non-founder teams return in a later week.
10. **Partially closed:** the local review-before-sharing receipt reports
    activation and reliability without prompt or transcript content. Automatic
    consented collection and ten-team cohort evidence remain open.

The separate probability of a massive outcome should rise only when outside
activation and retention evidence rises. Shipping more features by itself does
not justify moving that probability.
