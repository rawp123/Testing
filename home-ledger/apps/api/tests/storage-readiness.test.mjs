import assert from "node:assert/strict";
import test from "node:test";
import { getFileStorageReadiness, isFileStorageProductionReady } from "../src/storage-readiness.js";

test("storage readiness accepts local metadata-only behavior outside production", () => {
  assert.deepEqual(
    getFileStorageReadiness({
      appEnv: "local",
      fileStorageDriver: "local",
      fileStorage: {
        driver: "local"
      }
    }),
    {
      name: "file_storage",
      status: "local_only",
      message: "Object storage is using local/test metadata-only behavior."
    }
  );
});

test("storage readiness rejects local storage in production", () => {
  assert.deepEqual(
    getFileStorageReadiness({
      appEnv: "production",
      fileStorageDriver: "local",
      fileStorage: {
        driver: "local"
      }
    }),
    {
      name: "file_storage",
      status: "not_ready",
      message: "Production object storage is not configured."
    }
  );
});

test("storage readiness rejects partial S3 config without leaking values", () => {
  const readiness = getFileStorageReadiness({
    appEnv: "production",
    fileStorageDriver: "s3",
    fileStorage: {
      driver: "s3",
      bucket: "private-bucket",
      region: "us-east-1",
      accessKeyId: "storage-access-key",
      secretAccessKey: ""
    }
  });

  assert.deepEqual(readiness, {
    name: "file_storage",
    status: "not_ready",
    message: "Object storage is selected but required production storage settings are incomplete."
  });
  assert.equal(JSON.stringify(readiness).includes("private-bucket"), false);
  assert.equal(JSON.stringify(readiness).includes("storage-access-key"), false);
});

test("storage readiness accepts complete S3 config without exposing provider internals", () => {
  const readiness = getFileStorageReadiness({
    appEnv: "production",
    fileStorageDriver: "s3",
    fileStorage: {
      driver: "s3",
      bucket: "private-bucket",
      region: "us-east-1",
      endpoint: "https://storage.internal.example.test",
      accessKeyId: "storage-access-key",
      secretAccessKey: "storage-secret-key"
    }
  });

  assert.deepEqual(readiness, {
    name: "file_storage",
    status: "ok",
    message: "Object storage is configured for signed upload and download intents."
  });
  assert.equal(isFileStorageProductionReady({
    appEnv: "production",
    fileStorageDriver: "s3",
    fileStorage: {
      driver: "s3",
      bucket: "private-bucket",
      region: "us-east-1",
      accessKeyId: "storage-access-key",
      secretAccessKey: "storage-secret-key"
    }
  }), true);

  const serialized = JSON.stringify(readiness);
  assert.equal(serialized.includes("private-bucket"), false);
  assert.equal(serialized.includes("storage.internal.example.test"), false);
  assert.equal(serialized.includes("storage-access-key"), false);
  assert.equal(serialized.includes("storage-secret-key"), false);
});
