import assert from "node:assert/strict";
import test from "node:test";
import {
  createFileStorageAdapter,
  createOpaqueStorageKey,
  createS3FileStorageAdapter
} from "../src/file-storage.js";

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const DOCUMENT_ID = "00000000-0000-4000-8000-000000001101";
const DOCUMENT_FILE_ID = "00000000-0000-4000-8000-000000001301";
const FIXED_NOW = new Date("2026-06-07T12:00:00.000Z");

test("local file storage adapter keeps null URLs and avoids network-oriented config", () => {
  const adapter = createFileStorageAdapter({
    driver: "test",
    now: () => FIXED_NOW
  });

  const storageKey = adapter.createStorageKey({
    workspaceId: WORKSPACE_ID,
    documentId: DOCUMENT_ID,
    documentFileId: DOCUMENT_FILE_ID
  });
  assert.equal(storageKey, `workspaces/${WORKSPACE_ID}/documents/${DOCUMENT_ID}/files/${DOCUMENT_FILE_ID}`);

  const uploadIntent = adapter.createUploadIntent({
    mimeType: "application/pdf"
  });
  assert.equal(uploadIntent.upload_method, "api_adapter");
  assert.equal(uploadIntent.upload_url, null);
  assert.equal(uploadIntent.upload_headers["content-type"], "application/pdf");
  assert.match(uploadIntent.upload_token, /^upload_/);
  assert.equal(uploadIntent.expires_at, "2026-06-07T12:10:00.000Z");

  const downloadIntent = adapter.createDownloadIntent({ status: "available" });
  assert.equal(downloadIntent.download_available, true);
  assert.equal(downloadIntent.download_url, null);
  assert.equal(downloadIntent.expires_at, null);
});

test("S3 storage key is server-generated and does not include raw ids or filenames", () => {
  const storageKey = createOpaqueStorageKey({
    workspaceId: WORKSPACE_ID,
    documentId: DOCUMENT_ID,
    documentFileId: DOCUMENT_FILE_ID
  });

  assert.match(storageKey, /^tenant-[a-f0-9]{24}\/documents\/[a-f0-9]{24}\/files\/[a-f0-9]{32}$/);
  assert.equal(storageKey.includes(WORKSPACE_ID), false);
  assert.equal(storageKey.includes(DOCUMENT_ID), false);
  assert.equal(storageKey.includes(DOCUMENT_FILE_ID), false);
  assert.equal(storageKey.includes("receipt.pdf"), false);
});

test("S3 adapter creates signed upload and download URLs without exposing credentials as fields", () => {
  const adapter = createS3FileStorageAdapter({
    now: () => FIXED_NOW,
    config: {
      driver: "s3",
      bucket: "home-ledger-documents",
      region: "us-east-1",
      endpoint: "https://storage.example.test",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      forcePathStyle: true,
      uploadUrlTtlSeconds: 120,
      downloadUrlTtlSeconds: 60
    }
  });
  const storageKey = adapter.createStorageKey({
    workspaceId: WORKSPACE_ID,
    documentId: DOCUMENT_ID,
    documentFileId: DOCUMENT_FILE_ID
  });

  const uploadIntent = adapter.createUploadIntent({
    storageKey,
    mimeType: "application/pdf"
  });
  assert.equal(uploadIntent.upload_method, "signed_url_put");
  assert.equal(uploadIntent.upload_token, null);
  assert.equal(uploadIntent.upload_headers["content-type"], "application/pdf");
  assert.equal(uploadIntent.expires_at, "2026-06-07T12:02:00.000Z");

  const uploadUrl = new URL(uploadIntent.upload_url);
  assert.equal(uploadUrl.origin, "https://storage.example.test");
  assert.equal(uploadUrl.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.equal(uploadUrl.searchParams.get("X-Amz-Expires"), "120");
  assert.match(uploadUrl.searchParams.get("X-Amz-Signature"), /^[a-f0-9]{64}$/);
  assert.equal(uploadUrl.searchParams.get("X-Amz-SignedHeaders"), "content-type;host");

  const downloadIntent = adapter.createDownloadIntent({
    storageKey,
    status: "available"
  });
  assert.equal(downloadIntent.download_available, true);
  assert.equal(downloadIntent.expires_at, "2026-06-07T12:01:00.000Z");

  const downloadUrl = new URL(downloadIntent.download_url);
  assert.equal(downloadUrl.searchParams.get("X-Amz-Expires"), "60");
  assert.equal(downloadUrl.searchParams.get("X-Amz-SignedHeaders"), "host");

  const serialized = JSON.stringify({ uploadIntent, downloadIntent });
  assert.equal(serialized.includes("test-secret-key"), false);
  assert.equal(serialized.includes("secretAccessKey"), false);
  assert.equal(serialized.includes("storage_key"), false);
  assert.equal(serialized.includes(WORKSPACE_ID), false);
  assert.equal(serialized.includes(DOCUMENT_ID), false);
});

test("S3 adapter returns no download URL for unavailable file statuses", () => {
  const adapter = createS3FileStorageAdapter({
    now: () => FIXED_NOW,
    config: {
      driver: "s3",
      bucket: "home-ledger-documents",
      region: "us-east-1",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key"
    }
  });

  const intent = adapter.createDownloadIntent({
    storageKey: "tenant-hash/documents/hash/files/hash",
    status: "deleted"
  });
  assert.deepEqual(intent, {
    download_available: false,
    download_url: null,
    expires_at: null
  });
});
