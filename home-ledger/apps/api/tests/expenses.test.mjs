import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  EXPENSE_IDS,
  PROJECT_IDS,
  PROPERTY_IDS,
  VENDOR_IDS,
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

test("unauthenticated expense list returns 401", async () => {
  const app = buildApp({
    config: createConfig({ authProvider: "none", devAuthEnabled: false }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses`,
    headers: {
      "x-request-id": "req-expenses-401"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  assert.equal(response.json().error.requestId, "req-expenses-401");

  await app.close();
});

test("viewer can list read and filter expenses but cannot create update or delete", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/expenses`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().data.length, 1);

  const filterResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/expenses/filter-options`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(filterResponse.statusCode, 200);
  assert.deepEqual(filterResponse.json().data.categories, ["general"]);

  const readResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/expenses/${EXPENSE_IDS.viewerExpense}`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json().data.id, EXPENSE_IDS.viewerExpense);

  for (const request of [
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/expenses`,
      payload: createExpensePayload({ property_id: PROPERTY_IDS.viewerPrimary })
    },
    {
      method: "PATCH",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/expenses/${EXPENSE_IDS.viewerExpense}`,
      payload: { description: "Viewer update" }
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/expenses/${EXPENSE_IDS.viewerExpense}`
    }
  ]) {
    const response = await app.inject({
      ...request,
      headers: authHeaders("viewer@example.test")
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "forbidden");
  }

  await app.close();
});

test("owner and editor can create update and soft delete expenses", async () => {
  for (const [email, workspaceId, propertyId, projectId, vendorId] of [
    ["owner@example.test", WORKSPACE_IDS.owner, PROPERTY_IDS.ownerPrimary, PROJECT_IDS.ownerDeck, VENDOR_IDS.ownerPrimary],
    ["editor@example.test", WORKSPACE_IDS.editor, PROPERTY_IDS.editorPrimary, PROJECT_IDS.editorProject, VENDOR_IDS.editorPrimary]
  ]) {
    const db = createFakeWorkspaceDb(createSeededWorkspaceState());
    const app = buildApp({ config: createConfig(), db });

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/expenses`,
      headers: authHeaders(email),
      payload: createExpensePayload({
        property_id: propertyId,
        project_id: projectId,
        vendor_id: vendorId,
        description: "  New expense  ",
        category: "  materials  "
      })
    });

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().data.description, "New expense");
    assert.equal(createResponse.json().data.category, "materials");
    assert.equal(createResponse.json().data.amount_cents, 12500);
    assert.equal(createResponse.json().data.currency_code, "USD");
    assert.equal(createResponse.json().data.property_id, propertyId);
    assert.equal(createResponse.json().data.project_id, projectId);
    assert.equal(createResponse.json().data.vendor_id, vendorId);
    const expenseId = createResponse.json().data.id;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceId}/expenses/${expenseId}`,
      headers: authHeaders(email),
      payload: {
        amount_cents: 15000,
        project_id: null,
        vendor_id: null,
        vendor_name_raw: "Updated vendor",
        documentation_status: "needs_follow_up",
        notes: "Updated note."
      }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().data.amount_cents, 15000);
    assert.equal(updateResponse.json().data.project_id, null);
    assert.equal(updateResponse.json().data.vendor_id, null);
    assert.equal(updateResponse.json().data.vendor_name_raw, "Updated vendor");
    assert.equal(updateResponse.json().data.documentation_status, "needs_follow_up");

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/expenses/${expenseId}`,
      headers: authHeaders(email)
    });
    assert.equal(deleteResponse.statusCode, 200);
    assert.notEqual(deleteResponse.json().data.deleted_at, null);
    assert.equal(db.expenses.has(expenseId), true);

    await app.close();
  }
});

