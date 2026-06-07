import assert from "node:assert/strict";
import test from "node:test";
import { ConfigError, formatConfigError, loadConfig, redactSecret } from "../src/config.js";

test("loadConfig returns local dev defaults without requiring a final auth provider", () => {
  const config = loadConfig({
    DATABASE_URL: "postgres://user:secret@localhost:5432/home_ledger_dev"
  });

  assert.equal(config.appEnv, "local");
  assert.equal(config.port, 4000);
  assert.equal(config.authProvider, "dev");
  assert.equal(config.devAuthEnabled, true);
  assert.equal(config.devAuthEmail, "dev@example.test");
  assert.equal(config.fileStorageDriver, "local");
  assert.equal(config.fileStorage.driver, "local");
  assert.equal(config.fileStorage.uploadUrlTtlSeconds, 600);
  assert.equal(config.fileStorage.downloadUrlTtlSeconds, 300);
  assert.equal(config.billingProvider, "none");
  assert.equal(config.ocrMode, "disabled");
  assert.equal(config.analyticsEnabled, false);
});

test("loadConfig validates and returns S3 storage settings without leaking secrets", () => {
  const config = loadConfig({
    DATABASE_URL: "postgres://user:secret@localhost:5432/home_ledger_dev",
    FILE_STORAGE_DRIVER: "s3",
    FILE_STORAGE_BUCKET: "home-ledger-documents",
    FILE_STORAGE_REGION: "us-east-1",
    FILE_STORAGE_ENDPOINT: "https://r2.example.test",
    FILE_STORAGE_ACCESS_KEY_ID: "storage-access-key",
    FILE_STORAGE_SECRET_ACCESS_KEY: "storage-secret-key",
    FILE_STORAGE_FORCE_PATH_STYLE: "true",
    FILE_STORAGE_UPLOAD_URL_TTL_SECONDS: "120",
    FILE_STORAGE_DOWNLOAD_URL_TTL_SECONDS: "60"
  });

  assert.equal(config.fileStorageDriver, "s3");
  assert.deepEqual(config.fileStorage, {
    driver: "s3",
    bucket: "home-ledger-documents",
    region: "us-east-1",
    endpoint: "https://r2.example.test",
    accessKeyId: "storage-access-key",
    secretAccessKey: "storage-secret-key",
    forcePathStyle: true,
    uploadUrlTtlSeconds: 120,
    downloadUrlTtlSeconds: 60
  });
});

test("loadConfig validates OCR mode", () => {
  const fakeConfig = loadConfig({
    DATABASE_URL: "postgres://user:secret@localhost:5432/home_ledger_dev",
    OCR_MODE: "fake"
  });
  assert.equal(fakeConfig.ocrMode, "fake");

  assert.throws(
    () => loadConfig({
      DATABASE_URL: "postgres://user:secret@localhost:5432/home_ledger_dev",
      OCR_MODE: "external-provider-secret"
    }),
    (error) => {
      assert.equal(error instanceof ConfigError, true);
      assert.deepEqual(error.issues.map((issue) => issue.key), ["OCR_MODE"]);
      assert.doesNotMatch(formatConfigError(error), /external-provider-secret/);
      return true;
    }
  );
});

test("loadConfig requires S3 storage credentials only when S3 is selected", () => {
  assert.throws(
    () => loadConfig({
      DATABASE_URL: "postgres://user:secret@localhost:5432/home_ledger_dev",
      FILE_STORAGE_DRIVER: "s3",
      FILE_STORAGE_SECRET_ACCESS_KEY: "do-not-print-this-secret",
      FILE_STORAGE_ENDPOINT: "not a url",
      FILE_STORAGE_UPLOAD_URL_TTL_SECONDS: "0"
    }),
    (error) => {
      assert.equal(error instanceof ConfigError, true);
      assert.deepEqual(error.issues.map((issue) => issue.key), [
        "FILE_STORAGE_UPLOAD_URL_TTL_SECONDS",
        "FILE_STORAGE_ENDPOINT",
        "FILE_STORAGE_BUCKET",
        "FILE_STORAGE_REGION",
        "FILE_STORAGE_ACCESS_KEY_ID"
      ]);
      assert.doesNotMatch(formatConfigError(error), /do-not-print-this-secret/);
      return true;
    }
  );
});

test("loadConfig refuses production dev auth and reports variable names only", () => {
  assert.throws(
    () => loadConfig({
      APP_ENV: "production",
      DATABASE_URL: "postgres://user:secret@prod.example.com:5432/home_ledger",
      AUTH_PROVIDER: "dev",
      DEV_AUTH_ENABLED: "true"
    }),
    (error) => {
      assert.equal(error instanceof ConfigError, true);
      assert.match(formatConfigError(error), /DEV_AUTH_ENABLED/);
      assert.doesNotMatch(formatConfigError(error), /secret/);
      assert.doesNotMatch(formatConfigError(error), /prod\.example\.com/);
      return true;
    }
  );
});

test("loadConfig treats NODE_ENV production as production when APP_ENV is omitted", () => {
  const config = loadConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://user:secret@localhost:5432/home_ledger"
  });

  assert.equal(config.appEnv, "production");
  assert.equal(config.authProvider, "none");
  assert.equal(config.devAuthEnabled, false);
});

test("loadConfig validates required runtime database and port", () => {
  assert.throws(
    () => loadConfig({
      APP_ENV: "local",
      PORT: "99999",
      DATABASE_URL: ""
    }),
    (error) => {
      assert.equal(error instanceof ConfigError, true);
      assert.deepEqual(error.issues.map((issue) => issue.key), ["PORT", "DATABASE_URL"]);
      return true;
    }
  );
});

test("redactSecret removes database credentials", () => {
  assert.equal(
    redactSecret("postgres://user:secret@localhost:5432/home_ledger_dev?sslmode=require"),
    "postgres://%5Bredacted%5D:%5Bredacted%5D@localhost:5432/home_ledger_dev"
  );
});
