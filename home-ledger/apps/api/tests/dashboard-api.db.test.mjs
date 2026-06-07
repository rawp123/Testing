import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";

test("DB-backed Dashboard API summarizes workspace records without leaking file or OCR internals", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ownerEmail = `dashboard_owner_${suffix}@example.test`;
  const nonMemberEmail = `dashboard_nonmember_${suffix}@example.test`;
  let workspaceId;
  let otherWorkspaceId;

  try {
    const app = buildApp({
      config: createConfig({ databaseUrl }),
      db
    });

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: authHeaders(ownerEmail),
      payload: { name: `Dashboard DB ${suffix}` }
    });
    assert.equal(workspaceResponse.statusCode, 201);
    workspaceId = workspaceResponse.json().data.id;

    const otherWorkspaceResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: authHeaders(ownerEmail),
      payload: { name: `Other dashboard DB ${suffix}` }
    });
    assert.equal(otherWorkspaceResponse.statusCode, 201);
    otherWorkspaceId = otherWorkspaceResponse.json().data.id;

    const propertyId = await createProperty(app, workspaceId, ownerEmail, "Main property");
    const archivedPropertyId = await createProperty(app, workspaceId, ownerEmail, "Archived property");
    const archivePropertyResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/properties/${archivedPropertyId}`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(archivePropertyResponse.statusCode, 200);

    const otherPropertyId = await createProperty(app, otherWorkspaceId, ownerEmail, "Other property");

    const vendorResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/vendors`,
      headers: authHeaders(ownerEmail),
      payload: { name: "Dashboard Vendor" }
    });
    assert.equal(vendorResponse.statusCode, 201);
    const vendorId = vendorResponse.json().data.id;

    const archivedVendorResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/vendors`,
      headers: authHeaders(ownerEmail),
      payload: { name: "Archived Dashboard Vendor", status: "archived" }
    });
    assert.equal(archivedVendorResponse.statusCode, 201);

    const projectResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/projects`,
      headers: authHeaders(ownerEmail),
      payload: {
        property_id: propertyId,
        vendor_id: vendorId,
        name: "Dashboard project",
        category: "general",
        status: "in_progress"
      }
    });
    assert.equal(projectResponse.statusCode, 201);
    const projectId = projectResponse.json().data.id;

    const archivedProjectResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/projects`,
      headers: authHeaders(ownerEmail),
      payload: {
        property_id: propertyId,
        name: "Archived dashboard project",
        category: "general",
        status: "planned"
      }
    });
    assert.equal(archivedProjectResponse.statusCode, 201);
    const archiveProjectResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/projects/${archivedProjectResponse.json().data.id}`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(archiveProjectResponse.statusCode, 200);

    const repairExpenseId = await createExpense(app, workspaceId, ownerEmail, {
      property_id: propertyId,
      project_id: projectId,
      vendor_id: vendorId,
      description: "Repair supplies",
      amount_cents: 12500,
      category: "general",
      record_treatment: "repair_upkeep",
      documentation_status: "needs_follow_up"
    });
    await createExpense(app, workspaceId, ownerEmail, {
      property_id: propertyId,
      project_id: projectId,
      vendor_id: vendorId,
      description: "Possible improvement work",
      amount_cents: 45000,
      category: "general",
      record_treatment: "possible_improvement",
      documentation_status: "invoice_attached"
    });
    const deletedExpenseId = await createExpense(app, workspaceId, ownerEmail, {
      property_id: propertyId,
      description: "Deleted dashboard expense",
      amount_cents: 99999,
      category: "general",
      record_treatment: "review_later",
      documentation_status: "no_document_yet"
    });
    const deleteExpenseResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/expenses/${deletedExpenseId}`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(deleteExpenseResponse.statusCode, 200);

    await createExpense(app, otherWorkspaceId, ownerEmail, {
      property_id: otherPropertyId,
      description: "Other workspace expense",
      amount_cents: 77777,
      category: "general"
    });

    const receiptDocumentId = await createDocument(app, workspaceId, ownerEmail, {
      expense_id: repairExpenseId,
      display_name: "Repair receipt",
      document_type: "receipt",
      file_availability: "available"
    });
    const invoiceDocumentId = await createDocument(app, workspaceId, ownerEmail, {
      property_id: propertyId,
      project_id: projectId,
      display_name: "Missing invoice",
      document_type: "invoice",
      file_availability: "not_uploaded"
    });
    const deletedDocumentId = await createDocument(app, workspaceId, ownerEmail, {
      property_id: propertyId,
      display_name: "Deleted dashboard document",
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
        VALUES ($1, $2, 'test', 'private/dashboard-repair-receipt.pdf', 'repair-receipt.pdf', 'application/pdf', 1234, 'available')
        RETURNING id
      `,
      [workspaceId, receiptDocumentId]
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
        VALUES ($1, $2, $3, 'succeeded', 'Sensitive dashboard OCR text', now())
      `,
      [workspaceId, receiptDocumentId, fileResult.rows[0].id]
    );
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
      [workspaceId, invoiceDocumentId]
    );

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/dashboard`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(response.statusCode, 200);
    const data = response.json().data;
    assert.equal(data.workspace_id, workspaceId);
    assert.deepEqual(data.properties, { count: 2, active_count: 1, archived_count: 1 });
    assert.equal(data.projects.count, 2);
    assert.equal(data.projects.active_count, 1);
    assert.equal(data.projects.archived_count, 1);
    assert.deepEqual(data.expenses.by_classification, [
      { record_treatment: "possible_improvement", count: 1, total_amount_cents: 45000 },
      { record_treatment: "repair_upkeep", count: 1, total_amount_cents: 12500 }
    ]);
    assert.equal(data.expenses.count, 2);
    assert.equal(data.expenses.total_amount_cents, 57500);
    assert.equal(data.documents.count, 2);
    assert.equal(data.documents.with_file_count, 1);
    assert.equal(data.documents.missing_file_count, 1);
    assert.equal(data.documents.ocr_text_available_count, 1);
    assert.equal(data.documents.ocr_pending_count, 1);
    assert.equal(data.vendors.count, 1);
    assert.deepEqual(data.follow_ups, [
      { type: "document_items", label: "Document items", count: 1 },
      { type: "expense_items", label: "Expense items", count: 1 },
      { type: "project_items", label: "Project items", count: 3 },
      { type: "property_items", label: "Property items", count: 2 }
    ]);
    assert.equal(JSON.stringify(data).includes("Other workspace expense"), false);
    assert.equal(JSON.stringify(data).includes("Deleted dashboard expense"), false);
    assert.equal(JSON.stringify(data).includes("Deleted dashboard document"), false);
    assert.equal(JSON.stringify(data).includes("Sensitive dashboard OCR text"), false);
    assert.equal(JSON.stringify(data).includes("private/dashboard-repair-receipt.pdf"), false);

    const nonMemberResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/dashboard`,
      headers: authHeaders(nonMemberEmail)
    });
    assert.equal(nonMemberResponse.statusCode, 404);

    const malformedResponse = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/not-a-uuid/dashboard",
      headers: authHeaders(ownerEmail)
    });
    assert.equal(malformedResponse.statusCode, 400);

    await app.close();
  } finally {
    await db.query("DELETE FROM workspaces WHERE id = ANY($1::uuid[])", [
      [workspaceId, otherWorkspaceId].filter(Boolean)
    ]);
    await db.query("DELETE FROM users WHERE email = ANY($1::text[])", [
      [ownerEmail, nonMemberEmail]
    ]);
    await db.end();
  }
});

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
