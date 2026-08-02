# Launch references

Research snapshot: August 2, 2026.

This page records the references used for the public-alpha positioning and
landing page. They are inputs, not templates to copy.

## Product and interaction references

### Zed collaboration

- [Collaboration overview](https://zed.dev/docs/collaboration/overview)
- [Channels](https://zed.dev/docs/collaboration/channels)

Useful pattern: collaboration is described as ambient awareness, pairing, and
jumping into a teammate's context while each person keeps their own screen and
configuration. Zed also states the security consequence of sharing clearly.

mpai applies that mental model to the agent conversation rather than the code
editor: separate session identity, visible participants, explicit host sharing,
and a direct warning about access.

### Tailscale identity

- [Tailscale identity](https://tailscale.com/docs/concepts/tailscale-identity)

Useful pattern: user identity and device identity are understandable product
concepts, not hidden networking implementation. mpai makes the same distinction
visible in its security narrative: Tailscale authenticates the connecting
identity; an mpai invite authorizes a role and session scope.

### Linear

- [Linear home page](https://linear.app/)

Useful pattern: the product surface is the evidence. The page demonstrates a
real workflow before expanding into feature chapters. mpai therefore leads
with a shared terminal session rather than abstract collaboration diagrams.

## Open-source repository references

- [Zed](https://github.com/zed-industries/zed)
- [Supabase](https://github.com/supabase/supabase)
- [Twenty](https://github.com/twentyhq/twenty)
- [Cal.com](https://github.com/calcom/cal.com)

The reusable launch pattern is a precise one-sentence promise, a visible
product artifact, a short working quickstart, an explicit project boundary,
clear contribution and security paths, and a public roadmap.

## Market sources

The landing page uses only two compact market facts:

- Microsoft reported more than 4.7 million paid GitHub Copilot subscribers in
  [FY2026 Q2 earnings](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q2).
- Google's 2025 DORA study found 90% of surveyed technology professionals use
  AI at work, reported in the
  [DORA announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report).

The larger evidence set, competitive analysis, and bottom-up scenarios remain
in [MARKET-THESIS.md](./MARKET-THESIS.md).

## Visual translation

The page deliberately avoids pretending the website is the product.

- The hero is a terminal room with three separate native sessions.
- Maya and Alex keep stable author colors from prompt to architecture map.
- The split bracket mark represents two people around one shared context.
- The page alternates warm paper and ink instead of default neon-on-black
  hacker styling.
- Motion is limited to state changes, connection pulses, and the session demo;
  reduced-motion preferences are respected.
