import { createHash } from "node:crypto";
import { apiError, validationError } from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISPLAY_NAME_MAX_LENGTH = 240;
const DOCUMENT_TYPE_MAX_LENGTH = 120;
const NOTES_MAX_LENGTH = 5000;
const FILE_STATUS_NOTE_MAX_LENGTH = 1000;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const FILENAME_MAX_LENGTH = 180;
const FILE_SOURCES = new Set(["web_upload", "ios_upload"]);
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "text/plain"
]);
const BLOCKED_FILE_EXTENSIONS = [
  ".app",
  ".bat",
  ".bin",
  ".cmd",
  ".com",
  ".dmg",
  ".exe",
  ".jar",
  ".js",
  ".msi",
  ".ps1",
  ".scr",
  ".sh",
  ".vbs",
  ".zip"
];
const BLOCKED_MIME_PREFIXES = [
  "application/x-",
  "text/html",
  "text/javascript"
];
const FILE_INTENT_INPUT_FIELDS = new Set([
  "original_file_name",
  "mime_type",
  "size_bytes",
  "sha256",
  "source"
]);
const FILE_COMPLETE_INPUT_FIELDS = new Set([
  "document_file_id",
  "upload_id",
  "size_bytes",
  "sha256"
]);

const FILE_AVAILABILITIES = new Set([
  "available",
  "missing",
  "not_uploaded",
  "removed",
  "blocked",
  "skipped",
  "tutorial_metadata",
  "corrupt",
  "checksum_failed"
]);

const DOCUMENT_INPUT_FIELDS = new Set([
  "property_id",
  "project_id",
  "expense_id",
  "display_name",
  "document_type",
  "document_date",
  "notes",
  "file_availability",
  "file_status_note"
]);

const SORTS = {
  document_date_desc: "d.document_date DESC NULLS LAST, d.created_at DESC, d.id ASC",
  document_date_asc: "d.document_date ASC NULLS LAST, d.id ASC",
  name_asc: "d.display_name ASC, d.id ASC",
  name_desc: "d.display_name DESC, d.id ASC",
  type_asc: "d.document_type ASC, d.display_name ASC, d.id ASC",
  file_availability_asc: "d.file_availability ASC, d.display_name ASC, d.id ASC",
  created_desc: "d.created_at DESC, d.id ASC",
  updated_desc: "d.updated_at DESC, d.id ASC"
};

export async function listDocuments({ db, workspaceId, filters = {}, pagination = {}, sort }) {
  const query = buildListQuery({ workspaceId, filters, pagination, sort });
  const result = await db.query(query.sql, query.params);
  const totalCount = result.rows[0]?.total_count ? Number(result.rows[0].total_count) : 0;

  return {
    data: result.rows.map(mapDocumentRow),
    meta: {
      limit: query.limit,
      offset: query.offset,
      total_count: totalCount
    }
  };
}

export async function getDocumentById({ db, workspaceId, documentId }) {
  validateDocumentId(documentId);
  const result = await db.query(
    `
      -- getDocumentById
      SELECT ${documentColumns()}
      FROM documents d
      ${documentJoins()}
      WHERE d.workspace_id = $1
        AND d.id = $2
        AND d.deleted_at IS NULL
      LIMIT 1
    `,
    [workspaceId, documentId]
  );

  return result.rows[0] ? mapDocumentRow(result.rows[0]) : null;
}

export async function createDocument({ db, workspaceId, input, actorUserId }) {
  const documentInput = validateDocumentInput(input, { partial: false });
  await resolveDocumentRelationships({ db, workspaceId, documentInput });

  const result = await db.query(
    `
      -- createDocument
      INSERT INTO documents (
        workspace_id,
        property_id,
        project_id,
        expense_id,
        display_name,
        document_type,
        document_date,
        notes,
        file_availability,
        file_status_note,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::date,
        $8,
        $9,
        $10,
        $11,
        $11
      )
      RETURNING id
    `,
    [
      workspaceId,
      documentInput.propertyId,
      documentInput.projectId,
      documentInput.expenseId,
      documentInput.displayName,
      documentInput.documentType,
      documentInput.documentDate,
      documentInput.notes,
      documentInput.fileAvailability,
      documentInput.fileStatusNote,
      actorUserId
    ]
  );

  return getDocumentById({ db, workspaceId, documentId: result.rows[0].id });
}

export async function updateDocument({ db, workspaceId, documentId, input, actorUserId }) {
  validateDocumentId(documentId);
  const documentInput = validateDocumentInput(input, { partial: true });
  const needsRelationshipValidation = documentInput.hasPropertyId || documentInput.hasProjectId || documentInput.hasExpenseId;
  const existingDocument = needsRelationshipValidation
    ? await getActiveDocumentRelationshipState({ db, workspaceId, documentId })
    : null;

  if (needsRelationshipValidation && !existingDocument) {
    return null;
  }

  if (needsRelationshipValidation) {
    await resolveDocumentRelationships({ db, workspaceId, documentInput, existingDocument });
  }

  const result = await db.query(
    `
      -- updateDocument
      UPDATE documents
      SET
        property_id = CASE WHEN $3::boolean THEN $4 ELSE property_id END,
        project_id = CASE WHEN $5::boolean THEN $6 ELSE project_id END,
        expense_id = CASE WHEN $7::boolean THEN $8 ELSE expense_id END,
        display_name = CASE WHEN $9::boolean THEN $10 ELSE display_name END,
        document_type = CASE WHEN $11::boolean THEN $12 ELSE document_type END,
        document_date = CASE WHEN $13::boolean THEN $14::date ELSE document_date END,
        notes = CASE WHEN $15::boolean THEN $16 ELSE notes END,
        file_availability = CASE WHEN $17::boolean THEN $18 ELSE file_availability END,
        file_status_note = CASE WHEN $19::boolean THEN $20 ELSE file_status_note END,
        updated_by_user_id = $21,
        updated_at = now()
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
      RETURNING id
    `,
    [
      workspaceId,
      documentId,
      documentInput.hasPropertyId,
      documentInput.propertyId,
      documentInput.hasProjectId,
      documentInput.projectId,
      documentInput.hasExpenseId,
      documentInput.expenseId,
      documentInput.hasDisplayName,
      documentInput.displayName,
      documentInput.hasDocumentType,
      documentInput.documentType,
      documentInput.hasDocumentDate,
      documentInput.documentDate,
      documentInput.hasNotes,
      documentInput.notes,
      documentInput.hasFileAvailability,
      documentInput.fileAvailability,
      documentInput.hasFileStatusNote,
      documentInput.fileStatusNote,
      actorUserId
    ]
  );

  return result.rows[0] ? getDocumentById({ db, workspaceId, documentId: result.rows[0].id }) : null;
}

