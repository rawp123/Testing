import type { DocumentInput, DocumentRecord, ExpenseRecord, ProjectRecord, PropertyRecord } from "../api/types";
import { formatCents, formatDate } from "../utils/format";

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "receipt", label: "Receipt" },
  { value: "invoice", label: "Invoice" },
  { value: "permit", label: "Permit" },
  { value: "warranty", label: "Warranty" },
  { value: "photo", label: "Photo" },
  { value: "contract", label: "Contract" },
  { value: "note", label: "Note" },
  { value: "other", label: "Other" }
] as const;

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_FILE_HELPER_COPY = "PDF, image, receipt, invoice, permit, or note. Maximum file size: 25 MB.";

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "text/plain"
]);

const BLOCKED_DOCUMENT_EXTENSIONS = [
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

const BLOCKED_DOCUMENT_MIME_PREFIXES = [
  "application/x-",
  "text/html",
  "text/javascript"
];

export interface DocumentFormValues {
  propertyId: string;
  projectId: string;
  expenseId: string;
  displayName: string;
  documentType: string;
  documentDate: string;
  notes: string;
}

export interface DocumentRow {
  id: string;
  name: string;
  type: string;
  linkedTo: string;
  fileStatus: string;
  fileMeta: string;
  ocrStatus: string;
  ocrMeta: string;
  documentDate: string;
  openItems: string;
  openItemCount: number;
  hasFile: boolean;
  canRequestOcr: boolean;
  canReadOcrText: boolean;
  source: DocumentRecord;
}

export interface SelectOption {
  value: string;
  label: string;
  propertyId?: string;
  projectId?: string | null;
}

export function toDocumentRows(documents: DocumentRecord[]): DocumentRow[] {
  return documents.map((document) => {
    const file = document.file || null;
    const ocrStatus = String(document.ocr?.status || "not_requested");
    const hasFile = document.file_availability === "available" && Boolean(file);
    const hasText = Boolean(document.ocr?.has_text);
    return {
      id: document.id,
      name: document.display_name || "Untitled document",
      type: documentTypeLabel(document.document_type),
      linkedTo: [document.property_name, document.project_name, document.expense_description].filter(Boolean).join(" · ") || "Not linked",
      fileStatus: fileAvailabilityLabel(document.file_availability),
      fileMeta: file ? formatDocumentFileSummary(file) : document.file_status_note || "No file attached",
      ocrStatus: ocrStatusLabel(document.ocr?.status, document.ocr?.has_text),
      ocrMeta: ocrStatusDetail(document),
      documentDate: document.document_date ? formatDate(document.document_date) : "No date",
      openItems: formatOpenItemCount(document.open_item_count),
      openItemCount: document.open_item_count,
      hasFile,
      canRequestOcr: hasFile && !hasText && !["queued", "processing"].includes(ocrStatus),
      canReadOcrText: hasText,
      source: document
    };
  });
}

export function documentToFormValues(document?: DocumentRecord | null, fallbackPropertyId = ""): DocumentFormValues {
  return {
    propertyId: document?.property_id || fallbackPropertyId,
    projectId: document?.project_id || "",
    expenseId: document?.expense_id || "",
    displayName: document?.display_name || "",
    documentType: document?.document_type || "receipt",
    documentDate: document?.document_date || "",
    notes: document?.notes || ""
  };
}

export function formValuesToDocumentInput(
  values: DocumentFormValues,
  selectedFileName = "",
  { includeFileState = true }: { includeFileState?: boolean } = {}
): DocumentInput {
  const displayName = values.displayName.trim() || safeFileName(selectedFileName);
  const input: DocumentInput = {
    property_id: nullableText(values.propertyId),
    project_id: nullableText(values.projectId),
    expense_id: nullableText(values.expenseId),
    display_name: displayName,
    document_type: values.documentType || "other",
    document_date: nullableText(values.documentDate),
    notes: nullableText(values.notes)
  };
  if (includeFileState) {
    input.file_availability = "not_uploaded";
    input.file_status_note = null;
  }
  return input;
}

export function propertyOptionsFromRecords(properties: PropertyRecord[]): SelectOption[] {
  return properties
    .map((property) => ({
      value: property.id,
      label: property.name || property.display_address || "Untitled property"
    }))
    .sort(compareOptions);
}

export function projectOptionsFromRecords(projects: ProjectRecord[], propertyId = ""): SelectOption[] {
  return projects
    .filter((project) => !propertyId || project.property_id === propertyId)
    .map((project) => ({
      value: project.id,
      label: project.name || "Untitled project",
      propertyId: project.property_id
    }))
    .sort(compareOptions);
}

export function expenseOptionsFromRecords(expenses: ExpenseRecord[], propertyId = "", projectId = ""): SelectOption[] {
  return expenses
    .filter((expense) => !propertyId || expense.property_id === propertyId)
    .filter((expense) => !projectId || expense.project_id === projectId)
    .map((expense) => ({
      value: expense.id,
      label: `${expense.vendor_name || expense.vendor_name_raw || "Unassigned / unknown"} · ${expense.expense_date ? formatDate(expense.expense_date) : "No date"} · ${formatCents(expense.amount_cents)}`,
      propertyId: expense.property_id,
      projectId: expense.project_id || null
    }))
    .sort(compareOptions);
}

export function documentTypeLabel(value: string | null | undefined) {
  return DOCUMENT_TYPE_OPTIONS.find((option) => option.value === value)?.label || titleCase(value || "other");
}

export function fileAvailabilityLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    available: "Attached",
    missing: "Missing file",
    not_uploaded: "Not uploaded",
    removed: "Removed",
    blocked: "Blocked",
    skipped: "Skipped",
    tutorial_metadata: "Sample file details",
    corrupt: "Corrupt",
    checksum_failed: "Checksum failed"
  };
  return labels[String(value || "")] || titleCase(value || "not_uploaded");
}

