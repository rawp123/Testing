import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DOCUMENT_CSV_HEADERS,
  EXPENSE_CSV_HEADERS,
  buildFullJsonExport
} from "../src/exports.js";
import {
  FOLLOW_UP_REASON_CODES,
  FOLLOW_UP_SEVERITIES,
  FOLLOW_UP_STATUSES,
  LOCAL_TO_SAAS_FIELD_MAP,
  SAAS_DOCUMENTATION_STATUSES,
  SAAS_DOCUMENT_FILE_STATUSES,
  SAAS_DOCUMENT_TYPES,
  SAAS_EXPENSE_CLASSIFICATIONS,
  SAAS_FILE_AVAILABILITIES,
  SAAS_OCR_STATUSES,
  SAAS_PROJECT_STATUSES,
  centsToDecimalString,
  localDollarsToCents,
  mapLocalDocumentFileAvailability,
  mapLocalDocumentForSaaSMetadata,
  mapLocalDocumentOcrStatus,
  mapLocalDocumentType,
  mapLocalDocumentationStatus,
  mapLocalExpenseCategory,
  mapLocalExpenseClassification,
  mapLocalProjectCategory,
  mapLocalProjectStatus,
  normalizeLegacyLabel
} from "../src/compatibility.js";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

const LOCAL_FIXTURE = JSON.parse(
  await readFile(new URL("./fixtures/local-app-sample.json", import.meta.url), "utf8")
);

const EXPECTED_EXPENSE_CSV_HEADERS = [
  "Export Source",
  "Export Date",
  "Property",
  "Project",
  "Vendor ID",
  "Category",
  "Date",
  "Vendor/Payee",
  "Description",
  "Amount",
  "Amount cents",
  "Cost type",
  "Receipt/file status",
  "Notes",
  "Expense ID",
  "Property ID",
  "Project ID",
  "Document count",
  "Created at",
  "Updated at"
];

const EXPECTED_DOCUMENT_CSV_HEADERS = [
  "document_id",
  "title",
  "document_type",
  "property_id",
  "property_name",
  "project_id",
  "project_name",
  "expense_id",
  "expense_description",
  "file_available",
  "file_mime_type",
  "file_size_bytes",
  "ocr_status",
  "text_available",
  "notes",
  "created_at",
  "updated_at"
];

test("local enum values map to canonical SaaS vocabulary", () => {
  assert.equal(mapLocalExpenseClassification("potential basis addition"), "possible_improvement");
  assert.equal(mapLocalExpenseClassification("repair or maintenance"), "repair_upkeep");
  assert.equal(mapLocalExpenseClassification("unclear / ask CPA"), "review_later");
  assert.equal(mapLocalExpenseClassification("possible_improvement"), "possible_improvement");
  assert.equal(mapLocalExpenseClassification("unknown legacy label"), "review_later");

  assert.equal(mapLocalDocumentationStatus("receipt attached"), "receipt_attached");
  assert.equal(mapLocalDocumentationStatus("invoice attached"), "invoice_attached");
  assert.equal(mapLocalDocumentationStatus("no document yet"), "no_document_yet");
  assert.equal(mapLocalDocumentationStatus("needs follow-up"), "needs_follow_up");
  assert.equal(mapLocalDocumentationStatus("strange old value"), "needs_follow_up");

  assert.equal(mapLocalProjectStatus("in progress"), "in_progress");
  assert.equal(mapLocalProjectStatus("blocked / waiting"), "blocked");
  assert.equal(mapLocalProjectStatus("unexpected"), "planned");

  assert.equal(mapLocalProjectCategory("HVAC"), "HVAC");
  assert.equal(mapLocalProjectCategory("deck/patio/porch"), "deck/patio/porch");
  assert.equal(mapLocalExpenseCategory("permits/fees"), "permits/fees");
  assert.equal(mapLocalExpenseCategory("unknown custom category"), "other");

  assert.equal(mapLocalDocumentType("payment proof"), "payment record");
  assert.equal(mapLocalDocumentType("plan/drawing"), "plan or drawing");
  assert.equal(mapLocalDocumentType("unknown doc"), "other");
});

