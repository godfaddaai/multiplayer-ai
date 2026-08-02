import assert from "node:assert/strict";
import { test } from "node:test";
import { renderLaunchAgent, SERVICE_LABEL } from "../src/service.js";

test("launch agent contains only runtime paths and no invite credentials", () => {
  const plist = renderLaunchAgent({
    nodePath: "/opt/node/bin/node",
    cliPath: "/opt/mpai/src/cli.js",
    stateRoot: "/Users/test/.multiplayer-ai",
    codexBin: "/Applications/Codex.app/Contents/Resources/codex",
    claudeBin: "/Users/test/.local/bin/claude",
    pathEnv: "/opt/node/bin:/usr/bin:/bin",
    bindAddress: "100.64.0.10",
  });
  assert.match(plist, new RegExp(SERVICE_LABEL));
  assert.match(plist, /MULTIPLAYER_AI_HOME/u);
  assert.match(plist, /<string>serve<\/string>/u);
  assert.match(plist, /<string>--codex-bin<\/string>/u);
  assert.match(plist, /Codex\.app\/Contents\/Resources\/codex/u);
  assert.match(plist, /<string>--claude-bin<\/string>/u);
  assert.match(plist, /\.local\/bin\/claude/u);
  assert.match(plist, /<key>PATH<\/key>/u);
  assert.match(plist, /\/opt\/node\/bin:\/usr\/bin:\/bin/u);
  assert.match(plist, /<string>--bind<\/string>/u);
  assert.match(plist, /<string>100\.64\.0\.10<\/string>/u);
  assert.doesNotMatch(plist, /token|Bearer/u);
});

test("launch agent XML-escapes paths", () => {
  const plist = renderLaunchAgent({
    nodePath: "/A&B/node",
    cliPath: "/A<B/cli.js",
    stateRoot: "/Users/test/one>two",
    codexBin: "/A&B/codex",
    claudeBin: "/A&B/claude",
    pathEnv: "/A&B/bin:/usr/bin",
  });
  assert.match(plist, /A&amp;B/u);
  assert.match(plist, /A&lt;B/u);
  assert.match(plist, /one&gt;two/u);
  assert.match(plist, /A&amp;B\/codex/u);
  assert.match(plist, /A&amp;B\/claude/u);
  assert.match(plist, /A&amp;B\/bin:\/usr\/bin/u);
});
