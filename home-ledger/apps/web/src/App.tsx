import { useEffect, useState } from "react";
import {
  type InitialDashboardState,
  createHomeLedgerApiClient,
  loadInitialDashboard
} from "./api/client";
import { AppShell } from "./components/AppShell";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { DashboardPage } from "./dashboard/DashboardPage";

type AppState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | InitialDashboardState;

const client = createHomeLedgerApiClient();

export function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });

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
    <AppShell>
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "ready" || state.status === "empty_workspace" ? <DashboardPage state={state} /> : null}
    </AppShell>
  );
}
