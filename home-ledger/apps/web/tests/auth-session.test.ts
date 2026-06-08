import { describe, expect, it } from "vitest";
import { HomeLedgerApiError } from "../src/api/client";
import type { SessionResponse, WorkspaceMembership } from "../src/api/types";
import {
  authBoundaryMessage,
  formatWorkspaceRole,
  productionAuthStatus,
  sessionModeLabel,
  workspaceAccessLabel
} from "../src/auth/session-model";

describe("auth and session model", () => {
  it("labels development session state without overclaiming production auth", () => {
    const session = createSession({ authProvider: "dev", isDevAuth: true });
    const workspace = createWorkspace({ role: "owner" });

    expect(sessionModeLabel(session)).toBe("Development session");
    expect(productionAuthStatus(session)).toBe("Production sign-in is not connected in this build.");
    expect(formatWorkspaceRole("owner")).toBe("Owner");
    expect(workspaceAccessLabel(workspace)).toBe("Owner workspace access");
  });

  it("avoids rendering provider internals in sign-in labels", () => {
    const session = createSession({
      authProvider: "provider_internal_secret",
      isDevAuth: false
    });

    expect(sessionModeLabel(session)).toBe("External sign-in session");
    expect(productionAuthStatus(session)).toBe("Sign-in details are controlled by deployment.");
    expect(sessionModeLabel(session)).not.toContain("provider_internal_secret");
    expect(productionAuthStatus(session)).not.toContain("provider_internal_secret");
  });

  it("maps auth boundary errors to safe user-facing messages", () => {
    expect(authBoundaryMessage(new HomeLedgerApiError({ status: 401 }))).toBe("Sign in to view your home records.");
    expect(authBoundaryMessage(new HomeLedgerApiError({ status: 403 }))).toBe("This action requires a different workspace role.");
    expect(authBoundaryMessage(new HomeLedgerApiError({ status: 404 }))).toBe("You do not have access to this workspace.");
    expect(authBoundaryMessage({ status: 403 })).toBe("This action requires a different workspace role.");
    expect(authBoundaryMessage(new Error("raw provider failure"), "Try again later.")).toBe("Try again later.");
  });
});

function createSession(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    user: { id: "user-1", email: "owner@example.test", displayName: "Owner" },
    authProvider: "dev",
    isDevAuth: true,
    memberships: [createWorkspace()],
    ...overrides
  };
}

function createWorkspace(overrides: Partial<WorkspaceMembership> = {}): WorkspaceMembership {
  return {
    id: "membership-1",
    workspaceId: "workspace-1",
    workspaceName: "Home records",
    role: "owner",
    ...overrides
  };
}