export async function deleteDocument({ db, workspaceId, documentId, actorUserId }) {
  validateDocumentId(documentId);
  const result = await db.query(
    `
      -- deleteDocument
      UPDATE documents
      SET deleted_at = now(),
          updated_by_user_id = $3,
          updated_at = now()
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
      RETURNING id
    `,
    [workspaceId, documentId, actorUserId]
  );

  return result.rows[0] ? getDocumentByIdIncludingDeleted({ db, workspaceId, documentId: result.rows[0].id }) : null;
}

export async function getDocumentFilterOptions({ db, workspaceId, filters = {} }) {
  const query = buildFilterOptionsQuery({ workspaceId, filters });
  const result = await db.query(query.sql, query.params);

  const properties = new Map();
  const projects = new Map();
  const expenses = new Map();
  const documentTypes = new Set();
  const fileAvailabilities = new Set();

  for (const row of result.rows) {
    if (row.property_id && row.property_name) {
      properties.set(row.property_id, { id: row.property_id, name: row.property_name });
    }
    if (row.project_id && row.project_name) {
      projects.set(row.project_id, { id: row.project_id, name: row.project_name });
    }
    if (row.expense_id && row.expense_description) {
      expenses.set(row.expense_id, { id: row.expense_id, description: row.expense_description });
    }
    if (row.document_type) documentTypes.add(row.document_type);
    if (row.file_availability) fileAvailabilities.add(row.file_availability);
  }

  return {
    properties: [...properties.values()].sort(compareNamedOptions),
    projects: [...projects.values()].sort(compareNamedOptions),
    expenses: [...expenses.values()].sort(compareExpenseOptions),
    document_types: [...documentTypes].sort(),
    file_availabilities: [...fileAvailabilities].sort()
  };
}

export async function createDocumentFileIntent({ db, storage, workspaceId, documentId, input, actorUserId }) {
  validateDocumentId(documentId);
  const fileInput = validateFileIntentInput(input);
  const document = await getActiveDocumentFileState({ db, workspaceId, documentId });
  if (!document) {
    return null;
  }

  const storageProvider = storage?.driver || "local";
  const result = await db.query(
    `
      -- createDocumentFileIntent
      INSERT INTO document_files (
        workspace_id,
        document_id,
        storage_provider,
        storage_key,
        original_file_name,
        mime_type,
        size_bytes,
        sha256,
        source,
        status,
        uploaded_by_user_id
      )
      VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, 'pending_upload', $9)
      RETURNING id
    `,
    [
      workspaceId,
      documentId,
      storageProvider,
      fileInput.originalFileName,
      fileInput.mimeType,
      fileInput.sizeBytes,
      fileInput.sha256,
      fileInput.source,
      actorUserId
    ]
  );

  const documentFileId = result.rows[0].id;
  const storageKey = storage.createStorageKey({ workspaceId, documentId, documentFileId });
  // The current adapter does not delete prior storage objects; production storage cleanup is a later lifecycle job.
  await db.query(
    `
      -- setDocumentFileStorageKey
      UPDATE document_files
      SET storage_key = $4,
          updated_at = now()
      WHERE workspace_id = $1
        AND document_id = $2
        AND id = $3
        AND deleted_at IS NULL
      RETURNING id
    `,
    [workspaceId, documentId, documentFileId, storageKey]
  );

  const uploadIntent = storage.createUploadIntent({
    workspaceId,
    documentId,
    documentFileId,
    storageKey,
    mimeType: fileInput.mimeType,
    sizeBytes: fileInput.sizeBytes
  });

  return {
    upload_id: documentFileId,
    document_file_id: documentFileId,
    upload_method: uploadIntent.upload_method,
    upload_url: uploadIntent.upload_url,
    upload_headers: uploadIntent.upload_headers,
    upload_token: uploadIntent.upload_token,
    expires_at: uploadIntent.expires_at,
    max_size_bytes: MAX_DOCUMENT_FILE_SIZE_BYTES,
    file: serializeDocumentFile({
      id: documentFileId,
      document_id: documentId,
      original_file_name: fileInput.originalFileName,
      mime_type: fileInput.mimeType,
      size_bytes: fileInput.sizeBytes,
      sha256: fileInput.sha256,
      source: fileInput.source,
      status: "pending_upload",
      uploaded_at: null,
      deleted_at: null
    })
  };
}

