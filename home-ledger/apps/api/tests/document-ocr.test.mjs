import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  DOCUMENT_FILE_IDS,
  DOCUMENT_IDS,
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

test("owner and editor can request OCR for available document files", async () => {
  for (const [email, workspaceId, documentId, documentFileId] of [
    ["owner@example.test", WORKSPACE_IDS.owner, DOCUMENT_IDS.ownerDeckReceipt, DOCUMENT_FILE_IDS.ownerDeckReceipt],
    ["editor@example.test", WORKSPACE_IDS.editor, DOCUMENT_IDS.editorDocument, DOCUMENT_FILE_IDS.editorDocument]
  ]) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}/ocr`,
      headers: authHeaders(email)
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.document_id, documentId);
    assert.equal(response.json().data.document_file_id, documentFileId);
    assert.equal(response.json().data.ocr_status, "succeeded");
    assert.equal(response.json().data.text_available, true);
    assert.equal(response.json().data.engine, "fake");
    assert.equal(Object.hasOwn(response.json().data, "text"), false);

    await app.close();
  }
});

test("viewer can read OCR status and text but cannot request OCR", async () => {
  const state = createSeededWorkspaceState();
  state.documentOcr = [
    {
      workspace_id: WORKSPACE_IDS.viewer,
      document_id: DOCUMENT_IDS.viewerDocument,
      document_file_id: DOCUMENT_FILE_IDS.viewerDocument,
      status: "succeeded",
      text: "Viewer OCR text",
      engine: "fake",
      started_at: "2026-06-06T12:30:00.000Z",
      completed_at: "2026-06-06T12:31:00.000Z"
    }
  ];
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(state)
  });

  const requestResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/${DOCUMENT_IDS.viewerDocument}/ocr`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(requestResponse.statusCode, 403);

  const statusResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/${DOCUMENT_IDS.viewerDocument}/ocr`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().data.ocr_status, "succeeded");
  assert.equal(statusResponse.json().data.text_available, true);
  assert.equal(Object.hasOwn(statusResponse.json().data, "text"), false);

  const textResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/${DOCUMENT_IDS.viewerDocument}/text`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(textResponse.statusCode, 200);
  assert.equal(textResponse.json().data.text, "Viewer OCR text");
  assert.equal(textResponse.json().data.ocr_status, "succeeded");

  await app.close();
});

test("OCR endpoints preserve workspace boundaries and validate ids", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const malformedResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/not-a-uuid/ocr`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(malformedResponse.statusCode, 400);

  for (const request of [
    {
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.viewerDocument}/ocr`,
      headers: authHeaders("owner@example.test")
    },
    {
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/text`,
      headers: authHeaders("viewer@example.test")
    },
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.viewerDocument}/ocr`,
      headers: authHeaders("owner@example.test")
    }
  ]) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 404);
  }

  await app.close();
});

test("OCR request is rejected when no available file exists", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/ocr`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "conflict");

  const textResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/text`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(textResponse.statusCode, 404);

  await app.close();
});

test("normal document metadata excludes raw OCR text", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const ocrResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(ocrResponse.statusCode, 200);

  const documentResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(documentResponse.statusCode, 200);
  assert.equal(documentResponse.json().data.ocr.status, "succeeded");
  assert.equal(documentResponse.json().data.ocr.has_text, true);
  assert.equal(JSON.stringify(documentResponse.json().data).includes("Extracted text from"), false);
  assert.equal(Object.hasOwn(documentResponse.json().data, "text"), false);

  await app.close();
});

test("file replacement and removal hide old OCR text", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const ocrResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(ocrResponse.statusCode, 200);

  const initialText = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/text`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(initialText.statusCode, 200);

  const intentResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/file-intent`,
    headers: authHeaders("owner@example.test"),
    payload: {
      original_file_name: "replacement.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048
    }
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
      size_bytes: 2048
    }
  });
  assert.equal(completeResponse.statusCode, 200);

  const staleText = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/text`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(staleText.statusCode, 404);

  const statusAfterReplace = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(statusAfterReplace.statusCode, 200);
  assert.equal(statusAfterReplace.json().data.ocr_status, "not_requested");
  assert.equal(statusAfterReplace.json().data.text_available, false);

  const rerunResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(rerunResponse.statusCode, 200);
  assert.equal(rerunResponse.json().data.text_available, true);

  const deleteFileResponse = await app.inject({
    method: "DELETE",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/file`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(deleteFileResponse.statusCode, 200);

  const removedText = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/text`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(removedText.statusCode, 404);

  const statusAfterRemoval = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(statusAfterRemoval.statusCode, 200);
  assert.equal(statusAfterRemoval.json().data.ocr_status, "skipped");
  assert.equal(statusAfterRemoval.json().data.text_available, false);
  assert.equal(statusAfterRemoval.json().data.failure_reason, "File removed.");

  await app.close();
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
    fileStorageDriver: "test",
    ocrMode: "fake",
    ...overrides
  };
}
