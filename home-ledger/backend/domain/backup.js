import {
  BACKUP_APP_ID,
  BACKUP_VERSION,
  EXPORT_PRODUCT_NAME,
  EXPORT_PRODUCT_VERSION,
  MAX_DOCUMENT_FILE_SIZE,
  removeLocalPaths,
  sanitizeData,
} from "./model.js";

export const MAX_BACKUP_DATA_URL_LENGTH = Math.ceil(MAX_DOCUMENT_FILE_SIZE * 1.38) + 4096;
export const BLOCKED_BACKUP_FILE_EXTENSIONS = [
  ".app",
  ".bat",
  ".cmd",
  ".command",
  ".exe",
  ".js",
  ".jse",
  ".msi",
  ".ps1",
  ".scr",
  ".sh",
  ".vbs",
  ".wsf",
];
export const BLOCKED_BACKUP_MIME_PREFIXES = [
  "application/x-ms",
  "application/x-sh",
  "text/javascript",
];

export function validateBackupEnvelope(backup) {
  if (!backup || backup.app !== BACKUP_APP_ID || !backup.data) {
    throw new Error("This does not look like a Home Basis Tracker backup.");
  }
  if (Number(backup.backupVersion || 1) > BACKUP_VERSION) {
    throw new Error("This backup was created by a newer version of Home Basis Tracker.");
  }
  validateBackupDataRelationships(backup.data);
  const data = sanitizeData(backup.data);
  return {
    data,
    files: normalizeBackupFileRecords(backup.files, data.documents),
  };
}

export function createBackupEnvelope(data, files, missingFiles, createdAt = new Date().toISOString()) {
  return {
    app: BACKUP_APP_ID,
    productName: EXPORT_PRODUCT_NAME,
    productVersion: EXPORT_PRODUCT_VERSION,
    exportType: "full-backup",
    backupVersion: BACKUP_VERSION,
    createdAt,
    data: sanitizeData(data),
    files: Array.isArray(files) ? files : [],
    missingFiles: Array.isArray(missingFiles) ? missingFiles : [],
  };
}

export function summarizeBackupEnvelope(backup) {
  const { data, files } = validateBackupEnvelope(backup);
  const documentsWithFileMetadata = data.documents.filter((document) => document.hasFile).length;
  const missingFilesCount = Array.isArray(backup?.missingFiles) ? backup.missingFiles.length : 0;

  return {
    createdAt: cleanBackupText(backup?.createdAt),
    counts: getBackupDataCounts(data),
    fileCount: files.length,
    documentsWithFileMetadata,
    missingFilesCount,
    expectedFilesMissingFromBackup: Math.max(0, documentsWithFileMetadata - files.length - missingFilesCount),
  };
}

export function findBackupFileForDocument(backupFiles, documentRecord) {
  if (!Array.isArray(backupFiles) || !documentRecord) return null;
  return backupFiles.find((fileRecord) =>
    fileRecord?.documentId === documentRecord.id ||
    fileRecord?.fileId === documentRecord.fileId
  ) || null;
}

export function stripDocumentFileMetadata(documentRecord, reason) {
  return {
    ...documentRecord,
    hasFile: false,
    fileId: "",
    fileName: reason,
    fileStatusNote: reason,
    mimeType: "",
    fileSize: 0,
    fileLastModified: null,
    fileStoredAt: "",
  };
}

export function reconcileRestoredExpenseDocumentation(expenses, documents) {
  return expenses.map((expense) => {
    if (!["receipt attached", "invoice attached"].includes(expense.documentationStatus)) {
      return expense;
    }

    const attachedDocuments = documents.filter((document) =>
      document.expenseId === expense.id &&
      document.hasFile &&
      ["receipt", "invoice"].includes(document.documentType)
    );

    if (attachedDocuments.some((document) => document.documentType === "invoice")) {
      return { ...expense, documentationStatus: "invoice attached" };
    }
    if (attachedDocuments.some((document) => document.documentType === "receipt")) {
      return { ...expense, documentationStatus: "receipt attached" };
    }
    return { ...expense, documentationStatus: "needs follow-up" };
  });
}

