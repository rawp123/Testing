import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";

test("GET /health is public and does not resolve auth", async () => {
  const db = createFailingDb();
  const app = buildApp({ config: createConfig({ devAuthEnabled: false }), db });

  const response = await app.inject({
    method: "GET",
    url: "/health"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    data: {
      status: "ok"
    }
  });

  await app.close();
});

test("GET /api/v1/session returns a consistent 401 envelope when unauthenticated", async () => {
  const app = buildApp({
    config: createConfig({ authProvider: "none", devAuthEnabled: false }),
    db: createFailingDb()
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/session",
    headers: {
      "x-request-id": "req-session-test"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    error: {
      code: "unauthenticated",
      message: "Sign in required.",
      requestId: "req-session-test"
    }
  });

  await app.close();
});

test("GET /api/v1/session returns dev user and database memberships", async () => {
  const app = buildApp({
    config: createConfig({ appEnv: "test" }),
    db: createFakeSessionDb({
      membershipsByEmail: {
        "owner@example.test": [
          {
            membership_id: "membership-1",
            workspace_id: "workspace-1",
            workspace_name: "Home records",
            role: "owner"
          }
        ]
      }
    })
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/session",
    headers: {
      [TEST_AUTH_EMAIL_HEADER]: "owner@example.test"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    data: {
      user: {
        id: "user-1",
        email: "owner@example.test",
        displayName: "Local Developer"
      },
      authProvider: "dev",
      isDevAuth: true,
      memberships: [
        {
          id: "membership-1",
          workspaceId: "workspace-1",
          workspaceName: "Home records",
          role: "owner"
        }
      ]
    }
  });

  await app.close();
});

function createConfig(overrides = {}) {
  return {
    appEnv: "local",
    authProvider: "dev",
    devAuthEnabled: true,
    devAuthEmail: "dev@example.test",
    devAuthDisplayName: "Local Developer",
    requestIdHeader: "x-request-id",
    ...overrides
  };
}

function createFakeSessionDb({ membershipsByEmail = {} } = {}) {
  const usersByEmail = new Map();

  return {
    async query(sql, params) {
      if (/INSERT INTO users/i.test(sql)) {
        const [email, displayName] = params;
        const user = {
          id: `user-${usersByEmail.size + 1}`,
          email,
          display_name: displayName,
          status: "active"
        };
        usersByEmail.set(email, user);
        return { rows: [user] };
      }

      if (/FROM workspace_memberships/i.test(sql)) {
        const user = [...usersByEmail.values()].find((candidate) => candidate.id === params[0]);
        return { rows: membershipsByEmail[user?.email] || [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };
}

function createFailingDb() {
  return {
    async query() {
      throw new Error("Database should not be queried.");
    }
  };
}
