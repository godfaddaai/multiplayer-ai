#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { ClaudeProvider } from "./claude.js";
import { CodexClient } from "./codex.js";
import { AuditStore, ConfigStore } from "./config.js";
import { createDashboardServer, listenDashboard } from "./dashboard.js";
import { MpaiClient } from "./client.js";
import { MpaiError } from "./errors.js";
import { CodexProvider, TaskHub } from "./hub.js";
import { runTerminalRoom } from "./pair.js";
import {
  formatStreamEvent,
  formatThread,
  formatThreadList,
} from "./format.js";
import { createMpaiServer, listen } from "./server.js";
import {
  installService,
  readServiceLog,
  serviceStatus,
  uninstallService,
} from "./service.js";
import { tailscaleIPv4 } from "./tailscale.js";
import { VERSION } from "./version.js";
import {
  buildAlphaReceipt,
  buildSupportBundle,
  writeAlphaReceipt,
  writeSupportBundle,
} from "./support.js";
import { stableCliPath } from "./runtime.js";

const execFileAsync = promisify(execFile);
const SOURCE_CLI_PATH = fileURLToPath(import.meta.url);

async function serviceCliPath() {
  return stableCliPath({
    sourcePath: SOURCE_CLI_PATH,
    invokedPath: process.argv[1],
    pathEnv: process.env.PATH,
  });
}

const HELP = `Multiplayer AI (mpai)

Two-player terminal rooms for existing Codex and Claude Code sessions.

Fast path:
  mpai @Maya [SESSION_ID]          see and join Maya's AI sessions

  mpai --version

Setup and hosting:
  mpai setup --name Alex [--port 7337] [--no-service]
  mpai invite --name Maya [--role viewer|participant] [--share selected|all]
  mpai invites
  mpai share SESSION_ID --with Maya
  mpai share all --with Maya
  mpai unshare SESSION_ID|all --with Maya
  mpai revoke INVITE_ID
  mpai serve [--bind TAILSCALE_IP] [--port 7337]
             [--allow-standalone-prompts]
  mpai service install|status|logs|uninstall
  mpai doctor
  mpai support-bundle [--output PATH]
  mpai alpha-receipt [--output PATH]

Optional diagnostics:
  mpai dashboard [--port 7338] [--no-open]

Joining and collaborating:
  mpai join 'mpai://HOST:7337/join?token=...'
  mpai peers
  mpai @PEER [TASK_ID]              live terminal attach
  mpai pair @PEER [TASK_ID]         same as above
  mpai list [@PEER] [--limit 25] [--cwd PATH]
  mpai show [@PEER] THREAD_ID [--tail 6]
  mpai prompt @PEER THREAD_ID "message"
  mpai audit @PEER [--limit 100]

Notes:
  - The server binds to the Tailscale IPv4 address by default.
  - Viewer invites cannot prompt.
  - Remote approvals are always declined; the host retains execution authority.
  - Set MULTIPLAYER_AI_HOME to isolate configuration for testing.
`;

