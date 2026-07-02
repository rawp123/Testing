import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { DOCUMENT_FILE_IDS, DOCUMENT_IDS, WORKSPACE_IDS, createFakeWorkspaceDb, createSeededWorkspaceState } from "./helpers/fake-workspace-db.mjs";

const EXPECTED_EXPENSE_HEADERS = [
  "Export Source",
  "Export Date",
  "Property",
  "Project",
  "Vendor ID",
  "Category",
  "Date",
  "Vendor or payee",
  "Description",
  "Amount",
  "Amount cents",
  "Cost type",
  "Documentation",
  "Notes",
  "Expense ID",
  "Property ID",
  "Project ID",
  "Document count",
  "Created at",
  "Updated at"
];

const EXPECTED_DOCUMENT_HEADERS = [
  "document_id",
  "title",
  "document_type",
  "document_date",
  "property_id",
  "property_name",
  "project_id",
  "project_name",
  "expense_id",
  "expense_description",
  "file_available",
  "file_mime_type",
  "file_size_bytes",
  "ocr_status",
  "text_available",
  "notes",
  "created_at",
  "updated_at"
];

test("unauthenticated export request returns 401", async () => {
  const app = buildApp({
    config: createConfig({ authProvider: "none", devAuthEnabled: false }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/exports/summary`,
    headers: {
      "x-request-id": "req-exports-401"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  assert.equal(response.json().error.requestId, "req-exports-401");

  await app.close();
});

test("owner editor and viewer can export workspace data", async () => {
  const cases = [
    ["owner@example.test", WORKSPACE_IDS.owner],
    ["editor@example.test", WORKSPACE_IDS.editor],
    ["viewer@example.test", WORKSPACE_IDS.viewer]
  ];

  for (const [email, workspaceId] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/exports/summary`,
      headers: authHeaders(email)
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.workspace_id, workspaceId);

    await app.close();
  }
});

test("export endpoints preserve membership boundaries and workspace id validation", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const nonmemberResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/exports/expenses.csv`,
    headers: authHeaders("nonmember@example.test")
  });
  assert.equal(nonmemberResponse.statusCode, 404);
  assert.equal(nonmemberResponse.json().error.code, "not_found");

  const malformedResponse = await app.inject({
    method: "GET",
    url: "/api/v1/workspaces/not-a-uuid/exports/full.json",
    headers: authHeaders("owner@example.test")
  });
  assert.equal(malformedResponse.statusCode, 400);
  assert.equal(malformedResponse.json().error.code, "invalid_request");

  await app.close();
});

test("empty workspace exports valid empty outputs", async () => {
  const workspaceId = "00000000-0000-4000-8000-000000019001";
  const userId = "00000000-0000-4000-8000-000000019101";
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb({
      users: [{ id: userId, email: "empty-export@example.test", display_name: "Empty Export" }],
      workspaces: [{ id: workspaceId, name: "Empty export workspace" }],
      memberships: [{ id: "00000000-0000-4000-8000-000000019201", workspace_id: workspaceId, user_id: userId, role: "owner" }]
    })
  });

  const summaryResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${workspaceId}/exports/summary`,
    headers: authHeaders("empty-export@example.test")
  });
  assert.equal(summaryResponse.statusCode, 200);
  assert.equal(summaryResponse.json().data.expense_count, 0);
  assert.equal(summaryResponse.json().data.total_expense_amount_cents, 0);

  const expensesResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${workspaceId}/exports/expenses.csv`,
    headers: authHeaders("empty-export@example.test")
  });
  assert.equal(expensesResponse.statusCode, 200);
  assert.equal(expensesResponse.body, EXPECTED_EXPENSE_HEADERS.join(","));

  const fullResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${workspaceId}/exports/full.json`,
    headers: authHeaders("empty-export@example.test")
  });
  assert.equal(fullResponse.statusCode, 200);
  assert.equal(fullResponse.json().data.app, "home-ledger");
  assert.equal(fullResponse.json().data.exportType, "workspace-records");
  assert.equal(fullResponse.json().data.exportSchemaVersion, 1);
  assert.equal(fullResponse.json().data.workspace.id, workspaceId);
  assert.deepEqual(fullResponse.json().data.data.properties, []);
  assert.deepEqual(fullResponse.json().data.data.expenses, []);
  assert.deepEqual(fullResponse.json().data.data.documents, []);

  await app.close();
});

