import { chmod, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { VERSION } from "./version.js";

function counts(values) {
  const result = {};
  for (const value of values.filter(Boolean)) {
    result[value] = (result[value] || 0) + 1;
  }
  return result;
}

function errorKind(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return null;
  if (/permission|approval|forbidden|denied/u.test(text)) return "permission_denied";
  if (/timeout|timed out/u.test(text)) return "timeout";
  if (/connect|socket|unreachable|network/u.test(text)) return "connection_failed";
  if (/not found|missing|enoent/u.test(text)) return "dependency_missing";
  if (/unavailable|not ready/u.test(text)) return "unavailable";
  return "provider_error";
}

function invitationState(invitation) {
  if (invitation.revokedAt) return "revoked";
  if (invitation.claimedBy) return "claimed";
  return "unclaimed";
}

export function buildSupportBundle({
  config,
  service,
  tailscale,
  providers = [],
  tasks = [],
  auditEvents = [],
  generatedAt = new Date().toISOString(),
  runtime = {},
} = {}) {
  const invitations = config?.invites || [];
  const peers = config?.peers || [];
  const failures = auditEvents
    .filter((event) => event.type === "prompt.failed")
    .slice(-20)
    .map((event) => ({
      at: event.at,
      provider: event.target || "unknown",
      kind: errorKind(event.error) || "provider_error",
    }));
  return {
    schema: "mpai.support.v1",
    generatedAt,
    redaction: {
      transcriptContents: "excluded",
      promptContents: "excluded",
      credentials: "excluded",
      identities: "excluded",
      taskMetadata: "excluded",
      filesystemPaths: "excluded",
      networkAddresses: "excluded",
    },
    runtime: {
      mpai: VERSION,
      node: runtime.node || process.version,
      platform: runtime.platform || process.platform,
      arch: runtime.arch || process.arch,
    },
    configuration: {
      configured: Boolean(config?.identity?.name),
      port: Number(config?.host?.port) || null,
      peers: peers.length,
      peerCredentialStores: counts(peers.map((peer) => peer.credential?.storage)),
      invitations: {
        total: invitations.length,
        byState: counts(invitations.map(invitationState)),
        byRole: counts(invitations.map((invitation) => invitation.role)),
        byShareMode: counts(
          invitations.map((invitation) => invitation.taskAccess?.mode || "legacy"),
        ),
      },
    },
    network: {
      tailscaleReady: Boolean(tailscale?.ready),
      errorKind: tailscale?.ready ? null : errorKind(tailscale?.error),
    },
    service: {
      supported: service?.supported !== false,
      loaded: Boolean(service?.loaded),
      running: service?.state === "running",
      pidPresent: Boolean(service?.pid),
      reachable: Boolean(service?.health?.ok),
      reportedVersion: service?.health?.version || null,
      versionMatches: service?.health?.version
        ? service.health.version === VERSION
        : null,
      errorKind: service?.health?.ok ? null : errorKind(service?.healthError),
    },
    providers: providers.map((provider) => ({
      id: provider.id,
      available: Boolean(provider.available),
      transport: provider.transport || null,
      errorKind: provider.available ? null : errorKind(provider.error),
    })),
    tasks: {
      sampled: tasks.length,
      byProvider: counts(tasks.map((task) => task.provider || "unknown")),
      promptable: tasks.filter((task) => task.canPrompt).length,
    },
    audit: {
      sampled: auditEvents.length,
      byType: counts(auditEvents.map((event) => event.type)),
      recentFailures: failures,
    },
  };
}

export async function writeSupportBundle(bundle, { outputPath } = {}) {
  const timestamp = bundle.generatedAt.replaceAll(/[:.]/gu, "-");
  const path = resolve(outputPath || `mpai-support-${timestamp}.json`);
  await writeFile(path, `${JSON.stringify(bundle, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(path, 0o600);
  return path;
}

export { errorKind };
