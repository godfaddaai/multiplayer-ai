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

test("100 attach, attributed turn, read, and leave cycles preserve order", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-soak-"));
  const configStore = new ConfigStore({ root });
  await configStore.setup({ name: "Hudson", port: 7337 });

  const task = {
    id: "claude:soak-session",
    nativeId: "soak-session",
    provider: "claude",
    providerName: "Claude Code",
    title: "Reliability soak",
    cwd: "/private/soak",
    canPrompt: true,
    messages: [
      {
        id: "host-0",
        role: "user",
        author: "Hudson",
        text: "Initial context",
        at: "2026-08-03T00:00:00.000Z",
      },
      {
        id: "agent-0",
        role: "assistant",
        author: "Claude Code",
        text: "Ready",
        at: "2026-08-03T00:00:00.001Z",
      },
    ],
  };
  let turn = 0;
  const hub = {
    status() {
      return [{
        id: "claude",
        name: "Claude Code",
        available: true,
        transport: "test-resume",
        error: null,
      }];
    },
    async listTasks() {
      return [{ ...task, messages: undefined }];
    },
    async readTask() {
      return {
        task: {
          ...task,
          messages: task.messages.map((message) => ({ ...message })),
        },
      };
    },
    resolve() {
      return {
        provider: {
          id: "claude",
          name: "Claude Code",
          transport: "test-resume",
        },
      };
    },
    async prompt({ text, actor, requestId, onEvent }) {
      turn += 1;
      const timestamp = Date.parse("2026-08-03T00:00:00.001Z") + (turn * 2);
      task.messages.push(
        {
          id: `user-${turn}`,
          role: "user",
          author: actor.name,
          text,
          at: new Date(timestamp).toISOString(),
        },
        {
          id: `agent-${turn}`,
          role: "assistant",
          author: "Claude Code",
          text: `Reply ${turn}`,
          at: new Date(timestamp + 1).toISOString(),
        },
      );
      onEvent({
        type: "agent.message",
        requestId,
        actor,
        text: `Reply ${turn}`,
      });
      return {
        requestId,
        turnId: `turn-${turn}`,
        turn: { id: `turn-${turn}`, status: "completed" },
        finalText: `Reply ${turn}`,
      };
    },
  };

  const server = createMpaiServer({
    configStore,
    hub,
    identityResolver: async () => ({
      userId: "reagan-tailnet",
      displayName: "Reagan Real",
      loginName: "reagan@example.com",
      device: "Reagan Mac",
      address: "127.0.0.1",
    }),
    logger: { error() {} },
  });
  const address = await listen(server, { host: "127.0.0.1", port: 0 });
  const invite = await configStore.createInvite({
    name: "Reagan",
    role: "participant",
    share: "all",
    address: "127.0.0.1",
    port: address.port,
  });
  const parsed = new URL(invite.url);
  const client = new MpaiClient({
    baseUrl: `http://127.0.0.1:${address.port}`,
    token: parsed.searchParams.get("token"),
    identity: { name: "Reagan" },
  });
  cleanups.push(
    () => new Promise((resolve) => server.close(resolve)),
    () => rm(root, { recursive: true, force: true }),
  );

  for (let cycle = 1; cycle <= 100; cycle += 1) {
    const listed = await client.listTasks();
    assert.deepEqual(listed.data.map((item) => item.id), [task.id]);

    await client.setPresence({ taskId: task.id, state: "viewing" });
    const attached = await client.presence();
    assert.deepEqual(
      attached.data.map((record) => ({
        name: record.actor.name,
        state: record.state,
        taskId: record.taskId,
      })),
      [{ name: "Reagan", state: "viewing", taskId: task.id }],
    );

    const before = (await client.readTask(task.id)).task.messages;
    assert.equal(before.length, 2 + ((cycle - 1) * 2));

    const events = [];
    await client.prompt(task.id, `Cycle ${cycle}`, {
      requestId: `soak-cycle-${cycle}`,
      onEvent: (event) => events.push(event),
    });
    assert.deepEqual(
      events.map((event) => event.type),
      ["prompt.received", "agent.message", "request.completed"],
    );
    assert.equal(events[0].actor.name, "Reagan");
    assert.equal(events[1].actor.name, "Reagan");

    const after = (await client.readTask(task.id)).task.messages;
    assert.equal(after.length, 2 + (cycle * 2));
    assert.deepEqual(after.slice(-2), [
      {
        id: `user-${cycle}`,
        role: "user",
        author: "Reagan",
        text: `Cycle ${cycle}`,
        at: new Date(Date.parse("2026-08-03T00:00:00.001Z") + (cycle * 2)).toISOString(),
      },
      {
        id: `agent-${cycle}`,
        role: "assistant",
        author: "Claude Code",
        text: `Reply ${cycle}`,
        at: new Date(Date.parse("2026-08-03T00:00:00.002Z") + (cycle * 2)).toISOString(),
      },
    ]);
    assert.equal(new Set(after.map((message) => message.id)).size, after.length);
    assert.deepEqual(
      after.map((message) => message.at),
      [...after].map((message) => message.at).sort(),
    );

    await client.setPresence({ state: "offline" });
    assert.deepEqual((await client.presence()).data, []);
  }

  const audit = await client.audit({ limit: 1000 });
  assert.equal(audit.data.length, 200);
  assert.deepEqual(
    audit.data.map((event) => event.type),
    Array.from({ length: 100 }, () => ["prompt.received", "prompt.completed"]).flat(),
  );
  assert.equal(
    new Set(audit.data.map((event) => event.requestId)).size,
    100,
  );
  assert.equal(audit.data.every((event) => event.actor.name === "Reagan"), true);
});
