import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";

test("DB-backed Follow-up API resolves reopens and computes open item counts", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ownerEmail = `followup_owner_${suffix}@example.test`;
  const viewerEmail = `followup_viewer_${suffix}@example.test`;
  const nonMemberEmail = `followup_nonmember_${suffix}@example.test`;
  let workspaceId;
  let otherWorkspaceId;

  try {
    const viewer = await createUser(db, viewerEmail, "Follow-up Viewer");
    const app = buildApp({
      config: createConfig({ databaseUrl }),
      db
    });

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: authHeaders(ownerEmail),
      payload: { name: `Follow-up DB ${suffix}` }
    });
    assert.equal(workspaceResponse.statusCode, 201);
    workspaceId = workspaceResponse.json().data.id;

    await db.query(
      `
        INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
        VALUES ($1, $2, 'viewer', 'active')
      `,
      [workspaceId, viewer.id]
    );

    const otherWorkspaceResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: authHeaders(ownerEmail),
      payload: { name: `Other follow-up DB ${suffix}` }
    });
    assert.equal(otherWorkspaceResponse.statusCode, 201);
    otherWorkspaceId = otherWorkspaceResponse.json().data.id;

    const propertyId = await createProperty(app, workspaceId, ownerEmail, "Follow-up property");
    const otherPropertyId = await createProperty(app, otherWorkspaceId, ownerEmail, "Other follow-up property");
    const projectId = await createProject(app, workspaceId, ownerEmail, propertyId, {
      name: "Follow-up project",
      category: "deck/patio/porch",
      status: "completed"
    });
    await createProject(app, otherWorkspaceId, ownerEmail, otherPropertyId, {
      name: "Other follow-up project",
      category: "general"
    });

    const expenseId = await createExpense(app, workspaceId, ownerEmail, {
      property_id: propertyId,
      project_id: projectId,
      description: "Follow-up expense",
      amount_cents: 125000,
      category: "deck/patio/porch",
      record_treatment: "review_later",
      documentation_status: "needs_follow_up"
    });
    await createExpense(app, workspaceId, ownerEmail, {
      property_id: propertyId,
      project_id: projectId,
      description: "Unsupported follow-up expense",
      amount_cents: 5000,
      category: "deck/patio/porch",
      record_treatment: "repair_upkeep",
      documentation_status: "needs_follow_up"
    });

    const documentId = await createDocument(app, workspaceId, ownerEmail, {
      expense_id: expenseId,
      display_name: "Follow-up receipt",
      document_type: "receipt",
      file_availability: "not_uploaded"
    });

    await db.query(
      `
        INSERT INTO document_ocr (
          workspace_id,
          document_id,
          status,
          started_at
        )
        VALUES ($1, $2, 'queued', now())
      `,
      [workspaceId, documentId]
    );

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/follow-ups`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(listResponse.statusCode, 200);
    const followUps = listResponse.json().data;
    assert(followUps.some((item) => item.reason_code === "project_missing_dates"));
    assert(followUps.some((item) => item.reason_code === "project_missing_permit_or_approval"));
    assert(followUps.some((item) => item.reason_code === "expense_missing_document_support"));
    assert(followUps.some((item) => item.reason_code === "expense_review_later"));
    assert(followUps.some((item) => item.reason_code === "document_missing_file"));
    assert.equal(followUps.some((item) => item.title.includes("Other follow-up")), false);
    assert.equal(JSON.stringify(followUps).includes("storage_key"), false);

    const target = followUps.find((item) => item.reason_code === "expense_review_later");
    const viewerResolve = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/follow-ups/${target.id}/resolve`,
      headers: authHeaders(viewerEmail),
      payload: {}
    });
    assert.equal(viewerResolve.statusCode, 403);

    const resolveResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/follow-ups/${target.id}/resolve`,
      headers: authHeaders(ownerEmail),
      payload: { note: "Handled outside the app." }
    });
    assert.equal(resolveResponse.statusCode, 200);
    assert.equal(resolveResponse.json().data.status, "resolved");

    const overrideRows = await db.query(
      "SELECT source_follow_up_id, invalidated_at, note FROM follow_up_overrides WHERE workspace_id = $1",
      [workspaceId]
    );
    assert.equal(overrideRows.rows.length, 1);
    assert.equal(overrideRows.rows[0].source_follow_up_id, target.id);
    assert.equal(overrideRows.rows[0].invalidated_at, null);
    assert.equal(overrideRows.rows[0].note, "Handled outside the app.");

    const openAfterResolve = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/follow-ups`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(openAfterResolve.json().data.some((item) => item.id === target.id), false);

    const projectResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/projects/${projectId}`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(projectResponse.statusCode, 200);
    assert.equal(projectResponse.json().data.open_item_count, openAfterResolve.json().data.filter((item) => item.project_id === projectId).length);

    const expenseResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/expenses/${expenseId}`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(expenseResponse.statusCode, 200);
    assert.equal(expenseResponse.json().data.open_item_count, openAfterResolve.json().data.filter((item) => item.expense_id === expenseId).length);

    const dashboardResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/dashboard`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(dashboardResponse.statusCode, 200);
    assert.equal(dashboardResponse.json().data.projects.open_follow_up_count, openAfterResolve.json().data.length);

    const reopenResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/follow-ups/${target.id}/reopen`,
      headers: authHeaders(ownerEmail),
      payload: {}
    });
    assert.equal(reopenResponse.statusCode, 200);
    assert.equal(reopenResponse.json().data.status, "open");

    const reopenedRows = await db.query(
      "SELECT invalidated_at FROM follow_up_overrides WHERE workspace_id = $1",
      [workspaceId]
    );
    assert.notEqual(reopenedRows.rows[0].invalidated_at, null);

    const repeatedList = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/follow-ups`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(repeatedList.json().data.some((item) => item.id === target.id), true);
    assert.deepEqual(
      repeatedList.json().data.map((item) => item.id),
      (await app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${workspaceId}/follow-ups`,
        headers: authHeaders(ownerEmail)
      })).json().data.map((item) => item.id)
    );

    const nonMemberResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/follow-ups`,
      headers: authHeaders(nonMemberEmail)
    });
    assert.equal(nonMemberResponse.statusCode, 404);

    await app.close();
  } finally {
    await db.query("DELETE FROM workspaces WHERE id = ANY($1::uuid[])", [
      [workspaceId, otherWorkspaceId].filter(Boolean)
    ]);
    await db.query("DELETE FROM users WHERE email = ANY($1::text[])", [
      [ownerEmail, viewerEmail, nonMemberEmail]
    ]);
    await db.end();
  }
});

async function createUser(db, email, displayName) {
  const result = await db.query(
    `
      INSERT INTO users (email, display_name, status)
      VALUES ($1, $2, 'active')
      RETURNING id
    `,
    [email, displayName]
  );
  return result.rows[0];
}

async function createProperty(app, workspaceId, email, name) {
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${workspaceId}/properties`,
    headers: authHeaders(email),
    payload: { name }
  });
  assert.equal(response.statusCode, 201);
  return response.json().data.id;
}

async function createProject(app, workspaceId, email, propertyId, overrides = {}) {
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${workspaceId}/projects`,
    headers: authHeaders(email),
    payload: {
      property_id: propertyId,
      name: "Project",
      category: "general",
      ...overrides
    }
  });
  assert.equal(response.statusCode, 201);
  return response.json().data.id;
}

async function createExpense(app, workspaceId, email, payload) {
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${workspaceId}/expenses`,
    headers: authHeaders(email),
    payload
  });
  assert.equal(response.statusCode, 201);
  return response.json().data.id;
}

async function createDocument(app, workspaceId, email, payload) {
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${workspaceId}/documents`,
    headers: authHeaders(email),
    payload
  });
  assert.equal(response.statusCode, 201);
  return response.json().data.id;
}

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
    fileStorageDriver: "local",
    fileStorage: {},
    ocrMode: "disabled",
    ...overrides
  };
}
