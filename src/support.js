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

function elapsedMinutes(origin, values) {
  const startedAt = Date.parse(origin || "");
  const candidates = values
    .map((value) => Date.parse(value || ""))
    .filter((value) => Number.isFinite(value) && value >= startedAt);
  if (!Number.isFinite(startedAt) || !candidates.length) return null;
  return Math.round((Math.min(...candidates) - startedAt) / 60_000);
}

function weekKey(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86_400_000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function buildAlphaReceipt({
  config,
  auditEvents = [],
  generatedAt = new Date().toISOString(),
  runtime = {},
} = {}) {
  const invitations = config?.invites || [];
  const peers = config?.peers || [];
  const promptReceived = auditEvents.filter((event) => event.type === "prompt.received");
  const promptCompleted = auditEvents.filter((event) => event.type === "prompt.completed");
  const promptFailed = auditEvents.filter((event) => event.type === "prompt.failed");
  const promptOutcomes = [...promptCompleted, ...promptFailed];
  const providerIds = [...new Set(
    promptOutcomes.map((event) => event.target).filter(Boolean),
  )].sort();
  const byProvider = {};
  for (const provider of providerIds) {
    const completed = promptCompleted.filter((event) => event.target === provider).length;
    const failed = promptFailed.filter((event) => event.target === provider).length;
    byProvider[provider] = { completed, failed };
  }
  const activeDays = new Set(
    promptReceived.map((event) => String(event.at || "").slice(0, 10)).filter(Boolean),
  );
  const activeWeeks = new Set(promptReceived.map((event) => weekKey(event.at)).filter(Boolean));
  const setupAt = config?.identity?.createdAt;
  const selectedSessionsShared = new Set(
    invitations.flatMap((invitation) => invitation.taskAccess?.taskIds || []),
  ).size;
  const outcomeCount = promptOutcomes.length;
  return {
    schema: "mpai.alpha-receipt.v1",
    generatedAt,
    submission: "not-sent",
    redaction: {
      transcriptContents: "excluded",
      promptContents: "excluded",
      credentials: "excluded",
      identities: "excluded",
      taskIdentifiers: "excluded",
      taskMetadata: "excluded",
      filesystemPaths: "excluded",
      networkAddresses: "excluded",
      eventTimestamps: "excluded",
    },
    runtime: {
      mpai: VERSION,
      node: runtime.node || process.version,
      platform: runtime.platform || process.platform,
      arch: runtime.arch || process.arch,
    },
    activation: {
      configured: Boolean(config?.identity?.name),
      peersConfigured: peers.length,
      invitationsClaimed: invitations.filter((invitation) => invitation.claimedBy).length,
      participantInvitations: invitations.filter((invitation) => invitation.role === "participant").length,
      selectedSessionsShared,
      allSessionShares: invitations.filter((invitation) =>
        !invitation.revokedAt && invitation.taskAccess?.mode === "all"
      ).length,
      minutesToFirstPeer: elapsedMinutes(setupAt, peers.map((peer) => peer.addedAt)),
      minutesToFirstClaimedInvite: elapsedMinutes(
        setupAt,
        invitations.map((invitation) => invitation.claimedAt),
      ),
      minutesToFirstNamedPrompt: elapsedMinutes(
        setupAt,
        promptReceived.map((event) => event.at),
      ),
    },
    engagement: {
      promptAttempts: promptReceived.length,
      promptsCompleted: promptCompleted.length,
      promptsFailed: promptFailed.length,
      activeDays: activeDays.size,
      activeWeeks: activeWeeks.size,
      providersUsed: providerIds,
    },
    reliability: {
      completedOutcomes: outcomeCount,
      successRate: outcomeCount
        ? Number((promptCompleted.length / outcomeCount).toFixed(4))
        : null,
      byProvider,
      failureKinds: counts(promptFailed.map((event) => errorKind(event.error))),
    },
  };
}

function reportChoice(value, choices) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return choices[normalized] || "not reported";
}

function reportMinutes(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/u.test(text)) return "not reported";
  const minutes = Number(text);
  return minutes <= 10_080 ? String(minutes) : "not reported";
}

export function formatCohortReport(receipt, selfReport = {}) {
  const providers = receipt.engagement.providersUsed.length
    ? receipt.engagement.providersUsed.join(", ")
    : "none observed";
  const failures = Object.keys(receipt.reliability.failureKinds);
  const outcomeCount = receipt.reliability.completedOutcomes;
  const completed = receipt.engagement.promptsCompleted;
  return [
    "<!-- mpai cohort report v1 · public metadata only -->",
    `mpai version: ${receipt.runtime.mpai}`,
    `provider: ${providers}`,
    `join method: ${reportChoice(selfReport.joinMethod, {
      npx: "npx guest",
      "npx-guest": "npx guest",
      homebrew: "Homebrew",
      npm: "npm",
      other: "other",
    })}`,
    `minutes to first shared room: ${reportMinutes(selfReport.minutesToRoom)}`,
    `named prompt visible in native transcript: ${reportChoice(selfReport.namedPrompt, {
      yes: "yes",
      no: "no",
      "view-only": "view-only",
    })}`,
    `would use this again next week: ${reportChoice(selfReport.useAgain, {
      yes: "yes",
      no: "no",
      unsure: "unsure",
    })}`,
    `first failure category, if any: ${failures[0] || "none observed"}`,
    "",
    "machine-readable counts (no content or identifiers):",
    `- claimed invites: ${receipt.activation.invitationsClaimed}`,
    `- selected sessions shared: ${receipt.activation.selectedSessionsShared}`,
    `- completed prompt outcomes: ${completed}/${outcomeCount}`,
    `- active days: ${receipt.engagement.activeDays}`,
    `- active weeks: ${receipt.engagement.activeWeeks}`,
  ].join("\n");
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

export async function writeAlphaReceipt(receipt, { outputPath } = {}) {
  const timestamp = receipt.generatedAt.replaceAll(/[:.]/gu, "-");
  const path = resolve(outputPath || `mpai-alpha-receipt-${timestamp}.json`);
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(path, 0o600);
  return path;
}

export { errorKind };
