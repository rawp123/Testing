import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";

test("DB-backed Document OCR API persists status text and hides text after file removal", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ownerEmail = `document_ocr_owner_${suffix}@example.test`;
  const viewerEmail = `document_ocr_viewer_${suffix}@example.test`;
  const nonMemberEmail = `document_ocr_nonmember_${suffix}@example.test`;
  let workspaceId;
  let documentId;
  let documentFileId;

  try {
    const app = buildApp({
      config: createConfig({ databaseUrl }),
      db
    });

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: authHeaders(ownerEmail),
      payload: {
        name: `Document OCR DB ${suffix}`
      }
    });
    assert.equal(workspaceResponse.statusCode, 201);
    workspaceId = workspaceResponse.json().data.id;

    const propertyResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(ownerEmail),
      payload: {
        name: "OCR property"
      }
    });
    assert.equal(propertyResponse.statusCode, 201);

    const documentResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents`,
      headers: authHeaders(ownerEmail),
      payload: {
        property_id: propertyResponse.json().data.id,
        display_name: "OCR document",
        document_type: "receipt"
      }
    });
    assert.equal(documentResponse.statusCode, 201);
    documentId = documentResponse.json().data.id;

    const viewer = await createUser(db, viewerEmail, "Viewer");
    await db.query(
      `
        INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
        VALUES ($1, $2, 'viewer', 'active')
      `,
      [workspaceId, viewer.id]
    );

    const noFileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/ocr`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(noFileResponse.statusCode, 409);

    const intentResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file-intent`,
      headers: authHeaders(ownerEmail),
      payload: {
        original_file_name: "ocr-receipt.pdf",
        mime_type: "application/pdf",
        size_bytes: 4096
      }
    });
    assert.equal(intentResponse.statusCode, 201);
    documentFileId = intentResponse.json().data.document_file_id;

    const completeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file-complete`,
      headers: authHeaders(ownerEmail),
      payload: {
        document_file_id: documentFileId,
        upload_id: documentFileId,
        size_bytes: 4096
      }
    });
    assert.equal(completeResponse.statusCode, 200);

    const viewerRequestResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/ocr`,
      headers: authHeaders(viewerEmail)
    });
    assert.equal(viewerRequestResponse.statusCode, 403);

    const ocrResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/ocr`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(ocrResponse.statusCode, 200);
    assert.equal(ocrResponse.json().data.ocr_status, "succeeded");
    assert.equal(ocrResponse.json().data.text_available, true);
    assert.equal(Object.hasOwn(ocrResponse.json().data, "text"), false);

    const dbOcr = await db.query(
      "SELECT status, text, text_sha256, document_file_id FROM document_ocr WHERE document_id = $1",
      [documentId]
    );
    assert.equal(dbOcr.rows[0].status, "succeeded");
    assert.equal(dbOcr.rows[0].text, "Extracted text from ocr-receipt.pdf.");
    assert.match(dbOcr.rows[0].text_sha256, /^[a-f0-9]{64}$/);
    assert.equal(dbOcr.rows[0].document_file_id, documentFileId);

    const viewerTextResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/text`,
      headers: authHeaders(viewerEmail)
    });
    assert.equal(viewerTextResponse.statusCode, 200);
    assert.equal(viewerTextResponse.json().data.text, "Extracted text from ocr-receipt.pdf.");

    const nonMemberStatus = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/ocr`,
      headers: authHeaders(nonMemberEmail)
    });
    assert.equal(nonMemberStatus.statusCode, 404);

    const documentDetail = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(documentDetail.statusCode, 200);
    assert.equal(documentDetail.json().data.ocr.has_text, true);
    assert.equal(JSON.stringify(documentDetail.json().data).includes("Extracted text from"), false);

    const deleteFileResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(deleteFileResponse.statusCode, 200);

    const textAfterRemoval = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/text`,
      headers: authHeaders(viewerEmail)
    });
    assert.equal(textAfterRemoval.statusCode, 404);

    const statusAfterRemoval = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/ocr`,
      headers: authHeaders(viewerEmail)
    });
    assert.equal(statusAfterRemoval.statusCode, 200);
    assert.equal(statusAfterRemoval.json().data.ocr_status, "skipped");
    assert.equal(statusAfterRemoval.json().data.text_available, false);

    await app.close();
  } finally {
    if (workspaceId) {
      await db.query("DELETE FROM workspaces WHERE id = $1", [workspaceId]);
    }
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
    fileStorageDriver: "test",
    ocrMode: "fake",
    dbPoolMax: 2,
    ...overrides
  };
}
