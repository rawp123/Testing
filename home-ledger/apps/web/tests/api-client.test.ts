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

  it("uses snake_case property API requests", async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const client = createHomeLedgerApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options || {} });
        return jsonResponse({
          data: String(url).includes("/properties/property-1")
            ? createPropertyPayload({ id: "property-1", name: "Office updated" })
            : [createPropertyPayload()]
        });
      }) as typeof fetch
    });

    await client.listProperties("workspace/one");
    await client.createProperty("workspace/one", {
      name: "Office",
      display_address: "1124 Huminger Drive",
      purchase_date: "2024-01-01",
      purchase_price_cents: 20000000,
      currency_code: "USD",
      notes: null,
      is_primary: true
    });
    await client.updateProperty("workspace/one", "property-1", { name: "Office updated" });
    await client.archiveProperty("workspace/one", "property-1");

    expect(calls.map((call) => [call.options.method || "GET", call.url])).toEqual([
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/properties"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/properties"],
      ["PATCH", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/properties/property-1"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/properties/property-1/archive"]
    ]);
    expect(calls[1].options.body).toContain("purchase_price_cents");
    expect(calls[1].options.body).not.toContain("purchasePrice");
  });

  it("uses snake_case vendor API requests", async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const client = createHomeLedgerApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options || {} });
        return jsonResponse({
          data: String(url).includes("/vendors/vendor-1")
            ? createVendorPayload({ id: "vendor-1", name: "Cedarline Carpentry updated" })
            : [createVendorPayload()]
        });
      }) as typeof fetch
    });

    await client.listVendors("workspace/one");
    await client.createVendor("workspace/one", {
      name: "Cedarline Carpentry",
      category: "deck/patio/porch",
      contact_name: "Morgan Lee",
      phone: "555-0100",
      email: "morgan@example.test",
      website: "https://cedarline.example",
      notes: null,
      status: "active"
    });
    await client.updateVendor("workspace/one", "vendor-1", { contact_name: "Morgan A. Lee" });
    await client.archiveVendor("workspace/one", "vendor-1");

    expect(calls.map((call) => [call.options.method || "GET", call.url])).toEqual([
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/vendors"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/vendors"],
      ["PATCH", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/vendors/vendor-1"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/vendors/vendor-1/archive"]
    ]);
    expect(calls[1].options.body).toContain("contact_name");
    expect(calls[1].options.body).not.toContain("contactName");
    expect(calls[1].options.body).not.toContain("normalizedName");
    expect(calls[1].options.body).not.toContain("source_confidence");
  });

  it("uses follow-up list summary resolve and reopen API requests", async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const client = createHomeLedgerApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options || {} });
        const textUrl = String(url);
        if (textUrl.endsWith("/follow-ups/summary")) {
          return jsonResponse({
            data: {
              open_count: 1,
              resolved_count: 1,
              by_type: [{ type: "document_items", label: "Document items", count: 1 }],
              by_severity: [{ type: "missing_file", label: "Missing file", count: 1 }]
            }
          });
        }
        if (textUrl.endsWith("/resolve")) {
          return jsonResponse({ data: createFollowUpPayload({ status: "resolved", resolved_at: "2026-06-07T12:00:00.000Z" }) });
        }
        if (textUrl.endsWith("/reopen")) {
          return jsonResponse({ data: createFollowUpPayload({ status: "open" }) });
        }
        return jsonResponse({ data: [createFollowUpPayload()] });
      }) as typeof fetch
    });

    await client.getFollowUps("workspace/one");
    await client.getFollowUps("workspace/one", "resolved");
    const summary = await client.getFollowUpSummary("workspace/one");
    await client.resolveFollowUp("workspace/one", "fu_11111111111111111111111111111111", {
      note: "Handled outside the app."
    });
    await client.reopenFollowUp("workspace/one", "fu_11111111111111111111111111111111");

    expect(summary.open_count).toBe(1);
    expect(calls.map((call) => [call.options.method || "GET", call.url])).toEqual([
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/follow-ups"],
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/follow-ups?status=resolved"],
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/follow-ups/summary"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/follow-ups/fu_11111111111111111111111111111111/resolve"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/follow-ups/fu_11111111111111111111111111111111/reopen"]
    ]);
    expect(calls[3].options.body).toContain("note");
    expect(calls[3].options.body).not.toContain("workspaceId");
    expect(calls[4].options.body).toBe("{}");
  });

  it("uses snake_case project API requests", async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const client = createHomeLedgerApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options || {} });
        return jsonResponse({
          data: String(url).includes("/projects/project-1")
            ? createProjectPayload({ id: "project-1", name: "Kitchen updated" })
            : [createProjectPayload()]
        });
      }) as typeof fetch
    });

    await client.listProjects("workspace/one");
    await client.createProject("workspace/one", {
      property_id: "property-1",
      name: "Kitchen overhaul",
      category: "kitchen",
      status: "in_progress",
      start_date: "2026-06-01",
      completion_date: null,
      contractor_name_raw: "Summit Heating & Air",
      permit_number: null,
      scope_summary: "Cabinets and lighting",
      notes: null
    });
    await client.updateProject("workspace/one", "project-1", { name: "Kitchen updated" });
    await client.archiveProject("workspace/one", "project-1");

    expect(calls.map((call) => [call.options.method || "GET", call.url])).toEqual([
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/projects"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/projects"],
      ["PATCH", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/projects/project-1"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/projects/project-1/archive"]
    ]);
    expect(calls[1].options.body).toContain("property_id");
    expect(calls[1].options.body).toContain("contractor_name_raw");
    expect(calls[1].options.body).not.toContain("propertyId");
    expect(calls[1].options.body).not.toContain("contractorNameRaw");
  });

  it("uses snake_case expense API requests with integer cents", async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const client = createHomeLedgerApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options || {} });
        return jsonResponse({
          data: String(url).includes("/expenses/expense-1")
            ? createExpensePayload({ id: "expense-1", description: "Deck boards updated" })
            : [createExpensePayload()]
        });
      }) as typeof fetch
    });

    await client.listExpenses("workspace/one");
    await client.createExpense("workspace/one", {
      property_id: "property-1",
      project_id: "project-1",
      vendor_name_raw: "Cedarline Carpentry",
      expense_date: "2026-06-05",
      description: "Deck boards",
      amount_cents: 248000,
      currency_code: "USD",
      category: "repair_upkeep",
      record_treatment: "repair_upkeep",
      documentation_status: "needs_follow_up",
      notes: null
    });
    await client.updateExpense("workspace/one", "expense-1", { description: "Deck boards updated" });
    await client.archiveExpense("workspace/one", "expense-1");

    expect(calls.map((call) => [call.options.method || "GET", call.url])).toEqual([
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/expenses"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/expenses"],
      ["PATCH", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/expenses/expense-1"],
      ["DELETE", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/expenses/expense-1"]
    ]);
    expect(calls[1].options.body).toContain("amount_cents");
    expect(calls[1].options.body).toContain("record_treatment");
    expect(calls[1].options.body).toContain("documentation_status");
    expect(calls[1].options.body).not.toContain("amountCents");
    expect(calls[1].options.body).not.toContain("recordTreatment");
  });

  it("uses document metadata and file lifecycle API requests safely", async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const client = createHomeLedgerApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options || {} });
        const textUrl = String(url);
        if (textUrl.endsWith("/documents/document-1/file-intent")) {
          return jsonResponse({
            data: {
              upload_id: "file-1",
              document_file_id: "file-1",
              upload_method: "api_adapter",
              upload_url: null,
              upload_headers: { "content-type": "application/pdf" },
              upload_token: "upload-token",
              expires_at: "2026-06-07T12:10:00.000Z",
              max_size_bytes: 26214400,
              file: createDocumentFilePayload({ status: "pending_upload" })
            }
          });
        }
        if (textUrl.endsWith("/documents/document-1/file-complete")) {
          return jsonResponse({ data: createDocumentFilePayload({ status: "available" }) });
        }
        if (textUrl.endsWith("/documents/document-1/file")) {
          return jsonResponse({ data: createDocumentFilePayload({ status: "available" }) });
        }
        if (textUrl.endsWith("/documents/document-1/ocr")) {
          return jsonResponse({ data: createDocumentOcrPayload({ ocr_status: "succeeded", text_available: true }) });
        }
        if (textUrl.endsWith("/documents/document-1/text")) {
          return jsonResponse({ data: createDocumentOcrTextPayload({ text: "Extracted document text." }) });
        }
        return jsonResponse({
          data: textUrl.includes("/documents/document-1")
            ? createDocumentPayload({ id: "document-1", display_name: "Receipt updated" })
            : [createDocumentPayload()]
        });
      }) as typeof fetch
    });

    await client.listDocuments("workspace/one");
    await client.createDocument("workspace/one", {
      property_id: "property-1",
      project_id: "project-1",
      expense_id: "expense-1",
      display_name: "Receipt",
      document_type: "receipt",
      document_date: "2026-06-05",
      notes: null,
      file_availability: "not_uploaded",
      file_status_note: null
    });
    await client.updateDocument("workspace/one", "document-1", { display_name: "Receipt updated" });
    await client.createDocumentFileIntent("workspace/one", "document-1", {
      original_file_name: "receipt.pdf",
      mime_type: "application/pdf",
      size_bytes: 128,
      sha256: "a".repeat(64),
      source: "web_upload"
    });
    await client.completeDocumentFileUpload("workspace/one", "document-1", {
      document_file_id: "file-1",
      upload_id: "file-1",
      size_bytes: 128,
      sha256: "a".repeat(64)
    });
    await client.getDocumentFile("workspace/one", "document-1");
    await client.removeDocumentFile("workspace/one", "document-1");
    await client.requestDocumentOcr("workspace/one", "document-1");
    await client.getDocumentOcrStatus("workspace/one", "document-1");
    await client.getDocumentOcrText("workspace/one", "document-1");
    await client.archiveDocument("workspace/one", "document-1");

    expect(calls.map((call) => [call.options.method || "GET", call.url])).toEqual([
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents"],
      ["PATCH", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/file-intent"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/file-complete"],
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/file"],
      ["DELETE", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/file"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/ocr"],
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/ocr"],
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/text"],
      ["DELETE", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1"]
    ]);
    expect(calls[1].options.body).toContain("display_name");
    expect(calls[1].options.body).toContain("document_type");
    expect(calls[1].options.body).not.toContain("displayName");
    expect(calls[3].options.body).toContain("original_file_name");
    expect(calls[3].options.body).not.toContain("/Users/");
    expect(calls.map((call) => call.url).join("\n")).not.toContain("ocrText");
  });

  it("attaches document files through intent and complete without exposing paths", async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const client = createHomeLedgerApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options || {} });
        if (String(url).endsWith("/file-intent")) {
          return jsonResponse({
            data: {
              upload_id: "file-1",
              document_file_id: "file-1",
              upload_method: "api_adapter",
              upload_url: null,
              upload_headers: { "content-type": "text/plain" },
              upload_token: "upload-token",
              expires_at: "2026-06-07T12:10:00.000Z",
              max_size_bytes: 26214400,
              file: createDocumentFilePayload({ original_file_name: "receipt.txt", mime_type: "text/plain", status: "pending_upload" })
            }
          });
        }
        return jsonResponse({ data: createDocumentFilePayload({ original_file_name: "receipt.txt", mime_type: "text/plain", status: "available" }) });
      }) as typeof fetch
    });

    const result = await client.attachDocumentFile("workspace/one", "document-1", new File(["hello"], "/Users/robert/receipt.txt", { type: "text/plain" }));

    expect(calls.map((call) => [call.options.method || "GET", call.url])).toEqual([
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/file-intent"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/file-complete"]
    ]);
    expect(result).toMatchObject({
      upload_method: "api_adapter",
      upload_url_available: false,
      browser_upload_performed: false,
      completed_without_browser_upload: true
    });
    expect(result.file).toMatchObject({ original_file_name: "receipt.txt", status: "available" });
    expect(calls[0].options.body).toContain("receipt.txt");
    expect(calls[0].options.body).not.toContain("/Users/robert");
    expect(calls[0].options.body).toContain("sha256");
  });

  it("uploads document bytes when a signed upload URL is available", async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const client = createHomeLedgerApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options || {} });
        const textUrl = String(url);
        if (textUrl.endsWith("/file-intent")) {
          return jsonResponse({
            data: {
              upload_id: "file-1",
              document_file_id: "file-1",
              upload_method: "signed_url_put",
              upload_url: "https://storage.example.test/signed-upload?token=secret",
              upload_headers: { "content-type": "application/pdf" },
              upload_token: null,
              expires_at: "2026-06-07T12:10:00.000Z",
              max_size_bytes: 26214400,
              file: createDocumentFilePayload({ original_file_name: "receipt.pdf", status: "pending_upload" })
            }
          });
        }
        if (textUrl === "https://storage.example.test/signed-upload?token=secret") {
          return new Response(null, { status: 200 });
        }
        return jsonResponse({ data: createDocumentFilePayload({ original_file_name: "receipt.pdf", status: "available" }) });
      }) as typeof fetch
    });

    const result = await client.attachDocumentFile("workspace/one", "document-1", new File(["pdf"], "receipt.pdf", { type: "application/pdf" }));

    expect(calls.map((call) => [call.options.method || "GET", call.url])).toEqual([
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/file-intent"],
      ["PUT", "https://storage.example.test/signed-upload?token=secret"],
      ["POST", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/documents/document-1/file-complete"]
    ]);
    expect(result).toMatchObject({
      upload_method: "signed_url_put",
      upload_url_available: true,
      browser_upload_performed: true,
      completed_without_browser_upload: false
    });
  });

  it("uses API-backed export endpoints and attachment filenames", async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const client = createHomeLedgerApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options || {} });
        if (String(url).endsWith("/exports/summary")) {
          return jsonResponse({
            data: {
              workspace_id: "workspace/one",
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
              text_available_document_count: 1
            }
          });
        }
        return blobResponse("id,name\n1,Office", {
          contentType: String(url).endsWith(".json") ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
          fileName: String(url).endsWith(".json") ? "home-ledger-full-2026-06-07.json" : "home-ledger-expenses-2026-06-07.csv"
        });
      }) as typeof fetch
    });

    const summary = await client.getExportSummary("workspace/one");
    const expenses = await client.downloadExpensesCsv("workspace/one");
    await client.downloadDocumentsCsv("workspace/one");
    const full = await client.downloadFullJsonExport("workspace/one");

    expect(summary.total_expense_amount_cents).toBe(12345);
    expect(expenses.file_name).toBe("home-ledger-expenses-2026-06-07.csv");
    expect(expenses.content_type).toContain("text/csv");
    expect(full.file_name).toBe("home-ledger-full-2026-06-07.json");
    expect(calls.map((call) => [call.options.method || "GET", call.url])).toEqual([
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/exports/summary"],
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/exports/expenses.csv"],
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/exports/documents.csv"],
      ["GET", "http://localhost:4000/api/v1/workspaces/workspace%2Fone/exports/full.json"]
    ]);
  });
});