export async function completeDocumentFileUpload({ db, workspaceId, documentId, input, actorUserId }) {
  validateDocumentId(documentId);
  const completeInput = validateFileCompleteInput(input);
  const document = await getActiveDocumentFileState({ db, workspaceId, documentId });
  if (!document) {
    return null;
  }

  const pendingFile = await getDocumentFileById({
    db,
    workspaceId,
    documentId,
    documentFileId: completeInput.documentFileId
  });
  if (!pendingFile) {
    return null;
  }
  if (pendingFile.status !== "pending_upload") {
    throw apiError(409, "conflict", "Document file is not pending upload.");
  }
  if (Number(pendingFile.size_bytes) !== completeInput.sizeBytes) {
    throw validationError([{ field: "size_bytes", issue: "metadata_mismatch" }]);
  }
  if (completeInput.sha256 && pendingFile.sha256 && completeInput.sha256 !== pendingFile.sha256) {
    throw validationError([{ field: "sha256", issue: "metadata_mismatch" }]);
  }

  await db.query(
    `
      -- deactivatePriorDocumentFiles
      UPDATE document_files
      SET status = 'deleted',
          deleted_at = coalesce(deleted_at, now()),
          updated_at = now()
      WHERE workspace_id = $1
        AND document_id = $2
        AND id <> $3
        AND deleted_at IS NULL
        AND status = 'available'
    `,
    [workspaceId, documentId, pendingFile.id]
  );

  const result = await db.query(
    `
      -- completeDocumentFileUpload
      UPDATE document_files
      SET status = 'available',
          size_bytes = $4,
          sha256 = coalesce($5, sha256),
          uploaded_by_user_id = $6,
          uploaded_at = now(),
          updated_at = now()
      WHERE workspace_id = $1
        AND document_id = $2
        AND id = $3
        AND deleted_at IS NULL
        AND status = 'pending_upload'
      RETURNING id,
                document_id,
                original_file_name,
                mime_type,
                size_bytes,
                sha256,
                source,
                status,
                uploaded_at,
                deleted_at
    `,
    [
      workspaceId,
      documentId,
      pendingFile.id,
      completeInput.sizeBytes,
      completeInput.sha256,
      actorUserId
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  await updateDocumentFileAvailability({
    db,
    workspaceId,
    documentId,
    fileAvailability: "available",
    fileStatusNote: null,
    actorUserId
  });
  await resetDocumentOcrForFileChange({
    db,
    workspaceId,
    documentId,
    documentFileId: result.rows[0].id,
    status: "not_requested",
    reason: null
  });

  return serializeDocumentFile(result.rows[0]);
}

export async function uploadDocumentFileBytes({
  db,
  storage,
  workspaceId,
  documentId,
  documentFileId,
  uploadId,
  contentType,
  bytes
}) {
  validateDocumentId(documentId);
  const uploadInput = validateFileUploadInput({ documentFileId, uploadId, bytes });
  const document = await getActiveDocumentFileState({ db, workspaceId, documentId });
  if (!document) {
    return null;
  }

  const file = await getDocumentFileById({
    db,
    workspaceId,
    documentId,
    documentFileId: uploadInput.documentFileId
  });
  if (!file) {
    return null;
  }
  if (file.status !== "pending_upload") {
    throw apiError(409, "conflict", "Document file is not pending upload.");
  }
  if (typeof storage?.writeObject !== "function") {
    throw apiError(409, "conflict", "API file upload is not available for this storage adapter.");
  }

  const normalizedContentType = normalizeContentType(contentType);
  if (normalizedContentType && normalizedContentType !== file.mime_type) {
    throw validationError([
      {
        field: "content_type",
        issue: "metadata_mismatch"
      }
    ]);
  }
  if (Number(file.size_bytes || 0) !== uploadInput.bytes.byteLength) {
    throw validationError([
      {
        field: "size_bytes",
        issue: "metadata_mismatch"
      }
    ]);
  }

  await storage.writeObject({
    workspaceId,
    documentId,
    documentFileId: file.id,
    storageProvider: file.storage_provider,
    storageKey: file.storage_key,
    mimeType: file.mime_type,
    sizeBytes: uploadInput.bytes.byteLength,
    bytes: uploadInput.bytes
  });

  return {
    ...serializeDocumentFile(file),
    upload_stored: true
  };
}

export async function getDocumentFileDownload({ db, storage, workspaceId, documentId }) {
  validateDocumentId(documentId);
  const document = await getActiveDocumentFileState({ db, workspaceId, documentId });
  if (!document) {
    return null;
  }

  const file = await getActiveDocumentFile({ db, workspaceId, documentId });
  if (!file || file.status !== "available") {
    throw apiError(404, "not_found", "Document file not found.");
  }

  const downloadIntent = storage.createDownloadIntent({
    workspaceId,
    documentId,
    documentFileId: file.id,
    storageKey: file.storage_key,
    status: file.status,
    mimeType: file.mime_type,
    sizeBytes: Number(file.size_bytes || 0)
  });

  return {
    ...serializeDocumentFile(file),
    download_available: Boolean(downloadIntent.download_available),
    download_url: downloadIntent.download_url,
    expires_at: downloadIntent.expires_at
  };
}

export async function deleteDocumentFile({ db, storage, workspaceId, documentId, actorUserId }) {
  validateDocumentId(documentId);
  const document = await getActiveDocumentFileState({ db, workspaceId, documentId });
  if (!document) {
    return null;
  }

  const file = await getActiveDocumentFile({ db, workspaceId, documentId });
  if (!file) {
    throw apiError(404, "not_found", "Document file not found.");
  }

  const cleanup = await storage.deleteObject({
    workspaceId,
    documentId,
    documentFileId: file.id,
    storageProvider: file.storage_provider,
    storageKey: file.storage_key
  });

  const result = await db.query(
    `
      -- deleteDocumentFile
      UPDATE document_files
      SET status = 'deleted',
          deleted_at = now(),
          updated_at = now()
      WHERE workspace_id = $1
        AND document_id = $2
        AND id = $3
        AND deleted_at IS NULL
      RETURNING id,
                document_id,
                original_file_name,
                mime_type,
                size_bytes,
                sha256,
                source,
                status,
                uploaded_at,
                deleted_at
    `,
    [workspaceId, documentId, file.id]
  );

  await updateDocumentFileAvailability({
    db,
    workspaceId,
    documentId,
    fileAvailability: "removed",
    fileStatusNote: "File removed.",
    actorUserId
  });
  await resetDocumentOcrForFileChange({
    db,
    workspaceId,
    documentId,
    documentFileId: file.id,
    status: "skipped",
    reason: "File removed."
  });

  return {
    ...serializeDocumentFile(result.rows[0]),
    cleanup_deferred: Boolean(cleanup.cleanup_deferred)
  };
}

export async function requestDocumentOcr({ db, storage, ocrProvider, workspaceId, documentId }) {
  validateDocumentId(documentId);
  const document = await getActiveDocumentFileState({ db, workspaceId, documentId });
  if (!document) {
    return null;
  }

  const file = await getActiveDocumentFile({ db, workspaceId, documentId });
  if (!file || file.status !== "available") {
    throw apiError(409, "conflict", "Document has no available file for OCR.");
  }

  await upsertDocumentOcr({
    db,
    workspaceId,
    documentId,
    documentFileId: file.id,
    status: "processing",
    text: null,
    textSha256: null,
    engine: ocrProvider?.mode || null,
    errorCode: null,
    errorMessage: null,
    completed: false
  });

  const fileBytes = await readOcrFileBytes({ storage, ocrProvider, workspaceId, documentId, file });
  const result = await requestOcrProviderText({
    ocrProvider,
    workspaceId,
    documentId,
    file,
    fileBytes
  });
  const status = normalizeOcrStatus(result.status);
  const text = status === "succeeded" ? normalizeOcrText(result.text) : null;
  await upsertDocumentOcr({
    db,
    workspaceId,
    documentId,
    documentFileId: file.id,
    status,
    text,
    textSha256: text ? sha256Hex(text) : null,
    engine: normalizeNullableText(result.engine),
    errorCode: sanitizeOcrError(result.errorCode),
    errorMessage: sanitizeOcrError(result.errorMessage),
    completed: ["succeeded", "failed", "skipped"].includes(status)
  });

  return getDocumentOcrStatus({ db, workspaceId, documentId });
}

async function requestOcrProviderText({ ocrProvider, workspaceId, documentId, file, fileBytes }) {
  try {
    return await ocrProvider.requestText({
      workspaceId,
      documentId,
      file: {
        id: file.id,
        original_file_name: file.original_file_name,
        mime_type: file.mime_type,
        size_bytes: Number(file.size_bytes || 0),
        bytes: fileBytes
      }
    });
  } catch {
    return {
      status: "failed",
      text: null,
      engine: ocrProvider?.mode || null,
      errorCode: "provider_error",
      errorMessage: "Document text could not be read."
    };
  }
}

async function readOcrFileBytes({ storage, ocrProvider, workspaceId, documentId, file }) {
  if (ocrProvider?.mode !== "local_pdf" || typeof storage?.readObject !== "function") {
    return null;
  }

  try {
    return await storage.readObject({
      workspaceId,
      documentId,
      documentFileId: file.id,
      storageProvider: file.storage_provider,
      storageKey: file.storage_key,
      status: file.status,
      mimeType: file.mime_type,
      sizeBytes: Number(file.size_bytes || 0)
    });
  } catch {
    return null;
  }
}

export async function getDocumentOcrStatus({ db, workspaceId, documentId }) {
  validateDocumentId(documentId);
  const row = await getDocumentOcrRow({ db, workspaceId, documentId });
  if (!row) {
    return null;
  }
  return mapOcrStatus(row);
}

export async function getDocumentOcrText({ db, workspaceId, documentId }) {
  validateDocumentId(documentId);
  const row = await getDocumentOcrRow({ db, workspaceId, documentId, includeText: true });
  if (!row) {
    return null;
  }
  const status = mapOcrStatus(row);
  if (!status.textAvailable) {
    throw apiError(404, "not_found", "Document text not found.");
  }
  return {
    ...status,
    text: row.ocr_text || ""
  };
}

export function serializeDocument(document) {
  return {
    id: document.id,
    property_id: document.propertyId,
    property_name: document.propertyName,
    project_id: document.projectId,
    project_name: document.projectName,
    expense_id: document.expenseId,
    expense_description: document.expenseDescription,
    display_name: document.displayName,
    document_type: document.documentType,
    document_date: document.documentDate,
    notes: document.notes,
    file_availability: document.fileAvailability,
    file_status_note: document.fileStatusNote,
    file: document.file,
    ocr: document.ocr,
    open_item_count: Number(document.openItemCount || 0),
    deleted_at: document.deletedAt,
    created_at: document.createdAt,
    updated_at: document.updatedAt
  };
}

export function serializeDocumentFile(file) {
  return {
    id: file.id,
    document_id: file.document_id,
    original_file_name: file.original_file_name,
    mime_type: file.mime_type,
    size_bytes: Number(file.size_bytes || 0),
    sha256: file.sha256 || null,
    source: file.source,
    status: file.status,
    uploaded_at: formatTimestamp(file.uploaded_at),
    deleted_at: formatTimestamp(file.deleted_at)
  };
}

export function serializeDocumentOcr(ocr) {
  return {
    document_id: ocr.documentId,
    document_file_id: ocr.documentFileId,
    ocr_status: ocr.status,
    ocr_requested_at: ocr.requestedAt,
    ocr_completed_at: ocr.completedAt,
    text_available: ocr.textAvailable,
    engine: ocr.engine,
    failure_reason: ocr.failureReason
  };
}

export function serializeDocumentOcrText(ocrText) {
  return {
    document_id: ocrText.documentId,
    document_file_id: ocrText.documentFileId,
    ocr_status: ocrText.status,
    ocr_requested_at: ocrText.requestedAt,
    ocr_completed_at: ocrText.completedAt,
    text_available: ocrText.textAvailable,
    text: ocrText.text
  };
}

export function validateDocumentId(documentId) {
  if (!UUID_PATTERN.test(String(documentId || ""))) {
    throw apiError(400, "invalid_request", "Invalid document id.");
  }
  return documentId;
}

function buildListQuery({ workspaceId, filters, pagination, sort }) {
  const query = buildDocumentWhere({ workspaceId, filters, tableAlias: "d" });
  const limit = parseLimit(pagination.limit);
  const offset = parseOffset(pagination.offset);
  query.params.push(limit, offset);

  const orderBy = SORTS[sort] || SORTS.document_date_desc;

  return {
    sql: `
      -- listDocuments
      SELECT ${documentColumns()}, count(*) OVER() AS total_count
      FROM documents d
      ${documentJoins()}
      WHERE ${query.where.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${query.params.length - 1}
      OFFSET $${query.params.length}
    `,
    params: query.params,
    limit,
    offset
  };
}

function buildFilterOptionsQuery({ workspaceId, filters }) {
  const query = buildDocumentWhere({ workspaceId, filters, tableAlias: "d" });
  return {
    sql: `
      -- documentFilterOptions
      SELECT DISTINCT
        d.property_id,
        p.name AS property_name,
        d.project_id,
        pr.name AS project_name,
        d.expense_id,
        e.description AS expense_description,
        d.document_type,
        d.file_availability
      FROM documents d
      JOIN properties p
        ON p.workspace_id = d.workspace_id
       AND p.id = d.property_id
      LEFT JOIN projects pr
        ON pr.workspace_id = d.workspace_id
       AND pr.id = d.project_id
      LEFT JOIN expenses e
        ON e.workspace_id = d.workspace_id
       AND e.id = d.expense_id
      WHERE ${query.where.join(" AND ")}
      ORDER BY p.name ASC, pr.name ASC, e.description ASC, d.document_type ASC, d.file_availability ASC
    `,
    params: query.params
  };
}

function buildDocumentWhere({ workspaceId, filters, tableAlias }) {
  const params = [workspaceId];
  const where = [`${tableAlias}.workspace_id = $1`, `${tableAlias}.deleted_at IS NULL`];

  addUuidFilter({ filters, field: "property_id", column: `${tableAlias}.property_id`, params, where });
  addUuidFilter({ filters, field: "project_id", column: `${tableAlias}.project_id`, params, where, nullable: true });
  addUuidFilter({ filters, field: "expense_id", column: `${tableAlias}.expense_id`, params, where, nullable: true });
  addTextFilter({ filters, field: "document_type", column: `${tableAlias}.document_type`, params, where });
  addTextFilter({ filters, field: "file_availability", column: `${tableAlias}.file_availability`, params, where });
  addDateRangeFilter({ filters, fromField: "document_date_from", toField: "document_date_to", column: `${tableAlias}.document_date`, params, where });

  const q = normalizeOptionalText(filters.q);
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    where.push(`(${tableAlias}.display_name ILIKE $${params.length} OR ${tableAlias}.notes ILIKE $${params.length} OR ${tableAlias}.file_status_note ILIKE $${params.length})`);
  }

  return { params, where };
}

function validateDocumentInput(input, { partial }) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const details = [];
  for (const field of Object.keys(body)) {
    if (!DOCUMENT_INPUT_FIELDS.has(field)) {
      details.push({ field, issue: "unknown_field" });
    }
  }

  const normalized = {
    hasPropertyId: Object.hasOwn(body, "property_id"),
    propertyId: undefined,
    hasProjectId: Object.hasOwn(body, "project_id"),
    projectId: undefined,
    hasExpenseId: Object.hasOwn(body, "expense_id"),
    expenseId: undefined,
    hasDisplayName: Object.hasOwn(body, "display_name"),
    displayName: undefined,
    hasDocumentType: Object.hasOwn(body, "document_type"),
    documentType: "other",
    hasDocumentDate: Object.hasOwn(body, "document_date"),
    documentDate: undefined,
    hasNotes: Object.hasOwn(body, "notes"),
    notes: undefined,
    hasFileAvailability: Object.hasOwn(body, "file_availability"),
    fileAvailability: "not_uploaded",
    hasFileStatusNote: Object.hasOwn(body, "file_status_note"),
    fileStatusNote: undefined
  };

  if (normalized.hasPropertyId) {
    normalized.propertyId = normalizeRelationshipId(body.property_id, "property_id", { required: false }, details);
  } else if (!partial && !normalized.hasExpenseId) {
    details.push({ field: "property_id", issue: "required" });
  }

  if (normalized.hasProjectId) {
    normalized.projectId = normalizeRelationshipId(body.project_id, "project_id", { required: false }, details);
  } else if (!partial) {
    normalized.projectId = null;
  }

  if (normalized.hasExpenseId) {
    normalized.expenseId = normalizeRelationshipId(body.expense_id, "expense_id", { required: false }, details);
  } else if (!partial) {
    normalized.expenseId = null;
  }

  if (!partial || normalized.hasDisplayName) {
    const displayName = normalizeRequiredText(body.display_name);
    if (!displayName) {
      details.push({ field: "display_name", issue: "required" });
    } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      details.push({ field: "display_name", issue: "too_long" });
    } else {
      normalized.displayName = displayName;
    }
  }

  if (normalized.hasDocumentType) {
    normalized.documentType = normalizeOptionalText(body.document_type);
  }
  if (!partial || normalized.hasDocumentType) {
    if (!normalized.documentType) {
      details.push({ field: "document_type", issue: "required" });
    } else if (normalized.documentType.length > DOCUMENT_TYPE_MAX_LENGTH) {
      details.push({ field: "document_type", issue: "too_long" });
    }
  }

  if (normalized.hasDocumentDate) {
    normalized.documentDate = normalizeDate(body.document_date);
    if (normalized.documentDate === false) {
      details.push({ field: "document_date", issue: "invalid_date" });
      normalized.documentDate = undefined;
    }
  } else if (!partial) {
    normalized.documentDate = null;
  }

  normalizeNullableField({ body, normalized, hasKey: "hasNotes", valueKey: "notes", field: "notes", maxLength: NOTES_MAX_LENGTH, partial, details });

  if (normalized.hasFileAvailability) {
    normalized.fileAvailability = normalizeOptionalText(body.file_availability);
    if (!FILE_AVAILABILITIES.has(normalized.fileAvailability)) {
      details.push({ field: "file_availability", issue: "invalid_file_availability" });
    }
  }

  normalizeNullableField({ body, normalized, hasKey: "hasFileStatusNote", valueKey: "fileStatusNote", field: "file_status_note", maxLength: FILE_STATUS_NOTE_MAX_LENGTH, partial, details });

  if (partial && details.length === 0 && !Object.keys(body).some((field) => DOCUMENT_INPUT_FIELDS.has(field))) {
    details.push({ field: "body", issue: "no_fields" });
  }

  if (details.length > 0) {
    throw validationError(details);
  }

  return normalized;
}

