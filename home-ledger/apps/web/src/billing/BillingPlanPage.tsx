import type { DashboardResponse } from "../api/types";
import type { AppView } from "../components/AppShell";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";

export function BillingPlanPage({
  dashboard,
  onNavigate,
  workspaceName
}: {
  dashboard: DashboardResponse;
  onNavigate: (view: AppView) => void;
  workspaceName: string;
}) {
  return (
    <BillingPlanView
      dashboard={dashboard}
      onNavigate={onNavigate}
      workspaceName={workspaceName}
    />
  );
}

export function BillingPlanView({
  dashboard,
  onNavigate,
  workspaceName
}: {
  dashboard: DashboardResponse;
  onNavigate: (view: AppView) => void;
  workspaceName: string;
}) {
  const usageRows = toUsageRows(dashboard);

  return (
    <div className="page-stack">
      <PageTitle
        meta={`${workspaceName} · Not connected yet`}
        title="Billing and plan"
      />

      <div className="settings-grid billing-grid">
        <WorkspacePanel className="settings-section settings-section-wide">
          <PanelHeader icon="$" title="Current plan" />
          <div className="settings-note">
            <strong>Plan details are not connected yet</strong>
            <p>This screen is a placeholder for future billing and plan controls. It does not collect payment or change workspace access.</p>
          </div>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section">
          <PanelHeader icon="▤" title="Usage snapshot" />
          <dl className="settings-meta-grid billing-usage-grid">
            {usageRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section">
          <PanelHeader icon="◎" title="Future plan controls" />
          <div className="billing-control-grid" aria-disabled="true">
            <button className="button button-primary" disabled type="button">Manage plan</button>
            <button className="button button-secondary" disabled type="button">Update payment</button>
            <button className="button button-secondary" disabled type="button">View invoices</button>
            <button className="button button-secondary" disabled type="button">Change plan</button>
          </div>
          <p className="muted-copy">These controls are not connected yet.</p>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section">
          <PanelHeader icon="!" title="Entitlement explanation" />
          <p className="muted-copy">
            Future plans may affect workspace limits, document file features, OCR/text extraction, or export capacity. Existing screens are not blocked by this placeholder.
          </p>
        </WorkspacePanel>

        <WorkspacePanel className="settings-section settings-section-wide">
          <PanelHeader icon="✓" title="Account/data safety note" />
          <p className="muted-copy">Billing controls are separate from record organization, document files, and exports.</p>
          <div className="settings-action-list">
            <div>
              <strong>Data controls</strong>
              <p>Use Export for supported downloads, or review migration preparation before import is connected.</p>
            </div>
            <div className="row-actions">
              <button className="button button-secondary" onClick={() => onNavigate("exports")} type="button">
                Open export
              </button>
              <button className="button button-secondary" onClick={() => onNavigate("import")} type="button">
                Open import
              </button>
            </div>
          </div>
        </WorkspacePanel>
      </div>
    </div>
  );
}

function toUsageRows(dashboard: DashboardResponse) {
  return [
    { label: "Properties", value: String(dashboard.properties?.count ?? 0) },
    { label: "Documents", value: String(dashboard.documents?.count ?? 0) },
    { label: "Files attached", value: String(dashboard.documents?.with_file_count ?? 0) },
    { label: "OCR/text available", value: String(dashboard.documents?.ocr_text_available_count ?? 0) },
    { label: "Exports", value: "Supported downloads available" }
  ];
}
