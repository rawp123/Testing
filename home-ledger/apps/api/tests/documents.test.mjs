import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  DOCUMENT_IDS,
  EXPENSE_IDS,
  PROJECT_IDS,
  PROPERTY_IDS,
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

test("unauthenticated document list returns 401", async () => {
  const app = buildApp({
    config: createConfig({ authProvider: "none", devAuthEnabled: false }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents`,
    headers: {
      "x-request-id": "req-documents-401"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  assert.equal(response.json().error.requestId, "req-documents-401");

  await app.close();
});

test("viewer can list read and filter documents but cannot create update or delete", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().data.length, 1);

  const filterResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/filter-options`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(filterResponse.statusCode, 200);
  assert.deepEqual(filterResponse.json().data.document_types, ["receipt"]);

  const readResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/${DOCUMENT_IDS.viewerDocument}`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json().data.id, DOCUMENT_IDS.viewerDocument);

  for (const request of [
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents`,
      payload: createDocumentPayload({ property_id: PROPERTY_IDS.viewerPrimary })
    },
    {
      method: "PATCH",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/${DOCUMENT_IDS.viewerDocument}`,
      payload: { display_name: "Viewer update" }
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents/${DOCUMENT_IDS.viewerDocument}`
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

test("owner and editor can create update and soft delete documents", async () => {
  for (const [email, workspaceId, propertyId, projectId, expenseId] of [
    ["owner@example.test", WORKSPACE_IDS.owner, PROPERTY_IDS.ownerPrimary, PROJECT_IDS.ownerDeck, EXPENSE_IDS.ownerDeckReceipt],
    ["editor@example.test", WORKSPACE_IDS.editor, PROPERTY_IDS.editorPrimary, PROJECT_IDS.editorProject, EXPENSE_IDS.editorExpense]
  ]) {
    const db = createFakeWorkspaceDb(createSeededWorkspaceState());
    const app = buildApp({ config: createConfig(), db });

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/documents`,
      headers: authHeaders(email),
      payload: {
        expense_id: expenseId,
        display_name: "  New receipt  ",
        document_type: "receipt",
        document_date: "2026-06-05",
        notes: "  Metadata only.  "
      }
    });

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().data.display_name, "New receipt");
    assert.equal(createResponse.json().data.document_type, "receipt");
    assert.equal(createResponse.json().data.file_availability, "not_uploaded");
    assert.equal(createResponse.json().data.property_id, propertyId);
    assert.equal(createResponse.json().data.project_id, projectId);
    assert.equal(createResponse.json().data.expense_id, expenseId);
    const documentId = createResponse.json().data.id;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}`,
      headers: authHeaders(email),
      payload: {
        display_name: "Updated document",
        document_type: "invoice",
        file_availability: "missing",
        file_status_note: "Imported without file content.",
        notes: null
      }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().data.display_name, "Updated document");
    assert.equal(updateResponse.json().data.document_type, "invoice");
    assert.equal(updateResponse.json().data.file_availability, "missing");
    assert.equal(updateResponse.json().data.file_status_note, "Imported without file content.");

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspaceId}/documents/${documentId}`,
      headers: authHeaders(email)
    });
    assert.equal(deleteResponse.statusCode, 200);
    assert.notEqual(deleteResponse.json().data.deleted_at, null);
    assert.equal(db.documents.has(documentId), true);

    await app.close();
  }
});

test("document list supports workspace-scoped filters sorting search and dates", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const defaultResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents?sort=document_date_desc`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(defaultResponse.statusCode, 200);
  assert.deepEqual(defaultResponse.json().data.map((document) => document.id), [
    DOCUMENT_IDS.ownerDeckReceipt,
    DOCUMENT_IDS.ownerKitchenInvoice,
    DOCUMENT_IDS.ownerUnlinkedPermit
  ]);
  assert.equal(defaultResponse.json().meta.total_count, 3);

  for (const [query, expectedIds] of [
    [`property_id=${PROPERTY_IDS.ownerSecondary}`, [DOCUMENT_IDS.ownerKitchenInvoice]],
    [`project_id=${PROJECT_IDS.ownerDeck}`, [DOCUMENT_IDS.ownerDeckReceipt]],
    [`expense_id=${EXPENSE_IDS.ownerDeckReceipt}`, [DOCUMENT_IDS.ownerDeckReceipt]],
    ["project_id=", [DOCUMENT_IDS.ownerUnlinkedPermit]],
    ["expense_id=", [DOCUMENT_IDS.ownerUnlinkedPermit]],
    ["document_type=invoice", [DOCUMENT_IDS.ownerKitchenInvoice]],
    ["file_availability=missing", [DOCUMENT_IDS.ownerUnlinkedPermit]],
    ["q=permit", [DOCUMENT_IDS.ownerUnlinkedPermit]],
    ["document_date_from=2026-05-01&document_date_to=2026-05-31", [DOCUMENT_IDS.ownerKitchenInvoice]]
  ]) {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents?sort=document_date_desc&${query}`,
      headers: authHeaders("owner@example.test")
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data.map((document) => document.id), expectedIds);
  }

  const nameSortResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents?sort=name_asc`,
    headers: authHeaders("owner@example.test")
  });
  assert.deepEqual(nameSortResponse.json().data.map((document) => document.id), [
    DOCUMENT_IDS.ownerDeckReceipt,
    DOCUMENT_IDS.ownerUnlinkedPermit,
    DOCUMENT_IDS.ownerKitchenInvoice
  ]);

  await app.close();
});

test("document filter-options returns dynamic workspace-safe values", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/filter-options?document_type=invoice`,
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
  assert.deepEqual(response.json().data.expenses, [
    {
      id: EXPENSE_IDS.ownerKitchenInvoice,
      description: "Kitchen paint labor"
    }
  ]);
  assert.deepEqual(response.json().data.document_types, ["invoice"]);
  assert.deepEqual(response.json().data.file_availabilities, ["not_uploaded"]);
  assert.equal(JSON.stringify(response.json().data).includes("Editor"), false);

  await app.close();
});

test("document detail update and delete are scoped to the requested workspace", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  for (const request of [
    {
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.editorDocument}`
    },
    {
      method: "PATCH",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.editorDocument}`,
      payload: { display_name: "Cross workspace update" }
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.editorDocument}`
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

test("non-member and forged client claims cannot grant document access", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const nonMemberResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents`,
    headers: authHeaders("nonmember@example.test")
  });
  assert.equal(nonMemberResponse.statusCode, 404);

  const forgedHeaderResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/documents`,
    headers: {
      ...authHeaders("viewer@example.test"),
      "x-home-ledger-test-role": "owner",
      "x-home-ledger-test-workspace-id": WORKSPACE_IDS.viewer
    },
    payload: createDocumentPayload({ property_id: PROPERTY_IDS.viewerPrimary })
  });
  assert.equal(forgedHeaderResponse.statusCode, 403);

  const forgedBodyResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents`,
    headers: authHeaders("nonmember@example.test"),
    payload: {
      ...createDocumentPayload(),
      role: "owner",
      workspace_id: WORKSPACE_IDS.owner
    }
  });
  assert.equal(forgedBodyResponse.statusCode, 404);

  await app.close();
});

test("document relationship validation rejects missing cross-workspace archived malformed and mismatched links", async () => {
  const cases = [
    [documentPayloadWithout("property_id"), "property_id", "required", 422],
    [createDocumentPayload({ property_id: "not-a-property-id" }), "property_id", "invalid_uuid", 400],
    [createDocumentPayload({ property_id: PROPERTY_IDS.editorPrimary }), "property_id", "not_found", 400],
    [createDocumentPayload({ property_id: PROPERTY_IDS.ownerArchived }), "property_id", "not_found", 400],
    [createDocumentPayload({ project_id: "not-a-project-id" }), "project_id", "invalid_uuid", 400],
    [createDocumentPayload({ project_id: PROJECT_IDS.editorProject }), "project_id", "not_found", 400],
    [createDocumentPayload({ project_id: PROJECT_IDS.ownerArchived }), "project_id", "not_found", 400],
    [createDocumentPayload({ project_id: PROJECT_IDS.ownerKitchen }), "project_id", "property_mismatch", 400],
    [createDocumentPayload({ expense_id: "not-an-expense-id" }), "expense_id", "invalid_uuid", 400],
    [createDocumentPayload({ expense_id: EXPENSE_IDS.editorExpense }), "expense_id", "not_found", 400],
    [createDocumentPayload({ expense_id: EXPENSE_IDS.ownerKitchenInvoice }), "property_id", "expense_mismatch", 400],
    [createDocumentPayload({ expense_id: EXPENSE_IDS.ownerUnlinked, project_id: PROJECT_IDS.ownerDeck }), "project_id", "expense_mismatch", 400]
  ];

  for (const [payload, field, issue, statusCode] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents`,
      headers: authHeaders("owner@example.test"),
      payload
    });

    assert.equal(response.statusCode, statusCode);
    assert.equal(response.json().error.details[0].field, field);
    assert.equal(response.json().error.details[0].issue, issue);

    await app.close();
  }
});

