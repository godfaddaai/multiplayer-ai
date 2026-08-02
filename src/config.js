import {
  appendFile,
  chmod,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { MpaiError } from "./errors.js";

const VERSION = 1;

function normalizeTaskAccess(value, { legacy = false } = {}) {
  const mode = value?.mode === "all" || value?.mode === "selected"
    ? value.mode
    : legacy
      ? "all"
      : "selected";
  return {
    mode,
    taskIds: [...new Set((value?.taskIds || []).map(String))],
    excludedTaskIds: [...new Set((value?.excludedTaskIds || []).map(String))],
  };
}

function cleanTaskId(value) {
  const taskId = String(value || "").trim();
  if (!taskId || taskId.length > 200 || !/^[a-zA-Z0-9:_-]+$/u.test(taskId)) {
    throw new MpaiError("Invalid task id", {
      code: "INVALID_TASK_ID",
      status: 400,
    });
  }
  return taskId;
}

export function invitationCanAccess(invitation, taskId) {
  const access = normalizeTaskAccess(invitation?.taskAccess, { legacy: true });
  const id = String(taskId || "");
  return access.mode === "all"
    ? !access.excludedTaskIds.includes(id)
    : access.taskIds.includes(id);
}

function cleanName(value, field = "name") {
  const name = String(value || "").trim();
  if (!name || name.length > 80 || /[\u0000-\u001f]/u.test(name)) {
    throw new MpaiError(`${field} must be between 1 and 80 printable characters`, {
      code: "INVALID_NAME",
      status: 400,
    });
  }
  return name;
}

function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function hashesEqual(left, right) {
  const a = Buffer.from(left || "", "hex");
  const b = Buffer.from(right || "", "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function defaultStateRoot() {
  return process.env.MULTIPLAYER_AI_HOME || join(homedir(), ".multiplayer-ai");
}

export class ConfigStore {
  constructor({ root = defaultStateRoot() } = {}) {
    this.root = root;
    this.configPath = join(root, "config.json");
    this.auditPath = join(root, "audit.jsonl");
    this.mutationQueue = Promise.resolve();
  }

  async load({ required = false } = {}) {
    try {
      const parsed = JSON.parse(await readFile(this.configPath, "utf8"));
      if (parsed.version !== VERSION) {
        throw new MpaiError(
          `Unsupported config version ${parsed.version}; expected ${VERSION}`,
          { code: "CONFIG_VERSION" },
        );
      }
      parsed.invites ||= [];
      for (const invitation of parsed.invites) {
        invitation.taskAccess = normalizeTaskAccess(invitation.taskAccess, {
          legacy: !invitation.taskAccess,
        });
      }
      parsed.peers ||= [];
      parsed.host ||= { port: 7337 };
      return parsed;
    } catch (error) {
      if (error?.code === "ENOENT" && !required) return null;
      if (error?.code === "ENOENT") {
        throw new MpaiError("Run `mpai setup --name YOUR_NAME` first.", {
          code: "NOT_CONFIGURED",
          status: 400,
        });
      }
      if (error instanceof MpaiError) throw error;
      throw new MpaiError(`Could not read ${this.configPath}: ${error.message}`, {
        code: "CONFIG_READ",
        cause: error,
      });
    }
  }

  async save(config) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await chmod(this.root, 0o700);
    const temporaryPath = join(
      dirname(this.configPath),
      `.config-${process.pid}-${randomUUID()}.tmp`,
    );
    await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporaryPath, this.configPath);
    await chmod(this.configPath, 0o600);
  }

  async setup({ name, port = 7337 }) {
    const existing = await this.load();
    const config = existing || {
      version: VERSION,
      identity: {
        id: randomUUID(),
        name: cleanName(name),
        createdAt: new Date().toISOString(),
      },
      host: { port: Number(port) },
      invites: [],
      peers: [],
    };
    config.identity.name = cleanName(name);
    config.host.port = Number(port);
    if (!Number.isInteger(config.host.port) || config.host.port < 1024 || config.host.port > 65535) {
      throw new MpaiError("port must be an integer between 1024 and 65535", {
        code: "INVALID_PORT",
        status: 400,
      });
    }
    await this.save(config);
    return config;
  }

  async createInvite({ name, role = "viewer", share = "selected", address, port }) {
    const config = await this.load({ required: true });
    if (!["viewer", "participant"].includes(role)) {
      throw new MpaiError("role must be viewer or participant", {
        code: "INVALID_ROLE",
        status: 400,
      });
    }
    if (!["selected", "all"].includes(share)) {
      throw new MpaiError("share must be selected or all", {
        code: "INVALID_SHARE_MODE",
        status: 400,
      });
    }
    const token = randomBytes(32).toString("base64url");
    const invitation = {
      id: randomUUID(),
      name: cleanName(name, "invite name"),
      role,
      taskAccess: normalizeTaskAccess({ mode: share }),
      tokenHash: hashToken(token),
      claimedBy: null,
      claimedAt: null,
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };
    config.invites.push(invitation);
    await this.save(config);
    const encodedHost = address.includes(":") ? `[${address}]` : address;
    const url = new URL(`mpai://${encodedHost}:${port}/join`);
    url.searchParams.set("token", token);
    url.searchParams.set("host", config.identity.name);
    return { invitation, url: url.toString() };
  }

  async listInvites() {
    const config = await this.load({ required: true });
    return config.invites.map(({ tokenHash: _tokenHash, ...invite }) => invite);
  }

  async revokeInvite(id) {
    const config = await this.load({ required: true });
    const invitation = config.invites.find(
      (candidate) => candidate.id === id || candidate.id.startsWith(id),
    );
    if (!invitation) {
      throw new MpaiError(`Invite ${id} was not found`, {
        code: "INVITE_NOT_FOUND",
        status: 404,
      });
    }
    invitation.revokedAt = new Date().toISOString();
    await this.save(config);
    return invitation;
  }

  async updateTaskAccess(inviteReference, {
    taskId,
    mode,
    action = "share",
    clear = false,
  } = {}) {
    return this.#mutate(async () => {
      const config = await this.load({ required: true });
      const reference = String(inviteReference || "").replace(/^@/u, "").toLowerCase();
      const matches = config.invites.filter((candidate) =>
        candidate.id.toLowerCase().startsWith(reference) ||
        candidate.name.toLowerCase() === reference
      );
      if (matches.length !== 1) {
        throw new MpaiError(
          matches.length
            ? `Invite ${inviteReference} is ambiguous`
            : `Invite ${inviteReference} was not found`,
          {
            code: matches.length ? "AMBIGUOUS_INVITE" : "INVITE_NOT_FOUND",
            status: matches.length ? 409 : 404,
          },
        );
      }
      const invitation = matches[0];
      const access = normalizeTaskAccess(invitation.taskAccess, {
        legacy: !invitation.taskAccess,
      });
      if (mode) {
        if (!["selected", "all"].includes(mode)) {
          throw new MpaiError("share mode must be selected or all", {
            code: "INVALID_SHARE_MODE",
            status: 400,
          });
        }
        access.mode = mode;
        if (mode === "all") access.excludedTaskIds = [];
        if (mode === "selected") {
          access.excludedTaskIds = [];
          if (clear) access.taskIds = [];
        }
      }
      if (taskId) {
        const id = cleanTaskId(taskId);
        if (action === "share") {
          access.excludedTaskIds = access.excludedTaskIds.filter((value) => value !== id);
          if (!access.taskIds.includes(id)) access.taskIds.push(id);
        } else if (action === "unshare") {
          access.taskIds = access.taskIds.filter((value) => value !== id);
          if (access.mode === "all" && !access.excludedTaskIds.includes(id)) {
            access.excludedTaskIds.push(id);
          }
        } else {
          throw new MpaiError("action must be share or unshare", {
            code: "INVALID_SHARE_ACTION",
            status: 400,
          });
        }
      }
      invitation.taskAccess = access;
      await this.save(config);
      const { tokenHash: _tokenHash, ...safeInvitation } = invitation;
      return safeInvitation;
    });
  }

  async authenticate(token, networkIdentity) {
    return this.#mutate(async () => {
      return this.#authenticateLocked(token, networkIdentity);
    });
  }

  async #authenticateLocked(token, networkIdentity) {
    if (!token) {
      throw new MpaiError("Missing bearer token", {
        code: "UNAUTHORIZED",
        status: 401,
      });
    }
    const config = await this.load({ required: true });
    const tokenHash = hashToken(token);
    const invitation = config.invites.find(
      (candidate) =>
        !candidate.revokedAt && hashesEqual(candidate.tokenHash, tokenHash),
    );
    if (!invitation) {
      throw new MpaiError("Invalid or revoked invite", {
        code: "UNAUTHORIZED",
        status: 401,
      });
    }
    if (
      invitation.claimedBy &&
      invitation.claimedBy !== networkIdentity.userId
    ) {
      throw new MpaiError("This invite is already bound to another tailnet identity", {
        code: "INVITE_IDENTITY_MISMATCH",
        status: 403,
      });
    }
    if (!invitation.claimedBy) {
      invitation.claimedBy = networkIdentity.userId;
      invitation.claimedAt = new Date().toISOString();
      await this.save(config);
    }
    return {
      invitation: {
        id: invitation.id,
        name: invitation.name,
        role: invitation.role,
        taskAccess: normalizeTaskAccess(invitation.taskAccess, { legacy: true }),
      },
      actor: {
        id: `tailscale:${networkIdentity.userId}`,
        name: invitation.name,
        tailscaleName: networkIdentity.displayName,
        loginName: networkIdentity.loginName,
        device: networkIdentity.device,
      },
      host: config.identity,
    };
  }

  async addPeer({ name, baseUrl, token, hostIdentity }) {
    const config = await this.load({ required: true });
    const normalizedName = cleanName(name || hostIdentity?.name, "peer name");
    const peer = {
      id: hostIdentity?.id || randomUUID(),
      name: normalizedName,
      baseUrl: String(baseUrl).replace(/\/+$/u, ""),
      token,
      addedAt: new Date().toISOString(),
    };
    const index = config.peers.findIndex(
      (candidate) =>
        candidate.id === peer.id ||
        candidate.name.toLowerCase() === peer.name.toLowerCase(),
    );
    if (index >= 0) config.peers[index] = peer;
    else config.peers.push(peer);
    await this.save(config);
    return peer;
  }

  async findPeer(name) {
    const config = await this.load({ required: true });
    const normalized = String(name || "").replace(/^@/u, "").toLowerCase();
    const peer = config.peers.find(
      (candidate) =>
        candidate.name.toLowerCase() === normalized ||
        candidate.id.toLowerCase().startsWith(normalized),
    );
    if (!peer) {
      throw new MpaiError(`Unknown peer ${name}. Run \`mpai peers\` to list peers.`, {
        code: "PEER_NOT_FOUND",
        status: 404,
      });
    }
    return { config, peer };
  }

  #mutate(operation) {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.catch(() => {});
    return result;
  }
}

export class AuditStore {
  constructor({ path }) {
    this.path = path;
    this.promptIds = null;
  }

  async append(event) {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const record = {
      id: randomUUID(),
      at: new Date().toISOString(),
      ...event,
    };
    await appendFile(this.path, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    await chmod(this.path, 0o600);
    if (record.type === "prompt.received") {
      (await this.#loadPromptIds()).add(record.requestId);
    }
    return record;
  }

  async hasPrompt(requestId) {
    return (await this.#loadPromptIds()).has(requestId);
  }

  async list({ limit = 100 } = {}) {
    try {
      const lines = (await readFile(this.path, "utf8"))
        .split("\n")
        .filter(Boolean);
      return lines
        .slice(-Math.max(1, Math.min(Number(limit) || 100, 1000)))
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async #loadPromptIds() {
    if (this.promptIds) return this.promptIds;
    let events = [];
    try {
      events = (await readFile(this.path, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    this.promptIds = new Set(
      events
        .filter((event) => event.type === "prompt.received")
        .map((event) => event.requestId),
    );
    return this.promptIds;
  }
}
