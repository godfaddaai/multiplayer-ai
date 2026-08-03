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

function identifiedFetch(identity) {
  return (url, options = {}) => fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "x-mpai-test-identity": identity,
    },
  });
}

test("one host isolates, coordinates, collides, and revokes two teammates", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-concurrency-"));
  const configStore = new ConfigStore({ root });
  await configStore.setup({ name: "Hudson", port: 7337 });

  const tasks = [
    {
      id: "claude:shared-session",
      nativeId: "shared-session",
      provider: "claude",
      providerName: "Claude Code",
      title: "Shared session",
      canPrompt: true,
      messages: [],
    },
    {
      id: "codex:private-session",
      nativeId: "private-session",
      provider: "codex",
      providerName: "Codex",
      title: "Private session",
      canPrompt: true,
      messages: [],
    },
  ];
  let releaseFirstPrompt;
  let markFirstPromptStarted;
  const firstPromptStarted = new Promise((resolve) => {
    markFirstPromptStarted = resolve;
  });
  const firstPromptGate = new Promise((resolve) => {
    releaseFirstPrompt = resolve;
  });
  const received = [];
  const hub = {
    status() {
      return [
        { id: "claude", name: "Claude Code", available: true, transport: "test-resume" },
        { id: "codex", name: "Codex", available: true, transport: "managed" },
      ];
    },
    async listTasks() {
      return tasks;
    },
    async readTask(taskId) {
      return { task: tasks.find((task) => task.id === taskId) };
    },
    resolve(taskId) {
      const task = tasks.find((candidate) => candidate.id === taskId);
      return {
        provider: {
          id: task.provider,
          name: task.providerName,
          transport: task.provider === "codex" ? "managed" : "test-resume",
        },
      };
    },
    async prompt({ taskId, text, actor, requestId, onEvent }) {
      received.push({ taskId, text, actor, requestId });
      markFirstPromptStarted();
      await firstPromptGate;
      onEvent({ type: "agent.message", text: "Coordinated reply", actor });
      return {
        requestId,
        turnId: "turn-concurrent",
        turn: { id: "turn-concurrent", status: "completed" },
        finalText: "Coordinated reply",
      };
    },
  };

  const identities = {
    reagan: {
      userId: "reagan-tailnet",
      displayName: "Reagan Real",
      loginName: "reagan@example.com",
      device: "Reagan Mac",
    },
    taylor: {
      userId: "taylor-tailnet",
      displayName: "Taylor Real",
      loginName: "taylor@example.com",
      device: "Taylor Mac",
    },
  };
  const server = createMpaiServer({
    configStore,
    hub,
    identityResolver: async (_address, { request }) => {
      const identity = identities[request.headers["x-mpai-test-identity"]];
      assert.ok(identity, "test request has a known simulated tailnet identity");
      return identity;
    },
    logger: { error() {} },
  });
  const address = await listen(server, { host: "127.0.0.1", port: 0 });
  const reaganInvite = await configStore.createInvite({
    name: "Reagan",
    role: "participant",
    share: "all",
    address: "127.0.0.1",
    port: address.port,
  });
  const taylorInvite = await configStore.createInvite({
    name: "Taylor",
    role: "participant",
    share: "selected",
    address: "127.0.0.1",
    port: address.port,
  });
  await configStore.updateTaskAccess("Taylor", {
    taskId: "claude:shared-session",
    action: "share",
  });

  const clientFrom = (invite, identity) => {
    const parsed = new URL(invite.url);
    return new MpaiClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      token: parsed.searchParams.get("token"),
      identity: { name: invite.invitation.name },
      fetchImpl: identifiedFetch(identity),
    });
  };
  const reagan = clientFrom(reaganInvite, "reagan");
  const taylor = clientFrom(taylorInvite, "taylor");
  cleanups.push(
    () => new Promise((resolve) => server.close(resolve)),
    () => rm(root, { recursive: true, force: true }),
  );

  assert.deepEqual(
    (await reagan.listTasks()).data.map((task) => task.id),
    ["claude:shared-session", "codex:private-session"],
  );
  assert.deepEqual(
    (await taylor.listTasks()).data.map((task) => task.id),
    ["claude:shared-session"],
  );
  await assert.rejects(taylor.readTask("codex:private-session"), {
    code: "TASK_NOT_SHARED",
  });

  await Promise.all([
    reagan.setPresence({ taskId: "claude:shared-session", state: "viewing" }),
    taylor.setPresence({ taskId: "claude:shared-session", state: "viewing" }),
  ]);
  assert.deepEqual(
    (await reagan.presence()).data
      .map((record) => record.actor.name)
      .sort(),
    ["Reagan", "Taylor"],
  );

  const firstPrompt = reagan.prompt(
    "claude:shared-session",
    "First coordinated turn",
    { requestId: "concurrent-first" },
  );
  await firstPromptStarted;
  await assert.rejects(
    taylor.prompt("claude:shared-session", "Overlapping turn", {
      requestId: "concurrent-second",
    }),
    { code: "PROMPT_CONFLICT" },
  );
  releaseFirstPrompt();
  await firstPrompt;
  assert.deepEqual(received.map((record) => ({
    text: record.text,
    actor: record.actor.name,
  })), [{ text: "First coordinated turn", actor: "Reagan" }]);

  await reagan.setPresence({ state: "offline" });
  await configStore.revokeInvite(reaganInvite.invitation.id);
  await assert.rejects(reagan.listTasks(), { code: "UNAUTHORIZED" });
  assert.deepEqual(
    (await taylor.listTasks()).data.map((task) => task.id),
    ["claude:shared-session"],
  );
  assert.deepEqual(
    (await taylor.presence()).data.map((record) => record.actor.name),
    ["Taylor"],
  );
});
