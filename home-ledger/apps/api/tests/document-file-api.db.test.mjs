import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";
const VALID_SHA = "b".repeat(64);

test("DB-backed Document File API persists safe upload and detach lifecycle", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ownerEmail = `document_file_owner_${suffix}@example.test`;
  const viewerEmail = `document_file_viewer_${suffix}@example.test`;
  const nonMemberEmail = `document_file_nonmember_${suffix}@example.test`;
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
        name: `Document File DB ${suffix}`
      }
    });
    assert.equal(workspaceResponse.statusCode, 201);
    workspaceId = workspaceResponse.json().data.id;

    const propertyResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(ownerEmail),
      payload: {
        name: "File property"
      }
    });
    assert.equal(propertyResponse.statusCode, 201);

    const documentResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents`,
      headers: authHeaders(ownerEmail),
      payload: {
        property_id: propertyResponse.json().data.id,
        display_name: "File document",
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

    const viewerIntentResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file-intent`,
      headers: authHeaders(viewerEmail),
      payload: createFilePayload()
    });
    assert.equal(viewerIntentResponse.statusCode, 403);

    const nonMemberDownloadResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file`,
      headers: authHeaders(nonMemberEmail)
    });
    assert.equal(nonMemberDownloadResponse.statusCode, 404);

    const intentResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file-intent`,
      headers: authHeaders(ownerEmail),
      payload: createFilePayload()
    });
    assert.equal(intentResponse.statusCode, 201);
    documentFileId = intentResponse.json().data.document_file_id;
    assert.equal(intentResponse.json().data.file.status, "pending_upload");
    assert.equal(intentResponse.json().data.upload_id, documentFileId);
    assertSafeResponse(intentResponse.json().data);

    const pendingFile = await db.query(
      "SELECT storage_key, status FROM document_files WHERE id = $1",
      [documentFileId]
    );
    assert.equal(pendingFile.rows[0].status, "pending_upload");
    assert.match(pendingFile.rows[0].storage_key, /^workspaces\//);

    const completeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file-complete`,
      headers: authHeaders(ownerEmail),
      payload: {
        document_file_id: documentFileId,
        upload_id: documentFileId,
        size_bytes: 4096,
        sha256: VALID_SHA
      }
    });
    assert.equal(completeResponse.statusCode, 200);
    assert.equal(completeResponse.json().data.status, "available");
    assert.equal(completeResponse.json().data.sha256, VALID_SHA);
    assertSafeResponse(completeResponse.json().data);

    const viewerDownloadResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file`,
      headers: authHeaders(viewerEmail)
    });
    assert.equal(viewerDownloadResponse.statusCode, 200);
    assert.equal(viewerDownloadResponse.json().data.id, documentFileId);
    assert.equal(viewerDownloadResponse.json().data.download_available, true);
    assertSafeResponse(viewerDownloadResponse.json().data);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file`,
      headers: authHeaders(ownerEmail)
    });
    assert.equal(deleteResponse.statusCode, 200);
    assert.equal(deleteResponse.json().data.status, "deleted");
    assert.equal(deleteResponse.json().data.cleanup_deferred, true);
    assertSafeResponse(deleteResponse.json().data);

    const dbState = await db.query(
      `
        SELECT d.file_availability,
               d.file_status_note,
               df.status,
               df.deleted_at
        FROM documents d
        JOIN document_files df
          ON df.workspace_id = d.workspace_id
         AND df.document_id = d.id
        WHERE d.id = $1
          AND df.id = $2
      `,
      [documentId, documentFileId]
    );
    assert.equal(dbState.rows[0].file_availability, "removed");
    assert.equal(dbState.rows[0].file_status_note, "File removed.");
    assert.equal(dbState.rows[0].status, "deleted");
    assert.notEqual(dbState.rows[0].deleted_at, null);

    const downloadAfterDelete = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file`,
      headers: authHeaders(viewerEmail)
    });
    assert.equal(downloadAfterDelete.statusCode, 404);

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

function createFilePayload(overrides = {}) {
  return {
    original_file_name: "receipt.pdf",
    mime_type: "application/pdf",
    size_bytes: 4096,
    sha256: VALID_SHA,
    source: "web_upload",
    ...overrides
  };
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
    dbPoolMax: 2,
    ...overrides
  };
}

function assertSafeResponse(value) {
  const text = JSON.stringify(value);
  for (const unsafe of [
    "storage_key",
    "storageKey",
    "private/",
    "workspaces/",
    "object_key",
    "local_path",
    "file_path"
  ]) {
    assert.equal(text.includes(unsafe), false, `${unsafe} should not be exposed`);
  }
}
