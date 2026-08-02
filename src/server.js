import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { AuditStore, invitationCanAccess } from "./config.js";
import { errorPayload, MpaiError } from "./errors.js";
import { resolveTailscaleIdentity } from "./tailscale.js";

function sendJson(response, status, payload) {
  if (response.writableEnded) return;
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

async function readJson(request, { limit = 1024 * 1024 } = {}) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      throw new MpaiError("Request body is too large", {
        code: "BODY_TOO_LARGE",
        status: 413,
      });
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new MpaiError("Request body must be valid JSON", {
      code: "INVALID_JSON",
      status: 400,
    });
  }
}

function bearerToken(request) {
  const header = request.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/iu.exec(header);
  return match?.[1] || "";
}

function requireRole(session, role) {
  const rank = { viewer: 1, participant: 2 };
  if ((rank[session.invitation.role] || 0) < rank[role]) {
    throw new MpaiError(`This action requires the ${role} role`, {
      code: "FORBIDDEN",
      status: 403,
    });
  }
}

function requireTaskAccess(session, taskId) {
  if (!invitationCanAccess(session.invitation, taskId)) {
    throw new MpaiError("This AI session has not been shared with you", {
      code: "TASK_NOT_SHARED",
      status: 403,
    });
  }
}

function cleanTaskId(value) {
  const id = decodeURIComponent(value || "");
  if (!id || id.length > 200 || !/^[a-zA-Z0-9:_-]+$/u.test(id)) {
    throw new MpaiError("Invalid task id", {
      code: "INVALID_TASK_ID",
      status: 400,
    });
  }
  return id;
}

function legacyHub(codex) {
  return {
    status() {
      return [{
        id: "codex",
        name: "Codex",
        available: true,
        transport: codex.transport,
        error: null,
      }];
    },
    async listTasks(options) {
      const result = await codex.listThreads({
        limit: options.limit,
        cwd: options.cwd,
        searchTerm: options.search,
      });
      return result.data || [];
    },
    readTask(taskId) {
      return codex.readThread(taskId).then((result) => ({ task: result.thread }));
    },
    resolve() {
      return { provider: { id: "codex", transport: codex.transport } };
    },
    prompt({ taskId, ...input }) {
      return codex.prompt({ threadId: taskId, ...input });
    },
  };
}

