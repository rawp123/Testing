import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { getReadinessSnapshot, serializeReadinessSnapshot } from "../src/readiness.js";

test("GET /ready returns safe readiness details with local auth", async () => {
  const app = buildApp({
    config: createConfig({
      fileStorageDriver: "s3",
      fileStorage: {
        driver: "s3",
        bucket: "secret-bucket",
        region: "us-east-1",
        endpoint: "https://storage.internal.example.test",
        accessKeyId: "secret-access-key",
        secretAccessKey: "secret-storage-key",
        forcePathStyle: false,
        uploadUrlTtlSeconds: 600,
        downloadUrlTtlSeconds: 300
      },
      authProvider: "dev",
      devAuthEnabled: true,
      billingProvider: "stripe",
      ocrMode: "disabled"
    }),
    db: createReadyDb()
  });

  const response = await app.inject({
    method: "GET",
    url: "/ready"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    data: {
      status: "ready",
      checks: [
        {
          name: "config",
          status: "ok",
          message: "Required runtime configuration is present."
        },
        {
          name: "database",
          status: "ok",
          message: "Database connection is ready."
        },
        {
          name: "file_storage",
          status: "ok",
          message: "Object storage is configured for signed upload and download intents."
        },
        {
          name: "ocr",
          status: "disabled",
          message: "OCR provider is disabled."
        },
        {
          name: "auth",
          status: "local_only",
          message: "Auth is using local/test behavior."
        },
        {
          name: "billing",
          status: "ok",
          message: "Billing provider is configured."
        }
      ]
    }
  });

  const body = response.body;
  for (const blocked of [
    "postgres://user:secret@db.internal.example.test:5432/home_ledger",
    "secret",
    "secret-bucket",
    "storage.internal.example.test",
    "signed_url",
    "workspaces/",
    "oidc",
    "/Users/",
    "Extracted text",
    "deductible",
    "IRS-ready",
    "tax-safe",
    "audit-proof",
    "tax-optimized",
    "legal-ready"
  ]) {
    assert.doesNotMatch(body, new RegExp(escapeRegExp(blocked), "i"));
  }

  await app.close();
});

test("GET /ready returns 503 when required readiness checks fail", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFailingDb()
  });

  const response = await app.inject({
    method: "GET",
    url: "/ready"
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    data: {
      status: "not_ready",
      checks: [
        {
          name: "config",
          status: "ok",
          message: "Required runtime configuration is present."
        },
        {
          name: "database",
          status: "not_ready",
          message: "Database connection check failed."
        },
        {
          name: "file_storage",
          status: "local_only",
          message: "Object storage is using local/test metadata-only behavior."
        },
        {
          name: "ocr",
          status: "disabled",
          message: "OCR provider is disabled."
        },
        {
          name: "auth",
          status: "local_only",
          message: "Auth is using local/test behavior."
        },
        {
          name: "billing",
          status: "disabled",
          message: "Billing provider is not connected."
        }
      ]
    }
  });

  await app.close();
});

test("GET /ready rejects production runtime without production object storage", async () => {
  const app = buildApp({
    config: createConfig({
      appEnv: "production",
      authProvider: "oidc",
      billingProvider: "stripe",
      fileStorageDriver: "local",
      fileStorage: {
        driver: "local",
        bucket: "private-bucket",
        accessKeyId: "storage-access-key",
        secretAccessKey: "storage-secret-key"
      }
    }),
    db: createReadyDb()
  });

  const response = await app.inject({
    method: "GET",
    url: "/ready"
  });

  assert.equal(response.statusCode, 503);
  const body = response.json();
  assert.equal(body.data.status, "not_ready");
  assert.deepEqual(body.data.checks.find((check) => check.name === "file_storage"), {
    name: "file_storage",
    status: "not_ready",
    message: "Production object storage is not configured."
  });
  assert.deepEqual(body.data.checks.find((check) => check.name === "auth"), {
    name: "auth",
    status: "not_ready",
    message: "Production auth adapter is not implemented."
  });
  assert.doesNotMatch(response.body, /private-bucket/i);
  assert.doesNotMatch(response.body, /storage-access-key/i);
  assert.doesNotMatch(response.body, /storage-secret-key/i);
  assert.doesNotMatch(response.body, /oidc/i);

  await app.close();
});

