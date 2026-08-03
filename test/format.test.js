import assert from "node:assert/strict";
import { test } from "node:test";
import { formatThread, threadSummary } from "../src/format.js";

test("session handles use the distinguishing suffix of time-ordered ids", () => {
  const summary = threadSummary({
    id: "codex:019fc107-1234-7000-8000-abcdef123456",
    nativeId: "019fc107-1234-7000-8000-abcdef123456",
    name: "A Codex task",
  });
  assert.equal(summary.shortId, "ef123456");
});

test("large transcript formatting explains the bounded window", () => {
  const output = formatThread({
    id: "codex:019fc107-1234-7000-8000-abcdef123456",
    name: "Large task",
    transcriptWindow: { returned: 100, total: null, truncated: true },
    messages: [{ role: "assistant", author: "Codex", text: "Latest reply" }],
  });
  assert.match(output, /showing latest 100 messages from a larger transcript/u);
  assert.match(output, /CODEX\nLatest reply/u);
});
