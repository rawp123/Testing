const CLASSIFICATION_LABELS = Object.freeze({
  possible_improvement: "Possible improvements",
  repair_upkeep: "Repair / upkeep",
  review_later: "Not sure, review later"
});

const ACTIVITY_LABELS = Object.freeze({
  property: "Property",
  project: "Project",
  expense: "Expense",
  document: "Document"
});

const NAV_ITEMS = Object.freeze([
  { id: "dashboard", label: "Dashboard", current: true },
  { id: "properties", label: "Properties" },
  { id: "projects", label: "Projects" },
  { id: "expenses", label: "Expenses" },
  { id: "documents", label: "Documents" },
  { id: "exports", label: "Exports" },
  { id: "settings", label: "Settings" }
]);

export function createDashboardViewModel({ session, workspace, dashboard }) {
  const safeDashboard = dashboard || {};
  const expenses = safeDashboard.expenses || {};
  const properties = safeDashboard.properties || {};
  const projects = safeDashboard.projects || {};
  const documents = safeDashboard.documents || {};
  const vendors = safeDashboard.vendors || {};
  const followUps = asArray(safeDashboard.follow_ups);
  const recentActivity = asArray(safeDashboard.recent_activity);

  return {
    userName: session?.user?.displayName || session?.user?.email || "Signed-in user",
    workspaceName: workspace?.workspaceName || "Workspace",
    workspaceRole: workspace?.role || "",
    generatedAt: safeDashboard.generated_at || "",
    metrics: [
      metric("Properties", properties.active_count ?? properties.count ?? 0, "Active records"),
      metric("Projects", projects.active_count ?? projects.count ?? 0, `${toInteger(projects.open_follow_up_count)} open items`),
      metric("Expenses", expenses.count ?? 0, formatCents(expenses.total_amount_cents)),
      metric("Documents", documents.count ?? 0, `${toInteger(documents.with_file_count)} with files`),
      metric("Vendors", vendors.count ?? 0, "Active vendors")
    ],
    expenseBreakdown: [
      {
        label: CLASSIFICATION_LABELS.possible_improvement,
        amount: formatCents(expenses.possible_improvement_total_cents),
        count: countForClassification(expenses.by_classification, "possible_improvement")
      },
      {
        label: CLASSIFICATION_LABELS.repair_upkeep,
        amount: formatCents(expenses.repair_upkeep_total_cents),
        count: countForClassification(expenses.by_classification, "repair_upkeep")
      },
      {
        label: CLASSIFICATION_LABELS.review_later,
        amount: formatCents(amountForClassification(expenses.by_classification, "review_later")),
        count: toInteger(expenses.review_later_count)
      }
    ],
    documentSummary: [
      metric("Files attached", documents.with_file_count ?? 0, "Available files"),
      metric("Missing files", documents.missing_file_count ?? 0, "Needs attention"),
      metric("OCR available", documents.ocr_text_available_count ?? 0, "Text ready"),
      metric("OCR pending", documents.ocr_pending_count ?? 0, "In progress")
    ],
    recentActivity: recentActivity.map(toActivityRow),
    followUps: followUps.map((item) => ({
      type: String(item.type || ""),
      label: String(item.label || "Needs attention"),
      count: toInteger(item.count)
    })),
    empty: isEmptyDashboard(safeDashboard)
  };
}

export function renderDashboardShell(state) {
  if (state?.status === "loading") {
    return renderPage("Loading Home Ledger", renderStatusPanel("Loading dashboard", "Fetching your workspace summary."));
  }

  if (state?.status === "empty_workspace") {
    return renderPage("Home Ledger", renderStatusPanel("Create a workspace", "Create a workspace to start organizing home records."));
  }

  if (state?.status === "error") {
    return renderPage("Home Ledger", renderStatusPanel("Dashboard unavailable", state.message || "Try again in a moment.", "error"));
  }

  const viewModel = createDashboardViewModel(state || {});
  return renderPage("Home Ledger", `
    <header class="page-header">
      <div>
        <span class="eyebrow">${escapeHtml(viewModel.workspaceName)}</span>
        <h1>Your home records</h1>
        <p>${escapeHtml(viewModel.userName)}${viewModel.workspaceRole ? ` · ${escapeHtml(viewModel.workspaceRole)}` : ""}</p>
      </div>
    </header>
    ${viewModel.empty ? renderStatusPanel("Add a property", "Add a property to start organizing home records.") : ""}
    ${renderMetricGrid(viewModel.metrics)}
    <section class="panel dashboard-panel">
      <div class="sub-tabs" role="tablist" aria-label="Dashboard views">
        <button class="is-active" type="button">Recent activity <span>${viewModel.recentActivity.length}</span></button>
        <button type="button">Needs attention <span>${totalFollowUps(viewModel.followUps)}</span></button>
      </div>
      ${renderRecentActivity(viewModel.recentActivity)}
    </section>
    <section class="dashboard-secondary-grid">
      ${renderExpenseBreakdown(viewModel.expenseBreakdown)}
      ${renderNeedsAttention(viewModel.followUps)}
      ${renderDocumentSummary(viewModel.documentSummary)}
    </section>
  `);
}

