import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  CodexRolloutReader,
  rolloutMessage,
  visibleRolloutUserText,
} from "../src/codex-rollout.js";

function record(role, text, timestamp = "2026-08-03T12:00:00.000Z") {
  return JSON.stringify({
    timestamp,
    type: "response_item",
    payload: {
      id: `${role}-${text.slice(-8)}`,
      type: "message",
      role,
      content: [{ type: role === "assistant" ? "output_text" : "input_text", text }],
    },
  });
}

test("rollout user text removes Codex-only context while retaining the request", () => {
  const text = visibleRolloutUserText(`
    <codex_internal_context>private goal data</codex_internal_context>
    <in-app-browser-context source="ambient-ui-state">private tabs</in-app-browser-context>
    ## My request for Codex:
    Open the shared room.
  `);
  assert.equal(text, "Open the shared room.");
  assert.equal(rolloutMessage(JSON.parse(record("assistant", "Ready."))).text, "Ready.");
});

test("rollout reader tails a large active transcript without exposing tool records", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-rollout-"));
  const threadId = "019fafc4-0bc4-73f0-a8b4-70281a9c25c9";
  const directory = join(root, "2026", "08", "03");
  await mkdir(directory, { recursive: true });
  const path = join(directory, `rollout-test-${threadId}.jsonl`);
  const toolPayload = JSON.stringify({
    type: "response_item",
    payload: { type: "function_call_output", output: "secret-tool-output-".repeat(80) },
  });
  await writeFile(path, [
    record("user", "<codex_internal_context>private goal</codex_internal_context>"),
    toolPayload,
    record("user", "## My request for Codex:\nOpen the shared room."),
    record("user", "[Multiplayer teammate: Alex]\nCheck this."),
    record("assistant", "Working on it."),
    "{\"partial\":" ,
  ].join("\n"));

  try {
    const reader = new CodexRolloutReader({ root, initialBytes: 128, maxBytes: 4096 });
    const result = await reader.readMessages(threadId, { limit: 3 });
    assert.equal(result.path, path);
    assert.equal(result.truncated, true);
    assert.deepEqual(result.messages.map(({ role, text }) => ({ role, text })), [
      { role: "user", text: "Open the shared room." },
      { role: "user", text: "[Multiplayer teammate: Alex]\nCheck this." },
      { role: "assistant", text: "Working on it." },
    ]);
    assert.doesNotMatch(JSON.stringify(result), /private goal|secret-tool-output/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing rollout paths are not cached", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-rollout-late-"));
  const threadId = "019fafc4-0bc4-73f0-a8b4-70281a9c25c8";
  const reader = new CodexRolloutReader({ root });
  try {
    assert.equal(await reader.readMessages(threadId), null);
    await writeFile(join(root, `rollout-late-${threadId}.jsonl`), record("assistant", "Now here."));
    assert.equal((await reader.readMessages(threadId)).messages[0].text, "Now here.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
