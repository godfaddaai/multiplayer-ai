import { randomUUID } from "node:crypto";
import { MpaiError } from "./errors.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

function peerUnreachable(error) {
  if (error instanceof MpaiError) return error;
  return new MpaiError(
    "Teammate is unreachable. Check that their Mac is awake, connected to Tailscale, and running `mpai service install`, then retry.",
    {
      code: "PEER_UNREACHABLE",
      status: 503,
      cause: error,
    },
  );
}

function parseInvite(invite) {
  let url;
  try {
    url = new URL(invite);
  } catch {
    throw new MpaiError("Invite must be an mpai:// URL", {
      code: "INVALID_INVITE",
      status: 400,
    });
  }
  if (url.protocol !== "mpai:") {
    throw new MpaiError("Invite must use the mpai:// scheme", {
      code: "INVALID_INVITE",
      status: 400,
    });
  }
  const token = url.searchParams.get("token");
  if (!token) {
    throw new MpaiError("Invite is missing its token", {
      code: "INVALID_INVITE",
      status: 400,
    });
  }
  const hostname = url.hostname.includes(":")
    ? `[${url.hostname}]`
    : url.hostname;
  return {
    baseUrl: `http://${hostname}:${url.port || 7337}`,
    token,
    hostName: url.searchParams.get("host") || url.hostname,
  };
}

export class MpaiClient {
  constructor({
    baseUrl,
    token,
    identity,
    fetchImpl = fetch,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  }) {
    this.baseUrl = baseUrl.replace(/\/+$/u, "");
    this.token = token;
    this.identity = identity;
    this.fetch = fetchImpl;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  static fromInvite(invite, options = {}) {
    return new MpaiClient({ ...parseInvite(invite), ...options });
  }

  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.requestTimeoutMs,
    );
    try {
      return await this.fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      throw peerUnreachable(error);
    } finally {
      clearTimeout(timer);
    }
  }

  async request(path, { method = "GET", body, headers = {} } = {}) {
    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new MpaiError(payload?.error?.message || `Request failed (${response.status})`, {
        code: payload?.error?.code || "REMOTE_ERROR",
        status: response.status,
      });
    }
    return payload;
  }

  whoami() {
    return this.request("/v1/whoami");
  }

  listTasks({ limit = 25, cwd, search } = {}) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cwd) query.set("cwd", cwd);
    if (search) query.set("search", search);
    return this.request(`/v1/tasks?${query}`);
  }

  listThreads(options = {}) {
    return this.listTasks(options);
  }

  readTask(taskId, { tail } = {}) {
    const query = new URLSearchParams();
    if (tail !== undefined) query.set("tail", String(tail));
    const search = query.toString();
    const suffix = search ? `?${search}` : "";
    return this.request(`/v1/tasks/${encodeURIComponent(taskId)}${suffix}`);
  }

  readThread(taskId, options) {
    return this.readTask(taskId, options);
  }

  audit({ limit = 100 } = {}) {
    return this.request(`/v1/audit?limit=${encodeURIComponent(limit)}`);
  }

  presence() {
    return this.request("/v1/presence");
  }

  setPresence({ taskId, state = "viewing" } = {}) {
    return this.request("/v1/presence", {
      method: "POST",
      body: { taskId, state },
    });
  }

  async prompt(taskId, text, { onEvent, requestId = randomUUID() } = {}) {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/v1/tasks/${encodeURIComponent(taskId)}/prompt`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          "idempotency-key": requestId,
        },
        body: JSON.stringify({ text, requestId }),
      },
    );
    if (!response.ok) {
      const payload = await response.json();
      throw new MpaiError(
        payload?.error?.message || `Prompt failed (${response.status})`,
        {
          code: payload?.error?.code || "REMOTE_ERROR",
          status: response.status,
        },
      );
    }
    const decoder = new TextDecoder();
    let buffer = "";
    let finalEvent = null;
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      while (buffer.includes("\n")) {
        const index = buffer.indexOf("\n");
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const event = JSON.parse(line);
        finalEvent = event;
        onEvent?.(event);
      }
    }
    if (buffer.trim()) {
      finalEvent = JSON.parse(buffer);
      onEvent?.(finalEvent);
    }
    if (finalEvent?.type === "error") {
      throw new MpaiError(finalEvent.message || "Remote AI turn failed", {
        code: finalEvent.code || "PROVIDER_ERROR",
        status: 502,
      });
    }
    return finalEvent;
  }
}

export { parseInvite };