test("canonical SaaS values stay snake_case or documented safe strings", () => {
  for (const value of [
    ...SAAS_EXPENSE_CLASSIFICATIONS,
    ...SAAS_DOCUMENTATION_STATUSES,
    ...SAAS_PROJECT_STATUSES,
    ...SAAS_FILE_AVAILABILITIES,
    ...SAAS_DOCUMENT_FILE_STATUSES,
    ...SAAS_OCR_STATUSES,
    ...FOLLOW_UP_REASON_CODES,
    ...FOLLOW_UP_SEVERITIES,
    ...FOLLOW_UP_STATUSES
  ]) {
    assert.match(value, /^[a-z0-9_]+$/);
  }

  for (const value of SAAS_DOCUMENT_TYPES) {
    assert.equal(value, normalizeLegacyLabel(value));
  }
});

test("money conversion is deterministic and rejects ambiguous local values", () => {
  assert.equal(localDollarsToCents(0), 0);
  assert.equal(localDollarsToCents(1), 100);
  assert.equal(localDollarsToCents(1.23), 123);
  assert.equal(localDollarsToCents("1.23"), 123);
  assert.equal(localDollarsToCents("1,234.56"), 123456);
  assert.equal(localDollarsToCents("$1,234.50"), 123450);

  assert.equal(centsToDecimalString(0), "0.00");
  assert.equal(centsToDecimalString(123), "1.23");
  assert.equal(centsToDecimalString(123456), "1234.56");

  for (const value of ["", "abc", "1.234", "-1", NaN, Infinity, null, undefined, {}, 0.1 + 0.2]) {
    assert.throws(() => localDollarsToCents(value));
  }
});

test("document file and OCR compatibility strips local-only sensitive fields", () => {
  const mapped = mapLocalDocumentForSaaSMetadata(LOCAL_FIXTURE.document);

  assert.equal(mapped.display_name, "Deck invoice");
  assert.equal(mapped.document_type, "invoice");
  assert.equal(mapped.document_date, "2025-03-11");
  assert.equal(mapped.file_availability, "available");
  assert.deepEqual(mapped.file, {
    original_file_name: "Deck Invoice.pdf",
    mime_type: "application/pdf",
    size_bytes: 92160
  });
  assert.deepEqual(mapped.ocr, {
    status: "succeeded",
    text_available: true
  });

  const serialized = JSON.stringify(mapped);
  assert.equal(serialized.includes("/Users/robert"), false);
  assert.equal(serialized.includes("local-file-1"), false);
  assert.equal(serialized.includes("Sensitive OCR text"), false);
  assert.equal(Object.hasOwn(mapped, "ocrText"), false);
  assert.equal(Object.hasOwn(mapped.file, "storage_key"), false);
});

test("document file availability and OCR status map local restore states safely", () => {
  assert.equal(mapLocalDocumentFileAvailability({ hasFile: false }), "not_uploaded");
  assert.equal(mapLocalDocumentFileAvailability({ hasFile: true }), "available");
  assert.equal(mapLocalDocumentFileAvailability({ hasFile: false, fileStatusNote: "File removed." }), "removed");
  assert.equal(mapLocalDocumentFileAvailability({ hasFile: false, fileStatusNote: "File checksum did not match backup." }), "checksum_failed");
  assert.equal(mapLocalDocumentFileAvailability({ hasFile: false, fileStatusNote: "Sample file details only. No file content was included." }), "tutorial_metadata");
  assert.equal(mapLocalDocumentFileAvailability({ hasFile: false, fileStatusNote: "Restored without the attached file. File not included in backup." }), "missing");

  assert.equal(mapLocalDocumentOcrStatus({ hasFile: true, ocrText: "Text" }), "succeeded");
  assert.equal(mapLocalDocumentOcrStatus({ hasFile: false, ocrText: "Text" }), "skipped");
  assert.equal(mapLocalDocumentOcrStatus({ hasFile: true, ocrText: "" }), "not_requested");
});

test("follow-up reason severity and status values are stable and cover generated records", async () => {
  assert.deepEqual(FOLLOW_UP_SEVERITIES, ["missing_file", "needs_review", "missing_info", "info"]);
  assert.deepEqual(FOLLOW_UP_STATUSES, ["open", "resolved", "all"]);

  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  for (const item of response.json().data) {
    assert(FOLLOW_UP_REASON_CODES.includes(item.reason_code), item.reason_code);
    assert(FOLLOW_UP_SEVERITIES.includes(item.severity), item.severity);
    assert.equal(item.status, "open");
  }

  await app.close();
});

