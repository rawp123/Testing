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
  assert.equal(config.billingProvider, "none");
  assert.equal(config.ocrMode, "disabled");
  assert.equal(config.analyticsEnabled, false);
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