function parseArguments(argv) {
  const input = [...argv];
  const command = input.shift() || "help";
  const positionals = [];
  const options = {};
  for (let index = 0; index < input.length; index += 1) {
    const argument = input[index];
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    const equals = argument.indexOf("=");
    if (equals >= 0) {
      options[argument.slice(2, equals)] = argument.slice(equals + 1);
      continue;
    }
    const key = argument.slice(2);
    const next = input[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return { command, positionals, options };
}

function required(value, message) {
  if (!value) {
    throw new MpaiError(message, { code: "MISSING_ARGUMENT", status: 400 });
  }
  return value;
}

function clientForPeer(config, peer) {
  return new MpaiClient({
    baseUrl: peer.baseUrl,
    token: peer.token,
    identity: config.identity,
  });
}

async function peerClient(store, name) {
  const { config, peer } = await store.findPeer(name);
  return { peer, client: clientForPeer(config, peer) };
}

async function resolveThreadId(client, input) {
  if (String(input).length > 12) return input;
  const result = await client.listThreads({ limit: 100 });
  const matches = (result.data || []).filter((thread) =>
    thread.id.startsWith(input) ||
    thread.id.endsWith(input) ||
    thread.nativeId?.startsWith(input) ||
    thread.nativeId?.endsWith(input),
  );
  if (matches.length === 1) return matches[0].id;
  if (!matches.length) {
    throw new MpaiError(`No task starts with ${input}`, {
      code: "THREAD_NOT_FOUND",
      status: 404,
    });
  }
  throw new MpaiError(`Task prefix ${input} is ambiguous`, {
    code: "AMBIGUOUS_THREAD",
    status: 409,
  });
}

async function withLocalHub(options, callback) {
  const codex = new CodexClient({
    codexBin: options["codex-bin"] || "codex",
    mode: options["codex-mode"] || "auto",
  });
  const claude = new ClaudeProvider({
    claudeBin: options["claude-bin"] || "claude",
  });
  const hub = new TaskHub({
    providers: [new CodexProvider(codex), claude],
  });
  try {
    await hub.start();
    return await callback(hub);
  } finally {
    await hub.close();
  }
}

async function runSetup(store, options) {
  const existing = await store.load();
  const config = await store.setup({
    name: required(
      options.name || existing?.identity?.name,
      "Usage: mpai setup --name YOUR_NAME",
    ),
    port: options.port || existing?.host?.port || 7337,
  });
  console.log(`Configured ${config.identity.name}`);
  console.log(`State: ${store.root}`);
  if (!options["no-service"] && process.platform === "darwin") {
    try {
      const bindAddress = await tailscaleIPv4();
      const path = await installService({
        cliPath: await serviceCliPath(),
        stateRoot: store.root,
        codexBin: options["codex-bin"] || "codex",
        claudeBin: options["claude-bin"] || "claude",
        pathEnv: process.env.PATH,
        bindAddress,
      });
      console.log(`Background service running: ${path}`);
    } catch (error) {
      console.log(`Background service not installed yet: ${error.message}`);
    }
  }
  console.log("\nChecking this Mac…");
  await runDoctor(store, options);
  console.log(
    "\nNext: invite a teammate who can collaborate with `mpai invite --name TEAMMATE --role participant --share selected`.",
  );
}

async function runInvite(store, options) {
  const config = await store.load({ required: true });
  const address = options.address || (await tailscaleIPv4());
  const result = await store.createInvite({
    name: required(options.name, "Usage: mpai invite --name TEAMMATE"),
    role: options.role || "viewer",
    share: options.share || "selected",
    address,
    port: Number(options.port || config.host.port),
  });
  console.log(
    `${result.invitation.name} · ${result.invitation.role} · ${result.invitation.taskAccess.mode} sessions`,
  );
  console.log(`\nSend ${result.invitation.name} these two lines:`);
  console.log("brew install godfaddaai/tap/mpai");
  console.log(`mpai join '${result.url}'`);
  console.log("\nThe invite is a secret and binds to the first Tailscale identity that uses it.");
  if (result.invitation.taskAccess.mode === "selected") {
    console.log("\nYour sessions remain private. Choose one with `mpai list`, then share it:");
    console.log(`mpai share SESSION_ID --with ${result.invitation.name}`);
  } else {
    console.log(`\n${result.invitation.name} can access all current and future sessions until you unshare or revoke this invite.`);
  }
  if (result.invitation.role === "viewer") {
    console.log(`${result.invitation.name} can view shared sessions but cannot prompt them.`);
  }
}

async function runInvites(store) {
  const invitations = await store.listInvites();
  if (!invitations.length) {
    console.log("No invites.");
    return;
  }
  for (const invitation of invitations) {
    const state = invitation.revokedAt
      ? "revoked"
      : invitation.claimedBy
        ? "claimed"
        : "unclaimed";
    console.log(
      `${invitation.id.slice(0, 8)}  ${invitation.role.padEnd(11)}  ${state.padEnd(9)}  ${invitation.taskAccess.mode.padEnd(8)}  ${invitation.name}`,
    );
  }
}

async function resolveLocalTaskId(hub, input) {
  const value = String(input || "");
  if (value.includes(":")) {
    await hub.readTask(value);
    return value;
  }
  const tasks = await hub.listTasks({ limit: 100 });
  const matches = tasks.filter((task) =>
    task.id.startsWith(value) ||
    task.id.endsWith(value) ||
    task.nativeId?.startsWith(value) ||
    task.nativeId?.endsWith(value)
  );
  if (matches.length === 1) return matches[0].id;
  throw new MpaiError(
    matches.length ? `Task prefix ${value} is ambiguous` : `No task starts with ${value}`,
    {
      code: matches.length ? "AMBIGUOUS_THREAD" : "THREAD_NOT_FOUND",
      status: matches.length ? 409 : 404,
    },
  );
}

async function runShare(store, positionals, options, action) {
  const input = required(
    positionals[0],
    `Usage: mpai ${action} SESSION_ID|all --with TEAMMATE`,
  );
  const teammate = required(
    options.with,
    `Usage: mpai ${action} SESSION_ID|all --with TEAMMATE`,
  );
  if (input.toLowerCase() === "all") {
    const invitation = await store.updateTaskAccess(teammate, {
      mode: action === "share" ? "all" : "selected",
      clear: action === "unshare",
    });
    console.log(
      action === "share"
        ? `All current and future AI sessions are shared with ${invitation.name}.`
        : `All AI sessions are now private from ${invitation.name}.`,
    );
    return;
  }
  await withLocalHub(options, async (hub) => {
    const taskId = await resolveLocalTaskId(hub, input);
    const invitation = await store.updateTaskAccess(teammate, { taskId, action });
    console.log(
      `${taskId} ${action === "share" ? "shared with" : "hidden from"} ${invitation.name}.`,
    );
  });
}

async function runJoin(store, positionals, options) {
  const invite = required(positionals[0], "Usage: mpai join 'mpai://...'");
  let config = await store.load();
  const client = MpaiClient.fromInvite(invite, { identity: config?.identity });
  const remote = await client.whoami();
  const initialized = !config;
  if (initialized) {
    config = await store.setup({ name: remote.actor.name, port: 7337 });
  }
  const peer = await store.addPeer({
    name: remote.host.name,
    baseUrl: client.baseUrl,
    token: client.token,
    hostIdentity: remote.host,
    actorIdentity: remote.actor,
  });
  console.log(`Joined ${peer.name} as ${remote.actor.name} (${remote.role})`);
  if (peer.credential?.storage === "file") {
    console.log("Credential: protected mode-0600 local fallback (Keychain was unavailable in this session).");
  }
  if (initialized && process.platform === "darwin" && !options["no-service"]) {
    try {
      const bindAddress = await tailscaleIPv4();
      const path = await installService({
        cliPath: await serviceCliPath(),
        stateRoot: store.root,
        codexBin: options["codex-bin"] || "codex",
        claudeBin: options["claude-bin"] || "claude",
        pathEnv: process.env.PATH,
        bindAddress,
      });
      await fetchHostHealth(bindAddress, config.host.port, { attempts: 5 });
      console.log(`This Mac is ready to host too: ${path}`);
    } catch (error) {
      console.log(`Hosting is not running yet: ${error.message}`);
      console.log("Run `mpai service install` when you want to share your sessions back.");
    }
  }
  try {
    const result = await client.listTasks({ limit: 100 });
    const count = result.data?.length || 0;
    if (count) {
      console.log(`${count} shared session${count === 1 ? " is" : "s are"} ready.`);
      console.log(`Next: mpai @${peer.name}`);
    } else {
      console.log(`${peer.name} has not shared a session with you yet.`);
      console.log(`Ask ${peer.name} to run: mpai share SESSION_ID --with ${remote.actor.name}`);
    }
  } catch (error) {
    console.log(`Connected, but the first session check failed: ${error.message}`);
    console.log(`Retry with: mpai @${peer.name}`);
  }
}

async function runPeers(store) {
  const config = await store.load({ required: true });
  if (!config.peers.length) {
    console.log("No peers. Ask a teammate for an `mpai invite` URL.");
    return;
  }
  for (const peer of config.peers) {
    console.log(`@${peer.name}  ${peer.baseUrl}`);
  }
}

async function runPair(store, positionals) {
  const peerName = required(
    positionals[0]?.startsWith("@") ? positionals[0] : null,
    "Usage: mpai @PEER [TASK_ID]",
  );
  const { config, peer } = await store.findPeer(peerName);
  const client = clientForPeer(config, peer);
  await runTerminalRoom({
    client,
    peer,
    identity: peer.joinedAs || config.identity,
    taskInput: positionals[1],
  });
}

async function runServe(store, options) {
  const config = await store.load({ required: true });
  const host = options.bind || (await tailscaleIPv4());
  const port = Number(options.port || config.host.port);
  const codex = new CodexClient({
    codexBin: options["codex-bin"] || "codex",
    mode: options["codex-mode"] || "auto",
  });
  const claude = new ClaudeProvider({
    claudeBin: options["claude-bin"] || "claude",
  });
  const hub = new TaskHub({
    providers: [new CodexProvider(codex), claude],
  });
  await hub.start();
  const allowStandalonePrompts = Boolean(options["allow-standalone-prompts"]);
  const server = createMpaiServer({
    configStore: store,
    hub,
    allowStandalonePrompts,
  });
  await listen(server, { host, port });
  console.log(`Multiplayer AI is serving ${config.identity.name}`);
  console.log(`Tailnet: http://${host}:${port}`);
  for (const provider of hub.status()) {
    console.log(`${provider.name}: ${provider.available ? provider.transport : `unavailable · ${provider.error}`}`);
  }
  if (codex.transport === "standalone" && !allowStandalonePrompts) {
    console.log("Prompts: disabled in standalone mode (viewing is enabled)");
  }
  console.log("Press Ctrl-C to stop.");

  const stop = async () => {
    await new Promise((resolve) => server.close(resolve));
    await hub.close();
  };
  process.once("SIGINT", () => void stop().then(() => process.exit(0)));
  process.once("SIGTERM", () => void stop().then(() => process.exit(0)));
}

async function runDashboard(store, options) {
  const config = await store.load({ required: true });
  const server = createDashboardServer({
    configStore: store,
    logger: process.env.MPAI_DEBUG === "1" ? console : { error() {} },
  });
  const port = Number(options.port || 7338);
  const address = await listenDashboard(server, { host: "127.0.0.1", port });
  const url = `http://127.0.0.1:${address.port}`;
  console.log(`Optional Multiplayer AI diagnostics: ${url}`);
  console.log(`${config.peers.length} teammate${config.peers.length === 1 ? "" : "s"} configured · browser credentials stay on this Mac`);
  if (!options["no-open"]) {
    try {
      await execFileAsync("open", [url], { timeout: 5000 });
    } catch (error) {
      console.log(`Could not open the browser automatically: ${error.message}`);
    }
  }
  console.log("Press Ctrl-C to stop.");
  const stop = () => new Promise((resolve) => server.close(resolve));
  process.once("SIGINT", () => void stop().then(() => process.exit(0)));
  process.once("SIGTERM", () => void stop().then(() => process.exit(0)));
}

async function runList(store, positionals, options) {
  const peerName = positionals[0]?.startsWith("@") ? positionals[0] : null;
  if (peerName) {
    const { peer, client } = await peerClient(store, peerName);
    const result = await client.listThreads({
      limit: options.limit || 25,
      cwd: options.cwd,
      search: options.search,
    });
    console.log(formatThreadList(result.data || [], { owner: peer.name }));
    return;
  }
  await withLocalHub(options, async (hub) => {
    const tasks = await hub.listTasks({
      limit: options.limit || 25,
      cwd: options.cwd,
      search: options.search,
    });
    console.log(formatThreadList(tasks));
    console.log(`\nAdapters: ${hub.status().filter((item) => item.available).map((item) => item.name).join(", ")}`);
  });
}

async function runShow(store, positionals, options) {
  const tail = options.tail === undefined ? null : Number(options.tail);
  if (tail !== null && (!Number.isInteger(tail) || tail < 1 || tail > 100)) {
    throw new MpaiError("--tail must be an integer from 1 to 100", {
      code: "INVALID_ARGUMENT",
      status: 400,
    });
  }
  const limitMessages = (thread) => {
    if (tail === null) return thread;
    if (Array.isArray(thread.messages)) {
      return { ...thread, messages: thread.messages.slice(-tail) };
    }
    if (Array.isArray(thread.turns)) {
      return { ...thread, turns: thread.turns.slice(-tail) };
    }
    return thread;
  };
  const hasPeer = positionals[0]?.startsWith("@");
  if (hasPeer) {
    const { client } = await peerClient(store, positionals[0]);
    const input = required(
      positionals[1],
      "Usage: mpai show @PEER THREAD_ID",
    );
    const threadId = await resolveThreadId(client, input);
    const result = await client.readThread(threadId);
    console.log(formatThread(limitMessages(result.thread)));
    return;
  }
  const input = required(positionals[0], "Usage: mpai show THREAD_ID");
  await withLocalHub(options, async (hub) => {
    let threadId = input;
    if (String(input).length <= 12) {
      const tasks = await hub.listTasks({ limit: 100 });
      const matches = tasks.filter((thread) =>
        thread.id.startsWith(input) ||
        thread.id.endsWith(input) ||
        thread.nativeId?.startsWith(input) ||
        thread.nativeId?.endsWith(input),
      );
      if (matches.length !== 1) {
        throw new MpaiError(
          matches.length
            ? `Task prefix ${input} is ambiguous`
            : `No task starts with ${input}`,
          {
            code: matches.length ? "AMBIGUOUS_THREAD" : "THREAD_NOT_FOUND",
            status: matches.length ? 409 : 404,
          },
        );
      }
      threadId = matches[0].id;
    }
    const result = await hub.readTask(threadId);
    console.log(formatThread(limitMessages(result.task)));
  });
}

async function runPrompt(store, positionals) {
  const peerName = required(
    positionals[0]?.startsWith("@") ? positionals[0] : null,
    'Usage: mpai prompt @PEER THREAD_ID "message"',
  );
  const input = required(
    positionals[1],
    'Usage: mpai prompt @PEER THREAD_ID "message"',
  );
  const text = required(
    positionals.slice(2).join(" ").trim(),
    'Usage: mpai prompt @PEER THREAD_ID "message"',
  );
  const { client } = await peerClient(store, peerName);
  const threadId = await resolveThreadId(client, input);
  let sawAgentDelta = false;
  await client.prompt(threadId, text, {
    onEvent(event) {
      if (event.type === "agent.delta") sawAgentDelta = true;
      if (event.type === "agent.message" && sawAgentDelta) return;
      const output = formatStreamEvent(event);
      if (output) process.stdout.write(output);
    },
  });
  if (!process.stdout.isTTY) process.stdout.write("\n");
}

async function runAudit(store, positionals, options) {
  const peerName = required(
    positionals[0]?.startsWith("@") ? positionals[0] : null,
    "Usage: mpai audit @PEER",
  );
  const { client } = await peerClient(store, peerName);
  const result = await client.audit({ limit: options.limit || 100 });
  for (const event of result.data || []) {
    console.log(
      `${event.at}  ${(event.actor?.name || "system").padEnd(12)}  ${event.type.padEnd(18)}  ${event.threadId || ""}`,
    );
  }
}

async function runDoctor(store, options) {
  const checks = [];
  const config = await store.load();
  let tailnetAddress = null;
  checks.push({
    name: "configuration",
    ok: Boolean(config?.identity?.name),
    detail: config?.identity?.name || "not configured",
  });
  try {
    tailnetAddress = await tailscaleIPv4();
    checks.push({ name: "tailscale", ok: true, detail: tailnetAddress });
  } catch (error) {
    checks.push({ name: "tailscale", ok: false, detail: error.message });
  }
  if (process.platform === "darwin") {
    const status = await serviceStatus();
    checks.push({
      name: "background service",
      ok: status.loaded && status.state === "running",
      required: !options["no-service"],
      detail: status.loaded
        ? `${status.state}${status.pid ? `; pid ${status.pid}` : ""}`
        : "not installed",
    });
    if (status.loaded && tailnetAddress && config?.host?.port) {
      try {
        const health = await fetchHostHealth(tailnetAddress, config.host.port, {
          attempts: 5,
        });
        checks.push({
          name: "host endpoint",
          ok: health.ok && health.version === VERSION,
          detail: health.ok
            ? `v${health.version}; ${health.providers.filter((provider) => provider.available).map((provider) => provider.name).join(", ") || "no provider"}`
            : "unhealthy",
        });
      } catch (error) {
        checks.push({ name: "host endpoint", ok: false, detail: error.message });
      }
    }
  }
  try {
    const { stdout } = await execFileAsync(
      options["codex-bin"] || "codex",
      ["--version"],
      { timeout: 5000 },
    );
    checks.push({ name: "codex CLI", ok: true, detail: stdout.trim(), required: false });
  } catch (error) {
    checks.push({ name: "codex CLI", ok: false, detail: "not installed (optional)", required: false });
  }
  try {
    const { stdout } = await execFileAsync(
      options["claude-bin"] || "claude",
      ["--version"],
      { timeout: 5000 },
    );
    checks.push({ name: "claude CLI", ok: true, detail: stdout.trim(), required: false });
  } catch (error) {
    checks.push({ name: "claude CLI", ok: false, detail: "not installed (optional)", required: false });
  }
  try {
    await withLocalHub(options, async (hub) => {
      const tasks = await hub.listTasks({ limit: 10 });
      for (const provider of hub.status()) {
        checks.push({
          name: `${provider.name} adapter`,
          ok: provider.available,
          required: false,
          detail: provider.available
            ? `${provider.transport}; ${tasks.filter((task) => task.provider === provider.id).length} task(s) sampled`
            : provider.error,
        });
      }
      checks.push({
        name: "AI session provider",
        ok: hub.status().some((provider) => provider.available),
        detail: hub.status().filter((provider) => provider.available).map((provider) => provider.name).join(", ") || "none available",
      });
    });
  } catch (error) {
    checks.push({ name: "AI task adapters", ok: false, detail: error.message });
  }
  for (const check of checks) {
    console.log(`${check.ok ? "✓" : check.required === false ? "○" : "✗"} ${check.name}: ${check.detail}`);
  }
  if (checks.some((check) => !check.ok && check.required !== false)) process.exitCode = 1;
}

async function fetchHostHealth(address, port, { attempts = 1 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`http://${address}:${port}/v1/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error(`health returned ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
      }
    }
  }
  throw new MpaiError(`service is not reachable: ${lastError?.message || "unknown error"}`, {
    code: "SERVICE_UNREACHABLE",
    cause: lastError,
  });
}

