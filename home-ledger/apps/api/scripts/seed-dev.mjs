import pg from "pg";
import { normalizeEmail } from "../src/config.js";
import { requireDatabaseUrl } from "./lib/db-env.mjs";

const databaseUrl = requireDatabaseUrl();
const appEnv = String(process.env.APP_ENV || process.env.NODE_ENV || "development").trim().toLowerCase();

if (["production", "prod", "staging"].includes(appEnv)) {
  throw new Error(`Refusing to seed local dev data in ${appEnv}.`);
}

const devEmail = normalizeEmail(process.env.DEV_AUTH_EMAIL || "dev@example.test");
const devDisplayName = String(process.env.DEV_AUTH_DISPLAY_NAME || "Local Developer").trim() || "Local Developer";
const workspaceName = String(process.env.DEV_WORKSPACE_NAME || "Home Ledger Dev Workspace").trim() || "Home Ledger Dev Workspace";

if (!devEmail) {
  throw new Error("DEV_AUTH_EMAIL must be a valid email when provided.");
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("BEGIN");

  const user = await upsertDevUser(client, {
    email: devEmail,
    displayName: devDisplayName
  });
  const workspace = await findOrCreateDevWorkspace(client, {
    ownerUserId: user.id,
    name: workspaceName
  });
  const membership = await upsertOwnerMembership(client, {
    workspaceId: workspace.id,
    userId: user.id
  });

  await client.query("COMMIT");

  console.log("Local SaaS dev bootstrap complete.");
  console.log(`User: ${user.email}`);
  console.log(`Workspace: ${workspace.name} (${workspace.id})`);
  console.log(`Membership: ${membership.role}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

async function upsertDevUser(client, { email, displayName }) {
  const result = await client.query(
    `
      INSERT INTO users (email, display_name, status)
      VALUES ($1, $2, 'active')
      ON CONFLICT (lower(email)) WHERE deleted_at IS NULL
      DO UPDATE SET
        display_name = COALESCE(users.display_name, EXCLUDED.display_name),
        status = 'active',
        updated_at = now()
      RETURNING id, email, display_name
    `,
    [email, displayName]
  );

  return result.rows[0];
}

async function findOrCreateDevWorkspace(client, { ownerUserId, name }) {
  const existing = await client.query(
    `
      SELECT id, name
      FROM workspaces
      WHERE owner_user_id = $1
        AND status = 'active'
        AND deleted_at IS NULL
        AND settings ->> 'dev_bootstrap' = 'true'
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [ownerUserId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const created = await client.query(
    `
      INSERT INTO workspaces (name, owner_user_id, status, settings)
      VALUES ($1, $2, 'active', $3::jsonb)
      RETURNING id, name
    `,
    [name, ownerUserId, JSON.stringify({ dev_bootstrap: true })]
  );

  return created.rows[0];
}

async function upsertOwnerMembership(client, { workspaceId, userId }) {
  const result = await client.query(
    `
      INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
      VALUES ($1, $2, 'owner', 'active')
      ON CONFLICT (workspace_id, user_id) WHERE removed_at IS NULL
      DO UPDATE SET
        role = 'owner',
        status = 'active',
        updated_at = now()
      RETURNING id, role
    `,
    [workspaceId, userId]
  );

  return result.rows[0];
}
