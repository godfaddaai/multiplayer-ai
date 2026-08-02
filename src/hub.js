import { MpaiError } from "./errors.js";

function isoTimestamp(value) {
  if (!value) return null;
  if (typeof value === "number") {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(milliseconds).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => !part?.type || part.type === "text" || part.type === "input_text")
    .map((part) => part?.text || part?.content || "")
    .filter(Boolean)
    .join("\n");
}

function attributedUser(text, fallback = "Host") {
  const match = /^\[Multiplayer teammate: ([^\]]+)\]\n([\s\S]*)$/u.exec(String(text || ""));
  if (!match) return { author: fallback, text };
  return { author: match[1], text: match[2] };
}

function taskTitle(thread) {
  const named = String(thread?.name || "").trim();
  if (named) return named;
  const preview = String(thread?.preview || "").trim().split("\n")[0];
  return preview ? preview.slice(0, 100) : "Untitled Codex task";
}

export class CodexProvider {
  constructor(client) {
    this.client = client;
    this.id = "codex";
    this.name = "Codex";
  }

  get transport() {
    return this.client.transport || "unavailable";
  }

  async start() {
    await this.client.start();
    return this;
  }

  normalizeTask(thread) {
    return {
      id: `${this.id}:${thread.id}`,
      nativeId: thread.id,
      provider: this.id,
      providerName: this.name,
      title: taskTitle(thread),
      name: taskTitle(thread),
      cwd: thread.cwd || null,
      source: thread.source || thread.threadSource || "codex",
      createdAt: isoTimestamp(thread.createdAt),
      updatedAt: isoTimestamp(thread.updatedAt || thread.recencyAt),
      status: thread.status || { type: "idle" },
      canPrompt: this.client.transport !== "standalone",
    };
  }

  async listTasks({ limit = 25, cwd, search } = {}) {
    const result = await this.client.listThreads({
      limit,
      cwd,
      searchTerm: search,
    });
    return (result.data || []).map((thread) => this.normalizeTask(thread));
  }

  async readTask(nativeId) {
    const result = await this.client.readThread(nativeId);
    const thread = result.thread;
    const messages = [];
    for (const turn of thread?.turns || []) {
      for (const item of turn.items || []) {
        if (item.type === "userMessage") {
          const text = contentText(item.content).trim();
          if (text) {
            const user = attributedUser(text);
            messages.push({
              id: item.id,
              role: "user",
              author: user.author,
              text: user.text,
              at: isoTimestamp(turn.startedAt),
            });
          }
        } else if (item.type === "agentMessage") {
          const text = String(item.text || contentText(item.content)).trim();
          if (text) {
            messages.push({
              id: item.id,
              role: "assistant",
              author: "Codex",
              text,
              at: isoTimestamp(turn.completedAt || turn.startedAt),
            });
          }
        }
      }
    }
    return { task: { ...this.normalizeTask(thread), messages } };
  }

  prompt({ nativeId, ...input }) {
    return this.client.prompt({ threadId: nativeId, ...input });
  }

  close() {
    return this.client.close();
  }
}

function splitTaskId(value) {
  const taskId = String(value || "");
  const separator = taskId.indexOf(":");
  if (separator <= 0 || separator === taskId.length - 1) return null;
  return {
    providerId: taskId.slice(0, separator),
    nativeId: taskId.slice(separator + 1),
  };
}

export class TaskHub {
  constructor({ providers = [], logger = console } = {}) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
    this.logger = logger;
    this.failures = new Map();
  }

  async start() {
    await Promise.all(
      [...this.providers.values()].map(async (provider) => {
        try {
          await provider.start?.();
          this.failures.delete(provider.id);
        } catch (error) {
          this.failures.set(provider.id, error);
          this.logger.warn?.(`${provider.name || provider.id} unavailable: ${error.message}`);
        }
      }),
    );
    if (this.failures.size === this.providers.size) {
      throw new MpaiError("No supported AI tools are available", {
        code: "PROVIDERS_UNAVAILABLE",
        status: 503,
      });
    }
    return this;
  }

  status() {
    return [...this.providers.values()].map((provider) => ({
      id: provider.id,
      name: provider.name,
      available: !this.failures.has(provider.id),
      transport: provider.transport || "local",
      error: this.failures.get(provider.id)?.message || null,
    }));
  }

  async listTasks(options = {}) {
    const results = await Promise.all(
      [...this.providers.values()].map(async (provider) => {
        if (this.failures.has(provider.id)) return [];
        try {
          return await provider.listTasks(options);
        } catch (error) {
          this.logger.warn?.(`${provider.name || provider.id} discovery failed: ${error.message}`);
          return [];
        }
      }),
    );
    const tasks = results
      .flat()
      .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
    return tasks.slice(0, Math.max(1, Math.min(Number(options.limit) || 25, 100)));
  }

  resolve(taskId) {
    let parsed = splitTaskId(taskId);
    if (!parsed && this.providers.size === 1) {
      const providerId = this.providers.keys().next().value;
      parsed = { providerId, nativeId: String(taskId) };
    }
    if (!parsed) {
      throw new MpaiError("Task id must include its provider, for example claude:abc123", {
        code: "INVALID_TASK_ID",
        status: 400,
      });
    }
    const provider = this.providers.get(parsed.providerId);
    if (!provider || this.failures.has(parsed.providerId)) {
      throw new MpaiError(`Provider ${parsed.providerId} is unavailable`, {
        code: "PROVIDER_UNAVAILABLE",
        status: 503,
      });
    }
    return { provider, nativeId: parsed.nativeId };
  }

  async readTask(taskId) {
    const { provider, nativeId } = this.resolve(taskId);
    return provider.readTask(nativeId);
  }

  async prompt({ taskId, ...input }) {
    const { provider, nativeId } = this.resolve(taskId);
    return provider.prompt({ nativeId, ...input });
  }

  async close() {
    await Promise.allSettled(
      [...this.providers.values()].map((provider) => provider.close?.()),
    );
  }
}