test("GET /ready rejects production runtime using local OCR behavior", async () => {
  const app = buildApp({
    config: createConfig({
      appEnv: "production",
      authProvider: "oidc",
      billingProvider: "stripe",
      ocrMode: "fake",
      fileStorageDriver: "s3",
      fileStorage: {
        driver: "s3",
        bucket: "private-bucket",
        region: "us-east-1",
        endpoint: "https://storage.internal.example.test",
        accessKeyId: "storage-access-key",
        secretAccessKey: "storage-secret-key"
      }
    }),
    db: createReadyDb()
  });

  const response = await app.inject({
    method: "GET",
    url: "/ready"
  });

  assert.equal(response.statusCode, 503);
  const body = response.json();
  assert.equal(body.data.status, "not_ready");
  assert.deepEqual(body.data.checks.find((check) => check.name === "ocr"), {
    name: "ocr",
    status: "not_ready",
    message: "Production OCR provider is not configured."
  });
  assert.deepEqual(body.data.checks.find((check) => check.name === "auth"), {
    name: "auth",
    status: "not_ready",
    message: "Production auth adapter is not implemented."
  });

  for (const blocked of [
    "private-bucket",
    "storage.internal.example.test",
    "storage-access-key",
    "storage-secret-key",
    "provider-request",
    "oidc",
    "Extracted text",
    "signed_url",
    "/Users/"
  ]) {
    assert.doesNotMatch(response.body, new RegExp(escapeRegExp(blocked), "i"));
  }

  await app.close();
});

test("GET /ready reports production auth placeholders as not ready without internals", async () => {
  const app = buildApp({
    config: createConfig({
      appEnv: "production",
      authProvider: "provider_internal_secret",
      devAuthEnabled: false,
      billingProvider: "stripe",
      ocrMode: "disabled",
      fileStorageDriver: "s3",
      fileStorage: {
        driver: "s3",
        bucket: "private-bucket",
        region: "us-east-1",
        endpoint: "https://storage.internal.example.test",
        accessKeyId: "storage-access-key",
        secretAccessKey: "storage-secret-key"
      }
    }),
    db: createReadyDb()
  });

  const response = await app.inject({
    method: "GET",
    url: "/ready"
  });

  assert.equal(response.statusCode, 503);
  const body = response.json();
  assert.equal(body.data.status, "not_ready");
  assert.deepEqual(body.data.checks.find((check) => check.name === "auth"), {
    name: "auth",
    status: "not_ready",
    message: "Production auth adapter is not implemented."
  });

  for (const blocked of [
    "provider_internal_secret",
    "private-bucket",
    "storage.internal.example.test",
    "storage-access-key",
    "storage-secret-key",
    "signed_url",
    "OAuth",
    "JWT",
    "raw-session-token",
    "/Users/"
  ]) {
    assert.doesNotMatch(response.body, new RegExp(escapeRegExp(blocked), "i"));
  }

  await app.close();
});

test("readiness serialization omits provider internals and raw config", async () => {
  const snapshot = await getReadinessSnapshot({
    config: createConfig({
      databaseUrl: "postgres://user:secret@db.internal.example.test:5432/home_ledger",
      fileStorageDriver: "local",
      fileStorage: {
        driver: "local",
        bucket: "secret-bucket",
        accessKeyId: "secret-access-key",
        secretAccessKey: "secret-storage-key"
      },
      ocrMode: "fake",
      ocrApiKey: "ocr-secret-key",
      providerRequestId: "provider-request-123"
    }),
    db: createReadyDb()
  });

  const serialized = serializeReadinessSnapshot(snapshot);
  const body = JSON.stringify(serialized);

  assert.equal(serialized.status, "ready");
  assert.doesNotMatch(body, /postgres:\/\/user:secret/i);
  assert.doesNotMatch(body, /secret-bucket/i);
  assert.doesNotMatch(body, /secret-access-key/i);
  assert.doesNotMatch(body, /secret-storage-key/i);
  assert.doesNotMatch(body, /ocr-secret-key/i);
  assert.doesNotMatch(body, /provider-request-123/i);
});

function createConfig(overrides = {}) {
  return {
    appEnv: "local",
    authProvider: "dev",
    devAuthEnabled: true,
    devAuthEmail: "dev@example.test",
    devAuthDisplayName: "Local Developer",
    requestIdHeader: "x-request-id",
    databaseUrl: "postgres://user:secret@db.internal.example.test:5432/home_ledger",
    fileStorageDriver: "local",
    fileStorage: {
      driver: "local",
      uploadUrlTtlSeconds: 600,
      downloadUrlTtlSeconds: 300
    },
    billingProvider: "none",
    ocrMode: "disabled",
    ...overrides
  };
}

function createReadyDb() {
  return {
    async query(sql) {
      if (/SELECT 1/i.test(sql)) {
        return { rows: [{ "?column?": 1 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
}

function createFailingDb() {
  return {
    async query() {
      throw new Error("connection failed with secret details");
    }
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
