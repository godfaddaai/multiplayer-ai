import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { ConfigStore } from "../src/config.js";
import { createDashboardServer, listenDashboard } from "../src/dashboard.js";

const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "mpai-dashboard-"));
  const store = new ConfigStore({ root });
  await store.setup({ name: "Alex", port: 7337 });
  await store.addPeer({
    name: "Maya",
    baseUrl: "http://100.64.0.2:7337",
    token: "peer-secret-must-not-reach-browser",
    hostIdentity: { id: "maya-id", name: "Maya" },
  });
  const presence = [];
  const client = {
    async whoami() {
      return {
        role: "participant",
        host: { id: "maya-id", name: "Maya" },
        actor: { id: "alex-id", name: "Alex" },
      };
    },
    async listTasks() {
      return {
        data: [{
          id: "claude:11111111-2222-4333-8444-555555555555",
          nativeId: "11111111-2222-4333-8444-555555555555",
          provider: "claude",
          providerName: "Claude Code",
          title: "Shared Claude task",
          canPrompt: true,
        }],
      };
    },
    async readTask(taskId) {
      return {
        task: {
          id: taskId,
          provider: "claude",
          providerName: "Claude Code",
          title: "Shared Claude task",
          canPrompt: true,
          messages: [{ role: "assistant", author: "Claude", text: "Context" }],
        },
      };
    },
    async prompt(taskId, text, { onEvent }) {
      onEvent({ type: "turn.accepted", taskId, actor: { name: "Alex" }, provider: "claude" });
      onEvent({ type: "agent.delta", taskId, text: `Reply to ${text}` });
      onEvent({ type: "turn.completed", taskId, status: "completed" });
      return { turn: { status: "completed" } };
    },
    async presence() { return { data: presence }; },
    async setPresence(record) {
      presence.splice(0, presence.length, { ...record, actor: { name: "Alex" } });
      return { data: presence };
    },
    async audit() { return { data: [] }; },
  };
  const server = createDashboardServer({
    configStore: store,
    clientFactory: () => client,
    token: "dashboard-test-token",
    logger: { error() {} },
  });
  const address = await listenDashboard(server, { port: 0 });
  const baseUrl = `http://127.0.0.1:${address.port}`;
  cleanups.push(
    () => new Promise((resolve) => server.close(resolve)),
    () => rm(root, { recursive: true, force: true }),
  );
  return { baseUrl };
}

function headers() {
  return { "x-mpai-dashboard-token": "dashboard-test-token" };
}

test("dashboard serves a CSP-protected app without exposing peer credentials", async () => {
  const { baseUrl } = await fixture();
  const response = await fetch(baseUrl);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/u);
  assert.match(html, /dashboard-test-token/u);
  assert.doesNotMatch(html, /peer-secret/u);

  const unauthorized = await fetch(`${baseUrl}/api/bootstrap`);
  assert.equal(unauthorized.status, 401);
  const bootstrap = await fetch(`${baseUrl}/api/bootstrap`, { headers: headers() });
  const payload = await bootstrap.json();
  assert.equal(payload.identity.name, "Alex");
  assert.equal(payload.peers[0].name, "Maya");
  assert.equal(Object.hasOwn(payload.peers[0], "token"), false);
  assert.equal(Object.hasOwn(payload.peers[0], "credential"), false);
});

test("dashboard proxies provider-neutral tasks, presence, and prompt streams", async () => {
  const { baseUrl } = await fixture();
  const peers = await (await fetch(`${baseUrl}/api/peers`, { headers: headers() })).json();
  assert.equal(peers.data[0].online, true);
  assert.equal(peers.data[0].role, "participant");

  const tasks = await (
    await fetch(`${baseUrl}/api/peers/maya-id/tasks`, { headers: headers() })
  ).json();
  const taskId = tasks.data[0].id;
  assert.equal(tasks.data[0].provider, "claude");

  const task = await (
    await fetch(`${baseUrl}/api/peers/maya-id/tasks/${encodeURIComponent(taskId)}`, { headers: headers() })
  ).json();
  assert.equal(task.task.messages[0].author, "Claude");

  const heartbeat = await fetch(`${baseUrl}/api/peers/maya-id/presence`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify({ taskId, state: "viewing" }),
  });
  assert.equal(heartbeat.status, 200);

  const prompt = await fetch(
    `${baseUrl}/api/peers/maya-id/tasks/${encodeURIComponent(taskId)}/prompt`,
    {
      method: "POST",
      headers: { ...headers(), "content-type": "application/json" },
      body: JSON.stringify({ text: "Ship it" }),
    },
  );
  const events = (await prompt.text()).trim().split("\n").map(JSON.parse);
  assert.deepEqual(events.map((event) => event.type), [
    "turn.accepted",
    "agent.delta",
    "turn.completed",
  ]);
  assert.equal(events[0].actor.name, "Alex");
});
