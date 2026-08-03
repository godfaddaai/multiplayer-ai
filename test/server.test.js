import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigStore } from "../src/config.js";
import { MpaiClient } from "../src/client.js";
import { createMpaiServer, listen } from "../src/server.js";

const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function fixture(
  role,
  {
    promptError,
    transport = "mock",
    allowStandalonePrompts = false,
    recoverManaged = false,
    promptHandler,
    now,
    share = "all",
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "mpai-server-"));
  const configStore = new ConfigStore({ root });
  await configStore.setup({ name: "Alex", port: 7337 });
  const invite = await configStore.createInvite({
    name: "Maya",
    role,
    share,
    address: "127.0.0.1",
    port: 7337,
  });
  let currentTransport = transport;
  const codex = {
    get transport() {
      return currentTransport;
    },
    async ensureManagedForPrompt() {
      if (recoverManaged) currentTransport = "proxy";
    },
    async listThreads() {
      return {
        data: [
          {
            id: "thread_123456789",
            name: "Multiplayer build",
            status: { type: "idle" },
          },
        ],
        nextCursor: null,
      };
    },
    async readThread(threadId) {
      return {
        thread: {
          id: threadId,
          name: "Multiplayer build",
          status: { type: "idle" },
          turns: [],
        },
      };
    },
    async prompt({ threadId, actor, requestId, onEvent, signal }) {
      if (promptHandler) {
        return promptHandler({ threadId, actor, requestId, onEvent, signal });
      }
      if (promptError) throw promptError;
      onEvent({
        type: "turn.accepted",
        threadId,
        turnId: "turn_1",
        actor,
        requestId,
      });
      onEvent({
        type: "agent.delta",
        threadId,
        turnId: "turn_1",
        text: "Shared reply",
      });
      onEvent({
        type: "turn.completed",
        threadId,
        turnId: "turn_1",
        status: "completed",
      });
      return {
        requestId,
        threadId,
        turnId: "turn_1",
        turn: { id: "turn_1", status: "completed" },
        finalText: "Shared reply",
      };
    },
  };
  const server = createMpaiServer({
    configStore,
    codex,
    identityResolver: async () => ({
      userId: "maya-user",
      displayName: "Maya Real",
      loginName: "maya@example.com",
      device: "Maya Mac",
      address: "127.0.0.1",
    }),
    allowStandalonePrompts,
    ...(now ? { now } : {}),
    logger: { error() {} },
  });
  const address = await listen(server, { host: "127.0.0.1", port: 0 });
  const parsed = new URL(invite.url);
  const client = new MpaiClient({
    baseUrl: `http://127.0.0.1:${address.port}`,
    token: parsed.searchParams.get("token"),
    identity: { name: "Maya" },
  });
  cleanups.push(
    () => new Promise((resolve) => server.close(resolve)),
    () => rm(root, { recursive: true, force: true }),
  );
  return { client, configStore, invitation: invite.invitation };
}

test("viewer can list and read real tasks", async () => {
  const { client } = await fixture("viewer");
  const identity = await client.whoami();
  assert.equal(identity.actor.name, "Maya");
  assert.equal(identity.role, "viewer");
  const threads = await client.listThreads();
  assert.equal(threads.data[0].name, "Multiplayer build");
  const result = await client.readThread("thread_123456789");
  assert.equal(result.thread.id, "thread_123456789");
});

test("malformed and oversized bearer credentials are rejected", async () => {
  const { client } = await fixture("viewer");
  for (const authorization of [
    `Bearer ${" ".repeat(1024)}`,
    "Bearer token with spaces",
    "Basic dGVzdDp0ZXN0",
  ]) {
    const response = await fetch(`${client.baseUrl}/v1/whoami`, {
      headers: { authorization },
    });
    assert.equal(response.status, 401);
  }
  assert.equal((await client.whoami()).role, "viewer");
});

test("viewer cannot prompt", async () => {
  const { client } = await fixture("viewer");
  await assert.rejects(
    client.prompt("thread_123456789", "Do work"),
    { code: "FORBIDDEN" },
  );
});

test("selected sharing hides session metadata and blocks direct access", async () => {
  const { client, configStore } = await fixture("participant", {
    share: "selected",
  });
  let tasks = await client.listTasks();
  assert.equal(tasks.data.length, 0);
  await assert.rejects(
    client.readTask("thread_123456789"),
    { code: "TASK_NOT_SHARED" },
  );
  await assert.rejects(
    client.prompt("thread_123456789", "Do work"),
    { code: "TASK_NOT_SHARED" },
  );

  await configStore.updateTaskAccess("Maya", {
    taskId: "thread_123456789",
    action: "share",
  });
  tasks = await client.listTasks();
  assert.equal(tasks.data[0].name, "Multiplayer build");
  await client.prompt("thread_123456789", "Now shared", {
    requestId: "shared-request",
  });

  await configStore.updateTaskAccess("Maya", {
    taskId: "thread_123456789",
    action: "unshare",
  });
  const audit = await client.audit();
  assert.equal(audit.data.length, 0);
});

