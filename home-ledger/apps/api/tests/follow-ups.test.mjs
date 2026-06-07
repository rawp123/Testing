import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  DOCUMENT_IDS,
  EXPENSE_IDS,
  PROJECT_IDS,
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

test("unauthenticated follow-up list returns 401", async () => {
  const app = buildApp({
    config: createConfig({ authProvider: "none", devAuthEnabled: false }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups`,
    headers: {
      "x-request-id": "req-follow-ups-401"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  assert.equal(response.json().error.requestId, "req-follow-ups-401");

  await app.close();
});

test("viewer editor and owner can list follow-ups and read summary", async () => {
  for (const [email, workspaceId] of [
    ["owner@example.test", WORKSPACE_IDS.owner],
    ["editor@example.test", WORKSPACE_IDS.editor],
    ["viewer@example.test", WORKSPACE_IDS.viewer]
  ]) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/follow-ups`,
      headers: authHeaders(email)
    });
    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.json().data.every((item) => item.status === "open"), true);

    const summaryResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/follow-ups/summary`,
      headers: authHeaders(email)
    });
    assert.equal(summaryResponse.statusCode, 200);
    assert.equal(summaryResponse.json().data.workspace_id, workspaceId);
    assert.equal(summaryResponse.json().data.open_count, listResponse.json().data.length);

    await app.close();
  }
});

test("follow-up endpoints preserve membership boundaries and id validation", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const nonmemberResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups`,
    headers: authHeaders("nonmember@example.test")
  });
  assert.equal(nonmemberResponse.statusCode, 404);
  assert.equal(nonmemberResponse.json().error.code, "not_found");

  const malformedWorkspaceResponse = await app.inject({
    method: "GET",
    url: "/api/v1/workspaces/not-a-uuid/follow-ups",
    headers: authHeaders("owner@example.test")
  });
  assert.equal(malformedWorkspaceResponse.statusCode, 400);
  assert.equal(malformedWorkspaceResponse.json().error.code, "invalid_request");

  const malformedFollowUpResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups/not-a-follow-up/resolve`,
    headers: authHeaders("owner@example.test"),
    payload: {}
  });
  assert.equal(malformedFollowUpResponse.statusCode, 400);
  assert.equal(malformedFollowUpResponse.json().error.code, "invalid_request");

  await app.close();
});

test("generated follow-ups use stable safe fields and deterministic ordering", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const firstResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups`,
    headers: authHeaders("owner@example.test")
  });
  const secondResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  const first = firstResponse.json().data;
  const second = secondResponse.json().data;
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
  assert.deepEqual(first.map((item) => item.reason_code), [
    "expense_missing_document_support",
    "document_missing_file",
    "project_missing_contract_or_estimate",
    "project_missing_contract_or_estimate",
    "project_missing_before_after_photo",
    "document_missing_file",
    "expense_review_later",
    "property_missing_purchase_date",
    "property_missing_purchase_price"
  ]);
  assert(first.every((item) => /^fu_[a-f0-9]{32}$/.test(item.id)));
  assert(first.some((item) => item.document_id === DOCUMENT_IDS.ownerKitchenInvoice && item.title === "Upload invoice file"));
  assert(first.some((item) => item.expense_id === EXPENSE_IDS.ownerUnlinked && item.title === "Review cost type"));

  const serialized = JSON.stringify(first);
  assert.equal(serialized.includes("private/owner-deck-receipt.pdf"), false);
  assert.equal(serialized.includes("storage_key"), false);
  assert.equal(serialized.includes("download_url"), false);

  await app.close();
});

