import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  VENDOR_IDS,
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

test("unauthenticated vendor list returns 401", async () => {
  const app = buildApp({
    config: createConfig({ authProvider: "none", devAuthEnabled: false }),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors`,
    headers: {
      "x-request-id": "req-vendors-401"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  assert.equal(response.json().error.requestId, "req-vendors-401");

  await app.close();
});

test("viewer can list and read vendors but cannot create update archive or delete", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/vendors`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().data.length, 1);

  const readResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/vendors/${VENDOR_IDS.viewerPrimary}`,
    headers: authHeaders("viewer@example.test")
  });
  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json().data.id, VENDOR_IDS.viewerPrimary);

  for (const request of [
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/vendors`,
      payload: { name: "Viewer create" }
    },
    {
      method: "PATCH",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/vendors/${VENDOR_IDS.viewerPrimary}`,
      payload: { name: "Viewer update" }
    },
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/vendors/${VENDOR_IDS.viewerPrimary}/archive`
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/vendors/${VENDOR_IDS.viewerPrimary}`
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

test("owner and editor can create update and archive vendors", async () => {
  for (const [email, workspaceId] of [
    ["owner@example.test", WORKSPACE_IDS.owner],
    ["editor@example.test", WORKSPACE_IDS.editor]
  ]) {
    const db = createFakeWorkspaceDb(createSeededWorkspaceState());
    const app = buildApp({ config: createConfig(), db });

    const createResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/vendors`,
      headers: authHeaders(email),
      payload: {
        name: "  New Vendor  ",
        category: "  painting  ",
        contact_name: "  Pat Painter  ",
        phone: "  555-0101  ",
        email: "  PAT@PAINT.EXAMPLE  ",
        website: "  https://paint.example  ",
        notes: "Created in API test"
      }
    });

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().data.name, "New Vendor");
    assert.equal(createResponse.json().data.normalized_name, "new vendor");
    assert.equal(createResponse.json().data.category, "painting");
    assert.equal(createResponse.json().data.contact_name, "Pat Painter");
    assert.equal(createResponse.json().data.email, "pat@paint.example");
    assert.equal(createResponse.json().data.website, "https://paint.example/");
    assert.equal(createResponse.json().data.status, "active");
    assert.equal(createResponse.json().data.source_confidence, "user_confirmed");
    const vendorId = createResponse.json().data.id;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceId}/vendors/${vendorId}`,
      headers: authHeaders(email),
      payload: {
        name: "Updated Vendor",
        category: "carpentry",
        notes: "Updated note"
      }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().data.name, "Updated Vendor");
    assert.equal(updateResponse.json().data.normalized_name, "updated vendor");
    assert.equal(updateResponse.json().data.category, "carpentry");

    const archiveResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/vendors/${vendorId}/archive`,
      headers: authHeaders(email)
    });
    assert.equal(archiveResponse.statusCode, 200);
    assert.equal(archiveResponse.json().data.status, "archived");
    assert.notEqual(archiveResponse.json().data.archived_at, null);
    assert.equal(db.vendors.has(vendorId), true);

    await app.close();
  }
});

test("vendor list returns active vendors in the workspace and supports search filters sorting and pagination", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const defaultResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors?sort=name_asc`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(defaultResponse.statusCode, 200);
  assert.deepEqual(defaultResponse.json().data.map((vendor) => vendor.id), [
    VENDOR_IDS.ownerPrimary,
    VENDOR_IDS.ownerSecondary
  ]);
  assert.equal(defaultResponse.json().meta.total_count, 2);

  const categoryResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors?category=painting`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(categoryResponse.statusCode, 200);
  assert.deepEqual(categoryResponse.json().data.map((vendor) => vendor.id), [VENDOR_IDS.ownerSecondary]);

  const searchResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors?q=sam&limit=1`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(searchResponse.statusCode, 200);
  assert.deepEqual(searchResponse.json().data.map((vendor) => vendor.id), [VENDOR_IDS.ownerPrimary]);
  assert.equal(searchResponse.json().meta.limit, 1);

  const archivedResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors?archived=true`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(archivedResponse.statusCode, 200);
  assert.deepEqual(archivedResponse.json().data.map((vendor) => vendor.id), [VENDOR_IDS.ownerArchived]);

  await app.close();
});

