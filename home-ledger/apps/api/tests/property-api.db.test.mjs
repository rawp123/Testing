import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";

test("DB-backed Property API creates updates archives and preserves primary uniqueness", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const email = `property_owner_${suffix}@example.test`;
  let workspaceId;
  let propertyId;
  let secondPropertyId;

  try {
    const app = buildApp({
      config: createConfig({ databaseUrl }),
      db
    });

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: authHeaders(email),
      payload: {
        name: `Property DB ${suffix}`
      }
    });
    assert.equal(workspaceResponse.statusCode, 201);
    workspaceId = workspaceResponse.json().data.id;

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(email),
      payload: {
        name: "First property",
        purchase_price_cents: 100000,
        currency_code: "USD"
      }
    });
    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().data.is_primary, true);
    propertyId = createResponse.json().data.id;

    const secondCreateResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(email),
      payload: {
        name: "Second property",
        is_primary: true
      }
    });
    assert.equal(secondCreateResponse.statusCode, 201);
    secondPropertyId = secondCreateResponse.json().data.id;

    const primaryCount = await db.query(
      `
        SELECT count(*)::int AS count
        FROM properties
        WHERE workspace_id = $1
          AND is_primary = true
          AND deleted_at IS NULL
          AND archived_at IS NULL
      `,
      [workspaceId]
    );
    assert.equal(primaryCount.rows[0].count, 1);

    const archiveResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties/${secondPropertyId}/archive`,
      headers: authHeaders(email)
    });
    assert.equal(archiveResponse.statusCode, 200);
    assert.notEqual(archiveResponse.json().data.archived_at, null);

    const archivedRow = await db.query(
      "SELECT archived_at, deleted_at FROM properties WHERE id = $1",
      [secondPropertyId]
    );
    assert.notEqual(archivedRow.rows[0].archived_at, null);
    assert.equal(archivedRow.rows[0].deleted_at, null);

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(email)
    });
    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(listResponse.json().data.map((property) => property.id), [propertyId]);

    await app.close();
  } finally {
    if (workspaceId) {
      await db.query("DELETE FROM workspaces WHERE id = $1", [workspaceId]);
    }
    await db.query("DELETE FROM users WHERE email = $1", [email]);
    await db.end();
  }
});

function authHeaders(email) {
  return {
    [TEST_AUTH_EMAIL_HEADER]: email
  };
}

function createConfig(overrides = {}) {
  return {
    appEnv: "test",
    authProvider: "dev",
    devAuthEnabled: true,
    devAuthEmail: "dev@example.test",
    devAuthDisplayName: "Local Developer",
    requestIdHeader: "x-request-id",
    dbPoolMax: 2,
    ...overrides
  };
}
