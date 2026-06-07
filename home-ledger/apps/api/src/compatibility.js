const TEXT_MAX_LENGTH = 5000;
const CATEGORY_MAX_LENGTH = 120;
const DOCUMENT_TYPE_MAX_LENGTH = 120;
const FILE_NAME_MAX_LENGTH = 180;

export const SAAS_EXPENSE_CLASSIFICATIONS = Object.freeze([
  "possible_improvement",
  "repair_upkeep",
  "review_later"
]);

export const SAAS_DOCUMENTATION_STATUSES = Object.freeze([
  "receipt_attached",
  "invoice_attached",
  "no_document_yet",
  "needs_follow_up"
]);

export const SAAS_PROJECT_STATUSES = Object.freeze([
  "planned",
  "in_progress",
  "blocked",
  "completed",
  "archived"
]);

export const SAAS_DOCUMENT_TYPES = Object.freeze([
  "receipt",
  "invoice",
  "permit",
  "warranty",
  "photo",
  "contract",
  "payment record",
  "appraisal",
  "inspection",
  "plan or drawing",
  "other"
]);

export const SAAS_FILE_AVAILABILITIES = Object.freeze([
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

export const SAAS_DOCUMENT_FILE_STATUSES = Object.freeze([
  "pending_upload",
  "available",
  "deleted"
]);

export const SAAS_OCR_STATUSES = Object.freeze([
  "not_requested",
  "queued",
  "processing",
  "succeeded",
  "failed",
  "skipped"
]);

export const FOLLOW_UP_REASON_CODES = Object.freeze([
  "property_missing_purchase_date",
  "property_missing_purchase_price",
  "project_missing_vendor",
  "project_missing_dates",
  "project_missing_scope",
  "project_missing_receipt_or_invoice",
  "project_missing_supporting_document",
  "project_missing_contract_or_estimate",
  "project_missing_permit_or_approval",
  "project_missing_before_after_photo",
  "project_missing_payment_proof",
  "expense_missing_vendor",
  "expense_review_later",
  "expense_missing_document_support",
  "expense_documented_without_support",
  "document_missing_file",
  "document_ocr_pending"
]);

export const FOLLOW_UP_SEVERITIES = Object.freeze([
  "missing_file",
  "needs_review",
  "missing_info",
  "info"
]);

export const FOLLOW_UP_STATUSES = Object.freeze([
  "open",
  "resolved",
  "all"
]);

export const LOCAL_EXPENSE_CLASSIFICATION_TO_SAAS = Object.freeze({
  "potential basis addition": "possible_improvement",
  "possible improvement": "possible_improvement",
  possible_improvement: "possible_improvement",
  "repair or maintenance": "repair_upkeep",
  "repair / upkeep": "repair_upkeep",
  "repair upkeep": "repair_upkeep",
  repair_upkeep: "repair_upkeep",
  "unclear / ask cpa": "review_later",
  "unclear / ask professional": "review_later",
  "not sure, review later": "review_later",
  "review later": "review_later",
  needs_review: "review_later",
  review_later: "review_later"
});

export const LOCAL_DOCUMENTATION_STATUS_TO_SAAS = Object.freeze({
  "receipt attached": "receipt_attached",
  receipt_attached: "receipt_attached",
  "invoice attached": "invoice_attached",
  invoice_attached: "invoice_attached",
  "no document yet": "no_document_yet",
  no_document_yet: "no_document_yet",
  "needs follow-up": "needs_follow_up",
  "needs follow up": "needs_follow_up",
  needs_follow_up: "needs_follow_up"
});

export const LOCAL_PROJECT_STATUS_TO_SAAS = Object.freeze({
  planned: "planned",
  "in progress": "in_progress",
  "in-progress": "in_progress",
  in_progress: "in_progress",
  blocked: "blocked",
  "blocked / waiting": "blocked",
  completed: "completed",
  archived: "archived"
});

export const LOCAL_DOCUMENT_TYPE_TO_SAAS = Object.freeze({
  receipt: "receipt",
  invoice: "invoice",
  permit: "permit",
  warranty: "warranty",
  photo: "photo",
  contract: "contract",
  "payment record": "payment record",
  "payment proof": "payment record",
  appraisal: "appraisal",
  inspection: "inspection",
  "plan or drawing": "plan or drawing",
  "plan/drawing": "plan or drawing",
  "plans/drawings": "plan or drawing",
  other: "other"
});

export const LOCAL_CATEGORY_TO_SAAS = Object.freeze({
  "addition/structural": "addition/structural",
  appliances: "appliances",
  attic: "attic",
  basement: "basement",
  bathroom: "bathroom",
  bedroom: "bedroom",
  "cleanup/hauling": "cleanup/hauling",
  "closets/storage": "closets/storage",
  "deck/patio/porch": "deck/patio/porch",
  demolition: "demolition",
  "dining room": "dining room",
  "drainage/grading": "drainage/grading",
  "driveway/walkway": "driveway/walkway",
  "drywall/plaster": "drywall/plaster",
  electrical: "electrical",
  "exterior masonry": "exterior masonry",
  "fence/gate": "fence/gate",
  "fireplace/chimney": "fireplace/chimney",
  flooring: "flooring",
  foundation: "foundation",
  garage: "garage",
  "gutters/downspouts": "gutters/downspouts",
  hvac: "HVAC",
  HVAC: "HVAC",
  inspection: "inspection",
  "insulation/weatherization": "insulation/weatherization",
  irrigation: "irrigation",
  kitchen: "kitchen",
  landscaping: "landscaping",
  "laundry/mudroom": "laundry/mudroom",
  lighting: "lighting",
  "living/family room": "living/family room",
  office: "office",
  "exterior painting": "exterior painting",
  "interior painting": "interior painting",
  "permits/fees": "permits/fees",
  "plans/design": "plans/design",
  plumbing: "plumbing",
  "pool/spa": "pool/spa",
  roof: "roof",
  "sewer/septic": "sewer/septic",
  siding: "siding",
  "smart home/security": "smart home/security",
  "solar/energy": "solar/energy",
  "stairs/railings": "stairs/railings",
  "tree work": "tree work",
  "trim/millwork": "trim/millwork",
  "warranty/service plan": "warranty/service plan",
  "water heater": "water heater",
  "well/water treatment": "well/water treatment",
  "whole home": "whole home",
  "windows/doors": "windows/doors",
  other: "other"
});

export const LOCAL_TO_SAAS_FIELD_MAP = Object.freeze({
  property: Object.freeze({
    id: "legacy_source.legacy_id",
    name: "name",
    address: "display_address",
    purchaseDate: "purchase_date",
    purchasePrice: "purchase_price_cents",
    notes: "notes",
    isPrimary: "is_primary"
  }),
  project: Object.freeze({
    id: "legacy_source.legacy_id",
    propertyId: "property_id via import mapping",
    vendorId: "vendor_id via import mapping",
    name: "name",
    category: "category",
    startDate: "start_date",
    completionDate: "completion_date",
    contractor: "contractor_name_raw",
    permitNumber: "permit_number",
    status: "status",
    scopeSummary: "scope_summary",
    notes: "notes",
    completenessOverrideNote: "completeness_override_note"
  }),
  expense: Object.freeze({
    id: "legacy_source.legacy_id",
    propertyId: "property_id via import mapping",
    projectId: "project_id via import mapping",
    vendorId: "vendor_id via import mapping",
    vendor: "vendor_name_raw",
    date: "expense_date",
    description: "description",
    amount: "amount_cents",
    classification: "record_treatment",
    category: "category",
    documentationStatus: "documentation_status",
    notes: "notes"
  }),
  document: Object.freeze({
    id: "legacy_source.legacy_id",
    propertyId: "property_id via import mapping",
    projectId: "project_id via import mapping",
    expenseId: "expense_id via import mapping",
    displayName: "display_name",
    documentType: "document_type",
    addedDate: "document_date",
    notes: "notes",
    hasFile: "file_availability plus document_files",
    fileId: "legacy file metadata only; never storage_key",
    fileName: "document_files.original_file_name",
    fileSize: "document_files.size_bytes",
    mimeType: "document_files.mime_type",
    ocrText: "document_ocr.text through explicit text handling only"
  })
});

export function normalizeLegacyLabel(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function mapLocalExpenseClassification(value) {
  return LOCAL_EXPENSE_CLASSIFICATION_TO_SAAS[normalizeLegacyLabel(value)] || "review_later";
}

export function mapLocalDocumentationStatus(value) {
  return LOCAL_DOCUMENTATION_STATUS_TO_SAAS[normalizeLegacyLabel(value)] || "needs_follow_up";
}

export function mapLocalProjectStatus(value) {
  return LOCAL_PROJECT_STATUS_TO_SAAS[normalizeLegacyLabel(value)] || "planned";
}

export function mapLocalProjectCategory(value) {
  return mapLocalCategory(value);
}

export function mapLocalExpenseCategory(value) {
  return mapLocalCategory(value);
}

export function mapLocalDocumentType(value) {
  return LOCAL_DOCUMENT_TYPE_TO_SAAS[normalizeLegacyLabel(value)] || "other";
}

export function mapLocalDocumentFileAvailability(documentRecord) {
  if (documentRecord?.hasFile) return "available";
  const note = normalizeLegacyLabel(documentRecord?.fileStatusNote || documentRecord?.fileName);
  if (!note) return "not_uploaded";
  if (note.includes("removed")) return "removed";
  if (note.includes("blocked")) return "blocked";
  if (note.includes("checksum")) return "checksum_failed";
  if (note.includes("corrupt")) return "corrupt";
  if (note.includes("skipped") || note.includes("too large") || note.includes("type skipped")) return "skipped";
  if (note.includes("sample file details only") || note.includes("tutorial")) return "tutorial_metadata";
  if (note.includes("restored without") || note.includes("not restored") || note.includes("missing")) return "missing";
  return "missing";
}

export function mapLocalDocumentOcrStatus(documentRecord) {
  const hasText = Boolean(normalizeText(documentRecord?.ocrText));
  if (hasText && documentRecord?.hasFile) return "succeeded";
  if (hasText && !documentRecord?.hasFile) return "skipped";
  return "not_requested";
}

export function mapLocalDocumentForSaaSMetadata(documentRecord) {
  const hasFile = Boolean(documentRecord?.hasFile);
  return {
    display_name: normalizeText(documentRecord?.displayName).slice(0, 240) || safeFileName(documentRecord?.fileName) || "Document",
    document_type: mapLocalDocumentType(documentRecord?.documentType),
    document_date: normalizeDateOnly(documentRecord?.addedDate),
    notes: normalizeText(documentRecord?.notes).slice(0, TEXT_MAX_LENGTH) || null,
    file_availability: mapLocalDocumentFileAvailability(documentRecord),
    file_status_note: normalizeText(documentRecord?.fileStatusNote).slice(0, 1000) || null,
    file: hasFile
      ? {
          original_file_name: safeFileName(documentRecord?.fileName),
          mime_type: normalizeMimeType(documentRecord?.mimeType),
          size_bytes: normalizeNonnegativeInteger(documentRecord?.fileSize)
        }
      : null,
    ocr: {
      status: mapLocalDocumentOcrStatus(documentRecord),
      text_available: Boolean(normalizeText(documentRecord?.ocrText)) && hasFile
    }
  };
}

export function localDollarsToCents(value) {
  const normalized = normalizeMoneyInput(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Invalid local dollar amount.");
  }
  const [dollars, cents = ""] = normalized.split(".");
  const result = BigInt(dollars) * 100n + BigInt(cents.padEnd(2, "0"));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Local dollar amount is too large.");
  }
  return Number(result);
}

export function centsToDecimalString(cents) {
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Cents must be a safe integer.");
  }
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function mapLocalCategory(value) {
  const normalized = normalizeLegacyLabel(value);
  return LOCAL_CATEGORY_TO_SAAS[normalized] || "other";
}

function normalizeMoneyInput(value) {
  if (value === null || value === undefined || value === "") {
    throw new Error("Local dollar amount is required.");
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid local dollar amount.");
    return String(value);
  }
  if (typeof value !== "string") {
    throw new Error("Invalid local dollar amount.");
  }
  return value
    .trim()
    .replace(/^\$/, "")
    .replace(/,/g, "");
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

function normalizeDateOnly(value) {
  const normalized = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeMimeType(value) {
  return normalizeText(value).toLowerCase() || "application/octet-stream";
}

function normalizeNonnegativeInteger(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function safeFileName(value) {
  const fileName = normalizeText(value)
    .split(/[\\/]/)
    .filter(Boolean)
    .pop();
  return fileName?.slice(0, FILE_NAME_MAX_LENGTH) || "Attached file";
}

void CATEGORY_MAX_LENGTH;
void DOCUMENT_TYPE_MAX_LENGTH;
