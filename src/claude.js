import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { open, readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { MpaiError } from "./errors.js";

function textParts(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part?.type === "text")
    .map((part) => String(part.text || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function attributedUser(text) {
  const match = /^\[Multiplayer teammate: ([^\]]+)\]\n([\s\S]*)$/u.exec(text);
  if (!match) return { author: "Host", text };
  return { author: match[1], text: match[2] };
}

function parseLines(source) {
  const records = [];
  for (const line of source.split("\n")) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // Claude may be appending to the last line while discovery runs.
    }
  }
  return records;
}

async function readSummaryRecords(path, fileStat) {
  const headBytes = 64 * 1024;
  const tailBytes = 192 * 1024;
  if (fileStat.size <= headBytes + tailBytes) {
    return parseLines(await readFile(path, "utf8"));
  }
  const handle = await open(path, "r");
  try {
    const head = Buffer.alloc(headBytes);
    const tail = Buffer.alloc(tailBytes);
    const [headRead, tailRead] = await Promise.all([
      handle.read(head, 0, headBytes, 0),
      handle.read(tail, 0, tailBytes, Math.max(0, fileStat.size - tailBytes)),
    ]);
    return [
      ...parseLines(head.subarray(0, headRead.bytesRead).toString("utf8")),
      ...parseLines(tail.subarray(0, tailRead.bytesRead).toString("utf8")),
    ];
  } finally {
    await handle.close();
  }
}

function summarize(path, fileStat, records) {
  const nativeId =
    records.find((record) => record.sessionId)?.sessionId ||
    basename(path, ".jsonl");
  let title = "";
  let fallback = "";
  let cwd = null;
  let createdAt = null;
  let updatedAt = null;
  for (const record of records) {
    if (record.type === "ai-title" && record.aiTitle) title = record.aiTitle;
    if (record.customTitle) title = record.customTitle;
    if (record.type === "last-prompt" && record.lastPrompt) fallback = record.lastPrompt;
    if (record.cwd) cwd = record.cwd;
    if (record.timestamp) {
      createdAt ||= record.timestamp;
      updatedAt = record.timestamp;
    }
    if (!fallback && record.type === "user" && record.message?.role === "user") {
      const text = textParts(record.message.content);
      if (text) fallback = attributedUser(text).text;
    }
  }
  title ||= String(fallback || "Untitled Claude task").split("\n")[0].slice(0, 100);
  return {
    id: `claude:${nativeId}`,
    nativeId,
    provider: "claude",
    providerName: "Claude Code",
    title,
    name: title,
    cwd,
    source: "claude-code",
    createdAt: createdAt || fileStat.birthtime.toISOString(),
    updatedAt: updatedAt || fileStat.mtime.toISOString(),
    status: { type: Date.now() - fileStat.mtimeMs < 90_000 ? "recent" : "idle" },
    canPrompt: true,
    path,
  };
}

function transcriptMessages(records) {
  const messages = [];
  for (const record of records) {
    if (record.isSidechain || !["user", "assistant"].includes(record.type)) continue;
    const role = record.message?.role;
    if (!role) continue;
    const rawText = textParts(record.message.content);
    if (!rawText) continue;
    if (role === "user") {
      const user = attributedUser(rawText);
      messages.push({
        id: record.uuid || randomUUID(),
        role: "user",
        author: user.author,
        text: user.text,
        at: record.timestamp || null,
      });
    } else if (role === "assistant") {
      messages.push({
        id: record.uuid || randomUUID(),
        role: "assistant",
        author: "Claude",
        text: rawText,
        at: record.timestamp || null,
      });
    }
  }
  return messages;
}

export function normalizeClaudeStreamEvent(event, { taskId, requestId } = {}) {
  if (
    event?.type === "stream_event" &&
    event.event?.type === "content_block_delta" &&
    event.event?.delta?.type === "text_delta"
  ) {
    return {
      type: "agent.delta",
      provider: "claude",
      taskId,
      requestId,
      text: event.event.delta.text || "",
    };
  }
  if (event?.type === "assistant") {
    const text = textParts(event.message?.content);
    return text
      ? { type: "agent.message", provider: "claude", taskId, requestId, text }
      : null;
  }
  if (event?.type === "result") {
    return {
      type: "turn.completed",
      provider: "claude",
      taskId,
      requestId,
      status: event.is_error ? "failed" : "completed",
      error: event.is_error ? event.result || event.subtype : null,
      sessionId: event.session_id,
    };
  }
  return null;
}

export class ClaudeProvider {
  constructor({
    claudeBin = "claude",
    configDir,
    scanLimit = 300,
    turnTimeoutMs = 30 * 60_000,
  } = {}) {
    this.id = "claude";
    this.name = "Claude Code";
    this.transport = "cli-resume";
    this.claudeBin = claudeBin;
    this.explicitConfigDir = configDir !== undefined || Boolean(process.env.CLAUDE_CONFIG_DIR);
    this.configDir = configDir || process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
    this.projectsDir = join(this.configDir, "projects");
    this.scanLimit = scanLimit;
    this.turnTimeoutMs = turnTimeoutMs;
    this.taskCache = new Map();
  }

