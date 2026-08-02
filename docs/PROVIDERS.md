# Provider adapter contract

`TaskHub` in `src/hub.js` merges independent native AI tools into one remote
protocol. A provider adapter has the following shape:

```js
{
  id: "agent-id",
  name: "Agent name",
  transport: "native-seam",
  async start() {},
  async listTasks({ limit, cwd, search }) {},
  async readTask(nativeId) {},
  async prompt({ nativeId, text, actor, requestId, onEvent }) {},
  async close() {},
}
```

## Normalized task

```js
{
  id: "agent-id:native-id",
  nativeId: "native-id",
  provider: "agent-id",
  providerName: "Agent name",
  title: "Human-readable task title",
  cwd: "/host/workspace",
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp",
  status: { type: "idle | recent | active" },
  canPrompt: true,
  messages: [
    { id, role: "user | assistant", author: "Name", text, at },
  ],
}
```

`messages` is required from `readTask` and optional in list summaries.

## Normalized prompt events

Adapters should emit the smallest useful common stream:

- `turn.accepted`
- `agent.delta` and/or `agent.message`
- provider-specific tool, plan, or diff events when useful
- `turn.completed`

The server owns access control, idempotency, one-remote-turn-per-task locking,
and audit records. The adapter owns the native provider connection and must use
a supported session-resume surface for writes. Persisted transcript files are
acceptable for discovery and read-only normalization; directly appending to a
vendor transcript is not.

## Safety requirements

- Prefix the native user message with `[Multiplayer teammate: NAME]`.
- Never accept or forward a remote interactive approval.
- Never expose provider credentials or arbitrary shell endpoints.
- Keep provider-native IDs behind the provider-qualified task ID.
- Fail a prompt clearly when the native task cannot be resumed safely.
