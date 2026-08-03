import assert from "node:assert/strict";
import { test } from "node:test";
import { MpaiClient } from "../src/client.js";

function client(fetchImpl, requestTimeoutMs = 25) {
  return new MpaiClient({
    baseUrl: "http://100.64.0.2:7337",
    token: "test-token",
    identity: { name: "Alex" },
    fetchImpl,
    requestTimeoutMs,
  });
}

test("network failures become an actionable peer-unreachable error", async () => {
  const cause = new Error("connect ECONNREFUSED 100.64.0.2:7337");
  await assert.rejects(
    client(async () => { throw cause; }).listTasks(),
    (error) => {
      assert.equal(error.code, "PEER_UNREACHABLE");
      assert.equal(error.status, 503);
      assert.equal(error.cause, cause);
      assert.match(error.message, /Mac is awake/u);
      assert.match(error.message, /connected to Tailscale/u);
      assert.match(error.message, /mpai service install/u);
      assert.doesNotMatch(error.message, /100\.64\.0\.2|test-token/u);
      return true;
    },
  );
});

test("an unresponsive peer is aborted at the request deadline", async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    }, { once: true });
  });
  await assert.rejects(
    client(fetchImpl, 10).whoami(),
    (error) => error.code === "PEER_UNREACHABLE",
  );
});

test("the prompt deadline covers connection only, not a valid long stream", async () => {
  const encoder = new TextEncoder();
  const fetchImpl = async () => new Response(new ReadableStream({
    start(controller) {
      setTimeout(() => {
        controller.enqueue(encoder.encode(
          '{"type":"turn.completed","status":"completed"}\n',
        ));
        controller.close();
      }, 30);
    },
  }), {
    status: 200,
    headers: { "content-type": "application/x-ndjson" },
  });
  const result = await client(fetchImpl, 10).prompt("claude:one", "Keep going.");
  assert.equal(result.type, "turn.completed");
  assert.equal(result.status, "completed");
});
