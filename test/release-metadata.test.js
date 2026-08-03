import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { VERSION } from "../src/version.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function text(path) {
  return readFile(join(root, path), "utf8");
}

test("release-facing metadata stays pinned to the runtime version", async () => {
  const [packageText, lockText, formula, readme, site, publicAlpha] =
    await Promise.all([
      text("package.json"),
      text("package-lock.json"),
      text("packaging/homebrew/mpai.rb"),
      text("README.md"),
      text("site/index.html"),
      text("docs/PUBLIC-ALPHA.md"),
    ]);
  const packageJson = JSON.parse(packageText);
  const lock = JSON.parse(lockText);
  const artifact = `multiplayer-ai-${VERSION}.tgz`;
  const releasePath = `/releases/download/v${VERSION}/${artifact}`;

  assert.equal(packageJson.version, VERSION);
  assert.equal(lock.version, VERSION);
  assert.equal(lock.packages[""].version, VERSION);
  assert.ok(formula.includes(releasePath));
  assert.match(formula, /sha256 "[a-f0-9]{64}"/u);
  assert.ok(readme.includes(releasePath));
  assert.ok(site.includes(releasePath));
  assert.ok(readme.includes("brew install godfaddaai/tap/mpai && mpai start"));
  assert.ok(site.includes("brew install godfaddaai/tap/mpai &amp;&amp; mpai start"));
  assert.ok(site.includes(`alpha ${VERSION}`));
  assert.ok(publicAlpha.includes(`Status: public source alpha ${VERSION}`));
  assert.ok(publicAlpha.includes(releasePath));
});
