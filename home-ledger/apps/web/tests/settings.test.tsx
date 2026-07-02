import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SessionResponse, WorkspaceMembership } from "../src/api/types";
import { SettingsView } from "../src/settings/SettingsPage";

describe("Settings screen", () => {
  it("renders workspace account data controls documents and review sections", () => {
    const html = renderToStaticMarkup(
      <SettingsView
        onNavigate={() => undefined}
        session={createSession()}
        workspace={createWorkspace()}
      />
    );

    expect(html).toContain("Settings");
    expect(html).toContain("Workspace");
    expect(html).toContain("Home records");
    expect(html).toContain("Owner");
    expect(html).toContain("workspace-1");
    expect(html).toContain("Account");
    expect(html).toContain("Robert Parrish");
    expect(html).toContain("owner@example.test");
    expect(html).toContain("Development session");
    expect(html).toContain("Auth status");
    expect(html).toContain("This beta is using a development sign-in.");
    expect(html).toContain("Owner workspace access");
    expect(html).toContain("Billing and plan");
    expect(html).toContain("Open billing");
    expect(html).toContain("Data controls");
    expect(html).toContain("Open export");
    expect(html).toContain("Import and migration");
    expect(html).toContain("Prepare migration");
    expect(html).toContain("Open import");
    expect(html).toContain("unavailable in this beta");
    expect(html).toContain("Documents and files");
    expect(html).toContain("Open documents");
    expect(html).toContain("Review language");
    expect(html).toContain("Home Ledger organizes records");
  });

  it("uses existing navigation actions for billing export import and documents", () => {
    const html = renderToStaticMarkup(
      <SettingsView
        onNavigate={() => undefined}
        session={createSession()}
        workspace={createWorkspace()}
      />
    );

    expect(html).toContain("Open billing");
    expect(html).toContain("Open export");
    expect(html).toContain("Open import");
    expect(html).toContain("Open documents");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("Download package");
  });

  it("keeps product-boundary language neutral", () => {
    const html = renderToStaticMarkup(
      <SettingsView
        onNavigate={() => undefined}
        session={createSession()}
        workspace={createWorkspace()}
      />
    ).toLowerCase();

    for (const blocked of ["deductible", "irs-ready", "tax-safe", "audit-proof", "tax-optimized", "legal-ready"]) {
      expect(html).not.toContain(blocked);
    }
    for (const authOverclaim of ["production sign-in active", "password saved", "oauth connected", "sso enabled", "mfa enabled", "session encrypted"]) {
      expect(html).not.toContain(authOverclaim);
    }
    expect(html).toContain("does not give tax, legal, or accounting advice");
  });

  it("does not render storage internals local paths or raw OCR text", () => {
    const html = renderToStaticMarkup(
      <SettingsView
        onNavigate={() => undefined}
        session={createSession({
          authProvider: "provider_internal_secret",
          isDevAuth: false,
          user: {
            id: "user-1",
            email: "owner@example.test",
            displayName: "Owner"
          }
        })}
        workspace={createWorkspace()}
      />
    );

    expect(html).not.toContain("storage_key");
    expect(html).not.toContain("object key");
    expect(html).not.toContain("signed URL");
    expect(html).not.toContain("download_url");
    expect(html).not.toContain("provider_internal_secret");
    expect(html).not.toContain("/Users/");
    expect(html).not.toContain("raw OCR text");
    expect(html).not.toContain("Sensitive recognized text");
  });
});

function createSession(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    user: { id: "user-1", email: "owner@example.test", displayName: "Robert Parrish" },
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
