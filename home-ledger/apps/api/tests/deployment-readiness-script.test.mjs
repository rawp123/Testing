import assert from "node:assert/strict";
import test from "node:test";
import { formatReadinessSnapshot } from "../scripts/check-deployment-readiness.mjs";

test("deployment readiness script formats auth state clearly and safely", () => {
  const output = formatReadinessSnapshot({
    status: "not_ready",
    checks: [
      {
        name: "config",
        status: "ok",
        message: "Required runtime configuration is present."
      },
      {
        name: "auth",
        status: "not_ready",
        message: "Production auth adapter is not implemented."
      }
    ]
  });

  assert.equal(output, [
    "Home Ledger API readiness: not_ready",
    "- config: ok - Required runtime configuration is present.",
    "- auth: not_ready - Production auth adapter is not implemented."
  ].join("\n"));

  for (const blocked of [
    "provider_internal_secret",
    "raw-session-token",
    "Bearer",
    "provider-request-123",
    "postgres://user:secret"
  ]) {
    assert.doesNotMatch(output, new RegExp(escapeRegExp(blocked), "i"));
  }
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
