import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";

test("DB-backed Project API validates relationships and soft archives projects", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const email = `project_owner_${suffix}@example.test`;
  let workspaceId;
  let propertyId;
  let vendorId;
  let projectId;

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
        name: `Project DB ${suffix}`
      }
    });
    assert.equal(workspaceResponse.statusCode, 201);
    workspaceId = workspaceResponse.json().data.id;

    const propertyResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(email),
      payload: {
        name: "Project property"
      }
    });
    assert.equal(propertyResponse.statusCode, 201);
    propertyId = propertyResponse.json().data.id;

    const vendorResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/vendors`,
      headers: authHeaders(email),
      payload: {
        name: "Project vendor"
      }
    });
    assert.equal(vendorResponse.statusCode, 201);
    vendorId = vendorResponse.json().data.id;

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/projects`,
      headers: authHeaders(email),
      payload: {
        property_id: propertyId,
        vendor_id: vendorId,
        name: "DB project",
        category: "general",
        status: "in_progress",
        start_date: "2026-06-01"
      }
    });
    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().data.property_name, "Project property");
    assert.equal(createResponse.json().data.vendor_name, "Project vendor");
    projectId = createResponse.json().data.id;

    const invalidRelationshipResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/projects`,
      headers: authHeaders(email),
      payload: {
        property_id: vendorId,
        name: "Bad project",
        category: "general"
      }
    });
    assert.equal(invalidRelationshipResponse.statusCode, 400);
    assert.deepEqual(invalidRelationshipResponse.json().error.details[0], {
      field: "property_id",
      issue: "not_found"
    });

    const archiveResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/projects/${projectId}`,
      headers: authHeaders(email)
    });
    assert.equal(archiveResponse.statusCode, 200);
    assert.equal(archiveResponse.json().data.status, "archived");
    assert.notEqual(archiveResponse.json().data.archived_at, null);

    const archivedRow = await db.query(
      "SELECT archived_at, deleted_at, status FROM projects WHERE id = $1",
      [projectId]
    );
    assert.notEqual(archivedRow.rows[0].archived_at, null);
    assert.equal(archivedRow.rows[0].deleted_at, null);
    assert.equal(archivedRow.rows[0].status, "archived");

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/projects`,
      headers: authHeaders(email)
    });
    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(listResponse.json().data, []);

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
