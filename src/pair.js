import { createInterface } from "node:readline";
import { MpaiError } from "./errors.js";

const RESET = "\u001b[0m";
const COLORS = {
  dim: "\u001b[2m",
  bold: "\u001b[1m",
  violet: "\u001b[38;5;63m",
  orange: "\u001b[38;5;215m",
  mint: "\u001b[38;5;79m",
  red: "\u001b[38;5;203m",
};

function cleanText(value, max = 12_000) {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max)}\n[…truncated]` : text;
}

function shortPath(path) {
  if (!path) return "unknown workspace";
  const parts = String(path).split("/").filter(Boolean);
  return parts.slice(-3).join("/");
}

function clock(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function providerLabel(task) {
  return task?.providerName || (task?.provider === "claude" ? "Claude Code" : "Codex");
}

function taskShortId(task) {
  return String(task?.nativeId || task?.id || "").slice(-8);
}

function statusLabel(task) {
  const value = String(task?.status?.type || task?.status || "idle").toLowerCase();
  if (/active|running|working|progress/u.test(value)) return "working";
  if (/complete|done/u.test(value)) return "done";
  return "idle";
}

function messageKey(message) {
  return String(
    message.id ||
      `${message.role}|${message.author}|${message.at}|${message.text}`,
  );
}

export class TerminalRoom {
  constructor({
    client,
    peer,
    identity,
    taskInput,
    input = process.stdin,
    output = process.stdout,
    pollIntervalMs = 2_000,
    presenceIntervalMs = 15_000,
  } = {}) {
    this.client = client;
    this.peer = peer;
    this.identity = identity;
    this.taskInput = taskInput;
    this.input = input;
    this.output = output;
    this.pollIntervalMs = pollIntervalMs;
    this.presenceIntervalMs = presenceIntervalMs;
    this.color = Boolean(output.isTTY);
    this.tasks = [];
    this.task = null;
    this.seen = new Set();
    this.running = false;
    this.sending = false;
    this.connectionLost = false;
    this.lastPresenceAt = 0;
    this.timer = null;
    this.rl = null;
    this.commandQueue = Promise.resolve();
  }

  style(name, text) {
    return this.color ? `${COLORS[name]}${text}${RESET}` : text;
  }

  write(text = "") {
    this.output.write(text);
  }

  line(text = "") {
    this.write(`${text}\n`);
  }

  writeAbove(text) {
    if (this.rl && this.output.isTTY) this.write("\r\u001b[2K");
    this.write(text.endsWith("\n") ? text : `${text}\n`);
    if (this.rl && this.running && !this.sending) this.rl.prompt(true);
  }

  async start() {
    const remote = await this.client.whoami();
    this.role = remote.role;
    this.remoteHost = remote.host;
    await this.loadTasks();
    if (!this.tasks.length) {
      throw new MpaiError(
        `${this.peer.name} has not shared any AI sessions with you yet. Ask them to run: mpai share SESSION_ID --with ${remote.actor.name}`,
        {
        code: "NO_TASKS",
        status: 404,
        },
      );
    }
    this.renderTasks();
    const selected = this.resolveTask(this.taskInput) || this.tasks[0];
    await this.attach(selected, { initial: true });
    this.running = true;
    this.rl = createInterface({
      input: this.input,
      output: this.output,
      terminal: Boolean(this.input.isTTY && this.output.isTTY),
    });
    this.rl.setPrompt(this.promptLabel());
    this.rl.on("line", (line) => {
      this.commandQueue = this.commandQueue
        .then(() => this.handleLine(line))
        .catch((error) => this.writeAbove(this.style("red", `Error: ${error.message}`)));
    });
    this.rl.on("SIGINT", () => this.rl.close());
    this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
    this.rl.prompt();
    await new Promise((resolve) => this.rl.once("close", resolve));
    await this.stop();
  }

  promptLabel() {
    return this.role === "viewer"
      ? this.style("dim", "view only > ")
      : `${this.style("mint", this.identity.name)} > `;
  }

  async loadTasks({ search } = {}) {
    const result = await this.client.listTasks({ limit: 100, search });
    this.tasks = result.data || [];
    return this.tasks;
  }

  resolveTask(input) {
    const value = String(input || "").trim();
    if (!value) return null;
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= this.tasks.length) {
      return this.tasks[numeric - 1];
    }
    const matches = this.tasks.filter(
      (task) =>
        task.id === value ||
        task.id.startsWith(value) ||
        task.id.endsWith(value) ||
        task.nativeId?.startsWith(value) ||
        task.nativeId?.endsWith(value),
    );
    if (matches.length === 1) return matches[0];
    if (!matches.length) {
      throw new MpaiError(`No session matches ${value}`, {
        code: "TASK_NOT_FOUND",
        status: 404,
      });
    }
    throw new MpaiError(`Session prefix ${value} is ambiguous`, {
      code: "AMBIGUOUS_TASK",
      status: 409,
    });
  }

  renderTasks() {
    const lines = [
      "",
      this.style("bold", `${this.peer.name}’s AI sessions`),
    ];
    this.tasks.forEach((task, index) => {
      const active = this.task?.id === task.id ? this.style("mint", "●") : "○";
      const provider = providerLabel(task).padEnd(11);
      const status = statusLabel(task).padEnd(7);
      const title = cleanText(task.title || task.name || "Untitled", 68).replaceAll("\n", " ");
      lines.push(`  ${active} ${String(index + 1).padStart(2)}  ${provider}  ${status}  ${title}`);
      lines.push(`       ${taskShortId(task)} · ${shortPath(task.cwd)}`);
    });
    lines.push("", this.style("dim", "Use /switch NUMBER or /open SESSION_ID"), "");
    this.writeAbove(lines.join("\n"));
  }

  renderHeader() {
    const title = this.task.title || this.task.name || "Untitled task";
    const lines = [
      "",
      this.style("violet", "━".repeat(72)),
      `${this.style("bold", this.peer.name)}  ${this.style("dim", "↔")}  ${this.style("bold", providerLabel(this.task))}`,
      `${title}`,
      this.style("dim", `${shortPath(this.task.cwd)} · ${taskShortId(this.task)} · ${this.role}`),
      this.style("violet", "━".repeat(72)),
    ];
    this.writeAbove(lines.join("\n"));
  }

  renderMessage(message) {
    const isAssistant = message.role === "assistant";
    const color = isAssistant ? "violet" : message.author === this.identity.name ? "mint" : "orange";
    const author = String(message.author || (isAssistant ? providerLabel(this.task) : this.peer.name)).toUpperCase();
    const time = clock(message.at);
    return `${this.style(color, author)}${time ? this.style("dim", `  ${time}`) : ""}\n${cleanText(message.text)}\n`;
  }

  async attach(task, { initial = false } = {}) {
    if (this.task && this.task.id !== task.id) {
      await this.client.setPresence({ state: "idle", taskId: this.task.id }).catch(() => {});
    }
    const result = await this.client.readTask(task.id);
    this.task = result.task || result.thread;
    this.seen.clear();
    this.renderHeader();
    const messages = this.task.messages || [];
    const visible = initial ? messages.slice(-30) : messages;
    for (const message of messages) this.seen.add(messageKey(message));
    for (const message of visible) this.line(this.renderMessage(message));
    await this.heartbeat();
    if (initial) {
      this.line(this.style("dim", "Live attach. Type a message to prompt this session; /help for commands."));
      if (this.tasks.length > 1) {
        this.line(this.style("dim", `${this.tasks.length - 1} other session${this.tasks.length === 2 ? "" : "s"} available via /sessions.`));
      }
      this.line();
    }
  }

  async refresh({ silent = false } = {}) {
    if (!this.task) return;
    const result = await this.client.readTask(this.task.id);
    this.task = { ...this.task, ...(result.task || result.thread) };
    for (const message of this.task.messages || []) {
      const key = messageKey(message);
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      if (!silent) this.writeAbove(this.renderMessage(message));
    }
  }

  async heartbeat() {
    if (!this.task) return;
    const result = await this.client.setPresence({ state: "viewing", taskId: this.task.id });
    this.presence = result.data || [];
    this.lastPresenceAt = Date.now();
  }

  async poll() {
    if (!this.running || this.sending || !this.task) return;
    try {
      await this.refresh();
      if (Date.now() - this.lastPresenceAt >= this.presenceIntervalMs) await this.heartbeat();
      if (this.connectionLost) {
        this.connectionLost = false;
        this.writeAbove(this.style("mint", `${this.peer.name} reconnected.`));
      }
    } catch (error) {
      if (!this.connectionLost) {
        this.connectionLost = true;
        this.writeAbove(this.style("orange", `${this.peer.name} is unreachable; retrying in this room…`));
      }
    }
  }

  async handleLine(rawLine) {
    const line = String(rawLine || "").trim();
    if (!line) {
      this.rl.prompt();
      return;
    }
    if (line === "/leave" || line === "/exit" || line === "/quit") {
      this.rl.close();
      return;
    }
    if (line === "/help") {
      this.writeAbove([
        "",
        this.style("bold", "Room commands"),
        "  /sessions        list this teammate’s sessions",
        "  /find TERM       search session titles and workspaces",
        "  /switch NUMBER   attach to a listed session",
        "  /open ID         attach by native or provider-qualified id",
        "  /who             show people following this session",
        "  /refresh         read the latest native transcript",
        "  /leave           leave the room",
        "",
      ].join("\n"));
      return;
    }
    if (line === "/sessions") {
      await this.loadTasks();
      this.renderTasks();
      return;
    }
    if (line.startsWith("/find ")) {
      const search = line.slice("/find ".length).trim();
      await this.loadTasks({ search });
      if (!this.tasks.length) {
        this.writeAbove(this.style("dim", `No shared sessions match “${search}”.`));
      } else {
        this.renderTasks();
      }
      return;
    }
    if (line.startsWith("/switch ") || line.startsWith("/open ")) {
      await this.loadTasks();
      const value = line.replace(/^\/(?:switch|open)\s+/u, "").trim();
      await this.attach(this.resolveTask(value));
      return;
    }
    if (line === "/refresh") {
      await this.refresh();
      this.writeAbove(this.style("dim", "Transcript is current."));
      return;
    }
    if (line === "/who") {
      const result = await this.client.presence();
      const people = (result.data || []).filter((item) => item.taskId === this.task.id);
      const names = people.map((item) => item.actor?.name).filter(Boolean);
      this.writeAbove(names.length ? `Following: ${names.join(", ")}` : "No other named viewers are following this session.");
      return;
    }
    if (line.startsWith("/")) {
      this.writeAbove(this.style("red", `Unknown command ${line.split(/\s/u)[0]}. Type /help.`));
      return;
    }
    if (this.role === "viewer") {
      this.writeAbove(this.style("red", "This invite is view-only. Ask the host for participant access."));
      return;
    }
    await this.sendPrompt(line);
  }

  async sendPrompt(text) {
    this.sending = true;
    this.writeAbove(`${this.style("mint", this.identity.name)} ${this.style("dim", "→")} ${this.style("violet", providerLabel(this.task))}`);
    let streamed = "";
    let sawDelta = false;
    let streamStarted = false;
    try {
      await this.client.prompt(this.task.id, text, {
        onEvent: (event) => {
          if (event.type === "agent.delta") {
            if (!streamStarted) {
              this.write(`${this.style("violet", providerLabel(this.task).toUpperCase())}\n`);
              streamStarted = true;
            }
            sawDelta = true;
            streamed += event.text || "";
            this.write(event.text || "");
          } else if (event.type === "agent.message" && !sawDelta) {
            streamed = event.text || "";
            this.write(`${this.style("violet", providerLabel(this.task).toUpperCase())}\n${streamed}`);
            streamStarted = true;
          } else if (event.type === "item.started" && event.itemType === "commandExecution") {
            this.write(`\n${this.style("dim", `[tool] ${event.command || "command"}`)}\n`);
          }
        },
      });
      if (streamStarted) this.line();
      this.line(this.style("dim", "turn complete"));
      await this.refresh({ silent: true });
    } finally {
      this.sending = false;
      if (this.running) this.rl.prompt();
    }
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    await this.client.setPresence({ state: "offline" }).catch(() => {});
    this.line(this.style("dim", `Left ${this.peer.name}’s room.`));
  }
}

export async function runTerminalRoom(options) {
  const room = new TerminalRoom(options);
  return room.start();
}

export const pairInternals = {
  cleanText,
  messageKey,
  providerLabel,
  statusLabel,
  shortPath,
  taskShortId,
};
