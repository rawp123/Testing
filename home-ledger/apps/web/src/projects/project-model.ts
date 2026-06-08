import type { ProjectInput, ProjectRecord, PropertyRecord } from "../api/types";
import { formatDate } from "../utils/format";

export const PROJECT_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" }
] as const;

export interface ProjectFormValues {
  propertyId: string;
  vendorId: string;
  name: string;
  category: string;
  status: string;
  startDate: string;
  completionDate: string;
  contractorNameRaw: string;
  permitNumber: string;
  scopeSummary: string;
  notes: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  propertyName: string;
  category: string;
  status: string;
  dateRange: string;
  contractor: string;
  openItems: string;
  openItemCount: number;
  source: ProjectRecord;
}

export interface SelectOption {
  value: string;
  label: string;
}

export function toProjectRows(projects: ProjectRecord[]): ProjectRow[] {
  return projects.map((project) => ({
    id: project.id,
    name: project.name || "Untitled project",
    propertyName: project.property_name || "No property",
    category: titleCase(project.category || "other"),
    status: statusLabel(project.status),
    dateRange: formatDateRange(project.start_date, project.completion_date),
    contractor: project.vendor_name || project.contractor_name_raw || "No vendor",
    openItems: formatOpenItemCount(project.open_item_count),
    openItemCount: project.open_item_count,
    source: project
  }));
}

export function projectToFormValues(project?: ProjectRecord | null, fallbackPropertyId = ""): ProjectFormValues {
  return {
    propertyId: project?.property_id || fallbackPropertyId,
    vendorId: project?.vendor_id || "",
    name: project?.name || "",
    category: project?.category || "",
    status: project?.status && project.status !== "archived" ? project.status : "planned",
    startDate: project?.start_date || "",
    completionDate: project?.completion_date || "",
    contractorNameRaw: project?.vendor_id ? project?.contractor_name_raw || "" : project?.contractor_name_raw || project?.vendor_name || "",
    permitNumber: project?.permit_number || "",
    scopeSummary: project?.scope_summary || "",
    notes: project?.notes || ""
  };
}

export function formValuesToProjectInput(values: ProjectFormValues): ProjectInput {
  return {
    property_id: values.propertyId,
    vendor_id: nullableText(values.vendorId),
    name: values.name.trim(),
    category: values.category.trim(),
    status: values.status,
    start_date: nullableText(values.startDate),
    completion_date: nullableText(values.completionDate),
    contractor_name_raw: nullableText(values.contractorNameRaw),
    permit_number: nullableText(values.permitNumber),
    scope_summary: nullableText(values.scopeSummary),
    notes: nullableText(values.notes)
  };
}

export function applyProjectVendorSelection(values: ProjectFormValues, vendorId: string): ProjectFormValues {
  return {
    ...values,
    vendorId,
    contractorNameRaw: vendorId ? "" : values.contractorNameRaw
  };
}

export function propertyOptionsFromRecords(properties: PropertyRecord[]): SelectOption[] {
  return properties
    .map((property) => ({
      value: property.id,
      label: property.name || property.display_address || "Untitled property"
    }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.value.localeCompare(right.value));
}

export function statusLabel(status: string | null | undefined) {
  const match = PROJECT_STATUS_OPTIONS.find((option) => option.value === status);
  return match?.label || titleCase(status || "planned");
}

export function formatDateRange(startDate?: string | null, completionDate?: string | null) {
  const start = startDate ? formatDate(startDate) : "";
  const completion = completionDate ? formatDate(completionDate) : "";
  if (start && completion) return `${start} to ${completion}`;
  if (start) return `${start} to not completed`;
  if (completion) return `Completed ${completion}`;
  return "No dates";
}

function formatOpenItemCount(value: unknown) {
  const count = Number(value || 0);
  if (count <= 0) return "Clear";
  return count === 1 ? "1 open" : `${count} open`;
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