  async start() {
    try {
      await readdir(this.projectsDir);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      throw new MpaiError("Claude Code has no local session store yet", {
        code: "CLAUDE_UNAVAILABLE",
        status: 503,
      });
    }
    return this;
  }

  async #sessionFiles() {
    const projects = await readdir(this.projectsDir, { withFileTypes: true });
    const files = [];
    await Promise.all(
      projects.filter((entry) => entry.isDirectory()).map(async (project) => {
        const directory = join(this.projectsDir, project.name);
        let entries = [];
        try {
          entries = await readdir(directory, { withFileTypes: true });
        } catch {
          return;
        }
        await Promise.all(
          entries
            .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
            .map(async (entry) => {
              const path = join(directory, entry.name);
              try {
                files.push({ path, stat: await stat(path) });
              } catch {
                // A cleanup process may remove an expired transcript mid-scan.
              }
            }),
        );
      }),
    );
    return files.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs);
  }

  async #load(path, fileStat) {
    const records = parseLines(await readFile(path, "utf8"));
    const task = summarize(path, fileStat, records);
    this.taskCache.set(task.nativeId, task);
    return { task, records };
  }

  async #loadSummary(path, fileStat) {
    const records = await readSummaryRecords(path, fileStat);
    const task = summarize(path, fileStat, records);
    this.taskCache.set(task.nativeId, task);
    return task;
  }

  async listTasks({ limit = 25, cwd, search } = {}) {
    const files = (await this.#sessionFiles()).slice(0, this.scanLimit);
    const tasks = [];
    const needle = String(search || "").trim().toLowerCase();
    for (const file of files) {
      const task = await this.#loadSummary(file.path, file.stat);
      if (cwd && task.cwd !== cwd) continue;
      if (needle && !`${task.title} ${task.cwd || ""}`.toLowerCase().includes(needle)) continue;
      tasks.push(task);
      if (tasks.length >= Math.max(1, Math.min(Number(limit) || 25, 100))) break;
    }
    return tasks;
  }

  async #find(nativeId) {
    const cached = this.taskCache.get(nativeId);
    if (cached) {
      try {
        return { path: cached.path, stat: await stat(cached.path) };
      } catch {
        this.taskCache.delete(nativeId);
      }
    }
    const files = await this.#sessionFiles();
    const match = files.find((file) => basename(file.path, ".jsonl") === nativeId);
    if (!match) {
      throw new MpaiError(`Claude task ${nativeId} was not found`, {
        code: "TASK_NOT_FOUND",
        status: 404,
      });
    }
    return match;
  }

  async readTask(nativeId) {
    const file = await this.#find(nativeId);
    const { task, records } = await this.#load(file.path, file.stat);
    return { task: { ...task, messages: transcriptMessages(records) } };
  }

  async prompt({ nativeId, text, actor, requestId = randomUUID(), onEvent }) {
    const file = await this.#find(nativeId);
    const { task } = await this.#load(file.path, file.stat);
    const taskId = `claude:${nativeId}`;
    const attributedText = `[Multiplayer teammate: ${actor.name}]\n${text}`;
    const args = [
      "-p",
      attributedText,
      "--resume",
      nativeId,
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--permission-mode",
      "dontAsk",
    ];
    const env = { ...process.env };
    if (this.explicitConfigDir) env.CLAUDE_CONFIG_DIR = this.configDir;
    else delete env.CLAUDE_CONFIG_DIR;
    const proc = spawn(this.claudeBin, args, {
      cwd: task.cwd || homedir(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let finalText = "";
    let completion = null;
    proc.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-16_384);
    });
    const lines = createInterface({ input: proc.stdout });
    lines.on("line", (line) => {
      let raw;
      try {
        raw = JSON.parse(line);
      } catch {
        return;
      }
      const event = normalizeClaudeStreamEvent(raw, { taskId, requestId });
      if (!event) return;
      if (event.type === "agent.delta") finalText += event.text || "";
      if (event.type === "turn.completed") completion = event;
      onEvent?.(event);
    });
    onEvent?.({
      type: "turn.accepted",
      provider: "claude",
      taskId,
      requestId,
      actor,
    });
    const exit = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new MpaiError("Claude turn timed out", {
          code: "CLAUDE_TURN_TIMEOUT",
          status: 504,
        }));
      }, this.turnTimeoutMs);
      timer.unref?.();
      proc.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      proc.once("exit", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      });
    });
    if (exit.code !== 0 || completion?.status === "failed") {
      throw new MpaiError(
        completion?.error || stderr.trim() || `Claude exited (${exit.signal || exit.code})`,
        { code: "CLAUDE_TURN_FAILED", status: 502 },
      );
    }
    return {
      requestId,
      taskId,
      turnId: completion?.sessionId || nativeId,
      turn: { id: completion?.sessionId || nativeId, status: "completed" },
      finalText,
    };
  }

  async close() {}
}

export const claudeInternals = {
  parseLines,
  readSummaryRecords,
  summarize,
  transcriptMessages,
};
