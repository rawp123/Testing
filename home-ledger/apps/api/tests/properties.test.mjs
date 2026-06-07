import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  PROPERTY_IDS,
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

test("unauthenticated property list returns 401", async () => {
  const app = buildApp({
    config: createConfig({ authProvider: "none", devAuthEnabled: false }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties`,
    headers: {
      "x-request-id": "req-properties-401"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  assert.equal(response.json().error.requestId, "req-properties-401");

  await app.close();
});

test("viewer can list and read properties but cannot create update or archive", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/properties`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().data.length, 1);

  const readResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/properties/${PROPERTY_IDS.viewerPrimary}`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json().data.id, PROPERTY_IDS.viewerPrimary);

  for (const request of [
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/properties`,
      payload: { name: "Viewer create" }
    },
    {
      method: "PATCH",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/properties/${PROPERTY_IDS.viewerPrimary}`,
      payload: { name: "Viewer update" }
    },
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/properties/${PROPERTY_IDS.viewerPrimary}/archive`
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/properties/${PROPERTY_IDS.viewerPrimary}`
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

test("owner and editor can create update and archive properties", async () => {
  for (const [email, workspaceId] of [
    ["owner@example.test", WORKSPACE_IDS.owner],
    ["editor@example.test", WORKSPACE_IDS.editor]
  ]) {
    const db = createFakeWorkspaceDb(createSeededWorkspaceState());
    const app = buildApp({ config: createConfig(), db });

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties`,
      headers: authHeaders(email),
      payload: {
        name: "  New property  ",
        display_address: "  10 Main Street  ",
        purchase_date: "2021-03-04",
        purchase_price_cents: 1234500,
        notes: "Created in API test"
      }
    });

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().data.name, "New property");
    assert.equal(createResponse.json().data.display_address, "10 Main Street");
    const propertyId = createResponse.json().data.id;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceId}/properties/${propertyId}`,
      headers: authHeaders(email),
      payload: {
        name: "Updated property",
        purchase_price_cents: 2234500
      }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().data.name, "Updated property");
    assert.equal(updateResponse.json().data.purchase_price_cents, 2234500);

    const archiveResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/properties/${propertyId}/archive`,
      headers: authHeaders(email)
    });
    assert.equal(archiveResponse.statusCode, 200);
    assert.notEqual(archiveResponse.json().data.archived_at, null);
    assert.equal(db.properties.has(propertyId), true);

    await app.close();
  }
});

test("property API uses snake_case resource fields and hides internal metadata", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const createResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties`,
    headers: authHeaders("owner@example.test"),
    payload: {
      name: "Shape check",
      display_address: "44 Contract Lane",
      purchase_date: "2022-04-05",
      purchase_price_cents: 3456700,
      currency_code: "USD",
      notes: "Visible note",
      is_primary: true
    }
  });
  assert.equal(createResponse.statusCode, 201);
  assertPropertyResponseShape(createResponse.json().data);
  assert.equal(createResponse.json().data.display_address, "44 Contract Lane");
  assert.equal(createResponse.json().data.purchase_price_cents, 3456700);
  assert.equal(createResponse.json().data.is_primary, true);
  const propertyId = createResponse.json().data.id;

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assertPropertyResponseShape(listResponse.json().data[0]);
  assert.deepEqual(Object.keys(listResponse.json().meta).sort(), ["limit", "offset", "total_count"]);

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/${propertyId}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(detailResponse.statusCode, 200);
  assertPropertyResponseShape(detailResponse.json().data);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/${propertyId}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      display_address: null,
      purchase_price_cents: 4456700,
      is_primary: false
    }
  });
  assert.equal(updateResponse.statusCode, 200);
  assertPropertyResponseShape(updateResponse.json().data);
  assert.equal(updateResponse.json().data.display_address, null);
  assert.equal(updateResponse.json().data.purchase_price_cents, 4456700);
  assert.equal(updateResponse.json().data.is_primary, false);

  const archiveResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/${propertyId}/archive`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(archiveResponse.statusCode, 200);
  assertPropertyResponseShape(archiveResponse.json().data);
  assert.notEqual(archiveResponse.json().data.archived_at, null);

  await app.close();
});

test("DELETE property is a soft archive alias", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const response = await app.inject({
    method: "DELETE",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/${PROPERTY_IDS.ownerSecondary}`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.notEqual(response.json().data.archived_at, null);
  assert.equal(db.properties.has(PROPERTY_IDS.ownerSecondary), true);
  assert.equal(db.properties.get(PROPERTY_IDS.ownerSecondary).deleted_at, null);

  await app.close();
});

test("property list returns only active properties in the workspace by default", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties?sort=name_asc`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.map((property) => property.id), [
    PROPERTY_IDS.ownerSecondary,
    PROPERTY_IDS.ownerPrimary
  ]);
  assert.equal(response.json().meta.total_count, 2);

  await app.close();
});

