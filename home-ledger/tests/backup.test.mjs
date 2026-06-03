import assert from "node:assert/strict";
import test from "node:test";
import {
  createBackupEnvelope,
  findBackupFileForDocument,
  getSafeRestoredFileName,
  isBackupDataUrlTooLarge,
  isBlockedBackupAttachment,
  reconcileRestoredExpenseDocumentation,
  stripDocumentFileMetadata,
  summarizeBackupEnvelope,
  validateBackupEnvelope,
} from "../backend/domain/backup.js";

test("validateBackupEnvelope rejects unknown and newer backups", () => {
  assert.throws(
    () => validateBackupEnvelope({ app: "other", data: {} }),
    /Home Basis Tracker backup/,
  );
  assert.throws(
    () => validateBackupEnvelope({ app: "home-basis-tracker", backupVersion: 999, data: {} }),
    /newer version/,
  );
});

test("validateBackupEnvelope rejects duplicate records and broken relationships", () => {
  assert.throws(
    () => validateBackupEnvelope({
      app: "home-basis-tracker",
      data: {
        properties: [
          { id: "property_1", name: "Main home" },
          { id: "property_1", name: "Duplicate home" },
        ],
      },
    }),
    /duplicate property/,
  );

  assert.throws(
    () => validateBackupEnvelope({
      app: "home-basis-tracker",
      data: {
        properties: [{ id: "property_1", name: "Main home" }],
        projects: [{ id: "project_1", propertyId: "missing_property", name: "Roof" }],
      },
    }),
    /valid property/,
  );

  assert.throws(
    () => validateBackupEnvelope({
      app: "home-basis-tracker",
      data: {
        properties: [
          { id: "property_1", name: "Main home" },
          { id: "property_2", name: "Second home" },
        ],
        projects: [{ id: "project_1", propertyId: "property_1", name: "Roof" }],
        expenses: [{
          id: "expense_1",
          propertyId: "property_2",
          projectId: "project_1",
          vendor: "Vendor",
          description: "Work",
        }],
      },
    }),
    /another property/,
  );
});

test("validateBackupEnvelope rejects unsafe attached file manifests", () => {
  const data = {
    properties: [{ id: "property_1", name: "Main home" }],
    documents: [{
      id: "document_1",
      propertyId: "property_1",
      displayName: "Invoice",
      hasFile: true,
    }],
  };

  assert.throws(
    () => validateBackupEnvelope({
      app: "home-basis-tracker",
      data,
      files: [
        { documentId: "document_1", dataUrl: "data:text/plain;base64,ZmFrZQ==" },
        { documentId: "document_1", dataUrl: "data:text/plain;base64,ZmFrZQ==" },
      ],
    }),
    /duplicate attached files/,
  );

  assert.throws(
    () => validateBackupEnvelope({
      app: "home-basis-tracker",
      data,
      files: [{ documentId: "missing_document", dataUrl: "data:text/plain;base64,ZmFrZQ==" }],
    }),
    /unknown document/,
  );

  assert.throws(
    () => validateBackupEnvelope({
      app: "home-basis-tracker",
      data,
      files: [{ documentId: "document_1", sha256: "not-a-hash", dataUrl: "data:text/plain;base64,ZmFrZQ==" }],
    }),
    /invalid file checksum/,
  );
});

test("createBackupEnvelope sanitizes records and preserves file arrays", () => {
  const envelope = createBackupEnvelope(
    {
      properties: [{
        id: "property_1",
        name: "Main home",
        address: "/Users/private/address.txt",
      }],
    },
    [{ documentId: "document_1", dataUrl: "data:text/plain;base64,ZmFrZQ==" }],
    [{ documentId: "document_2", reason: "missing" }],
    "2026-06-02T00:00:00.000Z",
  );

  assert.equal(envelope.app, "home-basis-tracker");
  assert.equal(envelope.backupVersion, 1);
  assert.equal(envelope.createdAt, "2026-06-02T00:00:00.000Z");
  assert.equal(envelope.files.length, 1);
  assert.equal(envelope.missingFiles.length, 1);
  assert.equal(JSON.stringify(envelope.data).includes("/Users/"), false);
});

