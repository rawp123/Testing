import type { ExpenseInput, ExpenseRecord, ProjectRecord, PropertyRecord } from "../api/types";
import { formatCents, formatDate, toInteger } from "../utils/format";

export const RECORD_TREATMENT_OPTIONS = [
  { value: "possible_improvement", label: "Possible improvement" },
  { value: "repair_upkeep", label: "Repair / upkeep" },
  { value: "review_later", label: "Not sure, review later" }
] as const;

export const DOCUMENTATION_STATUS_OPTIONS = [
  { value: "no_document_yet", label: "No document yet" },
  { value: "needs_follow_up", label: "Needs follow-up" },
  { value: "receipt_attached", label: "Receipt attached" },
  { value: "invoice_attached", label: "Invoice attached" }
] as const;

export interface ExpenseFormValues {
  propertyId: string;
  projectId: string;
  vendorId: string;
  vendorNameRaw: string;
  expenseDate: string;
  description: string;
  amount: string;
  category: string;
  recordTreatment: string;
  documentationStatus: string;
  notes: string;
}

export interface ExpenseRow {
  id: string;
  expense: string;
  vendor: string;
  linkedTo: string;
  category: string;
  recordTreatment: string;
  documentationStatus: string;
  expenseDate: string;
  amount: string;
  openItems: string;
  openItemCount: number;
  source: ExpenseRecord;
}

export interface SelectOption {
  value: string;
  label: string;
  propertyId?: string;
}

export function toExpenseRows(expenses: ExpenseRecord[]): ExpenseRow[] {
  return expenses.map((expense) => ({
    id: expense.id,
    expense: expense.description || "Untitled expense",
    vendor: expense.vendor_name || expense.vendor_name_raw || "Unassigned / unknown",
    linkedTo: [expense.property_name, expense.project_name].filter(Boolean).join(" · ") || "No linked project",
    category: titleCase(expense.category || "other"),
    recordTreatment: recordTreatmentLabel(expense.record_treatment),
    documentationStatus: documentationStatusLabel(expense.documentation_status),
    expenseDate: expense.expense_date ? formatDate(expense.expense_date) : "No date",
    amount: formatCents(expense.amount_cents),
    openItems: formatOpenItemCount(expense.open_item_count),
    openItemCount: Number(expense.open_item_count || 0),
    source: expense
  }));
}

export function expenseToFormValues(expense?: ExpenseRecord | null, fallbackPropertyId = ""): ExpenseFormValues {
  return {
    propertyId: expense?.property_id || fallbackPropertyId,
    projectId: expense?.project_id || "",
    vendorId: expense?.vendor_id || "",
    vendorNameRaw: expense?.vendor_id ? "" : expense?.vendor_name_raw || expense?.vendor_name || "",
    expenseDate: expense?.expense_date || "",
    description: expense?.description || "",
    amount: expense?.amount_cents === null || expense?.amount_cents === undefined
      ? ""
      : centsToDollarInput(expense.amount_cents),
    category: expense?.category || "",
    recordTreatment: expense?.record_treatment || "review_later",
    documentationStatus: expense?.documentation_status || "no_document_yet",
    notes: expense?.notes || ""
  };
}

export function formValuesToExpenseInput(values: ExpenseFormValues): ExpenseInput {
  return {
    property_id: values.propertyId,
    project_id: nullableText(values.projectId),
    vendor_id: nullableText(values.vendorId),
    vendor_name_raw: values.vendorId ? null : nullableText(values.vendorNameRaw),
    expense_date: nullableText(values.expenseDate),
    description: values.description.trim(),
    amount_cents: dollarsToCents(values.amount),
    currency_code: "USD",
    category: values.category.trim(),
    record_treatment: values.recordTreatment,
    documentation_status: values.documentationStatus,
    notes: nullableText(values.notes)
  };
}

export function applyExpenseVendorSelection(values: ExpenseFormValues, vendorId: string): ExpenseFormValues {
  return {
    ...values,
    vendorId,
    vendorNameRaw: vendorId ? "" : values.vendorNameRaw
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

export function recordTreatmentLabel(value: string | null | undefined) {
  return RECORD_TREATMENT_OPTIONS.find((option) => option.value === value)?.label || titleCase(value || "review_later");
}

export function documentationStatusLabel(value: string | null | undefined) {
  return DOCUMENTATION_STATUS_OPTIONS.find((option) => option.value === value)?.label || titleCase(value || "no_document_yet");
}

export function centsToDollarInput(value: number | string | null | undefined) {
  const cents = toInteger(value);
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainder = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}${dollars}.${remainder}`;
}

export function dollarsToCents(value: string) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const normalized = text.replace(/[$,]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
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