test("vendor detail update archive and delete are scoped to the requested workspace", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  for (const request of [
    {
      method: "GET",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors/${VENDOR_IDS.editorPrimary}`
    },
    {
      method: "PATCH",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors/${VENDOR_IDS.editorPrimary}`,
      payload: { name: "Cross workspace update" }
    },
    {
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors/${VENDOR_IDS.editorPrimary}/archive`
    },
    {
      method: "DELETE",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors/${VENDOR_IDS.editorPrimary}`
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

test("non-member gets 404 and client claims cannot grant vendor role or access", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const nonMemberResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors`,
    headers: authHeaders("nonmember@example.test")
  });
  assert.equal(nonMemberResponse.statusCode, 404);

  const forgedHeaderResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.viewer}/vendors`,
    headers: {
      ...authHeaders("viewer@example.test"),
      "x-home-ledger-test-role": "owner",
      "x-home-ledger-test-workspace-id": WORKSPACE_IDS.viewer
    },
    payload: {
      name: "Forged header vendor"
    }
  });
  assert.equal(forgedHeaderResponse.statusCode, 403);

  const forgedBodyResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors`,
    headers: authHeaders("nonmember@example.test"),
    payload: {
      name: "Forged body vendor",
      role: "owner",
      workspace_id: WORKSPACE_IDS.owner
    }
  });
  assert.equal(forgedBodyResponse.statusCode, 404);

  await app.close();
});

test("malformed and unknown vendor ids return 400 or 404", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const malformedResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors/not-a-vendor-id`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(malformedResponse.statusCode, 400);
  assert.equal(malformedResponse.json().error.code, "invalid_request");

  const unknownResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors/00000000-0000-4000-8000-000000999999`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(unknownResponse.statusCode, 404);
  assert.equal(unknownResponse.json().error.code, "not_found");

  await app.close();
});

test("vendor validation rejects required invalid overlong unknown and camelCase fields", async () => {
  const cases = [
    [{}, "name", "required"],
    [{ name: "x".repeat(161) }, "name", "too_long"],
    [{ name: "Vendor", category: "x".repeat(121) }, "category", "too_long"],
    [{ name: "Vendor", contact_name: "x".repeat(161) }, "contact_name", "too_long"],
    [{ name: "Vendor", phone: "x".repeat(81) }, "phone", "too_long"],
    [{ name: "Vendor", email: "not-email" }, "email", "invalid_email"],
    [{ name: "Vendor", website: "ftp://example.test" }, "website", "invalid_url"],
    [{ name: "Vendor", notes: "x".repeat(5001) }, "notes", "too_long"],
    [{ name: "Vendor", status: "pending" }, "status", "invalid_status"],
    [{ name: "Vendor", surprise: true }, "surprise", "unknown_field"],
    [{ name: "Vendor", contactName: "Camel" }, "contactName", "unknown_field"],
    [{ name: "Vendor", normalizedName: "internal" }, "normalizedName", "unknown_field"],
    [{ name: "Vendor", sourceConfidence: "inferred" }, "sourceConfidence", "unknown_field"]
  ];

  for (const [payload, field, issue] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors`,
      headers: authHeaders("owner@example.test"),
      payload
    });

    assert.equal(response.statusCode, 422);
    assert.equal(response.json().error.code, "validation_failed");
    assert.deepEqual(response.json().error.details[0], { field, issue });

    await app.close();
  }
});

test("vendor API uses snake_case resource fields and hides internal metadata", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const createResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors`,
    headers: authHeaders("owner@example.test"),
    payload: {
      name: "Shape Vendor",
      category: "inspection",
      contact_name: "Casey Contact",
      phone: "555-0110",
      email: "casey@example.test",
      website: "https://vendor.example",
      notes: "Visible note"
    }
  });
  assert.equal(createResponse.statusCode, 201);
  assertVendorResponseShape(createResponse.json().data);
  const vendorId = createResponse.json().data.id;

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(listResponse.statusCode, 200);
  assertVendorResponseShape(listResponse.json().data[0]);
  assert.deepEqual(Object.keys(listResponse.json().meta).sort(), ["limit", "offset", "total_count"]);

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors/${vendorId}`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(detailResponse.statusCode, 200);
  assertVendorResponseShape(detailResponse.json().data);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors/${vendorId}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      contact_name: null,
      email: null,
      website: null
    }
  });
  assert.equal(updateResponse.statusCode, 200);
  assertVendorResponseShape(updateResponse.json().data);
  assert.equal(updateResponse.json().data.contact_name, null);
  assert.equal(updateResponse.json().data.email, null);
  assert.equal(updateResponse.json().data.website, null);

  const archiveResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors/${vendorId}/archive`,
    headers: authHeaders("owner@example.test")
  });
  assert.equal(archiveResponse.statusCode, 200);
  assertVendorResponseShape(archiveResponse.json().data);
  assert.notEqual(archiveResponse.json().data.archived_at, null);

  await app.close();
});

test("duplicate and same-normalized-name vendors are allowed", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const firstResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors`,
    headers: authHeaders("owner@example.test"),
    payload: {
      name: "Same Vendor"
    }
  });
  const secondResponse = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors`,
    headers: authHeaders("owner@example.test"),
    payload: {
      name: "  same   vendor  "
    }
  });

  assert.equal(firstResponse.statusCode, 201);
  assert.equal(secondResponse.statusCode, 201);
  assert.notEqual(firstResponse.json().data.id, secondResponse.json().data.id);
  assert.equal(firstResponse.json().data.normalized_name, "same vendor");
  assert.equal(secondResponse.json().data.normalized_name, "same vendor");

  await app.close();
});

test("DELETE vendor is a soft archive alias", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const response = await app.inject({
    method: "DELETE",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}/vendors/${VENDOR_IDS.ownerSecondary}`,
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.status, "archived");
  assert.notEqual(response.json().data.archived_at, null);
  assert.equal(db.vendors.has(VENDOR_IDS.ownerSecondary), true);
  assert.equal(db.vendors.get(VENDOR_IDS.ownerSecondary).deleted_at, null);

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

function assertVendorResponseShape(vendor) {
  assert.deepEqual(Object.keys(vendor).sort(), [
    "archived_at",
    "category",
    "contact_name",
    "created_at",
    "email",
    "id",
    "name",
    "normalized_name",
    "notes",
    "phone",
    "source_confidence",
    "status",
    "updated_at",
    "website"
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
    assert.equal(Object.hasOwn(vendor, internalField), false, `${internalField} should not be exposed`);
  }
}
