import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { createFileStorageAdapter } from "../src/file-storage.js";
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

test("local PDF OCR mode skips safely when API storage bytes are unavailable", async () => {
  const app = buildApp({
    config: createConfig({ ocrMode: "local_pdf" }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, {
    document_id: DOCUMENT_IDS.ownerDeckReceipt,
    document_file_id: DOCUMENT_FILE_IDS.ownerDeckReceipt,
    ocr_status: "skipped",
    ocr_requested_at: response.json().data.ocr_requested_at,
    ocr_completed_at: response.json().data.ocr_completed_at,
    text_available: false,
    engine: "local_pdf",
    failure_reason: "Document bytes are not available to local OCR."
  });
  assert.equal(typeof response.json().data.ocr_requested_at, "string");
  assert.equal(typeof response.json().data.ocr_completed_at, "string");
  assert.equal(Object.hasOwn(response.json().data, "text"), false);
  for (const blocked of ["private/owner-deck-receipt.pdf", "cedarline-receipt.pdf", "Extracted text"]) {
    assert.doesNotMatch(response.body, new RegExp(escapeRegExp(blocked), "i"));
  }

  const textResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/text`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(textResponse.statusCode, 404);

  await app.close();
});

test("local PDF OCR extracts uploaded PDF bytes from local storage through explicit text endpoint only", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const fileStorage = createFileStorageAdapter({ driver: "test" });
  const app = buildApp({
    config: createConfig({ ocrMode: "local_pdf" }),
    db,
    fileStorage
  });

  const pdfBytes = createTextPdf("Roof estimate total 456");
  const intentResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file-intent`,
    headers: authHeaders("owner@example.test"),
    payload: {
      original_file_name: "roof-estimate.pdf",
      mime_type: "application/pdf",
      size_bytes: pdfBytes.byteLength,
      sha256: null,
      source: "web_upload"
    }
  });
  assert.equal(intentResponse.statusCode, 201);
  const documentFileId = intentResponse.json().data.document_file_id;
  const storageKey = db.documentFiles.get(documentFileId).storage_key;
  const uploadResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/files/${documentFileId}/upload?upload_id=${documentFileId}`,
    headers: {
      ...authHeaders("owner@example.test"),
      "content-type": "application/pdf"
    },
    payload: pdfBytes
  });
  assert.equal(uploadResponse.statusCode, 200);
  assert.equal(uploadResponse.json().data.upload_stored, true);

  const completeResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/file-complete`,
    headers: authHeaders("owner@example.test"),
    payload: {
      document_file_id: documentFileId,
      upload_id: documentFileId,
      size_bytes: pdfBytes.byteLength
    }
  });
  assert.equal(completeResponse.statusCode, 200);

  const ocrResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/ocr`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(ocrResponse.statusCode, 200);
  assert.equal(ocrResponse.json().data.document_id, DOCUMENT_IDS.ownerKitchenInvoice);
  assert.equal(ocrResponse.json().data.document_file_id, documentFileId);
  assert.equal(ocrResponse.json().data.ocr_status, "succeeded");
  assert.equal(ocrResponse.json().data.text_available, true);
  assert.equal(ocrResponse.json().data.engine, "local_pdf");
  assert.equal(ocrResponse.json().data.failure_reason, null);
  assert.equal(Object.hasOwn(ocrResponse.json().data, "text"), false);

  const documentResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(documentResponse.statusCode, 200);
  assert.equal(documentResponse.json().data.ocr.status, "succeeded");
  assert.equal(documentResponse.json().data.ocr.has_text, true);
  assert.equal(JSON.stringify(documentResponse.json().data).includes("Roof estimate total 456"), false);

  const textResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}/text`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(textResponse.statusCode, 200);
  assert.equal(textResponse.json().data.text, "Roof estimate total 456");
  assert.equal(textResponse.json().data.ocr_status, "succeeded");

  for (const blocked of [storageKey, "roof-estimate.pdf", "workspaces/"]) {
    assert.doesNotMatch(ocrResponse.body, new RegExp(escapeRegExp(blocked), "i"));
  }
  for (const blocked of [storageKey, "workspaces/"]) {
    assert.doesNotMatch(documentResponse.body, new RegExp(escapeRegExp(blocked), "i"));
  }

  await app.close();
});