async function resolveDocumentRelationships({ db, workspaceId, documentInput, existingDocument }) {
  const relationshipChanging = documentInput.hasPropertyId || documentInput.hasProjectId || documentInput.hasExpenseId;
  if (existingDocument && !relationshipChanging) {
    return;
  }

  let propertyId = documentInput.hasPropertyId ? documentInput.propertyId : existingDocument?.property_id;
  let projectId = documentInput.hasProjectId ? documentInput.projectId : existingDocument?.project_id;
  const expenseId = documentInput.hasExpenseId ? documentInput.expenseId : existingDocument?.expense_id;

  if (expenseId) {
    const expense = await loadActiveExpenseRelationship({ db, workspaceId, id: expenseId });
    if (!expense) {
      throw invalidRelationship("expense_id", "not_found");
    }
    if (documentInput.hasPropertyId && propertyId !== expense.property_id) {
      throw invalidRelationship("property_id", "expense_mismatch");
    }
    if (documentInput.hasProjectId && projectId !== expense.project_id) {
      throw invalidRelationship("project_id", "expense_mismatch");
    }
    propertyId = expense.property_id;
    projectId = expense.project_id || null;
    documentInput.propertyId = propertyId;
    documentInput.projectId = projectId;
    documentInput.hasPropertyId = true;
    documentInput.hasProjectId = true;
  }

  if (!propertyId) {
    throw validationError([{ field: "property_id", issue: "required" }]);
  }

  if (documentInput.hasPropertyId || !existingDocument) {
    const property = await loadActiveRelationship({
      db,
      workspaceId,
      table: "properties",
      marker: "loadDocumentProperty",
      id: propertyId
    });
    if (!property) {
      throw invalidRelationship("property_id", "not_found");
    }
  }

  if (projectId) {
    const project = await loadActiveProjectRelationship({ db, workspaceId, id: projectId });
    if (!project) {
      throw invalidRelationship("project_id", "not_found");
    }
    if (project.property_id !== propertyId) {
      throw invalidRelationship("project_id", "property_mismatch");
    }
  }
}

