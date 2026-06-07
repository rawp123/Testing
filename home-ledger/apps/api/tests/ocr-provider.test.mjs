import assert from "node:assert/strict";
import test from "node:test";
import { createOcrProvider } from "../src/ocr-provider.js";

test("fake OCR provider returns deterministic text without network access", async () => {
  const provider = createOcrProvider({ mode: "fake" });
  const result = await provider.requestText({
    file: {
      original_file_name: "receipt.pdf"
    }
  });

  assert.equal(provider.mode, "fake");
  assert.deepEqual(result, {
    status: "succeeded",
    text: "Extracted text from receipt.pdf.",
    engine: "fake",
    errorCode: null,
    errorMessage: null
  });
});

test("disabled OCR provider queues work without extracted text", async () => {
  const provider = createOcrProvider({ mode: "disabled" });
  const result = await provider.requestText({});

  assert.equal(provider.mode, "disabled");
  assert.deepEqual(result, {
    status: "queued",
    text: null,
    engine: null,
    errorCode: null,
    errorMessage: null
  });
});
