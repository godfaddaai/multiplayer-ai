import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { test } from "node:test";
import { CodexProvider } from "../src/hub.js";
import { TerminalRoom } from "../src/pair.js";

function captureStream() {
  let text = "";
  const output = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      callback();
    },
  });
  output.isTTY = false;
  return { output, text: () => text };
}

test("terminal room mirrors a teammate session, prompts it, and switches sessions", async () => {
  const input = new PassThrough();
  input.isTTY = false;
  const capture = captureStream();
  const prompts = [];
  const reads = [];
  const presenceUpdates = [];
  const tasks = [
    {
      id: "claude:session-one",
      nativeId: "session-one",
      provider: "claude",
      providerName: "Claude Code",
      title: "Build multiplayer",
      cwd: "/Users/test/project",
      canPrompt: true,
    },
    {
      id: "codex:session-two",
      nativeId: "session-two",
      provider: "codex",
      providerName: "Codex",
      title: "Review the protocol",
      cwd: "/Users/test/project",
      canPrompt: true,
    },
  ];
  const messages = new Map([
    [tasks[0].id, [
      { id: "one", role: "user", author: "Maya", text: "Start the shared layer." },
      { id: "two", role: "assistant", author: "Claude", text: "Working on it." },
    ]],
    [tasks[1].id, [
      { id: "three", role: "user", author: "Maya", text: "Review the protocol." },
    ]],
  ]);
  const client = {
    async whoami() {
      return { role: "participant", host: { name: "Maya" }, actor: { name: "Alex" } };
    },
    async listTasks() { return { data: tasks }; },
    async readTask(taskId, options) {
      reads.push({ taskId, options });
      const task = tasks.find((candidate) => candidate.id === taskId);
      return { task: { ...task, messages: messages.get(taskId) } };
    },
    async prompt(taskId, text, { onEvent }) {
      prompts.push({ taskId, text });
      onEvent({ type: "turn.accepted", provider: "claude", actor: { name: "Alex" } });
      onEvent({ type: "agent.delta", text: "Shared " });
      onEvent({ type: "agent.delta", text: "reply" });
      onEvent({ type: "turn.completed", status: "completed" });
      messages.get(taskId).push(
        { id: "four", role: "user", author: "Alex", text },
        { id: "five", role: "assistant", author: "Claude", text: "Shared reply" },
      );
      return { type: "request.completed" };
    },
    async setPresence(record) {
      presenceUpdates.push(record);
      return { data: [{ ...record, actor: { name: "Alex" } }] };
    },
    async presence() {
      return {
        data: [
          { taskId: tasks[1].id, actor: { name: "Alex" } },
          { taskId: tasks[1].id, actor: { name: "Maya" } },
        ],
      };
    },
  };
  const room = new TerminalRoom({
    client,
    peer: { id: "maya", name: "Maya" },
    identity: { id: "alex", name: "Alex" },
    input,
    output: capture.output,
    pollIntervalMs: 60_000,
  });
  const running = room.start();
  setTimeout(() => {
    input.write("What should I review?\n");
    input.write("/sessions\n");
    input.write("/switch 2\n");
    input.write("/who\n");
    input.write("/leave\n");
  }, 20);
  await running;

  const output = capture.text();
  assert.match(output, /Maya.*Claude Code/su);
  assert.match(output, /MAYA\nStart the shared layer\./u);
  assert.match(output, /Alex → Claude Code/u);
  assert.match(output, /Shared reply/u);
  assert.match(output, /Maya’s AI sessions/u);
  assert.match(output, /Review the protocol/u);
  assert.match(output, /Following: Alex, Maya/u);
  assert.deepEqual(prompts, [{ taskId: tasks[0].id, text: "What should I review?" }]);
  assert.ok(reads.length >= 2);
  assert.ok(reads.every((read) => read.options.tail === 100));
  assert.equal(presenceUpdates.at(-1).state, "offline");
});

test("Codex transcripts recover the named multiplayer author", async () => {
  const provider = new CodexProvider({
    transport: "proxy",
    async readThread() {
      return {
        thread: {
          id: "codex-one",
          name: "Shared Codex task",
          turns: [{
            startedAt: "2026-08-01T20:00:00.000Z",
            items: [{
              id: "user-one",
              type: "userMessage",
              content: [{
                type: "text",
                text: "[Multiplayer teammate: Alex]\nCheck Maya’s current approach.",
              }],
            }],
          }],
        },
      };
    },
  });
  const result = await provider.readTask("codex-one");
  assert.equal(result.task.messages[0].author, "Alex");
  assert.equal(result.task.messages[0].text, "Check Maya’s current approach.");
});

test("Codex transcripts use the bounded local rollout with lightweight metadata", async () => {
  const reads = [];
  const provider = new CodexProvider({
    transport: "proxy",
    async readThread(nativeId, options) {
      reads.push({ nativeId, options });
      return { thread: { id: nativeId, name: "Large shared task" } };
    },
  }, {
    rolloutReader: {
      async readMessages() {
        return {
          truncated: true,
          messages: [
            { id: "one", role: "user", text: "[Multiplayer teammate: Alex]\nReview this.", at: null },
            { id: "two", role: "assistant", text: "Reviewing.", at: null },
          ],
        };
      },
    },
  });

  const result = await provider.readTask("019fafc4-0bc4-73f0-a8b4-70281a9c25c9");
  assert.deepEqual(reads, [{
    nativeId: "019fafc4-0bc4-73f0-a8b4-70281a9c25c9",
    options: { includeTurns: false },
  }]);
  assert.equal(result.task.messages[0].author, "Alex");
  assert.equal(result.task.messages[1].author, "Codex");
  assert.deepEqual(result.task.transcriptWindow, {
    returned: 2,
    total: null,
    truncated: true,
  });
});
