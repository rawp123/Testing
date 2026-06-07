import { apiError } from "./errors.js";
import { loadWorkspaceMembership as loadMembershipFromDb } from "./workspaces.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireAuth(request) {
  if (!request.auth) {
    throw apiError(401, "unauthenticated", "Sign in required.");
  }
  return request.auth;
}

export async function loadWorkspaceMembership({ db, userId, workspaceId }) {
  validateWorkspaceId(workspaceId);
  return loadMembershipFromDb({ db, userId, workspaceId });
}

export async function requireWorkspaceMembership({ request, db, workspaceId }) {
  const auth = requireAuth(request);
  const membership = await loadWorkspaceMembership({
    db,
    userId: auth.userId,
    workspaceId
  });

  if (!membership) {
    throw apiError(404, "not_found", "Workspace not found.");
  }

  return membership;
}

export async function requireWorkspaceRole({ request, db, workspaceId, allowedRoles }) {
  const membership = await requireWorkspaceMembership({ request, db, workspaceId });
  const roles = new Set(allowedRoles);
  if (!roles.has(membership.role)) {
    throw apiError(403, "forbidden", "You do not have permission to do that.");
  }
  return membership;
}

export async function requireWorkspaceOwner({ request, db, workspaceId }) {
  return requireWorkspaceRole({
    request,
    db,
    workspaceId,
    allowedRoles: ["owner"]
  });
}

export function canReadWorkspace(role) {
  return role === "owner" || role === "editor" || role === "viewer";
}

export function canWriteWorkspace(role) {
  return role === "owner" || role === "editor";
}

export function canManageWorkspace(role) {
  return role === "owner";
}

export function validateWorkspaceId(workspaceId) {
  if (!UUID_PATTERN.test(String(workspaceId || ""))) {
    throw apiError(400, "invalid_request", "Invalid workspace id.");
  }
  return workspaceId;
}
