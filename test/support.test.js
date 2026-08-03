import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildAlphaReceipt,
  buildSupportBundle,
  writeAlphaReceipt,
  writeSupportBundle,
} from "../src/support.js";
import { VERSION } from "../src/version.js";

const roots = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("support bundle keeps useful health metadata and strips sensitive state", async () => {
  const bundle = buildSupportBundle({
    generatedAt: "2026-08-03T04:00:00.000Z",
    runtime: { node: "v22.0.0", platform: "darwin", arch: "arm64" },
    config: {
      identity: { name: "Secret Person" },
      host: { port: 7337 },
      peers: [{
        name: "Private Peer",
        baseUrl: "http://100.64.0.2:7337",
        credential: { storage: "keychain", account: "private-account" },
      }],
      invites: [{
        name: "Invite Name",
        role: "participant",
        tokenHash: "private-token-hash",
        claimedBy: "private-tailnet-user",
        taskAccess: { mode: "selected", taskIds: ["claude:private"] },
      }],
    },
    tailscale: { ready: true, address: "100.64.0.1" },
    service: {
      loaded: true,
      state: "running",
      pid: 42,
      path: "/Users/private/service",
      health: { ok: true, version: VERSION },
    },
    providers: [{ id: "claude", available: false, error: "missing /Users/private/claude" }],
    tasks: [{
      id: "claude:private",
      provider: "claude",
      title: "Secret project",
      cwd: "/Users/private/project",
      messages: [{ text: "do not leak this transcript" }],
      canPrompt: true,
    }],
    auditEvents: [
      { type: "prompt.received", text: "do not leak this prompt", actor: { name: "Secret Person" } },
      { type: "prompt.failed", at: "2026-08-03T03:00:00Z", target: "claude", error: "missing /Users/private/claude" },
    ],
  });
  const serialized = JSON.stringify(bundle);
  for (const sensitive of [
    "Secret Person",
    "Private Peer",
    "Invite Name",
    "private-token-hash",
    "private-tailnet-user",
    "private-account",
    "100.64.0.1",
    "100.64.0.2",
    "claude:private",
    "/Users/private",
    "Secret project",
    "do not leak",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(sensitive.replaceAll(".", "\\."), "u"));
  }
  assert.equal(bundle.configuration.peers, 1);
  assert.equal(bundle.configuration.invitations.byState.claimed, 1);
  assert.equal(bundle.providers[0].errorKind, "dependency_missing");
  assert.equal(bundle.service.reachable, true);
  assert.equal(bundle.service.versionMatches, true);
  assert.equal(bundle.tasks.byProvider.claude, 1);
  assert.deepEqual(bundle.audit.recentFailures, [{
    at: "2026-08-03T03:00:00Z",
    provider: "claude",
    kind: "dependency_missing",
  }]);

  const root = await mkdtemp(join(tmpdir(), "mpai-support-"));
  roots.push(root);
  const path = await writeSupportBundle(bundle, {
    outputPath: join(root, "bundle.json"),
  });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), bundle);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await assert.rejects(writeSupportBundle(bundle, { outputPath: path }), {
    code: "EEXIST",
  });
});

test("alpha receipt measures activation and reliability without leaking collaboration data", async () => {
  const receipt = buildAlphaReceipt({
    generatedAt: "2026-08-10T18:00:00.000Z",
    runtime: { node: "v22.0.0", platform: "darwin", arch: "arm64" },
    config: {
      identity: {
        id: "private-host-id",
        name: "Secret Person",
        createdAt: "2026-08-03T17:00:00.000Z",
      },
      host: { port: 7337 },
      peers: [{
        id: "private-peer-id",
        name: "Private Peer",
        baseUrl: "http://100.64.0.2:7337",
        addedAt: "2026-08-03T17:04:30.000Z",
      }],
      invites: [{
        name: "Invite Name",
        role: "participant",
        tokenHash: "private-token-hash",
        claimedBy: "private-tailnet-user",
        claimedAt: "2026-08-03T17:03:00.000Z",
        taskAccess: { mode: "selected", taskIds: ["claude:private"] },
      }],
    },
    auditEvents: [
      {
        type: "prompt.received",
        at: "2026-08-03T17:05:00.000Z",
        target: "claude",
        text: "do not leak this prompt",
        taskId: "claude:private",
        actor: { name: "Secret Person" },
      },
      {
        type: "prompt.completed",
        at: "2026-08-03T17:05:05.000Z",
        target: "claude",
        taskId: "claude:private",
      },
      {
        type: "prompt.received",
        at: "2026-08-10T17:00:00.000Z",
        target: "codex",
        text: "another private prompt",
      },
      {
        type: "prompt.failed",
        at: "2026-08-10T17:00:01.000Z",
        target: "codex",
        error: "connection failed at 100.64.0.2 /Users/private/project",
      },
    ],
  });
  const serialized = JSON.stringify(receipt);
  for (const sensitive of [
    "Secret Person",
    "Private Peer",
    "Invite Name",
    "private-host-id",
    "private-peer-id",
    "private-token-hash",
    "private-tailnet-user",
    "100.64.0.2",
    "claude:private",
    "/Users/private",
    "do not leak",
    "2026-08-03T17:05:00.000Z",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(sensitive.replaceAll(".", "\\."), "u"));
  }
  assert.equal(receipt.submission, "not-sent");
  assert.equal(receipt.activation.minutesToFirstPeer, 5);
  assert.equal(receipt.activation.minutesToFirstClaimedInvite, 3);
  assert.equal(receipt.activation.minutesToFirstNamedPrompt, 5);
  assert.equal(receipt.activation.selectedSessionsShared, 1);
  assert.equal(receipt.engagement.promptAttempts, 2);
  assert.equal(receipt.engagement.promptsCompleted, 1);
  assert.equal(receipt.engagement.promptsFailed, 1);
  assert.equal(receipt.engagement.activeDays, 2);
  assert.equal(receipt.engagement.activeWeeks, 2);
  assert.deepEqual(receipt.engagement.providersUsed, ["claude", "codex"]);
  assert.equal(receipt.reliability.successRate, 0.5);
  assert.deepEqual(receipt.reliability.failureKinds, { connection_failed: 1 });

  const root = await mkdtemp(join(tmpdir(), "mpai-alpha-receipt-"));
  roots.push(root);
  const path = await writeAlphaReceipt(receipt, {
    outputPath: join(root, "receipt.json"),
  });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), receipt);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await assert.rejects(writeAlphaReceipt(receipt, { outputPath: path }), {
    code: "EEXIST",
  });
});
