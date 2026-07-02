import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InitialDashboardState } from "../src/api/client";
import type { DashboardResponse, FollowUpItem, SessionResponse, WorkspaceMembership } from "../src/api/types";
import { ErrorState } from "../src/components/ErrorState";
import { LoadingState } from "../src/components/LoadingState";
import { DashboardPage } from "../src/dashboard/DashboardPage";
import { NeedsAttention } from "../src/dashboard/NeedsAttention";
import { createDashboardViewModel } from "../src/dashboard/dashboard-model";

describe("Dashboard React shell", () => {
  it("renders loading empty workspace and error states", () => {
    expect(renderToStaticMarkup(<LoadingState />)).toContain("Loading dashboard");

    const emptyHtml = renderToStaticMarkup(<DashboardPage state={{
      status: "empty_workspace",
      session: createSession(),
      workspace: null,
      dashboard: null,
      followUps: null,
      followUpSummary: null
    }} />);
    expect(emptyHtml).toContain("Create a workspace");

    const errorHtml = renderToStaticMarkup(<ErrorState message="Sign in to view your home records." />);
    expect(errorHtml).toContain("Dashboard unavailable");
    expect(errorHtml).toContain("Sign in to view your home records.");
  });

  it("maps aggregate dashboard data without changing cents", () => {
    const dashboard = createDashboardPayload();
    const viewModel = createDashboardViewModel({
      session: createSession("Robert"),
      workspace: createWorkspace(),
      dashboard,
      followUps: createFollowUps(),
      followUpSummary: { open_count: 7, by_type: dashboard.follow_ups }
    });

    expect(viewModel.userName).toBe("Robert");
    expect(viewModel.workspaceName).toBe("Home records");
    expect(viewModel.metrics.find((item) => item.label === "Expenses")?.detail).toBe("$3,172.50 total");
    expect(viewModel.metrics.find((item) => item.label === "Total spend")?.value).toBe("$3,172.50");
    expect(viewModel.expenseBreakdown.map((item) => item.label)).toEqual([
      "Possible improvements",
      "Repair or upkeep",
      "Needs classification"
    ]);
    expect(viewModel.activityFilterOptions.map((item) => item.label)).toEqual(["Document", "Expense", "Project"]);
    expect(viewModel.followUpItems[0]).toMatchObject({
      area: "Document",
      title: "Upload receipt file",
      actionLabel: "Upload receipt file"
    });
    expect(dashboard.expenses.total_amount_cents).toBe(317250);
  });

  it("renders populated recent activity and compact dashboard shell", () => {
    const html = renderToStaticMarkup(<DashboardPage state={createReadyState()} />);

    expect(html).toContain("Your home records");
    expect(html).toContain("Recent activity");
    expect(html).toContain("Follow-ups");
    expect(html).toContain("All activity");
    expect(html).toContain("Project <span>1</span>");
    expect(html).toContain("Expense <span>1</span>");
    expect(html).toContain("Document <span>1</span>");
    expect(html).toContain("Add expense");
    expect(html).toContain("Deck repair");
    expect(html).toContain("Cedarline Carpentry");
    expect(html).toContain("$680.00");
    expect(html).toContain("Total spend");
    expect(html).not.toContain("Expense summary");
    expect(html).not.toContain("Document summary");
  });

  it("renders specific needs-attention rows without generic summary cards", () => {
    const html = renderToStaticMarkup(<NeedsAttention items={[
      {
        id: "fu_11111111111111111111111111111111",
        area: "Document",
        title: "Upload receipt file",
        description: "The receipt record exists, but the file has not been uploaded.",
        actionLabel: "Upload receipt file",
        severity: "Missing File",
        targetType: "document"
      }
    ]} />);

    expect(html).toContain("Issue");
    expect(html).toContain("Upload receipt file");
    expect(html).toContain("The receipt record exists");
    expect(html).not.toContain("Document items");
  });

  it("renders concise empty dashboard copy", () => {
    const html = renderToStaticMarkup(<DashboardPage state={createReadyState({
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
    })} />);

    expect(html).toContain("Add a property");
    expect(html).toContain("No recent activity");
    expect(html).not.toContain("Expense summary");
  });

  it("does not render sensitive storage OCR or local-path fields", () => {
    const html = renderToStaticMarkup(<DashboardPage state={createReadyState({
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
          local_path: "/Users/robert/private/file.pdf",
          provider_internal: "provider-job-123"
        }
      ]
    })} />);

    expect(html).not.toContain("workspaces/private/object.pdf");
    expect(html).not.toContain("https://signed.example.test/private");
    expect(html).not.toContain("Sensitive recognized text");
    expect(html).not.toContain("/Users/robert/private/file.pdf");
    expect(html).not.toContain("provider-job-123");
  });

  it("stays within neutral product language", () => {
    const html = renderToStaticMarkup(<DashboardPage state={createReadyState()} />).toLowerCase();
    for (const blocked of ["deductible", "irs-approved", "qualifies for basis", "audit-proof", "tax-safe"]) {
      expect(html).not.toContain(blocked);
    }
  });
});

function createReadyState(overrides: Partial<DashboardResponse> = {}): InitialDashboardState {
  const dashboard = createDashboardPayload(overrides);
  return {
    status: "ready",
    session: createSession("Robert"),
    workspace: createWorkspace(),
    dashboard,
    followUps: createFollowUps(),
    followUpSummary: {
      open_count: dashboard.follow_ups.reduce((total, item) => total + item.count, 0),
      by_type: dashboard.follow_ups
    }
  };
}

function createFollowUps(): FollowUpItem[] {
  return [
    {
      id: "fu_11111111111111111111111111111111",
      target_type: "document",
      target_id: "document-1",
      document_id: "document-1",
      severity: "missing_file",
      reason_code: "document_missing_file",
      title: "Upload receipt file",
      description: "The receipt record exists, but the file has not been uploaded.",
      action_label: "Upload receipt file",
      status: "open",
      storage_key: "private/object.pdf",
      ocr_text: "Sensitive text"
    }
  ];
}

function createSession(displayName = "Owner"): SessionResponse {
  return {
    user: { id: "user-1", email: "owner@example.test", displayName },
    memberships: [createWorkspace()]
  };
}

function createWorkspace(): WorkspaceMembership {
  return {
    id: "membership-1",
    workspaceId: "workspace-1",
    workspaceName: "Home records",
    role: "owner"
  };
}

function createDashboardPayload(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
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
