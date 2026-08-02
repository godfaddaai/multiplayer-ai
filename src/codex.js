import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { MpaiError } from "./errors.js";

const SOURCE_KINDS = ["cli", "vscode", "appServer", "exec", "unknown"];

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => part?.text || part?.content || "")
    .filter(Boolean)
    .join("");
}

export function normalizeCodexEvent(message) {
  const method = message?.method || "unknown";
  const params = message?.params || {};
  if (method === "item/agentMessage/delta") {
    return {
      type: "agent.delta",
      threadId: params.threadId,
      turnId: params.turnId,
      text: params.delta || params.text || "",
    };
  }
  if (method === "item/started" || method === "item/completed") {
    const item = params.item || {};
    const base = {
      type: method === "item/started" ? "item.started" : "item.completed",
      threadId: params.threadId,
      turnId: params.turnId,
      itemId: item.id,
      itemType: item.type,
      status: item.status,
    };
    if (item.type === "agentMessage") {
      base.text = item.text || textFromContent(item.content);
    } else if (item.type === "commandExecution") {
      base.command = item.command;
      base.cwd = item.cwd;
      base.exitCode = item.exitCode;
    } else if (item.type === "fileChange") {
      base.changes = item.changes;
    }
    return base;
  }
  if (method === "turn/diff/updated") {
    return {
      type: "turn.diff",
      threadId: params.threadId,
      turnId: params.turnId,
      diff: params.diff,
    };
  }
  if (method === "turn/plan/updated") {
    return {
      type: "turn.plan",
      turnId: params.turnId,
      explanation: params.explanation,
      plan: params.plan,
    };
  }
  if (method === "turn/completed") {
    return {
      type: "turn.completed",
      threadId: params.threadId,
      turnId: params.turn?.id,
      status: params.turn?.status,
      error: params.turn?.error,
    };
  }
  return {
    type: "codex.event",
    method,
    threadId: params.threadId,
    turnId: params.turnId || params.turn?.id,
  };
}

export class CodexClient extends EventEmitter {
  constructor({
    codexBin = "codex",
    mode = "auto",
    cwd = process.cwd(),
    requestTimeoutMs = 30_000,
    turnTimeoutMs = 30 * 60_000,
    managedSocketPath = join(
      homedir(),
      ".codex",
      "app-server-control",
      "app-server-control.sock",
    ),
  } = {}) {
    super();
    this.codexBin = codexBin;
    this.mode = mode;
    this.cwd = cwd;
    this.requestTimeoutMs = requestTimeoutMs;
    this.turnTimeoutMs = turnTimeoutMs;
    this.managedSocketPath = managedSocketPath;
    this.proc = null;
    this.ws = null;
    this.pending = new Map();
    this.nextId = 1;
    this.stderr = "";
    this.transport = null;
    this.closing = false;
    this.subscribedThreads = new Set();
  }

  async start() {
    if (this.proc || this.ws) return this;
    const modes =
      this.mode === "auto" ? ["proxy", "standalone"] : [this.mode];
    let lastError;
    for (const mode of modes) {
      try {
        await this.#spawnAndInitialize(mode);
        this.transport = mode;
        return this;
      } catch (error) {
        lastError = error;
        await this.close();
        this.closing = false;
      }
    }
    throw new MpaiError(
      `Could not connect to Codex app-server: ${lastError?.message || "unknown error"}`,
      { code: "CODEX_UNAVAILABLE", status: 503, cause: lastError },
    );
  }

  async #spawnAndInitialize(mode) {
    if (mode === "proxy") {
      await this.#connectManaged();
    } else {
      this.#spawnStandalone();
    }

