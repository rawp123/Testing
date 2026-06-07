import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  PROJECT_IDS,
  PROPERTY_IDS,
  VENDOR_IDS,
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

test("unauthenticated project list returns 401", async () => {
  const app = buildApp({
    config: createConfig({ authProvider: "none", devAuthEnabled: false }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects`,
    headers: {
      "x-request-id": "req-projects-401"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  assert.equal(response.json().error.requestId, "req-projects-401");

  await app.close();
});

test("viewer can list read and filter projects but cannot create update archive or delete", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/projects`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().data.length, 1);

  const filterResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/projects/filter-options`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(filterResponse.statusCode, 200);
  assert.deepEqual(filterResponse.json().data.statuses, ["planned"]);

  const readResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/projects/${PROJECT_IDS.viewerProject}`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json().data.id, PROJECT_IDS.viewerProject);

  for (const request of [
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/projects`,
      payload: createProjectPayload({ property_id: PROPERTY_IDS.viewerPrimary })
    },
    {
      method: "PATCH",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/projects/${PROJECT_IDS.viewerProject}`,
      payload: { name: "Viewer update" }
    },
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/projects/${PROJECT_IDS.viewerProject}/archive`
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/projects/${PROJECT_IDS.viewerProject}`
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

test("owner and editor can create update and archive projects", async () => {
  for (const [email, workspaceId, propertyId, vendorId] of [
    ["owner@example.test", WORKSPACE_IDS.owner, PROPERTY_IDS.ownerPrimary, VENDOR_IDS.ownerPrimary],
    ["editor@example.test", WORKSPACE_IDS.editor, PROPERTY_IDS.editorPrimary, VENDOR_IDS.editorPrimary]
  ]) {
    const db = createFakeWorkspaceDb(createSeededWorkspaceState());
    const app = buildApp({ config: createConfig(), db });

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/projects`,
      headers: authHeaders(email),
      payload: createProjectPayload({
        property_id: propertyId,
        vendor_id: vendorId,
        name: "  New project  ",
        category: "  masonry  "
      })
    });

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().data.name, "New project");
    assert.equal(createResponse.json().data.category, "masonry");
    assert.equal(createResponse.json().data.property_id, propertyId);
    assert.equal(createResponse.json().data.vendor_id, vendorId);
    const projectId = createResponse.json().data.id;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceId}/projects/${projectId}`,
      headers: authHeaders(email),
      payload: {
        name: "Updated project",
        vendor_id: null,
        completion_date: "2026-07-01",
        completeness_override_note: "Handled outside app."
      }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().data.name, "Updated project");
    assert.equal(updateResponse.json().data.vendor_id, null);
    assert.equal(updateResponse.json().data.completion_date, "2026-07-01");
    assert.equal(updateResponse.json().data.completeness_override_note, "Handled outside app.");
    assert.notEqual(updateResponse.json().data.completeness_overridden_at, null);

    const archiveResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/projects/${projectId}/archive`,
      headers: authHeaders(email)
    });
    assert.equal(archiveResponse.statusCode, 200);
    assert.equal(archiveResponse.json().data.status, "archived");
    assert.notEqual(archiveResponse.json().data.archived_at, null);
    assert.equal(db.projects.has(projectId), true);

    await app.close();
  }
});

test("project list supports workspace-scoped filters sorting search and date ranges", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const defaultResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects?sort=name_asc`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(defaultResponse.statusCode, 200);
  assert.deepEqual(defaultResponse.json().data.map((project) => project.id), [
    PROJECT_IDS.ownerDeck,
    PROJECT_IDS.ownerKitchen
  ]);
  assert.equal(defaultResponse.json().meta.total_count, 2);

  for (const [query, expectedIds] of [
    [`property_id=${PROPERTY_IDS.ownerSecondary}`, [PROJECT_IDS.ownerKitchen]],
    [`vendor_id=${VENDOR_IDS.ownerPrimary}`, [PROJECT_IDS.ownerDeck]],
    ["status=completed", [PROJECT_IDS.ownerKitchen]],
    ["category=deck%2Fpatio%2Fporch", [PROJECT_IDS.ownerDeck]],
    ["q=railing", [PROJECT_IDS.ownerDeck]],
    ["start_date_from=2026-06-01&start_date_to=2026-06-30", [PROJECT_IDS.ownerDeck]],
    ["completion_date_from=2026-05-01&completion_date_to=2026-05-31", [PROJECT_IDS.ownerKitchen]]
  ]) {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects?${query}`,
      headers: authHeaders("owner@example.test")
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data.map((project) => project.id), expectedIds);
  }

  const archivedResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects?archived=true`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(archivedResponse.statusCode, 200);
  assert.deepEqual(archivedResponse.json().data.map((project) => project.id), [PROJECT_IDS.ownerArchived]);

  await app.close();
});

test("project filter-options returns dynamic workspace-safe values", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/filter-options?status=in_progress`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.properties, [
    {
      id: PROPERTY_IDS.ownerPrimary,
      name: "Office"
    }
  ]);
  assert.deepEqual(response.json().data.vendors, [
    {
      id: VENDOR_IDS.ownerPrimary,
      name: "Cedarline Carpentry"
    }
  ]);
  assert.deepEqual(response.json().data.statuses, ["in_progress"]);
  assert.deepEqual(response.json().data.categories, ["deck/patio/porch"]);
  assert.equal(JSON.stringify(response.json().data).includes("Editor"), false);
  assert.equal(JSON.stringify(response.json().data).includes("Archived project"), false);

  await app.close();
});

test("project detail update archive and delete are scoped to the requested workspace", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  for (const request of [
    {
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/${PROJECT_IDS.editorProject}`
    },
    {
      method: "PATCH",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/${PROJECT_IDS.editorProject}`,
      payload: { name: "Cross workspace update" }
    },
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/${PROJECT_IDS.editorProject}/archive`
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/${PROJECT_IDS.editorProject}`
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

test("non-member and forged client claims cannot grant project access", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const nonMemberResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects`,
    headers: authHeaders("nonmember@example.test")
  });
  assert.equal(nonMemberResponse.statusCode, 404);

  const forgedHeaderResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/projects`,
    headers: {
      ...authHeaders("viewer@example.test"),
      "x-home-ledger-test-role": "owner",
      "x-home-ledger-test-workspace-id": WORKSPACE_IDS.viewer
    },
    payload: createProjectPayload({ property_id: PROPERTY_IDS.viewerPrimary })
  });
  assert.equal(forgedHeaderResponse.statusCode, 403);

  const forgedBodyResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects`,
    headers: authHeaders("nonmember@example.test"),
    payload: {
      ...createProjectPayload({ property_id: PROPERTY_IDS.ownerPrimary }),
      role: "owner",
      workspace_id: WORKSPACE_IDS.owner,
      vendor_id: VENDOR_IDS.ownerPrimary
    }
  });
  assert.equal(forgedBodyResponse.statusCode, 404);

  await app.close();
});