export function isBlockedBackupAttachment(fileRecord) {
  const fileName = String(fileRecord?.fileName || "").toLowerCase();
  const mimeType = String(fileRecord?.mimeType || "").toLowerCase();
  return (
    BLOCKED_BACKUP_FILE_EXTENSIONS.some((extension) => fileName.endsWith(extension)) ||
    BLOCKED_BACKUP_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))
  );
}

export function isBackupDataUrlTooLarge(dataUrl) {
  return typeof dataUrl !== "string" || dataUrl.length > MAX_BACKUP_DATA_URL_LENGTH;
}

export function getSafeRestoredFileName(name) {
  const pathRemoved = removeLocalPaths(name);
  if (pathRemoved.includes("[local file path removed]")) {
    return "[local file path removed]";
  }
  const fileName = pathRemoved
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop();
  return fileName?.trim() || "Attached file";
}

function validateBackupDataRelationships(data) {
  const properties = getBackupRecords(data?.properties).filter((property) =>
    cleanBackupText(property?.id) && cleanBackupText(property?.name)
  );
  const propertyIds = new Set(properties.map((property) => cleanBackupText(property.id)));
  const vendorIds = new Set(getBackupRecords(data?.vendors)
    .filter((vendor) => cleanBackupText(vendor?.id) && cleanBackupText(vendor?.name))
    .map((vendor) => cleanBackupText(vendor.id)));

  assertUniqueBackupIds(getBackupRecords(data?.vendors), "vendor");
  assertUniqueBackupIds(properties, "property");
  assertUniqueBackupIds(getBackupRecords(data?.projects), "project");
  assertUniqueBackupIds(getBackupRecords(data?.expenses), "expense");
  assertUniqueBackupIds(getBackupRecords(data?.documents), "document");

  const projects = getBackupRecords(data?.projects).filter((project) =>
    cleanBackupText(project?.id) && cleanBackupText(project?.name)
  );
  const projectById = new Map();
  for (const project of projects) {
    const id = cleanBackupText(project.id);
    const propertyId = cleanBackupText(project.propertyId);
    if (!propertyIds.has(propertyId)) {
      throw new Error("Backup contains a project that does not belong to a valid property.");
    }
    const vendorId = cleanBackupText(project.vendorId);
    if (vendorId && !vendorIds.has(vendorId) && !cleanBackupText(project.contractor)) {
      throw new Error("Backup contains a project linked to an unknown vendor.");
    }
    projectById.set(id, { propertyId });
  }

  const expenses = getBackupRecords(data?.expenses).filter((expense) =>
    cleanBackupText(expense?.id) &&
    cleanBackupText(expense?.vendor) &&
    cleanBackupText(expense?.description)
  );
  const expenseById = new Map();
  for (const expense of expenses) {
    const id = cleanBackupText(expense.id);
    const propertyId = cleanBackupText(expense.propertyId);
    const projectId = cleanBackupText(expense.projectId);
    if (!propertyIds.has(propertyId)) {
      throw new Error("Backup contains an expense that does not belong to a valid property.");
    }
    if (projectId && projectById.get(projectId)?.propertyId !== propertyId) {
      throw new Error("Backup contains an expense linked to a project from another property.");
    }
    const vendorId = cleanBackupText(expense.vendorId);
    if (vendorId && !vendorIds.has(vendorId) && !cleanBackupText(expense.vendor)) {
      throw new Error("Backup contains an expense linked to an unknown vendor.");
    }
    expenseById.set(id, { propertyId, projectId });
  }

  const documents = getBackupRecords(data?.documents).filter((document) =>
    cleanBackupText(document?.id) && cleanBackupText(document?.displayName)
  );
  for (const document of documents) {
    const propertyId = cleanBackupText(document.propertyId);
    const projectId = cleanBackupText(document.projectId);
    const expenseId = cleanBackupText(document.expenseId);

    if (expenseId) {
      const linkedExpense = expenseById.get(expenseId);
      if (!linkedExpense) {
        throw new Error("Backup contains a document linked to an unknown expense.");
      }
      if (propertyId && propertyId !== linkedExpense.propertyId) {
        throw new Error("Backup contains a document linked to a different property than its expense.");
      }
      if (projectId && projectId !== linkedExpense.projectId) {
        throw new Error("Backup contains a document linked to a different project than its expense.");
      }
      continue;
    }

    if (!propertyIds.has(propertyId)) {
      throw new Error("Backup contains a document that does not belong to a valid property.");
    }
    if (projectId && projectById.get(projectId)?.propertyId !== propertyId) {
      throw new Error("Backup contains a document linked to a project from another property.");
    }
  }
}

