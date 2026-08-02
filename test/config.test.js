import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
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
