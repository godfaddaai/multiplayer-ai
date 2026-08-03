import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { ClaudeProvider, normalizeClaudeStreamEvent } from "../src/claude.js";
import { TaskHub } from "../src/hub.js";

const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function claudeFixture() {
  const root = await mkdtemp(join(tmpdir(), "mpai-claude-"));
  const configDir = join(root, ".claude");
  const projectDir = join(configDir, "projects", "-tmp-team-project");
  const workspace = join(root, "team-project");
  const sessionId = "11111111-2222-4333-8444-555555555555";
  const transcript = join(projectDir, `${sessionId}.jsonl`);
  const mockCli = join(root, "mock-claude.mjs");
  await mkdir(projectDir, { recursive: true });
  await mkdir(workspace, { recursive: true });
  await writeFile(
    transcript,
    [
      JSON.stringify({ type: "ai-title", aiTitle: "Ship the multiplayer layer", sessionId }),
      JSON.stringify({
        type: "user",
        sessionId,
        uuid: "user-1",
        timestamp: "2026-08-01T20:00:00.000Z",
        cwd: workspace,
        message: { role: "user", content: "Build the adapter." },
      }),
      JSON.stringify({
        type: "assistant",
        sessionId,
        uuid: "assistant-1",
        timestamp: "2026-08-01T20:01:00.000Z",
        cwd: workspace,
        message: { role: "assistant", content: [{ type: "text", text: "Adapter ready." }] },
      }),
      JSON.stringify({
        type: "user",
        sessionId,
        uuid: "user-2",
        timestamp: "2026-08-01T20:02:00.000Z",
        cwd: workspace,
        message: { role: "user", content: [{ type: "text", text: "[Multiplayer teammate: Maya]\nRun the checks." }] },
      }),
    ].join("\n") + "\n",
  );
  await writeFile(
    mockCli,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (!args.includes("--resume") || !args.includes("dontAsk")) process.exit(2);
console.log(JSON.stringify({type:"stream_event",event:{type:"content_block_delta",delta:{type:"text_delta",text:"Shared "}}}));
console.log(JSON.stringify({type:"stream_event",event:{type:"content_block_delta",delta:{type:"text_delta",text:"reply"}}}));
console.log(JSON.stringify({type:"assistant",message:{content:[{type:"text",text:"Shared reply"}]}}));
console.log(JSON.stringify({type:"result",is_error:false,session_id:"${sessionId}",result:"Shared reply"}));
`,
  );
  await chmod(mockCli, 0o755);
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  return { configDir, mockCli, sessionId, workspace };
}

test("Claude adapter discovers titled sessions and normalizes attributed transcript messages", async () => {
  const fixture = await claudeFixture();
  const claude = new ClaudeProvider({ configDir: fixture.configDir, claudeBin: fixture.mockCli });
  await claude.start();
  const tasks = await claude.listTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, `claude:${fixture.sessionId}`);
  assert.equal(tasks[0].title, "Ship the multiplayer layer");
  assert.equal(tasks[0].cwd, fixture.workspace);
  const result = await claude.readTask(fixture.sessionId);
  assert.deepEqual(
    result.task.messages.map((message) => [message.author, message.text]),
    [
      ["Host", "Build the adapter."],
      ["Claude", "Adapter ready."],
      ["Maya", "Run the checks."],
    ],
  );
});
test("Claude adapter resumes the exact session and streams a named teammate turn", async () => {
  const fixture = await claudeFixture();
  const claude = new ClaudeProvider({ configDir: fixture.configDir, claudeBin: fixture.mockCli });
  await claude.start();
  const events = [];
  const result = await claude.prompt({
    nativeId: fixture.sessionId,
    text: "What changed?",
    actor: { name: "Maya" },
    requestId: "request-claude",
    onEvent: (event) => events.push(event),
  });
  assert.equal(result.finalText, "Shared reply");
  assert.equal(result.turn.status, "completed");
  assert.equal(events[0].type, "turn.accepted");
  assert.equal(events.filter((event) => event.type === "agent.delta").length, 2);
  assert.equal(events.filter((event) => event.type === "agent.message").length, 0);
  assert.equal(events.at(-1).type, "turn.completed");
});

test("Claude adapter terminates a silent turn after its inactivity deadline", async () => {
  const fixture = await claudeFixture();
  await writeFile(
    fixture.mockCli,
    "#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n",
  );
  const claude = new ClaudeProvider({
    configDir: fixture.configDir,
    claudeBin: fixture.mockCli,
    turnIdleTimeoutMs: 30,
  });
  await claude.start();
  await assert.rejects(
    claude.prompt({
      nativeId: fixture.sessionId,
      text: "Wait forever",
      actor: { name: "Maya" },
    }),
    { code: "CLAUDE_TURN_STALLED" },
  );
});

test("Claude adapter terminates a turn when the remote teammate disconnects", async () => {
  const fixture = await claudeFixture();
  await writeFile(
    fixture.mockCli,
    "#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n",
  );
  const claude = new ClaudeProvider({
    configDir: fixture.configDir,
    claudeBin: fixture.mockCli,
    turnIdleTimeoutMs: 60_000,
  });
  await claude.start();
  const controller = new AbortController();
  const prompt = claude.prompt({
    nativeId: fixture.sessionId,
    text: "Wait forever",
    actor: { name: "Maya" },
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(prompt, { code: "CLIENT_DISCONNECTED" });
});

test("provider hub merges, sorts, and routes namespaced tasks", async () => {
  const fixture = await claudeFixture();
  const claude = new ClaudeProvider({ configDir: fixture.configDir, claudeBin: fixture.mockCli });
  const mock = {
    id: "mock",
    name: "Mock Agent",
    transport: "test",
    async start() {},
    async listTasks() {
      return [{
        id: "mock:newer",
        nativeId: "newer",
        provider: "mock",
        providerName: "Mock Agent",
        title: "Newer task",
        updatedAt: "2026-08-02T00:00:00.000Z",
      }];
    },
    async readTask(nativeId) { return { task: { id: `mock:${nativeId}` } }; },
    async close() {},
  };
  const hub = new TaskHub({ providers: [claude, mock] });
  await hub.start();
  const tasks = await hub.listTasks({ limit: 10 });
  assert.equal(tasks[0].id, "mock:newer");
  assert.equal(tasks.some((task) => task.provider === "claude"), true);
  assert.equal((await hub.readTask("mock:newer")).task.id, "mock:newer");
  await hub.close();
});

test("Claude stream normalization ignores tools and preserves text deltas", () => {
  assert.equal(normalizeClaudeStreamEvent({ type: "tool" }), null);
  assert.deepEqual(
    normalizeClaudeStreamEvent({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hi" } },
    }, { taskId: "claude:one", requestId: "request-one" }),
    {
      type: "agent.delta",
      provider: "claude",
      taskId: "claude:one",
      requestId: "request-one",
      text: "Hi",
    },
  );
});
