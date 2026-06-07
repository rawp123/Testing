const WORKSPACE_NAME_MAX_LENGTH = 120;

export async function listActiveMembershipsForUser({ db, userId }) {
  const result = await db.query(
    `
      -- listActiveMembershipsForUser
      SELECT
        wm.id AS membership_id,
        wm.workspace_id,
        w.name AS workspace_name,
        wm.role
      FROM workspace_memberships wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
        AND wm.status = 'active'
        AND wm.removed_at IS NULL
        AND w.status = 'active'
        AND w.deleted_at IS NULL
      ORDER BY w.created_at ASC, wm.created_at ASC
    `,
    [userId]
  );

  return result.rows.map(mapMembershipRow);
}

export async function listUserWorkspaces({ db, userId }) {
  const result = await db.query(
    `
      -- listUserWorkspaces
      SELECT
        w.id,
        w.name,
        w.status,
        w.settings,
        w.created_at,
        w.updated_at,
        wm.id AS membership_id,
        wm.role
      FROM workspace_memberships wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
        AND wm.status = 'active'
        AND wm.removed_at IS NULL
        AND w.status = 'active'
        AND w.deleted_at IS NULL
      ORDER BY w.created_at ASC, wm.created_at ASC
    `,
    [userId]
  );

  return result.rows.map(mapWorkspaceRow);
}

export async function loadWorkspaceMembership({ db, userId, workspaceId }) {
  const result = await db.query(
    `
      -- loadWorkspaceMembership
      SELECT
        w.id,
        w.name,
        w.status,
        w.settings,
        w.created_at,
        w.updated_at,
        wm.id AS membership_id,
        wm.role
      FROM workspace_memberships wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
        AND wm.workspace_id = $2
        AND wm.status = 'active'
        AND wm.removed_at IS NULL
        AND w.status = 'active'
        AND w.deleted_at IS NULL
      LIMIT 1
    `,
    [userId, workspaceId]
  );

  const row = result.rows[0];
  return row ? mapWorkspaceRow(row) : null;
}

export async function createWorkspaceWithOwner({ db, userId, name }) {
  const workspaceName = normalizeWorkspaceName(name);
  return withTransaction(db, async (client) => {
    const workspaceResult = await client.query(
      `
        -- createWorkspaceWithOwner.workspace
        INSERT INTO workspaces (name, owner_user_id, status, settings)
        VALUES ($1, $2, 'active', '{}'::jsonb)
        RETURNING id, name, status, settings, created_at, updated_at
      `,
      [workspaceName, userId]
    );

    const workspace = workspaceResult.rows[0];

    const membershipResult = await client.query(
      `
        -- createWorkspaceWithOwner.membership
        INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
        VALUES ($1, $2, 'owner', 'active')
        RETURNING id, role
      `,
      [workspace.id, userId]
    );

    return mapWorkspaceRow({
      ...workspace,
      membership_id: membershipResult.rows[0].id,
      role: membershipResult.rows[0].role
    });
  });
}

export async function updateWorkspaceBasics({ db, workspaceId, name }) {
  const workspaceName = normalizeWorkspaceName(name);
  const result = await db.query(
    `
      -- updateWorkspaceBasics
      UPDATE workspaces
      SET name = $2,
          updated_at = now()
      WHERE id = $1
        AND status = 'active'
        AND deleted_at IS NULL
      RETURNING id, name, status, settings, created_at, updated_at
    `,
    [workspaceId, workspaceName]
  );

  return result.rows[0] ? mapWorkspaceRow(result.rows[0]) : null;
}

export function serializeWorkspace(workspace) {
  return {
    id: workspace.id,
    name: workspace.name,
    status: workspace.status,
    role: workspace.role,
    settings: workspace.settings || {},
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt
  };
}

export function normalizeWorkspaceName(name) {
  const normalized = String(name || "").trim();
  if (!normalized) {
    throw new WorkspaceValidationError("name", "required", "Workspace name is required.");
  }
  if (normalized.length > WORKSPACE_NAME_MAX_LENGTH) {
    throw new WorkspaceValidationError("name", "too_long", "Workspace name is too long.");
  }
  return normalized;
}

export class WorkspaceValidationError extends Error {
  constructor(field, issue, message) {
    super(message);
    this.name = "WorkspaceValidationError";
    this.field = field;
    this.issue = issue;
  }
}

function mapMembershipRow(row) {
  return {
    id: row.membership_id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    role: row.role
  };
}

function mapWorkspaceRow(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    role: row.role,
    membershipId: row.membership_id,
    settings: row.settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function withTransaction(db, callback) {
  const client = typeof db.connect === "function" ? await db.connect() : db;

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    if (client !== db && typeof client.release === "function") {
      client.release();
    }
  }
}