test("property detail update and archive are scoped to the requested workspace", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  for (const request of [
    {
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/${PROPERTY_IDS.editorPrimary}`
    },
    {
      method: "PATCH",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/${PROPERTY_IDS.editorPrimary}`,
      payload: { name: "Cross workspace update" }
    },
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/${PROPERTY_IDS.editorPrimary}/archive`
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/${PROPERTY_IDS.editorPrimary}`
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

test("non-member gets 404 and client claims cannot grant workspace role or access", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const nonMemberResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties`,
    headers: authHeaders("nonmember@example.test")
  });
  assert.equal(nonMemberResponse.statusCode, 404);

  const forgedHeaderResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/properties`,
    headers: {
      ...authHeaders("viewer@example.test"),
      "x-home-ledger-test-role": "owner",
      "x-home-ledger-test-workspace-id": WORKSPACE_IDS.viewer
    },
    payload: {
      name: "Forged header property"
    }
  });
  assert.equal(forgedHeaderResponse.statusCode, 403);

  const forgedBodyResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties`,
    headers: authHeaders("nonmember@example.test"),
    payload: {
      name: "Forged body property",
      role: "owner",
      workspace_id: WORKSPACE_IDS.owner
    }
  });
  assert.equal(forgedBodyResponse.statusCode, 404);

  await app.close();
});

test("malformed and unknown property ids return 400 or 404", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const malformedResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/not-a-property-id`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(malformedResponse.statusCode, 400);
  assert.equal(malformedResponse.json().error.code, "invalid_request");

  const unknownResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/00000000-0000-4000-8000-000000999999`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(unknownResponse.statusCode, 404);
  assert.equal(unknownResponse.json().error.code, "not_found");

  await app.close();
});

test("property validation rejects required invalid and unknown fields", async () => {
  const cases = [
    [{}, "name", "required"],
    [{ name: "x".repeat(121) }, "name", "too_long"],
    [{ name: "Office", purchase_price_cents: 12.5 }, "purchase_price_cents", "must_be_integer"],
    [{ name: "Office", purchase_price_cents: -1 }, "purchase_price_cents", "must_be_nonnegative"],
    [{ name: "Office", purchase_date: "2024-02-31" }, "purchase_date", "invalid_date"],
    [{ name: "Office", notes: "x".repeat(5001) }, "notes", "too_long"],
    [{ name: "Office", surprise: true }, "surprise", "unknown_field"],
    [{ name: "Office", displayAddress: "Camel case" }, "displayAddress", "unknown_field"],
    [{ name: "Office", purchasePriceCents: 1000 }, "purchasePriceCents", "unknown_field"],
    [{ name: "Office", isPrimary: true }, "isPrimary", "unknown_field"]
  ];

  for (const [payload, field, issue] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties`,
      headers: authHeaders("owner@example.test"),
      payload
    });

    assert.equal(response.statusCode, 422);
    assert.equal(response.json().error.code, "validation_failed");
    assert.deepEqual(response.json().error.details[0], { field, issue });

    await app.close();
  }
});

test("primary property behavior is workspace-scoped and clears prior primary", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const createPrimaryResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties`,
    headers: authHeaders("owner@example.test"),
    payload: {
      name: "Primary replacement",
      is_primary: true
    }
  });
  assert.equal(createPrimaryResponse.statusCode, 201);
  const createdId = createPrimaryResponse.json().data.id;
  assert.equal(db.properties.get(PROPERTY_IDS.ownerPrimary).is_primary, false);
  assert.equal(db.properties.get(createdId).is_primary, true);
  assert.equal(db.properties.get(PROPERTY_IDS.editorPrimary).is_primary, true);

  const updatePrimaryResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/${PROPERTY_IDS.ownerSecondary}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      is_primary: true
    }
  });
  assert.equal(updatePrimaryResponse.statusCode, 200);
  assert.equal(db.properties.get(createdId).is_primary, false);
  assert.equal(db.properties.get(PROPERTY_IDS.ownerSecondary).is_primary, true);

  const archivePrimaryResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/properties/${PROPERTY_IDS.ownerSecondary}/archive`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(archivePrimaryResponse.statusCode, 200);
  assert.equal(db.properties.get(PROPERTY_IDS.ownerSecondary).is_primary, false);
  assert.equal(db.properties.get(PROPERTY_IDS.ownerPrimary).is_primary, false);

  await app.close();
});

test("first active property in a workspace becomes primary by default", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const workspaceResponse = await app.inject({
    method: "POST",
    url: "/api/v1/workspaces",
    headers: authHeaders("nonmember@example.test"),
    payload: {
      name: "Empty workspace"
    }
  });
  assert.equal(workspaceResponse.statusCode, 201);
  const workspaceId = workspaceResponse.json().data.id;

  const propertyResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${workspaceId}/properties`,
    headers: authHeaders("nonmember@example.test"),
    payload: {
      name: "First property"
    }
  });

  assert.equal(propertyResponse.statusCode, 201);
  assert.equal(propertyResponse.json().data.is_primary, true);

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
    ...overrides
  };
}

function assertPropertyResponseShape(property) {
  assert.deepEqual(Object.keys(property).sort(), [
    "archived_at",
    "created_at",
    "currency_code",
    "display_address",
    "id",
    "is_primary",
    "name",
    "notes",
    "purchase_date",
    "purchase_price_cents",
    "updated_at"
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
    assert.equal(Object.hasOwn(property, internalField), false, `${internalField} should not be exposed`);
  }
}
