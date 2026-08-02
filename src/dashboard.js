import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MpaiClient } from "./client.js";
import { MpaiError, errorPayload } from "./errors.js";

const DEFAULT_STATIC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "web");

function securityHeaders(contentType) {
  return {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  };
}

function sendJson(response, status, payload) {
  if (response.writableEnded) return;
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(status, {
    ...securityHeaders("application/json; charset=utf-8"),
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readJson(request, limit = 1024 * 1024) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) {
      throw new MpaiError("Request body is too large", {
        code: "BODY_TOO_LARGE",
        status: 413,
      });
    }
    chunks.push(chunk);
  }
  try {
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
  } catch {
    throw new MpaiError("Request body must be valid JSON", {
      code: "INVALID_JSON",
      status: 400,
    });
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function contentType(path) {
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
  }[extname(path)] || "application/octet-stream";
}

function defaultClientFactory(config, peer) {
  return new MpaiClient({
    baseUrl: peer.baseUrl,
    token: peer.token,
    identity: config.identity,
  });
}

function cleanSegment(value, label) {
  const decoded = decodeURIComponent(value || "");
  if (!decoded || decoded.length > 240 || /[\u0000-\u001f]/u.test(decoded)) {
    throw new MpaiError(`Invalid ${label}`, { code: "INVALID_ROUTE", status: 400 });
  }
  return decoded;
}

async function peerContext(configStore, clientFactory, peerId) {
  const config = await configStore.load({ required: true });
  const normalized = String(peerId).toLowerCase();
  const peer = config.peers.find(
    (candidate) =>
      candidate.id.toLowerCase() === normalized ||
      candidate.id.toLowerCase().startsWith(normalized) ||
      candidate.name.toLowerCase() === normalized,
  );
  if (!peer) {
    throw new MpaiError(`Unknown teammate ${peerId}`, {
      code: "PEER_NOT_FOUND",
      status: 404,
    });
  }
  return { config, peer, client: clientFactory(config, peer) };
}

export function createDashboardServer({
  configStore,
  clientFactory = defaultClientFactory,
  staticRoot = DEFAULT_STATIC_ROOT,
  token = randomBytes(32).toString("base64url"),
  logger = console,
} = {}) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://dashboard.local");
      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204, securityHeaders("image/x-icon"));
        response.end();
        return;
      }
      if (request.method === "GET" && ["/", "/index.html", "/styles.css", "/app.js"].includes(url.pathname)) {
        const filename = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
        const path = join(staticRoot, filename);
        let body = await readFile(path);
        if (filename === "index.html") {
          body = Buffer.from(body.toString("utf8").replace("__MPAI_DASHBOARD_TOKEN__", token));
        }
        response.writeHead(200, {
          ...securityHeaders(contentType(path)),
          "content-length": body.length,
        });
        response.end(body);
        return;
      }

      if (!url.pathname.startsWith("/api/")) {
        throw new MpaiError("Route not found", { code: "NOT_FOUND", status: 404 });
      }
      if (!safeEqual(request.headers["x-mpai-dashboard-token"], token)) {
        throw new MpaiError("Dashboard session expired. Reload the page.", {
          code: "DASHBOARD_UNAUTHORIZED",
          status: 401,
        });
      }

      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        const config = await configStore.load({ required: true });
        sendJson(response, 200, {
          identity: config.identity,
          peers: config.peers.map(({ token: _token, ...peer }) => peer),
          privacy: "tailnet-only",
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/peers") {
        const config = await configStore.load({ required: true });
        const peers = await Promise.all(
          config.peers.map(async (peer) => {
            try {
              const remote = await clientFactory(config, peer).whoami();
              return {
                id: peer.id,
                name: peer.name,
                online: true,
                role: remote.role,
                host: remote.host,
                actor: remote.actor,
              };
            } catch (error) {
              return {
                id: peer.id,
                name: peer.name,
                online: false,
                error: error.message,
              };
            }
          }),
        );
        sendJson(response, 200, { data: peers });
        return;
      }

      const tasksMatch = /^\/api\/peers\/([^/]+)\/tasks$/u.exec(url.pathname);
      if (request.method === "GET" && tasksMatch) {
        const { client } = await peerContext(
          configStore,
          clientFactory,
          cleanSegment(tasksMatch[1], "teammate"),
        );
        const result = await client.listTasks({
          limit: url.searchParams.get("limit") || 50,
          search: url.searchParams.get("search") || undefined,
        });
        sendJson(response, 200, result);
        return;
      }

      const taskMatch = /^\/api\/peers\/([^/]+)\/tasks\/([^/]+)$/u.exec(url.pathname);
      if (request.method === "GET" && taskMatch) {
        const { client } = await peerContext(
          configStore,
          clientFactory,
          cleanSegment(taskMatch[1], "teammate"),
        );
        const result = await client.readTask(cleanSegment(taskMatch[2], "task"));
        sendJson(response, 200, result);
        return;
      }

      const presenceMatch = /^\/api\/peers\/([^/]+)\/presence$/u.exec(url.pathname);
      if (presenceMatch && ["GET", "POST"].includes(request.method)) {
        const { client } = await peerContext(
          configStore,
          clientFactory,
          cleanSegment(presenceMatch[1], "teammate"),
        );
        const result = request.method === "GET"
          ? await client.presence()
          : await client.setPresence(await readJson(request));
        sendJson(response, 200, result);
        return;
      }

      const auditMatch = /^\/api\/peers\/([^/]+)\/audit$/u.exec(url.pathname);
      if (request.method === "GET" && auditMatch) {
        const { client } = await peerContext(
          configStore,
          clientFactory,
          cleanSegment(auditMatch[1], "teammate"),
        );
        sendJson(response, 200, await client.audit({ limit: 50 }));
        return;
      }

      const promptMatch = /^\/api\/peers\/([^/]+)\/tasks\/([^/]+)\/prompt$/u.exec(url.pathname);
      if (request.method === "POST" && promptMatch) {
        const { client } = await peerContext(
          configStore,
          clientFactory,
          cleanSegment(promptMatch[1], "teammate"),
        );
        const taskId = cleanSegment(promptMatch[2], "task");
        const body = await readJson(request);
        const prompt = String(body.text || "").trim();
        if (!prompt) {
          throw new MpaiError("Write a prompt first", {
            code: "INVALID_PROMPT",
            status: 400,
          });
        }
        response.writeHead(200, securityHeaders("application/x-ndjson; charset=utf-8"));
        const write = (event) => {
          if (!response.writableEnded && !response.destroyed) {
            response.write(`${JSON.stringify(event)}\n`);
          }
        };
        try {
          await client.prompt(taskId, prompt, { onEvent: write });
        } catch (error) {
          write({ type: "error", code: error.code || "PROMPT_FAILED", message: error.message });
        }
        response.end();
        return;
      }

      throw new MpaiError("Route not found", { code: "NOT_FOUND", status: 404 });
    } catch (error) {
      logger.error?.(error);
      sendJson(response, error.status || 500, errorPayload(error));
    }
  });
  server.dashboardToken = token;
  return server;
}

export function listenDashboard(server, { host = "127.0.0.1", port = 7338 } = {}) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server.address());
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}