test("expense list supports workspace-scoped filters sorting search dates and amounts", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const defaultResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses?sort=date_desc`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(defaultResponse.statusCode, 200);
  assert.deepEqual(defaultResponse.json().data.map((expense) => expense.id), [
    EXPENSE_IDS.ownerDeckReceipt,
    EXPENSE_IDS.ownerKitchenInvoice,
    EXPENSE_IDS.ownerUnlinked
  ]);
  assert.equal(defaultResponse.json().meta.total_count, 3);

  for (const [query, expectedIds] of [
    [`property_id=${PROPERTY_IDS.ownerSecondary}`, [EXPENSE_IDS.ownerKitchenInvoice]],
    [`project_id=${PROJECT_IDS.ownerDeck}`, [EXPENSE_IDS.ownerDeckReceipt]],
    [`vendor_id=${VENDOR_IDS.ownerPrimary}`, [EXPENSE_IDS.ownerDeckReceipt]],
    ["project_id=", [EXPENSE_IDS.ownerUnlinked]],
    ["vendor_id=", [EXPENSE_IDS.ownerUnlinked]],
    ["category=painting", [EXPENSE_IDS.ownerKitchenInvoice]],
    ["record_treatment=review_later", [EXPENSE_IDS.ownerUnlinked]],
    ["documentation_status=receipt_attached", [EXPENSE_IDS.ownerDeckReceipt]],
    ["currency_code=USD", [EXPENSE_IDS.ownerDeckReceipt, EXPENSE_IDS.ownerKitchenInvoice, EXPENSE_IDS.ownerUnlinked]],
    ["q=railing", [EXPENSE_IDS.ownerDeckReceipt]],
    ["date_from=2026-05-01&date_to=2026-05-31", [EXPENSE_IDS.ownerKitchenInvoice]],
    ["amount_min_cents=1000&amount_max_cents=2000", [EXPENSE_IDS.ownerUnlinked]]
  ]) {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses?sort=date_desc&${query}`,
      headers: authHeaders("owner@example.test")
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data.map((expense) => expense.id), expectedIds);
  }

  const amountSortResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses?sort=amount_asc`,
    headers: authHeaders("owner@example.test")
  });
  assert.deepEqual(amountSortResponse.json().data.map((expense) => expense.id), [
    EXPENSE_IDS.ownerUnlinked,
    EXPENSE_IDS.ownerDeckReceipt,
    EXPENSE_IDS.ownerKitchenInvoice
  ]);

  await app.close();
});

test("expense filter-options returns dynamic workspace-safe values", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/filter-options?record_treatment=possible_improvement`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.properties, [
    {
      id: PROPERTY_IDS.ownerSecondary,
      name: "Lake house"
    }
  ]);
  assert.deepEqual(response.json().data.projects, [
    {
      id: PROJECT_IDS.ownerKitchen,
      name: "Kitchen painting"
    }
  ]);
  assert.deepEqual(response.json().data.vendors, [
    {
      id: VENDOR_IDS.ownerSecondary,
      name: "Northside Painting Co."
    }
  ]);
  assert.deepEqual(response.json().data.categories, ["painting"]);
  assert.deepEqual(response.json().data.record_treatments, ["possible_improvement"]);
  assert.deepEqual(response.json().data.documentation_statuses, ["invoice_attached"]);
  assert.deepEqual(response.json().data.currency_codes, ["USD"]);
  assert.equal(JSON.stringify(response.json().data).includes("Editor"), false);

  await app.close();
});

test("expense detail update and delete are scoped to the requested workspace", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  for (const request of [
    {
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/${EXPENSE_IDS.editorExpense}`
    },
    {
      method: "PATCH",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/${EXPENSE_IDS.editorExpense}`,
      payload: { description: "Cross workspace update" }
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/${EXPENSE_IDS.editorExpense}`
    }
  ]) {
    const response = await app.inject({
      ...request,
      headers: authHeaders("owner@example.test")
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "not_found");
  }

  await app.close();
});

test("non-member and forged client claims cannot grant expense access", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const nonMemberResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses`,
    headers: authHeaders("nonmember@example.test")
  });
  assert.equal(nonMemberResponse.statusCode, 404);

  const forgedHeaderResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/expenses`,
    headers: {
      ...authHeaders("viewer@example.test"),
      "x-home-ledger-test-role": "owner",
      "x-home-ledger-test-workspace-id": WORKSPACE_IDS.viewer
    },
    payload: createExpensePayload({ property_id: PROPERTY_IDS.viewerPrimary })
  });
  assert.equal(forgedHeaderResponse.statusCode, 403);

  const forgedBodyResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses`,
    headers: authHeaders("nonmember@example.test"),
    payload: {
      ...createExpensePayload(),
      role: "owner",
      workspace_id: WORKSPACE_IDS.owner,
      vendor_id: VENDOR_IDS.ownerPrimary
    }
  });
  assert.equal(forgedBodyResponse.statusCode, 404);

  await app.close();
});

