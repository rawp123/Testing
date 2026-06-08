import { HomeLedgerApiError } from "../api/client";
import type { SessionResponse, WorkspaceMembership } from "../api/types";

export function formatWorkspaceRole(role: string) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "owner") return "Owner";
  if (normalized === "editor") return "Editor";
  if (normalized === "viewer") return "Viewer";
  return role || "Member";
}

export function sessionModeLabel(session: SessionResponse) {
  if (isDevelopmentSession(session)) return "Development session";
  if (session.authProvider) return "External sign-in session";
  return "Sign-in provider not connected";
}

export function productionAuthStatus(session: SessionResponse) {
  if (isDevelopmentSession(session)) return "Production sign-in is not connected in this build.";
  if (session.authProvider) return "Sign-in details are controlled by deployment.";
  return "Sign-in provider is not connected in this build.";
}

export function workspaceAccessLabel(workspace: WorkspaceMembership) {
  return `${formatWorkspaceRole(workspace.role)} workspace access`;
}

export function authBoundaryMessage(error: unknown, fallback = "The request could not be completed.") {
  const status = error instanceof HomeLedgerApiError
    ? error.status
    : typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : 0;

  if (status === 401) return "Sign in to view your home records.";
  if (status === 403) return "This action requires a different workspace role.";
  if (status === 404) return "You do not have access to this workspace.";
  return fallback;
}

function isDevelopmentSession(session: SessionResponse) {
  return Boolean(session.isDevAuth) || String(session.authProvider || "").toLowerCase() === "dev";
}