test("summarizeBackupEnvelope reports validated restore contents", () => {
  const envelope = createBackupEnvelope(
    {
      properties: [{ id: "property_1", name: "Main home" }],
      projects: [{ id: "project_1", propertyId: "property_1", name: "Roof" }],
      expenses: [{
        id: "expense_1",
        propertyId: "property_1",
        projectId: "project_1",
        vendor: "Roofer",
        description: "Roof work",
      }],
      documents: [
        {
          id: "document_1",
          propertyId: "property_1",
          projectId: "project_1",
          displayName: "Invoice",
          hasFile: true,
        },
        {
          id: "document_2",
          propertyId: "property_1",
          projectId: "project_1",
          displayName: "Photo",
          hasFile: true,
        },
      ],
    },
    [{ documentId: "document_1", dataUrl: "data:text/plain;base64,ZmFrZQ==" }],
    [{ documentId: "document_2", reason: "missing" }],
    "2026-06-02T00:00:00.000Z",
  );

  const summary = summarizeBackupEnvelope(envelope);

  assert.deepEqual(summary.counts, {
    properties: 1,
    projects: 1,
    expenses: 1,
    documents: 2,
  });
  assert.equal(summary.createdAt, "2026-06-02T00:00:00.000Z");
  assert.equal(summary.fileCount, 1);
  assert.equal(summary.documentsWithFileMetadata, 2);
  assert.equal(summary.missingFilesCount, 1);
  assert.equal(summary.expectedFilesMissingFromBackup, 0);
});

test("backup attachment guards block active file types and unsafe MIME prefixes", () => {
  assert.equal(isBlockedBackupAttachment({ fileName: "installer.app", mimeType: "application/octet-stream" }), true);
  assert.equal(isBlockedBackupAttachment({ fileName: "script.PS1", mimeType: "text/plain" }), true);
  assert.equal(isBlockedBackupAttachment({ fileName: "note.txt", mimeType: "text/javascript" }), true);
  assert.equal(isBlockedBackupAttachment({ fileName: "invoice.pdf", mimeType: "application/pdf" }), false);
});

test("backup file matching and data URL limits are deterministic", () => {
  const files = [
    { documentId: "document_1", fileId: "file_1" },
    { documentId: "document_2", fileId: "file_2" },
  ];

  assert.equal(findBackupFileForDocument(files, { id: "document_2" })?.fileId, "file_2");
  assert.equal(findBackupFileForDocument(files, { id: "missing", fileId: "file_1" })?.documentId, "document_1");
  assert.equal(findBackupFileForDocument(files, { id: "missing", fileId: "missing" }), null);
  assert.equal(isBackupDataUrlTooLarge("not-a-data-url"), false);
  assert.equal(isBackupDataUrlTooLarge(null), true);
});

test("restore helpers strip file metadata and reconcile expense document state", () => {
  const stripped = stripDocumentFileMetadata({
    id: "document_1",
    hasFile: true,
    fileId: "file_1",
    fileName: "invoice.pdf",
    mimeType: "application/pdf",
    fileSize: 100,
  }, "File skipped");

  assert.equal(stripped.hasFile, false);
  assert.equal(stripped.fileId, "");
  assert.equal(stripped.fileName, "File skipped");
  assert.equal(stripped.fileSize, 0);

  const expenses = [
    { id: "expense_1", documentationStatus: "invoice attached" },
    { id: "expense_2", documentationStatus: "receipt attached" },
    { id: "expense_3", documentationStatus: "no document yet" },
  ];
  const reconciled = reconcileRestoredExpenseDocumentation(expenses, [
    { expenseId: "expense_2", hasFile: true, documentType: "receipt" },
  ]);

  assert.equal(reconciled[0].documentationStatus, "needs follow-up");
  assert.equal(reconciled[1].documentationStatus, "receipt attached");
  assert.equal(reconciled[2].documentationStatus, "no document yet");
});

test("restored file names never expose local paths", () => {
  assert.equal(getSafeRestoredFileName("/Users/private/invoice.pdf"), "[local file path removed]");
  assert.equal(getSafeRestoredFileName("folder\\nested\\receipt\u0000\n2026.pdf"), "receipt2026.pdf");
  assert.equal(getSafeRestoredFileName("../private/permit.pdf"), "[local file path removed]");
  assert.equal(getSafeRestoredFileName(""), "Attached file");
});
