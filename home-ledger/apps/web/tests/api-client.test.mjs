import assert from "node:assert/strict";
import test from "node:test";
import {
  HomeLedgerApiError,
  chooseActiveWorkspace,
  createHomeLedgerApiClient,
  loadInitialDashboard
} from "../src/api-client.js";
import { createDashboardViewModel, formatCents } from "../src/dashboard.js";

test("API client loads session and dashboard for the selected workspace", async () => {
  const calls = [];
  const client = createHomeLedgerApiClient({
    baseUrl: "http://localhost:4000/api/v1/",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/session")) {
        return jsonResponse({
          data: {
            user: { id: "user-1", email: "owner@example.test", displayName: "Owner" },
            memberships: [
              { id: "membership-1", workspaceId: "workspace/one", workspaceName: "Home records", role: "owner" }
            ]
          }
        });
      }
      if (url.endsWith("/workspaces/workspace%2Fone/dashboard")) {
        return jsonResponse({ data: createDashboardPayload({ workspace_id: "workspace/one" }) });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }
  });

  const state = await loadInitialDashboard({ client });

  assert.equal(state.status, "ready");
  assert.equal(state.workspace.workspaceId, "workspace/one");
  assert.equal(state.dashboard.workspace_id, "workspace/one");
  assert.equal(calls[0].url, "http://localhost:4000/api/v1/session");
  assert.equal(calls[1].url, "http://localhost:4000/api/v1/workspaces/workspace%2Fone/dashboard");
  assert.equal(calls[0].options.headers.Accept, "application/json");
});

test("API client returns empty workspace state when session has no memberships", async () => {
  const client = createHomeLedgerApiClient({
    fetchImpl: async () => jsonResponse({
      data: {
        user: { id: "user-1", email: "owner@example.test", displayName: "Owner" },
        memberships: []
      }
    })
  });

  const state = await loadInitialDashboard({ client });

  assert.equal(state.status, "empty_workspace");
  assert.equal(state.workspace, null);
  assert.equal(state.dashboard, null);
});

test("API client normalizes 401, 403, 404, and validation errors", async () => {
  const cases = [
    [401, "unauthenticated", "Sign in required."],
    [403, "forbidden", "You do not have access."],
    [404, "not_found", "Workspace not found."],
    [422, "validation_failed", "Fix the highlighted fields."]
  ];

  for (const [status, code, message] of cases) {
    const client = createHomeLedgerApiClient({
      fetchImpl: async () => jsonResponse({
        error: {
          code,
          message,
          requestId: "req-test",
          details: [{ field: "name", issue: "required" }]
        }
      }, { status })
    });

    await assert.rejects(
      () => client.getSession(),
      (error) => {
        assert(error instanceof HomeLedgerApiError);
        assert.equal(error.status, status);
        assert.equal(error.code, code);
        assert.equal(error.message, message);
        assert.equal(error.requestId, "req-test");
        assert.deepEqual(error.details, [{ field: "name", issue: "required" }]);
        return true;
      }
    );
  }
});

test("API client rejects unreadable JSON responses safely", async () => {
  const client = createHomeLedgerApiClient({
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      async text() {
        return "<html>not json</html>";
      }
    })
  });

  await assert.rejects(
    () => client.getSession(),
    {
      name: "HomeLedgerApiError",
      status: 500,
      code: "invalid_response"
    }
  );
});

test("workspace selection prefers owner membership and preserves session response shape", () => {
  const workspace = chooseActiveWorkspace({
    memberships: [
      { workspaceId: "viewer-workspace", role: "viewer" },
      { workspaceId: "owner-workspace", role: "owner" }
    ]
  });

  assert.deepEqual(workspace, { workspaceId: "owner-workspace", role: "owner" });
});

test("integer cents are preserved until display formatting", () => {
  const payload = createDashboardPayload({
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
    session: { user: { email: "owner@example.test" } },
    workspace: { workspaceName: "Home records", role: "owner" },
    dashboard: payload
  });

  assert.equal(payload.expenses.total_amount_cents, 123456789);
  assert.equal(viewModel.metrics[2].detail, "$1,234,567.89");
  assert.equal(viewModel.expenseBreakdown[0].amount, "$1,234,567.00");
  assert.equal(viewModel.expenseBreakdown[1].amount, "$0.89");
  assert.equal(formatCents(-125), "-$1.25");
});

function jsonResponse(payload, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(payload);
    }
  };
}

function createDashboardPayload(overrides = {}) {
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