test("expense relationship validation rejects missing cross-workspace archived malformed and mismatched links", async () => {
  const cases = [
    [expensePayloadWithout("property_id"), "property_id", "required", 422],
    [createExpensePayload({ property_id: "not-a-property-id" }), "property_id", "invalid_uuid", 400],
    [createExpensePayload({ property_id: PROPERTY_IDS.editorPrimary }), "property_id", "not_found", 400],
    [createExpensePayload({ property_id: PROPERTY_IDS.ownerArchived }), "property_id", "not_found", 400],
    [createExpensePayload({ project_id: "not-a-project-id" }), "project_id", "invalid_uuid", 400],
    [createExpensePayload({ project_id: PROJECT_IDS.editorProject }), "project_id", "not_found", 400],
    [createExpensePayload({ project_id: PROJECT_IDS.ownerArchived }), "project_id", "not_found", 400],
    [createExpensePayload({ project_id: PROJECT_IDS.ownerKitchen }), "project_id", "property_mismatch", 400],
    [createExpensePayload({ vendor_id: "not-a-vendor-id" }), "vendor_id", "invalid_uuid", 400],
    [createExpensePayload({ vendor_id: VENDOR_IDS.editorPrimary }), "vendor_id", "not_found", 400],
    [createExpensePayload({ vendor_id: VENDOR_IDS.ownerArchived }), "vendor_id", "not_found", 400]
  ];

  for (const [payload, field, issue, statusCode] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses`,
      headers: authHeaders("owner@example.test"),
      payload
    });

    assert.equal(response.statusCode, statusCode);
    assert.equal(response.json().error.details[0].field, field);
    assert.equal(response.json().error.details[0].issue, issue);

    await app.close();
  }
});

test("expense update validates changed relationships against existing values", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const mismatchResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/${EXPENSE_IDS.ownerDeckReceipt}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      property_id: PROPERTY_IDS.ownerSecondary
    }
  });
  assert.equal(mismatchResponse.statusCode, 400);
  assert.deepEqual(mismatchResponse.json().error.details[0], { field: "project_id", issue: "property_mismatch" });

  const clearProjectResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/${EXPENSE_IDS.ownerDeckReceipt}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      project_id: null
    }
  });
  assert.equal(clearProjectResponse.statusCode, 200);
  assert.equal(clearProjectResponse.json().data.project_id, null);

  const propertyResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/${EXPENSE_IDS.ownerDeckReceipt}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      property_id: PROPERTY_IDS.ownerSecondary,
      project_id: PROJECT_IDS.ownerKitchen
    }
  });
  assert.equal(propertyResponse.statusCode, 200);
  assert.equal(propertyResponse.json().data.property_id, PROPERTY_IDS.ownerSecondary);
  assert.equal(propertyResponse.json().data.project_id, PROJECT_IDS.ownerKitchen);

  await app.close();
});

test("malformed and unknown expense ids return 400 or 404", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const malformedResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/not-an-expense-id`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(malformedResponse.statusCode, 400);
  assert.equal(malformedResponse.json().error.code, "invalid_request");

  const unknownResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/00000000-0000-4000-8000-000000999999`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(unknownResponse.statusCode, 404);
  assert.equal(unknownResponse.json().error.code, "not_found");

  await app.close();
});

test("expense validation rejects required invalid overlong unknown and camelCase fields", async () => {
  const cases = [
    [{ ...createExpensePayload(), description: "" }, "description", "required"],
    [{ ...createExpensePayload(), description: "x".repeat(5001) }, "description", "too_long"],
    [{ ...createExpensePayload(), amount_cents: null }, "amount_cents", "required"],
    [{ ...createExpensePayload(), amount_cents: -1 }, "amount_cents", "invalid_amount"],
    [{ ...createExpensePayload(), amount_cents: 12.34 }, "amount_cents", "invalid_amount"],
    [{ ...createExpensePayload(), category: "" }, "category", "required"],
    [{ ...createExpensePayload(), category: "x".repeat(121) }, "category", "too_long"],
    [{ ...createExpensePayload(), currency_code: "usd" }, "currency_code", "invalid_currency"],
    [{ ...createExpensePayload(), expense_date: "2026-02-31" }, "expense_date", "invalid_date"],
    [{ ...createExpensePayload(), record_treatment: "capital" }, "record_treatment", "invalid_record_treatment"],
    [{ ...createExpensePayload(), documentation_status: "done" }, "documentation_status", "invalid_documentation_status"],
    [{ ...createExpensePayload(), vendor_name_raw: "x".repeat(201) }, "vendor_name_raw", "too_long"],
    [{ ...createExpensePayload(), notes: "x".repeat(5001) }, "notes", "too_long"],
    [{ ...createExpensePayload(), surprise: true }, "surprise", "unknown_field"],
    [{ ...createExpensePayload(), propertyId: PROPERTY_IDS.ownerPrimary }, "propertyId", "unknown_field"],
    [{ ...createExpensePayload(), amountCents: 1000 }, "amountCents", "unknown_field"],
    [{ ...createExpensePayload(), recordTreatment: "review_later" }, "recordTreatment", "unknown_field"]
  ];

  for (const [payload, field, issue] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses`,
      headers: authHeaders("owner@example.test"),
      payload
    });

    assert.equal(response.statusCode, 422);
    assert.equal(response.json().error.code, "validation_failed");
    assert.deepEqual(response.json().error.details[0], { field, issue });

    await app.close();
  }
});

