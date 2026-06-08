import { useEffect, useState } from "react";
import {
  type InitialDashboardState,
  createHomeLedgerApiClient,
  loadInitialDashboard
} from "./api/client";
import { AppShell } from "./components/AppShell";
import type { AppView } from "./components/AppShell";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { DashboardPage } from "./dashboard/DashboardPage";
import { DocumentsPage } from "./documents/DocumentsPage";
import { ExpensesPage } from "./expenses/ExpensesPage";
import { ExportsPage } from "./exports/ExportsPage";
import { PropertiesPage } from "./properties/PropertiesPage";
import { ProjectsPage } from "./projects/ProjectsPage";

type AppState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | InitialDashboardState;

const client = createHomeLedgerApiClient();

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
        const status = typeof error === "object" && error && "status" in error ? error.status : null;
        if (!cancelled) {
          setState({
            status: "error",
            message: status === 401
              ? "Sign in to view your home records."
              : "The dashboard could not be loaded."
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
    </AppShell>
  );
}