test("document update validates changed relationships and supports clearing expense and project", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const mismatchResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      property_id: PROPERTY_IDS.ownerSecondary
    }
  });
  assert.equal(mismatchResponse.statusCode, 400);
  assert.deepEqual(mismatchResponse.json().error.details[0], { field: "property_id", issue: "expense_mismatch" });

  const clearResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      project_id: null,
      expense_id: null
    }
  });
  assert.equal(clearResponse.statusCode, 200);
  assert.equal(clearResponse.json().data.project_id, null);
  assert.equal(clearResponse.json().data.expense_id, null);

  const relinkResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerDeckReceipt}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      expense_id: EXPENSE_IDS.ownerKitchenInvoice
    }
  });
  assert.equal(relinkResponse.statusCode, 200);
  assert.equal(relinkResponse.json().data.property_id, PROPERTY_IDS.ownerSecondary);
  assert.equal(relinkResponse.json().data.project_id, PROJECT_IDS.ownerKitchen);
  assert.equal(relinkResponse.json().data.expense_id, EXPENSE_IDS.ownerKitchenInvoice);

  await app.close();
});

test("malformed and unknown document ids return 400 or 404", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const malformedResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/not-a-document-id`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(malformedResponse.statusCode, 400);
  assert.equal(malformedResponse.json().error.code, "invalid_request");

  const unknownResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/00000000-0000-4000-8000-000000999999`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(unknownResponse.statusCode, 404);
  assert.equal(unknownResponse.json().error.code, "not_found");

  await app.close();
});

