import { describe, expect, it } from "vitest";
import {
  HomeLedgerApiError,
  chooseActiveWorkspace,
  createHomeLedgerApiClient,
  loadInitialDashboard
} from "../src/api/client";
import type { DashboardResponse } from "../src/api/types";
import { createDashboardViewModel } from "../src/dashboard/dashboard-model";
import { formatCents } from "../src/utils/format";

describe("Home Ledger API client", () => {
  it("loads session dashboard follow-ups and follow-up summary for the selected workspace", async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const client = createHomeLedgerApiClient({
      baseUrl: "http://localhost:4000/api/v1/",
      fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options || {} });
        if (String(url).endsWith("/session")) {
          return jsonResponse({
            data: {
              user: { id: "user-1", email: "owner@example.test", displayName: "Owner" },
              memberships: [
                { id: "membership-1", workspaceId: "workspace/one", workspaceName: "Home records", role: "owner" }
              ]
            }
          });
        }
        if (String(url).endsWith("/workspaces/workspace%2Fone/dashboard")) {
          return jsonResponse({ data: createDashboardPayload({ workspace_id: "workspace/one" }) });
        }
        if (String(url).endsWith("/workspaces/workspace%2Fone/follow-ups")) {
          return jsonResponse({
            data: [
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
                status: "open"
              }
            ]
          });
        }
        if (String(url).endsWith("/workspaces/workspace%2Fone/follow-ups/summary")) {
          return jsonResponse({
            data: {
              open_count: 2,
              by_type: [{ type: "project_items", label: "Project items", count: 2 }]
            }
          });
        }
        throw new Error(`Unexpected URL: ${String(url)}`);
      }) as typeof fetch
    });

    const state = await loadInitialDashboard({ client });

    expect(state.status).toBe("ready");
    if (state.status !== "ready") throw new Error("Expected ready state.");
    expect(state.workspace.workspaceId).toBe("workspace/one");
    expect(state.dashboard.workspace_id).toBe("workspace/one");
    expect(state.followUps).toHaveLength(1);
    expect(state.followUpSummary.open_count).toBe(2);
    expect(calls.map((call) => call.url)).toEqual([
      "http://localhost:4000/api/v1/session",
      "http://localhost:4000/api/v1/workspaces/workspace%2Fone/dashboard",
      "http://localhost:4000/api/v1/workspaces/workspace%2Fone/follow-ups",
      "http://localhost:4000/api/v1/workspaces/workspace%2Fone/follow-ups/summary"
    ]);
    expect((calls[0].options.headers as Record<string, string>).Accept).toBe("application/json");
  });

  it("returns empty workspace state when session has no memberships", async () => {
    const client = createHomeLedgerApiClient({
      fetchImpl: (async () => jsonResponse({
        data: {
          user: { id: "user-1", email: "owner@example.test", displayName: "Owner" },
          memberships: []
        }
      })) as typeof fetch
    });

    const state = await loadInitialDashboard({ client });

    expect(state.status).toBe("empty_workspace");
    expect(state.workspace).toBeNull();
    expect(state.dashboard).toBeNull();
    expect(state.followUps).toBeNull();
    expect(state.followUpSummary).toBeNull();
  });

  it("normalizes 401 403 404 and validation errors", async () => {
    const cases = [
      [401, "unauthenticated", "Sign in required."],
      [403, "forbidden", "You do not have access."],
      [404, "not_found", "Workspace not found."],
      [422, "validation_failed", "Fix the highlighted fields."]
    ] as const;

    for (const [status, code, message] of cases) {
      const client = createHomeLedgerApiClient({
        fetchImpl: (async () => jsonResponse({
          error: {
            code,
            message,
            requestId: "req-test",
            details: [{ field: "name", issue: "required" }]
          }
        }, { status })) as typeof fetch
      });

      await expect(client.getSession()).rejects.toMatchObject({
        name: "HomeLedgerApiError",
        status,
        code,
        message,
        requestId: "req-test",
        details: [{ field: "name", issue: "required" }]
      });
    }
  });

  it("rejects unreadable JSON responses safely", async () => {
    const client = createHomeLedgerApiClient({
      fetchImpl: (async () => ({
        ok: false,
        status: 500,
        text: async () => "<html>not json</html>"
      } as Response)) as typeof fetch
    });

    await expect(client.getSession()).rejects.toBeInstanceOf(HomeLedgerApiError);
    await expect(client.getSession()).rejects.toMatchObject({
      status: 500,
      code: "invalid_response"
    });
  });

  it("prefers owner membership and preserves session response shape", () => {
    const workspace = chooseActiveWorkspace({
      user: { id: "user-1", email: "owner@example.test" },
      memberships: [
        { id: "viewer", workspaceId: "viewer-workspace", workspaceName: "Viewer", role: "viewer" },
        { id: "owner", workspaceId: "owner-workspace", workspaceName: "Owner", role: "owner" }
      ]
    });

    expect(workspace).toMatchObject({ workspaceId: "owner-workspace", role: "owner" });
  });

  it("preserves integer cents until display formatting", () => {
    const dashboard = createDashboardPayload({
      expenses: {
        count: 2,
        total_amount_cents: 123456789,
        by_classification: [
          { record_treatment: "possible_improvement", count: 1, total_amount_cents: 123456700 },
          { record_treatment: "repair_upkeep", count: 1, total_amount_cents: 89 }
        ],
        review_later_count: 0,
        possible_improvement_total_cents: 123456700,
        repair_upkeep_total_cents: 89
      }
    });

    const viewModel = createDashboardViewModel({
      session: { user: { id: "user-1", email: "owner@example.test" }, memberships: [] },
      workspace: { id: "membership-1", workspaceId: "workspace-1", workspaceName: "Home records", role: "owner" },
      dashboard,
      followUpSummary: null
    });

    expect(dashboard.expenses.total_amount_cents).toBe(123456789);
    expect(viewModel.metrics.find((metric) => metric.label === "Expenses")?.detail).toBe("$1,234,567.89 total");
    expect(viewModel.metrics.find((metric) => metric.label === "Total spend")?.value).toBe("$1,234,567.89");
    expect(viewModel.expenseBreakdown[0].amount).toBe("$1,234,567.00");
    expect(viewModel.expenseBreakdown[1].amount).toBe("$0.89");
    expect(formatCents(-125)).toBe("-$1.25");
  });
});

function jsonResponse(payload: unknown, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  } as Response;
}

function createDashboardPayload(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    workspace_id: "workspace-1",
    generated_at: "2026-06-07T12:00:00.000Z",
    properties: { count: 1, active_count: 1, archived_count: 0 },
    projects: { count: 1, active_count: 1, archived_count: 0, by_status: [], open_follow_up_count: 0 },
    expenses: {
      count: 1,
      total_amount_cents: 12345,
      by_classification: [],
      review_later_count: 0,
      possible_improvement_total_cents: 0,
      repair_upkeep_total_cents: 0
    },
    documents: {
      count: 1,
      with_file_count: 1,
      missing_file_count: 0,
      ocr_text_available_count: 0,
      ocr_pending_count: 0,
      by_type: []
    },
    vendors: { count: 1 },
    recent_activity: [],
    follow_ups: [],
    ...overrides
  };
}
