import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isLoopback,
  isTailscaleIPv4,
} from "../src/tailscale.js";

test("recognizes the CGNAT range reserved for Tailscale", () => {
  assert.equal(isTailscaleIPv4("100.64.0.1"), true);
  assert.equal(isTailscaleIPv4("100.127.255.254"), true);
  assert.equal(isTailscaleIPv4("100.63.255.254"), false);
  assert.equal(isTailscaleIPv4("100.128.0.1"), false);
  assert.equal(isTailscaleIPv4("192.168.1.1"), false);
});

test("normalizes IPv4-mapped loopback addresses", () => {
  assert.equal(isLoopback("::ffff:127.0.0.1"), true);
  assert.equal(isLoopback("::1"), true);
});
