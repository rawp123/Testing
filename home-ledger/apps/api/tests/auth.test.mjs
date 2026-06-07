import assert from "node:assert/strict";
import test from "node:test";
import {
  TEST_AUTH_DISPLAY_NAME_HEADER,
  TEST_AUTH_EMAIL_HEADER,
  resolveAuthenticatedRequest,
  serializeSession
} from "../src/auth.js";

test("resolveAuthenticatedRequest creates or loads a dev user and reads memberships from the database", async () => {
  const db = createFakeSessionDb({
    membershipsByEmail: {
      "dev@example.test": [
        {
          membership_id: "membership-1",
          workspace_id: "workspace-1",
          workspace_name: "Home records",
          role: "owner"
        }
      ]
    }
  });

  const auth = await resolveAuthenticatedRequest({
    request: { headers: {} },
    config: createConfig(),
    db
  });

  assert.equal(auth.email, "dev@example.test");
  assert.equal(auth.displayName, "Local Developer");
  assert.equal(auth.authProvider, "dev");
  assert.equal(auth.isDevAuth, true);
  assert.deepEqual(auth.memberships, [
    {
      id: "membership-1",
      workspaceId: "workspace-1",
      workspaceName: "Home records",
      role: "owner"
    }
  ]);
  assert.equal(db.queries.length, 2);
});

test("test auth header can select an email in test only, but not memberships or roles", async () => {
  const db = createFakeSessionDb({
    membershipsByEmail: {
      "someone@example.test": [
        {
          membership_id: "membership-2",
          workspace_id: "workspace-2",
          workspace_name: "Imported home",
          role: "viewer"
        }
      ]
    }
  });

  const auth = await resolveAuthenticatedRequest({
    request: {
      headers: {
        [TEST_AUTH_EMAIL_HEADER]: "Someone@Example.Test",
        [TEST_AUTH_DISPLAY_NAME_HEADER]: "Someone Else",
        "x-home-ledger-test-role": "owner",
        "x-home-ledger-test-workspace-id": "workspace-forged"
      }
    },
    config: createConfig({ appEnv: "test" }),
    db
  });

  assert.equal(auth.email, "someone@example.test");
  assert.equal(auth.displayName, "Someone Else");
  assert.deepEqual(auth.memberships, [
    {
      id: "membership-2",
      workspaceId: "workspace-2",
      workspaceName: "Imported home",
      role: "viewer"
    }
  ]);
});

test("test auth header is ignored outside test environment", async () => {
  const db = createFakeSessionDb();

  const auth = await resolveAuthenticatedRequest({
    request: {
      headers: {
        [TEST_AUTH_EMAIL_HEADER]: "other@example.test"
      }
    },
    config: createConfig({ appEnv: "local", devAuthEmail: "dev@example.test" }),
    db
  });

  assert.equal(auth.email, "dev@example.test");
});

test("disabled dev auth returns unauthenticated without touching the database", async () => {
  const db = createFakeSessionDb();

  const auth = await resolveAuthenticatedRequest({
    request: { headers: {} },
    config: createConfig({ devAuthEnabled: false }),
    db
  });

  assert.equal(auth, null);
  assert.equal(db.queries.length, 0);
});

test("serializeSession exposes only safe session and membership facts", () => {
  const session = serializeSession({
    userId: "user-1",
    email: "dev@example.test",
    displayName: "Local Developer",
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
  });

  assert.deepEqual(session, {
    data: {
      user: {
        id: "user-1",
        email: "dev@example.test",
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
});

function createConfig(overrides = {}) {
  return {
    appEnv: "local",
    authProvider: "dev",
    devAuthEnabled: true,
    devAuthEmail: "dev@example.test",
    devAuthDisplayName: "Local Developer",
    ...overrides
  };
}

function createFakeSessionDb({ membershipsByEmail = {} } = {}) {
  const usersByEmail = new Map();
  const queries = [];

  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });

      if (/INSERT INTO users/i.test(sql)) {
        const [email, displayName] = params;
        const existing = usersByEmail.get(email);
        const user = existing || {
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
