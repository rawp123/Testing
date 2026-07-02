import type { AppView } from "../components/AppShell";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";

export function ImportMigrationPage({
  onNavigate,
  workspaceName
}: {
  onNavigate: (view: AppView) => void;
  workspaceName: string;
}) {
  return (
    <ImportMigrationView
      onNavigate={onNavigate}
      workspaceName={workspaceName}
    />
  );
}

export function ImportMigrationView({
  onNavigate,
  workspaceName
}: {
  onNavigate: (view: AppView) => void;
  workspaceName: string;
}) {
  return (
    <div className="page-stack">
      <PageTitle
        meta={`${workspaceName} · Unavailable in this beta`}
        title="Import and migration"
      />

      <div className="settings-grid migration-grid">
        <WorkspacePanel className="settings-section settings-section-wide">
          <PanelHeader icon="⇄" title="Migration overview" />
          <p className="muted-copy">
            This area will help move records from the earlier local app into this workspace after import review is available.
          </p>
          <div className="settings-action-list">
            <div>
              <strong>Start with an export or backup</strong>
              <p>Keep a current backup from the local app so records and document references can be reviewed before migration.</p>
            </div>
            <button className="button button-secondary" onClick={() => onNavigate("exports")} type="button">
              Open export
            </button>
          </div>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section">
          <PanelHeader icon="▤" title="What can be prepared" />
          <ul className="migration-check-list">
            <li>Properties</li>
            <li>Projects</li>
            <li>Expenses</li>
            <li>Vendors</li>
            <li>Documents and file references</li>
            <li>Notes and review statuses where applicable</li>
          </ul>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section">
          <PanelHeader icon="!" title="Current status" />
          <div className="settings-note">
            <strong>Automated import is unavailable in this beta</strong>
            <p>The web app does not upload, parse, merge, or replace records from backup files in this release.</p>
          </div>
          <div className="settings-note">
            <strong>No workspace changes happen here</strong>
            <p>The controls below stay disabled until import review is ready.</p>
          </div>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section">
          <PanelHeader icon="✓" title="Recommended preparation" />
          <ul className="migration-check-list">
            <li>Keep a fresh backup/export from the local app.</li>
            <li>Review properties, projects, expenses, vendors, and documents before importing.</li>
            <li>Keep attached documents available separately if they may need to be uploaded again.</li>
            <li>Use follow-ups and Review later status to flag records that need another look.</li>
          </ul>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section">
          <PanelHeader icon="◇" title="Import controls" />
          <div className="migration-disabled-control" aria-disabled="true">
            <label className="field">
              <span>Backup file</span>
              <input accept="application/json,.json" disabled type="file" />
              <small>File import is unavailable in this beta.</small>
            </label>
            <button className="button button-primary" disabled type="button">
              Review import
            </button>
          </div>
        </WorkspacePanel>
      </div>
    </div>
  );
}
