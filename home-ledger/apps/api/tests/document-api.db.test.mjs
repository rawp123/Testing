import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";

test("DB-backed Document API validates relationships and soft deletes documents", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const email = `document_owner_${suffix}@example.test`;
  let workspaceId;
  let propertyId;
  let secondPropertyId;
  let vendorId;
  let projectId;
  let secondProjectId;
  let expenseId;
  let documentId;

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
        name: `Document DB ${suffix}`
      }
    });
    assert.equal(workspaceResponse.statusCode, 201);
    workspaceId = workspaceResponse.json().data.id;

    const propertyResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(email),
      payload: {
        name: "Document property"
      }
    });
    assert.equal(propertyResponse.statusCode, 201);
    propertyId = propertyResponse.json().data.id;

    const secondPropertyResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(email),
      payload: {
        name: "Second document property"
      }
    });
    assert.equal(secondPropertyResponse.statusCode, 201);
    secondPropertyId = secondPropertyResponse.json().data.id;

    const vendorResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/vendors`,
      headers: authHeaders(email),
      payload: {
        name: "Document vendor"
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
        name: "Document project",
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
        name: "Second document project",
        category: "general"
      }
    });
    assert.equal(secondProjectResponse.statusCode, 201);
    secondProjectId = secondProjectResponse.json().data.id;

    const expenseResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/expenses`,
      headers: authHeaders(email),
      payload: {
        property_id: propertyId,
        project_id: projectId,
        vendor_id: vendorId,
        vendor_name_raw: "Document vendor",
        expense_date: "2026-06-04",
        description: "Document expense",
        amount_cents: 68000,
        category: "general"
      }
    });
    assert.equal(expenseResponse.statusCode, 201);
    expenseId = expenseResponse.json().data.id;

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents`,
      headers: authHeaders(email),
      payload: {
        expense_id: expenseId,
        display_name: "DB document",
        document_type: "receipt",
        document_date: "2026-06-05",
        file_availability: "not_uploaded"
      }
    });
    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().data.property_id, propertyId);
    assert.equal(createResponse.json().data.project_id, projectId);
    assert.equal(createResponse.json().data.expense_id, expenseId);
    assert.equal(createResponse.json().data.property_name, "Document property");
    assert.equal(createResponse.json().data.project_name, "Document project");
    assert.equal(createResponse.json().data.expense_description, "Document expense");
    assert.equal(createResponse.json().data.file, null);
    assert.deepEqual(createResponse.json().data.ocr, {
      status: "not_requested",
      has_text: false,
      completed_at: null
    });
    assert.equal(createResponse.json().data.open_item_count, 1);
    documentId = createResponse.json().data.id;

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
        VALUES ($1, $2, 'test', 'private/object/key.pdf', 'receipt.pdf', 'application/pdf', 1234, 'available')
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
        VALUES ($1, $2, $3, 'succeeded', 'Recognized text', now())
      `,
      [workspaceId, documentId, fileResult.rows[0].id]
    );

    const detailResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}`,
      headers: authHeaders(email)
    });
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.json().data.file.original_file_name, "receipt.pdf");
    assert.equal(detailResponse.json().data.file.mime_type, "application/pdf");
    assert.equal(detailResponse.json().data.file.size_bytes, 1234);
    assert.equal(detailResponse.json().data.ocr.status, "succeeded");
    assert.equal(detailResponse.json().data.ocr.has_text, true);
    assert.equal(detailResponse.json().data.open_item_count, 0);
    assert.equal(JSON.stringify(detailResponse.json().data).includes("private/object/key.pdf"), false);
    assert.equal(JSON.stringify(detailResponse.json().data).includes("Recognized text"), false);

    const mismatchResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents`,
      headers: authHeaders(email),
      payload: {
        property_id: propertyId,
        project_id: secondProjectId,
        display_name: "Bad document",
        document_type: "receipt"
      }
    });
    assert.equal(mismatchResponse.statusCode, 400);
    assert.deepEqual(mismatchResponse.json().error.details[0], {
      field: "project_id",
      issue: "property_mismatch"
    });

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}`,
      headers: authHeaders(email),
      payload: {
        property_id: secondPropertyId,
        project_id: secondProjectId,
        expense_id: null,
        file_availability: "missing",
        file_status_note: "Imported without file content."
      }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().data.property_id, secondPropertyId);
    assert.equal(updateResponse.json().data.project_id, secondProjectId);
    assert.equal(updateResponse.json().data.expense_id, null);
    assert.equal(updateResponse.json().data.file_availability, "missing");
    assert.equal(updateResponse.json().data.file_status_note, "Imported without file content.");
    assert.equal(updateResponse.json().data.open_item_count, 0);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}`,
      headers: authHeaders(email)
    });
    assert.equal(deleteResponse.statusCode, 200);
    assert.equal(deleteResponse.json().data.open_item_count, 0);
    assert.notEqual(deleteResponse.json().data.deleted_at, null);

    const deletedRow = await db.query(
      "SELECT deleted_at, file_availability FROM documents WHERE id = $1",
      [documentId]
    );
    assert.notEqual(deletedRow.rows[0].deleted_at, null);
    assert.equal(deletedRow.rows[0].file_availability, "missing");

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/documents`,
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
