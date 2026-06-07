import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";

test("DB-backed Expense API validates relationships and soft deletes expenses", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const email = `expense_owner_${suffix}@example.test`;
  let workspaceId;
  let propertyId;
  let secondPropertyId;
  let vendorId;
  let projectId;
  let secondProjectId;
  let expenseId;

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
        name: `Expense DB ${suffix}`
      }
    });
    assert.equal(workspaceResponse.statusCode, 201);
    workspaceId = workspaceResponse.json().data.id;

    const propertyResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(email),
      payload: {
        name: "Expense property"
      }
    });
    assert.equal(propertyResponse.statusCode, 201);
    propertyId = propertyResponse.json().data.id;

    const secondPropertyResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(email),
      payload: {
        name: "Second expense property"
      }
    });
    assert.equal(secondPropertyResponse.statusCode, 201);
    secondPropertyId = secondPropertyResponse.json().data.id;

    const vendorResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/vendors`,
      headers: authHeaders(email),
      payload: {
        name: "Expense vendor"
      }
    });
    assert.equal(vendorResponse.statusCode, 201);
    vendorId = vendorResponse.json().data.id;

    const projectResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/projects`,
      headers: authHeaders(email),
      payload: {
        property_id: propertyId,
        vendor_id: vendorId,
        name: "Expense project",
        category: "general",
        status: "in_progress"
      }
    });
    assert.equal(projectResponse.statusCode, 201);
    projectId = projectResponse.json().data.id;

    const secondProjectResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/projects`,
      headers: authHeaders(email),
      payload: {
        property_id: secondPropertyId,
        name: "Second expense project",
        category: "general"
      }
    });
    assert.equal(secondProjectResponse.statusCode, 201);
    secondProjectId = secondProjectResponse.json().data.id;

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/expenses`,
      headers: authHeaders(email),
      payload: {
        property_id: propertyId,
        project_id: projectId,
        vendor_id: vendorId,
        vendor_name_raw: "Expense vendor",
        expense_date: "2026-06-04",
        description: "DB expense",
        amount_cents: 68000,
        category: "general",
        record_treatment: "repair_upkeep",
        documentation_status: "receipt_attached"
      }
    });
    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().data.property_name, "Expense property");
    assert.equal(createResponse.json().data.project_name, "Expense project");
    assert.equal(createResponse.json().data.vendor_name, "Expense vendor");
    assert.equal(createResponse.json().data.amount_cents, 68000);
    expenseId = createResponse.json().data.id;

    const mismatchResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/expenses`,
      headers: authHeaders(email),
      payload: {
        property_id: propertyId,
        project_id: secondProjectId,
        description: "Bad expense",
        amount_cents: 1,
        category: "general"
      }
    });
    assert.equal(mismatchResponse.statusCode, 400);
    assert.deepEqual(mismatchResponse.json().error.details[0], {
      field: "project_id",
      issue: "property_mismatch"
    });

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceId}/expenses/${expenseId}`,
      headers: authHeaders(email),
      payload: {
        amount_cents: 70000,
        property_id: secondPropertyId,
        project_id: secondProjectId,
        vendor_id: null,
        documentation_status: "needs_follow_up"
      }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().data.amount_cents, 70000);
    assert.equal(updateResponse.json().data.property_id, secondPropertyId);
    assert.equal(updateResponse.json().data.project_id, secondProjectId);
    assert.equal(updateResponse.json().data.vendor_id, null);
    assert.equal(updateResponse.json().data.documentation_status, "needs_follow_up");

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/expenses/${expenseId}`,
      headers: authHeaders(email)
    });
    assert.equal(deleteResponse.statusCode, 200);
    assert.notEqual(deleteResponse.json().data.deleted_at, null);

    const deletedRow = await db.query(
      "SELECT deleted_at, amount_cents FROM expenses WHERE id = $1",
      [expenseId]
    );
    assert.notEqual(deletedRow.rows[0].deleted_at, null);
    assert.equal(Number(deletedRow.rows[0].amount_cents), 70000);

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/expenses`,
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
