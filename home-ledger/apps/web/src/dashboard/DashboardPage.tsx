import { useState } from "react";
import type { InitialDashboardState } from "../api/client";
import { ActionBar } from "../components/ActionBar";
import { FilterChipGroup, FilterPanel } from "../components/FilterPanel";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";
import { DashboardSummaryCards } from "./DashboardSummaryCards";
import { NeedsAttention } from "./NeedsAttention";
import { RecentActivity } from "./RecentActivity";
import { createDashboardViewModel } from "./dashboard-model";

export function DashboardPage({ state }: { state: InitialDashboardState }) {
  const [dashboardTab, setDashboardTab] = useState<"activity" | "attention">("activity");
  const [activityFilter, setActivityFilter] = useState("all");

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
  const activeActivityFilter = viewModel.activityFilterOptions.some((option) => option.value === activityFilter)
    ? activityFilter
    : "all";
  const filteredActivity = activeActivityFilter === "all"
    ? viewModel.recentActivity
    : viewModel.recentActivity.filter((item) => item.activityType === activeActivityFilter);

  return (
    <div className="page-stack">
      <PageTitle
        meta={`${viewModel.workspaceName}${viewModel.workspaceRole ? ` · ${viewModel.workspaceRole}` : ""}`}
        title="Your home records"
      />

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

      {!viewModel.empty ? (
        <ActionBar label="Quick actions">
          <button className="button button-primary" type="button"><span aria-hidden="true">+</span>Add expense</button>
          <button className="button button-secondary" type="button"><span aria-hidden="true">+</span>Add document</button>
          <button className="button button-secondary" type="button"><span aria-hidden="true">+</span>Add project</button>
          <button className="button button-secondary" type="button">Export report</button>
        </ActionBar>
      ) : null}

      <WorkspacePanel className="dashboard-workspace-panel">
        <div className="sub-tabs dashboard-sub-tabs" role="tablist" aria-label="Dashboard views">
          <button
            aria-controls="dashboard-activity-panel"
            aria-selected={dashboardTab === "activity"}
            className={dashboardTab === "activity" ? "is-active" : ""}
            id="dashboard-activity-tab"
            onClick={() => setDashboardTab("activity")}
            role="tab"
            type="button"
          >
            Recent activity <span>{viewModel.recentActivity.length}</span>
          </button>
          <button
            aria-controls="dashboard-attention-panel"
            aria-selected={dashboardTab === "attention"}
            className={dashboardTab === "attention" ? "is-active" : ""}
            id="dashboard-attention-tab"
            onClick={() => setDashboardTab("attention")}
            role="tab"
            type="button"
          >
            Needs attention <span>{viewModel.openFollowUpCount}</span>
          </button>
        </div>
        {dashboardTab === "activity" ? (
          <div
            aria-labelledby="dashboard-activity-tab"
            className="dashboard-tab-panel"
            id="dashboard-activity-panel"
            role="tabpanel"
          >
            <PanelHeader icon="▦" title="Recent activity" />
            <FilterPanel className="dashboard-activity-filters" onClear={() => setActivityFilter("all")}>
              <FilterChipGroup
                label="Activity type"
                onChange={setActivityFilter}
                options={[
                  { value: "all", label: "All activity", count: viewModel.recentActivity.length },
                  ...viewModel.activityFilterOptions
                ]}
                value={activeActivityFilter}
              />
            </FilterPanel>
            <RecentActivity filtered={activeActivityFilter !== "all"} items={filteredActivity} />
          </div>
        ) : (
          <div
            aria-labelledby="dashboard-attention-tab"
            className="dashboard-tab-panel"
            id="dashboard-attention-panel"
            role="tabpanel"
          >
            <PanelHeader icon="!" title="Needs attention" />
            <NeedsAttention items={viewModel.followUpItems} />
          </div>
        )}
      </WorkspacePanel>
    </div>
  );
}
