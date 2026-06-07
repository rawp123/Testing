import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from "../src/documents.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  DOCUMENT_FILE_IDS,
  DOCUMENT_IDS,
  PROPERTY_IDS,
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

const VALID_SHA = "a".repeat(64);

test("owner and editor can create document file upload intents", async () => {
  for (const [email, workspaceId, propertyId] of [
    ["owner@example.test", WORKSPACE_IDS.owner, PROPERTY_IDS.ownerPrimary],
    ["editor@example.test", WORKSPACE_IDS.editor, PROPERTY_IDS.editorPrimary]
  ]) {
    const db = createFakeWorkspaceDb(createSeededWorkspaceState());
    const app = buildApp({ config: createConfig(), db });

    const createDocumentResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents`,
      headers: authHeaders(email),
      payload: {
        property_id: propertyId,
        display_name: "Upload target",
        document_type: "receipt"
      }
    });
    assert.equal(createDocumentResponse.statusCode, 201);
    const documentId = createDocumentResponse.json().data.id;

    const intentResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/file-intent`,
      headers: authHeaders(email),
      payload: createFilePayload({
        original_file_name: "../Receipt.pdf"
      })
    });

    assert.equal(intentResponse.statusCode, 201);
    assert.equal(intentResponse.json().data.file.original_file_name, "Receipt.pdf");
    assert.equal(intentResponse.json().data.file.mime_type, "application/pdf");
    assert.equal(intentResponse.json().data.file.size_bytes, 2048);
    assert.equal(intentResponse.json().data.file.status, "pending_upload");
    assert.equal(intentResponse.json().data.upload_id, intentResponse.json().data.document_file_id);
    assert.equal(intentResponse.json().data.max_size_bytes, MAX_DOCUMENT_FILE_SIZE_BYTES);
    assertSafeFileResponse(intentResponse.json().data);

    await app.close();
  }
});

test("viewer can download accessible file metadata but cannot create complete or delete files", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const downloadResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/${DOCUMENT_IDS.viewerDocument}/file`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(downloadResponse.statusCode, 200);
  assert.equal(downloadResponse.json().data.id, DOCUMENT_FILE_IDS.viewerDocument);
  assert.equal(downloadResponse.json().data.download_available, true);
  assert.equal(downloadResponse.json().data.download_url, null);
  assertSafeFileResponse(downloadResponse.json().data);

  for (const request of [
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/${DOCUMENT_IDS.viewerDocument}/file-intent`,
      payload: createFilePayload()
    },
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/${DOCUMENT_IDS.viewerDocument}/file-complete`,
      payload: {
        document_file_id: DOCUMENT_FILE_IDS.viewerDocument,
        upload_id: DOCUMENT_FILE_IDS.viewerDocument,
        size_bytes: 4096
      }
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/${DOCUMENT_IDS.viewerDocument}/file`
    }
  ]) {
    const response = await app.inject({
      ...request,
      headers: authHeaders("viewer@example.test")
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "forbidden");
  }

  await app.close();
});

test("document file endpoints preserve workspace boundaries and validate ids", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const malformedResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/not-a-uuid/file-intent`,
    headers: authHeaders("owner@example.test"),
    payload: createFilePayload()
  });
  assert.equal(malformedResponse.statusCode, 400);

  for (const request of [
    {
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.viewerDocument}/file`,
      headers: authHeaders("owner@example.test")
    },
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.viewerDocument}/file-intent`,
      headers: authHeaders("owner@example.test"),
      payload: createFilePayload()
    },
    {
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/file`,
      headers: authHeaders("viewer@example.test")
    }
  ]) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 404);
  }

  await app.close();
});