async function runSupportBundle(store, options) {
  const config = await store.load();
  let tailscale;
  try {
    await tailscaleIPv4();
    tailscale = { ready: true };
  } catch (error) {
    tailscale = { ready: false, error: error.message };
  }
  const service = process.platform === "darwin"
    ? await serviceStatus()
    : { supported: false, loaded: false, state: "unsupported", pid: null };
  if (service.loaded && tailscale.ready && config?.host?.port) {
    try {
      service.health = await fetchHostHealth(
        await tailscaleIPv4(),
        config.host.port,
      );
    } catch (error) {
      service.healthError = error.message;
    }
  }
  let providers = [];
  let tasks = [];
  try {
    await withLocalHub(options, async (hub) => {
      providers = hub.status();
      tasks = await hub.listTasks({ limit: 100 });
    });
  } catch (error) {
    providers = [{
      id: "provider-hub",
      available: false,
      transport: null,
      error: error.message,
    }];
  }
  const auditEvents = await new AuditStore({ path: store.auditPath }).list({
    limit: 1000,
  });
  const bundle = buildSupportBundle({
    config,
    service,
    tailscale,
    providers,
    tasks,
    auditEvents,
  });
  const path = await writeSupportBundle(bundle, {
    outputPath: options.output,
  });
  console.log(`Redacted support bundle: ${path}`);
  console.log("Review it before sharing. It contains metadata only—never prompts, transcripts, tokens, names, paths, or network addresses.");
}

