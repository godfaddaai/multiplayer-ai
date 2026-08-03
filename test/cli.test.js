import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { afterEach, test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditStore, ConfigStore } from "../src/config.js";
import { createMpaiServer, listen } from "../src/server.js";

const execFileAsync = promisify(execFile);
const roots = [];
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function execFileWithInput(file, args, { cwd, env, input, timeoutMs = 5_000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(`child exited with ${code ?? signal}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
    child.stdin.end(input);
  });
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("a fresh install can paste an invite and reach a ready room", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-cli-"));
  roots.push(root);
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/v1/whoami") {
      response.end(JSON.stringify({
        host: { id: "maya-host", name: "Maya" },
        actor: { id: "tailscale:alex", name: "Alex" },
        role: "participant",
      }));
      return;
    }
    if (request.url?.startsWith("/v1/tasks?")) {
      response.end(JSON.stringify({
        data: [{ id: "claude:one", title: "Ship the alpha" }],
      }));
      return;
    }
    if (decodeURIComponent(request.url || "") === "/v1/tasks/claude:one") {
      response.end(JSON.stringify({
        task: {
          id: "claude:one",
          nativeId: "one",
          provider: "claude",
          providerName: "Claude Code",
          title: "Ship the alpha",
          cwd: "/tmp/mpai-alpha",
          canPrompt: true,
          messages: [{
            id: "message-one",
            role: "user",
            author: "Maya",
            text: "Prepare the launch.",
            at: "2026-08-03T09:00:00.000Z",
          }],
        },
      }));
      return;
    }
    if (request.url === "/v1/presence" && request.method === "POST") {
      response.end(JSON.stringify({ data: [] }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: { message: "not found" } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const invite = `mpai://127.0.0.1:${address.port}/join?token=fresh-secret&host=Maya`;
    const { stdout } = await execFileWithInput(
      process.execPath,
      [
        join(projectRoot, "src", "cli.js"),
        "join",
        invite,
        "--no-service",
        "--attach",
      ],
      {
        cwd: projectRoot,
        env: { ...process.env, MULTIPLAYER_AI_HOME: root },
        input: "/leave\n",
      },
    );
    assert.match(stdout, /Joined Maya as Alex \(participant\)/u);
    assert.match(stdout, /1 shared session is ready/u);
    assert.match(stdout, /Opening Maya's ready room/u);
    assert.match(stdout, /Ship the alpha/u);
    assert.match(stdout, /Prepare the launch\./u);
    assert.match(stdout, /Left Maya’s room\./u);
    assert.doesNotMatch(stdout, /Next: mpai @Maya/u);

    const config = JSON.parse(await readFile(join(root, "config.json"), "utf8"));
    assert.equal(config.identity.name, "Alex");
    assert.equal(config.peers[0].name, "Maya");
    assert.equal(config.peers[0].joinedAs.name, "Alex");
    assert.doesNotMatch(JSON.stringify(config), /fresh-secret/u);
    assert.match(await readFile(join(root, "credentials.json"), "utf8"), /fresh-secret/u);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("setup points a new host to a private participant invite", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-setup-"));
  roots.push(root);
  let stdout = "";
  try {
    const result = await execFileAsync(
      process.execPath,
      [
        join(projectRoot, "src", "cli.js"),
        "setup",
        "--name",
        "Alex",
        "--no-service",
        "--codex-bin",
        "/mpai-test/missing-codex",
        "--claude-bin",
        "/mpai-test/missing-claude",
      ],
      {
        cwd: projectRoot,
        env: { ...process.env, MULTIPLAYER_AI_HOME: root },
      },
    );
    stdout = result.stdout;
  } catch (error) {
    stdout = error.stdout || "";
  }
  assert.match(
    stdout,
    /Next: choose a session with `mpai list`, then invite a teammate with `mpai invite --name TEAMMATE --role participant --session SESSION_ID`\./u,
  );
});

test("a host can create an invite already scoped to one explicit session", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-cli-session-invite-"));
  roots.push(root);
  const stateRoot = join(root, "state");
  const claudeConfig = join(root, ".claude");
  const projectDir = join(claudeConfig, "projects", "-tmp-mpai-project");
  const sessionId = "11111111-2222-4333-8444-555555555555";
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(projectDir, `${sessionId}.jsonl`),
    `${JSON.stringify({
      type: "user",
      sessionId,
      uuid: "user-one",
      timestamp: "2026-08-03T08:00:00.000Z",
      cwd: "/tmp/mpai-project",
      message: { role: "user", content: "Prepare the alpha." },
    })}\n`,
  );
  const hostStore = new ConfigStore({ root: stateRoot });
  await hostStore.setup({ name: "Alex", port: 7337 });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      join(projectRoot, "src", "cli.js"),
      "invite",
      "--name",
      "Maya",
      "--role",
      "participant",
      "--session",
      sessionId.slice(-8),
      "--address",
      "127.0.0.1",
      "--codex-bin",
      "/mpai-test/missing-codex",
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        MULTIPLAYER_AI_HOME: stateRoot,
        CLAUDE_CONFIG_DIR: claudeConfig,
      },
    },
  );

  assert.match(stdout, /Send Maya this one line \(Node\.js 20\+; no global install\):/u);
  assert.match(
    stdout,
    /npx --yes https:\/\/github\.com\/godfaddaai\/multiplayer-ai\/releases\/download\/v0\.4\.13\/multiplayer-ai-0\.4\.13\.tgz join 'mpai:\/\/[^']+' --no-service --attach/u,
  );
  assert.match(stdout, /For a permanent install that can host sessions back:/u);
  assert.match(stdout, /brew install godfaddaai\/tap\/mpai/u);
  assert.match(stdout, /mpai join 'mpai:\/\/[^']+' --attach/u);
  assert.match(stdout, new RegExp(`claude:${sessionId} is shared with Maya as part of this invite\\.`, "u"));
  assert.doesNotMatch(stdout, /mpai share SESSION_ID/u);
  const config = JSON.parse(await readFile(join(stateRoot, "config.json"), "utf8"));
  assert.deepEqual(config.invites[0].taskAccess, {
    mode: "selected",
    taskIds: [`claude:${sessionId}`],
    excludedTaskIds: [],
  });
});