test("disabled OCR mode records queued status without extracting text", async () => {
  const app = buildApp({
    config: createConfig({ ocrMode: "disabled" }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.ocr_status, "queued");
  assert.equal(response.json().data.text_available, false);
  assert.equal(response.json().data.ocr_completed_at, null);
  assert.equal(response.json().data.failure_reason, null);
  assert.equal(Object.hasOwn(response.json().data, "text"), false);

  const documentResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(documentResponse.statusCode, 200);
  assert.equal(documentResponse.json().data.ocr.status, "queued");
  assert.equal(documentResponse.json().data.ocr.has_text, false);
  assert.equal(JSON.stringify(documentResponse.json().data).includes("Extracted text"), false);

  const textResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/text`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(textResponse.statusCode, 404);

  await app.close();
});

test("OCR provider failures are sanitized and retry clears stale failure state", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  let calls = 0;
  const ocrProvider = {
    mode: "throwing-test",
    async requestText() {
      calls += 1;
      if (calls === 1) {
        throw new Error("private provider failure at /Users/owner/receipt.pdf using storage_key secret");
      }
      return {
        status: "succeeded",
        text: "Recovered OCR text",
        engine: "throwing-test",
        errorCode: null,
        errorMessage: null
      };
    }
  };
  const app = buildApp({
    config: createConfig(),
    db,
    ocrProvider
  });

  const failedResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(failedResponse.statusCode, 200);
  assert.equal(failedResponse.json().data.ocr_status, "failed");
  assert.equal(failedResponse.json().data.text_available, false);
  assert.equal(failedResponse.json().data.engine, "throwing-test");
  assert.equal(failedResponse.json().data.failure_reason, "Document text could not be read.");
  assert.doesNotMatch(failedResponse.body, /\/Users\/owner/i);
  assert.doesNotMatch(failedResponse.body, /storage_key/i);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).text, null);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).error_code, "provider_error");

  const failedTextResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/text`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(failedTextResponse.statusCode, 404);

  const retryResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(retryResponse.statusCode, 200);
  assert.equal(retryResponse.json().data.ocr_status, "succeeded");
  assert.equal(retryResponse.json().data.text_available, true);
  assert.equal(retryResponse.json().data.failure_reason, null);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).document_file_id, DOCUMENT_FILE_IDS.ownerDeckReceipt);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).text, "Recovered OCR text");
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).error_code, null);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).error_message, null);

  const textResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/text`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(textResponse.statusCode, 200);
  assert.equal(textResponse.json().data.text, "Recovered OCR text");

  await app.close();
});

test("local PDF OCR skips safely when storage byte reads fail", async () => {
  const fileStorage = {
    ...createFileStorageAdapter({ driver: "test" }),
    async readObject() {
      throw new Error("private storage path /Users/private-receipt.pdf failed");
    }
  };
  const app = buildApp({
    config: createConfig({ ocrMode: "local_pdf" }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState()),
    fileStorage
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.ocr_status, "skipped");
  assert.equal(response.json().data.text_available, false);
  assert.equal(response.json().data.failure_reason, "Document bytes are not available to local OCR.");
  assert.doesNotMatch(response.body, /private storage path/i);
  assert.doesNotMatch(response.body, /\/Users\/private-receipt\.pdf/i);

  await app.close();
});

test("local PDF OCR skips safely with S3 storage until server-side byte reads are implemented", async () => {
  const app = buildApp({
    config: createConfig({
      ocrMode: "local_pdf",
      fileStorageDriver: "s3",
      fileStorage: {
        driver: "s3",
        bucket: "home-ledger-documents",
        region: "us-east-1",
        endpoint: "https://storage.example.test",
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
        forcePathStyle: true
      }
    }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}/ocr`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.ocr_status, "skipped");
  assert.equal(response.json().data.engine, "local_pdf");
  assert.equal(response.json().data.text_available, false);
  assert.equal(response.json().data.failure_reason, "Document bytes are not available to local OCR.");
  for (const blocked of ["home-ledger-documents", "storage.example.test", "test-access-key", "test-secret-key", "signed_url"]) {
    assert.doesNotMatch(response.body, new RegExp(escapeRegExp(blocked), "i"));
  }

  await app.close();
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
  assert.equal(statusAfterReplace.json().data.failure_reason, null);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).document_file_id, replacementFileId);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).text, null);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).error_code, null);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).error_message, null);

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
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).document_file_id, replacementFileId);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).text, null);
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).error_code, "file_changed");
  assert.equal(db.documentOcr.get(DOCUMENT_IDS.ownerDeckReceipt).error_message, "File removed.");

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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createTextPdf(text) {
  const stream = `BT /F1 24 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

function escapePdfText(value) {
  return String(value).replace(/[()\\]/g, (character) => `\\${character}`);
}
