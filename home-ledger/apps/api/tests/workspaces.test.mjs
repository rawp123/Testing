import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import {
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

test("unauthenticated workspace request returns 401", async () => {
  const app = buildApp({
    config: createConfig({ authProvider: "none", devAuthEnabled: false }),
    db: createFakeWorkspaceDb()
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/workspaces",
    headers: {
      "x-request-id": "req-workspaces-401"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    error: {
      code: "unauthenticated",
      message: "Sign in required.",
      requestId: "req-workspaces-401"
    }
  });

  await app.close();
});

test("authenticated user lists only active workspaces with active memberships", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/workspaces",
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    data: [
      {
        id: WORKSPACE_IDS.owner,
        name: "Owner workspace",
        status: "active",
        role: "owner",
        settings: {},
        createdAt: "2026-06-06T12:00:00.000Z",
        updatedAt: "2026-06-06T12:00:00.000Z"
      }
    ]
  });

  await app.close();
});

test("owner editor and viewer can read workspace details", async () => {
  const cases = [
    ["owner@example.test", WORKSPACE_IDS.owner, "owner"],
    ["editor@example.test", WORKSPACE_IDS.editor, "editor"],
    ["viewer@example.test", WORKSPACE_IDS.viewer, "viewer"]
  ];

  for (const [email, workspaceId, role] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: authHeaders(email)
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.id, workspaceId);
    assert.equal(response.json().data.role, role);

    await app.close();
  }
});

test("non-member, inactive membership, and deleted workspace are hidden with 404", async () => {
  const cases = [
    ["nonmember@example.test", WORKSPACE_IDS.owner],
    ["owner@example.test", WORKSPACE_IDS.inactiveMembership],
    ["owner@example.test", WORKSPACE_IDS.deleted]
  ];

  for (const [email, workspaceId] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: authHeaders(email)
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "not_found");
    assert.doesNotMatch(response.json().error.message, /Owner workspace|Deleted workspace/);

    await app.close();
  }
});

test("invalid workspace id returns 400 invalid_request", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/workspaces/not-a-uuid",
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "invalid_request");

  await app.close();
});

test("owner can create workspace and request body cannot choose role", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/workspaces",
    headers: authHeaders("viewer@example.test"),
    payload: {
      name: "New records",
      role: "viewer"
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.name, "New records");
  assert.equal(response.json().data.role, "owner");

  await app.close();
});

test("owner can update workspace basics", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const app = buildApp({ config: createConfig(), db });

  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.owner}`,
    headers: authHeaders("owner@example.test"),
    payload: {
      name: "Updated workspace"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.name, "Updated workspace");
  assert.equal(response.json().data.role, "owner");

  await app.close();
});

test("editor viewer and non-member cannot update workspace basics", async () => {
  const cases = [
    ["editor@example.test", WORKSPACE_IDS.editor, 403, "forbidden"],
    ["viewer@example.test", WORKSPACE_IDS.viewer, 403, "forbidden"],
    ["nonmember@example.test", WORKSPACE_IDS.owner, 404, "not_found"]
  ];

  for (const [email, workspaceId, statusCode, errorCode] of cases) {
    const app = buildApp({
      config: createConfig(),
      db: createFakeWorkspaceDb(createSeededWorkspaceState())
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: authHeaders(email),
      payload: {
        name: "Forbidden update"
      }
    });

    assert.equal(response.statusCode, statusCode);
    assert.equal(response.json().error.code, errorCode);

    await app.close();
  }
});

test("client headers cannot grant user id role or workspace membership", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${WORKSPACE_IDS.editor}`,
    headers: {
      ...authHeaders("editor@example.test"),
      "x-home-ledger-test-role": "owner",
      "x-home-ledger-test-workspace-id": WORKSPACE_IDS.editor,
      "x-home-ledger-test-user-id": "00000000-0000-4000-8000-000000000101"
    },
    payload: {
      name: "Forged update"
    }
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "forbidden");

  await app.close();
});

test("session memberships use the shared active membership query", async () => {
  const app = buildApp({
    config: createConfig(),
    db: createFakeWorkspaceDb(createSeededWorkspaceState())
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/session",
    headers: authHeaders("owner@example.test")
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.memberships, [
    {
      id: "00000000-0000-4000-8000-000000000201",
      workspaceId: WORKSPACE_IDS.owner,
      workspaceName: "Owner workspace",
      role: "owner"
    }
  ]);

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
