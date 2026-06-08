import { useEffect, useState } from "react";
import {
  type InitialDashboardState,
  createHomeLedgerApiClient,
  loadInitialDashboard
} from "./api/client";
import { authBoundaryMessage } from "./auth/session-model";
import { AppShell } from "./components/AppShell";
import type { AppView } from "./components/AppShell";
import { BillingPlanPage } from "./billing/BillingPlanPage";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { DashboardPage } from "./dashboard/DashboardPage";
import { DocumentsPage } from "./documents/DocumentsPage";
import { ExpensesPage } from "./expenses/ExpensesPage";
import { ExportsPage } from "./exports/ExportsPage";
import { FollowUpsPage } from "./follow-ups/FollowUpsPage";
import { ImportMigrationPage } from "./import/ImportMigrationPage";
import { PropertiesPage } from "./properties/PropertiesPage";
import { ProjectsPage } from "./projects/ProjectsPage";
import { SettingsPage } from "./settings/SettingsPage";
import { VendorsPage } from "./vendors/VendorsPage";

type AppState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | InitialDashboardState;

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const client = createHomeLedgerApiClient({
  baseUrl: viteEnv?.VITE_API_BASE_URL
});

export function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });
  const [activeView, setActiveView] = useState<AppView>("dashboard");

  useEffect(() => {
    let cancelled = false;
    loadInitialDashboard({ client })
      .then((nextState) => {
        if (!cancelled) setState(nextState);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: authBoundaryMessage(error, "The dashboard could not be loaded.")
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell activeView={activeView} onNavigate={setActiveView}>
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "empty_workspace" ? <DashboardPage state={state} /> : null}
      {state.status === "ready" && activeView === "dashboard" ? <DashboardPage state={state} /> : null}
      {state.status === "ready" && activeView === "follow-ups" ? (
        <FollowUpsPage
          client={client}
          workspaceId={state.workspace.workspaceId}
          workspaceName={state.workspace.workspaceName}
        />
      ) : null}
      {state.status === "ready" && activeView === "properties" ? (
        <PropertiesPage
          client={client}
          workspaceId={state.workspace.workspaceId}
          workspaceName={state.workspace.workspaceName}
        />
      ) : null}
      {state.status === "ready" && activeView === "projects" ? (
        <ProjectsPage
          client={client}
          workspaceId={state.workspace.workspaceId}
          workspaceName={state.workspace.workspaceName}
        />
      ) : null}
      {state.status === "ready" && activeView === "vendors" ? (
        <VendorsPage
          client={client}
          workspaceId={state.workspace.workspaceId}
          workspaceName={state.workspace.workspaceName}
        />
      ) : null}
      {state.status === "ready" && activeView === "expenses" ? (
        <ExpensesPage
          client={client}
          workspaceId={state.workspace.workspaceId}
          workspaceName={state.workspace.workspaceName}
        />
      ) : null}
      {state.status === "ready" && activeView === "documents" ? (
        <DocumentsPage
          client={client}
          workspaceId={state.workspace.workspaceId}
          workspaceName={state.workspace.workspaceName}
        />
      ) : null}
      {state.status === "ready" && activeView === "exports" ? (
        <ExportsPage
          client={client}
          workspaceId={state.workspace.workspaceId}
          workspaceName={state.workspace.workspaceName}
        />
      ) : null}
      {state.status === "ready" && activeView === "settings" ? (
        <SettingsPage
          onNavigate={setActiveView}
          session={state.session}
          workspace={state.workspace}
        />
      ) : null}
      {state.status === "ready" && activeView === "import" ? (
        <ImportMigrationPage
          onNavigate={setActiveView}
          workspaceName={state.workspace.workspaceName}
        />
      ) : null}
      {state.status === "ready" && activeView === "billing" ? (
        <BillingPlanPage
          dashboard={state.dashboard}
          onNavigate={setActiveView}
          workspaceName={state.workspace.workspaceName}
        />
      ) : null}
    </AppShell>
  );
}