test("owner and editor can resolve and reopen generated follow-ups", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups`,
    headers: authHeaders("owner@example.test")
  });
  const target = listResponse.json().data.find((item) => item.reason_code === "expense_review_later");
  assert(target);

  const viewerList = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/follow-ups`,
    headers: authHeaders("viewer@example.test")
  });
  const viewerTarget = viewerList.json().data[0];
  const viewerResolve = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/follow-ups/${viewerTarget.id}/resolve`,
    headers: authHeaders("viewer@example.test"),
    payload: {}
  });
  assert.equal(viewerResolve.statusCode, 403);

  const resolveResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups/${target.id}/resolve`,
    headers: authHeaders("owner@example.test"),
    payload: {
      note: "Handled outside the app."
    }
  });
  assert.equal(resolveResponse.statusCode, 200);
  assert.equal(resolveResponse.json().data.status, "resolved");
  assert.equal(resolveResponse.json().data.id, target.id);
  assert.notEqual(resolveResponse.json().data.resolved_at, null);

  const openAfterResolve = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(openAfterResolve.json().data.some((item) => item.id === target.id), false);

  const resolvedList = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups?status=resolved`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(resolvedList.statusCode, 200);
  assert.equal(resolvedList.json().data.some((item) => item.id === target.id), true);

  const ownerReopenResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups/${target.id}/reopen`,
    headers: authHeaders("owner@example.test"),
    payload: {}
  });
  assert.equal(ownerReopenResponse.statusCode, 200);
  assert.equal(ownerReopenResponse.json().data.status, "open");

  const openAfterReopen = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(openAfterReopen.json().data.some((item) => item.id === target.id), true);

  const editorList = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.editor}/follow-ups`,
    headers: authHeaders("editor@example.test")
  });
  const editorTarget = editorList.json().data[0];
  const editorResolveResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.editor}/follow-ups/${editorTarget.id}/resolve`,
    headers: authHeaders("editor@example.test"),
    payload: {}
  });
  assert.equal(editorResolveResponse.statusCode, 200);
  const editorReopenResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.editor}/follow-ups/${editorTarget.id}/reopen`,
    headers: authHeaders("editor@example.test"),
    payload: {}
  });
  assert.equal(editorReopenResponse.statusCode, 200);

  await app.close();
});

test("source fixes remove generated follow-ups and counts are computed", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const projectsResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects?sort=name_asc`,
    headers: authHeaders("owner@example.test")
  });
  assert.deepEqual(projectsResponse.json().data.map((project) => [project.id, project.open_item_count]), [
    [PROJECT_IDS.ownerDeck, 1],
    [PROJECT_IDS.ownerKitchen, 3]
  ]);

  const expensesResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses?sort=date_desc`,
    headers: authHeaders("owner@example.test")
  });
  assert.deepEqual(expensesResponse.json().data.map((expense) => [expense.id, expense.open_item_count]), [
    [EXPENSE_IDS.ownerDeckReceipt, 0],
    [EXPENSE_IDS.ownerKitchenInvoice, 1],
    [EXPENSE_IDS.ownerUnlinked, 2]
  ]);

  const updateExpenseResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/${EXPENSE_IDS.ownerUnlinked}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      record_treatment: "repair_upkeep"
    }
  });
  assert.equal(updateExpenseResponse.statusCode, 200);
  assert.equal(updateExpenseResponse.json().data.open_item_count, 1);

  const followUpsAfterFix = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(followUpsAfterFix.json().data.some((item) =>
    item.expense_id === EXPENSE_IDS.ownerUnlinked &&
    item.reason_code === "expense_review_later"
  ), false);

  await app.close();
});

test("dashboard follow-up buckets use the generated follow-up service", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const dashboardResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/dashboard`,
    headers: authHeaders("owner@example.test")
  });
  const summaryResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups/summary`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(dashboardResponse.statusCode, 200);
  assert.equal(summaryResponse.statusCode, 200);
  assert.deepEqual(dashboardResponse.json().data.follow_ups, summaryResponse.json().data.by_type);
  assert.equal(dashboardResponse.json().data.projects.open_follow_up_count, summaryResponse.json().data.open_count);

  await app.close();
});

test("follow-up validation rejects unknown fields and invalid status filters", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const statusResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups?status=closed`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(statusResponse.statusCode, 400);

  const targetResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups`,
    headers: authHeaders("owner@example.test")
  });
  const target = targetResponse.json().data[0];

  const unknownFieldResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/follow-ups/${target.id}/resolve`,
    headers: authHeaders("owner@example.test"),
    payload: {
      note: "ok",
      camelCase: true
    }
  });
  assert.equal(unknownFieldResponse.statusCode, 422);
  assert.deepEqual(unknownFieldResponse.json().error.details[0], {
    field: "camelCase",
    issue: "unknown_field"
  });

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
