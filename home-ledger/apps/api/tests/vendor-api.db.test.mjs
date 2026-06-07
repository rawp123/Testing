import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";

test("DB-backed Vendor API creates updates archives and allows duplicate normalized names", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const email = `vendor_owner_${suffix}@example.test`;
  let workspaceId;
  let vendorId;
  let duplicateVendorId;

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
        name: `Vendor DB ${suffix}`
      }
    });
    assert.equal(workspaceResponse.statusCode, 201);
    workspaceId = workspaceResponse.json().data.id;

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/vendors`,
      headers: authHeaders(email),
      payload: {
        name: "Summit Heating",
        email: "INFO@SUMMIT.EXAMPLE",
        website: "https://summit.example"
      }
    });
    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().data.normalized_name, "summit heating");
    assert.equal(createResponse.json().data.email, "info@summit.example");
    vendorId = createResponse.json().data.id;

    const duplicateResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/vendors`,
      headers: authHeaders(email),
      payload: {
        name: "  summit   heating "
      }
    });
    assert.equal(duplicateResponse.statusCode, 201);
    assert.equal(duplicateResponse.json().data.normalized_name, "summit heating");
    duplicateVendorId = duplicateResponse.json().data.id;
    assert.notEqual(vendorId, duplicateVendorId);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceId}/vendors/${vendorId}`,
      headers: authHeaders(email),
      payload: {
        category: "hvac",
        contact_name: "Taylor Tech"
      }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().data.category, "hvac");
    assert.equal(updateResponse.json().data.contact_name, "Taylor Tech");

    const archiveResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/vendors/${duplicateVendorId}`,
      headers: authHeaders(email)
    });
    assert.equal(archiveResponse.statusCode, 200);
    assert.equal(archiveResponse.json().data.status, "archived");
    assert.notEqual(archiveResponse.json().data.archived_at, null);

    const archivedRow = await db.query(
      "SELECT archived_at, deleted_at, status FROM vendors WHERE id = $1",
      [duplicateVendorId]
    );
    assert.notEqual(archivedRow.rows[0].archived_at, null);
    assert.equal(archivedRow.rows[0].deleted_at, null);
    assert.equal(archivedRow.rows[0].status, "archived");

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/vendors`,
      headers: authHeaders(email)
    });
    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(listResponse.json().data.map((vendor) => vendor.id), [vendorId]);

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
