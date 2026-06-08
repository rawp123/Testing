import type { ExportSummaryResponse } from "../api/types";
import { formatCents, formatDate } from "../utils/format";

export type ExportKind = "expenses_csv" | "documents_csv" | "full_json";

export interface ExportOptionRow {
  id: string;
  name: string;
  includes: string;
  format: string;
  status: "available" | "unavailable";
  actionLabel: string;
  kind?: ExportKind;
}

export interface ExportSummaryMetric {
  label: string;
  value: string;
  detail: string;
}

export const EXPORT_OPTION_ROWS: ExportOptionRow[] = [
  {
    id: "expenses-csv",
    name: "Expense records",
    includes: "Expense rows, linked property/project names, record type, document count, and integer-cent totals.",
    format: "CSV",
    status: "available",
    actionLabel: "Download CSV",
    kind: "expenses_csv"
  },
  {
    id: "documents-csv",
    name: "Document records",
    includes: "Document metadata, linked records, file availability, OCR status, and text availability.",
    format: "CSV",
    status: "available",
    actionLabel: "Download CSV",
    kind: "documents_csv"
  },
  {
    id: "full-json",
    name: "Full workspace data",
    includes: "Properties, projects, vendors, expenses, documents, file metadata, and OCR status metadata.",
    format: "JSON",
    status: "available",
    actionLabel: "Download JSON",
    kind: "full_json"
  },
  {
    id: "review-packet-pdf",
    name: "Review packet",
    includes: "Printable packet export is not connected yet.",
    format: "PDF",
    status: "unavailable",
    actionLabel: "Unavailable"
  },
  {
    id: "excel-workbook",
    name: "Workbook",
    includes: "Excel workbook export is not connected yet.",
    format: "Excel",
    status: "unavailable",
    actionLabel: "Unavailable"
  },
  {
    id: "document-package",
    name: "Document package",
    includes: "ZIP package export is not connected yet.",
    format: "ZIP",
    status: "unavailable",
    actionLabel: "Unavailable"
  }
];

export function toExportSummaryMetrics(summary: ExportSummaryResponse | null): ExportSummaryMetric[] {
  if (!summary) return [];
  return [
    {
      label: "Properties",
      value: String(summary.property_count || 0),
      detail: "Included in full JSON"
    },
    {
      label: "Projects",
      value: String(summary.project_count || 0),
      detail: "Included in full JSON"
    },
    {
      label: "Expenses",
      value: String(summary.expense_count || 0),
      detail: `${formatCents(summary.total_expense_amount_cents)} total`
    },
    {
      label: "Documents",
      value: String(summary.document_count || 0),
      detail: `${summary.text_available_document_count || 0} with OCR text available`
    }
  ];
}

export function generatedAtLabel(summary: ExportSummaryResponse | null) {
  return summary?.generated_at ? `Summary generated ${formatDate(summary.generated_at)}` : "Summary not loaded";
}