test("document file validation rejects unsafe type size unknown and mismatched fields", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  for (const [payload, expectedStatus, expectedField] of [
    [createFilePayload({ mime_type: "application/x-msdownload", original_file_name: "setup.exe" }), 415, "mime_type"],
    [createFilePayload({ size_bytes: MAX_DOCUMENT_FILE_SIZE_BYTES + 1 }), 413, "size_bytes"],
    [createFilePayload({ sha256: "bad" }), 422, "sha256"],
    [{ ...createFilePayload(), originalFileName: "receipt.pdf" }, 422, "originalFileName"]
  ]) {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file-intent`,
      headers: authHeaders("owner@example.test"),
      payload
    });
    assert.equal(response.statusCode, expectedStatus);
    assert.equal(response.json().error.details[0].field, expectedField);
  }

  const intentResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file-intent`,
    headers: authHeaders("owner@example.test"),
    payload: createFilePayload()
  });
  assert.equal(intentResponse.statusCode, 201);

  const completeResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file-complete`,
    headers: authHeaders("owner@example.test"),
    payload: {
      document_file_id: intentResponse.json().data.document_file_id,
      upload_id: "00000000-0000-4000-8000-000000009999",
      size_bytes: 2048
    }
  });
  assert.equal(completeResponse.statusCode, 422);
  assert.equal(completeResponse.json().error.details[0].field, "upload_id");

  await app.close();
});

test("file-complete updates metadata and file delete detaches without deleting the document", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const intentResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file-intent`,
    headers: authHeaders("owner@example.test"),
    payload: createFilePayload({ sha256: VALID_SHA })
  });
  assert.equal(intentResponse.statusCode, 201);
  const documentFileId = intentResponse.json().data.document_file_id;

  const completeResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file-complete`,
    headers: authHeaders("owner@example.test"),
    payload: {
      document_file_id: documentFileId,
      upload_id: documentFileId,
      size_bytes: 2048,
      sha256: VALID_SHA
    }
  });
  assert.equal(completeResponse.statusCode, 200);
  assert.equal(completeResponse.json().data.status, "available");
  assert.equal(completeResponse.json().data.sha256, VALID_SHA);
  assertSafeFileResponse(completeResponse.json().data);

  const documentResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(documentResponse.json().data.file_availability, "available");
  assert.equal(documentResponse.json().data.file.id, documentFileId);

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(deleteResponse.json().data.status, "deleted");
  assert.equal(deleteResponse.json().data.cleanup_deferred, true);

  const afterDeleteDocument = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(afterDeleteDocument.statusCode, 200);
  assert.equal(afterDeleteDocument.json().data.file_availability, "removed");
  assert.equal(afterDeleteDocument.json().data.file_status_note, "File removed.");
  assert.equal(afterDeleteDocument.json().data.file, null);
  assert.notEqual(db.documents.get(DOCUMENT_IDS.ownerKitchenInvoice), undefined);

  await app.close();
});

test("available files can be replaced and deleted documents cannot issue file intents", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({
    config: createConfig(),
    db
  });

  const intentResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/file-intent`,
    headers: authHeaders("owner@example.test"),
    payload: createFilePayload({
      original_file_name: "replacement.pdf",
      size_bytes: 3072
    })
  });
  assert.equal(intentResponse.statusCode, 201);
  const replacementFileId = intentResponse.json().data.document_file_id;

  const completeResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/file-complete`,
    headers: authHeaders("owner@example.test"),
    payload: {
      document_file_id: replacementFileId,
      upload_id: replacementFileId,
      size_bytes: 3072
    }
  });
  assert.equal(completeResponse.statusCode, 200);
  assert.equal(db.documentFiles.get(DOCUMENT_FILE_IDS.ownerDeckReceipt).status, "deleted");
  assert.equal(db.documentFiles.get(replacementFileId).status, "available");

  const deletedResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeleted}/file-intent`,
    headers: authHeaders("owner@example.test"),
    payload: createFilePayload()
  });
  assert.equal(deletedResponse.statusCode, 404);

  await app.close();
});

test("S3 storage returns signed URLs only from file lifecycle endpoints", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({
    config: createConfig({
      fileStorageDriver: "s3",
      fileStorage: {
        driver: "s3",
        bucket: "home-ledger-documents",
        region: "us-east-1",
        endpoint: "https://storage.example.test",
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
        forcePathStyle: true,
        uploadUrlTtlSeconds: 120,
        downloadUrlTtlSeconds: 60
      }
    }),
    db
  });

  const intentResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file-intent`,
    headers: authHeaders("owner@example.test"),
    payload: createFilePayload()
  });
  assert.equal(intentResponse.statusCode, 201);
  assert.equal(intentResponse.json().data.upload_method, "signed_url_put");
  assert.match(intentResponse.json().data.upload_url, /^https:\/\/storage\.example\.test\//);
  assert.equal(intentResponse.json().data.upload_token, null);
  assertSafeSignedUrlResponse(intentResponse.json().data);
  const documentFileId = intentResponse.json().data.document_file_id;

  const completeResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file-complete`,
    headers: authHeaders("owner@example.test"),
    payload: {
      document_file_id: documentFileId,
      upload_id: documentFileId,
      size_bytes: 2048
    }
  });
  assert.equal(completeResponse.statusCode, 200);
  assert.equal(Object.hasOwn(completeResponse.json().data, "download_url"), false);
  assertSafeFileResponse(completeResponse.json().data);

  const fileResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(fileResponse.statusCode, 200);
  assert.equal(fileResponse.json().data.download_available, true);
  assert.match(fileResponse.json().data.download_url, /^https:\/\/storage\.example\.test\//);
  assertSafeSignedUrlResponse(fileResponse.json().data);

  const documentResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(documentResponse.statusCode, 200);
  assert.equal(documentResponse.json().data.file.id, documentFileId);
  assert.equal(Object.hasOwn(documentResponse.json().data.file, "download_url"), false);
  assertSafeFileResponse(documentResponse.json().data);

  await app.close();
});

function createFilePayload(overrides = {}) {
  return {
    original_file_name: "receipt.pdf",
    mime_type: "application/pdf",
    size_bytes: 2048,
    sha256: null,
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
    ...overrides
  };
}

function assertSafeFileResponse(value) {
  const text = JSON.stringify(value);
  for (const unsafe of [
    "storage_key",
    "storageKey",
    "object_key",
    "objectStorageKey",
    "bucket",
    "local_path",
    "file_path",
    "private/",
    "workspaces/"
  ]) {
    assert.equal(text.includes(unsafe), false, `${unsafe} should not be exposed`);
  }
}

function assertSafeSignedUrlResponse(value) {
  const text = JSON.stringify(value);
  for (const unsafe of [
    "storage_key",
    "storageKey",
    "object_key",
    "objectStorageKey",
    "local_path",
    "file_path",
    "test-secret-key",
    "secretAccessKey"
  ]) {
    assert.equal(text.includes(unsafe), false, `${unsafe} should not be exposed`);
  }
  for (const url of [value.upload_url, value.download_url].filter(Boolean)) {
    assert.equal(url.includes(WORKSPACE_IDS.owner), false, "signed URL should not include raw workspace id");
    assert.equal(url.includes(DOCUMENT_IDS.ownerKitchenInvoice), false, "signed URL should not include raw document id");
  }
}
