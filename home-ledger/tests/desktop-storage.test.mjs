import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  getSafeFileName,
  getSafeId,
  requireSafeId,
  toBuffer,
} = require("../desktop/storage-helpers.cjs");

test("desktop document file ids are accepted only when already safe", () => {
  assert.equal(getSafeId("file_abc-123"), "file_abc-123");
  assert.equal(getSafeId("a/b"), "");
  assert.equal(getSafeId("ab?"), "");
  assert.equal(getSafeId(" ab"), "");
  assert.equal(getSafeId(""), "");
  assert.equal(getSafeId("a".repeat(121)), "");
});

test("desktop document file ids throw instead of normalizing into collisions", () => {
  assert.throws(() => requireSafeId("a/b"), /invalid/);
  assert.throws(() => requireSafeId("ab?"), /invalid/);
});

test("desktop file names strip paths and control characters", () => {
  assert.equal(getSafeFileName("/Users/private/invoice.pdf"), "invoice.pdf");
  assert.equal(getSafeFileName("C:\\Users\\private\\receipt\u0000.txt"), "receipt.txt");
  assert.equal(getSafeFileName(""), "Attached file");
});

test("desktop ArrayBuffer conversion preserves bytes and rejects unsupported data", () => {
  const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;
  assert.deepEqual([...toBuffer(arrayBuffer)], [1, 2, 3]);
  assert.deepEqual([...toBuffer(new Uint8Array([4, 5]))], [4, 5]);
  assert.throws(() => toBuffer("not bytes"), /expected format/);
});
