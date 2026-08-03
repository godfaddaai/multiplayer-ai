import { open, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const THREAD_ID = /^[a-zA-Z0-9_-]{16,100}$/u;
const INTERNAL_BLOCKS = [
  /<codex_internal_context\b[^>]*>[\s\S]*?<\/codex_internal_context>/gu,
  /<in-app-browser-context\b[^>]*>[\s\S]*?<\/in-app-browser-context>/gu,
];

function contentText(content, types) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => types.includes(part?.type))
    .map((part) => part?.text || part?.content || "")
    .filter(Boolean)
    .join("\n");
}

export function visibleRolloutUserText(value) {
  let text = String(value || "");
  for (const pattern of INTERNAL_BLOCKS) text = text.replace(pattern, "");
  text = text.replace(/^\s*## My request for Codex:\s*/u, "");
  return text.trim();
}

export function rolloutMessage(record) {
  if (record?.type !== "response_item" || record.payload?.type !== "message") {
    return null;
  }
  const role = record.payload.role;
  if (role === "user") {
    const text = visibleRolloutUserText(
      contentText(record.payload.content, ["input_text", "text"]),
    );
    if (!text) return null;
    return {
      id: record.payload.id,
      role: "user",
      text,
      at: record.timestamp || null,
    };
  }
  if (role === "assistant") {
    const text = contentText(record.payload.content, ["output_text", "text"]).trim();
    if (!text) return null;
    return {
      id: record.payload.id,
      role: "assistant",
      text,
      at: record.timestamp || null,
    };
  }
  return null;
}

async function findFile(root, suffix) {
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && entry.name.endsWith(suffix)) return path;
    }
  }
  return null;
}

export class CodexRolloutReader {
  constructor({
    root = join(homedir(), ".codex", "sessions"),
    initialBytes = 256 * 1024,
    maxBytes = 32 * 1024 * 1024,
  } = {}) {
    this.root = root;
    this.initialBytes = Math.max(1, Number(initialBytes) || 1);
    this.maxBytes = Math.max(this.initialBytes, Number(maxBytes) || this.initialBytes);
    this.paths = new Map();
  }

  async pathFor(threadId) {
    const id = String(threadId || "");
    if (!THREAD_ID.test(id)) return null;
    if (this.paths.has(id)) return this.paths.get(id);
    const path = await findFile(this.root, `-${id}.jsonl`);
    if (path) this.paths.set(id, path);
    return path;
  }

  async readMessages(threadId, { limit = 200 } = {}) {
    const path = await this.pathFor(threadId);
    if (!path) return null;
    const fileStat = await stat(path);
    const handle = await open(path, "r");
    try {
      let bytes = Math.min(fileStat.size, this.initialBytes);
      while (true) {
        const start = Math.max(0, fileStat.size - bytes);
        const buffer = Buffer.alloc(fileStat.size - start);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
        let text = buffer.subarray(0, bytesRead).toString("utf8");
        if (start > 0) {
          const firstLine = text.indexOf("\n");
          text = firstLine >= 0 ? text.slice(firstLine + 1) : "";
        }
        const messages = [];
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try {
            const message = rolloutMessage(JSON.parse(line));
            if (message) messages.push(message);
          } catch {
            // The active rollout's last line or the first byte window may be partial.
          }
        }
        if (
          messages.length >= limit ||
          start === 0 ||
          bytes >= Math.min(fileStat.size, this.maxBytes)
        ) {
          return {
            path,
            messages: messages.slice(-limit),
            truncated: start > 0 || messages.length > limit,
          };
        }
        bytes = Math.min(fileStat.size, this.maxBytes, bytes * 2);
      }
    } finally {
      await handle.close();
    }
  }
}
