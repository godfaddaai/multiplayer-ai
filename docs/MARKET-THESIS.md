# Market thesis: multiplayer infrastructure for AI work

Research snapshot: August 2, 2026.

## Conclusion

This can support a large standalone company, but the winning claim is narrower
than “AI coding is massive.” The wedge is the coordination layer missing after
teams buy multiple powerful single-user agents:

> Join the exact AI work already in progress, inherit its context, and steer it
> with human identity—without moving the team into a new IDE or chat system.

The market is already large enough to validate paid demand. Microsoft reported
more than 4.7 million paid GitHub Copilot subscribers in FY2026 Q2, up 75% year
over year, and nearly 140,000 organizations using GitHub Copilot in FY2026 Q3.
Enterprise subscribers nearly tripled year over year. These are stronger anchors
than a generic analyst TAM because they represent current purchasers of AI
developer tooling.

Sources: [Microsoft FY2026 Q2 earnings](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q2),
[Microsoft FY2026 Q3 earnings](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3).

## Why now

### AI development is already mainstream

- GitHub reports more than 180 million developers, 4.3 million AI projects, and
  81.5% of contributions occurring in private repositories. Nearly 80% of new
  developers used Copilot in their first week in 2025.
  [GitHub Octoverse 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/)
- Google's 2025 DORA study of nearly 5,000 technology professionals found 90%
  using AI at work and more than 80% reporting productivity gains; 30% still
  reported little or no trust in AI-generated code.
  [Google Cloud DORA announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)
