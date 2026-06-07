import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  DOCUMENT_FILE_IDS,
  DOCUMENT_IDS,
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

test("unauthenticated dashboard request returns 401", async () => {
  const app = buildApp({
    config: createConfig({ authProvider: "none", devAuthEnabled: false }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/dashboard`,
    headers: {
      "x-request-id": "req-dashboard-401"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  assert.equal(response.json().error.requestId, "req-dashboard-401");

  await app.close();
});

test("owner editor and viewer can read dashboard summaries", async () => {
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
      url: `/api/v1/workspaces/${workspaceId}/dashboard`,
      headers: authHeaders(email)
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.workspace_id, workspaceId);
    assert.match(response.json().data.generated_at, /^\d{4}-\d{2}-\d{2}T/);

    await app.close();
  }
});

test("dashboard preserves membership boundaries and workspace id validation", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const nonmemberResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/dashboard`,
    headers: authHeaders("nonmember@example.test")
  });
  assert.equal(nonmemberResponse.statusCode, 404);
  assert.equal(nonmemberResponse.json().error.code, "not_found");

  const malformedResponse = await app.inject({
    method: "GET",
    url: "/api/v1/workspaces/not-a-uuid/dashboard",
    headers: authHeaders("owner@example.test")
  });
  assert.equal(malformedResponse.statusCode, 400);
  assert.equal(malformedResponse.json().error.code, "invalid_request");

  await app.close();
});

test("empty dashboard summary returns zero counts and empty arrays", async () => {
  const workspaceId = "00000000-0000-4000-8000-000000009001";
  const userId = "00000000-0000-4000-8000-000000009101";
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb({
      users: [{ id: userId, email: "empty@example.test", display_name: "Empty User" }],
      workspaces: [{ id: workspaceId, name: "Empty workspace" }],
      memberships: [{ id: "00000000-0000-4000-8000-000000009201", workspace_id: workspaceId, user_id: userId, role: "owner" }]
    })
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${workspaceId}/dashboard`,
    headers: authHeaders("empty@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.properties, {
    count: 0,
    active_count: 0,
    archived_count: 0
  });
  assert.deepEqual(response.json().data.projects, {
    count: 0,
    active_count: 0,
    archived_count: 0,
    by_status: [],
    open_follow_up_count: 0
  });
  assert.deepEqual(response.json().data.expenses.by_classification, []);
  assert.deepEqual(response.json().data.documents.by_type, []);
  assert.deepEqual(response.json().data.recent_activity, []);
  assert.deepEqual(response.json().data.follow_ups, []);

  await app.close();
});

test("dashboard aggregates active records and counts archived or deleted records correctly", async () => {
  const state = createSeededWorkspaceState();
  state.documentOcr = [
    {
      document_id: DOCUMENT_IDS.ownerDeckReceipt,
      document_file_id: DOCUMENT_FILE_IDS.ownerDeckReceipt,
      status: "succeeded",
      text: "Sensitive recognized text.",
      completed_at: "2026-06-06T15:10:00.000Z"
    },
    {
      document_id: DOCUMENT_IDS.ownerKitchenInvoice,
      document_file_id: null,
      status: "queued",
      text: null,
      completed_at: null
    }
  ];

  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(state)
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/dashboard`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  const data = response.json().data;
  assert.deepEqual(data.properties, {
    count: 3,
    active_count: 2,
    archived_count: 1
  });
  assert.deepEqual(data.projects, {
    count: 3,
    active_count: 2,
    archived_count: 1,
    by_status: [
      { status: "archived", count: 1 },
      { status: "completed", count: 1 },
      { status: "in_progress", count: 1 }
    ],
    open_follow_up_count: 9
  });
  assert.deepEqual(data.expenses, {
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
  });
  assert.deepEqual(data.documents, {
    count: 3,
    with_file_count: 1,
    missing_file_count: 2,
    ocr_text_available_count: 1,
    ocr_pending_count: 1,
    by_type: [
      { document_type: "invoice", count: 1 },
      { document_type: "permit", count: 1 },
      { document_type: "receipt", count: 1 }
    ]
  });
  assert.deepEqual(data.vendors, { count: 2 });
  assert.deepEqual(data.follow_ups, [
    { type: "document_items", label: "Document items", count: 2 },
    { type: "expense_items", label: "Expense items", count: 2 },
    { type: "project_items", label: "Project items", count: 3 },
    { type: "property_items", label: "Property items", count: 2 }
  ]);

  const serialized = JSON.stringify(data);
  assert.equal(serialized.includes("Sensitive recognized text"), false);
  assert.equal(serialized.includes("private/owner-deck-receipt.pdf"), false);
  assert.equal(serialized.includes("Deleted expense"), false);
  assert.equal(data.recent_activity.length, 10);
  assert(data.recent_activity.some((item) => item.activity_type === "project"));
  assert(data.recent_activity.some((item) => item.activity_type === "expense"));
  assert(data.recent_activity.some((item) => item.activity_type === "document"));

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
