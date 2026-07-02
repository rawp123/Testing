import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";

test("DB-backed Export API produces safe isolated exports", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ownerEmail = `export_owner_${suffix}@example.test`;
  const viewerEmail = `export_viewer_${suffix}@example.test`;
  const nonMemberEmail = `export_nonmember_${suffix}@example.test`;
  let workspaceId;
  let otherWorkspaceId;

  try {
    const owner = await createUser(db, ownerEmail, "Export Owner");
    const viewer = await createUser(db, viewerEmail, "Export Viewer");
    const app = buildApp({
      config: createConfig({ databaseUrl }),
      db
    });

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: authHeaders(ownerEmail),
      payload: { name: `Export DB ${suffix}` }
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
      payload: { name: `Other export DB ${suffix}` }
    });
    assert.equal(otherWorkspaceResponse.statusCode, 201);
    otherWorkspaceId = otherWorkspaceResponse.json().data.id;

    const propertyId = await createProperty(app, workspaceId, ownerEmail, "Export property");
    const otherPropertyId = await createProperty(app, otherWorkspaceId, ownerEmail, "Other export property");

    const vendorResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/vendors`,
      headers: authHeaders(ownerEmail),
      payload: { name: "Export Vendor" }
    });
    assert.equal(vendorResponse.statusCode, 201);
    const vendorId = vendorResponse.json().data.id;

    const projectResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/projects`,
      headers: authHeaders(ownerEmail),
      payload: {
        property_id: propertyId,
        vendor_id: vendorId,
        name: "Export project",
        category: "general",
        status: "in_progress"
      }
    });
    assert.equal(projectResponse.statusCode, 201);
    const projectId = projectResponse.json().data.id;

    const expenseId = await createExpense(app, workspaceId, ownerEmail, {
      property_id: propertyId,
      project_id: projectId,
      vendor_id: vendorId,
      description: "Export expense",
      amount_cents: 12345,
      category: "general",
      record_treatment: "possible_improvement",
      documentation_status: "needs_follow_up",
      notes: "Export note"
    });
    const deletedExpenseId = await createExpense(app, workspaceId, ownerEmail, {
      property_id: propertyId,
      description: "Deleted export expense",
      amount_cents: 99999,
      category: "general"
    });
    const deleteExpenseResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/expenses/${deletedExpenseId}`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(deleteExpenseResponse.statusCode, 200);

    await createExpense(app, otherWorkspaceId, ownerEmail, {
      property_id: otherPropertyId,
      description: "Other workspace export expense",
      amount_cents: 77777,
      category: "general"
    });

    const documentId = await createDocument(app, workspaceId, ownerEmail, {
      expense_id: expenseId,
      display_name: "Export receipt",
      document_type: "receipt",
      file_availability: "available"
    });
    const deletedDocumentId = await createDocument(app, workspaceId, ownerEmail, {
      property_id: propertyId,
      display_name: "Deleted export document",
      document_type: "permit"
    });
    const deleteDocumentResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/documents/${deletedDocumentId}`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(deleteDocumentResponse.statusCode, 200);

    const fileResult = await db.query(
      `
        INSERT INTO document_files (
          workspace_id,
          document_id,
          storage_provider,
          storage_key,
          original_file_name,
          mime_type,
          size_bytes,
          status
        )
        VALUES ($1, $2, 'test', 'private/export-receipt.pdf', 'export-receipt.pdf', 'application/pdf', 4321, 'available')
        RETURNING id
      `,
      [workspaceId, documentId]
    );
    await db.query(
      `
        INSERT INTO document_ocr (
          workspace_id,
          document_id,
          document_file_id,
          status,
          text,
          completed_at
        )
        VALUES ($1, $2, $3, 'succeeded', 'Sensitive export OCR text', now())
      `,
      [workspaceId, documentId, fileResult.rows[0].id]
    );

    const viewerSummary = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/exports/summary`,
      headers: authHeaders(viewerEmail)
    });
    assert.equal(viewerSummary.statusCode, 200);
    assert.equal(viewerSummary.json().data.workspace_id, workspaceId);
    assert.equal(viewerSummary.json().data.expense_count, 1);
    assert.equal(viewerSummary.json().data.total_expense_amount_cents, 12345);
    assert.equal(viewerSummary.json().data.text_available_document_count, 1);

    const expenseCsv = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/exports/expenses.csv`,
      headers: authHeaders(viewerEmail)
    });
    assert.equal(expenseCsv.statusCode, 200);
    assert.match(expenseCsv.headers["content-type"], /^text\/csv/);
    assert.match(expenseCsv.body, /^Export Source,Export Date,Property,/);
    assert.match(expenseCsv.body, /Export expense/);
    assert.match(expenseCsv.body, /123\.45,12345/);
    assert.doesNotMatch(expenseCsv.body, /Deleted export expense/);
    assert.doesNotMatch(expenseCsv.body, /Other workspace export expense/);

    const documentsCsv = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/exports/documents.csv`,
      headers: authHeaders(viewerEmail)
    });
    assert.equal(documentsCsv.statusCode, 200);
    assert.match(documentsCsv.body, /^document_id,title,document_type,document_date,/);
    assert.match(documentsCsv.body, /Export receipt/);
    assert.match(documentsCsv.body, /application\/pdf,4321,succeeded,true/);

    const fullJson = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/exports/full.json`,
      headers: authHeaders(viewerEmail)
    });
    assert.equal(fullJson.statusCode, 200);
    assert.match(fullJson.headers["content-disposition"], /^attachment; filename="home-ledger-full-\d{4}-\d{2}-\d{2}\.json"$/);
    const fullExport = fullJson.json().data;
    assert.equal(fullExport.app, "home-ledger");
    assert.equal(fullExport.exportType, "workspace-records");
    assert.equal(fullExport.exportSchemaVersion, 1);
    assert.equal(fullExport.workspace.id, workspaceId);
    const serialized = JSON.stringify(fullExport);
    assert.equal(serialized.includes("Export receipt"), true);
    assert.equal(serialized.includes("Sensitive export OCR text"), false);
    assert.equal(serialized.includes("private/export-receipt.pdf"), false);
    assert.equal(serialized.includes("storage_key"), false);
    assert.equal(serialized.includes("download_url"), false);
    assert.equal(serialized.includes("Deleted export document"), false);
    assert.equal(serialized.includes("Other workspace export expense"), false);

    const nonMemberResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/exports/summary`,
      headers: authHeaders(nonMemberEmail)
    });
    assert.equal(nonMemberResponse.statusCode, 404);

    const malformedResponse = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/not-a-uuid/exports/summary",
      headers: authHeaders(ownerEmail)
    });
    assert.equal(malformedResponse.statusCode, 400);

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

async function createExpense(app, workspaceId, email, payload) {
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${workspaceId}/expenses`,
    headers: authHeaders(email),
    payload: {
      category: "general",
      record_treatment: "review_later",
      documentation_status: "no_document_yet",
      ...payload
    }
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