export function formatCents(value) {
  const cents = toInteger(value);
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = String(absolute % 100).padStart(2, "0");
  return `${sign}$${dollars.toLocaleString("en-US")}.${remainder}`;
}

function renderPage(title, body) {
  return `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <strong>${escapeHtml(title)}</strong>
        <nav>
          ${NAV_ITEMS.map((item) => `<a href="#${escapeAttr(item.id)}" ${item.current ? "aria-current=\"page\"" : "aria-disabled=\"true\""}>${escapeHtml(item.label)}</a>`).join("")}
        </nav>
      </aside>
      <main class="main-content">
        ${body}
      </main>
    </div>
  `;
}

function renderStatusPanel(title, copy, tone = "") {
  return `
    <section class="panel status-panel ${escapeAttr(tone)}">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(copy)}</p>
    </section>
  `;
}

function renderMetricGrid(metrics) {
  return `
    <section class="metric-grid" aria-label="Workspace summary">
      ${metrics.map((item) => `
        <div class="metric">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(String(item.value))}</strong>
          <em>${escapeHtml(item.detail)}</em>
        </div>
      `).join("")}
    </section>
  `;
}

function renderRecentActivity(items) {
  if (!items.length) {
    return renderEmpty("No recent activity", "New projects, expenses, and documents will appear here.");
  }

  return `
    <div class="table-wrap">
      <table class="compact-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Record</th>
            <th>Related to</th>
            <th>Date</th>
            <th>Summary</th>
            <th class="align-right">Open</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td data-label="Type"><span class="pill">${escapeHtml(item.typeLabel)}</span></td>
              <td data-label="Record"><strong>${escapeHtml(item.name)}</strong></td>
              <td data-label="Related to">${escapeHtml(item.relatedTo || "Not linked")}</td>
              <td data-label="Date">${escapeHtml(formatDate(item.occurredAt))}</td>
              <td data-label="Summary">${escapeHtml(item.summary)}</td>
              <td class="align-right" data-label="Open"><button type="button" data-record-type="${escapeAttr(item.recordType)}" data-record-id="${escapeAttr(item.recordId)}">Open</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderExpenseBreakdown(items) {
  return `
    <section class="panel">
      <h2>Expense summary</h2>
      <div class="summary-list">
        ${items.map((item) => `
          <div>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.amount)}</strong>
            <em>${escapeHtml(`${item.count} records`)}</em>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderNeedsAttention(items) {
  return `
    <section class="panel">
      <h2>Needs attention</h2>
      ${items.length ? `
        <div class="summary-list">
          ${items.map((item) => `
            <div>
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(String(item.count))}</strong>
              <em>Open items</em>
            </div>
          `).join("")}
        </div>
      ` : renderEmpty("No open items", "No open items.")}
    </section>
  `;
}

function renderDocumentSummary(items) {
  return `
    <section class="panel">
      <h2>Document summary</h2>
      <div class="summary-list">
        ${items.map((item) => `
          <div>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(String(item.value))}</strong>
            <em>${escapeHtml(item.detail)}</em>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderEmpty(title, copy) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(copy)}</p>
    </div>
  `;
}

function toActivityRow(item) {
  return {
    typeLabel: ACTIVITY_LABELS[item.activity_type] || titleCase(item.activity_type || "activity"),
    recordType: String(item.record_type || item.activity_type || ""),
    recordId: String(item.record_id || ""),
    name: String(item.record_name || item.summary || "Untitled record"),
    relatedTo: [item.property_name, item.project_name].filter(Boolean).join(" · "),
    occurredAt: item.occurred_at || "",
    summary: activitySummary(item)
  };
}

function activitySummary(item) {
  if (item.activity_type === "expense" && Number.isInteger(item.amount_cents)) {
    return formatCents(item.amount_cents);
  }
  if (item.activity_type === "document") {
    return [titleCase(item.document_type || "document"), titleCase(item.file_availability || "")].filter(Boolean).join(" · ");
  }
  if (item.activity_type === "project" && item.status) {
    return titleCase(item.status);
  }
  return String(item.summary || "");
}

function metric(label, value, detail) {
  return {
    label,
    value: Number.isInteger(value) ? value : toInteger(value),
    detail
  };
}

function isEmptyDashboard(dashboard) {
  return !toInteger(dashboard.properties?.count) &&
    !toInteger(dashboard.projects?.count) &&
    !toInteger(dashboard.expenses?.count) &&
    !toInteger(dashboard.documents?.count);
}

function countForClassification(items, classification) {
  return toInteger(asArray(items).find((item) => item.record_treatment === classification)?.count);
}

function amountForClassification(items, classification) {
  return toInteger(asArray(items).find((item) => item.record_treatment === classification)?.total_amount_cents);
}

function totalFollowUps(items) {
  return asArray(items).reduce((total, item) => total + toInteger(item.count), 0);
}

function toInteger(value) {
  if (Number.isInteger(value)) return value;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDate(value) {
  const text = String(value || "");
  if (!text) return "No date";
  const dateOnly = text.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");
  if (!year || !month || !day) return text;
  return `${month}/${day}/${year}`;
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