export function createMpaiServer({
  configStore,
  hub: suppliedHub,
  codex,
  auditStore = new AuditStore({ path: configStore.auditPath }),
  identityResolver = resolveTailscaleIdentity,
  allowLoopback = false,
  allowStandalonePrompts = false,
  presenceTtlMs = 45_000,
  now = () => Date.now(),
  logger = console,
} = {}) {
  const hub = suppliedHub || legacyHub(codex);
  const activePrompts = new Map();
  const activeRequestIds = new Set();
  const presence = new Map();

  const currentPresence = () => {
    const current = now();
    for (const [actorId, record] of presence) {
      if (record.expiresAt <= current) presence.delete(actorId);
    }
    return [...presence.values()].map(({ expiresAt: _expiresAt, ...record }) => record);
  };

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://mpai.local");
      if (request.method === "GET" && url.pathname === "/v1/health") {
        sendJson(response, 200, {
          ok: true,
          service: "multiplayer-ai",
          version: "0.4.0",
          providers: hub.status(),
          codexTransport: hub.status().find((provider) => provider.id === "codex")?.transport || null,
        });
        return;
      }

      const networkIdentity = await identityResolver(
        request.socket.remoteAddress,
        { allowLoopback },
      );
      const session = await configStore.authenticate(
        bearerToken(request),
        networkIdentity,
      );

      if (request.method === "GET" && url.pathname === "/v1/whoami") {
        sendJson(response, 200, {
          host: session.host,
          actor: session.actor,
          role: session.invitation.role,
          taskAccess: session.invitation.taskAccess,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/presence") {
        sendJson(response, 200, {
          host: session.host,
          data: currentPresence().filter(
            (record) => !record.taskId || invitationCanAccess(session.invitation, record.taskId),
          ),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/presence") {
        const body = await readJson(request);
        const state = String(body.state || "viewing");
        if (!["viewing", "idle", "offline"].includes(state)) {
          throw new MpaiError("Presence state must be viewing, idle, or offline", {
            code: "INVALID_PRESENCE",
            status: 400,
          });
        }
        if (state === "offline") {
          presence.delete(session.actor.id);
        } else {
          const taskId = body.taskId ? cleanTaskId(body.taskId) : null;
          if (taskId) requireTaskAccess(session, taskId);
          const seenAt = now();
          presence.set(session.actor.id, {
            actor: session.actor,
            state,
            taskId,
            seenAt: new Date(seenAt).toISOString(),
            expiresAt: seenAt + presenceTtlMs,
          });
        }
        sendJson(response, 200, {
          data: currentPresence().filter(
            (record) => !record.taskId || invitationCanAccess(session.invitation, record.taskId),
          ),
        });
        return;
      }

      if (
        request.method === "GET" &&
        (url.pathname === "/v1/tasks" || url.pathname === "/v1/threads")
      ) {
        const requestedLimit = Math.max(
          1,
          Math.min(Number(url.searchParams.get("limit")) || 25, 100),
        );
        const discovered = await hub.listTasks({
          limit: 100,
          cwd: url.searchParams.get("cwd") || undefined,
          search: url.searchParams.get("search") || undefined,
        });
        const data = discovered
          .filter((task) => invitationCanAccess(session.invitation, task.id))
          .slice(0, requestedLimit);
        sendJson(response, 200, {
          host: session.host,
          data,
          providers: hub.status(),
          nextCursor: null,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/audit") {
        const events = await auditStore.list({
          limit: Math.min(Number(url.searchParams.get("limit")) || 1000, 1000),
        });
        sendJson(response, 200, {
          host: session.host,
          data: events
            .filter((event) =>
              !event.taskId || invitationCanAccess(session.invitation, event.taskId)
            )
            .slice(-Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 100, 1000))),
        });
        return;
      }

      const taskMatch = /^\/v1\/(?:tasks|threads)\/([^/]+)$/u.exec(url.pathname);
      if (request.method === "GET" && taskMatch) {
        const taskId = cleanTaskId(taskMatch[1]);
        requireTaskAccess(session, taskId);
        const result = await hub.readTask(taskId);
        sendJson(response, 200, {
          host: session.host,
          task: result.task,
          thread: result.task,
        });
        return;
      }

      const promptMatch =
        /^\/v1\/(?:tasks|threads)\/([^/]+)\/prompt$/u.exec(url.pathname);
      if (request.method === "POST" && promptMatch) {
        requireRole(session, "participant");
        const taskId = cleanTaskId(promptMatch[1]);
        requireTaskAccess(session, taskId);
        const { provider } = hub.resolve(taskId);
        if (
          provider.id === "codex" &&
          provider.transport === "standalone" &&
          !allowStandalonePrompts
        ) {
          throw new MpaiError(
            "Standalone Codex mode cannot safely race an active Desktop task. Start a managed Codex daemon or explicitly pass --allow-standalone-prompts for an idle task.",
            { code: "STANDALONE_PROMPTS_DISABLED", status: 409 },
          );
        }
        const body = await readJson(request);
        const text = String(body.text || "").trim();
        if (!text || text.length > 100_000) {
          throw new MpaiError("Prompt must be between 1 and 100,000 characters", {
            code: "INVALID_PROMPT",
            status: 400,
          });
        }
        const requestId = String(
          request.headers["idempotency-key"] || body.requestId || randomUUID(),
        );
        if (
          activePrompts.has(taskId) ||
          activeRequestIds.has(requestId) ||
          (await auditStore.hasPrompt(requestId))
        ) {
          throw new MpaiError(
            activePrompts.has(taskId)
              ? "This task already has a remote turn in progress"
              : "This prompt id was already submitted",
            { code: "PROMPT_CONFLICT", status: 409 },
          );
        }
        activeRequestIds.add(requestId);
        await auditStore.append({
          type: "prompt.received",
          requestId,
          taskId,
          threadId: taskId,
          actor: session.actor,
          target: provider.id,
          text,
        });
        activePrompts.set(taskId, requestId);
        response.writeHead(200, {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        });
        const writeEvent = (event) => {
          if (!response.writableEnded && !response.destroyed) {
            response.write(`${JSON.stringify(event)}\n`);
          }
        };
        writeEvent({
          type: "prompt.received",
          requestId,
          taskId,
          threadId: taskId,
          provider: provider.id,
          actor: session.actor,
        });
        try {
          const result = await hub.prompt({
            taskId,
            text,
            actor: session.actor,
            requestId,
            onEvent: writeEvent,
          });
          if (result.turn?.status !== "completed") {
            throw new MpaiError(
              result.turn?.error?.message ||
                `${provider.name || provider.id} turn ended with ${result.turn?.status || "unknown status"}`,
              { code: "PROVIDER_TURN_FAILED", status: 502 },
            );
          }
          await auditStore.append({
            type: "prompt.completed",
            requestId,
            taskId,
            threadId: taskId,
            actor: session.actor,
            target: provider.id,
            turnId: result.turnId,
            status: result.turn?.status,
          });
          writeEvent({ type: "request.completed", ...result });
        } catch (error) {
          await auditStore.append({
            type: "prompt.failed",
            requestId,
            taskId,
            threadId: taskId,
            actor: session.actor,
            target: provider.id,
            error: error.message,
          });
          writeEvent({
            type: "error",
            code: error.code || "CODEX_ERROR",
            message: error.message,
          });
        } finally {
          activePrompts.delete(taskId);
          activeRequestIds.delete(requestId);
          response.end();
        }
        return;
      }

      throw new MpaiError("Route not found", {
        code: "NOT_FOUND",
        status: 404,
      });
    } catch (error) {
      logger.error?.(error);
      sendJson(response, error.status || 500, errorPayload(error));
    }
  });
}

export async function listen(server, { host, port }) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  return server.address();
}