test("project relationship validation rejects missing cross-workspace archived and malformed links", async () => {
  const cases = [
    [projectPayloadWithout("property_id"), "property_id", "required", 422],
    [createProjectPayload({ property_id: "not-a-property-id" }), "property_id", "invalid_uuid", 400],
    [createProjectPayload({ property_id: PROPERTY_IDS.editorPrimary }), "property_id", "not_found", 400],
    [createProjectPayload({ property_id: PROPERTY_IDS.ownerArchived }), "property_id", "not_found", 400],
    [createProjectPayload({ vendor_id: "not-a-vendor-id" }), "vendor_id", "invalid_uuid", 400],
    [createProjectPayload({ vendor_id: VENDOR_IDS.editorPrimary }), "vendor_id", "not_found", 400],
    [createProjectPayload({ vendor_id: VENDOR_IDS.ownerArchived }), "vendor_id", "not_found", 400]
  ];

  for (const [payload, field, issue, statusCode] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects`,
      headers: authHeaders("owner@example.test"),
      payload
    });

    assert.equal(response.statusCode, statusCode);
    assert.equal(response.json().error.details[0].field, field);
    assert.equal(response.json().error.details[0].issue, issue);

    await app.close();
  }
});

test("project update validates changed relationships and supports clearing vendor", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const propertyResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/${PROJECT_IDS.ownerDeck}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      property_id: PROPERTY_IDS.ownerSecondary
    }
  });
  assert.equal(propertyResponse.statusCode, 200);
  assert.equal(propertyResponse.json().data.property_id, PROPERTY_IDS.ownerSecondary);

  const clearVendorResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/${PROJECT_IDS.ownerDeck}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      vendor_id: null
    }
  });
  assert.equal(clearVendorResponse.statusCode, 200);
  assert.equal(clearVendorResponse.json().data.vendor_id, null);

  const badVendorResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/${PROJECT_IDS.ownerDeck}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      vendor_id: VENDOR_IDS.editorPrimary
    }
  });
  assert.equal(badVendorResponse.statusCode, 400);
  assert.deepEqual(badVendorResponse.json().error.details[0], { field: "vendor_id", issue: "not_found" });

  await app.close();
});

test("malformed and unknown project ids return 400 or 404", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const malformedResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/not-a-project-id`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(malformedResponse.statusCode, 400);
  assert.equal(malformedResponse.json().error.code, "invalid_request");

  const unknownResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/00000000-0000-4000-8000-000000999999`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(unknownResponse.statusCode, 404);
  assert.equal(unknownResponse.json().error.code, "not_found");

  await app.close();
});

test("project validation rejects required invalid overlong unknown and camelCase fields", async () => {
  const cases = [
    [{ ...createProjectPayload(), name: "" }, "name", "required"],
    [{ ...createProjectPayload(), name: "x".repeat(161) }, "name", "too_long"],
    [{ ...createProjectPayload(), category: "" }, "category", "required"],
    [{ ...createProjectPayload(), category: "x".repeat(121) }, "category", "too_long"],
    [{ ...createProjectPayload(), status: "almost_done" }, "status", "invalid_status"],
    [{ ...createProjectPayload(), start_date: "2026-02-31" }, "start_date", "invalid_date"],
    [{ ...createProjectPayload(), start_date: "2026-06-10", completion_date: "2026-06-01" }, "completion_date", "before_start_date"],
    [{ ...createProjectPayload(), contractor_name_raw: "x".repeat(201) }, "contractor_name_raw", "too_long"],
    [{ ...createProjectPayload(), permit_number: "x".repeat(121) }, "permit_number", "too_long"],
    [{ ...createProjectPayload(), scope_summary: "x".repeat(5001) }, "scope_summary", "too_long"],
    [{ ...createProjectPayload(), notes: "x".repeat(5001) }, "notes", "too_long"],
    [{ ...createProjectPayload(), completeness_override_note: "x".repeat(1001) }, "completeness_override_note", "too_long"],
    [{ ...createProjectPayload(), surprise: true }, "surprise", "unknown_field"],
    [{ ...createProjectPayload(), propertyId: PROPERTY_IDS.ownerPrimary }, "propertyId", "unknown_field"],
    [{ ...createProjectPayload(), vendorId: VENDOR_IDS.ownerPrimary }, "vendorId", "unknown_field"],
    [{ ...createProjectPayload(), startDate: "2026-06-01" }, "startDate", "unknown_field"]
  ];

  for (const [payload, field, issue] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects`,
      headers: authHeaders("owner@example.test"),
      payload
    });

    assert.equal(response.statusCode, 422);
    assert.equal(response.json().error.code, "validation_failed");
    assert.deepEqual(response.json().error.details[0], { field, issue });

    await app.close();
  }
});

