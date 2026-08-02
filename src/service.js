import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  chmod,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { MpaiError } from "./errors.js";

const execFileAsync = promisify(execFile);
export const SERVICE_LABEL = "ai.multiplayer.mpai";

function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function launchAgentPath() {
  return join(homedir(), "Library", "LaunchAgents", `${SERVICE_LABEL}.plist`);
}

export function renderLaunchAgent({
  nodePath,
  cliPath,
  stateRoot,
  codexBin = "codex",
  claudeBin = "claude",
  pathEnv = process.env.PATH || "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
  bindAddress,
}) {
  const logPath = join(stateRoot, "service.log");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(nodePath)}</string>
    <string>${xml(cliPath)}</string>
    <string>serve</string>
    <string>--codex-bin</string>
    <string>${xml(codexBin)}</string>
    <string>--claude-bin</string>
    <string>${xml(claudeBin)}</string>
${bindAddress ? `    <string>--bind</string>
    <string>${xml(bindAddress)}</string>
` : ""}  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>MULTIPLAYER_AI_HOME</key>
    <string>${xml(stateRoot)}</string>
    <key>PATH</key>
    <string>${xml(pathEnv)}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${xml(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(logPath)}</string>
</dict>
</plist>
`;
}

function domain() {
  return `gui/${process.getuid()}`;
}

async function bootout(path) {
  try {
    await execFileAsync("launchctl", ["bootout", domain(), path], {
      timeout: 10_000,
    });
  } catch {
    // It is valid to install or remove a service that is not currently loaded.
  }
}

export async function installService({
  nodePath,
  cliPath,
  stateRoot,
  codexBin = "codex",
  claudeBin = "claude",
  pathEnv = process.env.PATH || "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
  bindAddress,
}) {
  if (process.platform !== "darwin") {
    throw new MpaiError("Background service installation currently supports macOS", {
      code: "UNSUPPORTED_PLATFORM",
      status: 400,
    });
  }
  const path = launchAgentPath();
  await mkdir(dirname(path), { recursive: true });
  await mkdir(stateRoot, { recursive: true, mode: 0o700 });
  await writeFile(
    path,
    renderLaunchAgent({
      nodePath,
      cliPath,
      stateRoot,
      codexBin,
      claudeBin,
      pathEnv,
      bindAddress,
    }),
    { mode: 0o644 },
  );
  await chmod(path, 0o644);
  await bootout(path);
  try {
    await execFileAsync("launchctl", ["bootstrap", domain(), path], {
      timeout: 10_000,
    });
  } catch (error) {
    throw new MpaiError(`launchctl could not start Multiplayer AI: ${error.message}`, {
      code: "SERVICE_START_FAILED",
      cause: error,
    });
  }
  return path;
}

export async function uninstallService() {
  const path = launchAgentPath();
  await bootout(path);
  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return path;
}

export async function serviceStatus() {
  try {
    const { stdout } = await execFileAsync(
      "launchctl",
      ["print", `${domain()}/${SERVICE_LABEL}`],
      { timeout: 10_000, maxBuffer: 1024 * 1024 },
    );
    const pid = /^\s*pid = (\d+)$/mu.exec(stdout)?.[1] || null;
    const state = /^\s*state = (.+)$/mu.exec(stdout)?.[1] || "loaded";
    return { loaded: true, pid, state, path: launchAgentPath() };
  } catch {
    return { loaded: false, pid: null, state: "stopped", path: launchAgentPath() };
  }
}

export async function readServiceLog({ stateRoot, lines = 40 }) {
  try {
    return (await readFile(join(stateRoot, "service.log"), "utf8"))
      .split("\n")
      .slice(-Math.max(1, Number(lines) || 40))
      .join("\n")
      .trim();
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}
