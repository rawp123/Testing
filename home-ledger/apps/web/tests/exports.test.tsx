import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ExportSummaryResponse } from "../src/api/types";
import { ExportsView } from "../src/exports/ExportsPage";
import {
  EXPORT_OPTION_ROWS,
  generatedAtLabel,
  toExportSummaryMetrics
} from "../src/exports/export-model";

describe("Export screen", () => {
  it("maps summary counts and integer-cent totals for display", () => {
    const metrics = toExportSummaryMetrics(createSummary({ total_expense_amount_cents: 123456 }));

    expect(metrics).toEqual([
      { label: "Properties", value: "1", detail: "Included in full JSON" },
      { label: "Projects", value: "2", detail: "Included in full JSON" },
      { label: "Expenses", value: "3", detail: "$1,234.56 total" },
      { label: "Documents", value: "4", detail: "1 with OCR text available" }
    ]);
    expect(generatedAtLabel(createSummary())).toBe("Summary generated 06/07/2026");
  });

  it("renders API-backed export options and unavailable states", () => {
    const html = renderToStaticMarkup(
      <ExportsView
        onDownload={() => undefined}
        onRefresh={() => undefined}
        summary={createSummary()}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Export records");
    expect(html).toContain("Export summary");
    expect(html).toContain("Available exports");
    expect(html).toContain("Expense records");
    expect(html).toContain("Document records");
    expect(html).toContain("Full workspace data");
    expect(html).toContain("Download CSV");
    expect(html).toContain("Download JSON");
    expect(html).toContain("Review packet");
    expect(html).toContain("Unsupported");
    expect(html).toContain("Workspace-wide exports are available");
    expect(html).not.toContain("deductible");
    expect(html).not.toContain("IRS");
    expect(html).not.toContain("audit-proof");
    expect(html).not.toContain("tax-ready");
  });

  it("renders loading and error states with direct copy", () => {
    const html = renderToStaticMarkup(
      <ExportsView
        errorMessage="Export summary could not be loaded."
        loading
        onDownload={() => undefined}
        onRefresh={() => undefined}
        summary={null}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Export summary could not be loaded.");
    expect(html).toContain("Loading export summary");
    expect(html).toContain("Checking the records available for export.");
  });

  it("keeps unsupported export types disabled instead of creating fake downloads", () => {
    const unavailableRows = EXPORT_OPTION_ROWS.filter((row) => row.status === "unavailable");
    const supportedRows = EXPORT_OPTION_ROWS.filter((row) => row.status === "available");
    const html = renderToStaticMarkup(
      <ExportsView
        downloadKind="expenses_csv"
        onDownload={() => undefined}
        onRefresh={() => undefined}
        summary={createSummary()}
        workspaceName="Home records"
      />
    );

    expect(supportedRows.map((row) => row.kind)).toEqual(["expenses_csv", "documents_csv", "full_json"]);
    expect(unavailableRows).toHaveLength(3);
    expect(unavailableRows.every((row) => !row.kind)).toBe(true);
    expect(html).toContain("Downloading");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("ZIP package export is not exposed by the current SaaS API.");
  });
});

function createSummary(overrides: Partial<ExportSummaryResponse> = {}): ExportSummaryResponse {
  return {
    workspace_id: "workspace-1",
    generated_at: "2026-06-07T12:00:00.000Z",
    property_count: 1,
    project_count: 2,
    expense_count: 3,
    total_expense_amount_cents: 12345,
    document_count: 4,
    vendor_count: 5,
    review_later_count: 1,
    possible_improvement_total_cents: 10000,
    repair_upkeep_total_cents: 2345,
    text_available_document_count: 1,
    ...overrides
  };
}