    await this.request(
      "initialize",
      {
        clientInfo: {
          name: "multiplayer_ai",
          title: "Multiplayer AI",
          version: "0.4.1",
        },
        capabilities: {
          experimentalApi: false,
        },
      },
      { timeoutMs: 15_000 },
    );
    this.notify("initialized", {});
  }

  #spawnStandalone() {
    this.stderr = "";
    this.proc = spawn(this.codexBin, ["app-server", "--listen", "stdio://"], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    this.proc.stderr.on("data", (chunk) => {
      this.stderr = `${this.stderr}${chunk}`.slice(-16_384);
    });
    createInterface({ input: this.proc.stdout }).on("line", (line) => {
      this.#onLine(line);
    });
    this.proc.once("error", (error) => this.#onExit(error));
    this.proc.once("exit", (code, signal) => {
      if (!this.closing) {
        const details = this.stderr.trim();
        this.#onExit(
          new Error(
            `Codex app-server exited (${signal || code})${details ? `: ${details}` : ""}`,
          ),
        );
      }
    });
  }

  async #connectManaged() {
    const socketPath = this.managedSocketPath;
    const ws = new WebSocket(`ws+unix://${socketPath}:/`, {
      perMessageDeflate: false,
    });
    this.ws = ws;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out connecting to ${socketPath}`));
      }, 5000);
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        clearTimeout(timer);
        ws.off("open", onOpen);
        ws.off("error", onError);
      };
      ws.once("open", onOpen);
      ws.once("error", onError);
    });
    ws.on("message", (data) => {
      for (const line of data.toString().split("\n")) {
        if (line.trim()) this.#onLine(line);
      }
    });
    ws.once("error", (error) => {
      if (!this.closing) this.#onExit(error);
    });
    ws.once("close", (code, reason) => {
      if (!this.closing) {
        this.#onExit(
          new Error(
            `Codex managed socket closed (${code})${reason?.length ? `: ${reason.toString()}` : ""}`,
          ),
        );
      }
    });
  }

  #onLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.emit("protocolError", new Error(`Invalid JSON from Codex: ${line}`));
      return;
    }
    if (message.method && message.id !== undefined) {
      void this.#handleServerRequest(message);
      return;
    }
    if (message.id !== undefined) {
      const pending = this.pending.get(String(message.id));
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(String(message.id));
      if (message.error) {
        pending.reject(
          new MpaiError(message.error.message || "Codex request failed", {
            code: "CODEX_REQUEST_FAILED",
            status: 502,
          }),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message.method) {
      this.emit("notification", message);
      this.emit(message.method, message.params);
    }
  }

  async #handleServerRequest(message) {
    let result;
    if (
      message.method === "item/commandExecution/requestApproval" ||
      message.method === "item/fileChange/requestApproval"
    ) {
      result = { decision: "decline" };
      this.emit("approvalDeclined", {
        method: message.method,
        params: message.params,
      });
    } else if (message.method === "item/permissions/requestApproval") {
      result = { permissions: {}, scope: "turn" };
    } else if (message.method === "mcpServer/elicitation/request") {
      result = { action: "decline", content: null };
    } else {
      this.#write({
        id: message.id,
        error: {
          code: -32601,
          message: `Multiplayer AI does not expose ${message.method}`,
        },
      });
      return;
    }
    this.#write({ id: message.id, result });
  }

  #onExit(error) {
    const current = this.proc;
    const currentWs = this.ws;
    this.proc = null;
    this.ws = null;
    if (current?.stdout) current.stdout.destroy();
    if (currentWs?.readyState === WebSocket.OPEN) currentWs.terminate();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.emit("exit", error);
  }

  #write(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }
    if (!this.proc?.stdin?.writable) {
      throw new MpaiError("Codex app-server is not connected", {
        code: "CODEX_DISCONNECTED",
        status: 503,
      });
    }
    this.proc.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params = {}, { timeoutMs = this.requestTimeoutMs } = {}) {
    const id = String(this.nextId++);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new MpaiError(`Codex ${method} timed out`, {
            code: "CODEX_TIMEOUT",
            status: 504,
          }),
        );
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.#write({ method, id, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  notify(method, params = {}) {
    this.#write({ method, params });
  }

  async listThreads({ limit = 25, cwd, searchTerm } = {}) {
    await this.start();
    const result = await this.request("thread/list", {
      cursor: null,
      limit: Math.max(1, Math.min(Number(limit) || 25, 100)),
      sortKey: "recency_at",
      sortDirection: "desc",
      sourceKinds: SOURCE_KINDS,
      ...(cwd ? { cwd } : {}),
      ...(searchTerm ? { searchTerm } : {}),
    });
    return result;
  }

  async readThread(threadId) {
    await this.start();
    return this.request("thread/read", {
      threadId,
      includeTurns: true,
    });
  }

  async startThread(params = {}) {
    await this.start();
    const result = await this.request(
      "thread/start",
      params,
      { timeoutMs: 60_000 },
    );
    if (result?.thread?.id) this.subscribedThreads.add(result.thread.id);
    return result;
  }

  async prompt({ threadId, text, actor, requestId = randomUUID(), onEvent }) {
    await this.start();
    if (!this.subscribedThreads.has(threadId)) {
      await this.request(
        "thread/resume",
        { threadId },
        { timeoutMs: 60_000 },
      );
      this.subscribedThreads.add(threadId);
    }
    const attributedText = `[Multiplayer teammate: ${actor.name}]\n${text}`;
    let turnId;
    let finalText = "";
    const listener = (message) => {
      const normalized = normalizeCodexEvent(message);
      if (
        normalized.threadId &&
        normalized.threadId !== threadId
      ) {
        return;
      }
      if (turnId && normalized.turnId && normalized.turnId !== turnId) return;
      if (normalized.type === "agent.delta") finalText += normalized.text || "";
      onEvent?.(normalized);
    };
    this.on("notification", listener);
    try {
      const started = await this.request(
        "turn/start",
        {
          threadId,
          input: [{ type: "text", text: attributedText }],
        },
        { timeoutMs: 60_000 },
      );
      turnId = started?.turn?.id;
      if (!turnId) {
        throw new MpaiError("Codex did not return a turn id", {
          code: "CODEX_PROTOCOL",
          status: 502,
        });
      }
      onEvent?.({
        type: "turn.accepted",
        requestId,
        threadId,
        turnId,
        actor,
      });
      const completion = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(
            new MpaiError("Codex turn timed out", {
              code: "CODEX_TURN_TIMEOUT",
              status: 504,
            }),
          );
        }, this.turnTimeoutMs);
        timer.unref?.();
        const onNotification = (message) => {
          if (
            message.method === "turn/completed" &&
            message.params?.turn?.id === turnId
          ) {
            cleanup();
            resolve(message.params.turn);
          }
        };
        const onExit = (error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          clearTimeout(timer);
          this.off("notification", onNotification);
          this.off("exit", onExit);
        };
        this.on("notification", onNotification);
        this.on("exit", onExit);
      });
      return { requestId, threadId, turnId, turn: completion, finalText };
    } finally {
      this.off("notification", listener);
    }
  }

  async close() {
    if (!this.proc && !this.ws) return;
    this.closing = true;
    const proc = this.proc;
    const ws = this.ws;
    this.proc = null;
    this.ws = null;
    if (proc) {
      proc.stdin?.end();
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          proc.kill("SIGTERM");
          resolve();
        }, 1000);
        timer.unref?.();
        proc.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    if (ws) {
      if (ws.readyState === WebSocket.CLOSED) {
        this.pending.clear();
        this.subscribedThreads.clear();
        return;
      }
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          ws.terminate();
          resolve();
        }, 1000);
        timer.unref?.();
        ws.once("close", () => {
          clearTimeout(timer);
          resolve();
        });
        ws.close();
      });
    }
    this.pending.clear();
    this.subscribedThreads.clear();
  }
}
