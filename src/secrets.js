import { execFile } from "node:child_process";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { MpaiError } from "./errors.js";

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = "com.godfaddaai.mpai.peer";

function missingCredential(account) {
  return new MpaiError(
    `Credential for teammate ${account} is missing. Ask them for a new invite and run \`mpai join\` again.`,
    { code: "PEER_CREDENTIAL_MISSING", status: 401 },
  );
}

export class KeychainSecretStore {
  reference(account) {
    return {
      storage: "keychain",
      service: KEYCHAIN_SERVICE,
      account: String(account),
    };
  }

  async set(account, token) {
    if (!token) throw missingCredential(account);
    try {
      await execFileAsync("/usr/bin/security", [
        "add-generic-password",
        "-U",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        String(account),
        "-w",
        String(token),
      ], { timeout: 5_000 });
    } catch {
      throw new MpaiError(
        "Could not store the teammate credential in macOS Keychain.",
        { code: "KEYCHAIN_WRITE" },
      );
    }
  }

  async get(account) {
    try {
      const { stdout } = await execFileAsync("/usr/bin/security", [
        "find-generic-password",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        String(account),
        "-w",
      ], { timeout: 5_000 });
      const token = stdout.trim();
      if (!token) throw missingCredential(account);
      return token;
    } catch (error) {
      if (error instanceof MpaiError) throw error;
      throw missingCredential(account);
    }
  }

  async delete(account) {
    try {
      await execFileAsync("/usr/bin/security", [
        "delete-generic-password",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        String(account),
      ], { timeout: 5_000 });
    } catch {
      // Deleting an already-missing credential is idempotent.
    }
  }
}

export class FileSecretStore {
  constructor({ root }) {
    this.path = join(root, "credentials.json");
  }

  reference(account) {
    return {
      storage: "file",
      path: this.path,
      account: String(account),
    };
  }

  async set(account, token) {
    const credentials = await this.#load();
    credentials[String(account)] = String(token);
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    await chmod(dirname(this.path), 0o700);
    const temporaryPath = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(credentials, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporaryPath, this.path);
    await chmod(this.path, 0o600);
  }

  async get(account) {
    const credentials = await this.#load();
    const token = credentials[String(account)];
    if (!token) throw missingCredential(account);
    return token;
  }

  async delete(account) {
    const credentials = await this.#load();
    if (!Object.hasOwn(credentials, String(account))) return;
    delete credentials[String(account)];
    await writeFile(this.path, `${JSON.stringify(credentials, null, 2)}\n`, {
      mode: 0o600,
    });
    await chmod(this.path, 0o600);
  }

  async #load() {
    try {
      return JSON.parse(await readFile(this.path, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw new MpaiError("Could not read the isolated credential store.", {
        code: "CREDENTIAL_READ",
      });
    }
  }
}
