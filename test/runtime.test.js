import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stableCliPath } from "../src/runtime.js";

const roots = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("service launcher prefers a stable PATH symlink over a versioned source", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-runtime-"));
  roots.push(root);
  const cellar = join(root, "Cellar", "mpai", "0.4.3", "src");
  const bin = join(root, "bin");
  await mkdir(cellar, { recursive: true });
  await mkdir(bin, { recursive: true });
  const source = join(cellar, "cli.js");
  const launcher = join(bin, "mpai");
  await writeFile(source, "#!/usr/bin/env node\n", "utf8");
  await chmod(source, 0o755);
  await symlink(source, launcher);

  assert.equal(await stableCliPath({
    sourcePath: source,
    invokedPath: source,
    pathEnv: bin,
  }), launcher);
  assert.equal(await stableCliPath({
    sourcePath: source,
    invokedPath: launcher,
    pathEnv: "",
  }), launcher);
});
