import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
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

test("auto mode promotes a standalone client when managed Codex returns", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-codex-promote-"));
  const socketPath = join(root, "app-server.sock");
  const server = createServer();
  const webSocketServer = new WebSocketServer({ server });
  let connectionCount = 0;

  webSocketServer.on("connection", (socket) => {
    connectionCount += 1;
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.method === "initialize") {
        socket.send(JSON.stringify({ id: message.id, result: {} }));
      }
    });
  });

  await new Promise((resolve) => server.listen(socketPath, resolve));
  const standalone = new EventEmitter();
  standalone.stdin = {
    end() {
      queueMicrotask(() => standalone.emit("exit", 0, null));
    },
  };
  standalone.kill = () => {};
  const client = new CodexClient({
    mode: "auto",
    managedSocketPath: socketPath,
  });
  client.proc = standalone;
  client.transport = "standalone";
  try {
    await Promise.all([
      client.ensureManagedForPrompt(),
      client.ensureManagedForPrompt(),
    ]);
    assert.equal(client.transport, "proxy");
    assert.equal(connectionCount, 1);
    assert.equal(client.proc, null);
    assert.notEqual(client.ws, null);
  } finally {
    await client.close();
    await new Promise((resolve) => webSocketServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test("managed Codex auth failures reject one turn without crashing the client", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-codex-auth-"));
  const socketPath = join(root, "app-server.sock");
  const server = createServer();
  const webSocketServer = new WebSocketServer({ server });
  const threadId = "thread-auth";
  const turnId = "turn-auth";

  webSocketServer.on("connection", (socket) => {
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.method === "initialize") {
        socket.send(JSON.stringify({ id: message.id, result: {} }));
      } else if (message.method === "thread/resume") {
        socket.send(JSON.stringify({ id: message.id, result: { thread: { id: threadId } } }));
      } else if (message.method === "turn/start") {
        socket.send(JSON.stringify({ id: message.id, result: { turn: { id: turnId } } }));
        socket.send(JSON.stringify({
          method: "error",
          params: {
            error: {
              message: "Codex authentication expired. Sign in again.",
              codexErrorInfo: "unauthorized",
            },
            willRetry: false,
            threadId,
            turnId,
          },
        }));
      } else if (message.method === "thread/list") {
        socket.send(JSON.stringify({
          id: message.id,
          result: { data: [], nextCursor: null },
        }));
      }
    });
  });

  await new Promise((resolve) => server.listen(socketPath, resolve));
  const client = new CodexClient({
    mode: "proxy",
    managedSocketPath: socketPath,
  });
  try {
    await assert.rejects(
      client.prompt({
        threadId,
        text: "Harmless certification prompt",
        actor: { name: "Hudson" },
      }),
      {
        code: "CODEX_AUTH_REQUIRED",
        message: /Sign in again/u,
      },
    );
    assert.equal(client.listenerCount("notification"), 0);
    assert.equal(client.listenerCount("providerError"), 0);
    assert.equal(client.listenerCount("exit"), 0);
    const result = await client.listThreads({ limit: 1 });
    assert.deepEqual(result.data, []);
  } finally {
    await client.close();
    await new Promise((resolve) => webSocketServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test("managed Codex interrupts an active turn when the teammate disconnects", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-codex-abort-"));
  const socketPath = join(root, "app-server.sock");
  const server = createServer();
  const webSocketServer = new WebSocketServer({ server });
  const threadId = "thread-abort";
  const turnId = "turn-abort";
  let interrupted = false;

  webSocketServer.on("connection", (socket) => {
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.method === "initialize") {
        socket.send(JSON.stringify({ id: message.id, result: {} }));
      } else if (message.method === "thread/resume") {
        socket.send(JSON.stringify({ id: message.id, result: { thread: { id: threadId } } }));
      } else if (message.method === "turn/start") {
        socket.send(JSON.stringify({ id: message.id, result: { turn: { id: turnId } } }));
      } else if (message.method === "turn/interrupt") {
        interrupted = true;
        assert.deepEqual(message.params, { threadId, turnId });
        socket.send(JSON.stringify({ id: message.id, result: {} }));
      }
    });
  });

  await new Promise((resolve) => server.listen(socketPath, resolve));
  const client = new CodexClient({ mode: "proxy", managedSocketPath: socketPath });
  const controller = new AbortController();
  try {
    const prompt = client.prompt({
      threadId,
      text: "Stop after acceptance",
      actor: { name: "Hudson" },
      signal: controller.signal,
      onEvent(event) {
        if (event.type === "turn.accepted") controller.abort();
      },
    });
    await assert.rejects(prompt, { code: "CLIENT_DISCONNECTED" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(interrupted, true);
    assert.equal(client.listenerCount("notification"), 0);
    assert.equal(client.listenerCount("providerError"), 0);
    assert.equal(client.listenerCount("exit"), 0);
  } finally {
    await client.close();
    await new Promise((resolve) => webSocketServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