async function runAlphaReceipt(store, options) {
  const config = await store.load();
  const auditEvents = await new AuditStore({ path: store.auditPath }).list({
    limit: 1000,
  });
  const receipt = buildAlphaReceipt({ config, auditEvents });
  const path = await writeAlphaReceipt(receipt, {
    outputPath: options.output,
  });
  console.log(`Private alpha receipt: ${path}`);
  console.log("Nothing was sent. Review the JSON before sharing it with the first-10-team cohort.");
  console.log("The receipt contains counts and elapsed minutes only—never prompts, transcripts, names, task IDs, paths, tokens, addresses, or event timestamps.");
}

async function runService(store, positionals, options) {
  const action = positionals[0] || "status";
  await store.load({ required: true });
  if (action === "install") {
    const bindAddress = options.bind || (await tailscaleIPv4());
    const path = await installService({
      cliPath: await serviceCliPath(),
      stateRoot: store.root,
      codexBin: options["codex-bin"] || "codex",
      claudeBin: options["claude-bin"] || "claude",
      pathEnv: process.env.PATH,
      bindAddress,
    });
    console.log(`Installed and started ${path}`);
    return;
  }
  if (action === "uninstall") {
    const path = await uninstallService();
    console.log(`Stopped and removed ${path}`);
    console.log(`Configuration and audit data remain in ${store.root}`);
    return;
  }
  if (action === "logs") {
    const output = await readServiceLog({
      stateRoot: store.root,
      lines: options.lines || 40,
    });
    console.log(output || "No service log yet.");
    return;
  }
  if (action === "status") {
    const status = await serviceStatus();
    console.log(
      status.loaded
        ? `running${status.pid ? ` · pid ${status.pid}` : ""} · ${status.state}`
        : "stopped",
    );
    console.log(status.path);
    return;
  }
  throw new MpaiError(
    "Usage: mpai service install|status|logs|uninstall",
    { code: "UNKNOWN_SERVICE_ACTION", status: 400 },
  );
}