test("export compatibility locks SaaS headers and avoids local-only fields", () => {
  assert.deepEqual(EXPENSE_CSV_HEADERS, EXPECTED_EXPENSE_CSV_HEADERS);
  assert.deepEqual(DOCUMENT_CSV_HEADERS, EXPECTED_DOCUMENT_CSV_HEADERS);
  assert.deepEqual(LOCAL_FIXTURE.exportHeaders.expenseDetail, ["Date", "Expense", "Property", "Project", "Cost Type", "Receipt/File", "Amount"]);
  assert.notDeepEqual(EXPENSE_CSV_HEADERS, LOCAL_FIXTURE.exportHeaders.expenseDetail);

  const fullExport = buildFullJsonExport({
    workspaceId: "workspace",
    generatedAt: "2026-06-07T00:00:00.000Z",
    properties: [],
    projects: [],
    vendors: [],
    expenses: [],
    documents: [{
      id: "document-id",
      title: "Imported document",
      document_type: "invoice",
      document_date: "2026-06-07",
      property_id: "property-id",
      property_name: "Office",
      project_id: null,
      project_name: null,
      expense_id: null,
      expense_description: null,
      notes: "No text here",
      file_availability: "available",
      file_status_note: null,
      file_available: true,
      file_id: "document-file-id",
      file_original_file_name: "invoice.pdf",
      file_mime_type: "application/pdf",
      file_size_bytes: 1234,
      file_status: "available",
      ocr_status: "succeeded",
      text_available: true,
      text: "Sensitive OCR text should not export.",
      storage_key: "private/storage/key",
      download_url: "https://example.test/signed",
      created_at: "2026-06-07T00:00:00.000Z",
      updated_at: "2026-06-07T00:00:00.000Z"
    }]
  });

  const serialized = JSON.stringify(fullExport);
  assert.equal(serialized.includes("Sensitive OCR text"), false);
  assert.equal(serialized.includes("private/storage/key"), false);
  assert.equal(serialized.includes("download_url"), false);
});

test("field mapping documents local ids as import metadata not SaaS ids", () => {
  assert.equal(LOCAL_TO_SAAS_FIELD_MAP.property.id, "legacy_source.legacy_id");
  assert.equal(LOCAL_TO_SAAS_FIELD_MAP.expense.amount, "amount_cents");
  assert.equal(LOCAL_TO_SAAS_FIELD_MAP.document.fileId, "legacy file metadata only; never storage_key");
  assert.equal(LOCAL_TO_SAAS_FIELD_MAP.document.ocrText, "document_ocr.text through explicit text handling only");
});

test("compatibility vocabulary does not make unsafe conclusion language canonical", () => {
  const canonicalText = JSON.stringify({
    SAAS_EXPENSE_CLASSIFICATIONS,
    SAAS_DOCUMENTATION_STATUSES,
    SAAS_PROJECT_STATUSES,
    SAAS_DOCUMENT_TYPES,
    SAAS_FILE_AVAILABILITIES,
    SAAS_OCR_STATUSES,
    FOLLOW_UP_REASON_CODES,
    FOLLOW_UP_SEVERITIES
  }).toLowerCase();

  assert.equal(canonicalText.includes("ask cpa"), false);
  assert.equal(canonicalText.includes("deductible"), false);
  assert.equal(canonicalText.includes("irs-approved"), false);
  assert.equal(canonicalText.includes("audit-proof"), false);
  assert.equal(canonicalText.includes("tax-safe"), false);
  assert.equal(canonicalText.includes("basis-qualified"), false);
});

function createConfig(overrides = {}) {
  return {
    nodeEnv: "test",
    appEnv: "test",
    port: 0,
    databaseUrl: "postgres://example.test/home_ledger_test",
    requestIdHeader: "x-request-id",
    authProvider: "dev",
    devAuthEnabled: true,
    storageDriver: "local",
    ocrMode: "disabled",
    ...overrides
  };
}

function authHeaders(email) {
  return {
    [TEST_AUTH_EMAIL_HEADER]: email
  };
}
