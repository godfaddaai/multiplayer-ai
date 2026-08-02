import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { WebSocketServer } from "ws";
import { CodexClient } from "../src/codex.js";

test("managed mode speaks WebSocket JSON-RPC over a Unix socket", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-codex-managed-"));
  const socketPath = join(root, "app-server.sock");
  const server = createServer();
  const webSocketServer = new WebSocketServer({ server });
  let extensionsHeader;

  webSocketServer.on("connection", (socket, request) => {
    extensionsHeader = request.headers["sec-websocket-extensions"];
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.method === "initialize") {
        socket.send(JSON.stringify({ id: message.id, result: {} }));
      } else if (message.method === "thread/list") {
        socket.send(
          JSON.stringify({
            id: message.id,
            result: { data: [], nextCursor: null },
          }),
        );
      }
    });
  });

  await new Promise((resolve) => server.listen(socketPath, resolve));
  const client = new CodexClient({
    mode: "proxy",
    managedSocketPath: socketPath,
  });
  try {
    await client.start();
    const result = await client.listThreads({ limit: 1 });
    assert.equal(client.transport, "proxy");
    assert.deepEqual(result.data, []);
    assert.equal(extensionsHeader, undefined);
  } finally {
    await client.close();
    await new Promise((resolve) => webSocketServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