async function main() {
  const { command, positionals, options } = parseArguments(
    process.argv.slice(2),
  );
  const store = new ConfigStore();
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      break;
    case "--version":
    case "-v":
      console.log(VERSION);
      break;
    case "setup":
      await runSetup(store, options);
      break;
    case "invite":
      await runInvite(store, options);
      break;
    case "invites":
      await runInvites(store);
      break;
    case "share":
      await runShare(store, positionals, options, "share");
      break;
    case "unshare":
      await runShare(store, positionals, options, "unshare");
      break;
    case "revoke":
      await store.revokeInvite(
        required(positionals[0], "Usage: mpai revoke INVITE_ID"),
      );
      console.log("Invite revoked.");
      break;
    case "join":
      await runJoin(store, positionals, options);
      break;
    case "peers":
      await runPeers(store);
      break;
    case "pair":
    case "attach":
    case "room":
      await runPair(store, positionals);
      break;
    case "serve":
      await runServe(store, options);
      break;
    case "service":
      await runService(store, positionals, options);
      break;
    case "dashboard":
    case "open":
      await runDashboard(store, options);
      break;
    case "list":
    case "threads":
      await runList(store, positionals, options);
      break;
    case "show":
      await runShow(store, positionals, options);
      break;
    case "prompt":
      await runPrompt(store, positionals);
      break;
    case "audit":
      await runAudit(store, positionals, options);
      break;
    case "doctor":
      await runDoctor(store, options);
      break;
    case "support-bundle":
    case "support":
      await runSupportBundle(store, options);
      break;
    case "alpha-receipt":
    case "cohort-receipt":
      await runAlphaReceipt(store, options);
      break;
    default:
      if (command.startsWith("@")) {
        await runPair(store, [command, ...positionals]);
        break;
      }
      throw new MpaiError(`Unknown command ${command}\n\n${HELP}`, {
        code: "UNKNOWN_COMMAND",
        status: 400,
      });
  }
}

main().catch((error) => {
  console.error(`mpai: ${error.message}`);
  if (process.env.MPAI_DEBUG === "1" && error.stack) console.error(error.stack);
  process.exitCode = 1;
});