- Stack Overflow's 2025 survey reports that 51% of professional developers use
  AI tools daily. Among software developers using agents at work, 84% use them
  for software development.
  [Stack Overflow 2025 AI survey](https://survey.stackoverflow.co/2025/ai)
- Anthropic's 2026 study analyzed roughly 400,000 Claude Code sessions from
  about 235,000 people and reports that Claude Code users average 20 hours per
  week in the tool.
  [Anthropic agentic-coding study](https://www.anthropic.com/research/claude-code-expertise)

The implication is not merely more generated code. Teams now have more parallel
agent work, more context trapped in individual sessions, and more output that
another human must understand, verify, or redirect.

### The remaining bottleneck is coordination

Atlassian's 2025 developer-experience study surveyed 3,500 developers and
managers. It reports that 50% of developers lose at least ten hours per week to
non-coding work, with finding information, adopting technology, context
switching, and cross-team collaboration among the top friction points. The same
study says developers spend only 16% of their time coding.
[Atlassian State of Developer Experience 2025](https://www.atlassian.com/blog/developer/developer-experience-report-2025)

This is the opening: model vendors optimize the agent; `mpai` optimizes the
human network around agents.

## Competitive reality

The category is forming quickly, which validates the need and creates platform
risk.

| Product | What it proves | Gap `mpai` can own |
|---|---|---|
| Claude Code Remote Control | A local terminal session can stay synchronized across terminal, browser, and phone, survive disconnects, and accept prompts from multiple surfaces. | The official flow is described as one user continuing their own session across devices. It does not document cross-provider team identity or named teammate authorship. [Claude Code Remote Control](https://code.claude.com/docs/en/remote-control) |
| GitHub Agent HQ | Repository members can see cloud-agent sessions, live logs, steering prompts, commits, and audit context. | It centers GitHub cloud-agent jobs and PRs. `mpai` centers local native sessions across vendors before work becomes a PR. [GitHub agent session management](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/manage-and-track-agents) |
| ClaudeReview | Developers want one-command, cross-provider sharing of Claude Code, Codex, and Gemini transcripts for review. | It publishes encrypted read-only artifacts and deep links. `mpai` joins an owner-hosted live session and preserves the teammate's identity on new prompts. [ClaudeReview](https://claudereview.com/) |
| AQ | Teams will pay for multiplayer agent workspaces with identity, access control, live terminals, editors, and previews. | It moves work into a shared cloud workspace. `mpai` is the narrower native layer for sessions already running on teammates' own machines. [AQ session-sharing guide](https://aq.dev/guides/share-a-claude-code-session-with-your-team/) |
| VS Code Live Share | Developers value real-time identity, host/guest permissions, shared terminals, and following collaborators. | It is editor- and terminal-sharing rather than an AI-session directory; Microsoft now labels it maintenance mode. [Microsoft Live Share](https://learn.microsoft.com/en-us/visualstudio/liveshare/use/share-project-join-session-visual-studio-code) |
| Cursor Teams | Companies already pay for centralized billing, administration, model controls, SCIM, audit logs, and service accounts around AI development. | Cursor owns one editor. `mpai` should remain provider- and surface-neutral. [Cursor pricing](https://cursor.com/pricing) |

The dangerous assumption would be that “shared agent sessions” itself is a
durable moat. It is becoming a feature. The moat must be the provider-neutral
identity, permission, presence, and context protocol plus distribution across
the tools a company already has.

## Bottom-up market sizing

These are scenarios, not forecasts, and they should not be added together.

### Validated paid-seat base

At a proposed team price of $15 per active collaborator per month:

| Scenario | Annual recurring revenue |
|---|---:|
| 4.7M current paid Copilot subscribers × $15 × 12 | $846M seat-market reference |
| 2% penetration of that paid-user base | $16.9M ARR |
| 5% penetration | $42.3M ARR |
| 10% penetration | $84.6M ARR |

This is a conservative serviceable anchor because it excludes paying Claude
Code, Codex, Cursor, and other agent users who are not paid Copilot
subscribers. It also assumes `mpai` is valuable only to existing paid AI-tool
users.

### Organization base

Using Microsoft's nearly 140,000 Copilot organizations as a buyer universe:

| Scenario | Annual recurring revenue |
|---|---:|
| 5% of organizations × 25 seats × $15 × 12 | $31.5M ARR |
| 1% of organizations × 100 seats × $15 × 12 | $25.2M ARR |

This is not evidence that the average organization has 25 or 100 suitable
seats. It shows that modest penetration of an already-paying organization base
can produce venture-scale revenue.

### ROI inside a 100-engineer company

One hundred seats at $15 per month is $18,000 ARR. The U.S. Bureau of Labor
Statistics reports a May 2025 median software-developer wage of $65.38 per hour.
At that wage, each seat pays for itself by saving about 2.75 engineering hours
per year—roughly 14 minutes per developer per month, before benefits and
overhead.
[BLS May 2025 wage data](https://www.bls.gov/news.release/ocwage.t01.htm)

The price is therefore easy to justify if joining the exact agent context
avoids even one status meeting, screen-share setup, re-explanation, or botched
handoff per engineer each year.

## Beachhead and expansion

### Wedge: 2–10 person AI-native teams

- Founders already trust each other and share broad project context.
- They mix Claude Code, Codex, Cursor, and terminals.
- The pain is immediate and setup can rely on Tailscale.
- Sales can be product-led: invite one teammate, open one room.

### Expansion: 10–200 person engineering organizations

- Sharing defaults change from “cofounder sees all” to explicit person,
  project, and team scopes.
- High-value workflows become incident response, expert escalation, onboarding,
  architecture review, and shift handoff.
- Buyers are engineering leaders and developer-platform teams.

### Enterprise: hundreds or thousands of developers

- SSO/SCIM, device posture, MDM deployment, RBAC, retention, audit export,
  regional routing, and policy become mandatory.
- A central control plane should store directory, policy, presence, and minimal
  session metadata—not raw transcripts by default.
- Peer traffic and transcript access should remain end-to-end and owner
  controlled where possible.

## Business model hypothesis

- Free: two people, limited active shared sessions, local/tailnet transport.
- Team: $15 per active collaborator per month, team/project sharing, history,
  notifications, and support.
- Enterprise: $25+ per seat per month or platform minimum, with SSO/SCIM, audit,
  MDM, retention policy, and support commitments.

Pricing should be tested against repeated collaboration value, not model usage;
the customer already pays the model vendor. Charging another usage tax would
make the product feel like an expensive relay.

## What would falsify the thesis

1. Teammates open sessions but rarely contribute a prompt or decision.
2. The behavior is limited to rare debugging calls rather than a weekly habit.
3. Teams prefer sharing summaries, PRs, or screens and do not value live context.
4. Claude, Codex, and GitHub ship cross-user, cross-provider identity before
   `mpai` establishes a neutral network.
5. Security teams reject local transcript exposure even with explicit sharing.
6. Tailscale is too much setup outside deeply technical early adopters.

The alpha must measure these directly. Market size is earned only if teams
repeatedly join and steer each other's work.

## Defensible product direction

- Make the open session/identity protocol work across every major coding agent.
- Be the neutral directory of people, devices, projects, and authorized live
  agent sessions.
- Preserve consent and authorship as first-class data.
- Integrate with GitHub, Linear, Slack, incident tools, and developer portals
  without forcing work into those interfaces.
- Build organization policy and observability around collaboration quality, not
  employee surveillance or transcript mining.

The long-term category is larger than pair programming: it is multiplayer
infrastructure for human teams operating fleets of agents. Coding is the best
initial wedge because the sessions, tools, budgets, and urgency already exist.
