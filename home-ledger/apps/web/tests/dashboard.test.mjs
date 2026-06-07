import assert from "node:assert/strict";
import test from "node:test";
import { createDashboardViewModel, renderDashboardShell } from "../src/dashboard.js";

test("dashboard shell renders loading, empty workspace, and error states", () => {
  assert.match(renderDashboardShell({ status: "loading" }), /Loading dashboard/);
  assert.match(renderDashboardShell({ status: "empty_workspace" }), /Create a workspace/);

  const errorHtml = renderDashboardShell({ status: "error", message: "Sign in to view your home records." });
  assert.match(errorHtml, /Dashboard unavailable/);
  assert.match(errorHtml, /Sign in to view your home records/);
});

test("dashboard view model maps aggregate dashboard data without changing cents", () => {
  const dashboard = createDashboardPayload();
  const viewModel = createDashboardViewModel({
    session: { user: { displayName: "Robert" } },
    workspace: { workspaceName: "Home records", role: "owner" },
    dashboard
  });

  assert.equal(viewModel.userName, "Robert");
  assert.equal(viewModel.workspaceName, "Home records");
  assert.equal(viewModel.metrics.find((item) => item.label === "Expenses").detail, "$3,172.50");
  assert.deepEqual(viewModel.expenseBreakdown.map((item) => item.label), [
    "Possible improvements",
    "Repair / upkeep",
    "Not sure, review later"
  ]);
  assert.equal(dashboard.expenses.total_amount_cents, 317250);
});

test("dashboard shell renders populated recent activity and follow-up counts", () => {
  const html = renderDashboardShell({
    status: "ready",
    session: { user: { displayName: "Robert" } },
    workspace: { workspaceName: "Home records", role: "owner" },
    dashboard: createDashboardPayload()
  });

  assert.match(html, /Your home records/);
  assert.match(html, /Recent activity <span>3<\/span>/);
  assert.match(html, /Needs attention <span>7<\/span>/);
  assert.match(html, /Deck repair/);
  assert.match(html, /Cedarline Carpentry/);
  assert.match(html, /\$680\.00/);
  assert.match(html, /Expense summary/);
  assert.match(html, /Document summary/);
});

test("empty dashboard uses concise product copy", () => {
  const html = renderDashboardShell({
    status: "ready",
    session: { user: { email: "owner@example.test" } },
    workspace: { workspaceName: "Home records", role: "owner" },
    dashboard: createDashboardPayload({
      properties: { count: 0, active_count: 0, archived_count: 0 },
      projects: { count: 0, active_count: 0, archived_count: 0, by_status: [], open_follow_up_count: 0 },
      expenses: {
        count: 0,
        total_amount_cents: 0,
        by_classification: [],
        review_later_count: 0,
        possible_improvement_total_cents: 0,
        repair_upkeep_total_cents: 0
      },
      documents: {
        count: 0,
        with_file_count: 0,
        missing_file_count: 0,
        ocr_text_available_count: 0,
        ocr_pending_count: 0,
        by_type: []
      },
      vendors: { count: 0 },
      recent_activity: [],
      follow_ups: []
    })
  });

  assert.match(html, /Add a property/);
  assert.match(html, /No recent activity/);
  assert.match(html, /No open items/);
});

test("dashboard shell does not render sensitive storage, OCR, or local-path fields", () => {
  const html = renderDashboardShell({
    status: "ready",
    session: { user: { displayName: "Robert" } },
    workspace: { workspaceName: "Home records", role: "owner" },
    dashboard: createDashboardPayload({
      recent_activity: [
        {
          activity_type: "document",
          record_type: "document",
          record_id: "document-1",
          record_name: "Invoice",
          summary: "Invoice",
          occurred_at: "2026-06-07T12:00:00.000Z",
          property_name: "Office",
          project_name: "Kitchen",
          document_type: "invoice",
          file_availability: "available",
          storage_key: "workspaces/private/object.pdf",
          download_url: "https://signed.example.test/private",
          ocr_text: "Sensitive recognized text",
          local_path: "/Users/robert/private/file.pdf"
        }
      ]
    })
  });

  assert.equal(html.includes("workspaces/private/object.pdf"), false);
  assert.equal(html.includes("https://signed.example.test/private"), false);
  assert.equal(html.includes("Sensitive recognized text"), false);
  assert.equal(html.includes("/Users/robert/private/file.pdf"), false);
});

test("dashboard copy stays within neutral product language", () => {
  const html = renderDashboardShell({
    status: "ready",
    session: { user: { displayName: "Robert" } },
    workspace: { workspaceName: "Home records", role: "owner" },
    dashboard: createDashboardPayload()
  }).toLowerCase();

  for (const blocked of ["deductible", "irs-approved", "qualifies for basis", "audit-proof", "tax-safe"]) {
    assert.equal(html.includes(blocked), false);
  }
});

function createDashboardPayload(overrides = {}) {
  return {
    workspace_id: "workspace-1",
    generated_at: "2026-06-07T12:00:00.000Z",
    properties: { count: 2, active_count: 2, archived_count: 0 },
    projects: {
      count: 2,
      active_count: 2,
      archived_count: 0,
      by_status: [{ status: "in_progress", count: 1 }],
      open_follow_up_count: 7
    },
    expenses: {
      count: 3,
      total_amount_cents: 317250,
      by_classification: [
        { record_treatment: "possible_improvement", count: 1, total_amount_cents: 248000 },
        { record_treatment: "repair_upkeep", count: 1, total_amount_cents: 68000 },
        { record_treatment: "review_later", count: 1, total_amount_cents: 1250 }
      ],
      review_later_count: 1,
      possible_improvement_total_cents: 248000,
      repair_upkeep_total_cents: 68000
    },
    documents: {
      count: 3,
      with_file_count: 1,
      missing_file_count: 2,
      ocr_text_available_count: 1,
      ocr_pending_count: 1,
      by_type: [{ document_type: "receipt", count: 1 }]
    },
    vendors: { count: 2 },
    recent_activity: [
      {
        activity_type: "project",
        record_type: "project",
        record_id: "project-1",
        record_name: "Deck repair",
        summary: "Deck repair",
        occurred_at: "2026-06-06T12:00:00.000Z",
        property_name: "Office",
        project_name: "Deck repair",
        status: "in_progress"
      },
      {
        activity_type: "expense",
        record_type: "expense",
        record_id: "expense-1",
        record_name: "Cedarline Carpentry",
        summary: "Deck materials",
        occurred_at: "2026-06-05T12:00:00.000Z",
        property_name: "Office",
        project_name: "Deck repair",
        amount_cents: 68000,
        record_treatment: "repair_upkeep"
      },
      {
        activity_type: "document",
        record_type: "document",
        record_id: "document-1",
        record_name: "Receipt",
        summary: "Receipt",
        occurred_at: "2026-06-04T12:00:00.000Z",
        property_name: "Office",
        project_name: "Deck repair",
        document_type: "receipt",
        file_availability: "available"
      }
    ],
    follow_ups: [
      { type: "document_items", label: "Document items", count: 2 },
      { type: "expense_items", label: "Expense items", count: 2 },
      { type: "project_items", label: "Project items", count: 3 }
    ],
    ...overrides
  };
}