async function getActiveDocumentRelationshipState({ db, workspaceId, documentId }) {
  const result = await db.query(
    `
      -- getDocumentRelationshipState
      SELECT property_id, project_id, expense_id
      FROM documents
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [workspaceId, documentId]
  );
  return result.rows[0] || null;
}

async function getActiveDocumentFileState({ db, workspaceId, documentId }) {
  const result = await db.query(
    `
      -- getActiveDocumentFileState
      SELECT id
      FROM documents
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [workspaceId, documentId]
  );
  return result.rows[0] || null;
}

async function getActiveDocumentFile({ db, workspaceId, documentId }) {
  const result = await db.query(
    `
      -- getActiveDocumentFile
      SELECT id,
             document_id,
             storage_provider,
             storage_key,
             original_file_name,
             mime_type,
             size_bytes,
             sha256,
             source,
             status,
             uploaded_at,
             deleted_at
      FROM document_files
      WHERE workspace_id = $1
        AND document_id = $2
        AND deleted_at IS NULL
      ORDER BY CASE WHEN status = 'available' THEN 0 ELSE 1 END, created_at DESC, id ASC
      LIMIT 1
    `,
    [workspaceId, documentId]
  );
  return result.rows[0] || null;
}

async function getDocumentFileById({ db, workspaceId, documentId, documentFileId }) {
  const result = await db.query(
    `
      -- getDocumentFileById
      SELECT id,
             document_id,
             storage_provider,
             storage_key,
             original_file_name,
             mime_type,
             size_bytes,
             sha256,
             source,
             status,
             uploaded_at,
             deleted_at
      FROM document_files
      WHERE workspace_id = $1
        AND document_id = $2
        AND id = $3
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [workspaceId, documentId, documentFileId]
  );
  return result.rows[0] || null;
}

async function getDocumentOcrRow({ db, workspaceId, documentId, includeText = false }) {
  const result = await db.query(
    `
      -- getDocumentOcrRow
      SELECT d.id AS document_id,
             f.id AS active_file_id,
             f.status AS active_file_status,
             o.document_file_id,
             coalesce(o.status, 'not_requested') AS ocr_status,
             o.engine AS ocr_engine,
             o.error_code AS ocr_error_code,
             o.error_message AS ocr_error_message,
             o.started_at AS ocr_started_at,
             o.completed_at AS ocr_completed_at,
             o.created_at AS ocr_created_at,
             (o.text IS NOT NULL
               AND length(o.text) > 0
               AND o.status = 'succeeded'
               AND o.document_file_id = f.id
               AND f.status = 'available') AS ocr_text_available
             ${includeText ? ", o.text AS ocr_text" : ""}
      FROM documents d
      LEFT JOIN LATERAL (
        SELECT df.id, df.status
        FROM document_files df
        WHERE df.workspace_id = d.workspace_id
          AND df.document_id = d.id
          AND df.deleted_at IS NULL
        ORDER BY CASE WHEN df.status = 'available' THEN 0 ELSE 1 END, df.created_at DESC, df.id ASC
        LIMIT 1
      ) f ON true
      LEFT JOIN document_ocr o
        ON o.workspace_id = d.workspace_id
       AND o.document_id = d.id
      WHERE d.workspace_id = $1
        AND d.id = $2
        AND d.deleted_at IS NULL
      LIMIT 1
    `,
    [workspaceId, documentId]
  );
  return result.rows[0] || null;
}

async function upsertDocumentOcr({
  db,
  workspaceId,
  documentId,
  documentFileId,
  status,
  text,
  textSha256,
  engine,
  errorCode,
  errorMessage,
  completed
}) {
  await db.query(
    `
      -- upsertDocumentOcr
      INSERT INTO document_ocr (
        workspace_id,
        document_id,
        document_file_id,
        status,
        text,
        text_sha256,
        engine,
        error_code,
        error_message,
        started_at,
        completed_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        now(),
        CASE WHEN $10::boolean THEN now() ELSE NULL END
      )
      ON CONFLICT (document_id)
      DO UPDATE SET
        document_file_id = EXCLUDED.document_file_id,
        status = EXCLUDED.status,
        text = EXCLUDED.text,
        text_sha256 = EXCLUDED.text_sha256,
        engine = EXCLUDED.engine,
        error_code = EXCLUDED.error_code,
        error_message = EXCLUDED.error_message,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        updated_at = now()
    `,
    [
      workspaceId,
      documentId,
      documentFileId,
      status,
      text,
      textSha256,
      engine,
      errorCode,
      errorMessage,
      completed
    ]
  );
}

async function resetDocumentOcrForFileChange({ db, workspaceId, documentId, documentFileId, status, reason }) {
  await upsertDocumentOcr({
    db,
    workspaceId,
    documentId,
    documentFileId,
    status,
    text: null,
    textSha256: null,
    engine: null,
    errorCode: reason ? "file_changed" : null,
    errorMessage: reason,
    completed: status === "skipped"
  });
}

async function updateDocumentFileAvailability({ db, workspaceId, documentId, fileAvailability, fileStatusNote, actorUserId }) {
  await db.query(
    `
      -- updateDocumentFileAvailability
      UPDATE documents
      SET file_availability = $3,
          file_status_note = $4,
          updated_by_user_id = $5,
          updated_at = now()
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
    `,
    [workspaceId, documentId, fileAvailability, fileStatusNote, actorUserId]
  );
}

async function loadActiveRelationship({ db, workspaceId, table, marker, id }) {
  const result = await db.query(
    `
      -- ${marker}
      SELECT id, name
      FROM ${table}
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      LIMIT 1
    `,
    [workspaceId, id]
  );
  return result.rows[0] || null;
}

async function loadActiveProjectRelationship({ db, workspaceId, id }) {
  const result = await db.query(
    `
      -- loadDocumentProject
      SELECT id, name, property_id
      FROM projects
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      LIMIT 1
    `,
    [workspaceId, id]
  );
  return result.rows[0] || null;
}

async function loadActiveExpenseRelationship({ db, workspaceId, id }) {
  const result = await db.query(
    `
      -- loadDocumentExpense
      SELECT id, description, property_id, project_id
      FROM expenses
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [workspaceId, id]
  );
  return result.rows[0] || null;
}

