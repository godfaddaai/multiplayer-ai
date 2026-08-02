import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isIP } from "node:net";
import { MpaiError } from "./errors.js";

const execFileAsync = promisify(execFile);

function stripMappedAddress(address) {
  return String(address || "").replace(/^::ffff:/u, "").split("%")[0];
}

export function isLoopback(address) {
  const value = stripMappedAddress(address);
  return value === "127.0.0.1" || value === "::1";
}

export function isTailscaleIPv4(address) {
  const value = stripMappedAddress(address);
  if (isIP(value) !== 4) return false;
  const [first, second] = value.split(".").map(Number);
  return first === 100 && second >= 64 && second <= 127;
}

export async function tailscaleIPv4({ tailscaleBin = "tailscale" } = {}) {
  try {
    const { stdout } = await execFileAsync(tailscaleBin, ["ip", "-4"], {
      timeout: 5000,
    });
    const address = stdout.trim().split(/\s+/u)[0];
    if (!isTailscaleIPv4(address)) {
      throw new Error(`unexpected address ${address || "(empty)"}`);
    }
    return address;
  } catch (error) {
    throw new MpaiError(`Tailscale is not ready: ${error.message}`, {
      code: "TAILSCALE_UNAVAILABLE",
      status: 503,
      cause: error,
    });
  }
}

export async function resolveTailscaleIdentity(
  remoteAddress,
  { tailscaleBin = "tailscale", allowLoopback = false } = {},
) {
  const address = stripMappedAddress(remoteAddress);
  if (allowLoopback && isLoopback(address)) {
    return {
      userId: "loopback",
      displayName: "Local test user",
      loginName: "local",
      device: "localhost",
      address,
    };
  }
  if (!isTailscaleIPv4(address) && !address.startsWith("fd7a:115c:a1e0:")) {
    throw new MpaiError("Connection did not arrive from the tailnet", {
      code: "NOT_TAILNET",
      status: 403,
    });
  }
  try {
    const { stdout } = await execFileAsync(
      tailscaleBin,
      ["whois", "--json", address],
      { timeout: 5000, maxBuffer: 1024 * 1024 },
    );
    const result = JSON.parse(stdout);
    if (!result?.UserProfile?.ID || !result?.Node?.Name) {
      throw new Error("Tailscale returned no user or device identity");
    }
    return {
      userId: String(result.UserProfile.ID),
      displayName:
        result.UserProfile.DisplayName || result.UserProfile.LoginName,
      loginName: result.UserProfile.LoginName,
      device: result.Node.Hostinfo?.Hostname || result.Node.Name,
      address,
    };
  } catch (error) {
    if (error instanceof MpaiError) throw error;
    throw new MpaiError(`Could not verify tailnet identity: ${error.message}`, {
      code: "TAILSCALE_WHOIS_FAILED",
      status: 403,
      cause: error,
    });
  }
}