function jsonResponse(payload: unknown, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  } as Response;
}

function blobResponse(body: string, {
  contentType,
  fileName,
  status = 200
}: {
  contentType: string;
  fileName: string;
  status?: number;
}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      "content-disposition": `attachment; filename="${fileName}"`,
      "content-type": contentType
    }),
    text: async () => body,
    blob: async () => new Blob([body], { type: contentType })
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

function createFollowUpPayload(overrides: Record<string, unknown> = {}) {
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
    ...overrides
  };
}

function createPropertyPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "property-1",
    name: "Office",
    display_address: "1124 Huminger Drive",
    purchase_date: "2024-01-01",
    purchase_price_cents: 20000000,
    currency_code: "USD",
    notes: null,
    is_primary: true,
    archived_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}

function createProjectPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    property_id: "property-1",
    property_name: "Office",
    vendor_id: null,
    vendor_name: null,
    name: "Kitchen overhaul",
    category: "kitchen",
    status: "in_progress",
    start_date: "2026-06-01",
    completion_date: null,
    contractor_name_raw: "Summit Heating & Air",
    permit_number: null,
    scope_summary: "Cabinets and lighting",
    notes: null,
    completeness_override_note: null,
    completeness_overridden_at: null,
    open_item_count: 2,
    archived_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}

function createVendorPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "vendor-1",
    name: "Cedarline Carpentry",
    normalized_name: "cedarline carpentry",
    category: "deck/patio/porch",
    contact_name: "Morgan Lee",
    phone: "555-0100",
    email: "morgan@example.test",
    website: "https://cedarline.example",
    notes: null,
    status: "active",
    source_confidence: "user_confirmed",
    archived_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}

function createExpensePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "expense-1",
    property_id: "property-1",
    property_name: "Office",
    project_id: "project-1",
    project_name: "Deck repair",
    vendor_id: null,
    vendor_name: null,
    vendor_name_raw: "Cedarline Carpentry",
    expense_date: "2026-06-05",
    description: "Deck boards",
    amount_cents: 248000,
    currency_code: "USD",
    category: "repair_upkeep",
    record_treatment: "repair_upkeep",
    documentation_status: "needs_follow_up",
    notes: null,
    document_count: 0,
    open_item_count: 1,
    deleted_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}

function createDocumentPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "document-1",
    property_id: "property-1",
    property_name: "Office",
    project_id: "project-1",
    project_name: "Deck repair",
    expense_id: "expense-1",
    expense_description: "Deck boards",
    display_name: "Receipt",
    document_type: "receipt",
    document_date: "2026-06-05",
    notes: null,
    file_availability: "not_uploaded",
    file_status_note: null,
    file: null,
    ocr: { status: "not_requested", has_text: false, completed_at: null },
    deleted_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}

function createDocumentFilePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "file-1",
    document_id: "document-1",
    original_file_name: "receipt.pdf",
    mime_type: "application/pdf",
    size_bytes: 128,
    sha256: "a".repeat(64),
    source: "web_upload",
    status: "available",
    uploaded_at: "2026-06-07T12:00:00.000Z",
    deleted_at: null,
    ...overrides
  };
}

function createDocumentOcrPayload(overrides: Record<string, unknown> = {}) {
  return {
    document_id: "document-1",
    document_file_id: "file-1",
    ocr_status: "not_requested",
    ocr_requested_at: null,
    ocr_completed_at: null,
    text_available: false,
    engine: null,
    failure_reason: null,
    ...overrides
  };
}

function createDocumentOcrTextPayload(overrides: Record<string, unknown> = {}) {
  return {
    ...createDocumentOcrPayload({ ocr_status: "succeeded", text_available: true }),
    text: "Extracted document text.",
    ...overrides
  };
}