test("project API uses snake_case resource fields and hides internal metadata", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const createResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects`,
    headers: authHeaders("owner@example.test"),
    payload: createProjectPayload()
  });
  assert.equal(createResponse.statusCode, 201);
  assertProjectResponseShape(createResponse.json().data);
  const projectId = createResponse.json().data.id;

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assertProjectResponseShape(listResponse.json().data[0]);
  assert.deepEqual(Object.keys(listResponse.json().meta).sort(), ["limit", "offset", "total_count"]);

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/${projectId}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(detailResponse.statusCode, 200);
  assertProjectResponseShape(detailResponse.json().data);

  const archiveResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/${projectId}/archive`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(archiveResponse.statusCode, 200);
  assertProjectResponseShape(archiveResponse.json().data);
  assert.equal(archiveResponse.json().data.open_item_count, null);

  const filterResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/filter-options`,
    headers: authHeaders("owner@example.test")
  });
  assert.deepEqual(Object.keys(filterResponse.json().data).sort(), ["categories", "properties", "statuses", "vendors"]);

  await app.close();
});

test("DELETE project is a soft archive alias", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const response = await app.inject({
    method: "DELETE",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/projects/${PROJECT_IDS.ownerKitchen}`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.status, "archived");
  assert.notEqual(response.json().data.archived_at, null);
  assert.equal(db.projects.has(PROJECT_IDS.ownerKitchen), true);
  assert.equal(db.projects.get(PROJECT_IDS.ownerKitchen).deleted_at, null);

  await app.close();
});

function createProjectPayload(overrides = {}) {
  return {
    property_id: PROPERTY_IDS.ownerPrimary,
    vendor_id: VENDOR_IDS.ownerPrimary,
    name: "Project API test",
    category: "deck/patio/porch",
    status: "in_progress",
    start_date: "2026-06-01",
    completion_date: null,
    contractor_name_raw: "Cedarline Carpentry",
    permit_number: "PR-200",
    scope_summary: "Project scope.",
    notes: "Project notes.",
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

function assertProjectResponseShape(project) {
  assert.deepEqual(Object.keys(project).sort(), [
    "archived_at",
    "category",
    "completeness_overridden_at",
    "completeness_override_note",
    "completion_date",
    "contractor_name_raw",
    "created_at",
    "id",
    "name",
    "notes",
    "open_item_count",
    "permit_number",
    "property_id",
    "property_name",
    "scope_summary",
    "start_date",
    "status",
    "updated_at",
    "vendor_id",
    "vendor_name"
  ]);
  for (const internalField of [
    "workspace_id",
    "workspaceId",
    "deleted_at",
    "deletedAt",
    "created_by_user_id",
    "updated_by_user_id",
    "legacy_source",
    "legacySource",
    "object_storage_key",
    "raw_object_key"
  ]) {
    assert.equal(Object.hasOwn(project, internalField), false, `${internalField} should not be exposed`);
  }
}

function projectPayloadWithout(field) {
  const payload = createProjectPayload();
  delete payload[field];
  return payload;
}
