import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FallbackSecretStore, FileSecretStore } from "../src/secrets.js";

const roots = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function unavailableKeychain() {
  return {
    reference(account) {
      return { storage: "keychain", account: String(account) };
    },
    async set() {
      throw new Error("Keychain unavailable");
    },
    async get() {
      throw new Error("Keychain unavailable");
    },
    async delete() {},
  };
}

test("credential storage falls back to a protected file and routes reads by reference", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-secrets-"));
  roots.push(root);
  const fallback = new FileSecretStore({ root });
  const store = new FallbackSecretStore({
    primary: unavailableKeychain(),
    fallback,
  });
  const reference = await store.set("maya", "fallback-secret");
  assert.equal(reference.storage, "file");
  assert.equal(await store.get("maya", reference), "fallback-secret");
  assert.equal((await stat(join(root, "credentials.json"))).mode & 0o777, 0o600);
  assert.match(await readFile(join(root, "credentials.json"), "utf8"), /fallback-secret/u);
  await assert.rejects(store.get("maya", { storage: "keychain" }), /Keychain unavailable/u);
});

test("successful primary storage remains preferred and removes stale fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "mpai-secrets-"));
  roots.push(root);
  const fallback = new FileSecretStore({ root });
  await fallback.set("maya", "stale-secret");
  const tokens = new Map();
  const primary = {
    reference(account) {
      return { storage: "keychain", account: String(account) };
    },
    async set(account, token) {
      tokens.set(String(account), String(token));
      return this.reference(account);
    },
    async get(account) {
      return tokens.get(String(account));
    },
    async delete(account) {
      tokens.delete(String(account));
    },
  };
  const store = new FallbackSecretStore({ primary, fallback });
  const reference = await store.set("maya", "keychain-secret");
  assert.equal(reference.storage, "keychain");
  assert.equal(await store.get("maya", reference), "keychain-secret");
  await assert.rejects(fallback.get("maya"), { code: "PEER_CREDENTIAL_MISSING" });
});
