import assert from "node:assert/strict";
import test from "node:test";
import { getOcrReadiness, isOcrProductionReady } from "../src/ocr-readiness.js";

test("OCR readiness reports disabled mode as explicit and safe", () => {
  assert.deepEqual(
    getOcrReadiness({
      appEnv: "production",
      ocrMode: "disabled",
      ocrApiKey: "ocr-secret-key"
    }),
    {
      name: "ocr",
      status: "disabled",
      message: "OCR provider is disabled."
    }
  );
});

test("OCR readiness reports fake and test modes as local only outside production", () => {
  for (const mode of ["fake", "test"]) {
    assert.deepEqual(
      getOcrReadiness({
        appEnv: "local",
        ocrMode: mode
      }),
      {
        name: "ocr",
        status: "local_only",
        message: "OCR is using local/test behavior."
      }
    );
  }
});

test("OCR readiness rejects fake and test modes in production", () => {
  for (const mode of ["fake", "test"]) {
    const readiness = getOcrReadiness({
      appEnv: "production",
      ocrMode: mode,
      ocrApiKey: "ocr-secret-key",
      providerRequestId: "provider-request-123"
    });

    assert.deepEqual(readiness, {
      name: "ocr",
      status: "not_ready",
      message: "Production OCR provider is not configured."
    });
    assert.equal(JSON.stringify(readiness).includes("ocr-secret-key"), false);
    assert.equal(JSON.stringify(readiness).includes("provider-request-123"), false);
  }
});

test("OCR readiness rejects unsupported provider modes without exposing mode values", () => {
  const readiness = getOcrReadiness({
    appEnv: "production",
    ocrMode: "external-provider-secret",
    ocrApiKey: "ocr-secret-key"
  });

  assert.deepEqual(readiness, {
    name: "ocr",
    status: "not_ready",
    message: "OCR provider mode is not supported."
  });
  assert.equal(JSON.stringify(readiness).includes("external-provider-secret"), false);
  assert.equal(JSON.stringify(readiness).includes("ocr-secret-key"), false);
  assert.equal(isOcrProductionReady({ appEnv: "production", ocrMode: "fake" }), false);
});
