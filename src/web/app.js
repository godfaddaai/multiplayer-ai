const token = document.querySelector('meta[name="mpai-dashboard-token"]').content;

const state = {
  me: null,
  peers: [],
  selectedPeer: null,
  tasks: [],
  selectedTask: null,
  presence: [],
  sending: false,
};

const $ = (selector) => document.querySelector(selector);
const peopleEl = $("#people");
const tasksEl = $("#tasks");
const transcriptEl = $("#transcript");
const presenceEl = $("#presence");
const promptEl = $("#prompt");
const sendEl = $("#send");
const composerEl = $("#composer");
let toastTimer;
let searchTimer;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function shortPath(path) {
  if (!path) return "No workspace recorded";
  const parts = path.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

function relativeTime(value) {
  if (!value) return "";
  const elapsed = Date.now() - new Date(value).valueOf();
  if (!Number.isFinite(elapsed)) return "";
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "x-mpai-dashboard-token": token,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Request failed (${response.status})`);
  return payload;
}

function renderMe() {
  $("#me").replaceChildren(
    document.createTextNode("Signed in as "),
    node("strong", "", state.me?.name || "you"),
  );
  $("#send-as").textContent = `Send as ${state.me?.name || "you"} · host approvals stay local`;
}

function renderPeople() {
  peopleEl.replaceChildren();
  const online = state.peers.filter((peer) => peer.online).length;
  $("#online-count").textContent = String(online);
  for (const peer of state.peers) {
    const button = node("button", `person-button${state.selectedPeer?.id === peer.id ? " active" : ""}`);
    button.type = "button";
    button.append(node("span", "avatar", initials(peer.name)));
    const copy = node("span");
    copy.append(node("strong", "", peer.name), node("small", "", peer.online ? peer.role || "connected" : "offline"));
    button.append(copy, node("i", `online-dot${peer.online ? " online" : ""}`));
    button.addEventListener("click", () => selectPeer(peer));
    peopleEl.append(button);
  }
  if (!state.peers.length) {
    peopleEl.append(node("p", "presence-empty", "No teammates yet. Join an invite from the CLI."));
  }
}

function renderTasks() {
  tasksEl.replaceChildren();
  $("#task-count").textContent = String(state.tasks.length);
  for (const task of state.tasks) {
    const button = node("button", `task-button${state.selectedTask?.id === task.id ? " active" : ""}`);
    button.type = "button";
    const top = node("span", "task-top");
    top.append(node("strong", "", task.title || task.name || "Untitled task"), node("time", "task-time", relativeTime(task.updatedAt)));
    const bottom = node("span", "task-bottom");
    const provider = task.provider === "claude" ? "Claude" : task.providerName || "Codex";
    bottom.append(
      node("span", `provider-pill${task.provider === "claude" ? " claude" : ""}`, provider),
      node("span", "task-path", shortPath(task.cwd)),
    );
    button.append(top, bottom);
    button.addEventListener("click", () => selectTask(task));
    tasksEl.append(button);
  }
  if (!state.tasks.length) {
    tasksEl.append(node("p", "presence-empty", state.selectedPeer?.online ? "No matching AI work yet." : "This teammate is offline."));
  }
}

function messageElement(message, { streaming = false } = {}) {
  const wrapper = node("article", `message ${message.role || "assistant"}${streaming ? " streaming" : ""}`);
  wrapper.append(node("span", "message-avatar", initials(message.author)));
  const body = node("div", "message-body");
  const byline = node("div", "message-byline");
  byline.append(node("strong", "", message.author || (message.role === "assistant" ? "AI" : "Teammate")));
  if (message.at) byline.append(node("time", "", relativeTime(message.at)));
  body.append(byline, node("div", "message-text", message.text || ""));
  wrapper.append(body);
  return wrapper;
}

function renderTranscript() {
  transcriptEl.replaceChildren();
  const messages = state.selectedTask?.messages || [];
  for (const message of messages) transcriptEl.append(messageElement(message));
  if (!messages.length) {
    const empty = node("div", "empty-state");
    empty.append(node("h3", "", "No conversation text yet."), node("p", "", "This task is available, but its agent has not written a visible message."));
    transcriptEl.append(empty);
  }
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function renderContext() {
  const task = state.selectedTask;
  if (!task) {
    $("#task-title").textContent = "Shared context lives here";
    $("#task-meta").textContent = "Choose a teammate and one of their tasks.";
    $("#task-provider").textContent = "AI";
    $("#task-provider").className = "provider-badge";
    $("#live-state").className = "live-state";
    $("#live-state span").textContent = "Waiting";
    promptEl.disabled = true;
    sendEl.disabled = true;
    const empty = node("div", "empty-state");
    const orbit = node("div", "empty-orbit");
    orbit.setAttribute("aria-hidden", "true");
    orbit.append(node("i"), node("i"), node("i"));
    empty.append(
      orbit,
      node("h3", "", "Step into the same conversation."),
      node("p", "", "Read the real context, see which AI is working, and add a turn with your name attached."),
    );
    transcriptEl.replaceChildren(empty);
    return;
  }
  const claude = task.provider === "claude";
  $("#task-title").textContent = task.title || task.name || "Untitled task";
  $("#task-meta").textContent = `${state.selectedPeer.name} · ${shortPath(task.cwd)} · updated ${relativeTime(task.updatedAt) || "recently"}`;
  $("#task-provider").textContent = claude ? "CC" : "CX";
  $("#task-provider").className = `provider-badge${claude ? " claude" : ""}`;
  $("#live-state").className = "live-state live";
  $("#live-state span").textContent = task.status?.type === "recent" ? "Recently active" : "Room open";
  promptEl.disabled = !task.canPrompt || state.selectedPeer.role === "viewer" || state.sending;
  sendEl.disabled = promptEl.disabled || !promptEl.value.trim();
  promptEl.placeholder = `Add a turn to ${claude ? "Claude Code" : "Codex"} as ${state.me?.name || "yourself"}…`;
  renderTranscript();
}

function renderPresence() {
  presenceEl.replaceChildren();
  const matching = state.presence.filter((entry) => !state.selectedTask || !entry.taskId || entry.taskId === state.selectedTask.id);
  for (const entry of matching) {
    const item = node("div", "presence-item");
    item.append(node("span", "avatar", initials(entry.actor?.name)));
    const copy = node("span");
    copy.append(node("strong", "", entry.actor?.name || "Teammate"), node("small", "", entry.state === "viewing" ? "Following this context" : "In the room"));
    item.append(copy);
    presenceEl.append(item);
  }
  if (!matching.length) presenceEl.append(node("p", "presence-empty", "Choose a task to enter the room."));
}

async function loadPeers({ quiet = false } = {}) {
  try {
    const result = await api("/api/peers");
    state.peers = result.data;
    if (state.selectedPeer) {
      state.selectedPeer = state.peers.find((peer) => peer.id === state.selectedPeer.id) || null;
    }
    renderPeople();
    if (!state.selectedPeer && state.peers.length) await selectPeer(state.peers[0]);
  } catch (error) {
    if (!quiet) showToast(error.message);
  }
}

async function selectPeer(peer) {
  if (state.selectedPeer?.id !== peer.id && state.selectedPeer) await leavePresence();
  state.selectedPeer = peer;
  state.selectedTask = null;
  state.tasks = [];
  $("#peer-title").textContent = peer.name;
  renderPeople();
  renderTasks();
  renderContext();
  tasksEl.replaceChildren(node("div", "skeleton"), node("div", "skeleton"), node("div", "skeleton"));
  await loadTasks();
}

async function loadTasks({ quiet = false } = {}) {
  if (!state.selectedPeer?.online) {
    state.tasks = [];
    renderTasks();
    return;
  }
  try {
    const search = $("#search").value.trim();
    const result = await api(`/api/peers/${encodeURIComponent(state.selectedPeer.id)}/tasks?limit=50${search ? `&search=${encodeURIComponent(search)}` : ""}`);
    state.tasks = result.data || [];
    if (state.selectedTask) {
      const fresh = state.tasks.find((task) => task.id === state.selectedTask.id);
      if (fresh) state.selectedTask = { ...state.selectedTask, ...fresh };
    }
    renderTasks();
  } catch (error) {
    if (!quiet) showToast(error.message);
  }
}

async function selectTask(task) {
  state.selectedTask = { ...task, messages: [] };
  renderTasks();
  renderContext();
  transcriptEl.replaceChildren(node("div", "skeleton"), node("div", "skeleton"), node("div", "skeleton"));
  try {
    const result = await api(`/api/peers/${encodeURIComponent(state.selectedPeer.id)}/tasks/${encodeURIComponent(task.id)}`);
    state.selectedTask = result.task;
    renderTasks();
    renderContext();
    await heartbeat();
    await loadPresence();
  } catch (error) {
    showToast(error.message);
  }
}

async function heartbeat() {
  if (!state.selectedPeer || !state.selectedTask) return;
  try {
    await api(`/api/peers/${encodeURIComponent(state.selectedPeer.id)}/presence`, {
      method: "POST",
      body: JSON.stringify({ state: "viewing", taskId: state.selectedTask.id }),
    });
  } catch {
    // Presence is intentionally best effort; task access remains usable.
  }
}

async function leavePresence() {
  if (!state.selectedPeer) return;
  try {
    await api(`/api/peers/${encodeURIComponent(state.selectedPeer.id)}/presence`, {
      method: "POST",
      body: JSON.stringify({ state: "offline" }),
      keepalive: true,
    });
  } catch {}
}

async function loadPresence() {
  if (!state.selectedPeer?.online) return;
  try {
    const result = await api(`/api/peers/${encodeURIComponent(state.selectedPeer.id)}/presence`);
    state.presence = result.data || [];
    renderPresence();
  } catch {}
}

async function sendPrompt(event) {
  event.preventDefault();
  const text = promptEl.value.trim();
  if (!text || !state.selectedTask || state.sending) return;
  state.sending = true;
  promptEl.value = "";
  renderContext();
  const userMessage = { role: "user", author: state.me?.name || "You", text, at: new Date().toISOString() };
  transcriptEl.append(messageElement(userMessage));
  const agentMessage = { role: "assistant", author: state.selectedTask.provider === "claude" ? "Claude" : "Codex", text: "", at: new Date().toISOString() };
  const agentEl = messageElement(agentMessage, { streaming: true });
  transcriptEl.append(agentEl);
  const output = agentEl.querySelector(".message-text");
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
  let hasDelta = false;
  try {
    const response = await fetch(`/api/peers/${encodeURIComponent(state.selectedPeer.id)}/tasks/${encodeURIComponent(state.selectedTask.id)}/prompt`, {
      method: "POST",
      headers: { "x-mpai-dashboard-token": token, "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload?.error?.message || "Prompt failed");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line) continue;
        const item = JSON.parse(line);
        if (item.type === "agent.delta") {
          hasDelta = true;
          output.textContent += item.text || "";
        } else if (item.type === "agent.message" && !hasDelta) {
          output.textContent = item.text || "";
        } else if (item.type === "error") {
          throw new Error(item.message || "The AI turn failed");
        }
        transcriptEl.scrollTop = transcriptEl.scrollHeight;
      }
      if (done) break;
    }
    agentEl.classList.remove("streaming");
    await selectTask(state.selectedTask);
  } catch (error) {
    agentEl.classList.remove("streaming");
    output.textContent ||= `Turn failed: ${error.message}`;
    showToast(error.message);
  } finally {
    state.sending = false;
    renderContext();
    promptEl.focus();
  }
}

async function boot() {
  try {
    const bootstrap = await api("/api/bootstrap");
    state.me = bootstrap.identity;
    renderMe();
    await loadPeers();
  } catch (error) {
    showToast(error.message);
  }
}

composerEl.addEventListener("submit", sendPrompt);
promptEl.addEventListener("input", () => {
  promptEl.style.height = "auto";
  promptEl.style.height = `${Math.min(promptEl.scrollHeight, 150)}px`;
  sendEl.disabled = promptEl.disabled || !promptEl.value.trim();
});
promptEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composerEl.requestSubmit();
  }
});
$("#search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadTasks(), 180);
});
$("#refresh").addEventListener("click", () => loadTasks());
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#search").focus();
  }
});
window.addEventListener("beforeunload", () => void leavePresence());

setInterval(() => void loadPeers({ quiet: true }), 10_000);
setInterval(() => void loadTasks({ quiet: true }), 8_000);
setInterval(() => void Promise.all([heartbeat(), loadPresence()]), 15_000);
void boot();
