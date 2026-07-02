import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FollowUpItem, FollowUpSummaryResponse } from "../src/api/types";
import { FollowUpsView } from "../src/follow-ups/FollowUpsPage";
import {
  applyFollowUpActionResult,
  buildSeverityFilterOptions,
  filterFollowUpRows,
  summarizeFollowUps,
  toFollowUpRows
} from "../src/follow-ups/follow-up-model";

describe("Follow-ups screen", () => {
  it("maps follow-up records to safe rows", () => {
    const rows = toFollowUpRows([createFollowUp()]);

    expect(rows[0]).toMatchObject({
      title: "Upload receipt file",
      description: "The receipt record exists, but the file has not been uploaded.",
      actionLabel: "Upload receipt file",
      severityLabel: "Missing file",
      targetLabel: "Document",
      statusLabel: "Open"
    });
    expect(JSON.stringify(rows)).not.toContain("private/object.pdf");
    expect(JSON.stringify(rows)).not.toContain("Sensitive recognized text");
  });

  it("renders loading empty and error states with direct copy", () => {
    const loadingHtml = renderToStaticMarkup(
      <FollowUpsView
        items={[]}
        loading
        onChangeSeverityFilter={() => undefined}
        onChangeStatusFilter={() => undefined}
        onChangeTargetFilter={() => undefined}
        onClearFilters={() => undefined}
        onReopenFollowUp={() => undefined}
        onResolveFollowUp={() => undefined}
        summary={createSummary({ open_count: 0, resolved_count: 0 })}
        workspaceName="Home records"
      />
    );
    expect(loadingHtml).toContain("Loading follow-ups.");

    const emptyHtml = renderToStaticMarkup(
      <FollowUpsView
        items={[]}
        onChangeSeverityFilter={() => undefined}
        onChangeStatusFilter={() => undefined}
        onChangeTargetFilter={() => undefined}
        onClearFilters={() => undefined}
        onReopenFollowUp={() => undefined}
        onResolveFollowUp={() => undefined}
        summary={createSummary({ open_count: 0, resolved_count: 0 })}
        workspaceName="Home records"
      />
    );
    expect(emptyHtml).toContain("No open follow-ups");
    expect(emptyHtml).toContain("Nothing needs review.");

    const errorHtml = renderToStaticMarkup(
      <FollowUpsView
        errorMessage="We couldn't load follow-ups."
        items={[]}
        onChangeSeverityFilter={() => undefined}
        onChangeStatusFilter={() => undefined}
        onChangeTargetFilter={() => undefined}
        onClearFilters={() => undefined}
        onReopenFollowUp={() => undefined}
        onResolveFollowUp={() => undefined}
        summary={createSummary()}
        workspaceName="Home records"
      />
    );
    expect(errorHtml).toContain("We couldn&#x27;t load follow-ups.");
  });

  it("renders populated list summary filters and resolve actions", () => {
    const html = renderToStaticMarkup(
      <FollowUpsView
        items={[
          createFollowUp(),
          createFollowUp({
            id: "fu_22222222222222222222222222222222",
            target_type: "expense",
            severity: "needs_review",
            title: "Review cost type",
            action_label: "Review cost type",
            description: "Cedarline Carpentry is marked Review later."
          })
        ]}
        onChangeSeverityFilter={() => undefined}
        onChangeStatusFilter={() => undefined}
        onChangeTargetFilter={() => undefined}
        onClearFilters={() => undefined}
        onReopenFollowUp={() => undefined}
        onResolveFollowUp={() => undefined}
        summary={createSummary()}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Follow-ups");
    expect(html).toContain("1</strong> open");
    expect(html).toContain("1</strong> resolved");
    expect(html).toContain("Open");
    expect(html).toContain("Resolved");
    expect(html).toContain("Missing file");
    expect(html).toContain("Review needed");
    expect(html).toContain("Document");
    expect(html).toContain("Expense");
    expect(html).toContain("Upload receipt file");
    expect(html).toContain("Review cost type");
  });

  it("renders resolved rows with reopen action and permission notice", () => {
    const html = renderToStaticMarkup(
      <FollowUpsView
        items={[createFollowUp({
          status: "resolved",
          resolved_at: "2026-06-07T12:00:00.000Z"
        })]}
        notice="This action requires a different workspace role."
        onChangeSeverityFilter={() => undefined}
        onChangeStatusFilter={() => undefined}
        onChangeTargetFilter={() => undefined}
        onClearFilters={() => undefined}
        onReopenFollowUp={() => undefined}
        onResolveFollowUp={() => undefined}
        statusFilter="resolved"
        summary={createSummary()}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Reopen");
    expect(html).toContain("Resolved");
    expect(html).toContain("06/07/2026");
    expect(html).toContain("This action requires a different workspace role.");
  });

  it("filters follow-ups by severity and target type", () => {
    const rows = toFollowUpRows([
      createFollowUp(),
      createFollowUp({
        id: "fu_22222222222222222222222222222222",
        target_type: "expense",
        severity: "needs_review",
        title: "Review cost type"
      })
    ]);

    expect(filterFollowUpRows(rows, { severity: "missing_file" }).map((row) => row.title)).toEqual(["Upload receipt file"]);
    expect(filterFollowUpRows(rows, { targetType: "expense" }).map((row) => row.title)).toEqual(["Review cost type"]);
    expect(buildSeverityFilterOptions(rows).map((option) => option.label)).toContain("Review needed");
  });

  it("applies resolve and reopen results without re-deriving follow-up rules", () => {
    const rows = toFollowUpRows([createFollowUp()]);
    const resolved = createFollowUp({ status: "resolved", resolved_at: "2026-06-07T12:00:00.000Z" });

    expect(applyFollowUpActionResult(rows, resolved, "open")).toEqual([]);
    expect(applyFollowUpActionResult(rows, resolved, "all")[0]).toMatchObject({
      id: resolved.id,
      status: "resolved"
    });

    const reopened = createFollowUp({ status: "open" });
    expect(applyFollowUpActionResult(toFollowUpRows([resolved]), reopened, "resolved")).toEqual([]);
    expect(applyFollowUpActionResult(toFollowUpRows([resolved]), reopened, "all")[0]).toMatchObject({
      id: reopened.id,
      status: "open"
    });
  });

  it("summarizes counts and stays within safety/product language", () => {
    expect(summarizeFollowUps(createSummary())).toMatchObject({
      open: 1,
      resolved: 1,
      total: 2
    });

    const html = renderToStaticMarkup(
      <FollowUpsView
        items={[createFollowUp({
          storage_key: "private/object.pdf",
          download_url: "https://signed.example.test/private",
          ocr_text: "Sensitive recognized text",
          local_path: "/Users/robert/private/file.pdf",
          provider_internal: "provider-job-123"
        })]}
        onChangeSeverityFilter={() => undefined}
        onChangeStatusFilter={() => undefined}
        onChangeTargetFilter={() => undefined}
        onClearFilters={() => undefined}
        onReopenFollowUp={() => undefined}
        onResolveFollowUp={() => undefined}
        summary={createSummary()}
        workspaceName="Home records"
      />
    ).toLowerCase();

    for (const blocked of [
      "deductible",
      "irs-approved",
      "qualifies for basis",
      "audit-proof",
      "tax-safe",
      "private/object.pdf",
      "https://signed.example.test/private",
      "sensitive recognized text",
      "/users/robert",
      "provider-job-123"
    ]) {
      expect(html).not.toContain(blocked);
    }
  });
});

function createFollowUp(overrides: Partial<FollowUpItem> = {}): FollowUpItem {
  return {
    id: "fu_11111111111111111111111111111111",
    target_type: "document",
    target_id: "document-1",
    property_id: "property-1",
    project_id: "project-1",
    expense_id: "expense-1",
    document_id: "document-1",
    severity: "missing_file",
    reason_code: "document_missing_file",
    title: "Upload receipt file",
    description: "The receipt record exists, but the file has not been uploaded.",
    action_label: "Upload receipt file",
    status: "open",
    source: "generated",
    created_from: "current_records",
    resolved_at: null,
    created_at: null,
    updated_at: null,
    storage_key: "private/object.pdf",
    ocr_text: "Sensitive recognized text",
    ...overrides
  };
}

function createSummary(overrides: Partial<FollowUpSummaryResponse> = {}): FollowUpSummaryResponse {
  return {
    workspace_id: "workspace-1",
    generated_at: "2026-06-07T12:00:00.000Z",
    open_count: 1,
    resolved_count: 1,
    by_type: [
      { type: "document_items", label: "Document items", count: 1 }
    ],
    by_severity: [
      { type: "missing_file", label: "Missing file", count: 1 }
    ],
    ...overrides
  };
}