function invalidRelationship(field, issue) {
  return apiError(400, "invalid_request", "Invalid document relationship.", [
    {
      field,
      issue
    }
  ]);
}

async function getDocumentByIdIncludingDeleted({ db, workspaceId, documentId }) {
  const result = await db.query(
    `
      -- getDocumentByIdIncludingDeleted
      SELECT ${documentColumns()}
      FROM documents d
      ${documentJoins()}
      WHERE d.workspace_id = $1
        AND d.id = $2
      LIMIT 1
    `,
    [workspaceId, documentId]
  );

  return result.rows[0] ? mapDocumentRow(result.rows[0]) : null;
}

function documentColumns() {
  return `
    ${documentBaseColumns()},
    p.name AS property_name,
    pr.name AS project_name,
    e.description AS expense_description,
    f.id AS file_id,
    f.original_file_name AS file_original_file_name,
    f.mime_type AS file_mime_type,
    f.size_bytes AS file_size_bytes,
    f.status AS file_status,
    o.status AS ocr_status,
    (o.text IS NOT NULL AND length(o.text) > 0 AND o.status = 'succeeded' AND o.document_file_id = f.id AND f.status = 'available') AS ocr_has_text,
    o.completed_at AS ocr_completed_at
  `;
}

function documentBaseColumns() {
  return `
    d.id,
    d.workspace_id,
    d.property_id,
    d.project_id,
    d.expense_id,
    d.display_name,
    d.document_type,
    d.document_date,
    d.notes,
    d.file_availability,
    d.file_status_note,
    d.deleted_at,
    d.created_at,
    d.updated_at
  `;
}