function normalizeBackupFileRecords(files, documents) {
  if (!Array.isArray(files)) return [];

  const documentsWithFiles = new Set(
    documents
      .filter((document) => document.hasFile)
      .map((document) => document.id),
  );
  const documentFileIds = new Set(
    documents
      .filter((document) => document.hasFile && document.fileId)
      .map((document) => document.fileId),
  );
  const seenDocumentIds = new Set();
  const seenFileIds = new Set();
  const normalizedFiles = [];

  for (const fileRecord of files) {
    const normalizedFile = {
      documentId: cleanBackupText(fileRecord?.documentId),
      fileId: cleanBackupText(fileRecord?.fileId),
      fileName: getSafeRestoredFileName(fileRecord?.fileName),
      mimeType: cleanBackupText(fileRecord?.mimeType) || "application/octet-stream",
      fileSize: Math.max(0, Number(fileRecord?.fileSize) || 0),
      fileLastModified: fileRecord?.fileLastModified || null,
      fileStoredAt: cleanBackupText(fileRecord?.fileStoredAt),
      sha256: cleanBackupHash(fileRecord?.sha256),
      dataUrl: typeof fileRecord?.dataUrl === "string" ? fileRecord.dataUrl : "",
    };

    if (!normalizedFile.documentId && !normalizedFile.fileId) {
      throw new Error("Backup contains an attached file entry without a document link.");
    }
    if (normalizedFile.documentId) {
      if (seenDocumentIds.has(normalizedFile.documentId)) {
        throw new Error("Backup contains duplicate attached files for a document.");
      }
      if (!documentsWithFiles.has(normalizedFile.documentId)) {
        throw new Error("Backup contains an attached file for an unknown document.");
      }
      seenDocumentIds.add(normalizedFile.documentId);
    }
    if (normalizedFile.fileId) {
      if (seenFileIds.has(normalizedFile.fileId)) {
        throw new Error("Backup contains duplicate attached file ids.");
      }
      if (!normalizedFile.documentId && !documentFileIds.has(normalizedFile.fileId)) {
        throw new Error("Backup contains an attached file for an unknown document.");
      }
      seenFileIds.add(normalizedFile.fileId);
    }

    normalizedFiles.push(normalizedFile);
  }

  return normalizedFiles;
}

function assertUniqueBackupIds(records, label) {
  const seenIds = new Set();
  for (const record of getBackupRecords(records)) {
    const id = cleanBackupText(record?.id);
    if (!id) continue;
    if (seenIds.has(id)) {
      throw new Error(`Backup contains duplicate ${label} records.`);
    }
    seenIds.add(id);
  }
}

function getBackupRecords(value) {
  return Array.isArray(value) ? value : [];
}

function getBackupDataCounts(data) {
  return {
    vendors: data.vendors.length,
    properties: data.properties.length,
    projects: data.projects.length,
    expenses: data.expenses.length,
    documents: data.documents.length,
  };
}

function cleanBackupText(value) {
  return removeLocalPaths(value || "").trim();
}

function cleanBackupHash(value) {
  const hash = cleanBackupText(value).toLowerCase();
  if (!hash) return "";
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error("Backup contains an invalid file checksum.");
  }
  return hash;
}
