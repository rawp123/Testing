import type { InitialDashboardState } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { DashboardSummaryCards } from "./DashboardSummaryCards";
import { NeedsAttention } from "./NeedsAttention";
import { RecentActivity } from "./RecentActivity";
import { createDashboardViewModel } from "./dashboard-model";

export function DashboardPage({ state }: { state: InitialDashboardState }) {
  if (state.status === "empty_workspace") {
    return (
      <section className="panel status-panel">
        <p className="eyebrow">Workspace</p>
        <h1>Create a workspace</h1>
        <p>Create a workspace to start organizing home records.</p>
      </section>
    );
  }

  const viewModel = createDashboardViewModel(state);

  return (
    <div className="page-stack">
      <header className="page-intro">
        <div>
          <p className="eyebrow">{viewModel.workspaceName}</p>
          <h1>Your home records</h1>
          <p>{viewModel.userName}{viewModel.workspaceRole ? ` · ${viewModel.workspaceRole}` : ""}</p>
        </div>
      </header>

      {viewModel.empty ? (
        <section className="onboarding-panel">
          <h2>Add a property to start your real home file.</h2>
          <p>A property is the first thing to add. Projects, expenses, and documents attach to it later.</p>
          <div className="step-list" aria-label="Suggested setup steps">
            <span>Add your property</span>
            <span>Create projects</span>
            <span>Attach receipts or permits and export a review packet</span>
          </div>
        </section>
      ) : null}

      <DashboardSummaryCards metrics={viewModel.metrics} />

      <section className="panel dashboard-workspace-panel">
        <div className="sub-tabs dashboard-sub-tabs" role="tablist" aria-label="Dashboard views">
          <button aria-selected="true" className="is-active" role="tab" type="button">
            Recent activity <span>{viewModel.recentActivity.length}</span>
          </button>
          <button aria-selected="false" role="tab" type="button">
            Needs attention <span>{viewModel.openFollowUpCount}</span>
          </button>
        </div>
        <div className="dashboard-tab-panel" role="tabpanel">
          <div className="panel-header">
            <span className="panel-icon" aria-hidden="true">▦</span>
            <h2>Recent activity</h2>
          </div>
          <RecentActivity items={viewModel.recentActivity} />
        </div>
      </section>

      <section className="dashboard-secondary-grid">
        <section className="panel">
          <h2>Expense summary</h2>
          <div className="summary-list">
            {viewModel.expenseBreakdown.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.amount}</strong>
                <em>{item.count} records</em>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Needs attention</h2>
          <NeedsAttention items={viewModel.followUps} />
        </section>

        <section className="panel">
          <h2>Document summary</h2>
          {viewModel.documentSummary.length ? (
            <div className="summary-list">
              {viewModel.documentSummary.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <em>{item.detail}</em>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No documents">Add a document.</EmptyState>
          )}
        </section>
      </section>
    </div>
  );
}
