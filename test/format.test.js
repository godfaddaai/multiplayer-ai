import assert from "node:assert/strict";
import { test } from "node:test";
import { threadSummary } from "../src/format.js";

test("session handles use the distinguishing suffix of time-ordered ids", () => {
  const summary = threadSummary({
    id: "codex:019fc107-1234-7000-8000-abcdef123456",
    nativeId: "019fc107-1234-7000-8000-abcdef123456",
    name: "A Codex task",
  });
  assert.equal(summary.shortId, "ef123456");
});
