import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { TEST_AUTH_EMAIL_HEADER } from "../src/auth.js";
import { requireTestDatabaseUrl } from "../scripts/lib/db-env.mjs";
import { runMigrations } from "../scripts/lib/migration-runner.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const skipReason = "Set TEST_DATABASE_URL to a dedicated test database and run npm run test:api.";

test("DB-backed workspace authorization enforces membership and owner role", {
  skip: !testDatabaseUrl ? skipReason : false
}, async () => {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations({ databaseUrl, direction: "up" });

  const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ownerEmail = `owner_${suffix}@example.test`;
  const editorEmail = `editor_${suffix}@example.test`;
  const nonMemberEmail = `nonmember_${suffix}@example.test`;
  let workspaceId;

  try {
    const owner = await createUser(db, ownerEmail, "Owner");
    const editor = await createUser(db, editorEmail, "Editor");

    const app = buildApp({
      config: createConfig({ databaseUrl }),
      db
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: authHeaders(ownerEmail),
      payload: {
        name: `DB Auth ${suffix}`,
        role: "viewer"
      }
    });

    assert.equal(createResponse.statusCode, 201);
    workspaceId = createResponse.json().data.id;
    assert.equal(createResponse.json().data.role, "owner");

    await db.query(
      `
        INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
        VALUES ($1, $2, 'editor', 'active')
      `,
      [workspaceId, editor.id]
    );

    const editorRead = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: authHeaders(editorEmail)
    });
    assert.equal(editorRead.statusCode, 200);
    assert.equal(editorRead.json().data.role, "editor");

    const forgedEditorUpdate = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: {
        ...authHeaders(editorEmail),
        "x-home-ledger-test-role": "owner",
        "x-home-ledger-test-workspace-id": workspaceId
      },
      payload: {
        name: "Should not update"
      }
    });
    assert.equal(forgedEditorUpdate.statusCode, 403);

    const nonMemberRead = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: authHeaders(nonMemberEmail)
    });
    assert.equal(nonMemberRead.statusCode, 404);

    await app.close();
  } finally {
    if (workspaceId) {
      await db.query("DELETE FROM workspaces WHERE id = $1", [workspaceId]);
    }
    await db.query("DELETE FROM users WHERE email = ANY($1::text[])", [
      [ownerEmail, editorEmail, nonMemberEmail]
    ]);
    await db.end();
  }
});

async function createUser(db, email, displayName) {
  const result = await db.query(
    `
      INSERT INTO users (email, display_name, status)
      VALUES ($1, $2, 'active')
      RETURNING id
    `,
    [email, displayName]
  );
  return result.rows[0];
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
    dbPoolMax: 2,
    ...overrides
  };
}
