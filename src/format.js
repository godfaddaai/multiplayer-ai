function timestamp(value) {
  if (!value) return "unknown";
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 1e12 ? numeric : numeric * 1000)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleString();
}

function compact(value, max = 72) {
  const text = String(value || "").replace(/\s+/gu, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function threadSummary(thread) {
  return {
    id: thread.id,
    shortId: String(thread.nativeId || thread.id || "").slice(-8),
    title: thread.title || thread.name || compact(thread.preview) || "Untitled task",
    preview: compact(thread.preview),
    cwd: thread.cwd,
    status: thread.status?.type || "unknown",
    provider: thread.providerName || thread.provider || "Codex",
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

export function formatThreadList(threads, { owner } = {}) {
  if (!threads.length) return "No AI tasks found.";
  const heading = owner ? `${owner}'s AI work` : "AI work";
  const lines = [heading, ""];
  for (const thread of threads) {
    const item = threadSummary(thread);
    lines.push(
      `${item.shortId}  ${item.status.padEnd(9)}  ${String(item.provider).padEnd(11)}  ${compact(item.title, 46)}`,
    );
    lines.push(
      `          ${timestamp(item.updatedAt || item.createdAt)}${item.cwd ? `  ${item.cwd}` : ""}`,
    );
  }
  return lines.join("\n");
}

function itemText(item) {
  if (typeof item?.text === "string") return item.text;
  if (Array.isArray(item?.content)) {
    return item.content.map((part) => part?.text || "").join("");
  }
  return "";
}

export function formatThread(thread) {
  const summary = threadSummary(thread);
  const lines = [
    `${summary.title}`,
    `${thread.id} · ${summary.provider} · ${summary.status}${thread.cwd ? ` · ${thread.cwd}` : ""}`,
    "",
  ];
  if (thread.transcriptWindow?.truncated) {
    const window = thread.transcriptWindow;
    lines.push(
      window.total === null
        ? `[showing latest ${window.returned} messages from a larger transcript]\n`
        : `[showing latest ${window.returned} of ${window.total} messages]\n`,
    );
  }
  if (Array.isArray(thread.messages)) {
    for (const message of thread.messages) {
      lines.push(`${String(message.author || message.role).toUpperCase()}\n${message.text}\n`);
    }
    return lines.join("\n").trimEnd();
  }
  for (const turn of thread.turns || []) {
    for (const item of turn.items || []) {
      if (item.type === "userMessage") {
        lines.push(`YOU\n${itemText(item)}\n`);
      } else if (item.type === "agentMessage") {
        lines.push(`CODEX\n${itemText(item)}\n`);
      } else if (item.type === "commandExecution") {
        lines.push(
          `TOOL ${item.status || ""}\n${compact(item.command, 120)}\n`,
        );
      } else if (item.type === "fileChange") {
        lines.push(`FILES ${item.status || ""}\n`);
      }
    }
  }
  return lines.join("\n").trimEnd();
}

export function formatStreamEvent(event) {
  if (event.type === "turn.accepted") {
    const provider = event.provider === "claude" ? "Claude" : "Codex";
    return `${event.actor.name} → ${provider}\n`;
  }
  if (event.type === "agent.delta") return event.text || "";
  if (event.type === "agent.message") return event.text || "";
  if (event.type === "item.started" && event.itemType === "commandExecution") {
    return `\n[tool] ${compact(event.command, 120)}\n`;
  }
  if (event.type === "item.completed" && event.itemType === "commandExecution") {
    return `\n[tool ${event.status || "completed"}]\n`;
  }
  if (event.type === "turn.completed") {
    return `\n[${event.status || "completed"}]\n`;
  }
  if (event.type === "error") return `\n[error] ${event.message}\n`;
  return "";
}