test("participant prompt streams attributed events and is audited", async () => {
  const { client } = await fixture("participant");
  const events = [];
  const result = await client.prompt("thread_123456789", "Do work", {
    requestId: "request-once",
    onEvent: (event) => events.push(event),
  });
  assert.equal(result.type, "request.completed");
  assert.equal(events.some((event) => event.type === "agent.delta"), true);
  assert.equal(
    events.find((event) => event.type === "turn.accepted").actor.name,
    "Maya",
  );
  const audit = await client.audit();
  assert.deepEqual(
    audit.data.map((event) => event.type),
    ["prompt.received", "prompt.completed"],
  );

  await assert.rejects(
    client.prompt("thread_123456789", "Duplicate", {
      requestId: "request-once",
    }),
    { code: "PROMPT_CONFLICT" },
  );
});

test("disconnecting a prompt aborts provider work and releases the task lock", async () => {
  let calls = 0;
  let resolveAborted;
  const aborted = new Promise((resolve) => { resolveAborted = resolve; });
  const { client } = await fixture("participant", {
    promptHandler({ threadId, actor, requestId, onEvent, signal }) {
      calls += 1;
      if (calls > 1) {
        return {
          requestId,
          threadId,
          turnId: "turn_recovered",
          turn: { id: "turn_recovered", status: "completed" },
          finalText: "Recovered",
        };
      }
      onEvent({ type: "turn.accepted", threadId, turnId: "turn_stalled", actor });
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => {
          resolveAborted();
          reject(Object.assign(new Error("Remote teammate disconnected"), {
            code: "CLIENT_DISCONNECTED",
          }));
        }, { once: true });
      });
    },
  });
  const response = await fetch(
    `${client.baseUrl}/v1/tasks/thread_123456789/prompt`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${client.token}`,
        "content-type": "application/json",
        "idempotency-key": "request-disconnect",
      },
      body: JSON.stringify({ text: "Start and disconnect" }),
    },
  );
  assert.equal(response.status, 200);
  await response.body.cancel();
  await aborted;
  await new Promise((resolve) => setTimeout(resolve, 20));

  const result = await client.prompt("thread_123456789", "Try again", {
    requestId: "request-after-disconnect",
  });
  assert.equal(result.type, "request.completed");
  const audit = await client.audit();
  assert.deepEqual(
    audit.data.map((event) => event.type),
    ["prompt.received", "prompt.failed", "prompt.received", "prompt.completed"],
  );
});

test("streamed Codex failure becomes a client error and failed audit event", async () => {
  const failure = Object.assign(new Error("Codex unavailable"), {
    code: "CODEX_UNAVAILABLE",
  });
  const { client } = await fixture("participant", { promptError: failure });
  await assert.rejects(
    client.prompt("thread_123456789", "Do work", {
      requestId: "request-fails",
    }),
    { code: "CODEX_UNAVAILABLE" },
  );
  const audit = await client.audit();
  assert.deepEqual(
    audit.data.map((event) => event.type),
    ["prompt.received", "prompt.failed"],
  );
});

test("standalone mode blocks prompts unless host explicitly opts in", async () => {
  const { client } = await fixture("participant", {
    transport: "standalone",
  });
  await assert.rejects(
    client.prompt("thread_123456789", "Do work"),
    { code: "STANDALONE_PROMPTS_DISABLED" },
  );
});

test("a recovered managed daemon is promoted before prompt safety is checked", async () => {
  const { client } = await fixture("participant", {
    transport: "standalone",
    recoverManaged: true,
  });
  const result = await client.prompt("thread_123456789", "Do work");
  assert.equal(result.type, "request.completed");
});

test("host can explicitly enable standalone prompts for an idle task", async () => {
  const { client } = await fixture("participant", {
    transport: "standalone",
    allowStandalonePrompts: true,
  });
  const result = await client.prompt("thread_123456789", "Do work");
  assert.equal(result.type, "request.completed");
});

test("named presence heartbeats are visible and expire", async () => {
  let clock = Date.parse("2026-08-01T20:00:00.000Z");
  const { client } = await fixture("viewer", {
    now: () => clock,
  });
  await client.setPresence({ taskId: "thread_123456789", state: "viewing" });
  let result = await client.presence();
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].actor.name, "Maya");
  assert.equal(result.data[0].taskId, "thread_123456789");
  clock += 46_000;
  result = await client.presence();
  assert.equal(result.data.length, 0);
  await client.setPresence({ taskId: "thread_123456789", state: "viewing" });
  await client.setPresence({ state: "offline" });
  result = await client.presence();
  assert.equal(result.data.length, 0);
});
