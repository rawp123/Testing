import assert from "node:assert/strict";
import test from "node:test";
import {
  canManageWorkspace,
  canReadWorkspace,
  canWriteWorkspace,
  requireAuth,
  requireWorkspaceRole,
  validateWorkspaceId
} from "../src/authorization.js";
import {
  WORKSPACE_IDS,
  createFakeWorkspaceDb,
  createSeededWorkspaceState
} from "./helpers/fake-workspace-db.mjs";

test("workspace role helpers match owner editor viewer expectations", () => {
  assert.equal(canReadWorkspace("owner"), true);
  assert.equal(canReadWorkspace("editor"), true);
  assert.equal(canReadWorkspace("viewer"), true);
  assert.equal(canReadWorkspace("unknown"), false);

  assert.equal(canWriteWorkspace("owner"), true);
  assert.equal(canWriteWorkspace("editor"), true);
  assert.equal(canWriteWorkspace("viewer"), false);

  assert.equal(canManageWorkspace("owner"), true);
  assert.equal(canManageWorkspace("editor"), false);
  assert.equal(canManageWorkspace("viewer"), false);
});

test("requireAuth rejects unauthenticated requests", () => {
  assert.throws(
    () => requireAuth({ auth: null }),
    (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "unauthenticated");
      return true;
    }
  );
});

test("requireWorkspaceRole allows listed roles", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());
  const membership = await requireWorkspaceRole({
    request: { auth: { userId: "00000000-0000-4000-8000-000000000102" } },
    db,
    workspaceId: WORKSPACE_IDS.editor,
    allowedRoles: ["owner", "editor"]
  });

  assert.equal(membership.role, "editor");
  assert.equal(membership.id, WORKSPACE_IDS.editor);
});

test("requireWorkspaceRole rejects insufficient roles with 403", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());

  await assert.rejects(
    () => requireWorkspaceRole({
      request: { auth: { userId: "00000000-0000-4000-8000-000000000103" } },
      db,
      workspaceId: WORKSPACE_IDS.viewer,
      allowedRoles: ["owner"]
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "forbidden");
      return true;
    }
  );
});

test("requireWorkspaceRole hides missing membership with 404", async () => {
  const db = createFakeWorkspaceDb(createSeededWorkspaceState());

  await assert.rejects(
    () => requireWorkspaceRole({
      request: { auth: { userId: "00000000-0000-4000-8000-000000000104" } },
      db,
      workspaceId: WORKSPACE_IDS.owner,
      allowedRoles: ["owner", "editor", "viewer"]
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "not_found");
      return true;
    }
  );
});

test("workspace id validation rejects malformed ids with 400", () => {
  assert.throws(
    () => validateWorkspaceId("not-a-workspace-id"),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "invalid_request");
      return true;
    }
  );
});
