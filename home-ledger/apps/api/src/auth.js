import { normalizeEmail } from "./config.js";
import { listActiveMembershipsForUser } from "./workspaces.js";

export const TEST_AUTH_EMAIL_HEADER = "x-home-ledger-test-auth-email";
export const TEST_AUTH_DISPLAY_NAME_HEADER = "x-home-ledger-test-auth-display-name";

// Production auth will plug in ahead of the same membership lookup used here:
// verify the provider session server-side, map the external subject to an
// internal user, then resolve workspace roles from workspace_memberships.
// Request headers may select only test identity in APP_ENV=test; they must not
// supply roles, workspace ids, user ids, or entitlements.
export async function resolveAuthenticatedRequest({ request, config, db }) {
  if (config.authProvider !== "dev" || !config.devAuthEnabled) {
    return null;
  }

  const identity = resolveDevIdentity({ request, config });
  if (!identity.email) {
    return null;
  }

  const user = await findOrCreateDevUser({ db, identity });
  if (!user || user.status !== "active") {
    return null;
  }

  const memberships = await listActiveMembershipsForUser({ db, userId: user.id });

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    authProvider: config.authProvider,
    memberships,
    isDevAuth: true
  };
}

export function serializeSession(auth) {
  return {
    data: {
      user: {
        id: auth.userId,
        email: auth.email,
        displayName: auth.displayName
      },
      authProvider: auth.authProvider,
      isDevAuth: auth.isDevAuth,
      memberships: auth.memberships.map((membership) => ({
        id: membership.id,
        workspaceId: membership.workspaceId,
        workspaceName: membership.workspaceName,
        role: membership.role
      }))
    }
  };
}

function resolveDevIdentity({ request, config }) {
  if (config.appEnv !== "test") {
    return {
      email: config.devAuthEmail,
      displayName: config.devAuthDisplayName
    };
  }

  const requestedEmail = normalizeEmail(readHeader(request, TEST_AUTH_EMAIL_HEADER));
  const requestedDisplayName = readHeader(request, TEST_AUTH_DISPLAY_NAME_HEADER);
  return {
    email: requestedEmail || config.devAuthEmail,
    displayName: requestedDisplayName || config.devAuthDisplayName
  };
}

async function findOrCreateDevUser({ db, identity }) {
  const result = await db.query(
    `
      INSERT INTO users (email, display_name, status)
      VALUES ($1, $2, 'active')
      ON CONFLICT (lower(email)) WHERE deleted_at IS NULL
      DO UPDATE SET
        display_name = COALESCE(users.display_name, EXCLUDED.display_name),
        updated_at = now()
      RETURNING id, email, display_name, status
    `,
    [identity.email, identity.displayName]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status
  };
}

function readHeader(request, headerName) {
  const value = request.headers[headerName];
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}
