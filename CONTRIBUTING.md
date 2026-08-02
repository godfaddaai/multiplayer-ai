# Contributing to mpai

Thanks for helping make AI work multiplayer.

mpai sits on a sensitive boundary: it reads local agent transcripts and can add
turns to explicitly shared sessions. Changes that make the product feel easier
but weaken identity, sharing, permission, or audit guarantees will not be
accepted.

## Before you start

- For a bug, open the bug report and include the smallest reproducible case.
- For a meaningful feature or protocol change, open a proposal first so we can
  agree on the security and provider boundary.
- Never attach real transcripts, invite URLs, tokens, tailnet IPs, account
  identifiers, or unredacted config files to a public issue.
- Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Local setup

~~~bash
git clone https://github.com/godfaddaai/multiplayer-ai.git
cd multiplayer-ai
npm install
npm run verify
~~~

Node.js 20 or newer is required.

## Development principles

1. Keep the terminal as the primary product interface.
2. Keep provider integrations behind the shared provider contract.
3. Fail closed when identity, role, task access, or provider state is unclear.
4. Use saved fixtures and narrow unit tests before touching a live session.
5. Do not add arbitrary shell execution or remote approval delegation.
6. Do not collect transcript content for analytics.
7. Preserve clear authorship for every human turn.

## Pull requests

A good pull request:

- solves one coherent problem;
- includes tests for behavior and failure boundaries;
- updates public docs when commands or guarantees change;
- runs <code>npm run verify</code>;
- avoids drive-by formatting or unrelated dependency changes;
- explains any live-provider validation performed without including sensitive
  receipts.

Provider changes should add or update fixtures for every novel persisted event
shape encountered. Security-sensitive changes should state the threat they
address and the expected fail-closed behavior.

## Commit style

Use short, imperative subjects such as:

~~~text
Add task-level invite revocation
Reject prompts for unshared sessions
Document managed Codex attachment
~~~

## License

By contributing, you agree that your contribution is licensed under the
project's [MIT License](./LICENSE).
