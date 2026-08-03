import { access, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join, resolve } from "node:path";

async function executableTarget(path) {
  try {
    await access(path, constants.X_OK);
    return await realpath(path);
  } catch {
    return null;
  }
}

export async function stableCliPath({ sourcePath, invokedPath, pathEnv } = {}) {
  const source = resolve(sourcePath);
  const sourceTarget = (await executableTarget(source)) || source;
  const invoked = invokedPath ? resolve(invokedPath) : null;
  if (
    invoked &&
    invoked !== source &&
    (await executableTarget(invoked)) === sourceTarget
  ) {
    return invoked;
  }
  for (const directory of String(pathEnv || "").split(delimiter).filter(Boolean)) {
    for (const name of ["mpai", "multiplayer-ai"]) {
      const candidate = join(directory, name);
      if ((await executableTarget(candidate)) === sourceTarget) return candidate;
    }
  }
  if (invoked && (await executableTarget(invoked)) === sourceTarget) return invoked;
  return source;
}
