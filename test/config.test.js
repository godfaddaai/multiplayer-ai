import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigStore, invitationCanAccess } from "../src/config.js";

const roots = [];

async function store() {
  const root = await mkdtemp(join(tmpdir(), "mpai-config-"));
  roots.push(root);
  return new ConfigStore({ root });
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("invite binds to the first tailnet identity", async () => {
  const config = await store();
  await config.setup({ name: "Alex", port: 7337 });
  const { url } = await config.createInvite({
    name: "Maya",
    role: "participant",
    address: "100.64.0.1",
    port: 7337,
  });
  const token = new URL(url).searchParams.get("token");
  const first = await config.authenticate(token, {
    userId: "42",
    displayName: "Maya Real",
    loginName: "maya@example.com",
    device: "Maya Mac",
  });
  assert.equal(first.actor.name, "Maya");
  assert.equal(first.invitation.role, "participant");

  await assert.rejects(
    config.authenticate(token, {
      userId: "99",
      displayName: "Someone Else",
      loginName: "else@example.com",
      device: "Other Mac",
    }),
    { code: "INVITE_IDENTITY_MISMATCH" },
  );
});

test("revoked invite is rejected", async () => {
  const config = await store();
  await config.setup({ name: "Alex", port: 7337 });
  const { invitation, url } = await config.createInvite({
    name: "Maya",
    role: "viewer",
    address: "100.64.0.1",
    port: 7337,
  });
  await config.revokeInvite(invitation.id.slice(0, 8));
  await assert.rejects(
    config.authenticate(new URL(url).searchParams.get("token"), {
      userId: "42",
      displayName: "Maya",
      loginName: "maya@example.com",
      device: "Maya Mac",
    }),
    { code: "UNAUTHORIZED" },
  );
});

test("peer bearer tokens are stored outside config and hydrated on use", async () => {
  const config = await store();
  await config.setup({ name: "Alex", port: 7337 });
  await config.addPeer({
    name: "Maya",
    baseUrl: "http://100.64.0.2:7337",
    token: "peer-secret-token",
    hostIdentity: { id: "maya-id", name: "Maya" },
    actorIdentity: { id: "tailscale:42", name: "Alex from invite" },
  });

  const rawConfig = await readFile(config.configPath, "utf8");
  assert.doesNotMatch(rawConfig, /peer-secret-token/u);
  const loaded = await config.load({ required: true });
  assert.equal(loaded.peers[0].credential.storage, "file");
  assert.equal(Object.hasOwn(loaded.peers[0], "token"), false);
  assert.deepEqual(loaded.peers[0].joinedAs, {
    id: "tailscale:42",
    name: "Alex from invite",
  });

  const { peer } = await config.findPeer("Maya");
  assert.equal(peer.token, "peer-secret-token");
});

test("legacy inline peer tokens migrate out of config on first load", async () => {
  const config = await store();
  const state = await config.setup({ name: "Alex", port: 7337 });
  state.peers.push({
    id: "legacy-maya",
    name: "Maya",
    baseUrl: "http://100.64.0.2:7337",
    token: "legacy-inline-token",
    addedAt: new Date().toISOString(),
  });
  await config.save(state);

  const migrated = await config.load({ required: true });
  assert.equal(Object.hasOwn(migrated.peers[0], "token"), false);
  assert.equal(migrated.peers[0].credential.storage, "file");
  assert.doesNotMatch(await readFile(config.configPath, "utf8"), /legacy-inline-token/u);
  assert.equal((await config.findPeer("Maya")).peer.token, "legacy-inline-token");
});

test("new invites are private by default and can share selected sessions", async () => {
  const config = await store();
  await config.setup({ name: "Alex", port: 7337 });
  const { invitation } = await config.createInvite({
    name: "Maya",
    role: "participant",
    address: "100.64.0.1",
    port: 7337,
  });
  assert.equal(invitation.taskAccess.mode, "selected");
  assert.equal(invitationCanAccess(invitation, "codex:private"), false);

  const shared = await config.updateTaskAccess("Maya", {
    taskId: "codex:shared",
    action: "share",
  });
  assert.equal(invitationCanAccess(shared, "codex:shared"), true);
  assert.equal(invitationCanAccess(shared, "claude:private"), false);

  const all = await config.updateTaskAccess(invitation.id.slice(0, 8), {
    mode: "all",
  });
  assert.equal(invitationCanAccess(all, "claude:new-session"), true);
  const excluded = await config.updateTaskAccess("Maya", {
    taskId: "claude:new-session",
    action: "unshare",
  });
  assert.equal(invitationCanAccess(excluded, "claude:new-session"), false);
});

test("an invite can be created with one explicit session already shared", async () => {
  const config = await store();
  await config.setup({ name: "Alex", port: 7337 });
  const { invitation } = await config.createInvite({
    name: "Maya",
    role: "participant",
    share: "selected",
    taskIds: ["claude:shared-one"],
    address: "100.64.0.1",
    port: 7337,
  });

  assert.deepEqual(invitation.taskAccess, {
    mode: "selected",
    taskIds: ["claude:shared-one"],
    excludedTaskIds: [],
  });
  assert.equal(invitationCanAccess(invitation, "claude:shared-one"), true);
  assert.equal(invitationCanAccess(invitation, "claude:private"), false);

  await assert.rejects(
    config.createInvite({
      name: "Taylor",
      share: "all",
      taskIds: ["claude:shared-one"],
      address: "100.64.0.1",
      port: 7337,
    }),
    { code: "INVALID_SHARE_MODE" },
  );
});