export function ocrStatusLabel(status: string | null | undefined, hasText = false) {
  if (hasText) return "Text available";
  const labels: Record<string, string> = {
    not_requested: "Not requested",
    queued: "Queued",
    processing: "Processing",
    succeeded: "No text",
    failed: "Failed",
    skipped: "Skipped"
  };
  return labels[String(status || "not_requested")] || titleCase(status || "not_requested");
}

export function ocrStatusDetail(document: DocumentRecord) {
  const status = String(document.ocr?.status || "not_requested");
  if (document.ocr?.has_text) {
    return document.ocr.completed_at ? `Text available · ${formatDate(document.ocr.completed_at)}` : "Text available";
  }
  if (document.file_availability !== "available" || !document.file) return "Attach a file before reading text.";
  if (status === "queued") return "Text reading has been requested.";
  if (status === "processing") return "Text reading is in progress.";
  if (status === "failed") return "Text could not be read.";
  if (status === "skipped") return "Text reading skipped.";
  if (status === "succeeded") return "No document text is available.";
  return "Text not requested.";
}

export function formatFileSize(value: number | string | null | undefined) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatDocumentFileSummary(file: {
  original_file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | string | null;
} | null | undefined) {
  if (!file) return "No file attached";
  return `${safeFileName(file.original_file_name || "Attached file")} · ${file.mime_type || "Unknown type"} · ${formatFileSize(file.size_bytes)}`;
}

export function documentFileHelperFor(document?: DocumentRecord | null) {
  if (document?.file) {
    return `Current file: ${formatDocumentFileSummary(document.file)}. Maximum file size: 25 MB.`;
  }
  return DOCUMENT_FILE_HELPER_COPY;
}

export function getDocumentFileValidationMessage(file: File | null | undefined) {
  if (!file) return "";
  const fileName = safeFileName(file.name);
  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return `Maximum file size: ${formatFileSize(MAX_DOCUMENT_FILE_SIZE_BYTES)}.`;
  }
  const mimeType = String(file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType) || isBlockedDocumentFile({ fileName, mimeType })) {
    return "Use a PDF, image, receipt, invoice, permit, or note file.";
  }
  return "";
}

export function safeFileName(value: string | null | undefined) {
  const text = String(value || "").split(/[/\\]/).filter(Boolean).at(-1) || "";
  return text.replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

function isBlockedDocumentFile({ fileName, mimeType }: { fileName: string; mimeType: string }) {
  const loweredName = fileName.toLowerCase();
  const loweredMimeType = mimeType.toLowerCase();
  return (
    BLOCKED_DOCUMENT_EXTENSIONS.some((extension) => loweredName.endsWith(extension)) ||
    BLOCKED_DOCUMENT_MIME_PREFIXES.some((prefix) => loweredMimeType.startsWith(prefix))
  );
}

function formatOpenItemCount(value: unknown) {
  const count = Number(value || 0);
  if (count <= 0) return "Clear";
  return count === 1 ? "1 open" : `${count} open`;
}

function compareOptions(left: SelectOption, right: SelectOption) {
  return left.label.localeCompare(right.label) || left.value.localeCompare(right.value);
}

function titleCase(value: string) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Other";
}

function nullableText(value: string) {
  const text = String(value || "").trim();
  return text ? text : null;
}
