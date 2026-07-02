import type { SessionResponse, WorkspaceMembership } from "../api/types";
import {
  formatWorkspaceRole,
  productionAuthStatus,
  sessionModeLabel,
  workspaceAccessLabel
} from "../auth/session-model";
import type { AppView } from "../components/AppShell";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";

export function SettingsPage({
  onNavigate,
  session,
  workspace
}: {
  onNavigate: (view: AppView) => void;
  session: SessionResponse;
  workspace: WorkspaceMembership;
}) {
  return (
    <SettingsView
      onNavigate={onNavigate}
      session={session}
      workspace={workspace}
    />
  );
}

export function SettingsView({
  onNavigate,
  session,
  workspace
}: {
  onNavigate: (view: AppView) => void;
  session: SessionResponse;
  workspace: WorkspaceMembership;
}) {
  const membership = session.memberships.find((item) => item.workspaceId === workspace.workspaceId) || workspace;
  const accountName = session.user.displayName?.trim() || session.user.email;

  return (
    <div className="page-stack">
      <PageTitle
        meta={`${workspace.workspaceName} · ${formatWorkspaceRole(membership.role)}`}
        title="Settings"
      />

      <div className="settings-grid">
        <WorkspacePanel className="settings-section">
          <PanelHeader icon="⌂" title="Workspace" />
          <p className="muted-copy">Records are grouped by workspace so properties, projects, expenses, documents, and follow-ups stay together.</p>
          <dl className="settings-meta-grid">
            <div>
              <dt>Workspace</dt>
              <dd>{workspace.workspaceName}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{formatWorkspaceRole(membership.role)}</dd>
            </div>
            <div>
              <dt>Workspace ID</dt>
              <dd>{workspace.workspaceId}</dd>
            </div>
          </dl>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section">
          <PanelHeader icon="◎" title="Account" />
          <p className="muted-copy">Account details come from the current signed-in session.</p>
          <dl className="settings-meta-grid">
            <div>
              <dt>Name</dt>
              <dd>{accountName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{session.user.email}</dd>
            </div>
            <div>
              <dt>Sign-in</dt>
              <dd>{sessionModeLabel(session)}</dd>
            </div>
          </dl>
          <div className="settings-note">
            <strong>Auth status</strong>
            <p>{productionAuthStatus(session)}</p>
            <p>{workspaceAccessLabel(membership)}</p>
          </div>
          <div className="settings-action-list">
            <div>
              <strong>Billing and plan</strong>
              <p>Review the future plan surface and current usage snapshot.</p>
            </div>
            <button className="button button-secondary" onClick={() => onNavigate("billing")} type="button">
              Open billing
            </button>
          </div>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section">
          <PanelHeader icon="↓" title="Data controls" />
          <div className="settings-action-list">
            <div>
              <strong>Export records</strong>
              <p>Download the workspace exports currently supported by the API.</p>
            </div>
            <button className="button button-primary" onClick={() => onNavigate("exports")} type="button">
              Open export
            </button>
          </div>
          <div className="settings-note">
            <strong>Import and migration</strong>
            <p>Backup import and migration review are planned, but unavailable in this beta.</p>
          </div>
          <div className="settings-action-list">
            <div>
              <strong>Prepare migration</strong>
              <p>Review what can be prepared before automated import is connected.</p>
            </div>
            <button className="button button-secondary" onClick={() => onNavigate("import")} type="button">
              Open import
            </button>
          </div>
          <div className="settings-note">
            <strong>Deletion controls</strong>
            <p>Workspace deletion and account deletion controls are unavailable in this beta.</p>
          </div>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section">
          <PanelHeader icon="◇" title="Documents and files" />
          <p className="muted-copy">Document records can show whether a file is attached, missing, or needs review. Extracted text only opens from the document text action when it is available.</p>
          <div className="settings-action-list">
            <div>
              <strong>Review documents</strong>
              <p>Check file status, request text, and resolve missing-file follow-ups from Documents.</p>
            </div>
            <button className="button button-secondary" onClick={() => onNavigate("documents")} type="button">
              Open documents
            </button>
          </div>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section settings-section-wide">
          <PanelHeader icon="✓" title="Review language" />
          <p className="muted-copy">Home Ledger organizes records. It does not give tax, legal, or accounting advice.</p>
        </WorkspacePanel>
      </div>
    </div>
  );
}