function documentJoins() {
  return `
    JOIN properties p
      ON p.workspace_id = d.workspace_id
     AND p.id = d.property_id
    LEFT JOIN projects pr
      ON pr.workspace_id = d.workspace_id
     AND pr.id = d.project_id
    LEFT JOIN expenses e
      ON e.workspace_id = d.workspace_id
     AND e.id = d.expense_id
    LEFT JOIN LATERAL (
      SELECT df.id, df.original_file_name, df.mime_type, df.size_bytes, df.status
      FROM document_files df
      WHERE df.workspace_id = d.workspace_id
        AND df.document_id = d.id
        AND df.deleted_at IS NULL
      ORDER BY CASE WHEN df.status = 'available' THEN 0 ELSE 1 END, df.created_at DESC, df.id ASC
      LIMIT 1
    ) f ON true
    LEFT JOIN document_ocr o
      ON o.workspace_id = d.workspace_id
     AND o.document_id = d.id
  `;
}

function mapDocumentRow(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    propertyId: row.property_id,
    propertyName: row.property_name || null,
    projectId: row.project_id || null,
    projectName: row.project_name || null,
    expenseId: row.expense_id || null,
    expenseDescription: row.expense_description || null,
    displayName: row.display_name,
    documentType: row.document_type,
    documentDate: formatDateOnly(row.document_date),
    notes: row.notes || null,
    fileAvailability: row.file_availability,
    fileStatusNote: row.file_status_note || null,
    file: row.file_id
      ? {
          id: row.file_id,
          original_file_name: row.file_original_file_name,
          mime_type: row.file_mime_type,
          size_bytes: Number(row.file_size_bytes || 0),
          status: row.file_status
        }
      : null,
    ocr: {
      status: row.ocr_status || "not_requested",
      has_text: Boolean(row.ocr_has_text),
      completed_at: formatTimestamp(row.ocr_completed_at)
    },
    deletedAt: formatTimestamp(row.deleted_at),
    createdAt: formatTimestamp(row.created_at),
    updatedAt: formatTimestamp(row.updated_at)
  };
}

function mapOcrStatus(row) {
  const status = row.ocr_status || "not_requested";
  return {
    documentId: row.document_id,
    documentFileId: row.document_file_id || row.active_file_id || null,
    status,
    requestedAt: formatTimestamp(row.ocr_started_at || row.ocr_created_at),
    completedAt: formatTimestamp(row.ocr_completed_at),
    textAvailable: Boolean(row.ocr_text_available),
    engine: row.ocr_engine || null,
    failureReason: status === "failed" || status === "skipped"
      ? sanitizeOcrError(row.ocr_error_message || row.ocr_error_code)
      : null
  };
}

function normalizeRelationshipId(value, field, { required }, details) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      details.push({ field, issue: "required" });
      return undefined;
    }
    return null;
  }
  const normalized = String(value || "").trim();
  if (!UUID_PATTERN.test(normalized)) {
    throw apiError(400, "invalid_request", `Invalid ${field}.`, [
      {
        field,
        issue: "invalid_uuid"
      }
    ]);
  }
  return normalized;
}

function addUuidFilter({ filters, field, column, params, where, nullable = false }) {
  if (filters[field] === undefined) {
    return;
  }
  const value = String(filters[field] || "").trim();
  if (!value && nullable) {
    where.push(`${column} IS NULL`);
    return;
  }
  if (!UUID_PATTERN.test(value)) {
    throw apiError(400, "invalid_request", `Invalid ${field}.`);
  }
  params.push(value);
  where.push(`${column} = $${params.length}`);
}

function addTextFilter({ filters, field, column, params, where }) {
  const value = normalizeOptionalText(filters[field]);
  if (!value) {
    return;
  }
  params.push(value);
  where.push(`${column} = $${params.length}`);
}

function addDateRangeFilter({ filters, fromField, toField, column, params, where }) {
  const from = normalizeDate(filters[fromField]);
  if (from === false) {
    throw apiError(400, "invalid_request", `Invalid ${fromField}.`);
  }
  if (from) {
    params.push(from);
    where.push(`${column} >= $${params.length}::date`);
  }

  const to = normalizeDate(filters[toField]);
  if (to === false) {
    throw apiError(400, "invalid_request", `Invalid ${toField}.`);
  }
  if (to) {
    params.push(to);
    where.push(`${column} <= $${params.length}::date`);
  }
}

function normalizeNullableField({ body, normalized, hasKey, valueKey, field, maxLength, partial, details }) {
  if (normalized[hasKey]) {
    normalized[valueKey] = normalizeNullableText(body[field]);
    if (normalized[valueKey] && normalized[valueKey].length > maxLength) {
      details.push({ field, issue: "too_long" });
    }
  } else if (!partial) {
    normalized[valueKey] = null;
  }
}