test("two isolated identities join and send an attributed prompt through the real server", async () => {
  const hostRoot = await mkdtemp(join(tmpdir(), "mpai-host-"));
  const guestRoot = await mkdtemp(join(tmpdir(), "mpai-guest-"));
  roots.push(hostRoot, guestRoot);
  const hostStore = new ConfigStore({ root: hostRoot });
  await hostStore.setup({ name: "Maya", port: 7337 });
  const received = [];
  const task = {
    id: "claude:shared-one",
    nativeId: "shared-one",
    provider: "claude",
    providerName: "Claude Code",
    title: "Ship the alpha",
    cwd: "/private/project",
    canPrompt: true,
    messages: [],
  };
  const hub = {
    status() {
      return [{
        id: "claude",
        name: "Claude Code",
        available: true,
        transport: "test-resume",
      }];
    },
    async listTasks() { return [task]; },
    async readTask() { return { task }; },
    resolve() {
      return { provider: { id: "claude", name: "Claude Code", transport: "test-resume" } };
    },
    async prompt({ taskId, text, actor, onEvent }) {
      received.push({ taskId, text, actor });
      onEvent({ type: "agent.message", text: "Attributed reply" });
      return {
        turnId: "turn-one",
        turn: { status: "completed" },
      };
    },
  };
  const server = createMpaiServer({
    configStore: hostStore,
    hub,
    identityResolver: async () => ({
      userId: "alex-tailnet",
      displayName: "Alex Real",
      loginName: "alex@example.com",
      device: "Alex Mac",
    }),
  });
  const address = await listen(server, { host: "127.0.0.1", port: 0 });
  try {
    const { url } = await hostStore.createInvite({
      name: "Alex",
      role: "participant",
      share: "all",
      address: "127.0.0.1",
      port: address.port,
    });
    const environment = { ...process.env, MULTIPLAYER_AI_HOME: guestRoot };
    const joined = await execFileAsync(
      process.execPath,
      [join(projectRoot, "src", "cli.js"), "join", url, "--no-service"],
      { cwd: projectRoot, env: environment },
    );
    assert.match(joined.stdout, /Joined Maya as Alex \(participant\)/u);

    const prompted = await execFileAsync(
      process.execPath,
      [
        join(projectRoot, "src", "cli.js"),
        "prompt",
        "@Maya",
        "shared-one",
        "Ship it safely.",
      ],
      { cwd: projectRoot, env: environment },
    );
    assert.match(prompted.stdout, /Attributed reply/u);
    assert.equal(received.length, 1);
    assert.equal(received[0].taskId, "claude:shared-one");
    assert.equal(received[0].text, "Ship it safely.");
    assert.equal(received[0].actor.name, "Alex");

    const audit = await new AuditStore({ path: hostStore.auditPath }).list();
    assert.deepEqual(audit.map((event) => event.type), [
      "prompt.received",
      "prompt.completed",
    ]);
    assert.equal(audit[0].actor.name, "Alex");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
