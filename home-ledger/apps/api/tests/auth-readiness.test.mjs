import assert from "node:assert/strict";
import test from "node:test";
import { getAuthReadiness, normalizeAuthProvider } from "../src/auth-readiness.js";

test("local dev auth reports local-only readiness", () => {
  assert.deepEqual(getAuthReadiness({
    appEnv: "local",
    authProvider: "dev",
    devAuthEnabled: true
  }), {
    name: "auth",
    status: "local_only",
    message: "Auth is using local/test behavior."
  });
});

test("production without an auth provider is not ready", () => {
  assert.deepEqual(getAuthReadiness({
    appEnv: "production",
    authProvider: "none",
    devAuthEnabled: false
  }), {
    name: "auth",
    status: "not_ready",
    message: "Production auth provider is not connected."
  });
});

test("production provider placeholders do not report ready or expose internals", () => {
  const check = getAuthReadiness({
    appEnv: "production",
    authProvider: "provider_internal_secret",
    devAuthEnabled: false,
    authHeader: "Bearer raw-session-token",
    providerRequestId: "provider-request-123"
  });

  assert.deepEqual(check, {
    name: "auth",
    status: "not_ready",
    message: "Production auth adapter is not implemented."
  });

  const body = JSON.stringify(check);
  for (const blocked of [
    "provider_internal_secret",
    "raw-session-token",
    "provider-request-123",
    "Bearer",
    "OAuth",
    "JWT"
  ]) {
    assert.doesNotMatch(body, new RegExp(escapeRegExp(blocked), "i"));
  }
});

test("production dev auth is not a production-ready mode", () => {
  assert.deepEqual(getAuthReadiness({
    appEnv: "production",
    authProvider: "dev",
    devAuthEnabled: false
  }), {
    name: "auth",
    status: "not_ready",
    message: "Development auth is unavailable outside local/test mode."
  });
});

test("auth provider normalization is provider-neutral and safe", () => {
  assert.equal(normalizeAuthProvider(" DEV "), "dev");
  assert.equal(normalizeAuthProvider(""), "none");
  assert.equal(normalizeAuthProvider(null), "none");
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