test("expense API uses snake_case resource fields and hides internal metadata", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const createResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses`,
    headers: authHeaders("owner@example.test"),
    payload: createExpensePayload()
  });
  assert.equal(createResponse.statusCode, 201);
  assertExpenseResponseShape(createResponse.json().data);
  const expenseId = createResponse.json().data.id;

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assertExpenseResponseShape(listResponse.json().data[0]);
  assert.deepEqual(Object.keys(listResponse.json().meta).sort(), ["limit", "offset", "total_count"]);

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/${expenseId}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(detailResponse.statusCode, 200);
  assertExpenseResponseShape(detailResponse.json().data);

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/${expenseId}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(deleteResponse.statusCode, 200);
  assertExpenseResponseShape(deleteResponse.json().data);
  assert.equal(deleteResponse.json().data.open_item_count, 0);
  assert.notEqual(deleteResponse.json().data.deleted_at, null);

  const filterResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/filter-options`,
    headers: authHeaders("owner@example.test")
  });
  assert.deepEqual(Object.keys(filterResponse.json().data).sort(), [
    "categories",
    "currency_codes",
    "documentation_statuses",
    "projects",
    "properties",
    "record_treatments",
    "vendors"
  ]);

  await app.close();
});

test("DELETE expense is a soft delete", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const response = await app.inject({
    method: "DELETE",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses/${EXPENSE_IDS.ownerKitchenInvoice}`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.notEqual(response.json().data.deleted_at, null);
  assert.equal(db.expenses.has(EXPENSE_IDS.ownerKitchenInvoice), true);
  assert.notEqual(db.expenses.get(EXPENSE_IDS.ownerKitchenInvoice).deleted_at, null);

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/expenses`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().data.some((expense) => expense.id === EXPENSE_IDS.ownerKitchenInvoice), false);

  await app.close();
});

function createExpensePayload(overrides = {}) {
  return {
    property_id: PROPERTY_IDS.ownerPrimary,
    project_id: PROJECT_IDS.ownerDeck,
    vendor_id: VENDOR_IDS.ownerPrimary,
    vendor_name_raw: "Cedarline Carpentry",
    expense_date: "2026-06-04",
    description: "Expense API test",
    amount_cents: 12500,
    currency_code: "USD",
    category: "deck/patio/porch",
    record_treatment: "repair_upkeep",
    documentation_status: "receipt_attached",
    notes: "Expense notes.",
    ...overrides
  };
}

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
    ...overrides
  };
}

function assertExpenseResponseShape(expense) {
  assert.deepEqual(Object.keys(expense).sort(), [
    "amount_cents",
    "category",
    "created_at",
    "currency_code",
    "deleted_at",
    "description",
    "document_count",
    "documentation_status",
    "expense_date",
    "id",
    "notes",
    "open_item_count",
    "project_id",
    "project_name",
    "property_id",
    "property_name",
    "record_treatment",
    "updated_at",
    "vendor_id",
    "vendor_name",
    "vendor_name_raw"
  ]);
  for (const internalField of [
    "workspace_id",
    "workspaceId",
    "created_by_user_id",
    "updated_by_user_id",
    "legacy_source",
    "legacySource",
    "legacy_classification",
    "object_storage_key",
    "raw_object_key"
  ]) {
    assert.equal(Object.hasOwn(expense, internalField), false, `${internalField} should not be exposed`);
  }
}

function expensePayloadWithout(field) {
  const payload = createExpensePayload();
  delete payload[field];
  return payload;
}