test("expenses CSV preserves local export headers and escapes spreadsheet-sensitive cells", async () => {
  const state = createSeededWorkspaceState();
  state.properties = state.properties.map((property) =>
    property.id === "00000000-0000-4000-8000-000000000301"
      ? { ...property, name: "Main, Home" }
      : property
  );
  state.expenses.push({
    id: "00000000-0000-4000-8000-000000009777",
    workspace_id: WORKSPACE_IDS.owner,
    property_id: "00000000-0000-4000-8000-000000000301",
    project_id: null,
    vendor_id: null,
    vendor_name_raw: "@Vendor",
    expense_date: "2026-06-07",
    description: "Line one\nLine two",
    amount_cents: 12345,
    category: "general",
    record_treatment: "review_later",
    documentation_status: "needs_follow_up",
    notes: "quote \" here"
  });

  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(state)
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/exports/expenses.csv`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /^text\/csv/);
  assert.match(response.headers["content-disposition"], /^attachment; filename="home-ledger-expenses-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.equal(response.body.split("\n")[0], EXPECTED_EXPENSE_HEADERS.join(","));
  assert.match(response.body, /"Main, Home"/);
  assert.match(response.body, /,'@Vendor,/);
  assert.match(response.body, /"Line one\nLine two"/);
  assert.match(response.body, /123\.45,12345/);
  assert.match(response.body, /"quote "" here"/);
  assert.doesNotMatch(response.body, /Deleted expense/);

  await app.close();
});

test("documents CSV and full JSON export safe file and OCR metadata only", async () => {
  const state = createSeededWorkspaceState();
  state.documentOcr = [
    {
      document_id: DOCUMENT_IDS.ownerDeckReceipt,
      document_file_id: DOCUMENT_FILE_IDS.ownerDeckReceipt,
      status: "succeeded",
      text: "Sensitive OCR text should not export.",
      completed_at: "2026-06-06T15:10:00.000Z"
    }
  ];

  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(state)
  });

  const documentsResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/exports/documents.csv`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(documentsResponse.statusCode, 200);
  assert.match(documentsResponse.headers["content-type"], /^text\/csv/);
  assert.equal(documentsResponse.body.split("\n")[0], EXPECTED_DOCUMENT_HEADERS.join(","));
  assert.equal(EXPECTED_DOCUMENT_HEADERS.includes("document_date"), true);
  assert.equal(EXPECTED_DOCUMENT_HEADERS.includes("created_at"), true);
  assert.equal(EXPECTED_DOCUMENT_HEADERS.includes("updated_at"), true);
  assert.match(documentsResponse.body, /Cedarline Carpentry - Receipt/);
  assert.match(documentsResponse.body, /2026-06-05,[^\n]*application\/pdf,2048,succeeded,true/);
  assert.doesNotMatch(documentsResponse.body, /Sensitive OCR text/);
  assert.doesNotMatch(documentsResponse.body, /private\/owner-deck-receipt\.pdf/);

  const fullResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/exports/full.json`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(fullResponse.statusCode, 200);
  assert.match(fullResponse.headers["content-disposition"], /^attachment; filename="home-ledger-full-\d{4}-\d{2}-\d{2}\.json"$/);
  const fullExport = fullResponse.json().data;
  assert.equal(fullExport.app, "home-ledger");
  assert.equal(fullExport.productName, "Home Ledger");
  assert.equal(fullExport.exportType, "workspace-records");
  assert.equal(fullExport.exportSchemaVersion, 1);
  assert.equal(fullExport.workspace.id, WORKSPACE_IDS.owner);
  const receiptDocument = fullExport.data.documents.find((document) => document.id === DOCUMENT_IDS.ownerDeckReceipt);
  assert.equal(receiptDocument.document_date, "2026-06-05");
  assert.equal(receiptDocument.ocr.text_available, true);
  const serialized = JSON.stringify(fullExport);
  assert.equal(serialized.includes("Sensitive OCR text"), false);
  assert.equal(serialized.includes("private/owner-deck-receipt.pdf"), false);
  assert.equal(serialized.includes("download_url"), false);
  assert.equal(serialized.includes("storage_key"), false);
  assert.equal(serialized.includes("Deleted document"), false);

  await app.close();
});

test("summary export uses integer cents and excludes deleted records", async () => {
  const state = createSeededWorkspaceState();
  state.documentOcr = [
    {
      document_id: DOCUMENT_IDS.ownerDeckReceipt,
      document_file_id: DOCUMENT_FILE_IDS.ownerDeckReceipt,
      status: "succeeded",
      text: "Sensitive OCR text should not export.",
      completed_at: "2026-06-06T15:10:00.000Z"
    }
  ];
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(state)
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/exports/summary`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.workspace_id, WORKSPACE_IDS.owner);
  assert.equal(response.json().data.expense_count, 3);
  assert.equal(response.json().data.total_expense_amount_cents, 317250);
  assert.equal(response.json().data.possible_improvement_total_cents, 248000);
  assert.equal(response.json().data.repair_upkeep_total_cents, 68000);
  assert.equal(response.json().data.text_available_document_count, 1);

  await app.close();
});

function authHeaders(email) {
  return {
    [TEST_AUTH_EMAIL_HEADER]: email
  };
}

function createConfig(overrides = {}) {
  return {
    appEnv: "test",
    authProvider: "dev",
    devAuthEnabled: true,
    devAuthEmail: "dev@example.test",
    devAuthDisplayName: "Local Developer",
    requestIdHeader: "x-request-id",
    dbPoolMax: 2,
    fileStorageDriver: "local",
    fileStorage: {},
    ocrMode: "disabled",
    ...overrides
  };
}
