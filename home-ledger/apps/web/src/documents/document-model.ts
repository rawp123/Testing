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
  documentDate: string;
  openItems: string;
  openItemCount: number;
  hasFile: boolean;
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
    return {
      id: document.id,
      name: document.display_name || "Untitled document",
      type: documentTypeLabel(document.document_type),
      linkedTo: [document.property_name, document.project_name, document.expense_description].filter(Boolean).join(" · ") || "Not linked",
      fileStatus: fileAvailabilityLabel(document.file_availability),
      fileMeta: file
        ? `${safeFileName(file.original_file_name || "Attached file")} · ${file.mime_type || "Unknown type"} · ${formatFileSize(file.size_bytes)}`
        : document.file_status_note || "No file attached",
      documentDate: document.document_date ? formatDate(document.document_date) : "No date",
      openItems: formatOpenItemCount(document.open_item_count),
      openItemCount: document.open_item_count,
      hasFile: document.file_availability === "available" && Boolean(file),
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

export function formValuesToDocumentInput(values: DocumentFormValues, selectedFileName = ""): DocumentInput {
  const displayName = values.displayName.trim() || safeFileName(selectedFileName);
  return {
    property_id: nullableText(values.propertyId),
    project_id: nullableText(values.projectId),
    expense_id: nullableText(values.expenseId),
    display_name: displayName,
    document_type: values.documentType || "other",
    document_date: nullableText(values.documentDate),
    notes: nullableText(values.notes),
    file_availability: "not_uploaded",
    file_status_note: null
  };
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

export function formatFileSize(value: number | string | null | undefined) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function safeFileName(value: string | null | undefined) {
  const text = String(value || "").split(/[/\\]/).filter(Boolean).at(-1) || "";
  return text.replace(/[\u0000-\u001f\u007f]/g, "").trim();
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