function normalizeRequiredText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  return String(value || "").trim();
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeOcrText(value) {
  const normalized = String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  return normalized || null;
}

function normalizeOcrStatus(value) {
  const normalized = String(value || "").trim();
  return ["queued", "processing", "succeeded", "failed", "skipped"].includes(normalized)
    ? normalized
    : "queued";
}

function sanitizeOcrError(value) {
  const normalized = normalizeNullableText(value);
  return normalized ? normalized.slice(0, 240) : null;
}

function sha256Hex(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function normalizeDate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return false;
  }
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? false
    : normalized;
}

function validateFileIntentInput(input) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const details = [];
  for (const field of Object.keys(body)) {
    if (!FILE_INTENT_INPUT_FIELDS.has(field)) {
      details.push({ field, issue: "unknown_field" });
    }
  }

  const originalFileName = sanitizeFileName(body.original_file_name);
  if (!originalFileName) {
    details.push({ field: "original_file_name", issue: "required" });
  }

  const mimeType = normalizeOptionalText(body.mime_type).toLowerCase();
  if (!mimeType) {
    details.push({ field: "mime_type", issue: "required" });
  }
  const unsupportedType = mimeType && (!ALLOWED_FILE_TYPES.has(mimeType) || isBlockedFileType({ fileName: originalFileName, mimeType }));
  if (unsupportedType) {
    throw apiError(415, "unsupported_media_type", "This document file type cannot be uploaded.", [
      {
        field: "mime_type",
        issue: "unsupported_media_type"
      }
    ]);
  }

  const sizeBytes = normalizeSizeBytes(body.size_bytes);
  if (sizeBytes === null) {
    details.push({ field: "size_bytes", issue: "required" });
  } else if (sizeBytes < 0) {
    details.push({ field: "size_bytes", issue: "invalid_size" });
  } else if (sizeBytes > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw apiError(413, "payload_too_large", "Document file is too large.", [
      {
        field: "size_bytes",
        issue: "too_large",
        max_size_bytes: MAX_DOCUMENT_FILE_SIZE_BYTES
      }
    ]);
  }

  const sha256 = normalizeHash(body.sha256, details);
  const source = normalizeOptionalText(body.source) || "web_upload";
  if (!FILE_SOURCES.has(source)) {
    details.push({ field: "source", issue: "invalid_source" });
  }

  if (details.length > 0) {
    throw validationError(details);
  }

  return {
    originalFileName,
    mimeType,
    sizeBytes,
    sha256,
    source
  };
}

function validateFileCompleteInput(input) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const details = [];
  for (const field of Object.keys(body)) {
    if (!FILE_COMPLETE_INPUT_FIELDS.has(field)) {
      details.push({ field, issue: "unknown_field" });
    }
  }

  const documentFileId = normalizeRelationshipId(body.document_file_id, "document_file_id", { required: true }, details);
  const uploadId = normalizeRelationshipId(body.upload_id, "upload_id", { required: false }, details);
  if (uploadId && documentFileId && uploadId !== documentFileId) {
    details.push({ field: "upload_id", issue: "metadata_mismatch" });
  }

  const sizeBytes = normalizeSizeBytes(body.size_bytes);
  if (sizeBytes === null) {
    details.push({ field: "size_bytes", issue: "required" });
  } else if (sizeBytes < 0 || sizeBytes > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    details.push({ field: "size_bytes", issue: "invalid_size" });
  }

  const sha256 = normalizeHash(body.sha256, details);

  if (details.length > 0) {
    throw validationError(details);
  }

  return {
    documentFileId,
    uploadId: uploadId || documentFileId,
    sizeBytes,
    sha256
  };
}

function validateFileUploadInput({ documentFileId, uploadId, bytes }) {
  const details = [];
  const normalizedDocumentFileId = normalizeRelationshipId(documentFileId, "document_file_id", { required: true }, details);
  const normalizedUploadId = normalizeRelationshipId(uploadId, "upload_id", { required: false }, details);
  if (normalizedUploadId && normalizedDocumentFileId && normalizedUploadId !== normalizedDocumentFileId) {
    details.push({ field: "upload_id", issue: "metadata_mismatch" });
  }

  const uploadBytes = normalizeUploadBytes(bytes);
  if (uploadBytes.byteLength === 0) {
    details.push({ field: "file", issue: "required" });
  } else if (uploadBytes.byteLength > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw apiError(413, "payload_too_large", "Document file is too large.", [
      {
        field: "file",
        issue: "too_large",
        max_size_bytes: MAX_DOCUMENT_FILE_SIZE_BYTES
      }
    ]);
  }

  if (details.length > 0) {
    throw validationError(details);
  }

  return {
    documentFileId: normalizedDocumentFileId,
    uploadId: normalizedUploadId || normalizedDocumentFileId,
    bytes: uploadBytes
  };
}

function normalizeUploadBytes(value) {
  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  return new Uint8Array(Buffer.from(value || ""));
}

function normalizeContentType(value) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

function sanitizeFileName(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop()
    ?.trim()
    .slice(0, FILENAME_MAX_LENGTH) || "";
}

function isBlockedFileType({ fileName, mimeType }) {
  const loweredName = String(fileName || "").toLowerCase();
  const loweredMimeType = String(mimeType || "").toLowerCase();
  return (
    BLOCKED_FILE_EXTENSIONS.some((extension) => loweredName.endsWith(extension)) ||
    BLOCKED_MIME_PREFIXES.some((prefix) => loweredMimeType.startsWith(prefix))
  );
}

function normalizeSizeBytes(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : -1;
}

function normalizeHash(value, details) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const hash = String(value || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    details.push({ field: "sha256", issue: "invalid_hash" });
    return null;
  }
  return hash;
}

function parseLimit(value) {
  const limit = Number.parseInt(String(value || DEFAULT_LIMIT), 10);
  if (!Number.isInteger(limit) || limit < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(limit, MAX_LIMIT);
}

function parseOffset(value) {
  const offset = Number.parseInt(String(value || 0), 10);
  if (!Number.isInteger(offset) || offset < 0) {
    return 0;
  }
  return offset;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function formatDateOnly(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function formatTimestamp(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function compareNamedOptions(left, right) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareExpenseOptions(left, right) {
  return left.description.localeCompare(right.description) || left.id.localeCompare(right.id);
}
