import assert from "node:assert/strict";
import test from "node:test";
import { requireDatabaseUrl, requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";

test("requireDatabaseUrl rejects missing DATABASE_URL", () => {
  withEnv({ DATABASE_URL: undefined }, () => {
    assert.throws(
      () => requireDatabaseUrl(),
      /DATABASE_URL is required/
    );
  });
});

test("requireTestDatabaseUrl requires a dedicated test database URL", () => {
  withEnv({ TEST_DATABASE_URL: undefined }, () => {
    assert.throws(
      () => requireTestDatabaseUrl(),
      /TEST_DATABASE_URL is required/
    );
  });

  withEnv({
    DATABASE_URL: "postgres://user:pass@localhost:5432/home_ledger_dev",
    TEST_DATABASE_URL: "postgres://user:pass@localhost:5432/home_ledger_dev"
  }, () => {
    assert.throws(
      () => requireTestDatabaseUrl(),
      /must not match DATABASE_URL/
    );
  });

  withEnv({
    DATABASE_URL: undefined,
    TEST_DATABASE_URL: "postgres://user:pass@localhost:5432/home_ledger_dev"
  }, () => {
    assert.throws(
      () => requireTestDatabaseUrl(),
      /database name must include 'test'/
    );
  });
});

test("requireTestDatabaseUrl accepts an isolated test database URL", () => {
  withEnv({
    DATABASE_URL: "postgres://user:pass@localhost:5432/home_ledger_dev",
    TEST_DATABASE_URL: "postgres://user:pass@localhost:5432/home_ledger_test",
    NODE_ENV: "test"
  }, () => {
    assert.equal(
      requireTestDatabaseUrl(),
      "postgres://user:pass@localhost:5432/home_ledger_test"
    );
  });
});

function withEnv(overrides, callback) {
  const previous = new Map();
  for (const key of Object.keys(overrides)) {
    previous.set(key, process.env[key]);
  }

  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
