import { createHomeLedgerApiClient, loadInitialDashboard } from "./api-client.js";
import { renderDashboardShell } from "./dashboard.js";

const app = document.querySelector("#app");
const client = createHomeLedgerApiClient();

render({ status: "loading" });
boot();

async function boot() {
  try {
    const state = await loadInitialDashboard({ client });
    render(state);
  } catch (error) {
    render({
      status: "error",
      message: error?.status === 401
        ? "Sign in to view your home records."
        : "The dashboard could not be loaded."
    });
  }
}

function render(state) {
  app.innerHTML = renderDashboardShell(state);
}