test("document validation rejects required invalid overlong unknown and camelCase fields", async () => {
  const cases = [
    [{ ...createDocumentPayload(), display_name: "" }, "display_name", "required"],
    [{ ...createDocumentPayload(), display_name: "x".repeat(241) }, "display_name", "too_long"],
    [{ ...createDocumentPayload(), document_type: "" }, "document_type", "required"],
    [{ ...createDocumentPayload(), document_type: "x".repeat(121) }, "document_type", "too_long"],
    [{ ...createDocumentPayload(), document_date: "2026-02-31" }, "document_date", "invalid_date"],
    [{ ...createDocumentPayload(), notes: "x".repeat(5001) }, "notes", "too_long"],
    [{ ...createDocumentPayload(), file_availability: "stored" }, "file_availability", "invalid_file_availability"],
    [{ ...createDocumentPayload(), file_status_note: "x".repeat(1001) }, "file_status_note", "too_long"],
    [{ ...createDocumentPayload(), surprise: true }, "surprise", "unknown_field"],
    [{ ...createDocumentPayload(), propertyId: PROPERTY_IDS.ownerPrimary }, "propertyId", "unknown_field"],
    [{ ...createDocumentPayload(), displayName: "Bad casing" }, "displayName", "unknown_field"],
    [{ ...createDocumentPayload(), fileAvailability: "available" }, "fileAvailability", "unknown_field"]
  ];

  for (const [payload, field, issue] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents`,
      headers: authHeaders("owner@example.test"),
      payload
    });

    assert.equal(response.statusCode, 422);
    assert.equal(response.json().error.code, "validation_failed");
    assert.deepEqual(response.json().error.details[0], { field, issue });

    await app.close();
  }
});

test("document API uses snake_case resource fields and hides storage internals", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const createResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents`,
    headers: authHeaders("owner@example.test"),
    payload: createDocumentPayload()
  });
  assert.equal(createResponse.statusCode, 201);
  assertDocumentResponseShape(createResponse.json().data);
  const documentId = createResponse.json().data.id;

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assertDocumentResponseShape(listResponse.json().data[0]);
  assert.deepEqual(Object.keys(listResponse.json().meta).sort(), ["limit", "offset", "total_count"]);

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${documentId}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(detailResponse.statusCode, 200);
  assertDocumentResponseShape(detailResponse.json().data);

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${documentId}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(deleteResponse.statusCode, 200);
  assertDocumentResponseShape(deleteResponse.json().data);
  assert.notEqual(deleteResponse.json().data.deleted_at, null);

  const filterResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/filter-options`,
    headers: authHeaders("owner@example.test")
  });
  assert.deepEqual(Object.keys(filterResponse.json().data).sort(), [
    "document_types",
    "expenses",
    "file_availabilities",
    "projects",
    "properties"
  ]);

  await app.close();
});

test("DELETE document is a soft delete", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const response = await app.inject({
    method: "DELETE",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents/${DOCUMENT_IDS.ownerKitchenInvoice}`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.notEqual(response.json().data.deleted_at, null);
  assert.equal(db.documents.has(DOCUMENT_IDS.ownerKitchenInvoice), true);
  assert.notEqual(db.documents.get(DOCUMENT_IDS.ownerKitchenInvoice).deleted_at, null);

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/documents`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().data.some((document) => document.id === DOCUMENT_IDS.ownerKitchenInvoice), false);

  await app.close();
});

function createDocumentPayload(overrides = {}) {
  return {
    property_id: PROPERTY_IDS.ownerPrimary,
    project_id: PROJECT_IDS.ownerDeck,
    expense_id: null,
    display_name: "Document API test",
    document_type: "receipt",
    document_date: "2026-06-05",
    notes: "Document notes.",
    file_availability: "not_uploaded",
    file_status_note: null,
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

function assertDocumentResponseShape(document) {
  assert.deepEqual(Object.keys(document).sort(), [
    "created_at",
    "deleted_at",
    "display_name",
    "document_date",
    "document_type",
    "expense_description",
    "expense_id",
    "file",
    "file_availability",
    "file_status_note",
    "id",
    "notes",
    "ocr",
    "project_id",
    "project_name",
    "property_id",
    "property_name",
    "updated_at"
  ]);
  assert.deepEqual(Object.keys(document.ocr).sort(), ["completed_at", "has_text", "status"]);
  if (document.file) {
    assert.deepEqual(Object.keys(document.file).sort(), ["id", "mime_type", "original_file_name", "size_bytes", "status"]);
  }
  for (const internalField of [
    "workspace_id",
    "workspaceId",
    "created_by_user_id",
    "updated_by_user_id",
    "legacy_source",
    "legacySource",
    "storage_key",
    "object_storage_key",
    "raw_object_key",
    "local_path",
    "file_path",
    "ocr_text",
    "text"
  ]) {
    assert.equal(Object.hasOwn(document, internalField), false, `${internalField} should not be exposed`);
    if (document.file) {
      assert.equal(Object.hasOwn(document.file, internalField), false, `${internalField} should not be exposed on file`);
    }
  }
}

function documentPayloadWithout(field) {
  const payload = createDocumentPayload();
  delete payload[field];
  return payload;
}
