import {
  buildExpensesCsv,
  CLASSIFICATIONS,
  createId,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  downloadBlob,
  downloadTextFile,
  EMPTY_DATA,
  EXPENSE_CATEGORIES,
  formatFileSize,
  formatCurrency,
  formatDate,
  buildSaleScenarioEstimate,
  getExpenseTotals,
  getExpenseVendorName,
  getPacketReadinessSummary,
  getProfessionalClassificationLabel,
  getProfessionalProjectStatusLabel,
  getProjectCompleteness,
  getProjectReviewSummaries,
  getProjectVendorName,
  getProjectName,
  getPropertyReviewSummaries,
  getPropertyName,
  getRecordFollowUps,
  getRecordFollowUpsForSurface,
  getReviewReadiness,
  getVendorName,
  isDocumentationGap,
  isValidISODate,
  optionLabel,
  parseAmount,
  MAX_BACKUP_FILE_SIZE,
  MAX_DOCUMENT_FILE_SIZE,
  PROJECT_STATUSES,
  removeLocalPaths,
  sanitizeData,
  sortByDateDesc,
  STORAGE_KEY,
  TABS,
  todayISO,
  upsertById,
  VENDOR_STATUSES,
} from "../backend/domain/model.js";
import {
  createBackupEnvelope,
  findBackupFileForDocument,
  getSafeRestoredFileName,
  isBackupDataUrlTooLarge,
  isBlockedBackupAttachment,
  reconcileRestoredExpenseDocumentation,
  stripDocumentFileMetadata,
  summarizeBackupEnvelope,
  validateBackupEnvelope,
} from "../backend/domain/backup.js";
import {
  canStoreDocuments,
  deleteDocumentFile,
  getDocumentFile,
  listDocumentFiles,
  saveDocumentFile,
  saveDocumentFileRecord,
} from "../backend/storage/document-storage.js";
import {
  getStorageInfo,
  isDesktopMode,
  loadRecords,
  saveBackupFile,
  saveCpaReviewPdf,
  saveRecords,
} from "../backend/storage/records-storage.js";
import {
  createTutorialData,
  TUTORIAL_STEPS,
} from "../backend/domain/tutorial-data.js";

const EMPTY_FILTER = "all";
const WORKSPACE_REAL = "records";
const WORKSPACE_TUTORIAL = "tutorial";
const THEME_PREFERENCE_KEY = "home-ledger:theme-preference";
const DASHBOARD_TAB_ACTIVITY = "activity";
const DASHBOARD_TAB_ATTENTION = "attention";
const app = document.querySelector("#app");

let data = EMPTY_DATA;
let realData = EMPTY_DATA;
let tutorialData = createTutorialData();
let workspaceMode = WORKSPACE_REAL;
let activeTab = "dashboard";
let dashboardSubTab = DASHBOARD_TAB_ACTIVITY;
let dashboardActivityFilter = EMPTY_FILTER;
let themePreference = loadThemePreference();
let selectedPropertyId = "";
let notice = "";
let storageWriteBlocked = false;
let propertyMode = "view";
let editingPropertyField = "";
let selectedProjectId = "";
let activeProjectFileId = "";
let returnToProjectFileId = "";
let propertyProjectPreviewId = "";
let expandedProjectFollowUpIds = new Set();
let expandedDashboardPropertyIds = new Set();
let editingProjectId;
let editingProjectField = "";
let editingExpenseId;
let editingDocumentId;
let documentFileInputAllowed = false;
let editingVendorId;
let vendorManagerOpen = false;
let recordsToFinishOpen = false;
let activeFollowUpItemId = "";
let expenseDocumentsPreviewId = "";
let draftExpenseFormValues = null;
let draftExpenseProjectId = "";
let draftDocumentExpenseId = "";
let draftDocumentProjectId = "";
let activeCalculator = "sales";
let calculatorBasisPropertyId = "";
let projectCostPlan = {
  propertyId: "",
  projectId: "",
  materials: "",
  labor: "",
  permits: "",
  other: "",
  contingencyRate: "10",
};
let documentPreview = null;
let lastBackupCreatedAt = "";
let storageEstimate = {
  status: "idle",
  usage: 0,
  quota: 0,
};
let storageInfo = {
  mode: isDesktopMode() ? "desktop" : "browser",
  recordsPathLabel: isDesktopMode() ? "Mac app data file" : "Browser storage",
  documentsPathLabel: isDesktopMode() ? "Mac app documents folder" : "Browser storage",
  storageDescription: isDesktopMode()
    ? "Project details and document copies are stored by the Mac app."
    : "Project details and document copies are available in this browser.",
  recordsBytes: 0,
  documentBytes: 0,
  documentCount: 0,
};
let activeDialogKey = "";
let returnFocusSelector = "";
let pendingFocusSelector = "";

const projectFilters = {
  propertyId: selectedPropertyId || EMPTY_FILTER,
  status: EMPTY_FILTER,
  category: EMPTY_FILTER,
  openItems: EMPTY_FILTER,
  startDateFrom: "",
  startDateTo: "",
  completionDateFrom: "",
  completionDateTo: "",
};

const expenseFilters = {
  propertyId: selectedPropertyId || EMPTY_FILTER,
  projectId: EMPTY_FILTER,
  classification: EMPTY_FILTER,
  category: EMPTY_FILTER,
  documentationStatus: EMPTY_FILTER,
  sort: "date-desc",
};

const documentFilters = {
  propertyId: EMPTY_FILTER,
  documentType: EMPTY_FILTER,
  fileStatus: EMPTY_FILTER,
  sort: "date-desc",
};
const DOCUMENT_TAB_LIBRARY = "library";
let documentSubTab = DOCUMENT_TAB_LIBRARY;
let saleScenario = {
  propertyId: "",
  salePrice: "",
  mortgagePayoff: "",
  sellingCostsRate: "6",
  sellingCostsAmount: "",
  exclusionAmount: "250000",
};

const DOCUMENT_FILE_FILTERS = [
  { value: "stored", label: "Stored file" },
  { value: "needs-follow-up", label: "File needs attention" },
  { value: "no-file", label: "No file" },
];

const DOCUMENT_SORT_OPTIONS = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name A to Z" },
  { value: "name-desc", label: "Name Z to A" },
  { value: "type-asc", label: "Type A to Z" },
];

const DASHBOARD_ACTIVITY_TYPE_OPTIONS = [
  { value: "project", label: "Projects" },
  { value: "expense", label: "Expenses" },
  { value: "document", label: "Documents" },
];

const DOCUMENT_TEXT_FILE_SIZE_LIMIT = 2 * 1024 * 1024;
const PDF_TEXT_MAX_PAGES = 25;
const PDF_RENDER_MAX_PIXELS = 12_000_000;
const PDF_RENDER_MAX_SCALE = 3;
const PDF_RENDER_MIN_SCALE = 0.65;
const PDF_TEXT_CONTENT_MIN_LENGTH = 12;
const PLAIN_TEXT_EXTENSIONS = /\.(csv|json|log|md|text|tsv|txt|xml)$/;
const PLAIN_TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "text/csv",
  "text/markdown",
  "text/plain",
  "text/tab-separated-values",
  "text/xml",
]);

let tesseractModulePromise;
let pdfJsModulePromise;

app.addEventListener("click", handleClick);
app.addEventListener("submit", handleSubmit);
app.addEventListener("change", handleChange);
app.addEventListener("keydown", handleKeydown);
window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", applyThemePreference);
window.addEventListener("hashchange", handleHashChange);
if (!isDesktopMode()) {
  window.addEventListener("storage", handleStorageEvent);
}

renderLoading();
initializeApp();

applyThemePreference();

function renderLoading() {
  app.innerHTML = `
    <main class="workspace loading-workspace">
      <section class="panel">
        ${renderPanelHeader("Opening Home Ledger", "Loading your home project information.", "home")}
      </section>
    </main>
  `;
}

function loadThemePreference() {
  try {
    const stored = window.localStorage?.getItem(THEME_PREFERENCE_KEY);
    return ["system", "light", "dark"].includes(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function setThemePreference(value) {
  themePreference = ["system", "light", "dark"].includes(value) ? value : "system";
  try {
    window.localStorage?.setItem(THEME_PREFERENCE_KEY, themePreference);
  } catch {
    // Theme preference is optional; the app can continue without localStorage.
  }
  applyThemePreference();
  showNotice("Theme preference updated.");
}

function applyThemePreference() {
  document.documentElement.dataset.theme = themePreference;
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  document.documentElement.dataset.themeResolved = themePreference === "dark" || (themePreference === "system" && systemDark) ? "dark" : "light";
}

function getTabFromHash() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return TABS.some((tab) => tab.id === id) ? id : "";
}

function setRouteHash(tabId, { replace = false } = {}) {
  if (!TABS.some((tab) => tab.id === tabId)) return;
  const nextHash = `#${tabId}`;
  if (window.location.hash === nextHash) return;
  if (replace) {
    window.history.replaceState(null, "", nextHash);
  } else {
    window.location.hash = tabId;
  }
}

function navigateToTab(tabId, options = {}) {
  if (!TABS.some((tab) => tab.id === tabId)) return;
  activeTab = tabId;
  closeEditors();
  setRouteHash(tabId, options);
}

function handleHashChange() {
  const nextTab = getTabFromHash();
  if (!nextTab || nextTab === activeTab) return;
  activeTab = nextTab;
  closeEditors();
  render();
}

async function initializeApp() {
  try {
    realData = sanitizeData(await loadRecords(STORAGE_KEY));
    data = realData;
    storageWriteBlocked = false;
  } catch {
    realData = sanitizeData(EMPTY_DATA);
    data = EMPTY_DATA;
    storageWriteBlocked = true;
    notice = "Unable to load your saved information. To protect existing data, new saves are paused until you restore a backup or reopen the app.";
  }
  try {
    storageInfo = await getStorageInfo();
  } catch {
    // Records can still load and save even if the optional storage summary is unavailable.
  }

  selectedPropertyId = data.properties[0]?.id || "";
  propertyMode = "view";
  resetFiltersAfterRestore();
  activeTab = getTabFromHash() || activeTab;
  render();
}

function render() {
  if (selectedPropertyId && !data.properties.some((property) => property.id === selectedPropertyId)) {
    selectedPropertyId = data.properties[0]?.id || "";
  }
  normalizeSelectionsAndFilters();

  app.innerHTML = `
    <div class="app-shell ${isTutorialMode() ? "is-tutorial-mode" : ""}">
      <aside class="app-sidebar">
        <div class="brand-block">
          <div class="brand-row">
            <span class="brand-mark" aria-hidden="true">
              <img src="/desktop/build/icon.png" alt="" onerror="this.hidden=true; this.nextElementSibling.hidden=false">
              <span class="brand-mark-fallback" hidden>H</span>
            </span>
            <div>
              <h1>Home Ledger</h1>
              ${isTutorialMode() ? `
                <span class="workspace-mode-chip">Tutorial workspace</span>
                <p>Sample items only</p>
              ` : ""}
            </div>
          </div>
        </div>
        <nav class="app-tabs" aria-label="App sections" role="tablist">
          ${TABS.map((tab) => `
            <button
              aria-controls="${tab.id}-panel"
              aria-selected="${activeTab === tab.id}"
              class="${activeTab === tab.id ? "is-active" : ""}"
              data-tab="${tab.id}"
              id="${tab.id}-tab"
              role="tab"
              tabindex="${activeTab === tab.id ? "0" : "-1"}"
              type="button"
            ><span aria-hidden="true">${tabIcon(tab.id)}</span>${escapeHtml(tab.label)}</button>
          `).join("")}
        </nav>
        ${renderWorkspaceControls()}
        ${renderSidebarFooter()}
      </aside>
      <main class="workspace">
        ${renderToast()}
        ${renderTutorialModeBanner()}
        <section class="tab-panel" id="${activeTab}-panel" role="tabpanel" aria-labelledby="${activeTab}-tab">
          ${renderActiveTab()}
        </section>
        ${renderActiveProjectFileModal()}
        ${editingProjectId !== undefined ? renderProjectFormModal(editingProjectId === null ? null : data.projects.find((project) => project.id === editingProjectId)) : ""}
        ${editingExpenseId !== undefined ? renderExpenseFormModal(editingExpenseId === null ? null : data.expenses.find((expense) => expense.id === editingExpenseId)) : ""}
        ${editingDocumentId !== undefined ? renderDocumentFormModal(editingDocumentId === null ? null : data.documents.find((document) => document.id === editingDocumentId)) : ""}
        ${renderExpenseDocumentsModal()}
        ${recordsToFinishOpen ? renderRecordsToFinishModal() : ""}
        ${renderFollowUpResolutionModal()}
        ${vendorManagerOpen ? renderVendorManagerModal() : ""}
        ${editingVendorId !== undefined ? renderVendorFormModal(editingVendorId ? data.vendors.find((vendor) => vendor.id === editingVendorId) : null) : ""}
        ${renderDocumentPreview()}
      </main>
    </div>
  `;
  keepActiveTabVisible();
  syncModalFocus();
  restorePendingFocus();
}

function keepActiveTabVisible() {
  const activeButton = app.querySelector(".app-tabs button.is-active");
  activeButton?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function renderActiveTab() {
  if (activeTab === "tutorial") return renderTutorialView();
  if (activeTab === "settings") return renderSettingsView();
  if (activeTab === "property") return renderPropertyView();
  if (activeTab === "projects") return renderProjectsView();
  if (activeTab === "expenses") return renderExpensesView();
  if (activeTab === "documents") return renderDocumentsView();
  if (activeTab === "calculators") return renderCalculatorsView();
  if (activeTab === "export") return renderExportCenter();
  return renderDashboard();
}

function dashboardTabLink(label, tab, ariaLabel, className = "dashboard-link", options = {}) {
  const attributes = [
    `href="#${escapeAttr(tab)}"`,
    `data-action="dashboard-nav"`,
    `data-target-tab="${escapeAttr(tab)}"`,
    `aria-label="${escapeAttr(ariaLabel || label)}"`,
  ];
  if (className) attributes.push(`class="${escapeAttr(className)}"`);
  if (options.propertyId) attributes.push(`data-property-id="${escapeAttr(options.propertyId)}"`);
  if (options.projectId) attributes.push(`data-project-id="${escapeAttr(options.projectId)}"`);
  if (options.sort) attributes.push(`data-sort="${escapeAttr(options.sort)}"`);
  return `<a ${attributes.join(" ")}>${escapeHtml(label)}</a>`;
}

function dashboardProjectLink(projectId) {
  const project = data.projects.find((currentProject) => currentProject.id === projectId);
  if (!project) return "";
  return `<a class="dashboard-inline-link" href="#projects" data-action="open-project" data-id="${escapeAttr(project.id)}" aria-label="${escapeAttr(`Open project ${project.name}`)}">${escapeHtml(project.name)}</a>`;
}

function applyDashboardNavigation(link) {
  const targetTab = link.dataset.targetTab || "dashboard";
  const propertyId = link.dataset.propertyId || "";
  const projectId = link.dataset.projectId || "";
  const sort = link.dataset.sort || "";

  if (targetTab === "property") {
    if (propertyId && data.properties.some((property) => property.id === propertyId)) {
      selectedPropertyId = propertyId;
    }
    propertyMode = "view";
    editingPropertyField = "";
  } else if (targetTab === "projects") {
    projectFilters.propertyId = propertyId || EMPTY_FILTER;
    projectFilters.status = EMPTY_FILTER;
    projectFilters.category = EMPTY_FILTER;
    projectFilters.openItems = EMPTY_FILTER;
    projectFilters.startDateFrom = "";
    projectFilters.startDateTo = "";
    projectFilters.completionDateFrom = "";
    projectFilters.completionDateTo = "";
  } else if (targetTab === "expenses") {
    expenseFilters.propertyId = propertyId || EMPTY_FILTER;
    expenseFilters.projectId = projectId || EMPTY_FILTER;
    expenseFilters.classification = EMPTY_FILTER;
    expenseFilters.category = EMPTY_FILTER;
    expenseFilters.documentationStatus = EMPTY_FILTER;
    expenseFilters.sort = sort || "date-desc";
  } else if (targetTab === "documents") {
    documentFilters.propertyId = propertyId || EMPTY_FILTER;
    documentFilters.documentType = EMPTY_FILTER;
    documentFilters.fileStatus = EMPTY_FILTER;
    documentFilters.sort = "date-desc";
    documentSubTab = DOCUMENT_TAB_LIBRARY;
  }

  navigateToTab(targetTab);
}

function renderDashboard() {
  const totals = getExpenseTotals(data.expenses);
  const propertySummaries = getPropertyReviewSummaries(data);
  const hasRecords = data.properties.length || data.projects.length || data.expenses.length || data.documents.length;
  const dashboardFollowUps = hasRecords ? getSurfaceFollowUps("dashboard") : [];
  const activityItems = getDashboardActivityItems();
  const activityTypeOptions = getDashboardActivityTypeOptions(activityItems);
  if (dashboardActivityFilter !== EMPTY_FILTER && !activityTypeOptions.some((option) => option.value === dashboardActivityFilter)) {
    dashboardActivityFilter = EMPTY_FILTER;
  }
  if (![DASHBOARD_TAB_ACTIVITY, DASHBOARD_TAB_ATTENTION].includes(dashboardSubTab)) {
    dashboardSubTab = DASHBOARD_TAB_ACTIVITY;
  }
  const filteredActivityItems = dashboardActivityFilter === EMPTY_FILTER
    ? activityItems
    : activityItems.filter((item) => item.type === dashboardActivityFilter);

  return `
    <div class="page-stack">
      ${renderPageIntro({
        title: "Your home records",
      })}
      ${hasRecords ? "" : renderOnboardingPanel()}

      ${renderDashboardSummaryRow(totals)}
      ${hasRecords ? renderDashboardQuickActions() : ""}
      <div class="dashboard-top-grid ${propertySummaries.length ? "" : "has-no-properties"}">
        ${propertySummaries.length ? renderPropertyDashboardCards(propertySummaries) : ""}
        ${hasRecords ? renderDashboardWorkspaceTabs(activityItems, filteredActivityItems, activityTypeOptions, dashboardFollowUps) : ""}
      </div>
    </div>
  `;
}

function renderDashboardWorkspaceTabs(activityItems, filteredActivityItems, activityTypeOptions, followUps) {
  return `
    <section class="panel dashboard-workspace-panel">
      ${renderDashboardSubTabs(activityItems.length, followUps.length)}
      ${dashboardSubTab === DASHBOARD_TAB_ATTENTION
        ? renderDashboardAttentionPanel(followUps)
        : renderDashboardActivityPanel(activityItems, filteredActivityItems, activityTypeOptions)}
    </section>
  `;
}

function renderDashboardSubTabs(activityCount, followUpCount) {
  return `
    <div class="sub-tabs dashboard-sub-tabs" role="tablist" aria-label="Dashboard views">
      <button
        aria-controls="dashboard-activity-panel"
        aria-selected="${dashboardSubTab === DASHBOARD_TAB_ACTIVITY ? "true" : "false"}"
        class="${dashboardSubTab === DASHBOARD_TAB_ACTIVITY ? "is-active" : ""}"
        data-action="set-dashboard-subtab"
        data-dashboard-subtab="${DASHBOARD_TAB_ACTIVITY}"
        id="dashboard-activity-tab"
        role="tab"
        tabindex="${dashboardSubTab === DASHBOARD_TAB_ACTIVITY ? "0" : "-1"}"
        type="button"
      >Recent activity <span>${activityCount}</span></button>
      <button
        aria-controls="dashboard-attention-panel"
        aria-selected="${dashboardSubTab === DASHBOARD_TAB_ATTENTION ? "true" : "false"}"
        class="${dashboardSubTab === DASHBOARD_TAB_ATTENTION ? "is-active" : ""}"
        data-action="set-dashboard-subtab"
        data-dashboard-subtab="${DASHBOARD_TAB_ATTENTION}"
        id="dashboard-attention-tab"
        role="tab"
        tabindex="${dashboardSubTab === DASHBOARD_TAB_ATTENTION ? "0" : "-1"}"
        type="button"
      >Follow-ups <span>${followUpCount}</span></button>
    </div>
  `;
}

function renderDashboardActivityPanel(activityItems, filteredActivityItems, activityTypeOptions) {
  const hasActiveFilter = dashboardActivityFilter !== EMPTY_FILTER;
  return `
    <div id="dashboard-activity-panel" role="tabpanel" aria-labelledby="dashboard-activity-tab" class="dashboard-tab-panel">
      ${renderPanelHeader("Recent activity", "", "activity")}
      ${renderFilterPanel(`
        ${renderFilter("Activity type", "dashboard.activityType", dashboardActivityFilter, activityTypeOptions)}
      `, { count: activityItems.length, hasActiveFilters: hasActiveFilter, clearAction: "clear-dashboard-activity-filter", className: "dashboard-activity-filters" })}
      ${filteredActivityItems.length
        ? renderDashboardActivityTable(filteredActivityItems.slice(0, 12))
        : hasActiveFilter
          ? renderEmpty("No activity for this filter", "Clear the activity filter to see all recent records.", renderInlineAction("Clear filter", "clear-dashboard-activity-filter", "button-secondary"))
          : renderEmpty("No recent activity yet", "Add a project, expense, or document to start building your activity history.")}
    </div>
  `;
}

function renderDashboardAttentionPanel(followUps) {
  const content = getRecordsToFinishContent(followUps);
  return `
    <div id="dashboard-attention-panel" role="tabpanel" aria-labelledby="dashboard-attention-tab" class="dashboard-tab-panel">
      ${renderPanelHeader("Items to review", "", "alert")}
      ${renderRecordsToFinishBody(content, "dashboard-attention-body")}
    </div>
  `;
}

function getDashboardActivityItems() {
  const projectItems = data.projects.map((project) => {
    const projectExpenses = data.expenses.filter((expense) => expense.projectId === project.id);
    const totals = getExpenseTotals(projectExpenses);
    const date = getProjectActivityDate(project, projectExpenses);
    return {
      id: `project:${project.id}`,
      type: "project",
      typeLabel: "Project",
      name: project.name,
      date,
      sortDate: date || "",
      related: getPropertyName(data, project.propertyId),
      summary: `${optionLabel(PROJECT_STATUSES, project.status)} / ${optionLabel(EXPENSE_CATEGORIES, project.category)} / ${formatCurrency(totals.total)}`,
      action: "open-project",
      recordId: project.id,
      href: "#projects",
      openLabel: `Open project ${project.name}`,
    };
  });
  const expenseItems = data.expenses.map((expense) => {
    const project = data.projects.find((currentProject) => currentProject.id === expense.projectId);
    const vendor = getExpenseVendorName(data, expense);
    return {
      id: `expense:${expense.id}`,
      type: "expense",
      typeLabel: "Expense",
      name: vendor,
      date: expense.date || "",
      sortDate: expense.date || "",
      related: project ? `${getPropertyName(data, expense.propertyId)} / ${project.name}` : getPropertyName(data, expense.propertyId),
      summary: `${expense.description || "Expense"} / ${formatCurrency(expense.amount)}`,
      action: "open-expense",
      recordId: expense.id,
      href: "#expenses",
      openLabel: `Open expense ${vendor}`,
    };
  });
  const documentItems = data.documents.map((document) => {
    const project = data.projects.find((currentProject) => currentProject.id === document.projectId);
    const relatedExpense = data.expenses.find((expense) => expense.id === document.expenseId);
    const linkedTo = project
      ? `${getPropertyName(data, document.propertyId)} / ${project.name}`
      : getPropertyName(data, document.propertyId);
    return {
      id: `document:${document.id}`,
      type: "document",
      typeLabel: "Document",
      name: document.displayName,
      date: document.addedDate || "",
      sortDate: document.addedDate || "",
      related: relatedExpense ? `${linkedTo} / ${getExpenseVendorName(data, relatedExpense)}` : linkedTo,
      summary: `${optionLabel(DOCUMENT_TYPES, document.documentType)} / ${getDocumentDisplayFileState(document).label}`,
      action: "open-document",
      recordId: document.id,
      href: "#documents",
      openLabel: `Open document ${document.displayName}`,
    };
  });

  return [...projectItems, ...expenseItems, ...documentItems].sort(compareDashboardActivityItems);
}

function getProjectActivityDate(project, projectExpenses) {
  const expenseDates = projectExpenses.map((expense) => expense.date).filter(Boolean).sort();
  return project.completionDate || project.startDate || expenseDates.at(-1) || "";
}

function compareDashboardActivityItems(firstItem, secondItem) {
  const dateCompare = String(secondItem.sortDate || "").localeCompare(String(firstItem.sortDate || ""));
  if (dateCompare) return dateCompare;
  const typeCompare = firstItem.typeLabel.localeCompare(secondItem.typeLabel);
  if (typeCompare) return typeCompare;
  return firstItem.name.localeCompare(secondItem.name);
}

function getDashboardActivityTypeOptions(activityItems) {
  const availableTypes = new Set(activityItems.map((item) => item.type));
  return DASHBOARD_ACTIVITY_TYPE_OPTIONS.filter((option) => availableTypes.has(option.value));
}

function renderDashboardActivityTable(items) {
  return `
    <div class="table-wrap compact-table-wrap">
      <table class="compact-record-table dashboard-activity-table">
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
              <td data-label="Type"><span class="pill ${getDashboardActivityPillTone(item.type)}">${escapeHtml(item.typeLabel)}</span></td>
              <td class="record-name-cell" data-label="Record">
                <a class="table-link dashboard-object-link" href="${escapeAttr(item.href)}" data-action="${escapeAttr(item.action)}" data-dashboard-open="true" data-id="${escapeAttr(item.recordId)}" aria-label="${escapeAttr(item.openLabel)}">${escapeHtml(item.name)}</a>
              </td>
              <td data-label="Related to">${escapeHtml(item.related || "Not linked")}</td>
              <td data-label="Date">${escapeHtml(item.date ? formatDate(item.date) : "No date")}</td>
              <td data-label="Summary">${escapeHtml(item.summary)}</td>
              <td class="align-right" data-label="Open">
                <a class="dashboard-open-link" href="${escapeAttr(item.href)}" data-action="${escapeAttr(item.action)}" data-dashboard-open="true" data-id="${escapeAttr(item.recordId)}" aria-label="${escapeAttr(item.openLabel)}">Open →</a>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getDashboardActivityPillTone(type) {
  if (type === "project") return "tone-blue";
  if (type === "expense") return "tone-warn";
  if (type === "document") return "tone-green";
  return "";
}

function renderDashboardSummaryRow(totals) {
  return `
    <section class="dashboard-summary-row" aria-label="Home paperwork summary">
      ${dashboardSummaryItem("Properties", data.properties.length, "property", "View properties")}
      ${dashboardSummaryItem("Projects", data.projects.length, "projects", "View all projects")}
      ${dashboardSummaryItem("Expenses", data.expenses.length, "expenses", "View all expenses")}
      ${dashboardSummaryItem("Total spend", formatCurrency(totals.total), "expenses", "View expenses by amount", { sort: "amount-desc" })}
    </section>
  `;
}

function dashboardSummaryItem(label, value, tab, ariaLabel, options = {}) {
  return `
    <a class="dashboard-summary-link" href="#${escapeAttr(tab)}" data-action="dashboard-nav" data-target-tab="${escapeAttr(tab)}"${options.sort ? ` data-sort="${escapeAttr(options.sort)}"` : ""} aria-label="${escapeAttr(ariaLabel)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <em aria-hidden="true">View</em>
    </a>
  `;
}

function renderDashboardQuickActions() {
  return `
    <div class="dashboard-quick-actions" aria-label="Quick actions">
      ${data.properties.length ? `<button class="button button-primary" data-action="add-expense" type="button"><span aria-hidden="true">+</span>Add expense</button>` : ""}
      ${data.properties.length ? `<button class="button button-secondary" data-action="add-document" type="button"><span aria-hidden="true">+</span>Add document</button>` : ""}
      ${data.properties.length ? `<button class="button button-secondary" data-action="add-project" type="button"><span aria-hidden="true">+</span>Add project</button>` : ""}
      ${dashboardTabLink("Export report", "export", "Open export and backup", "button button-secondary")}
    </div>
  `;
}

function renderOnboardingPanel() {
  return `
    <section class="onboarding-panel">
      <div>
        <h2>Add a property to start your real home file.</h2>
        <p>A property is the first thing to add. Projects, expenses, and documents attach to it later.</p>
      </div>
      <ol class="step-list">
        <li><span aria-hidden="true">⌂</span><span>Add your property</span></li>
        <li><span aria-hidden="true">▣</span><span>Create projects</span></li>
        <li><span aria-hidden="true">▤</span><span>Attach receipts or permits and export a review packet</span></li>
      </ol>
      <div class="onboarding-actions">
        <button class="button button-primary" data-action="add-property" type="button"><span aria-hidden="true">+</span>Add your property</button>
        <button class="button button-secondary" data-action="start-tutorial" type="button">Open tutorial</button>
      </div>
    </section>
  `;
}

function renderCalculatorsView() {
  const propertySummaries = getPropertyReviewSummaries(data);
  const hasProperties = propertySummaries.length > 0;
  const calculatorOptions = [
    ["sales", "Sale Estimate Worksheet", "Sale proceeds and estimated gain"],
    ["basis", "Basis Summary", "Basis estimate by property"],
    ["project", "Project Cost Planner", "Plan vs actual project spend"],
  ];
  const selectedCalculator = calculatorOptions.some(([id]) => id === activeCalculator) ? activeCalculator : "sales";

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Calculators",
        title: "Worksheets",
        description: "Estimate sale proceeds, basis totals, and project costs from saved project details.",
      })}
      ${hasProperties ? `
        <section class="panel calculator-menu-panel">
          ${renderPanelHeader("Choose calculator", "", "clipboard")}
          <div class="calculator-menu" role="tablist" aria-label="Calculators">
            ${calculatorOptions.map(([id, label, helper]) => `
              <button
                aria-controls="calculator-panel-${escapeAttr(id)}"
                aria-selected="${selectedCalculator === id ? "true" : "false"}"
                class="calculator-menu-button ${selectedCalculator === id ? "is-active" : ""}"
                data-action="set-calculator"
                data-calculator="${escapeAttr(id)}"
                id="calculator-tab-${escapeAttr(id)}"
                role="tab"
                tabindex="${selectedCalculator === id ? "0" : "-1"}"
                type="button"
              >
                <strong>${escapeHtml(label)}</strong>
                <span>${escapeHtml(helper)}</span>
              </button>
            `).join("")}
          </div>
        </section>
        <div id="calculator-panel-${escapeAttr(selectedCalculator)}" role="tabpanel" aria-labelledby="calculator-tab-${escapeAttr(selectedCalculator)}">
          ${renderSelectedCalculator(selectedCalculator, propertySummaries)}
        </div>
      ` : renderEmpty("No calculator data yet", "Add a property first. Worksheets use saved property, project, expense, and document details.", renderInlineAction("Add your property", "add-property"))}
    </div>
  `;
}

function renderSelectedCalculator(calculatorId, propertySummaries) {
  if (calculatorId === "basis") return renderBasisSummaryCalculator(propertySummaries);
  if (calculatorId === "project") return renderProjectCostCalculator();
  return renderSaleScenarioPanel(propertySummaries);
}

function renderSaleScenarioPanel(propertySummaries) {
  const propertyOptions = propertySummaries.map((summary) => ({
    value: summary.property.id,
    label: summary.property.name,
  }));
  const validPropertyIds = new Set(propertyOptions.map((option) => option.value));
  const propertyId = validPropertyIds.has(saleScenario.propertyId)
    ? saleScenario.propertyId
    : selectedPropertyId && validPropertyIds.has(selectedPropertyId)
      ? selectedPropertyId
      : propertyOptions[0]?.value || "";
  const scenario = { ...saleScenario, propertyId };
  const estimate = buildSaleScenarioEstimate(data, scenario);
  const hasSalePrice = estimate.salePrice > 0;
  const selectedSummary = propertySummaries.find((summary) => summary.property.id === propertyId);

  return `
    <section class="panel sale-scenario-panel">
      ${renderPanelHeader("Sale Estimate Worksheet", "", "home")}
      ${selectedSummary && !selectedSummary.property.purchasePrice
        ? renderEmpty("Purchase price not added", "Add the purchase price to make this worksheet more useful.", renderInlineAction("Add purchase price", "edit-property-field", "button-secondary", { id: selectedSummary.property.id, field: "purchasePrice" }))
        : ""}
      ${selectedSummary && !selectedSummary.expenses.length
        ? renderEmpty("No tracked expenses for this property", "Add expenses to include possible improvements and costs that need classification in the worksheet.", renderInlineAction("Add expense", "add-expense", "button-secondary"))
        : ""}
      <div class="sale-scenario-grid">
        <form class="sale-scenario-form" data-form="sale-scenario" novalidate>
          <div class="form-row">
            <label class="field">
              <span>Property</span>
              <select name="propertyId">
                ${propertyOptions.map((option) => optionHtml(option.value, option.label, propertyId)).join("")}
              </select>
            </label>
            ${field("Expected sale price", "salePrice", scenario.salePrice, { type: "number", step: "0.01", placeholder: "Enter sale price" })}
          </div>
          <div class="form-row">
            ${field("Mortgage payoff", "mortgagePayoff", scenario.mortgagePayoff, { type: "number", step: "0.01", placeholder: "Optional" })}
            ${field("Selling costs (%)", "sellingCostsRate", scenario.sellingCostsRate, { type: "number", step: "0.1" })}
          </div>
          <div class="form-row">
            ${field("Selling costs amount", "sellingCostsAmount", scenario.sellingCostsAmount, { type: "number", step: "0.01", placeholder: "Optional override amount" })}
            <label class="field">
              <span>Optional home-sale exclusion assumption</span>
              <select name="exclusionAmount">
                ${optionHtml("0", "Do not apply", scenario.exclusionAmount)}
                ${optionHtml("250000", "$250,000 single", scenario.exclusionAmount)}
                ${optionHtml("500000", "$500,000 married filing jointly", scenario.exclusionAmount)}
              </select>
            </label>
          </div>
          <div class="form-actions">
            <button class="button button-primary" type="submit">Update estimate</button>
          </div>
        </form>
        <div class="sale-scenario-results">
          <div class="scenario-result-grid">
            ${scenarioResultCard("Estimated cash before taxes", hasSalePrice ? formatCurrency(estimate.netProceedsBeforeTax) : "Enter sale price", "Sale price minus selling costs and mortgage payoff.")}
            ${scenarioResultCard("Estimated gain before tax review", hasSalePrice ? formatCurrency(estimate.potentialTaxableGain) : "Enter sale price", "Gain after the selected exclusion assumption.")}
          </div>
          <dl class="scenario-breakdown">
            ${detailItem("Purchase price", formatCurrency(estimate.purchasePrice))}
            ${detailItem("Possible improvements included", formatCurrency(estimate.basisAdditions))}
            ${detailItem("Estimated selling costs", hasSalePrice ? formatCurrency(estimate.sellingCosts) : "Not estimated")}
            ${detailItem("Basis estimate used", formatCurrency(estimate.adjustedBasis))}
            ${detailItem("Gain before exclusion", hasSalePrice ? formatCurrency(estimate.gainBeforeExclusion) : "Not estimated")}
            ${detailItem("Needs-classification amounts tracked separately", formatCurrency(estimate.needsReviewCosts))}
          </dl>
          <p class="helper-note">Home Ledger organizes records. It does not give tax, legal, or accounting advice.</p>
        </div>
      </div>
    </section>
  `;
}

function scenarioResultCard(label, value, helper) {
  return `
    <article class="scenario-result-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(helper)}</small>
    </article>
  `;
}

function renderBasisSummaryCalculator(propertySummaries) {
  const selectedSummary = getSelectedCalculatorPropertySummary(propertySummaries);
  const estimate = buildSaleScenarioEstimate(data, { propertyId: selectedSummary.property.id, exclusionAmount: "0" });
  const missingSupportTotal = selectedSummary.expenses
    .filter((expense) => isDocumentationGap(expense))
    .reduce((total, expense) => total + parseAmount(expense.amount), 0);
  const projectRows = selectedSummary.projects.map((project) => {
    const totals = getExpenseTotals(data.expenses.filter((expense) => expense.projectId === project.id));
    return {
      project,
      totals,
    };
  }).filter((row) => row.totals.total > 0);

  return `
    <section class="panel calculator-card">
      ${renderPanelHeader("Basis Summary", "", "clipboard")}
      <label class="field">
        <span>Property</span>
        <select data-filter="calculator.basisPropertyId">
          ${propertySummaries.map((summary) => optionHtml(summary.property.id, summary.property.name, selectedSummary.property.id)).join("")}
        </select>
      </label>
      <div class="scenario-result-grid">
        ${scenarioResultCard("Basis estimate", formatCurrency(estimate.adjustedBasis), "Purchase price plus included possible improvements.")}
        ${scenarioResultCard("Needs classification", formatCurrency(estimate.needsReviewCosts), "Tracked separately for later review.")}
      </div>
      ${!selectedSummary.property.purchasePrice
        ? renderEmpty("Purchase price not added", "Add the purchase price to make the basis estimate more useful.", renderInlineAction("Add purchase price", "edit-property-field", "button-secondary", { id: selectedSummary.property.id, field: "purchasePrice" }))
        : ""}
      ${selectedSummary.expenses.length ? "" : renderEmpty("No tracked expenses for this property", "Add expenses to separate possible improvements, repair / upkeep, and costs that need classification.", renderInlineAction("Add expense", "add-expense", "button-secondary"))}
      <dl class="scenario-breakdown calculator-breakdown">
        ${detailItem("Purchase price", formatCurrency(estimate.purchasePrice))}
        ${detailItem("Included possible improvements", formatCurrency(estimate.basisAdditions))}
        ${detailItem("Repair or upkeep", formatCurrency(estimate.repairCosts))}
        ${detailItem("Needs classification", formatCurrency(estimate.needsReviewCosts))}
        ${detailItem("Missing support", formatCurrency(missingSupportTotal))}
        ${detailItem("Projects", selectedSummary.projects.length)}
        ${detailItem("Expenses", selectedSummary.expenses.length)}
        ${detailItem("Documents", selectedSummary.documents.length)}
      </dl>
      <p class="helper-note">Home Ledger organizes records. It does not give tax, legal, or accounting advice.</p>
      ${projectRows.length ? `
        <div class="calculator-table-wrap">
          ${table(["Project", "Total spend", "Possible improvements", "Needs classification"], projectRows.map((row) => [
            escapeHtml(row.project.name),
            `<span class="money">${formatCurrency(row.totals.total)}</span>`,
            `<span class="money">${formatCurrency(row.totals.potential)}</span>`,
            `<span class="money">${formatCurrency(row.totals.unclear)}</span>`,
          ]))}
        </div>
      ` : renderEmpty("No project spending yet", "Add expenses to see project-level basis totals.")}
    </section>
  `;
}

function renderProjectCostCalculator() {
  const validPropertyId = data.properties.some((property) => property.id === projectCostPlan.propertyId)
    ? projectCostPlan.propertyId
    : selectedPropertyId || data.properties[0]?.id || "";
  const projectOptions = data.projects.filter((project) => project.propertyId === validPropertyId);
  const validProjectId = projectOptions.some((project) => project.id === projectCostPlan.projectId)
    ? projectCostPlan.projectId
    : "";
  const plan = { ...projectCostPlan, propertyId: validPropertyId, projectId: validProjectId };
  const subtotal = parseAmount(plan.materials) + parseAmount(plan.labor) + parseAmount(plan.permits) + parseAmount(plan.other);
  const contingencyRate = Math.max(0, parseAmount(plan.contingencyRate));
  const contingencyAmount = subtotal * (contingencyRate / 100);
  const plannedTotal = subtotal + contingencyAmount;
  const actualExpenses = validProjectId
    ? data.expenses.filter((expense) => expense.projectId === validProjectId)
    : [];
  const actualTotal = getExpenseTotals(actualExpenses).total;
  const remaining = plannedTotal - actualTotal;

  return `
    <section class="panel calculator-card">
      ${renderPanelHeader("Project Cost Planner", "", "folder")}
      <p class="helper-note">This worksheet is for the current session only. It compares your inputs with tracked project spend and does not save a project budget.</p>
      <form class="form-grid" data-form="project-cost-plan" novalidate>
        <div class="form-row">
          <label class="field">
            <span>Property</span>
            <select name="propertyId">
              ${data.properties.map((property) => optionHtml(property.id, property.name, plan.propertyId)).join("")}
            </select>
          </label>
          <label class="field">
            <span>Compare to project</span>
            <select name="projectId">
              ${optionHtml("", "No project", plan.projectId)}
              ${projectOptions.map((project) => optionHtml(project.id, project.name, plan.projectId)).join("")}
            </select>
          </label>
        </div>
        <div class="form-row">
          ${field("Materials", "materials", plan.materials, { type: "number", step: "0.01", placeholder: "0.00" })}
          ${field("Labor", "labor", plan.labor, { type: "number", step: "0.01", placeholder: "0.00" })}
        </div>
        <div class="form-row">
          ${field("Permits/fees", "permits", plan.permits, { type: "number", step: "0.01", placeholder: "0.00" })}
          ${field("Other", "other", plan.other, { type: "number", step: "0.01", placeholder: "0.00" })}
        </div>
        ${field("Contingency (%)", "contingencyRate", plan.contingencyRate, { type: "number", step: "0.1" })}
        <div class="form-actions">
          <button class="button button-primary" type="submit">Update plan</button>
        </div>
      </form>
      <div class="scenario-result-grid">
        ${scenarioResultCard("Planned total", formatCurrency(plannedTotal), `${formatCurrency(contingencyAmount)} contingency included.`)}
        ${scenarioResultCard(validProjectId ? "Actual tracked spend" : "Actual tracked spend", validProjectId ? formatCurrency(actualTotal) : "Choose project", validProjectId ? `${actualExpenses.length} expense${actualExpenses.length === 1 ? "" : "s"} linked.` : "Select a project to compare.")}
      </div>
      ${validProjectId && !actualExpenses.length ? renderEmpty("No tracked spend for selected project", "Add expenses to compare this worksheet with actual project spending.", renderInlineAction("Add expense", "add-expense", "button-secondary", { projectId: validProjectId })) : ""}
      <dl class="scenario-breakdown calculator-breakdown">
        ${detailItem(remaining >= 0 ? "Remaining plan" : "Over plan", validProjectId ? formatCurrency(Math.abs(remaining)) : "Not compared")}
        ${detailItem("Subtotal before contingency", formatCurrency(subtotal))}
        ${detailItem("Contingency", `${formatCurrency(contingencyAmount)} / ${contingencyRate}%`)}
      </dl>
    </section>
  `;
}

function renderRecordsToFinishPanel(followUps = getSurfaceFollowUps("dashboard")) {
  const content = getRecordsToFinishContent(followUps);
  return `
    <details class="panel record-gap-details">
      <summary aria-controls="records-to-finish-body" aria-describedby="records-to-finish-summary">
        <span class="record-gap-summary-title">
          <strong><span class="summary-chevron" aria-hidden="true">›</span>Follow-ups</strong>
          <small id="records-to-finish-summary">${escapeHtml(content.followUpLabel)} · Expand for next actions</small>
        </span>
        <span class="record-gap-summary-metrics">
          <span>${escapeHtml(content.breakdownLabel)}</span>
        </span>
      </summary>
      ${renderRecordsToFinishBody(content, "records-to-finish-body")}
    </details>
  `;
}

function renderRecordsToFinishSummaryCard(followUps = getSurfaceFollowUps("dashboard")) {
  const content = getRecordsToFinishContent(followUps);
  return `
    <section class="panel records-to-finish-card">
      ${renderPanelHeader("Items to review", "", "alert")}
      <div class="records-to-finish-summary">
        <strong>${escapeHtml(content.followUpLabel)}</strong>
        <span>${escapeHtml(content.breakdownLabel)}</span>
      </div>
      ${content.followUps.length
        ? `<button class="button button-secondary" data-action="open-records-to-finish" type="button">Review items</button>`
        : dashboardTabLink("View documents", "documents", "View documents", "button button-secondary")}
    </section>
  `;
}

function renderRecordsToFinishModal(followUps = getSurfaceFollowUps("dashboard")) {
  const content = getRecordsToFinishContent(followUps);
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal records-to-finish-modal" role="dialog" aria-modal="true" aria-labelledby="records-to-finish-title">
        <div class="modal-header">
          <div>
            <h2 id="records-to-finish-title">Items to review</h2>
            <p>${escapeHtml(content.followUpLabel)} / ${escapeHtml(content.breakdownLabel)}</p>
          </div>
          <button class="icon-button" data-action="close-records-to-finish" type="button" aria-label="Close">×</button>
        </div>
        ${renderRecordsToFinishBody(content, "records-to-finish-modal-body")}
      </section>
    </div>
  `;
}

function getRecordsToFinishContent(followUps = getSurfaceFollowUps("dashboard")) {
  const expenseSupportItems = followUps.filter((item) => item.type.startsWith("expense-") && item.type.includes("document"));
  const missingEvidenceTotal = getExpenseTotals(getUniqueFollowUpExpenses(expenseSupportItems)).total;
  const reviewLaterTotal = getExpenseTotals(data.expenses.filter((expense) =>
    followUps.some((item) => item.type === "expense-review-treatment" && item.expenseId === expense.id)
  )).total;
  const markedCompleteProjects = data.projects.filter((project) => project.completenessOverrideNote).length;
  const documentItems = followUps.filter((item) => item.documentId).length;
  const expenseItems = followUps.filter((item) => item.expenseId && !item.documentId && !expenseSupportItems.includes(item)).length;
  const projectItems = followUps.filter((item) => item.projectId && !item.expenseId && !item.documentId).length;
  const breakdownParts = [
    expenseSupportItems.length ? countLabel(expenseSupportItems.length, "missing document") : "",
    expenseItems ? countLabel(expenseItems, "expense item") : "",
    documentItems ? countLabel(documentItems, "document item") : "",
    projectItems ? countLabel(projectItems, "project item") : "",
  ].filter(Boolean);
  const breakdownLabel = breakdownParts.length ? breakdownParts.join(" · ") : "Nothing needs review.";
  const followUpLabel = followUps.length
    ? `${followUps.length} item${followUps.length === 1 ? "" : "s"} need review`
    : "Nothing needs review.";

  return {
    breakdownLabel,
    documentItems,
    expenseItems,
    expenseSupportItems,
    followUpLabel,
    followUps,
    markedCompleteProjects,
    missingEvidenceTotal,
    projectItems,
    reviewLaterTotal,
  };
}

function renderRecordsToFinishBody(content, id = "") {
  return `
    <div class="record-gap-body" ${id ? `id="${escapeAttr(id)}"` : ""}>
      <dl class="scenario-breakdown calculator-breakdown">
        ${detailItem("Document items", content.documentItems)}
        ${detailItem("Expense items", content.expenseItems + content.expenseSupportItems.length)}
        ${detailItem("Project items", content.projectItems)}
        ${detailItem("Marked complete with note", content.markedCompleteProjects)}
        ${detailItem("Open follow-ups", content.followUps.length)}
      </dl>
      ${content.missingEvidenceTotal || content.reviewLaterTotal ? `
        <div class="attention-summary-row">
          ${content.missingEvidenceTotal ? `<span>${escapeHtml(`${content.expenseSupportItems.length} ${content.expenseSupportItems.length === 1 ? "expense needs" : "expenses need"} receipt or invoice support`)} · ${escapeHtml(formatCurrency(content.missingEvidenceTotal))}</span>` : ""}
          ${content.reviewLaterTotal ? `<span>Needs-classification amount · ${escapeHtml(formatCurrency(content.reviewLaterTotal))}</span>` : ""}
        </div>
      ` : ""}
      ${renderFollowUpActionTable(content.followUps, "Nothing needs review.")}
    </div>
  `;
}

function getSurfaceFollowUps(surface) {
  return getRecordFollowUpsForSurface(data, surface, { tutorialMode: isTutorialMode() });
}

function getProjectFollowUps(projectId) {
  return getRecordFollowUps(data, { tutorialMode: isTutorialMode() }).filter((item) =>
    item.projectId === projectId &&
    item.surfaces.includes("projects")
  );
}

function getProjectOpenItemsFilterValue(project) {
  if (!project) return "no-open-items";
  return getProjectFollowUps(project.id).length ? "has-open-items" : "no-open-items";
}

function renderFollowUpActionList(items, emptyCopy) {
  if (!items.length) return `<p class="helper-note">${escapeHtml(emptyCopy)}</p>`;
  return `
    <div class="record-fix-list">
      ${items.map((item) => `
        <article class="record-fix-card">
          <div class="record-fix-content">
            <span>${escapeHtml(item.typeLabel || "Follow-up")}</span>
            <h4>${escapeHtml(item.label)}</h4>
            <p>${escapeHtml(item.detail)}</p>
            ${item.primaryAction?.copy ? `<small>${escapeHtml(item.primaryAction.copy)}</small>` : ""}
          </div>
          <button class="button button-secondary record-fix-action" data-action="open-follow-up" data-follow-up-id="${escapeAttr(item.id)}" type="button">${escapeHtml(item.primaryAction?.label || item.label)}</button>
        </article>
      `).join("")}
    </div>
  `;
}

function renderFollowUpActionTable(items, emptyCopy) {
  if (!items.length) return `<p class="helper-note">${escapeHtml(emptyCopy)}</p>`;
  return `
    <div class="table-wrap compact-table-wrap">
      <table class="compact-record-table follow-up-record-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Record</th>
            <th>Issue</th>
            <th class="align-right">Resolve</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td data-label="Type"><span class="pill ${getFollowUpPillTone(item)}">${escapeHtml(item.typeLabel || "Follow-up")}</span></td>
              <td class="record-name-cell" data-label="Record"><strong>${escapeHtml(getFollowUpRecordLabel(item))}</strong></td>
              <td data-label="Issue">${escapeHtml(item.detail || item.primaryAction?.copy || "Review this item.")}</td>
              <td class="align-right" data-label="Resolve">
                <button class="button button-secondary table-action-button" data-action="open-follow-up" data-follow-up-id="${escapeAttr(item.id)}" type="button">${escapeHtml(item.primaryAction?.label || "Resolve")}</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getFollowUpPillTone(item) {
  if (item.documentId || item.type.includes("document")) return "tone-green";
  if (item.expenseId || item.type.startsWith("expense")) return "tone-warn";
  if (item.projectId || item.type.startsWith("project")) return "tone-blue";
  return "";
}

function getUniqueFollowUpExpenses(items) {
  const seenExpenseIds = new Set();
  return items
    .map((item) => data.expenses.find((expense) => expense.id === item.expenseId))
    .filter((expense) => {
      if (!expense || seenExpenseIds.has(expense.id)) return false;
      seenExpenseIds.add(expense.id);
      return true;
    });
}

function getFollowUpItemById(id) {
  if (!id) return null;
  return getRecordFollowUps(data, { tutorialMode: isTutorialMode() }).find((item) => item.id === id) || null;
}

function renderFollowUpResolutionModal() {
  const item = getFollowUpItemById(activeFollowUpItemId);
  if (!item) return "";

  const action = item.primaryAction || {};
  const recordLabel = getFollowUpRecordLabel(item);
  const body = renderFollowUpResolutionBody(item, action);

  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal follow-up-resolution-modal" role="dialog" aria-modal="true" aria-labelledby="follow-up-resolution-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">${escapeHtml(item.typeLabel || "Issue")}</p>
            <h2 id="follow-up-resolution-title">${escapeHtml(item.label)}</h2>
            <p>${escapeHtml(item.detail)}</p>
          </div>
          <button class="icon-button" data-action="close-follow-up-resolution" type="button" aria-label="Close">×</button>
        </div>
        <div class="follow-up-context">
          <div>
            <span>Record</span>
            <strong>${escapeHtml(recordLabel)}</strong>
          </div>
          ${item.propertyId ? `<div><span>Property</span><strong>${escapeHtml(getPropertyName(data, item.propertyId))}</strong></div>` : ""}
          ${item.projectId ? `<div><span>Project</span><strong>${escapeHtml(getProjectName(data, item.projectId))}</strong></div>` : ""}
          ${item.expenseId ? `<div><span>Linked expense</span><strong>${escapeHtml(getFollowUpExpenseLabel(item.expenseId))}</strong></div>` : ""}
          ${item.documentId ? `<div><span>Related document</span><strong>${escapeHtml(getFollowUpDocumentLabel(item.documentId))}</strong></div>` : ""}
        </div>
        <div class="resolution-summary">
          <span>Follow-up</span>
          <strong>${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(getFollowUpResolutionCopy(item, action))}</p>
        </div>
        ${action.copy ? `<p class="helper-note follow-up-helper">${escapeHtml(action.copy)}</p>` : ""}
        ${renderFollowUpOverrideForm(item)}
        ${body}
      </section>
    </div>
  `;
}

function renderFollowUpOverrideForm(item) {
  return `
    <form class="follow-up-override-form" data-form="follow-up-override">
      <input type="hidden" name="id" value="${escapeAttr(item.id)}">
      <label class="checkbox-row">
        <input type="checkbox" name="overrideComplete" value="yes">
        <span>
          <strong>Override and mark complete</strong>
          <small>Use this when the item has been handled outside the app or no longer applies.</small>
        </span>
      </label>
      <label class="field">
        <span>Override note <small>Optional</small></span>
        <textarea name="note" rows="2" placeholder="Example: receipt reviewed outside the app, no further action needed."></textarea>
      </label>
      <div class="form-actions compact-actions">
        <button class="button button-secondary" type="submit">Save override</button>
      </div>
    </form>
  `;
}

function getFollowUpResolutionCopy(item, action) {
  if (item.type === "project-missing-supporting-documents") {
    return "Add the specific missing document record below. Upload the file too if you have it.";
  }
  if (item.type === "document-missing-attached-file" || item.type === "document-restored-without-file-content" || item.type === "document-tutorial-metadata-only") {
    return "Upload the missing file to the existing document record below.";
  }
  if (item.type === "expense-missing-document-support") {
    return "Add the specific receipt or invoice support below. The related expense is already selected.";
  }
  if (item.type === "expense-documented-without-support") {
    return "Upload or link the missing receipt or invoice file below. The related expense is already selected.";
  }
  if (action.action === "add-document" || action.action === "add-document-for-expense") {
    return "Add the document below. The related record is already selected.";
  }
  if (action.action === "edit-expense" || item.type?.startsWith("expense-")) {
    return "Update the highlighted expense field below, then save the expense.";
  }
  if (action.action === "edit-document" || item.documentId) {
    return "Update the highlighted document field below, then save the document.";
  }
  if (action.action === "edit-project" || item.projectId) {
    return "Update the highlighted project field below, then save the project.";
  }
  return "Resolve this item from the related record below.";
}

function renderFollowUpResolutionBody(item, action) {
  if (action.action === "add-document" || action.action === "add-document-for-expense") {
    return renderDocumentForm(null, {
      expenseId: action.expenseId || item.expenseId || "",
      highlightField: "file",
      projectId: action.projectId || item.projectId || "",
    });
  }

  if (action.action === "edit-expense" || item.type?.startsWith("expense-")) {
    const expense = data.expenses.find((currentExpense) => currentExpense.id === (action.id || item.expenseId));
    if (!expense) return renderMissingFollowUpRecord("This expense is no longer available.");
    return renderExpenseForm(expense, { highlightField: getExpenseFollowUpHighlightField(item) });
  }

  if (action.action === "edit-document" || item.documentId) {
    const documentRecord = data.documents.find((document) => document.id === (action.id || item.documentId));
    if (!documentRecord) return renderMissingFollowUpRecord("This document is no longer available.");
    return renderDocumentForm(documentRecord, { highlightField: item.type === "record-placeholder-content" ? action.field || "displayName" : "file" });
  }

  if (action.action === "edit-project" || item.projectId) {
    const project = data.projects.find((currentProject) => currentProject.id === (action.id || item.projectId));
    if (!project) return renderMissingFollowUpRecord("This project is no longer available.");
    return renderProjectForm(project, { highlightFields: getProjectFollowUpHighlightFields(item) });
  }

  return `
    <div class="empty-state compact">
      <p>Open the related section to resolve this item.</p>
      <button class="button button-primary" ${followUpDestinationAttributes(item)} type="button">Open section</button>
    </div>
  `;
}

function getExpenseFollowUpHighlightField(item) {
  if (item.type === "record-placeholder-content") return item.primaryAction?.field || "";
  if (item.type === "expense-review-treatment") return "classification";
  if (item.type === "expense-missing-vendor") return "vendorId";
  if (item.type?.includes("document")) return "documentationStatus";
  return "";
}

function getProjectFollowUpHighlightFields(item) {
  if (item.type === "record-placeholder-content" && item.primaryAction?.field) return [item.primaryAction.field];
  if (item.type === "project-missing-vendor") return ["vendorId"];
  if (item.type === "project-missing-dates") return ["startDate", "completionDate"];
  if (item.type === "project-missing-scope") return ["scopeSummary"];
  if (item.type === "project-missing-supporting-documents") return ["permitNumber"];
  return [];
}

function renderMissingFollowUpRecord(message) {
  return `
    <div class="empty-state compact">
      <p>${escapeHtml(message)}</p>
      <button class="button button-secondary" data-action="close-follow-up-resolution" type="button">Close</button>
    </div>
  `;
}

function followUpDestinationAttributes(item) {
  const action = item.primaryAction || {};
  const attrs = [
    ["data-action", action.action || ""],
    ["data-id", action.id || ""],
    ["data-field", action.field || ""],
    ["data-project-id", action.projectId || item.projectId],
    ["data-expense-id", action.expenseId || item.expenseId],
    ["data-document-id", action.documentId || item.documentId],
  ].filter(([, value]) => value);
  return attrs.map(([name, value]) => `${name}="${escapeAttr(value)}"`).join(" ");
}

function getFollowUpRecordLabel(item) {
  if (item.expenseId) {
    const expense = data.expenses.find((currentExpense) => currentExpense.id === item.expenseId);
    if (expense) return `${getExpenseVendorName(data, expense)} / ${expense.description}`;
  }
  if (item.documentId) {
    return data.documents.find((document) => document.id === item.documentId)?.displayName || "Document";
  }
  if (item.projectId) {
    return data.projects.find((project) => project.id === item.projectId)?.name || "Project";
  }
  if (item.propertyId) {
    return data.properties.find((property) => property.id === item.propertyId)?.name || "Property";
  }
  return "Record";
}

function getFollowUpExpenseLabel(expenseId) {
  const expense = data.expenses.find((currentExpense) => currentExpense.id === expenseId);
  return expense ? `${getExpenseVendorName(data, expense)} / ${expense.description}` : "Expense";
}

function getFollowUpDocumentLabel(documentId) {
  return data.documents.find((document) => document.id === documentId)?.displayName || "Document";
}

function getSelectedCalculatorPropertySummary(propertySummaries) {
  const selectedId = propertySummaries.some((summary) => summary.property.id === calculatorBasisPropertyId)
    ? calculatorBasisPropertyId
    : selectedPropertyId && propertySummaries.some((summary) => summary.property.id === selectedPropertyId)
      ? selectedPropertyId
      : propertySummaries[0]?.property.id || "";
  return propertySummaries.find((summary) => summary.property.id === selectedId) || propertySummaries[0];
}

function renderNextActionsPanel(readiness) {
  const actions = [
    data.properties.length ? "" : "Add your first property.",
    data.projects.length ? "" : "Add an improvement project.",
    data.expenses.length ? "" : "Record an expense or receipt.",
    data.documents.length ? "" : "Attach a receipt, permit, invoice, photo, or contract.",
    readiness.followUps[0] || "",
  ].filter(Boolean).slice(0, 4);

  return `
    <section class="panel next-actions-panel">
          ${renderPanelHeader("Next suggested actions", "Small steps that make the binder easier to check when needed.", "clipboard")}
      ${actions.length ? `
        <div class="safety-list action-list">
          ${actions.map((item) => `
            <div>
              <strong>${escapeHtml(item)}</strong>
              <span>Keep the entry simple now; you can add supporting details later.</span>
            </div>
          `).join("")}
        </div>
      ` : renderEmpty("No immediate suggestions", "Your core details are in good shape. Keep adding receipts, project notes, and supporting documents as you collect them.")}
    </section>
  `;
}

function renderPropertyDashboardCards(propertySummaries) {
  return `
    <section class="panel dashboard-properties-panel">
      ${renderPanelHeader("Properties", "", "home", dashboardTabLink("View all", "property", "View all properties"))}
      <div class="table-wrap compact-table-wrap">
        <table class="compact-record-table dashboard-property-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Activity</th>
              <th class="align-right">Total spend</th>
              <th class="align-right">Open</th>
            </tr>
          </thead>
          <tbody>
            ${propertySummaries.map((summary) => `
              <tr>
                <td class="record-name-cell" data-label="Property">
                  ${dashboardTabLink(summary.property.name, "property", `View property ${summary.property.name}`, "table-link dashboard-object-link", { propertyId: summary.property.id })}
                </td>
                <td data-label="Activity">
                  <div class="dashboard-inline-links">
                    ${dashboardTabLink(countLabel(summary.projects.length, "project"), "projects", `View projects for ${summary.property.name}`, "dashboard-inline-link", { propertyId: summary.property.id })}
                    <span aria-hidden="true">·</span>
                    ${dashboardTabLink(countLabel(summary.expenses.length, "expense"), "expenses", `View expenses for ${summary.property.name}`, "dashboard-inline-link", { propertyId: summary.property.id })}
                    <span aria-hidden="true">·</span>
                    ${dashboardTabLink(countLabel(summary.documents.length, "document"), "documents", `View documents for ${summary.property.name}`, "dashboard-inline-link", { propertyId: summary.property.id })}
                  </div>
                </td>
                <td class="align-right" data-label="Total spend">
                  ${dashboardTabLink(formatCurrency(summary.totals.total), "expenses", `View expenses for ${summary.property.name}`, "money dashboard-money-link", { propertyId: summary.property.id, sort: "amount-desc" })}
                </td>
                <td class="align-right" data-label="Open">
                  ${dashboardTabLink("Open →", "property", `Open ${summary.property.name}`, "dashboard-open-link", { propertyId: summary.property.id })}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDashboardProjectGroups(projects) {
  const activeProjects = projects.filter((project) => !isInactiveProject(project));
  const inactiveProjects = projects.filter(isInactiveProject);

  if (!projects.length) {
    return renderEmpty("No projects yet", "Add projects to group related expenses.");
  }

  return `
    <div class="dashboard-project-groups">
      <section class="dashboard-project-section">
        <div class="section-title-row">
          <h3>Active projects</h3>
          <span>${activeProjects.length}</span>
        </div>
        ${activeProjects.length
          ? `<div class="project-spend-list">${activeProjects.map((project) => renderProjectSpendRow(project)).join("")}</div>`
          : `<p class="helper-note">No active projects for this property.</p>`}
      </section>
      ${inactiveProjects.length ? `
        <details class="dashboard-project-section dashboard-inactive-projects">
          <summary>
            <span>Inactive projects</span>
            <small>${inactiveProjects.length}</small>
          </summary>
          <div class="project-spend-list">
            ${inactiveProjects.map((project) => renderProjectSpendRow(project)).join("")}
          </div>
        </details>
      ` : ""}
    </div>
  `;
}

function isInactiveProject(project) {
  return ["completed", "archived"].includes(project.status);
}

function renderProjectSpendRow(project) {
  const projectExpenses = data.expenses.filter((expense) => expense.projectId === project.id);
  const totals = getExpenseTotals(projectExpenses);

  return `
    <div class="project-spend-row">
      <div>
        <button class="table-link dashboard-project-link" data-action="open-project" data-id="${escapeAttr(project.id)}" type="button">${escapeHtml(project.name)}</button>
        <span>${escapeHtml(optionLabel(PROJECT_STATUSES, project.status))} · ${escapeHtml(optionLabel(EXPENSE_CATEGORIES, project.category))} · ${projectExpenses.length} expense${projectExpenses.length === 1 ? "" : "s"}</span>
      </div>
      <strong class="money">${formatCurrency(totals.total)}</strong>
    </div>
  `;
}

function renderWorkspaceControls() {
  return "";
}

function renderSidebarFooter() {
  return `
    <div class="sidebar-footer">
      <button
        aria-current="${activeTab === "settings" ? "page" : "false"}"
        class="settings-nav-button ${activeTab === "settings" ? "is-active" : ""}"
        data-action="open-settings"
        type="button"
      >
        <span aria-hidden="true">⚙</span>
        Settings
      </button>
    </div>
  `;
}

function renderTutorialModeBanner() {
  if (!isTutorialMode()) return "";
  const guideButton = activeTab === "tutorial"
    ? ""
    : `<button class="button button-secondary" data-action="open-tutorial-step" data-tutorial-tab="tutorial" type="button">View guide</button>`;

  return `
    <section class="tutorial-banner print-hidden">
      <div>
        <h2>Tutorial Workspace</h2>
        <p>Sample items only. Your real home file is preserved while you explore.</p>
      </div>
      <div class="tutorial-banner-actions">
        ${guideButton}
        <button class="button button-secondary" data-action="reset-tutorial" type="button">Reset tutorial</button>
        <button class="button button-primary" data-action="exit-tutorial" type="button">Exit tutorial</button>
      </div>
    </section>
  `;
}

function renderTutorialView() {
  const intro = isTutorialMode()
    ? ""
    : renderPageIntro({
      title: "Learn the app with sample items",
      actions: `<button class="button button-primary" data-action="start-tutorial" type="button">Start tutorial workspace</button>`,
    });

  return `
    <div class="page-stack">
      ${intro}
      ${renderNotice(isTutorialMode()
        ? "You are using the tutorial workspace. Reset restores the original sample items; exit returns to your real home file."
        : "Open a separate sample workspace. Your real home file stays unchanged.", "tutorial-notice")}
      ${renderMetrics([
        ["Sample properties", String(tutorialData.properties.length), ""],
        ["Sample projects", String(tutorialData.projects.length), "blue"],
        ["Sample expenses", String(tutorialData.expenses.length), "green"],
        ["Sample documents", String(tutorialData.documents.length), "amber"],
        ["Storage impact", isTutorialMode() ? "Temporary" : "None", "rust"],
      ])}
      <section class="panel">
        ${renderPanelHeader("Guided workflow", "", "clipboard")}
        <div class="tutorial-step-grid">
          ${TUTORIAL_STEPS.map((step, index) => `
            <article class="tutorial-step-card">
              <span>${index + 1}</span>
              <div>
                <h3>${escapeHtml(step.title)}</h3>
                <p>${escapeHtml(step.summary)}</p>
              </div>
              <button class="button button-secondary" data-action="open-tutorial-step" data-tutorial-tab="${escapeAttr(step.tab)}" type="button">Open</button>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="panel">
        ${renderPanelHeader("How separation works", "Sample data stays separate from your real home file.", "home")}
        <div class="safety-list">
          <div>
            <strong>Your binder starts empty</strong>
            <span>Sample items appear only after you open the tutorial.</span>
          </div>
          <div>
            <strong>Edits are temporary</strong>
            <span>Add, edit, and delete sample items freely. Reset brings the tutorial back to its starting state.</span>
          </div>
          <div>
            <strong>Files are simulated</strong>
            <span>Choosing a file in tutorial mode saves sample file details only.</span>
          </div>
          <div>
            <strong>Backups stay scoped</strong>
            <span>Tutorial backups contain sample items. Restores while in tutorial replace only the tutorial workspace.</span>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderSettingsView() {
  const primaryProperty = data.properties.find((property) => property.isPrimary) || data.properties[0] || null;

  return `
    <div class="page-stack">
      ${renderPageIntro({ title: "Settings" })}
      <div class="settings-grid">
        <section class="panel settings-section">
          ${renderPanelHeader("Workspace", "", "home")}
          <label class="field">
            <span>Default property</span>
            <select data-setting="primaryPropertyId" ${data.properties.length ? "" : "disabled"}>
              ${data.properties.length
                ? data.properties.map((property) => optionHtml(property.id, property.name, primaryProperty?.id || "")).join("")
                : optionHtml("", "Add a property first", "")}
            </select>
            <small>This property is used as the default context for filters and new records.</small>
          </label>
        </section>

        <section class="panel settings-section">
          ${renderPanelHeader("Appearance", "", "settings")}
          <label class="field">
            <span>Theme</span>
            <select data-setting="themePreference">
              ${optionHtml("system", "System", themePreference)}
              ${optionHtml("light", "Light", themePreference)}
              ${optionHtml("dark", "Dark", themePreference)}
            </select>
            <small>System follows your computer's appearance setting.</small>
          </label>
        </section>
      </div>
    </div>
  `;
}

function renderPropertyView() {
  const selectedProperty = data.properties.find((property) => property.id === selectedPropertyId);
  const propertyProjects = data.projects.filter((project) => project.propertyId === selectedPropertyId);
  const propertyExpenses = data.expenses.filter((expense) => expense.propertyId === selectedPropertyId);
  const propertyDocuments = data.documents.filter((document) => document.propertyId === selectedPropertyId);

  return `
    <div class="page-stack">
      ${renderPageIntro({
        title: "Property details",
        actions: `
          <button class="button button-primary" data-action="add-property" type="button"><span aria-hidden="true">+</span>Add property</button>
        `,
      })}
      <section class="panel property-file-panel">
        ${renderPanelHeader("Property file", "", "home")}
        ${data.properties.length ? `
          <div class="property-file-toolbar">
            <label class="field">
              <span>Property</span>
              <select data-filter="selectedPropertyId">
                ${data.properties.map((property) => optionHtml(property.id, property.name, selectedPropertyId)).join("")}
              </select>
            </label>
          </div>
          ${selectedProperty ? renderPropertyFileOverview(selectedProperty, propertyProjects, propertyExpenses, propertyDocuments) : ""}
        ` : renderEmpty("No property yet", "Start with the home these projects, costs, and files belong to.", renderInlineAction("Add your property", "add-property"))}
      </section>
      ${propertyMode === "view" ? "" : renderPropertyFormModal(propertyMode === "edit" ? selectedProperty : null)}
    </div>
  `;
}

function renderPropertyFileOverview(property, projects, expenses, documents) {
  const totals = getExpenseTotals(expenses);
  const followUps = getSurfaceFollowUps("dashboard")
    .filter((item) => item.propertyId === property.id)
    .slice(0, 4);
  const recentExpenses = sortByDateDesc(expenses).slice(0, 4);

  return `
    <div class="property-file-overview">
      <div class="property-file-heading">
        <div class="summary-title-row">
          ${renderEditablePropertyField(property, "name", "Property name", property.name)}
        </div>
      </div>
      <dl class="detail-list property-detail-list">
        ${renderEditablePropertyField(property, "address", "Address", property.address || "Not added")}
        ${renderEditablePropertyField(property, "purchaseDate", "Purchase date", formatDate(property.purchaseDate))}
        ${renderEditablePropertyField(property, "purchasePrice", "Purchase price", property.purchasePrice ? formatCurrency(property.purchasePrice) : "Not added")}
      </dl>
      <div class="property-action-bar">
        <div class="record-action-row">
          <button class="button button-secondary" data-action="add-project" data-property-id="${escapeAttr(property.id)}" type="button"><span aria-hidden="true">+</span>Add project</button>
          <button class="button button-secondary" data-action="add-expense" type="button"><span aria-hidden="true">+</span>Add expense</button>
          <button class="button button-secondary" data-action="add-document" type="button"><span aria-hidden="true">+</span>Add document</button>
        </div>
        <button class="button button-danger" data-action="delete-property" data-id="${escapeAttr(property.id)}" type="button">Delete property</button>
      </div>
      <div class="property-file-grid">
        ${storageMetric("Tracked spend", formatCurrency(totals.total))}
        ${storageMetric("Possible improvements", formatCurrency(totals.potential))}
        ${storageMetric("Projects", projects.length)}
        ${storageMetric("Documents", documents.length)}
      </div>
      <div class="property-file-sections">
        <div class="property-projects-section">
          <div class="section-title-row">
            <h3>Projects</h3>
            <span>${projects.length} total</span>
          </div>
          ${projects.length ? renderPropertyProjectList(projects) : renderEmpty("No projects yet", "Add projects to group related work.")}
        </div>
        <div>
          <h3>Recent expenses</h3>
          ${recentExpenses.length ? renderPropertyRecentExpensesTable(recentExpenses) : renderEmpty("No expenses yet", "Add costs as receipts or notes arrive.")}
        </div>
        <div>
          <h3>Items to finish</h3>
          ${followUps.length ? renderPropertyFollowUpTable(followUps) : `<p class="helper-note">No items to finish for this property.</p>`}
        </div>
      </div>
      ${property.notes ? renderEditablePropertyField(property, "notes", "Notes", property.notes) : ""}
    </div>
  `;
}

function renderPropertyFollowUpTable(items) {
  return `
    <div class="table-wrap compact-table-wrap">
      <table class="compact-record-table property-followup-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="align-right">Resolve</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td class="record-name-cell" data-label="Item">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(item.detail)}</span>
              </td>
              <td class="align-right" data-label="Resolve">
                <button class="button button-secondary table-action-button" data-action="open-follow-up" data-follow-up-id="${escapeAttr(item.id)}" type="button">${escapeHtml(item.primaryAction?.label || "Resolve")}</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPropertyProjectList(projects) {
  return `
    <div class="table-wrap compact-table-wrap">
      <table class="compact-record-table property-project-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Status</th>
            <th>Vendor</th>
            <th class="align-right">Spend</th>
            <th class="align-right">Docs</th>
          </tr>
        </thead>
        <tbody>
          ${projects.map((project) => {
            const projectExpenses = data.expenses.filter((expense) => expense.projectId === project.id);
            const projectDocuments = data.documents.filter((document) => document.projectId === project.id);
            const totals = getExpenseTotals(projectExpenses);
            return `
              <tr>
                <td class="record-name-cell" data-label="Project">
                  <button class="table-link" data-action="view-property-project" data-id="${escapeAttr(project.id)}" type="button">${escapeHtml(project.name)}</button>
                </td>
                <td data-label="Status">${escapeHtml(optionLabel(PROJECT_STATUSES, project.status))}</td>
                <td data-label="Vendor">${escapeHtml(getProjectVendorName(data, project))}</td>
                <td class="align-right" data-label="Spend"><strong class="money">${formatCurrency(totals.total)}</strong></td>
                <td class="align-right" data-label="Docs">${projectDocuments.length}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPropertyRecentExpensesTable(expenses) {
  return `
    <div class="table-wrap compact-table-wrap">
      <table class="compact-record-table property-expense-table">
        <thead>
          <tr>
            <th>Expense</th>
            <th class="align-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map((expense) => `
            <tr>
              <td class="record-name-cell" data-label="Expense">
                <strong>${escapeHtml(getExpenseVendorName(data, expense))}</strong>
                <span>${formatDate(expense.date)} / ${escapeHtml(expense.description)}</span>
              </td>
              <td class="align-right" data-label="Amount"><strong class="money">${formatCurrency(expense.amount)}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPropertyProjectPreviewModal() {
  const project = propertyProjectPreviewId ? data.projects.find((currentProject) => currentProject.id === propertyProjectPreviewId) : null;
  if (!project) return "";

  const projectExpenses = sortByDateDesc(data.expenses.filter((expense) => expense.projectId === project.id));
  const projectDocuments = sortDocumentsByAddedDateDesc(data.documents.filter((document) => document.projectId === project.id));
  const totals = getExpenseTotals(projectExpenses);
  const completeness = getProjectTabCompleteness(getProjectCompleteness(data, project));
  const projectFollowUps = getProjectFollowUps(project.id);

  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal project-preview-modal" role="dialog" aria-modal="true" aria-labelledby="property-project-preview-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Project file</p>
            <h2 id="property-project-preview-title">${escapeHtml(project.name)}</h2>
            <p>${escapeHtml(getPropertyName(data, project.propertyId))}</p>
          </div>
          <button class="icon-button" data-action="close-property-project-preview" type="button" aria-label="Close">×</button>
        </div>
        <div class="project-preview-actions">
          <button class="button button-secondary" data-action="edit-project" data-id="${escapeAttr(project.id)}" type="button">Edit project details</button>
          <button class="button button-secondary" data-action="add-expense" data-project-id="${escapeAttr(project.id)}" type="button"><span aria-hidden="true">+</span>Add expense</button>
          <button class="button button-primary" data-action="add-document" data-project-id="${escapeAttr(project.id)}" type="button"><span aria-hidden="true">+</span>Add document</button>
        </div>
        <div class="property-file-grid project-preview-metrics">
          ${storageMetric("Status", optionLabel(PROJECT_STATUSES, project.status))}
          ${storageMetric("Category", optionLabel(EXPENSE_CATEGORIES, project.category))}
          ${storageMetric("Dates", formatProjectDateRange(project))}
          ${storageMetric("Vendor", getProjectVendorName(data, project))}
          ${storageMetric("Expenses", `${projectExpenses.length} / ${formatCurrency(totals.total)}`)}
          ${storageMetric("Documents", projectDocuments.length)}
          ${storageMetric("Items to finish", getProjectRecordStatusLabel(project, projectFollowUps, completeness))}
          ${storageMetric("Permit", project.permitNumber || "Not added")}
        </div>
        <div class="project-preview-grid">
          <section>
            <h3>Project notes</h3>
            <dl class="detail-list">
              ${detailItem("Description", project.scopeSummary || "Not added")}
              ${detailItem("Notes", project.notes || "Not added")}
              ${project.completenessOverrideNote ? detailItem("Marked complete with note", project.completenessOverrideNote) : ""}
            </dl>
            ${renderProjectOverrideHistory(project.id)}
          </section>
          <section>
            <h3>Linked documents</h3>
            ${projectDocuments.length ? renderDocumentList(projectDocuments, { compactActions: true }) : renderEmpty("No project documents yet", "Add receipts, permits, photos, or notes for this project.")}
          </section>
          <section>
            <h3>Linked expenses</h3>
            ${projectExpenses.length ? renderRecentExpenseTable(projectExpenses.slice(0, 5)) : renderEmpty("No linked expenses yet", "Add an expense and connect it to this project.")}
          </section>
        </div>
      </section>
    </div>
  `;
}

function renderProjectsView() {
  let projectFilterOptions = getProjectFilterOptions();
  normalizeChoiceFilter(projectFilters, "propertyId", projectFilterOptions.properties);
  normalizeChoiceFilter(projectFilters, "status", projectFilterOptions.statuses);
  normalizeChoiceFilter(projectFilters, "category", projectFilterOptions.categories);
  normalizeChoiceFilter(projectFilters, "openItems", projectFilterOptions.openItems);
  projectFilterOptions = getProjectFilterOptions();
  const filteredProjects = getFilteredProjects();
  const hasActiveFilters = hasActiveProjectFilters();
  const hasProjectsForCurrentFilters = data.projects.some((project) => {
    if (projectFilters.propertyId !== EMPTY_FILTER && project.propertyId !== projectFilters.propertyId) return false;
    return true;
  });
  const selectedFilterProperty = projectFilters.propertyId !== EMPTY_FILTER
    ? data.properties.find((property) => property.id === projectFilters.propertyId)
    : null;

  return `
    <div class="page-stack">
      ${renderPageIntro({
        title: "Renovation and improvement projects",
        actions: `
          <button class="button button-secondary" data-action="manage-vendors" type="button">Manage vendors</button>
          ${data.properties.length
            ? `<button class="button button-primary" data-action="add-project" type="button"><span aria-hidden="true">+</span>Add project</button>`
            : renderDisabledAction("Add project", "Add a property first.")}
        `,
      })}
      ${data.properties.length ? "" : renderEmpty("No property yet", "Projects need a property so totals and exports stay organized.", renderInlineAction("Add your property", "add-property"))}
      <section class="panel">
        ${renderPanelHeader("Project list", "", "folder")}
        ${renderFilterPanel(`
          ${renderFilter("Property", "project.propertyId", projectFilters.propertyId, projectFilterOptions.properties)}
          ${renderFilter("Status", "project.status", projectFilters.status, projectFilterOptions.statuses)}
          ${renderFilter("Category", "project.category", projectFilters.category, projectFilterOptions.categories)}
          ${renderFilter("Open follow-ups", "project.openItems", projectFilters.openItems, projectFilterOptions.openItems)}
          ${renderProjectDateFilterCluster()}
        `, { count: data.projects.length, hasActiveFilters, clearAction: "clear-project-filters", className: "project-filters" })}
        <div class="results-body project-results-body">
          ${filteredProjects.length
            ? renderProjectsTable(filteredProjects)
            : hasActiveFilters && hasProjectsForCurrentFilters
              ? renderEmpty("No matching projects", "Clear filters to return to your full project list.", renderInlineAction("Clear filters", "clear-project-filters", "button-secondary"))
              : selectedFilterProperty && !hasProjectsForCurrentFilters
                ? renderEmpty("No projects for selected property", `Add a project for ${selectedFilterProperty.name}, or clear filters to see all projects.`, `${renderInlineAction("Add project", "add-project", "button-primary", { propertyId: selectedFilterProperty.id })}${renderInlineAction("Clear filters", "clear-project-filters", "button-secondary")}`)
              : data.properties.length
                ? renderEmpty("No projects yet", "Add your first project when you are ready to group related work.", renderInlineAction("Add project", "add-project"))
                : renderEmpty("No property yet", "Add a property before creating projects.", renderInlineAction("Add your property", "add-property"))}
        </div>
      </section>
    </div>
  `;
}

function renderVendorManagerModal() {
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal vendor-manager-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-manager-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Vendor setup</p>
            <h2 id="vendor-manager-title">Manage vendors</h2>
            <p>Set up contractors, stores, agencies, and payees once, then link them to projects and expenses.</p>
          </div>
          <button class="icon-button" data-action="close-vendor-manager" type="button" aria-label="Close">×</button>
        </div>
        ${renderVendorRegistryContent()}
      </section>
    </div>
  `;
}

function renderVendorRegistryContent() {
  const activeVendors = [...data.vendors].sort((a, b) => a.name.localeCompare(b.name));
  return `
    <div class="vendor-manager-body">
      <div class="vendor-manager-toolbar">
        <div>
          <h3>Vendor list</h3>
          <p>${activeVendors.length} vendor${activeVendors.length === 1 ? "" : "s"} available for projects and expenses.</p>
        </div>
        <button class="button button-secondary" data-action="add-vendor" type="button"><span aria-hidden="true">+</span>Add vendor</button>
      </div>
      ${activeVendors.length ? `
        <div class="vendor-card-list">
          ${activeVendors.map((vendor) => {
            const projectCount = data.projects.filter((project) => project.vendorId === vendor.id).length;
            const expenseCount = data.expenses.filter((expense) => expense.vendorId === vendor.id).length;
            const totalSpend = getExpenseTotals(data.expenses.filter((expense) => expense.vendorId === vendor.id)).total;
            return `
              <article class="vendor-card ${vendor.status === "archived" ? "is-archived" : ""}">
                <div>
                  <h3>${escapeHtml(vendor.name)}</h3>
                  <p>${escapeHtml(optionLabel(EXPENSE_CATEGORIES, vendor.category))}${vendor.contactName ? ` / ${escapeHtml(vendor.contactName)}` : ""}</p>
                </div>
                <div class="vendor-card-meta">
                  <span>${projectCount} project${projectCount === 1 ? "" : "s"}</span>
                  <span>${expenseCount} expense${expenseCount === 1 ? "" : "s"}</span>
                  <strong>${formatCurrency(totalSpend)}</strong>
                  <span class="pill ${vendor.status === "archived" ? "tone-warn" : "tone-green"}">${escapeHtml(optionLabel(VENDOR_STATUSES, vendor.status))}</span>
                </div>
                <button class="icon-button" data-action="edit-vendor" data-id="${escapeAttr(vendor.id)}" type="button" aria-label="Edit ${escapeAttr(vendor.name)}">✎</button>
              </article>
            `;
          }).join("")}
        </div>
      ` : renderEmpty("No vendors yet", "Add a vendor before linking new projects and expenses. Existing payee text will be migrated automatically when present.")}
    </div>
  `;
}

function getFilteredProjects() {
  return data.projects.filter((project) => {
    if (projectFilters.propertyId !== EMPTY_FILTER && project.propertyId !== projectFilters.propertyId) return false;
    if (projectFilters.status !== EMPTY_FILTER && project.status !== projectFilters.status) return false;
    if (projectFilters.category !== EMPTY_FILTER && project.category !== projectFilters.category) return false;
    if (projectFilters.openItems !== EMPTY_FILTER && getProjectOpenItemsFilterValue(project) !== projectFilters.openItems) return false;
    if (!dateWithinRange(project.startDate, projectFilters.startDateFrom, projectFilters.startDateTo)) return false;
    if (!dateWithinRange(project.completionDate, projectFilters.completionDateFrom, projectFilters.completionDateTo)) return false;
    return true;
  });
}

const PROJECT_DEPENDENT_FILTERS = [
  { key: "propertyId", match: (project, value) => project.propertyId === value },
  { key: "status", match: (project, value) => project.status === value },
  { key: "category", match: (project, value) => project.category === value },
  { key: "openItems", match: (project, value) => getProjectOpenItemsFilterValue(project) === value },
  { key: "startDateFrom", match: (project, value) => dateWithinRange(project.startDate, value, "") },
  { key: "startDateTo", match: (project, value) => dateWithinRange(project.startDate, "", value) },
  { key: "completionDateFrom", match: (project, value) => dateWithinRange(project.completionDate, value, "") },
  { key: "completionDateTo", match: (project, value) => dateWithinRange(project.completionDate, "", value) },
];

const PROJECT_OPEN_ITEM_FILTER_OPTIONS = [
  { value: "has-open-items", label: "Has open follow-ups" },
  { value: "no-open-items", label: "No open follow-ups" },
];

const EXPENSE_DEPENDENT_FILTERS = [
  { key: "propertyId", match: (expense, value) => expense.propertyId === value },
  { key: "projectId", match: (expense, value) => expense.projectId === value },
  { key: "classification", match: (expense, value) => expense.classification === value },
  { key: "category", match: (expense, value) => expense.category === value },
  { key: "documentationStatus", match: (expense, value) => expense.documentationStatus === value },
];

const DOCUMENT_DEPENDENT_FILTERS = [
  { key: "propertyId", match: (document, value) => document.propertyId === value },
  { key: "documentType", match: (document, value) => document.documentType === value },
  { key: "fileStatus", match: (document, value) => getDocumentFileStatus(document) === value },
];

function getProjectFilterOptions() {
  return {
    properties: getDependentFilterOptions(data.projects, projectFilters, PROJECT_DEPENDENT_FILTERS, "propertyId", getPropertyFilterOptions(), (project) => project.propertyId),
    statuses: getDependentFilterOptions(data.projects, projectFilters, PROJECT_DEPENDENT_FILTERS, "status", PROJECT_STATUSES, (project) => project.status),
    categories: getDependentFilterOptions(data.projects, projectFilters, PROJECT_DEPENDENT_FILTERS, "category", EXPENSE_CATEGORIES, (project) => project.category),
    openItems: getDependentFilterOptions(data.projects, projectFilters, PROJECT_DEPENDENT_FILTERS, "openItems", PROJECT_OPEN_ITEM_FILTER_OPTIONS, getProjectOpenItemsFilterValue),
  };
}

function getExpenseFilterOptions() {
  return {
    properties: getDependentFilterOptions(data.expenses, expenseFilters, EXPENSE_DEPENDENT_FILTERS, "propertyId", getPropertyFilterOptions(), (expense) => expense.propertyId),
    projects: getDependentFilterOptions(data.expenses, expenseFilters, EXPENSE_DEPENDENT_FILTERS, "projectId", getProjectFilterOptionsForExpenses(), (expense) => expense.projectId),
    classifications: getDependentFilterOptions(data.expenses, expenseFilters, EXPENSE_DEPENDENT_FILTERS, "classification", CLASSIFICATIONS, (expense) => expense.classification),
    categories: getDependentFilterOptions(data.expenses, expenseFilters, EXPENSE_DEPENDENT_FILTERS, "category", EXPENSE_CATEGORIES, (expense) => expense.category),
    documentationStatuses: getDependentFilterOptions(data.expenses, expenseFilters, EXPENSE_DEPENDENT_FILTERS, "documentationStatus", DOCUMENT_STATUSES, (expense) => expense.documentationStatus),
  };
}

function getDocumentFilterOptions(records = data.documents, filters = documentFilters) {
  return {
    properties: getDependentFilterOptions(records, filters, DOCUMENT_DEPENDENT_FILTERS, "propertyId", getPropertyFilterOptions(), (document) => document.propertyId),
    documentTypes: getDependentFilterOptions(records, filters, DOCUMENT_DEPENDENT_FILTERS, "documentType", DOCUMENT_TYPES, (document) => document.documentType),
    fileStatuses: getDependentFilterOptions(records, filters, DOCUMENT_DEPENDENT_FILTERS, "fileStatus", DOCUMENT_FILE_FILTERS, (document) => getDocumentFileStatus(document)),
  };
}

function getDependentFilterOptions(records, filters, descriptors, targetKey, baseOptions, getRecordValue) {
  const matchingRecords = records.filter((record) => matchesDependentFilters(record, filters, descriptors, targetKey));
  const availableValues = new Set(matchingRecords.map(getRecordValue).filter(Boolean));
  return baseOptions.filter((option) => availableValues.has(option.value));
}

function matchesDependentFilters(record, filters, descriptors, excludeKey = "") {
  return descriptors.every((descriptor) => {
    if (descriptor.key === excludeKey) return true;
    const value = filters[descriptor.key];
    if (!value || value === EMPTY_FILTER) return true;
    return descriptor.match(record, value);
  });
}

function getPropertyFilterOptions() {
  return data.properties.map((property) => ({ value: property.id, label: property.name }));
}

function getProjectFilterOptionsForExpenses() {
  return data.projects.map((project) => ({ value: project.id, label: project.name }));
}

function normalizeChoiceFilter(filters, key, options) {
  if (filters[key] !== EMPTY_FILTER && !options.some((option) => option.value === filters[key])) {
    filters[key] = EMPTY_FILTER;
  }
}

function dateWithinRange(value, from, to) {
  if (from && (!value || value < from)) return false;
  if (to && (!value || value > to)) return false;
  return true;
}

function renderExpensesView() {
  let expenseFilterOptions = getExpenseFilterOptions();
  normalizeChoiceFilter(expenseFilters, "propertyId", expenseFilterOptions.properties);
  normalizeChoiceFilter(expenseFilters, "projectId", expenseFilterOptions.projects);
  normalizeChoiceFilter(expenseFilters, "classification", expenseFilterOptions.classifications);
  normalizeChoiceFilter(expenseFilters, "category", expenseFilterOptions.categories);
  normalizeChoiceFilter(expenseFilters, "documentationStatus", expenseFilterOptions.documentationStatuses);
  expenseFilterOptions = getExpenseFilterOptions();
  const filteredExpenses = data.expenses
    .filter((expense) => {
      if (expenseFilters.propertyId !== EMPTY_FILTER && expense.propertyId !== expenseFilters.propertyId) return false;
      if (expenseFilters.projectId !== EMPTY_FILTER && expense.projectId !== expenseFilters.projectId) return false;
      if (expenseFilters.classification !== EMPTY_FILTER && expense.classification !== expenseFilters.classification) return false;
      if (expenseFilters.category !== EMPTY_FILTER && expense.category !== expenseFilters.category) return false;
      if (expenseFilters.documentationStatus !== EMPTY_FILTER && expense.documentationStatus !== expenseFilters.documentationStatus) return false;
      return true;
    })
    .sort((a, b) => {
      if (expenseFilters.sort === "date-asc") return String(a.date).localeCompare(String(b.date));
      if (expenseFilters.sort === "amount-desc") return parseAmount(b.amount) - parseAmount(a.amount);
      if (expenseFilters.sort === "amount-asc") return parseAmount(a.amount) - parseAmount(b.amount);
      return String(b.date).localeCompare(String(a.date));
    });
  const totals = getExpenseTotals(filteredExpenses);
  const hasActiveFilters = hasActiveExpenseFilters();
  return `
    <div class="page-stack">
      ${renderPageIntro({
        title: "Expenses",
        actions: data.properties.length
          ? `<button class="button button-primary" data-action="add-expense" type="button"><span aria-hidden="true">+</span>Add expense</button>`
          : renderDisabledAction("Add expense", "Add a property first."),
      })}
      ${data.properties.length ? "" : renderEmpty("No property yet", "Expenses need a property so totals and exports stay organized.", renderInlineAction("Add your property", "add-property"))}
      ${renderMetrics([
        ["Filtered total", formatCurrency(totals.total), ""],
        ["Possible improvements", formatCurrency(totals.potential), "green"],
        ["Repair or upkeep", formatCurrency(totals.repair), "rust"],
        ["Needs classification", formatCurrency(totals.unclear), "amber"],
      ], "compact")}
      <section class="panel">
        ${renderPanelHeader("Costs", "", "receipt")}
        ${renderFilterPanel(`
          ${renderFilter("Property", "expense.propertyId", expenseFilters.propertyId, expenseFilterOptions.properties)}
          ${renderFilter("Project", "expense.projectId", expenseFilters.projectId, expenseFilterOptions.projects)}
          ${renderFilter("Cost type", "expense.classification", expenseFilters.classification, expenseFilterOptions.classifications)}
          ${renderFilter("Category", "expense.category", expenseFilters.category, expenseFilterOptions.categories)}
          ${renderFilter("Docs", "expense.documentationStatus", expenseFilters.documentationStatus, expenseFilterOptions.documentationStatuses)}
          <label class="field compact-field">
            <span>Sort</span>
            <select data-filter="expense.sort">
              ${optionHtml("date-desc", "Newest first", expenseFilters.sort)}
              ${optionHtml("date-asc", "Oldest first", expenseFilters.sort)}
              ${optionHtml("amount-desc", "Amount high to low", expenseFilters.sort)}
              ${optionHtml("amount-asc", "Amount low to high", expenseFilters.sort)}
            </select>
          </label>
        `, { count: data.expenses.length, hasActiveFilters, clearAction: "clear-expense-filters", className: "expense-filters" })}
        ${renderResultsSection("Expense records", filteredExpenses.length, filteredExpenses.length
          ? renderExpensesTable(filteredExpenses)
          : data.properties.length
            ? hasActiveFilters && data.expenses.length
              ? renderEmpty("No matching expenses", "Clear filters to return to your costs.", renderInlineAction("Clear filters", "clear-expense-filters", "button-secondary"))
              : renderEmpty("No expenses yet", "Add your first cost when you have a receipt, invoice, or note.", renderInlineAction("Add expense", "add-expense"))
            : renderEmpty("No property yet", "Add a property before tracking expenses.", renderInlineAction("Add your property", "add-property")))}
      </section>
    </div>
  `;
}

function renderDocumentsView() {
  if (!DOCUMENT_SORT_OPTIONS.some((option) => option.value === documentFilters.sort)) {
    documentFilters.sort = "date-desc";
  }
  let documentFilterOptions = getDocumentFilterOptions();
  normalizeChoiceFilter(documentFilters, "propertyId", documentFilterOptions.properties);
  normalizeChoiceFilter(documentFilters, "documentType", documentFilterOptions.documentTypes);
  normalizeChoiceFilter(documentFilters, "fileStatus", documentFilterOptions.fileStatuses);
  documentFilterOptions = getDocumentFilterOptions();
  const hasActiveFilters = hasActiveDocumentFilters();
  const filteredDocuments = data.documents.filter((document) => {
    if (documentFilters.propertyId !== EMPTY_FILTER && document.propertyId !== documentFilters.propertyId) return false;
    if (documentFilters.documentType !== EMPTY_FILTER && document.documentType !== documentFilters.documentType) return false;
    if (documentFilters.fileStatus !== EMPTY_FILTER && getDocumentFileStatus(document) !== documentFilters.fileStatus) return false;
    return true;
  });
  const sortedDocuments = sortDocuments(filteredDocuments, documentFilters.sort);
  return `
    <div class="page-stack">
      ${renderPageIntro({
        title: "Receipts and supporting documents",
        actions: data.properties.length
          ? `<button class="button button-primary" data-action="add-document" type="button"><span aria-hidden="true">+</span>Add document</button>`
          : renderDisabledAction("Add document", "Add a property first."),
      })}
      ${data.properties.length ? "" : renderEmpty("No property yet", "Documents need a property so they can be included with the right home.", renderInlineAction("Add your property", "add-property"))}
      ${data.properties.length ? `
        <section class="panel" id="documents-library-panel">
          ${renderPanelHeader("All documents", "", "document")}
          ${renderFilterPanel(`
            ${renderFilter("Property", "document.propertyId", documentFilters.propertyId, documentFilterOptions.properties)}
            ${renderFilter("Type", "document.documentType", documentFilters.documentType, documentFilterOptions.documentTypes)}
            ${renderFilter("File", "document.fileStatus", documentFilters.fileStatus, documentFilterOptions.fileStatuses)}
            ${renderFilter("Sort", "document.sort", documentFilters.sort, DOCUMENT_SORT_OPTIONS, { includeAll: false })}
          `, { count: data.documents.length, hasActiveFilters, clearAction: "clear-document-filters", className: "document-filters" })}
          ${renderResultsSection("Document results", sortedDocuments.length, sortedDocuments.length
            ? renderDocumentsTable(sortedDocuments)
            : data.properties.length
              ? data.documents.length && hasActiveFilters
                ? renderEmpty("No matching documents", "Clear filters to return to your document list.", renderInlineAction("Clear filters", "clear-document-filters", "button-secondary"))
                : renderEmpty("No documents yet", "Add a receipt, invoice, permit, photo, or contract.", renderInlineAction("Add document", "add-document"))
              : renderEmpty("No property yet", "Add a property before attaching documents.", renderInlineAction("Add your property", "add-property")))}
        </section>
      ` : ""}
    </div>
  `;
}

function renderExportCenter() {
  const totals = getExpenseTotals(data.expenses);
  const packetSummary = getPacketReadinessSummary(data, { tutorialMode: isTutorialMode() });
  if (!isDesktopMode() && !isTutorialMode()) requestStorageEstimate();

  return `
    <div class="page-stack">
      ${renderPageIntro({
        title: "Exports and backups",
      })}
      <section class="export-workflow-section" aria-labelledby="export-review-heading">
        <div class="section-title-row">
          <h2 id="export-review-heading">Export for review</h2>
          ${isTutorialMode() ? `<span>Tutorial sample data</span>` : ""}
        </div>
        ${renderCpaExportPanel()}
        ${renderReviewSummaryPreview(totals, packetSummary)}
      </section>
      <section class="export-workflow-section" aria-labelledby="backup-restore-heading">
        <div class="section-title-row">
          <h2 id="backup-restore-heading">Backup and restore</h2>
          ${isTutorialMode() ? `<span>Tutorial workspace only</span>` : ""}
        </div>
        ${renderBackupRestorePanel()}
        ${renderStorageHealthPanel()}
        ${renderDataSafetyPanel()}
      </section>
    </div>
  `;
}

function renderReviewSummaryPreview(totals, packetSummary) {
  const reviewItems = packetSummary.openItems.filter((item) => !packetSummary.supportItems.some((supportItem) => supportItem.id === item.id));
  return `
    <details class="panel print-summary export-preview-panel">
      <summary>
        <span>
          <strong>Packet preview</strong>
          <small>Prepared ${formatDate(todayISO())}. Expand to inspect what will be included.</small>
        </span>
      </summary>
      <p class="helper-note print-caveat">${isTutorialMode() ? "Tutorial sample items only. " : ""}Home Ledger organizes records. It does not give tax, legal, or accounting advice.</p>
      ${renderMetrics([
        ["Total tracked spend", formatCurrency(totals.total), ""],
        ["Possible improvements", formatCurrency(totals.potential), "green"],
        ["Repair or upkeep", formatCurrency(totals.repair), "rust"],
        ["Needs classification", formatCurrency(totals.unclear), "amber"],
        ["Packet status", packetSummary.statusLabel, packetSummary.readyToShare ? "green" : "amber"],
        ["Proof/support needed", String(packetSummary.proofFilesStillNeeded), packetSummary.proofFilesStillNeeded ? "amber" : "green"],
      ], "compact")}
      <div class="export-section">
        <h3>Check before sharing</h3>
        ${renderExportFollowUpChecklist(packetSummary.openItems)}
      </div>
      <div class="export-section">
        <h3>Records still needed</h3>
        ${packetSummary.supportItems.length
          ? renderExportFollowUpsTable(packetSummary.supportItems)
          : `<p class="helper-note">No required support records or files are flagged.</p>`}
      </div>
      ${reviewItems.length ? `
        <div class="export-section">
          <h3>Review items</h3>
          ${renderExportFollowUpsTable(reviewItems)}
        </div>
      ` : ""}
      <div class="export-section">
        <h3>Properties</h3>
        ${data.properties.length ? renderExportPropertiesTable() : renderEmpty("No properties to export", "Add a property before preparing a full summary.")}
      </div>
      <div class="export-section">
        <h3>Projects</h3>
        ${data.projects.length ? renderExportProjectsTable() : renderEmpty("No projects to export", "Add projects to group related expenses and documents.")}
      </div>
      <div class="export-section">
        <h3>Expense detail</h3>
        ${data.expenses.length ? renderExportExpensesTable() : renderEmpty("No expenses to export", "Add expenses to build the CSV and review summary.")}
      </div>
      <div class="export-section">
        <h3>Documents</h3>
        ${data.documents.length ? renderExportDocumentsTable() : renderEmpty("No documents to export", "Add documents to include file details in the printable summary.")}
      </div>
    </details>
  `;
}

function renderDataSafetyPanel() {
  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("Restore notes", "", "home")}
      <div class="safety-list">
        <div>
          <strong>Full backups may include files</strong>
          <span>Backup JSON files may include supported receipts, invoices, photos, document text, and notes.</span>
        </div>
        <div>
          <strong>Save backups somewhere memorable</strong>
          <span>Choose a place where you can find the file later.</span>
        </div>
        <div>
          <strong>Restore with care</strong>
          <span>Restoring a backup replaces the current workspace after confirmation.</span>
        </div>
        <div>
          <strong>Check file follow-ups</strong>
          <span>After restore, review any documents marked Restored without the attached file.</span>
        </div>
      </div>
    </section>
  `;
}

function renderCpaExportPanel() {
  const hasReviewRecords = data.properties.length || data.expenses.length || data.documents.length;
  const pdfLabel = isTutorialMode() ? "Save tutorial review packet" : "Save review packet";
  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("Review packet", "", "clipboard")}
      ${hasReviewRecords
        ? `<p class="helper-note">${isTutorialMode() ? "Exports use tutorial sample items only." : "Create an organizer from saved properties, projects, expenses, and documents."}</p>`
        : renderEmpty("No items to export yet", "Add a property, project, expense, or document to populate the review packet.")}
      <div class="backup-actions">
        <button class="button button-secondary" data-action="print-summary" type="button"><span aria-hidden="true">⎙</span>Print review summary</button>
        <button class="button button-primary" data-action="download-cpa-pdf" ${hasReviewRecords ? "" : "disabled"} type="button"><span aria-hidden="true">↓</span>${pdfLabel}</button>
        <button class="button button-secondary" data-action="download-csv" ${data.expenses.length ? "" : "disabled"} type="button"><span aria-hidden="true">↓</span>${isTutorialMode() ? "Download tutorial expense CSV" : "Download expense CSV"}</button>
      </div>
      <p class="helper-note">${data.expenses.length ? "The expense CSV does not include attached file contents." : "Add expenses to enable the expense CSV."}</p>
    </section>
  `;
}

function renderStorageHealthPanel() {
  const attachedDocuments = data.documents.filter((document) => document.hasFile);
  const attachedFileSize = attachedDocuments.reduce((total, document) => total + (Number(document.fileSize) || 0), 0);

  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("Saved items", "", "document")}
      <div class="storage-health-grid">
        ${storageMetric("Vendors", data.vendors.length)}
        ${storageMetric("Properties", data.properties.length)}
        ${storageMetric("Projects", data.projects.length)}
        ${storageMetric("Expenses", data.expenses.length)}
        ${storageMetric("Documents", data.documents.length)}
        ${storageMetric("Attached files", attachedDocuments.length)}
        ${storageMetric("Attached file size", formatFileSize(attachedFileSize))}
      </div>
    </section>
  `;
}

function renderBackupRestorePanel() {
  return `
    <section class="panel print-hidden">
      ${renderPanelHeader(isTutorialMode() ? "Tutorial backup and restore" : "Full backup", "", "clipboard")}
      <p class="helper-note">${isTutorialMode()
        ? "Create or restore sample backup files inside this temporary tutorial workspace only."
        : "Review exports organize details for sharing. Full backups preserve saved items and supported attached files where available."}</p>
      <div class="backup-actions">
        <button class="button button-primary" data-action="download-full-backup" type="button">${isTutorialMode() ? "Download tutorial backup" : isDesktopMode() ? "Save full backup" : "Download full backup"}</button>
        <button class="button button-secondary" data-action="choose-backup-file" type="button">${isTutorialMode() ? "Restore into tutorial" : "Restore from backup"}</button>
        <input class="restore-input" data-restore-input type="file" accept="application/json,.json">
      </div>
      <div class="backup-status-row">
        <span>Last backup</span>
        <strong>${lastBackupCreatedAt ? `Created this session ${formatBackupTimestamp(lastBackupCreatedAt)}` : "No backup created in this app session"}</strong>
      </div>
      <p class="helper-note">${isTutorialMode()
        ? "Tutorial restores replace the sample workspace only. Exit tutorial to return to your real home file."
        : "Full backups may include receipts, invoices, photos, document text, and notes inside the JSON file."}</p>
    </section>
  `;
}

function formatBackupTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function storageMetric(label, value) {
  return `
    <article class="storage-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function getStorageEstimateCopy() {
  if (isDesktopMode()) {
    return {
      used: formatFileSize(storageInfo.recordsBytes || 0),
      quota: formatFileSize(storageInfo.documentBytes || 0),
    };
  }
  if (storageEstimate.status === "ready") {
    return {
      used: formatFileSize(storageEstimate.usage),
      quota: formatFileSize(storageEstimate.quota),
    };
  }
  if (storageEstimate.status === "loading") {
    return {
      used: "Checking",
      quota: "Checking",
    };
  }
  return {
    used: "Unavailable",
    quota: "Unavailable",
  };
}

function storageSurfaceName() {
  if (isTutorialMode()) return "Tutorial";
  return isDesktopMode() ? "Mac app" : "Browser";
}

function renderPropertyForm(property) {
  return `
    <form class="form-grid" data-form="property" novalidate>
      <input type="hidden" name="id" value="${escapeAttr(property?.id || "")}">
      ${field("Property name", "name", property?.name || "", { required: true })}
      ${field("Address", "address", property?.address || "")}
      <div class="form-row">
        ${field("Purchase date", "purchaseDate", property?.purchaseDate || "", { type: "date" })}
        ${field("Purchase price", "purchasePrice", property?.purchasePrice || "", { type: "number", step: "0.01", placeholder: "0.00" })}
      </div>
      ${textarea("Notes", "notes", property?.notes || "")}
      ${formActions("Save property")}
    </form>
  `;
}

function renderPropertyFormModal(property) {
  const isEditing = Boolean(property);
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal" role="dialog" aria-modal="true" aria-labelledby="property-form-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Property setup</p>
            <h2 id="property-form-title">${isEditing ? "Edit property" : "Add property"}</h2>
            <p>Only the property name is required. You can fill in purchase details later.</p>
          </div>
          <button class="icon-button" data-action="cancel-form" type="button" aria-label="Close">×</button>
        </div>
        ${renderPropertyForm(property)}
      </section>
    </div>
  `;
}

function renderEditablePropertyField(property, fieldName, label, displayValue) {
  const isEditing = editingPropertyField === fieldName;
  const isTitle = fieldName === "name";
  const wrapperClass = `editable-detail ${isTitle ? "is-title" : ""}`;

  if (isEditing) {
    return `
      <div class="${wrapperClass}">
        <form class="inline-edit-form" data-form="property-field" novalidate>
          <input type="hidden" name="id" value="${escapeAttr(property.id)}">
          <input type="hidden" name="fieldName" value="${escapeAttr(fieldName)}">
          ${renderPropertyFieldControl(fieldName, label, getPropertyFieldEditValue(property, fieldName))}
          <div class="inline-edit-actions">
            <button class="icon-button" data-action="cancel-property-field" type="button" aria-label="Cancel edit">×</button>
            <button class="icon-button save-icon-button" type="submit" aria-label="Save ${escapeAttr(label)}">✓</button>
          </div>
        </form>
      </div>
    `;
  }

  if (isTitle) {
    return `
      <div class="${wrapperClass}">
        <h3>${escapeHtml(displayValue)}</h3>
        ${propertyEditButton(fieldName, label)}
      </div>
    `;
  }

  return `
    <div class="${wrapperClass}">
      <dt>${escapeHtml(label)}</dt>
      <dd>
        <span>${escapeHtml(displayValue)}</span>
        ${propertyEditButton(fieldName, label)}
      </dd>
    </div>
  `;
}

function propertyEditButton(fieldName, label) {
  return `<button class="icon-button field-edit-button" data-action="edit-property-field" data-field="${escapeAttr(fieldName)}" type="button" aria-label="Edit ${escapeAttr(label)}">✎</button>`;
}

function getPropertyFieldEditValue(property, fieldName) {
  if (fieldName === "purchasePrice") return property.purchasePrice || "";
  return property[fieldName] || "";
}

function renderPropertyFieldControl(fieldName, label, value) {
  if (fieldName === "notes") {
    return `
      <label class="field">
        <span>${escapeHtml(label)}</span>
        <textarea name="value" rows="3">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  const type = fieldName === "purchaseDate" ? "date" : fieldName === "purchasePrice" ? "number" : "text";
  const extra = fieldName === "purchasePrice" ? ` step="0.01" placeholder="0.00"` : "";
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <input name="value" type="${escapeAttr(type)}" value="${escapeAttr(value)}"${extra}>
    </label>
  `;
}

function renderEditableProjectField(project, fieldName, label, displayValue) {
  const isEditing = editingProjectField === fieldName;
  const wrapperClass = `editable-detail project-field project-field-${fieldName}`;

  if (isEditing) {
    return `
      <div class="${wrapperClass}">
        <form class="inline-edit-form" data-form="project-field" novalidate>
          <input type="hidden" name="id" value="${escapeAttr(project.id)}">
          <input type="hidden" name="fieldName" value="${escapeAttr(fieldName)}">
          ${renderProjectFieldControl(project, fieldName, label, getProjectFieldEditValue(project, fieldName))}
          <div class="inline-edit-actions">
            <button class="icon-button" data-action="cancel-project-field" type="button" aria-label="Cancel edit">×</button>
            <button class="icon-button save-icon-button" type="submit" aria-label="Save ${escapeAttr(label)}">✓</button>
          </div>
        </form>
      </div>
    `;
  }

  return `
    <div class="${wrapperClass}">
      <dt>${escapeHtml(label)}</dt>
      <dd>
        <span>${escapeHtml(displayValue)}</span>
        ${projectEditButton(fieldName, label)}
      </dd>
    </div>
  `;
}

function projectEditButton(fieldName, label) {
  return `<button class="icon-button field-edit-button" data-action="edit-project-field" data-field="${escapeAttr(fieldName)}" type="button" aria-label="Edit ${escapeAttr(label)}">✎</button>`;
}

function getProjectFieldEditValue(project, fieldName) {
  return project[fieldName] || "";
}

function renderProjectFieldControl(project, fieldName, label, value) {
  if (fieldName === "propertyId") {
    return selectField(label, "value", value || selectedPropertyId || data.properties[0]?.id || "", data.properties.map((property) => ({ value: property.id, label: property.name })), false);
  }
  if (fieldName === "category") {
    return selectField(label, "value", value || "other", EXPENSE_CATEGORIES, false);
  }
  if (fieldName === "status") {
    return selectField(label, "value", value || "planned", PROJECT_STATUSES, false);
  }
  if (["scopeSummary", "notes", "completenessOverrideNote"].includes(fieldName)) {
    return `
      <label class="field">
        <span>${escapeHtml(label)}</span>
        <textarea name="value" rows="3">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  const type = ["startDate", "completionDate"].includes(fieldName) ? "date" : "text";
  const required = fieldName === "name" ? " required" : "";
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <input name="value" type="${escapeAttr(type)}" value="${escapeAttr(value)}"${required}>
    </label>
  `;
}

function renderProjectForm(project, context = {}) {
  const vendorId = project?.vendorId || "";
  const highlightedFields = new Set(context.highlightFields || []);
  return `
    <form class="form-grid" data-form="project" novalidate>
      <input type="hidden" name="id" value="${escapeAttr(project?.id || "")}">
      ${selectField("Property", "propertyId", project?.propertyId || selectedPropertyId || data.properties[0]?.id || "", data.properties.map((property) => ({ value: property.id, label: property.name })))}
      ${field("Project name", "name", project?.name || "", { required: true })}
      <div class="form-row">
        ${selectField("Category", "category", project?.category || "other", EXPENSE_CATEGORIES, false)}
        ${selectField("Status", "status", project?.status || "planned", PROJECT_STATUSES, false)}
      </div>
      <div class="form-row">
        ${field("Start date", "startDate", project?.startDate || "", { type: "date", highlight: highlightedFields.has("startDate") })}
        ${field("Completion date", "completionDate", project?.completionDate || "", { type: "date", highlight: highlightedFields.has("completionDate") })}
      </div>
      <div class="form-row">
        ${selectField("Primary vendor", "vendorId", vendorId, getVendorSelectOptions({ selectedVendorId: vendorId }), true, { highlight: highlightedFields.has("vendorId") })}
        ${field("Permit number", "permitNumber", project?.permitNumber || "", { placeholder: "Optional permit or approval number", highlight: highlightedFields.has("permitNumber") })}
      </div>
      <p class="helper-note">Add vendors once, then reuse them across projects and expenses. Leave this unassigned if you are still gathering details. <button class="inline-text-button" data-action="add-vendor" type="button">Add vendor</button></p>
      ${textarea("Project description", "scopeSummary", project?.scopeSummary || "", { highlight: highlightedFields.has("scopeSummary") })}
      ${textarea("Notes", "notes", project?.notes || "")}
      ${textarea("Mark as complete with note", "completenessOverrideNote", project?.completenessOverrideNote || "")}
      <p class="helper-note">Adding this note removes the project from Items to finish. It does not certify the project or make a tax/legal conclusion.</p>
      ${formActions("Save project")}
    </form>
  `;
}

function getVendorSelectOptions({ includeArchived = false, selectedVendorId = "" } = {}) {
  return data.vendors
    .filter((vendor) => includeArchived || vendor.status !== "archived" || vendor.id === selectedVendorId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((vendor) => ({
      value: vendor.id,
      label: vendor.status === "archived" ? `${vendor.name} (archived)` : vendor.name,
    }));
}

function renderVendorFormModal(vendor) {
  const isEditing = Boolean(vendor);
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-form-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Vendor setup</p>
            <h2 id="vendor-form-title">${isEditing ? "Edit vendor" : "Add vendor"}</h2>
            <p>Save a contractor, store, agency, or payee that can be linked to projects and expenses.</p>
          </div>
          <button class="icon-button" data-action="cancel-vendor-form" type="button" aria-label="Close">×</button>
        </div>
        ${renderVendorForm(vendor)}
      </section>
    </div>
  `;
}

function renderVendorForm(vendor) {
  return `
    <form class="form-grid" data-form="vendor" novalidate>
      <input type="hidden" name="id" value="${escapeAttr(vendor?.id || "")}">
      ${field("Vendor name", "name", vendor?.name || "", { required: true, placeholder: "Contractor, store, agency, or person" })}
      <div class="form-row">
        ${selectField("Category", "category", vendor?.category || "other", EXPENSE_CATEGORIES, false)}
        ${selectField("Status", "status", vendor?.status || "active", VENDOR_STATUSES, false)}
      </div>
      <div class="form-row">
        ${field("Contact name", "contactName", vendor?.contactName || "")}
        ${field("Phone", "phone", vendor?.phone || "")}
      </div>
      <div class="form-row">
        ${field("Email", "email", vendor?.email || "", { type: "email" })}
        ${field("Website", "website", vendor?.website || "")}
      </div>
      ${textarea("Notes", "notes", vendor?.notes || "")}
      <div class="form-actions">
        <button class="button button-secondary" data-action="cancel-vendor-form" type="button">Cancel</button>
        <button class="button button-primary" type="submit">Save vendor</button>
      </div>
    </form>
  `;
}

function renderProjectFormModal(project) {
  const isEditing = Boolean(project);
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Project setup</p>
            <h2 id="project-form-title">${isEditing ? "Edit project" : "Add project"}</h2>
            <p>Save the property, timing, vendor, permits, project description, and notes.</p>
          </div>
          <button class="icon-button" data-action="cancel-form" type="button" aria-label="Close">×</button>
        </div>
        ${renderProjectForm(project)}
      </section>
    </div>
  `;
}

function renderExpenseForm(expense, context = {}) {
  const draftValues = draftExpenseFormValues && (editingExpenseId === null || draftExpenseFormValues.id === (expense?.id || ""))
    ? draftExpenseFormValues
    : null;
  const draftProject = !expense && draftExpenseProjectId
    ? data.projects.find((project) => project.id === draftExpenseProjectId)
    : null;
  const propertyId = draftValues?.propertyId || expense?.propertyId || draftProject?.propertyId || selectedPropertyId || data.properties[0]?.id || "";
  const projectOptions = data.projects.filter((project) => project.propertyId === propertyId);
  const projectId = draftValues?.projectId || expense?.projectId || draftProject?.id || "";
  const vendorId = draftValues?.vendorId || expense?.vendorId || draftProject?.vendorId || "";

  return `
    <form class="form-grid" data-form="expense" novalidate>
      <input type="hidden" name="id" value="${escapeAttr(expense?.id || "")}">
      <div class="form-row">
        ${selectField("Property", "propertyId", propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })), false)}
        ${selectField("Project", "projectId", projectId, projectOptions.map((project) => ({ value: project.id, label: project.name })))}
      </div>
      <div class="form-row">
        ${field("Date", "date", draftValues?.date || expense?.date || todayISO(), { type: "date", required: true })}
        ${field("Amount", "amount", draftValues?.amount || expense?.amount || "", { type: "number", step: "0.01", placeholder: "0.00", required: true })}
      </div>
      <div class="form-row">
        ${selectField("Vendor or payee", "vendorId", vendorId, getVendorSelectOptions({ selectedVendorId: vendorId }), true, { highlight: context.highlightField === "vendorId" })}
        ${field("Description", "description", draftValues?.description || expense?.description || "", { placeholder: "Roof repair, dishwasher install, permit fee", required: true })}
      </div>
      <p class="helper-note">Expenses use shared vendors. Unassigned / unknown is fine when the payee is not clear yet. <span class="inline-action-group"><button class="inline-text-button" data-action="add-vendor" type="button">Add vendor</button><button class="inline-text-button" data-action="manage-vendors" type="button">Manage vendors</button></span></p>
      <div class="form-row">
        ${selectField("Cost type", "classification", draftValues?.classification || expense?.classification || "unclear / ask CPA", CLASSIFICATIONS, false, { highlight: context.highlightField === "classification" })}
        ${selectField("Category", "category", draftValues?.category || expense?.category || "other", EXPENSE_CATEGORIES, false)}
      </div>
      <p class="helper-note">Examples: roof replacement or an addition might be a possible improvement; a service visit or small repair might be repair or upkeep. Use Needs classification when you want to revisit the cost.</p>
      ${selectField("Documentation", "documentationStatus", draftValues?.documentationStatus || expense?.documentationStatus || "no document yet", DOCUMENT_STATUSES, false, { highlight: context.highlightField === "documentationStatus" })}
      <p class="helper-note">Use your best guess for sorting costs. You can change this later.</p>
      ${textarea("Notes", "notes", draftValues?.notes || expense?.notes || "")}
      ${formActions("Save expense")}
    </form>
  `;
}

function renderDocumentForm(document, context = {}) {
  const contextExpenseId = context.expenseId || draftDocumentExpenseId;
  const contextProjectId = context.projectId || draftDocumentProjectId;
  const draftExpense = !document && contextExpenseId
    ? data.expenses.find((expense) => expense.id === contextExpenseId)
    : null;
  const draftProject = !document && !draftExpense && contextProjectId
    ? data.projects.find((project) => project.id === contextProjectId)
    : null;
  const propertyId = draftExpense?.propertyId || document?.propertyId || draftProject?.propertyId || selectedPropertyId || data.properties[0]?.id || "";
  const projectOptions = data.projects.filter((project) => project.propertyId === propertyId);
  const expenseOptions = data.expenses.filter((expense) => expense.propertyId === propertyId);
  const selectedExpenseId = document?.expenseId || draftExpense?.id || "";
  const linkedExpense = draftExpense || data.expenses.find((expense) => expense.id === selectedExpenseId) || null;
  const selectedProjectId = draftExpense?.projectId || document?.projectId || draftProject?.id || "";
  const documentType = document?.documentType || (draftExpense ? getPreferredDocumentTypeForExpense(draftExpense) : "receipt");
  const displayName = document?.displayName || getDraftDocumentDisplayName(draftExpense);
  const allowFileInput = !document || documentFileInputAllowed || !document.hasFile;
  const fileHelper = document?.hasFile
    ? `Current file: ${document.fileName || "Attached file"} (${formatFileSize(document.fileSize)}). Maximum file size: ${formatFileSize(MAX_DOCUMENT_FILE_SIZE)}.`
    : `PDF, image, receipt, invoice, permit, or note. Maximum file size: ${formatFileSize(MAX_DOCUMENT_FILE_SIZE)}.`;

  return `
    <form class="form-grid" data-form="document" enctype="multipart/form-data" novalidate>
      <input type="hidden" name="id" value="${escapeAttr(document?.id || "")}">
      ${linkedExpense ? renderLinkedExpenseSummary(linkedExpense) : ""}
      ${allowFileInput ? `
        <label class="field file-field ${context.highlightField === "file" ? "needs-resolution" : ""}">
          <span>File</span>
          <input name="file" type="file">
          <small>${escapeHtml(fileHelper)}</small>
        </label>
      ` : ""}
      ${selectField("Linked expense", "expenseId", selectedExpenseId, expenseOptions.map((expense) => ({ value: expense.id, label: `${getExpenseVendorName(data, expense)} · ${formatDate(expense.date)} · ${formatCurrency(expense.amount)}` })), true, { highlight: context.highlightField === "expenseId" })}
      <p class="helper-note">Changing the expense will update the property and project.</p>
      <div class="form-row">
        ${selectField("Type", "documentType", documentType, DOCUMENT_TYPES, false)}
        ${field("Document date", "addedDate", document?.addedDate || todayISO(), { type: "date", required: true })}
      </div>
      ${field("Name", "displayName", displayName, { placeholder: "Optional. Uses file name if blank." })}
      <p class="helper-note">Optional. Uses file name if blank.</p>
      <div class="form-row">
        ${selectField("Property", "propertyId", propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })), false)}
        ${selectField("Project", "projectId", selectedProjectId, projectOptions.map((project) => ({ value: project.id, label: project.name })))}
      </div>
      ${textarea("Notes", "notes", document?.notes || "")}
      ${documentFormActions(document)}
    </form>
  `;
}

function renderLinkedExpenseSummary(expense) {
  return `
    <div class="linked-expense-summary">
      <span>Linked expense</span>
      <strong>${escapeHtml(getExpenseVendorName(data, expense))} · ${escapeHtml(formatDate(expense.date))} · ${escapeHtml(formatCurrency(expense.amount))}</strong>
      <p>${escapeHtml(expense.description || "No description")}</p>
    </div>
  `;
}

function renderRecentExpenseTable(expenses, options = {}) {
  return `
    <div class="table-wrap compact-table-wrap">
      <table class="compact-record-table recent-expense-table ${options.dashboard ? "dashboard-expense-table" : ""}">
        <thead>
          <tr>
            <th>Expense</th>
            ${options.dashboard ? "" : `<th class="align-right">Amount</th>`}
            ${options.dashboard ? `<th class="align-right">Open</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${expenses.map((expense) => `
            <tr>
              <td class="record-name-cell" data-label="Expense">
                <a class="table-link dashboard-object-link" href="#expenses" data-action="open-expense" data-id="${escapeAttr(expense.id)}" aria-label="${escapeAttr(`View expense ${getExpenseVendorName(data, expense)} for ${formatCurrency(expense.amount)}`)}">${escapeHtml(getExpenseVendorName(data, expense))}</a>
                <span>${formatDate(expense.date)} / ${escapeHtml(expense.description)}</span>
                ${options.dashboard && expense.projectId ? `<span>${dashboardProjectLink(expense.projectId)}</span>` : ""}
                ${options.dashboard ? `<a class="money dashboard-money-link dashboard-inline-money" href="#expenses" data-action="open-expense" data-id="${escapeAttr(expense.id)}" aria-label="${escapeAttr(`View expense ${getExpenseVendorName(data, expense)} for ${formatCurrency(expense.amount)}`)}">${formatCurrency(expense.amount)}</a>` : ""}
              </td>
              ${options.dashboard ? "" : `<td class="align-right" data-label="Amount">
                <a class="money dashboard-money-link" href="#expenses" data-action="open-expense" data-id="${escapeAttr(expense.id)}" aria-label="${escapeAttr(`View expense ${getExpenseVendorName(data, expense)} for ${formatCurrency(expense.amount)}`)}">${formatCurrency(expense.amount)}</a>
              </td>`}
              ${options.dashboard ? `
                <td class="align-right" data-label="Open">
                  <div class="dashboard-row-actions">
                    <a class="dashboard-open-link" href="#expenses" data-action="open-expense" data-id="${escapeAttr(expense.id)}" aria-label="${escapeAttr(`View expense ${getExpenseVendorName(data, expense)}`)}">Open →</a>
                  </div>
                </td>
              ` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRecentDocumentsTable(documents) {
  return `
    <div class="table-wrap compact-table-wrap">
      <table class="compact-record-table recent-document-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Linked to</th>
            <th class="align-right">Open</th>
          </tr>
        </thead>
        <tbody>
          ${documents.map((document) => {
            const linkedTo = document.projectId
              ? dashboardProjectLink(document.projectId)
              : dashboardTabLink(getPropertyName(data, document.propertyId), "property", `View property ${getPropertyName(data, document.propertyId)}`, "dashboard-inline-link", { propertyId: document.propertyId });
            return `
              <tr>
                <td class="record-name-cell" data-label="Document">
                  <a class="table-link dashboard-object-link" href="#documents" data-action="open-document" data-id="${escapeAttr(document.id)}" aria-label="${escapeAttr(`View document ${document.displayName}`)}">${escapeHtml(document.displayName)}</a>
                  <span>${escapeHtml(optionLabel(DOCUMENT_TYPES, document.documentType))} / ${formatDate(document.addedDate)}</span>
                </td>
                <td data-label="Linked to">${linkedTo}</td>
                <td class="align-right" data-label="Open">
                  <a class="dashboard-open-link" href="#documents" data-action="open-document" data-id="${escapeAttr(document.id)}" aria-label="${escapeAttr(`Open document ${document.displayName}`)}">Open →</a>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderProjectsTable(projects) {
  return `
    <div class="table-wrap compact-table-wrap">
      <table class="compact-record-table project-record-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Property</th>
            <th>Status</th>
            <th>Category</th>
            <th class="align-right">Expense count</th>
            <th class="align-right">Expense total</th>
            <th class="align-right">Docs</th>
            <th>Open follow-ups</th>
            <th class="align-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${projects.map((project) => renderProjectTableRows(project)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderProjectTableRows(project) {
  const projectFollowUps = getProjectFollowUps(project.id);
  const completeness = getProjectTabCompleteness(getProjectCompleteness(data, project));
  const isExpanded = expandedProjectFollowUpIds.has(project.id);
  return `
    ${renderProjectTableRow(project, projectFollowUps, completeness)}
    ${isExpanded ? renderProjectFollowUpRow(project, projectFollowUps) : ""}
  `;
}

function renderProjectTableRow(project, projectFollowUps = getProjectFollowUps(project.id), completeness = getProjectTabCompleteness(getProjectCompleteness(data, project))) {
  const projectExpenses = data.expenses.filter((expense) => expense.projectId === project.id);
  const projectDocuments = data.documents.filter((document) => document.projectId === project.id);
  const totals = getExpenseTotals(projectExpenses);
  return `
    <tr class="${expandedProjectFollowUpIds.has(project.id) ? "is-expanded" : ""}">
      <td class="record-name-cell" data-label="Project">
        <button class="table-link" data-action="select-project" data-id="${escapeAttr(project.id)}" aria-haspopup="dialog" type="button">${escapeHtml(project.name)}</button>
      </td>
      <td data-label="Property">${escapeHtml(getPropertyName(data, project.propertyId))}</td>
      <td data-label="Status">${escapeHtml(optionLabel(PROJECT_STATUSES, project.status))}</td>
      <td data-label="Category">${escapeHtml(optionLabel(EXPENSE_CATEGORIES, project.category))}</td>
      <td class="align-right" data-label="Expense count"><strong>${projectExpenses.length}</strong></td>
      <td class="align-right" data-label="Expense total"><strong>${formatCurrency(totals.total)}</strong></td>
      <td class="align-right" data-label="Docs">${projectDocuments.length}</td>
      <td data-label="Open follow-ups">${renderProjectOpenItemsControl(project, projectFollowUps, completeness)}</td>
      <td class="align-right" data-label="Actions">
        <div class="table-actions">
          ${rowActions("edit-project", "delete-project", project.id, project.name)}
        </div>
      </td>
    </tr>
  `;
}

function renderProjectOpenItemsControl(project, projectFollowUps, completeness) {
  const label = getProjectRecordStatusLabel(project, projectFollowUps, completeness);
  const expanded = expandedProjectFollowUpIds.has(project.id);
  if (!projectFollowUps.length) {
    const note = project.completenessOverrideNote || completeness.isOverridden ? "Marked complete" : "No open follow-ups";
    return `<span class="open-items-static"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note)}</small></span>`;
  }
  return `
    <button
      class="open-items-toggle"
      data-action="toggle-project-followups"
      data-id="${escapeAttr(project.id)}"
      aria-expanded="${expanded ? "true" : "false"}"
      aria-controls="project-followups-${escapeAttr(project.id)}"
      type="button"
    >
      <strong>${escapeHtml(label)}</strong>
      <small>${expanded ? "Hide items" : "View items"}</small>
    </button>
  `;
}

function renderProjectFollowUpRow(project, projectFollowUps) {
  return `
    <tr class="project-followup-detail-row">
      <td colspan="9">
        <div class="project-followup-detail" id="project-followups-${escapeAttr(project.id)}">
          <div class="project-followup-detail-header">
            <div>
              <span class="eyebrow">Items to finish</span>
              <h3>${escapeHtml(project.name)}</h3>
            </div>
            <span>${projectFollowUps.length ? `${projectFollowUps.length} open` : "Complete"}</span>
          </div>
          ${projectFollowUps.length ? `
            <div class="project-followup-link-list">
              ${projectFollowUps.map((item) => renderProjectFollowUpLink(item)).join("")}
            </div>
          ` : `<p class="helper-note">No open follow-ups for this project.</p>`}
        </div>
      </td>
    </tr>
  `;
}

function renderProjectFollowUpLink(item) {
  return `
    <button class="project-followup-link" data-action="open-follow-up" data-follow-up-id="${escapeAttr(item.id)}" type="button">
      <span>${escapeHtml(item.typeLabel || "Follow-up")}</span>
      <strong>${escapeHtml(item.label)}</strong>
      <small>${escapeHtml(item.detail)}</small>
    </button>
  `;
}

function renderProjectFileModal(project) {
  if (!project) return "";
  const projectExpenses = data.expenses.filter((expense) => expense.projectId === project.id);
  const projectDocuments = data.documents.filter((document) => document.projectId === project.id);
  const totals = getExpenseTotals(projectExpenses);
  const projectFollowUps = getProjectFollowUps(project.id);
  const completeness = getProjectTabCompleteness(getProjectCompleteness(data, project));
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal project-file-modal" role="dialog" aria-modal="true" aria-labelledby="project-file-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Project file</p>
            <h2 id="project-file-title">${escapeHtml(project.name)}</h2>
            <p>${escapeHtml(getPropertyName(data, project.propertyId))} / ${escapeHtml(optionLabel(EXPENSE_CATEGORIES, project.category))} / ${escapeHtml(formatProjectDateRange(project))}</p>
          </div>
          <button class="icon-button" data-action="close-project-file" type="button" aria-label="Close">×</button>
        </div>
        <div class="project-file-summary">
          ${storageMetric("Status", optionLabel(PROJECT_STATUSES, project.status))}
          ${storageMetric("Expenses", `${projectExpenses.length} / ${formatCurrency(totals.total)}`)}
          ${storageMetric("Documents", projectDocuments.length)}
          ${storageMetric("Items to finish", getProjectRecordStatusLabel(project, projectFollowUps, completeness))}
        </div>
        <div class="project-preview-actions">
          <button class="button button-secondary" data-action="edit-project" data-id="${escapeAttr(project.id)}" type="button">Edit project details</button>
          <button class="button button-secondary" data-action="add-expense" data-project-id="${escapeAttr(project.id)}" type="button"><span aria-hidden="true">+</span>Add expense to this project</button>
          <button class="button button-primary" data-action="add-document" data-project-id="${escapeAttr(project.id)}" type="button"><span aria-hidden="true">+</span>Attach document to this project</button>
        </div>
        <div class="project-card-detail">
          ${renderProjectDetail(project)}
        </div>
      </section>
    </div>
  `;
}

function renderActiveProjectFileModal() {
  const project = activeProjectFileId
    ? data.projects.find((currentProject) => currentProject.id === activeProjectFileId)
    : null;
  return project ? renderProjectFileModal(project) : "";
}

function renderExpenseFormModal(expense) {
  const project = getExpenseFormContextProject(expense);
  const isEditing = Boolean(expense);
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">${project ? "Project expense" : "Expense"}</p>
            <h2 id="expense-form-title">${isEditing ? "Edit expense" : "Add expense"}</h2>
            <p>${escapeHtml(project ? `${project.name} / ${getPropertyName(data, project.propertyId)}` : "Save the cost, vendor, category, and receipt status.")}</p>
          </div>
          <button class="icon-button" data-action="close-expense-form" type="button" aria-label="Close">×</button>
        </div>
        ${project ? renderContextBanner("Linked project", project.name, "This expense will be linked to the selected project.") : ""}
        ${renderExpenseForm(expense || null)}
      </section>
    </div>
  `;
}

function renderDocumentFormModal(documentRecord) {
  const context = getDocumentFormContext(documentRecord);
  const title = documentRecord
    ? documentFileInputAllowed || !documentRecord.hasFile ? "Attach file" : "Edit document"
    : "Add document";
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal" role="dialog" aria-modal="true" aria-labelledby="document-form-title">
        <div class="modal-header">
          <div>
            <h2 id="document-form-title">${escapeHtml(title)}</h2>
            ${context.subtitle ? `<p>${escapeHtml(context.subtitle)}</p>` : ""}
          </div>
          <button class="icon-button" data-action="close-document-form" type="button" aria-label="Close">×</button>
        </div>
        ${renderDocumentForm(documentRecord || null, context)}
      </section>
    </div>
  `;
}

function renderContextBanner(label, title, copy) {
  return `
    <div class="workflow-context-banner">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(copy)}</p>
    </div>
  `;
}

function getExpenseFormContextProject(expense) {
  const projectId = expense?.projectId || draftExpenseProjectId || "";
  return projectId ? data.projects.find((project) => project.id === projectId) || null : null;
}

function getDocumentFormContext(documentRecord) {
  const expense = data.expenses.find((currentExpense) =>
    currentExpense.id === (documentRecord?.expenseId || draftDocumentExpenseId)
  );
  const project = data.projects.find((currentProject) =>
    currentProject.id === (documentRecord?.projectId || draftDocumentProjectId || expense?.projectId)
  );
  if (expense) {
    return {
      subtitle: [getPropertyName(data, expense.propertyId), expense.projectId ? getProjectName(data, expense.projectId) : ""].filter(Boolean).join(" · "),
    };
  }
  if (project) {
    return {
      subtitle: `${getPropertyName(data, project.propertyId)} · ${project.name}`,
    };
  }
  return {
    subtitle: "",
  };
}

function formatProjectDateRange(project) {
  const start = formatDate(project.startDate);
  const end = formatDate(project.completionDate);
  if (project.startDate && project.completionDate) return `${start} - ${end}`;
  if (project.startDate) return `${start} - not completed`;
  if (project.completionDate) return `Completed ${end}`;
  return "Not added";
}

function renderProjectRowTitle(project, isSelected) {
  return `
    <div class="project-row-title">
      <button class="table-link" data-action="select-project" data-id="${escapeAttr(project.id)}" aria-expanded="${isSelected ? "true" : "false"}" type="button">${escapeHtml(project.name)}</button>
    </div>
  `;
}

function renderExpensesTable(expenses) {
  return `
    <div class="table-wrap compact-table-wrap">
      <table class="compact-record-table expense-record-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Expense</th>
            <th>Project</th>
            <th>Cost type</th>
            <th>Docs</th>
            <th class="align-right">Amount</th>
            <th class="align-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map((expense) => renderExpenseTableRow(expense)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderExpenseTableRow(expense) {
  const documentState = getExpenseDocumentState(expense);
  return `
    <tr>
      <td data-label="Date">${formatDate(expense.date)}</td>
      <td class="record-name-cell" data-label="Expense">
        <strong>${escapeHtml(getExpenseVendorName(data, expense))}</strong>
        <span>${escapeHtml(expense.description)}${expense.vendorId || expense.vendor ? "" : " / Add vendor when known"}</span>
      </td>
      <td data-label="Project">${escapeHtml(getProjectName(data, expense.projectId))}</td>
      <td data-label="Cost type">${classificationPill(expense.classification)}</td>
      <td class="expense-doc-cell" data-label="Docs">
        <span class="pill ${escapeAttr(documentState.tone)}">${escapeHtml(documentState.label)}</span>
      </td>
      <td class="align-right" data-label="Amount"><strong class="money">${formatCurrency(expense.amount)}</strong></td>
      <td class="align-right" data-label="Actions">
        <div class="table-actions">
          ${documentState.documents.length ? `<button class="button button-secondary" data-action="view-expense-documents" data-id="${escapeAttr(expense.id)}" type="button">View docs</button>` : ""}
          <button class="button ${documentState.documents.length ? "button-secondary" : "button-primary"}" data-action="add-document-for-expense" data-id="${escapeAttr(expense.id)}" type="button">${escapeHtml(documentState.documents.length ? "Add doc" : documentState.actionLabel)}</button>
          ${rowActions("edit-expense", "delete-expense", expense.id, expense.description)}
        </div>
      </td>
    </tr>
  `;
}

function getLinkedExpenseDocuments(expense) {
  return sortDocumentsByAddedDateDesc(data.documents.filter((document) => document.expenseId === expense.id));
}

function getPreferredDocumentTypeForExpense(expense) {
  if (expense?.documentationStatus === "invoice attached") return "invoice";
  return "receipt";
}

function getExpenseDocumentState(expense) {
  const documents = getLinkedExpenseDocuments(expense);
  const evidenceDocuments = documents.filter((document) => ["receipt", "invoice"].includes(document.documentType));
  const storedInvoice = evidenceDocuments.find((document) => document.documentType === "invoice" && document.hasFile);
  const storedReceipt = evidenceDocuments.find((document) => document.documentType === "receipt" && document.hasFile);
  const linkedInvoice = evidenceDocuments.find((document) => document.documentType === "invoice");
  const linkedReceipt = evidenceDocuments.find((document) => document.documentType === "receipt");
  const preferredType = getPreferredDocumentTypeForExpense(expense);

  if (storedInvoice || storedReceipt) {
    const document = storedInvoice || storedReceipt;
    return {
      documents,
      tone: "tone-green",
      label: `${optionLabel(DOCUMENT_TYPES, document.documentType)} linked`,
      detail: document.fileName ? `${document.fileName} is attached to this expense.` : "A stored document is attached to this expense.",
      actionLabel: "Add another document",
      preferredType,
    };
  }

  if (linkedInvoice || linkedReceipt) {
    const document = linkedInvoice || linkedReceipt;
    return {
      documents,
      tone: "tone-amber",
      label: `${optionLabel(DOCUMENT_TYPES, document.documentType)} entry linked`,
      detail: "A document entry is linked, but no stored file is attached.",
      actionLabel: `Attach ${document.documentType}`,
      preferredType: document.documentType,
    };
  }

  if (documents.length) {
    return {
      documents,
      tone: "tone-blue",
      label: `${documents.length} document${documents.length === 1 ? "" : "s"} linked`,
      detail: "No receipt or invoice file is linked yet.",
      actionLabel: `Attach ${preferredType}`,
      preferredType,
    };
  }

  if (expense.documentationStatus === "invoice attached" || expense.documentationStatus === "receipt attached") {
    return {
      documents,
      tone: "tone-amber",
      label: `${optionLabel(DOCUMENT_STATUSES, expense.documentationStatus)} status`,
      detail: `This is marked documented. Attach or link a stored ${preferredType} when you have it.`,
      actionLabel: `Attach ${preferredType}`,
      preferredType,
    };
  }

  if (isDocumentationGap(expense)) {
    return {
      documents,
      tone: "tone-amber",
      label: "Needs document",
      detail: "Attach a receipt, invoice, or follow-up file.",
      actionLabel: `Attach ${preferredType}`,
      preferredType,
    };
  }

  return {
    documents,
    tone: "tone-blue",
    label: "No document linked",
    detail: "Attach a receipt, invoice, or note when available.",
    actionLabel: `Attach ${preferredType}`,
    preferredType,
  };
}

function getDraftDocumentDisplayName(expense) {
  if (!expense) return "";
  const type = getPreferredDocumentTypeForExpense(expense);
  const vendor = getExpenseVendorName(data, expense, "Expense");
  return `${vendor} - ${optionLabel(DOCUMENT_TYPES, type)}`;
}

function renderExpenseDocumentsModal() {
  const expense = expenseDocumentsPreviewId ? data.expenses.find((currentExpense) => currentExpense.id === expenseDocumentsPreviewId) : null;
  if (!expense) return "";

  const documents = getLinkedExpenseDocuments(expense);
  const documentState = getExpenseDocumentState(expense);

  return `
    <div class="modal-backdrop" role="presentation">
      <section class="form-modal expense-documents-modal" role="dialog" aria-modal="true" aria-labelledby="expense-documents-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Expense documents</p>
            <h2 id="expense-documents-title">${escapeHtml(getExpenseVendorName(data, expense))}</h2>
            <p>${escapeHtml(expense.description)} · ${formatCurrency(expense.amount)}</p>
          </div>
          <button class="icon-button" data-action="close-expense-documents" type="button" aria-label="Close">×</button>
        </div>
        <div class="expense-document-row is-modal-summary">
          <div>
            <span class="pill ${escapeAttr(documentState.tone)}">${escapeHtml(documentState.label)}</span>
            <p>${escapeHtml(documentState.detail)}</p>
          </div>
          <button class="button button-primary" data-action="add-document-for-expense" data-id="${escapeAttr(expense.id)}" type="button">${escapeHtml(documentState.actionLabel)}</button>
        </div>
        ${documents.length ? renderDocumentList(documents, { compactActions: true }) : renderEmpty("No linked documents yet", "Attach a receipt, invoice, or note for this expense.")}
      </section>
    </div>
  `;
}

function sortDocumentsByAddedDateDesc(documents) {
  return sortDocuments(documents, "date-desc");
}

function sortDocuments(documents, sortKey = "date-desc") {
  return [...documents].sort((a, b) => {
    if (sortKey === "date-asc") return String(a.addedDate || "").localeCompare(String(b.addedDate || ""));
    if (sortKey === "name-asc") return String(a.displayName || "").localeCompare(String(b.displayName || ""));
    if (sortKey === "name-desc") return String(b.displayName || "").localeCompare(String(a.displayName || ""));
    if (sortKey === "type-asc") {
      const typeCompare = optionLabel(DOCUMENT_TYPES, a.documentType).localeCompare(optionLabel(DOCUMENT_TYPES, b.documentType));
      return typeCompare || String(b.addedDate || "").localeCompare(String(a.addedDate || ""));
    }
    return String(b.addedDate || "").localeCompare(String(a.addedDate || ""));
  });
}

function renderDocumentsTable(documents) {
  return `
    <div class="table-wrap document-table-wrap">
      <table class="document-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Type</th>
            <th>Added</th>
            <th>Property</th>
            <th>Linked to</th>
            <th>File</th>
            <th class="align-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${documents.map((document) => renderDocumentTableRow(document)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDocumentTableRow(document) {
  const fileState = getDocumentDisplayFileState(document);
  const linkedTo = [
    document.projectId ? getProjectName(data, document.projectId) : "",
    document.expenseId ? getExpenseName(data, document.expenseId) : "",
  ].filter(Boolean).join(" / ");
  return `
    <tr>
      <td class="document-name-cell" data-label="Document">
        <strong>${escapeHtml(document.displayName)}</strong>
        ${document.notes ? `<span>${escapeHtml(document.notes)}</span>` : ""}
      </td>
      <td data-label="Type">${escapeHtml(optionLabel(DOCUMENT_TYPES, document.documentType))}</td>
      <td data-label="Added">${formatDate(document.addedDate)}</td>
      <td data-label="Property">${escapeHtml(getPropertyName(data, document.propertyId))}</td>
      <td data-label="Linked to">${linkedTo ? escapeHtml(linkedTo) : `<span class="muted-cell">Not linked</span>`}</td>
      <td class="document-file-cell" data-label="File">
        <span class="pill ${escapeAttr(fileState.tone)}">${escapeHtml(fileState.label)}</span>
        <span>${escapeHtml(fileState.meta || fileState.detail)}</span>
      </td>
      <td class="align-right" data-label="Actions">
        <div class="document-table-actions">
          ${fileState.hasRealFile
            ? `<button class="button button-secondary" data-action="preview-document-file" data-id="${escapeAttr(document.id)}" type="button">View file</button>`
            : `<button class="button button-primary" data-action="edit-document" data-id="${escapeAttr(document.id)}" type="button">Attach file</button>`}
          ${rowActions("edit-document", "delete-document", document.id, document.displayName)}
        </div>
      </td>
    </tr>
  `;
}

function renderDocumentList(documents = data.documents, options = {}) {
  return `
    <div class="document-list">
      ${documents.map((document) => {
        const fileState = getDocumentDisplayFileState(document);
        const canReadText = fileState.hasRealFile && canReadStoredFileText(document, document.mimeType);
        return `
          <article class="document-card document-row-card">
            <span class="document-icon" aria-hidden="true">${iconSymbol(document.documentType === "photo" ? "image" : "document")}</span>
            <div class="document-body">
              <h3>${escapeHtml(document.displayName)}</h3>
              <p>${escapeHtml(optionLabel(DOCUMENT_TYPES, document.documentType))} entry · ${formatDate(document.addedDate)}</p>
              <p>${escapeHtml(getPropertyName(data, document.propertyId))}${document.projectId ? ` / ${escapeHtml(getProjectName(data, document.projectId))}` : ""}${document.expenseId ? ` / ${escapeHtml(getExpenseName(data, document.expenseId))}` : ""}</p>
              ${renderDocumentFileMeta(document, fileState)}
              ${document.notes ? `<p class="notes-block">${escapeHtml(document.notes)}</p>` : ""}
            </div>
            <div class="document-actions">
              ${fileState.hasRealFile
                ? `<button class="button button-primary" data-action="preview-document-file" data-id="${escapeAttr(document.id)}" type="button">View file</button>`
                : `<button class="button button-primary" data-action="edit-document" data-id="${escapeAttr(document.id)}" type="button">Attach file</button>`}
              ${fileState.hasRealFile && !options.compactActions ? `<button class="button button-secondary" data-action="download-document-file" data-id="${escapeAttr(document.id)}" type="button">Download file</button>` : ""}
              ${fileState.hasRealFile && !options.compactActions && canReadText ? `<button class="button button-secondary" data-action="run-document-ocr" data-id="${escapeAttr(document.id)}" type="button">Read document text</button>` : ""}
              ${fileState.hasRealFile && !options.compactActions ? `<button class="button button-secondary" data-action="remove-document-file" data-id="${escapeAttr(document.id)}" type="button">Remove file</button>` : ""}
              ${rowActions("edit-document", "delete-document", document.id, document.displayName)}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function getDocumentFileStatus(document) {
  const fileState = getDocumentDisplayFileState(document);
  if (fileState.hasRealFile) return "stored";
  if (fileState.key !== "no-file") return "needs-follow-up";
  return "no-file";
}

function createTutorialFileId(documentId) {
  return `tutorial-file-${documentId || createId("document")}`;
}

function isTutorialFileId(fileId) {
  return String(fileId || "").startsWith("tutorial-file-");
}

function isTutorialDocumentFile(document) {
  return isTutorialMode() && document?.hasFile && isTutorialFileId(document.fileId || document.id);
}

function isTutorialDocumentMetadata(document) {
  return Boolean(isTutorialMode() && (
    isTutorialFileId(document?.fileId || document?.id || "") ||
    /tutorial sample|tutorial file metadata|sample metadata|sample file details/i.test(document?.fileStatusNote || "")
  ));
}

function getDocumentDisplayFileState(document) {
  const hasTutorialMetadata = isTutorialDocumentMetadata(document);
  const isRestoredMissingFile = isRestoredDocumentFileState(document);
  if (hasTutorialMetadata) {
    return {
      key: "tutorial-metadata",
      label: "Sample file details",
      tone: "tone-blue",
      hasRealFile: false,
      detail: document.fileStatusNote || "This entry has sample file details, but no real file copy is stored.",
      meta: `${document.fileName || "Tutorial file"} / ${document.mimeType || "Unknown type"} / ${formatFileSize(document.fileSize)}`,
    };
  }
  if (document.hasFile) {
    return {
      key: "file-attached",
      label: "File attached",
      tone: "tone-green",
      hasRealFile: true,
      detail: "A stored file copy is attached to this document entry.",
      meta: `${document.fileName || "Attached file"} / ${document.mimeType || "Unknown type"} / ${formatFileSize(document.fileSize)}`,
    };
  }
  if (isRestoredMissingFile) {
    return {
      key: "restored-without-file",
      label: "Restored without the attached file",
      tone: "tone-amber",
      hasRealFile: false,
      detail: document.fileStatusNote || "This document entry was restored, but the file content was not included.",
      meta: "",
    };
  }
  if (document.fileStatusNote) {
    return {
      key: "file-needs-follow-up",
      label: "File needs follow-up",
      tone: "tone-amber",
      hasRealFile: false,
      detail: document.fileStatusNote,
      meta: "",
    };
  }
  return {
    key: "no-file",
    label: "No file attached",
    tone: "tone-amber",
    hasRealFile: false,
    detail: "The document entry is saved, but no file copy is attached yet.",
    meta: "",
  };
}

function isRestoredDocumentFileState(document) {
  return /restored|skipped|not included|not restored/i.test(document?.fileStatusNote || "");
}

function renderDocumentFileMeta(document, fileState = getDocumentDisplayFileState(document)) {
  return `
    <p>
      <span class="pill ${escapeAttr(fileState.tone)}">${escapeHtml(fileState.label)}</span>
      ${fileState.meta ? `<span class="file-meta">${escapeHtml(fileState.meta)}</span>` : ""}
    </p>
    <p class="file-status-note">${escapeHtml(fileState.detail)}</p>
  `;
}

function renderDocumentPreview() {
  if (!documentPreview) return "";

  const documentRecord = data.documents.find((document) => document.id === documentPreview.documentId);
  if (!documentRecord) return "";

  const title = documentRecord.displayName || documentPreview.fileName || "Document preview";
  const canPreview = documentPreview.status === "ready" && isPreviewableStoredFile(documentRecord, documentPreview.mimeType);
  const canReadText = documentPreview.status === "ready" && canReadStoredFileText(documentRecord, documentPreview.mimeType);
  const isPdf = canPreview && isPdfFile(documentRecord, documentPreview.mimeType);
  const isImage = canPreview && isImageFile(documentRecord, documentPreview.mimeType);
  const ocrCopy = getOcrStatusCopy();

  return `
    <div class="modal-backdrop" role="presentation">
      <section class="document-preview-modal" role="dialog" aria-modal="true" aria-labelledby="document-preview-title">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Document reader</p>
            <h2 id="document-preview-title">${escapeHtml(title)}</h2>
            <p>${escapeHtml(documentPreview.fileName || documentRecord.fileName || "Attached file")} / ${escapeHtml(documentPreview.mimeType || documentRecord.mimeType || "Unknown type")}</p>
          </div>
          <button class="icon-button" data-action="close-document-preview" type="button" aria-label="Close">×</button>
        </div>

        <div class="document-preview-grid">
          <div class="document-preview-frame">
            ${documentPreview.status === "loading" ? `<div class="preview-empty">Loading stored file...</div>` : ""}
            ${documentPreview.status === "error" ? `<div class="preview-empty">${escapeHtml(documentPreview.error || "The stored file could not be opened.")}</div>` : ""}
            ${documentPreview.status === "ready" && isImage ? `<img src="${escapeAttr(documentPreview.objectUrl)}" alt="${escapeAttr(title)}">` : ""}
            ${documentPreview.status === "ready" && isPdf ? `<iframe title="${escapeAttr(title)}" src="${escapeAttr(documentPreview.objectUrl)}"></iframe>` : ""}
            ${documentPreview.status === "ready" && !canPreview ? `
              <div class="preview-empty">
                <strong>Preview unavailable</strong>
                <span>This file type cannot be previewed in the app. You can still download the stored copy.</span>
              </div>
            ` : ""}
          </div>

          <form class="preview-side-panel" data-form="document-preview-notes" novalidate>
            <input type="hidden" name="id" value="${escapeAttr(documentRecord.id)}">
            ${textarea("Document notes", "notes", documentRecord.notes || "")}
            <label class="field">
              <span>Document text</span>
              <textarea name="ocrText" rows="8">${escapeHtml(documentRecord.ocrText || documentPreview.ocrText || "")}</textarea>
            </label>
            ${ocrCopy ? `<p class="helper-note">${escapeHtml(ocrCopy)}</p>` : ""}
            <div class="form-actions preview-actions">
              <button class="button button-secondary" data-action="download-document-file" data-id="${escapeAttr(documentRecord.id)}" type="button">Download file</button>
              <button class="button button-secondary" data-action="run-document-ocr" data-id="${escapeAttr(documentRecord.id)}" ${canReadText && documentPreview.ocrStatus !== "running" ? "" : "disabled"} type="button">Read document text</button>
              <button class="button button-secondary" data-action="remove-document-file" data-id="${escapeAttr(documentRecord.id)}" type="button">Remove file</button>
              <button class="button button-primary" type="submit">Save notes</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  `;
}

function getOcrStatusCopy() {
  if (!documentPreview) return "";
  const documentRecord = data.documents.find((document) => document.id === documentPreview.documentId);
  if (documentPreview.ocrStatus === "running") {
    return documentPreview.ocrStatusCopy || `Reading document... ${Math.round((documentPreview.ocrProgress || 0) * 100)}%`;
  }
  if (documentPreview.ocrStatus === "done") return "Text saved with this document entry.";
  if (documentPreview.ocrStatus === "error") return documentPreview.ocrError || "This file could not be read.";
  if (documentPreview.status === "ready") {
    const processor = getDocumentTextProcessor(documentRecord, documentPreview.mimeType);
    if (!processor) {
      return "Text reading is available for images, PDFs, and plain text files in this version.";
    }
    return processor.readyCopy;
  }
  return "Text reading is available after the file opens.";
}

function renderProjectDetail(project) {
  const completeness = getProjectCompleteness(data, project);
  const visibleCompleteness = getProjectTabCompleteness(completeness);
  const projectFollowUps = getProjectFollowUps(project.id);
  const projectDocuments = data.documents.filter((document) => document.projectId === project.id);
  const projectExpenses = data.expenses.filter((expense) => expense.projectId === project.id);

  return `
    <div class="project-inline-detail">
      <div>
        <p class="eyebrow">Project file</p>
        <dl class="detail-list project-detail-list project-detail-grid">
          ${renderEditableProjectField(project, "scopeSummary", "Project description", project.scopeSummary || "Not added")}
          ${renderEditableProjectField(project, "notes", "Notes", project.notes || "Not added")}
          ${renderEditableProjectField(project, "completenessOverrideNote", "Mark as complete with note", project.completenessOverrideNote || "Not added")}
          ${renderEditableProjectField(project, "permitNumber", "Permit number", project.permitNumber || "Not added")}
        </dl>
        ${renderLinkedProjectRecords(project, projectDocuments, projectExpenses)}
        ${renderProjectOverrideHistory(project.id)}
      </div>
      ${renderProjectCompletenessPanel(visibleCompleteness, project, projectFollowUps)}
    </div>
  `;
}

function renderProjectOverrideHistory(projectId) {
  const overrides = getProjectFollowUpOverrides(projectId);
  if (!overrides.length) return "";
  return `
    <div class="override-history">
      <h3>Overridden follow-ups</h3>
      <ul>
        ${overrides.map((override) => `
          <li>
            <strong>${escapeHtml(override.label || "Follow-up marked complete")}</strong>
            <span>${escapeHtml(override.note || "Marked complete by override.")}</span>
          </li>
        `).join("")}
      </ul>
    </div>
  `;
}

function getProjectFollowUpOverrides(projectId) {
  return (data.followUpOverrides || []).filter((override) => override.projectId === projectId);
}

function renderLinkedProjectRecords(project, projectDocuments, projectExpenses) {
  const receiptCount = projectDocuments.filter((document) => document.documentType === "receipt").length;
  const permitCount = projectDocuments.filter((document) => document.documentType === "permit").length;
  const photoCount = projectDocuments.filter((document) => document.documentType === "photo").length;
  const totals = getExpenseTotals(projectExpenses);

  return `
    <div class="linked-records-panel">
      <div class="linked-records-header">
        <div>
          <p class="eyebrow">Linked items</p>
          <h3>Supporting documents and expenses</h3>
        </div>
      </div>
      <div class="linked-record-grid">
        ${storageMetric("Documents", projectDocuments.length)}
        ${storageMetric("Expenses", projectExpenses.length)}
        ${storageMetric("Receipts", receiptCount)}
        ${storageMetric("Photos", photoCount)}
        ${storageMetric("Permits", permitCount || (project.permitNumber ? 1 : 0))}
        ${storageMetric("Expense total", formatCurrency(totals.total))}
      </div>
      ${projectDocuments.length || projectExpenses.length
        ? `<p class="helper-note">Use the Documents and Expenses tabs to review linked items in detail.</p>`
        : renderEmpty("No linked items yet", "Add a document or connect expenses when details are available.")}
    </div>
  `;
}

function renderProjectCompletenessPanel(completeness, project, projectFollowUps = getProjectFollowUps(project.id)) {
  if (completeness.isOverridden) {
    return `
      <div class="project-completeness">
        <div class="manual-completeness-note">
          <h3>Marked complete with note</h3>
          <p>${escapeHtml(completeness.overrideNote || project.completenessOverrideNote || "Note added.")}</p>
          <p class="helper-note">This removes the project from Items to finish. It is only your note about the paperwork you have, not a certification or tax/legal conclusion.</p>
          <button class="button button-secondary" data-action="edit-project-field" data-field="completenessOverrideNote" type="button">Edit note</button>
        </div>
      </div>
    `;
  }

  const readyItems = completeness.readyItems.slice(0, 5);

  return `
    <div class="project-completeness">
      <div class="readiness-columns project-completeness-columns">
        <div>
          <h3>Project checklist</h3>
          ${readyItems.length ? `
            <ul class="check-list">
              ${readyItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          ` : `<p class="helper-note">Add dates, project details, and documents to build project readiness.</p>`}
        </div>
        <div>
          <h3>Items to finish</h3>
          ${projectFollowUps.length
            ? renderFollowUpActionList(projectFollowUps, "No project items to finish right now.")
            : `<p class="helper-note">No project items to finish right now.</p>`}
          <div class="project-document-action">
            <button class="button button-secondary" data-action="add-document" data-project-id="${escapeAttr(project.id)}" type="button"><span aria-hidden="true">+</span>Add document</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getProjectTabCompleteness(completeness) {
  if (completeness.isOverridden) {
    return {
      ...completeness,
      score: 100,
      completedChecks: completeness.totalChecks,
      readyItems: ["Marked complete with note"],
      followUps: [],
      missingExpectedDocumentTypes: [],
    };
  }

  const hiddenCheckLabels = new Set([
    "Costs linked",
    "Receipt and invoice files linked",
    "Review treatment choices",
  ]);
  const visibleExpectedDocumentTypes = completeness.missingExpectedDocumentTypes.filter((type) =>
    !["receipt/invoice", "payment record"].includes(type.value)
  );
  const checks = completeness.checks
    .filter((check) => !hiddenCheckLabels.has(check.label))
    .map((check) => {
      if (check.label === "Contractor or vendor identified") {
        return { ...check, followUp: "Add the contractor/vendor for this project." };
      }
      if (check.label === "Supporting documents linked") {
        return { ...check, followUp: "Link project documents, permits, photos, or notes to this project." };
      }
      if (check.label === "Expected document types covered") {
        return { ...check, done: visibleExpectedDocumentTypes.length === 0 };
      }
      return check;
    });
  const completedChecks = checks.filter((check) => check.done).length;
  const totalChecks = checks.length || 1;

  return {
    ...completeness,
    score: Math.round((completedChecks / totalChecks) * 100),
    completedChecks,
    totalChecks,
    checks,
    readyItems: checks.filter((check) => check.done).map((check) => check.label),
    followUps: [
      ...checks.filter((check) => !check.done).map((check) => check.followUp),
      ...visibleExpectedDocumentTypes.map((item) => `Add a ${item.label.toLowerCase()} if available or applicable.`),
    ].filter(Boolean),
    missingExpectedDocumentTypes: visibleExpectedDocumentTypes,
  };
}

function getProjectRecordStatusLabel(project, projectFollowUps, completeness) {
  if (project.completenessOverrideNote || completeness.isOverridden) return "Marked complete";
  if (!projectFollowUps.length) return "Complete";
  return `${projectFollowUps.length} to finish`;
}

function renderExportPropertiesTable() {
  return table(["Property", "Purchase date", "Purchase price", "Tracked spend"], data.properties.map((property) => {
    const propertyTotal = getExpenseTotals(data.expenses.filter((expense) => expense.propertyId === property.id)).total;
    return [
      `<strong>${escapeHtml(property.name)}</strong><span>${escapeHtml(property.address || "Address not added")}</span>`,
      escapeHtml(formatDate(property.purchaseDate)),
      escapeHtml(property.purchasePrice ? formatCurrency(property.purchasePrice) : "Not added"),
      `<span class="money">${formatCurrency(propertyTotal)}</span>`,
    ];
  }));
}

function renderExportProjectsTable() {
  return table(["Project", "Property", "Status", "Items to finish", "Dates", "Contractor", "Permit", "Spend", "Documents"], getProjectReviewSummaries(data).map((summary) => {
    const projectFollowUpCount = getProjectFollowUps(summary.project.id).length;
    return [
      `<strong>${escapeHtml(summary.project.name)}</strong><span>${summary.project.scopeSummary ? escapeHtml(summary.project.scopeSummary) : "Project description not added"}</span>`,
      escapeHtml(getPropertyName(data, summary.project.propertyId)),
      escapeHtml(optionLabel(PROJECT_STATUSES, summary.project.status)),
      `<span class="pill ${scoreToneClass(summary.completeness.score)}">${summary.completeness.score}%</span><span>${summary.completeness.isOverridden ? "Marked complete with note" : `${summary.completeness.completedChecks}/${summary.completeness.totalChecks} checks`}</span>`,
      escapeHtml(summary.dateRange),
      escapeHtml(getProjectVendorName(data, summary.project, "Not added")),
      escapeHtml(summary.project.permitNumber || (summary.hasPermit ? "Permit attached" : "Not added")),
      `<span class="money">${formatCurrency(summary.totals.total)}</span>`,
      escapeHtml(`${summary.documents.length} (${projectFollowUpCount} to finish)`),
    ];
  }));
}

function renderExportFollowUpChecklist(followUps) {
  return `
    <div class="export-readiness">
      <strong>${followUps.length ? `${followUps.length} item${followUps.length === 1 ? "" : "s"}` : "No items"}</strong>
      <span>These are items to review before sharing the packet.</span>
    </div>
    ${followUps.length ? renderExportFollowUpsTable(followUps) : `<p class="helper-note">Nothing needs review before sharing.</p>`}
  `;
}

function renderExportExpensesTable() {
  return table(["Date", "Property", "Project", "Vendor", "Description", "Cost type", "Receipt/file", "Amount"], sortByDateDesc(data.expenses).map((expense) => [
    escapeHtml(formatDate(expense.date)),
    escapeHtml(getPropertyName(data, expense.propertyId)),
    escapeHtml(getProjectName(data, expense.projectId)),
    escapeHtml(getExpenseVendorName(data, expense)),
    escapeHtml(expense.description),
    escapeHtml(getProfessionalClassificationLabel(expense.classification)),
    escapeHtml(optionLabel(DOCUMENT_STATUSES, expense.documentationStatus)),
    `<span class="money">${formatCurrency(expense.amount)}</span>`,
  ]));
}

function renderExportFollowUpsTable(followUps) {
  return table(["Item", "Record", "Action", "Opens"], followUps.map((item) => [
    `<strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.typeLabel)}</span>`,
    escapeHtml(getFollowUpRecordLabel(item)),
    escapeHtml(item.primaryAction?.label || item.label),
    escapeHtml(item.primaryAction?.copy || ""),
  ]));
}

function renderExportDocumentsTable() {
  return table(["Document", "Property", "Project", "Linked expense", "Type", "Stored file", "Added"], data.documents.map((document) => {
    const relatedExpense = data.expenses.find((expense) => expense.id === document.expenseId);
    const fileState = getDocumentDisplayFileState(document);
    return [
      `<strong>${escapeHtml(document.displayName)}</strong><span>${document.notes ? escapeHtml(document.notes) : "No notes"}</span>`,
      escapeHtml(getPropertyName(data, document.propertyId)),
      escapeHtml(getProjectName(data, document.projectId)),
      relatedExpense ? escapeHtml(`${getExpenseVendorName(data, relatedExpense)} / ${relatedExpense.description}`) : "No expense",
      escapeHtml(optionLabel(DOCUMENT_TYPES, document.documentType)),
      fileState.hasRealFile
        ? `<strong>${escapeHtml(fileState.label)}</strong><span>${escapeHtml(fileState.meta)}</span>`
        : `<strong>${escapeHtml(fileState.label)}</strong><span>${escapeHtml(fileState.detail)}</span>`,
      escapeHtml(formatDate(document.addedDate)),
    ];
  }));
}

async function handleClick(event) {
  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) {
    rememberFocusTarget(tabButton);
    navigateToTab(tabButton.dataset.tab);
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  if (actionButton.tagName === "A") event.preventDefault();
  const { action, id } = actionButton.dataset;
  if (!isDialogCloseAction(action)) rememberFocusTarget(actionButton);
  if (actionButton.closest(".records-to-finish-modal") && action !== "close-records-to-finish") {
    recordsToFinishOpen = false;
  }

  if (action === "start-tutorial") {
    enterTutorialWorkspace();
    return;
  } else if (action === "exit-tutorial") {
    exitTutorialWorkspace();
    return;
  } else if (action === "reset-tutorial") {
    resetTutorialWorkspace();
    return;
  } else if (action === "open-tutorial-step") {
    if (!isTutorialMode()) {
      enterTutorialWorkspace({ targetTab: actionButton.dataset.tutorialTab || "tutorial" });
    } else {
      activeTab = actionButton.dataset.tutorialTab || "tutorial";
      closeEditors();
      render();
    }
    return;
  } else if (action === "open-settings") {
    navigateToTab("settings");
  } else if (action === "dashboard-nav") {
    applyDashboardNavigation(actionButton);
  } else if (action === "set-dashboard-subtab") {
    dashboardSubTab = actionButton.dataset.dashboardSubtab === DASHBOARD_TAB_ATTENTION ? DASHBOARD_TAB_ATTENTION : DASHBOARD_TAB_ACTIVITY;
  } else if (action === "clear-dashboard-activity-filter") {
    dashboardActivityFilter = EMPTY_FILTER;
  } else if (action === "set-document-subtab") {
    documentSubTab = DOCUMENT_TAB_LIBRARY;
    editingDocumentId = undefined;
    documentFileInputAllowed = false;
    draftDocumentExpenseId = "";
    draftDocumentProjectId = "";
  } else if (action === "set-calculator") {
    const calculator = actionButton.dataset.calculator || "sales";
    activeCalculator = ["sales", "basis", "project"].includes(calculator) ? calculator : "sales";
  } else if (action === "clear-project-filters") {
    projectFilters.propertyId = EMPTY_FILTER;
    projectFilters.status = EMPTY_FILTER;
    projectFilters.category = EMPTY_FILTER;
    projectFilters.openItems = EMPTY_FILTER;
    projectFilters.startDateFrom = "";
    projectFilters.startDateTo = "";
    projectFilters.completionDateFrom = "";
    projectFilters.completionDateTo = "";
  } else if (action === "clear-expense-filters") {
    expenseFilters.propertyId = EMPTY_FILTER;
    expenseFilters.projectId = EMPTY_FILTER;
    expenseFilters.classification = EMPTY_FILTER;
    expenseFilters.category = EMPTY_FILTER;
    expenseFilters.documentationStatus = EMPTY_FILTER;
    expenseFilters.sort = "date-desc";
  } else if (action === "clear-document-filters") {
    documentFilters.propertyId = EMPTY_FILTER;
    documentFilters.documentType = EMPTY_FILTER;
    documentFilters.fileStatus = EMPTY_FILTER;
    documentFilters.sort = "date-desc";
  } else if (action === "add-property") {
    activeTab = "property";
    propertyMode = "new";
    editingPropertyField = "";
  } else if (action === "open-property") {
    if (data.properties.some((property) => property.id === id)) {
      selectedPropertyId = id;
      projectFilters.propertyId = id;
      expenseFilters.propertyId = id;
    }
    activeTab = "property";
    propertyMode = "view";
    editingPropertyField = "";
  } else if (action === "edit-property-field") {
    if (data.properties.some((property) => property.id === id)) {
      selectedPropertyId = id;
      activeTab = "property";
      propertyMode = "view";
      projectFilters.propertyId = id;
      expenseFilters.propertyId = id;
    }
    editingPropertyField = actionButton.dataset.field || "";
  } else if (action === "cancel-property-field") {
    editingPropertyField = "";
  } else if (action === "set-primary-property") {
    await setPrimaryProperty(id);
  } else if (action === "toggle-dashboard-property") {
    if (expandedDashboardPropertyIds.has(id)) {
      expandedDashboardPropertyIds.delete(id);
    } else {
      expandedDashboardPropertyIds.add(id);
    }
  } else if (action === "open-records-to-finish") {
    recordsToFinishOpen = true;
  } else if (action === "close-records-to-finish") {
    recordsToFinishOpen = false;
  } else if (action === "toggle-project-followups") {
    if (expandedProjectFollowUpIds.has(id)) {
      expandedProjectFollowUpIds.delete(id);
    } else if (data.projects.some((project) => project.id === id)) {
      expandedProjectFollowUpIds.add(id);
    }
  } else if (action === "open-follow-up") {
    activeFollowUpItemId = actionButton.dataset.followUpId || "";
  } else if (action === "close-follow-up-resolution") {
    activeFollowUpItemId = "";
  } else if (action === "delete-property") {
    await deleteProperty(id);
  } else if (action === "add-project") {
    activeProjectFileId = "";
    returnToProjectFileId = "";
    propertyProjectPreviewId = "";
    if (actionButton.dataset.propertyId) {
      selectedPropertyId = actionButton.dataset.propertyId;
      projectFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
    }
    editingProjectId = null;
    editingProjectField = "";
  } else if (action === "open-project") {
    const project = data.projects.find((currentProject) => currentProject.id === id);
    if (project) {
      const stayOnDashboard = actionButton.dataset.dashboardOpen === "true";
      activeProjectFileId = project.id;
      returnToProjectFileId = "";
      propertyProjectPreviewId = "";
      selectedProjectId = project.id;
      selectedPropertyId = project.propertyId;
      if (!stayOnDashboard) {
        projectFilters.propertyId = project.propertyId || EMPTY_FILTER;
        projectFilters.status = EMPTY_FILTER;
        projectFilters.category = EMPTY_FILTER;
        projectFilters.openItems = EMPTY_FILTER;
      }
      editingProjectId = undefined;
      editingProjectField = "";
    }
  } else if (action === "edit-project") {
    activeProjectFileId = "";
    returnToProjectFileId = id;
    propertyProjectPreviewId = "";
    selectedProjectId = id;
    editingProjectId = id;
    editingProjectField = "";
  } else if (action === "view-property-project") {
    activeProjectFileId = id;
    returnToProjectFileId = "";
    propertyProjectPreviewId = "";
    selectedProjectId = id;
  } else if (action === "close-property-project-preview") {
    propertyProjectPreviewId = "";
  } else if (action === "close-project-file") {
    activeProjectFileId = "";
    returnToProjectFileId = "";
    editingProjectField = "";
  } else if (action === "edit-project-field") {
    editingProjectField = actionButton.dataset.field || "";
  } else if (action === "cancel-project-field") {
    editingProjectField = "";
  } else if (action === "select-project") {
    activeProjectFileId = id;
    returnToProjectFileId = "";
    selectedProjectId = id;
    editingProjectId = undefined;
    editingProjectField = "";
  } else if (action === "delete-project") {
    if (propertyProjectPreviewId === id) propertyProjectPreviewId = "";
    if (selectedProjectId === id) selectedProjectId = "";
    if (activeProjectFileId === id) activeProjectFileId = "";
    if (returnToProjectFileId === id) returnToProjectFileId = "";
    expandedProjectFollowUpIds.delete(id);
    await deleteProject(id);
  } else if (action === "manage-vendors") {
    captureExpenseFormDraft();
    vendorManagerOpen = true;
    editingVendorId = undefined;
  } else if (action === "close-vendor-manager") {
    vendorManagerOpen = false;
    editingVendorId = undefined;
  } else if (action === "add-vendor") {
    captureExpenseFormDraft();
    editingVendorId = null;
  } else if (action === "edit-vendor") {
    editingVendorId = id;
  } else if (action === "cancel-vendor-form") {
    editingVendorId = undefined;
  } else if (action === "add-expense") {
    activeProjectFileId = "";
    returnToProjectFileId = "";
    propertyProjectPreviewId = "";
    expenseDocumentsPreviewId = "";
    draftExpenseFormValues = null;
    draftExpenseProjectId = "";
    if (actionButton.dataset.projectId) {
      const project = data.projects.find((currentProject) => currentProject.id === actionButton.dataset.projectId);
      if (project) {
        selectedPropertyId = project.propertyId;
        selectedProjectId = project.id;
        draftExpenseProjectId = project.id;
        returnToProjectFileId = project.id;
        expenseFilters.propertyId = project.propertyId;
        expenseFilters.projectId = project.id;
      }
    }
    editingExpenseId = null;
  } else if (action === "edit-expense") {
    expenseDocumentsPreviewId = "";
    activeProjectFileId = "";
    returnToProjectFileId = "";
    editingExpenseId = id;
    draftExpenseFormValues = null;
    draftExpenseProjectId = "";
  } else if (action === "open-expense") {
    const expense = data.expenses.find((currentExpense) => currentExpense.id === id);
    if (expense) {
      const stayOnDashboard = actionButton.dataset.dashboardOpen === "true";
      selectedPropertyId = expense.propertyId;
      if (!stayOnDashboard) {
        expenseFilters.propertyId = expense.propertyId || EMPTY_FILTER;
        expenseFilters.projectId = expense.projectId || EMPTY_FILTER;
        expenseFilters.sort = "date-desc";
        activeTab = "expenses";
      }
      expenseDocumentsPreviewId = "";
      activeProjectFileId = "";
      returnToProjectFileId = "";
      editingExpenseId = id;
      draftExpenseFormValues = null;
      draftExpenseProjectId = "";
      if (!stayOnDashboard) setRouteHash("expenses");
    }
  } else if (action === "delete-expense") {
    if (expenseDocumentsPreviewId === id) expenseDocumentsPreviewId = "";
    await deleteExpense(id);
  } else if (action === "close-expense-form") {
    editingExpenseId = undefined;
    draftExpenseFormValues = null;
    draftExpenseProjectId = "";
    activeProjectFileId = returnToProjectFileId || activeProjectFileId;
    returnToProjectFileId = "";
  } else if (action === "add-document") {
    activeProjectFileId = "";
    returnToProjectFileId = "";
    propertyProjectPreviewId = "";
    expenseDocumentsPreviewId = "";
    documentSubTab = DOCUMENT_TAB_LIBRARY;
    draftDocumentProjectId = "";
    if (actionButton.dataset.projectId) {
      const project = data.projects.find((currentProject) => currentProject.id === actionButton.dataset.projectId);
      if (project) {
        selectedPropertyId = project.propertyId;
        selectedProjectId = project.id;
        documentFilters.propertyId = project.propertyId;
        draftDocumentProjectId = project.id;
        returnToProjectFileId = project.id;
      }
    }
    editingDocumentId = null;
    documentFileInputAllowed = true;
    draftDocumentExpenseId = "";
  } else if (action === "add-document-for-expense") {
    activeProjectFileId = "";
    returnToProjectFileId = "";
    propertyProjectPreviewId = "";
    expenseDocumentsPreviewId = "";
    const expense = data.expenses.find((currentExpense) => currentExpense.id === id);
    if (expense) {
      selectedPropertyId = expense.propertyId;
      selectedProjectId = expense.projectId || "";
      documentFilters.propertyId = expense.propertyId;
      draftDocumentProjectId = expense.projectId || "";
      returnToProjectFileId = expense.projectId || "";
    }
    documentSubTab = DOCUMENT_TAB_LIBRARY;
    editingDocumentId = null;
    documentFileInputAllowed = true;
    draftDocumentExpenseId = id;
  } else if (action === "view-expense-documents") {
    expenseDocumentsPreviewId = id;
  } else if (action === "close-expense-documents") {
    expenseDocumentsPreviewId = "";
  } else if (action === "edit-document") {
    activeProjectFileId = "";
    returnToProjectFileId = "";
    propertyProjectPreviewId = "";
    expenseDocumentsPreviewId = "";
    documentSubTab = DOCUMENT_TAB_LIBRARY;
    editingDocumentId = id;
    documentFileInputAllowed = !data.documents.find((currentDocument) => currentDocument.id === id)?.hasFile;
    draftDocumentExpenseId = "";
    draftDocumentProjectId = "";
  } else if (action === "open-document") {
    const documentRecord = data.documents.find((currentDocument) => currentDocument.id === id);
    if (documentRecord) {
      const stayOnDashboard = actionButton.dataset.dashboardOpen === "true";
      selectedPropertyId = documentRecord.propertyId;
      if (!stayOnDashboard) {
        documentFilters.propertyId = documentRecord.propertyId || EMPTY_FILTER;
        documentFilters.documentType = EMPTY_FILTER;
        documentFilters.fileStatus = EMPTY_FILTER;
        documentFilters.sort = "date-desc";
        activeTab = "documents";
      }
      activeProjectFileId = "";
      returnToProjectFileId = "";
      propertyProjectPreviewId = "";
      expenseDocumentsPreviewId = "";
      documentSubTab = DOCUMENT_TAB_LIBRARY;
      editingDocumentId = id;
      documentFileInputAllowed = !documentRecord.hasFile;
      draftDocumentExpenseId = "";
      draftDocumentProjectId = "";
      if (!stayOnDashboard) setRouteHash("documents");
    }
  } else if (action === "delete-document") {
    propertyProjectPreviewId = "";
    expenseDocumentsPreviewId = "";
    await deleteDocument(id);
  } else if (action === "preview-document-file") {
    propertyProjectPreviewId = "";
    expenseDocumentsPreviewId = "";
    await openDocumentPreview(id);
    return;
  } else if (action === "close-document-preview") {
    closeDocumentPreview();
    render();
    return;
  } else if (action === "run-document-ocr") {
    await runDocumentOcr(id);
    return;
  } else if (action === "download-document-file") {
    await downloadDocumentAttachment(id);
  } else if (action === "remove-document-file") {
    await removeDocumentAttachment(id);
  } else if (action === "close-document-form") {
    editingDocumentId = undefined;
    documentFileInputAllowed = false;
    draftDocumentExpenseId = "";
    draftDocumentProjectId = "";
    activeProjectFileId = returnToProjectFileId || activeProjectFileId;
    returnToProjectFileId = "";
  } else if (action === "open-export") {
    propertyProjectPreviewId = "";
    activeTab = "export";
  } else if (action === "download-csv") {
    const filename = isTutorialMode()
      ? `home-ledger-tutorial-expense-export-${todayISO()}.csv`
      : `home-ledger-expense-export-${todayISO()}.csv`;
    downloadTextFile(buildExpensesCsv(data), filename, "text/csv;charset=utf-8");
  } else if (action === "download-cpa-pdf") {
    await saveCpaReviewPdfFile();
  } else if (action === "download-full-backup") {
    await downloadFullBackup();
  } else if (action === "choose-backup-file") {
    app.querySelector("[data-restore-input]")?.click();
    return;
  } else if (action === "print-summary") {
    app.querySelector(".print-summary")?.setAttribute("open", "open");
    window.print();
  } else if (action === "cancel-form") {
    closeEditors();
  }

  render();
}

function handleKeydown(event) {
  const activeDialog = getActiveDialog();
  if (activeDialog) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeActiveDialog();
      return;
    }
    if (event.key === "Tab") {
      trapDialogFocus(event, activeDialog);
      return;
    }
  }

  handleTablistKeydown(event);
}

function handleTablistKeydown(event) {
  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return false;
  const tab = event.target.closest?.('[role="tab"]');
  const tablist = tab?.closest('[role="tablist"]');
  if (!tab || !tablist) return false;

  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]')).filter((item) => !item.disabled);
  const currentIndex = tabs.indexOf(tab);
  if (currentIndex < 0) return false;

  let nextIndex = currentIndex;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = tabs.length - 1;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % tabs.length;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;

  event.preventDefault();
  const nextTab = tabs[nextIndex];
  const selector = getStableFocusSelector(nextTab);
  pendingFocusSelector = selector;
  rememberFocusTarget(nextTab);
  nextTab.click();
  return true;
}

function getActiveDialog() {
  const dialogs = Array.from(app.querySelectorAll('[role="dialog"][aria-modal="true"]'));
  return dialogs.at(-1) || null;
}

function getDialogKey(dialog) {
  return dialog ? `${dialog.getAttribute("aria-labelledby") || ""}:${dialog.className || ""}` : "";
}

function syncModalFocus() {
  const dialog = getActiveDialog();
  if (!dialog) {
    if (activeDialogKey) {
      activeDialogKey = "";
      const selector = returnFocusSelector;
      if (selector) queueFocus(selector);
    }
    return;
  }

  const nextDialogKey = getDialogKey(dialog);
  if (nextDialogKey === activeDialogKey) return;
  activeDialogKey = nextDialogKey;
  dialog.setAttribute("tabindex", "-1");
  window.requestAnimationFrame(() => {
    const currentDialog = getActiveDialog();
    if (!currentDialog || getDialogKey(currentDialog) !== nextDialogKey) return;
    const focusTarget = getDialogFocusTarget(currentDialog);
    focusTarget.focus({ preventScroll: true });
  });
}

function getDialogFocusTarget(dialog) {
  return dialog.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])') ||
    dialog.querySelector('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ||
    dialog;
}

function trapDialogFocus(event, dialog) {
  const focusableElements = getFocusableElements(dialog);
  if (!focusableElements.length) {
    event.preventDefault();
    dialog.focus({ preventScroll: true });
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const currentElement = document.activeElement;

  if (event.shiftKey && currentElement === firstElement) {
    event.preventDefault();
    lastElement.focus({ preventScroll: true });
  } else if (!event.shiftKey && currentElement === lastElement) {
    event.preventDefault();
    firstElement.focus({ preventScroll: true });
  }
}

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll([
    'button:not([disabled])',
    'a[href]',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(","))).filter((element) =>
    !element.hidden &&
    element.getAttribute("aria-hidden") !== "true" &&
    !element.closest("[hidden]")
  );
}

function closeActiveDialog() {
  const dialog = getActiveDialog();
  const closeButton = dialog?.querySelector([
    '[data-action="close-document-preview"]',
    '[data-action="close-expense-documents"]',
    '[data-action="close-records-to-finish"]',
    '[data-action="close-follow-up-resolution"]',
    '[data-action="close-project-file"]',
    '[data-action="close-property-project-preview"]',
    '[data-action="close-vendor-manager"]',
    '[data-action="cancel-vendor-form"]',
    '[data-action="cancel-form"]',
  ].join(","));
  closeButton?.click();
}

function isDialogCloseAction(action) {
  return [
    "close-document-preview",
    "close-expense-documents",
    "close-records-to-finish",
    "close-follow-up-resolution",
    "close-project-file",
    "close-property-project-preview",
    "close-vendor-manager",
    "cancel-vendor-form",
    "cancel-form",
  ].includes(action);
}

function rememberFocusTarget(element) {
  const selector = getStableFocusSelector(element);
  if (selector) returnFocusSelector = selector;
}

function queueFocus(selector) {
  pendingFocusSelector = selector || pendingFocusSelector;
}

function restorePendingFocus() {
  if (!pendingFocusSelector || getActiveDialog()) return;
  const selector = pendingFocusSelector;
  pendingFocusSelector = "";
  window.requestAnimationFrame(() => {
    app.querySelector(selector)?.focus?.({ preventScroll: true });
  });
}

function getStableFocusSelector(element) {
  if (!element) return "";
  if (element.id) return `[id="${cssAttributeValue(element.id)}"]`;
  if (element.dataset?.tab) return `[data-tab="${cssAttributeValue(element.dataset.tab)}"]`;
  if (!element.dataset?.action) return "";

  let selector = `[data-action="${cssAttributeValue(element.dataset.action)}"]`;
  for (const key of ["id", "field", "calculator", "dashboardSubtab", "documentSubtab", "followUpId", "projectId", "propertyId", "tutorialTab"]) {
    if (element.dataset[key]) {
      selector += `[data-${kebabCase(key)}="${cssAttributeValue(element.dataset[key])}"]`;
    }
  }
  return selector;
}

function cssAttributeValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function handleChange(event) {
  const control = event.target;
  if (control.matches("[data-setting]")) {
    void handleSettingChange(control);
    return;
  }
  if (control.matches("[data-restore-input]")) {
    void restoreFromBackupFile(control.files?.[0]);
    control.value = "";
    return;
  }

  const filter = control.dataset.filter;
  if (!filter) {
    const projectCostForm = control.closest('[data-form="project-cost-plan"]');
    if (projectCostForm) {
      const values = Object.fromEntries(new FormData(projectCostForm).entries());
      if (control.name === "propertyId") {
        projectCostPlan = { ...projectCostPlan, ...values, propertyId: control.value, projectId: "" };
        render();
      } else if (control.name === "projectId") {
        projectCostPlan = { ...projectCostPlan, ...values, projectId: control.value };
      }
    }
    if (control.closest('[data-form="expense"]') && ["propertyId", "projectId"].includes(control.name)) {
      syncExpenseProjectOptions(control);
    }
    if (control.closest('[data-form="document"]') && ["propertyId", "expenseId", "file"].includes(control.name)) {
      syncDocumentRelationshipForm(control);
    }
    return;
  }

  if (filter === "selectedPropertyId") {
    selectedPropertyId = control.value;
    propertyProjectPreviewId = "";
    editingPropertyField = "";
    projectFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
    expenseFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
    expenseFilters.projectId = EMPTY_FILTER;
    documentFilters.propertyId = EMPTY_FILTER;
    documentFilters.sort = "date-desc";
  } else if (filter.startsWith("project.")) {
    const key = filter.replace("project.", "");
    projectFilters[key] = control.value;
  } else if (filter.startsWith("expense.")) {
    const key = filter.replace("expense.", "");
    expenseFilters[key] = control.value;
    if (key === "propertyId") expenseFilters.projectId = EMPTY_FILTER;
  } else if (filter.startsWith("document.")) {
    const key = filter.replace("document.", "");
    documentFilters[key] = key === "sort" && !control.value ? "date-desc" : control.value;
  } else if (filter === "dashboard.activityType") {
    dashboardActivityFilter = control.value || EMPTY_FILTER;
  } else if (filter === "calculator.basisPropertyId") {
    calculatorBasisPropertyId = control.value;
  }

  render();
}

function handleStorageEvent(event) {
  if (event.key !== STORAGE_KEY) return;
  try {
    realData = event.newValue ? sanitizeData(JSON.parse(event.newValue)) : sanitizeData(EMPTY_DATA);
    if (isTutorialMode()) {
      notice = "Your real home file changed in another browser window. Exit the tutorial to see the refreshed file.";
      syncNoticeToast();
      return;
    }
    data = realData;
    selectedPropertyId = data.properties[0]?.id || "";
    resetFiltersAfterRestore();
    closeEditors();
    notice = "Saved details changed in another browser window. This view has been refreshed.";
    render();
  } catch {
    // Ignore malformed external storage writes; the next normal load will sanitize again.
  }
}

async function handleSettingChange(control) {
  const setting = control.dataset.setting;
  if (setting === "themePreference") {
    setThemePreference(control.value);
    return;
  }
  if (setting === "primaryPropertyId") {
    await setPrimaryProperty(control.value);
  }
}

function syncExpenseProjectOptions(control) {
  const form = control.closest('[data-form="expense"]');
  const projectSelect = form.elements.projectId;
  const vendorSelect = form.elements.vendorId;
  const currentProjectId = projectSelect.value;
  const propertyId = form.elements.propertyId.value;
  const projectOptions = data.projects.filter((project) => project.propertyId === propertyId);
  const selectedProjectId = projectOptions.some((project) => project.id === currentProjectId) ? currentProjectId : "";

  if (control.name === "propertyId") {
    projectSelect.innerHTML = `${optionHtml("", "No project", selectedProjectId)}${projectOptions.map((project) => optionHtml(project.id, project.name, selectedProjectId)).join("")}`;
  }
  if (vendorSelect) {
    const selectedProject = data.projects.find((project) => project.id === projectSelect.value && project.propertyId === propertyId);
    const nextVendorId = selectedProject?.vendorId && !vendorSelect.value ? selectedProject.vendorId : vendorSelect.value;
    rebuildVendorSelectOptions(vendorSelect, nextVendorId);
  }
}

function rebuildVendorSelectOptions(vendorSelect, selectedVendorId = "") {
  const value = selectedVendorId || "";
  vendorSelect.innerHTML = `${optionHtml("", "Unassigned / unknown", value)}${getVendorSelectOptions({ selectedVendorId: value }).map((vendor) => optionHtml(vendor.value, vendor.label, value)).join("")}`;
}

function syncDocumentRelationshipForm(control) {
  const form = control.closest('[data-form="document"]');
  const propertySelect = form.elements.propertyId;
  const projectSelect = form.elements.projectId;
  const expenseSelect = form.elements.expenseId;

  if (control.name === "file") {
    const selectedFileName = removeLocalPaths(control.files?.[0]?.name || "").trim();
    if (selectedFileName && form.elements.displayName && !form.elements.displayName.value.trim()) {
      form.elements.displayName.value = selectedFileName;
    }
    return;
  }

  if (control.name === "expenseId" && control.value) {
    const linkedExpense = data.expenses.find((expense) => expense.id === control.value);
    if (linkedExpense) {
      propertySelect.value = linkedExpense.propertyId;
      rebuildDocumentRelationshipOptions(form, linkedExpense.propertyId, linkedExpense.projectId, linkedExpense.id);
      if (form.elements.documentType && !form.elements.id?.value) {
        form.elements.documentType.value = getPreferredDocumentTypeForExpense(linkedExpense);
      }
      if (form.elements.displayName && !form.elements.displayName.value.trim()) {
        form.elements.displayName.value = getDraftDocumentDisplayName(linkedExpense);
      }
      return;
    }
  }

  if (control.name === "propertyId") {
    rebuildDocumentRelationshipOptions(form, control.value, "", "");
  }
}

function rebuildDocumentRelationshipOptions(form, propertyId, selectedProjectId, selectedExpenseId) {
  const projectSelect = form.elements.projectId;
  const expenseSelect = form.elements.expenseId;
  const projectOptions = data.projects.filter((project) => project.propertyId === propertyId);
  const expenseOptions = data.expenses.filter((expense) => expense.propertyId === propertyId);

  projectSelect.innerHTML = `${optionHtml("", "No project", selectedProjectId)}${projectOptions.map((project) => optionHtml(project.id, project.name, selectedProjectId)).join("")}`;
  expenseSelect.innerHTML = `${optionHtml("", "No expense", selectedExpenseId)}${expenseOptions.map((expense) => optionHtml(expense.id, `${formatDate(expense.date)} / ${getExpenseVendorName(data, expense)} / ${formatCurrency(expense.amount)}`, selectedExpenseId)).join("")}`;
}

function isTutorialMode() {
  return workspaceMode === WORKSPACE_TUTORIAL;
}

function enterTutorialWorkspace({ targetTab = "tutorial" } = {}) {
  if (!isTutorialMode()) {
    realData = data;
  }
  workspaceMode = WORKSPACE_TUTORIAL;
  tutorialData = sanitizeData(tutorialData);
  data = tutorialData;
  activeTab = targetTab;
  selectedPropertyId = data.properties[0]?.id || "";
  propertyMode = "view";
  resetFiltersAfterRestore();
  closeEditors();
  closeDocumentPreview({ renderAfterClose: false });
  showNotice("Tutorial workspace opened. Sample changes are temporary.");
}

function exitTutorialWorkspace() {
  if (!isTutorialMode()) return;
  tutorialData = sanitizeData(data);
  workspaceMode = WORKSPACE_REAL;
  data = realData;
  activeTab = "dashboard";
  selectedPropertyId = data.properties[0]?.id || "";
  propertyMode = "view";
  resetFiltersAfterRestore();
  closeEditors();
  closeDocumentPreview({ renderAfterClose: false });
  showNotice("Returned to your real home file.");
}

function resetTutorialWorkspace() {
  if (!isTutorialMode()) {
    enterTutorialWorkspace();
    return;
  }
  if (!window.confirm("Reset the tutorial workspace back to the original sample items? Your real home file will not be changed.")) return;
  tutorialData = createTutorialData();
  data = tutorialData;
  activeTab = "tutorial";
  selectedPropertyId = data.properties[0]?.id || "";
  propertyMode = "view";
  resetFiltersAfterRestore();
  closeEditors();
  closeDocumentPreview({ renderAfterClose: false });
  showNotice("Tutorial sample data reset.");
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formType = form.dataset.form;
  if (!formType) return;
  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());

  if (formType === "property") await saveProperty(values);
  if (formType === "property-field") await savePropertyField(values);
  if (formType === "vendor") await saveVendor(values);
  if (formType === "project") await saveProject(values);
  if (formType === "project-field") await saveProjectField(values);
  if (formType === "expense") await saveExpense(values);
  if (formType === "document") await saveDocument(values, formData.get("file"));
  if (formType === "document-preview-notes") await saveDocumentPreviewNotes(values);
  if (formType === "follow-up-override") await saveFollowUpOverride(values);
  if (formType === "sale-scenario") saveSaleScenario(values);
  if (formType === "project-cost-plan") saveProjectCostPlan(values);
}

function saveSaleScenario(values) {
  const validPropertyId = data.properties.some((property) => property.id === values.propertyId)
    ? values.propertyId
    : data.properties[0]?.id || "";
  saleScenario = {
    propertyId: validPropertyId,
    salePrice: removeLocalPaths(values.salePrice || "").trim(),
    mortgagePayoff: removeLocalPaths(values.mortgagePayoff || "").trim(),
    sellingCostsRate: removeLocalPaths(values.sellingCostsRate || "").trim() || "6",
    sellingCostsAmount: removeLocalPaths(values.sellingCostsAmount || "").trim(),
    exclusionAmount: ["0", "250000", "500000"].includes(String(values.exclusionAmount))
      ? String(values.exclusionAmount)
      : "250000",
  };
  render();
}

function saveProjectCostPlan(values) {
  const validPropertyId = data.properties.some((property) => property.id === values.propertyId)
    ? values.propertyId
    : data.properties[0]?.id || "";
  const validProjectId = data.projects.some((project) => project.id === values.projectId && project.propertyId === validPropertyId)
    ? values.projectId
    : "";
  projectCostPlan = {
    propertyId: validPropertyId,
    projectId: validProjectId,
    materials: removeLocalPaths(values.materials || "").trim(),
    labor: removeLocalPaths(values.labor || "").trim(),
    permits: removeLocalPaths(values.permits || "").trim(),
    other: removeLocalPaths(values.other || "").trim(),
    contingencyRate: removeLocalPaths(values.contingencyRate || "").trim() || "0",
  };
  render();
}

async function saveFollowUpOverride(values) {
  const form = app.querySelector('[data-form="follow-up-override"]');
  const followUpId = values.id || activeFollowUpItemId;
  const item = getFollowUpItemById(followUpId);
  if (!item) {
    activeFollowUpItemId = "";
    render();
    return;
  }
  if (values.overrideComplete !== "yes") {
    return showFormNotice(form, "overrideComplete", "Check Override and mark complete before saving this override.");
  }

  const override = {
    id: item.id,
    label: item.label || "",
    typeLabel: item.typeLabel || "",
    detail: item.detail || "",
    propertyId: item.propertyId || "",
    projectId: item.projectId || "",
    expenseId: item.expenseId || "",
    documentId: item.documentId || "",
    note: removeLocalPaths(values.note || "").trim(),
    completedAt: new Date().toISOString(),
  };
  const saved = await updateData({
    ...data,
    followUpOverrides: upsertById(data.followUpOverrides || [], override),
  });
  if (!saved) return;
  if (item.projectId && !getProjectFollowUps(item.projectId).length) {
    expandedProjectFollowUpIds.delete(item.projectId);
  }
  activeFollowUpItemId = "";
  showNotice("Follow-up marked complete.");
}

async function saveProperty(values) {
  const form = app.querySelector('[data-form="property"]');
  const existingProperty = data.properties.find((property) => property.id === values.id);
  if (!values.name?.trim()) return showFormNotice(form, "name", "Property name is required.");
  const addressNotice = getAddressSanityNotice(values.address);
  if (addressNotice) return showFormNotice(form, "address", addressNotice);
  if (values.purchaseDate && !isValidISODate(values.purchaseDate)) return showFormNotice(form, "purchaseDate", "Enter a valid purchase date.");
  if (values.purchasePrice && parseAmount(values.purchasePrice) < 0) return showFormNotice(form, "purchasePrice", "Purchase price cannot be negative.");
  const property = {
    id: values.id || createId("property"),
    name: removeLocalPaths(values.name).trim(),
    address: removeLocalPaths(values.address).trim(),
    purchaseDate: values.purchaseDate,
    purchasePrice: parseAmount(values.purchasePrice),
    notes: removeLocalPaths(values.notes).trim(),
    isPrimary: existingProperty?.isPrimary || data.properties.length === 0,
  };
  const nextProperties = upsertById(data.properties, property).map((currentProperty) =>
    property.isPrimary ? { ...currentProperty, isPrimary: currentProperty.id === property.id } : currentProperty
  );
  const saved = await updateData({ ...data, properties: nextProperties });
  if (!saved) return;
  selectedPropertyId = property.id;
  propertyMode = "view";
  showNotice("Property saved.");
}

async function setPrimaryProperty(propertyId) {
  if (!data.properties.some((property) => property.id === propertyId)) return;
  const saved = await updateData({
    ...data,
    properties: data.properties.map((property) => ({
      ...property,
      isPrimary: property.id === propertyId,
    })),
  });
  if (!saved) return;
  selectedPropertyId = propertyId;
  showNotice("Default property updated.");
}

async function savePropertyField(values) {
  const form = app.querySelector('[data-form="property-field"]');
  const property = data.properties.find((currentProperty) => currentProperty.id === values.id);
  const fieldName = values.fieldName;
  if (!property || !["name", "address", "purchaseDate", "purchasePrice", "notes"].includes(fieldName)) {
    editingPropertyField = "";
    render();
    return;
  }

  let nextValue = values.value ?? "";
  if (fieldName === "name") {
    nextValue = removeLocalPaths(nextValue).trim();
    if (!nextValue) return showFormNotice(form, "value", "Property name is required.");
  } else if (fieldName === "address") {
    nextValue = removeLocalPaths(nextValue).trim();
    const addressNotice = getAddressSanityNotice(nextValue);
    if (addressNotice) return showFormNotice(form, "value", addressNotice);
  } else if (fieldName === "purchaseDate") {
    if (nextValue && !isValidISODate(nextValue)) return showFormNotice(form, "value", "Enter a valid purchase date.");
  } else if (fieldName === "purchasePrice") {
    if (nextValue && parseAmount(nextValue) < 0) return showFormNotice(form, "value", "Purchase price cannot be negative.");
    nextValue = parseAmount(nextValue);
  } else if (fieldName === "notes") {
    nextValue = removeLocalPaths(nextValue).trim();
  }

  const saved = await updateData({
    ...data,
    properties: data.properties.map((currentProperty) =>
      currentProperty.id === property.id ? { ...currentProperty, [fieldName]: nextValue } : currentProperty
    ),
  });
  if (!saved) return;
  editingPropertyField = "";
  showNotice("Property updated.");
}

function getAddressSanityNotice(value) {
  const address = removeLocalPaths(value || "").trim();
  if (!address) return "";

  const compactAddress = address.replace(/\s+/g, " ");
  const lowerAddress = compactAddress.toLowerCase();
  const hasLetter = /[a-z]/i.test(compactAddress);
  const hasStreetNumber = /\b\d{1,8}[a-z]?\b/i.test(compactAddress);
  const hasPostalCode = /\b\d{5}(?:-\d{4})?\b/.test(compactAddress);
  const hasPoBox = /\b(?:p\.?\s*o\.?\s*box|post office box)\s+\d+/i.test(compactAddress);
  const hasRuralRoute = /\b(?:rr|rural route|route|highway|hwy)\s+\d+/i.test(compactAddress);
  const hasSeparator = /[,#\n]/.test(address);
  const hasStreetWord = /\b(?:aly|alley|ave|avenue|blvd|boulevard|cir|circle|ct|court|cv|cove|dr|drive|hwy|highway|ln|lane|loop|pkwy|parkway|pl|place|rd|road|sq|square|st|street|ter|terrace|trl|trail|way)\b\.?/i.test(compactAddress);
  const hasStateAndZip = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(compactAddress);

  if (compactAddress.length < 8 || !hasLetter) {
    return "Enter a recognizable property address, or leave the address blank for now.";
  }
  if (/^(.)\1{7,}$/.test(compactAddress.replace(/\s/g, ""))) {
    return "Enter a recognizable property address, or leave the address blank for now.";
  }
  if (/(?:https?:\/\/|www\.|@)/i.test(compactAddress)) {
    return "Enter the property address only. Web links and email addresses do not belong in this field.";
  }
  if (!hasPoBox && !hasRuralRoute && !(hasStreetNumber && (hasStreetWord || hasSeparator || hasPostalCode))) {
    return "Include a street number and street name, or leave the address blank for now.";
  }
  if (lowerAddress.includes("test") && !hasPostalCode && !hasStateAndZip) {
    return "Use the real property address, or leave the address blank for now.";
  }

  return "";
}

async function saveVendor(values) {
  const form = app.querySelector('[data-form="vendor"]');
  const name = removeLocalPaths(values.name || "").trim();
  if (!name) return showFormNotice(form, "name", "Vendor name is required.");

  const duplicateVendor = data.vendors.find((vendor) =>
    vendor.id !== values.id &&
    vendor.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicateVendor) return showFormNotice(form, "name", "A vendor with this name already exists.");

  const vendor = {
    id: values.id || createId("vendor"),
    name,
    category: EXPENSE_CATEGORIES.some((option) => option.value === values.category) ? values.category : "other",
    contactName: removeLocalPaths(values.contactName).trim(),
    phone: removeLocalPaths(values.phone).trim(),
    email: removeLocalPaths(values.email).trim(),
    website: removeLocalPaths(values.website).trim(),
    notes: removeLocalPaths(values.notes).trim(),
    status: VENDOR_STATUSES.some((option) => option.value === values.status) ? values.status : "active",
  };

  const saved = await updateData({
    ...data,
    vendors: upsertById(data.vendors, vendor),
    projects: data.projects.map((project) =>
      project.vendorId === vendor.id ? { ...project, contractor: vendor.name } : project
    ),
    expenses: data.expenses.map((expense) =>
      expense.vendorId === vendor.id ? { ...expense, vendor: vendor.name } : expense
    ),
  });
  if (!saved) return;
  if (draftExpenseFormValues && !draftExpenseFormValues.vendorId) {
    draftExpenseFormValues = { ...draftExpenseFormValues, vendorId: vendor.id };
  }
  editingVendorId = undefined;
  showNotice("Vendor saved.");
}

async function saveProject(values) {
  const form = app.querySelector('[data-form="project"]');
  if (!values.propertyId) return showFormNotice(form, "propertyId", "Property is required.");
  if (!values.name?.trim()) return showFormNotice(form, "name", "Project name is required.");
  if (values.startDate && !isValidISODate(values.startDate)) return showFormNotice(form, "startDate", "Enter a valid start date.");
  if (values.completionDate && !isValidISODate(values.completionDate)) return showFormNotice(form, "completionDate", "Enter a valid completion date.");
  if (values.startDate && values.completionDate && values.completionDate < values.startDate) {
    return showFormNotice(form, "completionDate", "Completion date cannot be before the start date.");
  }
  const project = {
    id: values.id || createId("project"),
    propertyId: values.propertyId,
    vendorId: values.vendorId || "",
    name: removeLocalPaths(values.name).trim(),
    category: values.category,
    startDate: values.startDate,
    completionDate: values.completionDate,
    contractor: getVendorName(data, values.vendorId, ""),
    permitNumber: removeLocalPaths(values.permitNumber).trim(),
    status: values.status,
    scopeSummary: removeLocalPaths(values.scopeSummary).trim(),
    notes: removeLocalPaths(values.notes).trim(),
    completenessOverrideNote: removeLocalPaths(values.completenessOverrideNote).trim(),
  };
  const existingProject = data.projects.find((currentProject) => currentProject.id === project.id);
  const propertyChanged = existingProject && existingProject.propertyId !== project.propertyId;
  const saved = await updateData({
    ...data,
    projects: upsertById(data.projects, project),
    expenses: propertyChanged
      ? data.expenses.map((expense) => expense.projectId === project.id ? { ...expense, propertyId: project.propertyId } : expense)
      : data.expenses,
    documents: propertyChanged
      ? data.documents.map((document) => document.projectId === project.id ? { ...document, propertyId: project.propertyId } : document)
      : data.documents,
  });
  if (!saved) return;
  selectedPropertyId = project.propertyId;
  selectedProjectId = project.id;
  projectFilters.propertyId = project.propertyId;
  if (expenseFilters.projectId === project.id && expenseFilters.propertyId !== EMPTY_FILTER && expenseFilters.propertyId !== project.propertyId) {
    expenseFilters.projectId = EMPTY_FILTER;
  }
  editingProjectId = undefined;
  activeFollowUpItemId = "";
  activeProjectFileId = returnToProjectFileId === project.id ? project.id : "";
  returnToProjectFileId = "";
  showNotice("Project saved.");
}

async function saveProjectField(values) {
  const form = app.querySelector('[data-form="project-field"]');
  const project = data.projects.find((currentProject) => currentProject.id === values.id);
  const fieldName = values.fieldName;
  if (!project || !fieldName) return;

  const nextProject = { ...project };
  const value = String(values.value ?? "");
  if (fieldName === "propertyId") {
    if (!data.properties.some((property) => property.id === value)) return showFormNotice(form, "value", "Property is required.");
    nextProject.propertyId = value;
  } else if (fieldName === "name") {
    if (!value.trim()) return showFormNotice(form, "value", "Project name is required.");
    nextProject.name = removeLocalPaths(value).trim();
  } else if (fieldName === "category") {
    nextProject.category = EXPENSE_CATEGORIES.some((option) => option.value === value) ? value : "other";
  } else if (fieldName === "status") {
    nextProject.status = PROJECT_STATUSES.some((option) => option.value === value) ? value : "planned";
  } else if (["startDate", "completionDate"].includes(fieldName)) {
    if (value && !isValidISODate(value)) return showFormNotice(form, "value", "Enter a valid date.");
    nextProject[fieldName] = value;
    if (nextProject.startDate && nextProject.completionDate && nextProject.completionDate < nextProject.startDate) {
      return showFormNotice(form, "value", "Completion date cannot be before the start date.");
    }
  } else if (fieldName === "vendorId") {
    nextProject.vendorId = data.vendors.some((vendor) => vendor.id === value) ? value : "";
    nextProject.contractor = getVendorName(data, nextProject.vendorId, "");
  } else if (["contractor", "permitNumber", "scopeSummary", "notes", "completenessOverrideNote"].includes(fieldName)) {
    nextProject[fieldName] = removeLocalPaths(value).trim();
  } else {
    return;
  }

  const propertyChanged = project.propertyId !== nextProject.propertyId;
  const saved = await updateData({
    ...data,
    projects: upsertById(data.projects, nextProject),
    expenses: propertyChanged
      ? data.expenses.map((expense) => expense.projectId === nextProject.id ? { ...expense, propertyId: nextProject.propertyId } : expense)
      : data.expenses,
    documents: propertyChanged
      ? data.documents.map((document) => document.projectId === nextProject.id ? { ...document, propertyId: nextProject.propertyId } : document)
      : data.documents,
  });
  if (!saved) return;
  selectedPropertyId = nextProject.propertyId;
  selectedProjectId = nextProject.id;
  projectFilters.propertyId = nextProject.propertyId;
  if (expenseFilters.projectId === nextProject.id && expenseFilters.propertyId !== EMPTY_FILTER && expenseFilters.propertyId !== nextProject.propertyId) {
    expenseFilters.projectId = EMPTY_FILTER;
  }
  editingProjectField = "";
  activeProjectFileId = nextProject.id;
  showNotice("Project updated.");
}

async function saveExpense(values) {
  const form = app.querySelector('[data-form="expense"]');
  if (!values.propertyId) return showFormNotice(form, "propertyId", "Property is required.");
  if (!values.date) return showFormNotice(form, "date", "Date is required.");
  if (!isValidISODate(values.date)) return showFormNotice(form, "date", "Enter a valid expense date.");
  if (!values.description?.trim()) return showFormNotice(form, "description", "Description is required.");
  if (parseAmount(values.amount) <= 0) return showFormNotice(form, "amount", "Enter an amount greater than zero.");

  const projectId = data.projects.some((project) => project.id === values.projectId && project.propertyId === values.propertyId)
    ? values.projectId
    : "";
  const expense = {
    id: values.id || createId("expense"),
    propertyId: values.propertyId,
    projectId,
    vendorId: values.vendorId || "",
    date: values.date,
    vendor: getVendorName(data, values.vendorId, ""),
    description: removeLocalPaths(values.description).trim(),
    amount: parseAmount(values.amount),
    classification: values.classification,
    category: values.category,
    documentationStatus: values.documentationStatus,
    notes: removeLocalPaths(values.notes).trim(),
  };
  const saved = await updateData({
    ...data,
    expenses: upsertById(data.expenses, expense),
    documents: data.documents.map((documentRecord) =>
      documentRecord.expenseId === expense.id
        ? { ...documentRecord, propertyId: expense.propertyId, projectId: expense.projectId }
      : documentRecord,
    ),
  });
  if (!saved) return;
  selectedPropertyId = expense.propertyId;
  expenseFilters.propertyId = expense.propertyId;
  expenseFilters.projectId = expense.projectId || EMPTY_FILTER;
  editingExpenseId = undefined;
  draftExpenseFormValues = null;
  draftExpenseProjectId = "";
  activeProjectFileId = returnToProjectFileId || "";
  returnToProjectFileId = "";
  activeFollowUpItemId = "";
  showNotice("Expense saved.");
}

async function saveDocument(values, file) {
  const hasSelectedFile = file && file.size > 0;
  const form = app.querySelector('[data-form="document"]');
  if (!values.propertyId) return showFormNotice(form, "propertyId", "Property is required.");
  if (!values.addedDate) return showFormNotice(form, "addedDate", "Document date is required.");
  if (!isValidISODate(values.addedDate)) return showFormNotice(form, "addedDate", "Enter a valid document date.");
  if (hasSelectedFile && file.size > MAX_DOCUMENT_FILE_SIZE) {
    return showFormNotice(form, "file", `Maximum file size: ${formatFileSize(MAX_DOCUMENT_FILE_SIZE)}.`);
  }
  if (hasSelectedFile && !isTutorialMode() && !canStoreDocuments()) {
    return showFormNotice(form, "file", "File attachments are unavailable right now.");
  }

  const linkedExpense = data.expenses.find((expense) => expense.id === values.expenseId);
  const existingDocument = data.documents.find((document) => document.id === values.id);
  const documentId = values.id || createId("document");
  const previousFileId = existingDocument?.hasFile ? existingDocument.fileId || existingDocument.id : "";
  let newlySavedFileId = "";
  let fileMetadata = existingDocument?.hasFile
    ? {
        hasFile: true,
        fileId: existingDocument.fileId || existingDocument.id,
        fileName: existingDocument.fileName || "",
        fileStatusNote: existingDocument.fileStatusNote || "",
        mimeType: existingDocument.mimeType || "",
        fileSize: existingDocument.fileSize || 0,
        fileLastModified: existingDocument.fileLastModified || null,
        fileStoredAt: existingDocument.fileStoredAt || "",
      }
    : {
        hasFile: false,
        fileId: "",
        fileName: "",
        fileStatusNote: existingDocument?.fileStatusNote || "",
        mimeType: "",
        fileSize: 0,
        fileLastModified: null,
        fileStoredAt: "",
      };

  if (hasSelectedFile) {
    if (isTutorialMode()) {
      fileMetadata = {
        hasFile: true,
        fileId: createTutorialFileId(documentId),
        fileName: removeLocalPaths(file.name).trim() || "Tutorial file",
        fileStatusNote: "Sample file details only. No copy was saved.",
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        fileLastModified: file.lastModified || null,
        fileStoredAt: new Date().toISOString(),
      };
    } else {
      try {
        newlySavedFileId = createId("file");
        const storedFile = await saveDocumentFile(newlySavedFileId, file);
        fileMetadata = {
          hasFile: true,
          fileId: storedFile.id,
          fileName: removeLocalPaths(storedFile.name).trim() || "Attached file",
          fileStatusNote: "",
          mimeType: storedFile.type,
          fileSize: storedFile.size,
          fileLastModified: storedFile.lastModified,
          fileStoredAt: storedFile.storedAt,
        };
      } catch (error) {
        return showFormNotice(form, "file", getDocumentStorageError(error));
      }
    }
  }

  const documentName = removeLocalPaths(values.displayName).trim()
    || fileMetadata.fileName
    || getDraftDocumentDisplayName(linkedExpense)
    || existingDocument?.displayName
    || "Untitled document";

  const documentRecord = {
    id: documentId,
    propertyId: linkedExpense?.propertyId || values.propertyId,
    projectId: linkedExpense?.projectId || values.projectId,
    expenseId: values.expenseId,
    displayName: documentName,
    documentType: values.documentType,
    addedDate: values.addedDate,
    notes: removeLocalPaths(values.notes).trim(),
    ocrText: existingDocument?.ocrText || "",
    ...fileMetadata,
  };

  const shouldMarkExpenseDocumented =
    documentRecord.hasFile &&
    documentRecord.expenseId &&
    ["receipt", "invoice"].includes(documentRecord.documentType);
  const nextDocuments = upsertById(data.documents, documentRecord);
  let nextExpenses = data.expenses;

  if (existingDocument?.hasFile) {
    nextExpenses = reconcileExpensesAfterDocumentFileRemoval(nextDocuments, existingDocument);
  }

  if (shouldMarkExpenseDocumented) {
    nextExpenses = nextExpenses.map((expense) =>
      expense.id === documentRecord.expenseId
        ? {
            ...expense,
            documentationStatus: documentRecord.documentType === "invoice" ? "invoice attached" : "receipt attached",
          }
        : expense,
    );
  }

  const saved = await updateData({ ...data, documents: nextDocuments, expenses: nextExpenses });

  if (!saved) {
    if (newlySavedFileId) {
      try {
        await deleteDocumentFile(newlySavedFileId);
      } catch {
        // Best effort cleanup. The user-facing storage error has already been shown.
      }
    }
    return;
  }

  selectedPropertyId = documentRecord.propertyId;
  editingDocumentId = undefined;
  documentFileInputAllowed = false;
  draftDocumentExpenseId = "";
  draftDocumentProjectId = "";
  activeProjectFileId = returnToProjectFileId || "";
  returnToProjectFileId = "";
  activeFollowUpItemId = "";
  resetStorageEstimate();

  if (newlySavedFileId && previousFileId && previousFileId !== newlySavedFileId) {
    try {
      await deleteDocumentFile(previousFileId);
    } catch {
      showNotice(`Document saved, but the previous stored file could not be removed from ${storageSurfaceName().toLowerCase()} storage.`);
      return;
    }
  }

  showNotice(documentRecord.hasFile
    ? isTutorialMode()
      ? "Document saved with sample file details. No file copy was stored."
      : "Document and attached file saved."
    : "Document saved.");
}

async function openDocumentPreview(documentId) {
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!documentRecord?.hasFile) return showNotice("No stored file is attached to this document.");
  if (isTutorialDocumentFile(documentRecord)) {
    return showNotice("Sample file details have no real file to preview.");
  }

  closeDocumentPreview({ renderAfterClose: false });
  documentPreview = {
    documentId,
    status: "loading",
    objectUrl: "",
    fileName: documentRecord.fileName || "",
    mimeType: documentRecord.mimeType || "",
    ocrStatus: "idle",
    ocrProgress: 0,
    ocrText: documentRecord.ocrText || "",
  };
  render();

  try {
    const storedFile = await getDocumentFile(documentRecord.fileId || documentRecord.id);
    if (!storedFile?.blob) {
      await markDocumentFileMissing(documentRecord);
      documentPreview = {
        ...documentPreview,
        status: "error",
        error: `The file details are saved, but the stored file is missing. It may have been cleared from ${storageSurfaceName().toLowerCase()} storage.`,
      };
      render();
      return;
    }

    documentPreview = {
      ...documentPreview,
      status: "ready",
      objectUrl: URL.createObjectURL(storedFile.blob),
      fileName: documentRecord.fileName || storedFile.name || "Attached file",
      mimeType: documentRecord.mimeType || storedFile.type || storedFile.blob.type || "application/octet-stream",
      fileSize: documentRecord.fileSize || storedFile.size || storedFile.blob.size || 0,
    };
    render();
  } catch (error) {
    documentPreview = {
      ...documentPreview,
      status: "error",
      error: getDocumentStorageError(error),
    };
    render();
  }
}

function closeDocumentPreview({ renderAfterClose = false } = {}) {
  if (documentPreview?.objectUrl) {
    URL.revokeObjectURL(documentPreview.objectUrl);
  }
  documentPreview = null;
  if (renderAfterClose) render();
}

async function saveDocumentPreviewNotes(values) {
  const documentId = values.id || documentPreview?.documentId || "";
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!documentRecord) return showNotice("Document was not found.");

  const saved = await updateData({
    ...data,
    documents: data.documents.map((document) =>
      document.id === documentId
        ? {
            ...document,
            notes: removeLocalPaths(values.notes || "").trim(),
            ocrText: removeLocalPaths(values.ocrText || "").trim(),
          }
        : document,
    ),
  });
  if (!saved) return;
  if (documentPreview?.documentId === documentId) {
    documentPreview = {
      ...documentPreview,
      ocrText: removeLocalPaths(values.ocrText || "").trim(),
      ocrStatus: documentPreview.ocrStatus === "running" ? "running" : "idle",
    };
  }
  showNotice("Document notes saved.");
}

async function runDocumentOcr(documentId) {
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!documentRecord?.hasFile) return showNotice("No stored file is attached to this document.");
  if (isTutorialDocumentFile(documentRecord)) {
    return showNotice("Sample file details have no real file for text reading.");
  }

  if (!documentPreview || documentPreview.documentId !== documentId) {
    await openDocumentPreview(documentId);
  }
  if (!documentPreview || documentPreview.status !== "ready") return;

  const processor = getDocumentTextProcessor(documentRecord, documentPreview.mimeType);
  if (!processor) {
    return showNotice("Local text reading is available for images, PDFs, and plain text files in this version.");
  }

  const setProgress = (progress, statusCopy = "") => {
    if (!documentPreview || documentPreview.documentId !== documentId) return;
    documentPreview = {
      ...documentPreview,
      ocrProgress: Math.max(0, Math.min(1, Number(progress) || 0)),
      ocrStatusCopy: statusCopy || documentPreview.ocrStatusCopy || "",
    };
    syncOcrStatusCopy();
  };

  documentPreview = {
    ...documentPreview,
    ocrStatus: "running",
    ocrProgress: 0,
    ocrError: "",
    ocrStatusCopy: processor.startCopy,
  };
  render();

  try {
    const storedFile = await getDocumentFile(documentRecord.fileId || documentRecord.id);
    if (!storedFile?.blob) throw new Error("The stored file is missing.");
    const result = await processor.read(storedFile.blob, documentRecord, {
      onProgress: setProgress,
    });
    const cleanText = removeLocalPaths(result.text || "").trim();
    const saved = await updateData({
      ...data,
      documents: data.documents.map((document) =>
        document.id === documentId ? { ...document, ocrText: cleanText } : document,
      ),
    });
    if (!saved) return;
    documentPreview = {
      ...documentPreview,
      ocrStatus: "done",
      ocrProgress: 1,
      ocrText: cleanText,
      ocrStatusCopy: "",
    };
    const noticeSuffix = result.notice ? ` ${result.notice}` : "";
    showNotice(cleanText ? `Document text saved.${noticeSuffix}` : `No document text was found.${noticeSuffix}`);
  } catch (error) {
    documentPreview = {
      ...documentPreview,
      ocrStatus: "error",
      ocrError: getOcrError(error),
      ocrStatusCopy: "",
    };
    showNotice(documentPreview.ocrError);
  }
}

async function readImageDocumentText(blob, _documentRecord, { onProgress } = {}) {
  const worker = await createOcrWorker((progress) => {
    onProgress?.(progress, `Reading image... ${Math.round(progress * 100)}%`);
  });
  try {
    const text = await recognizeBlobWithWorker(worker, blob);
    return { text };
  } finally {
    await terminateWorker(worker);
  }
}

async function readPdfDocumentText(blob, _documentRecord, { onProgress } = {}) {
  const pdfjsLib = await loadPdfJs();
  onProgress?.(0.01, "Opening PDF...");

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    cMapPacked: true,
    cMapUrl: new URL("../node_modules/pdfjs-dist/cmaps/", import.meta.url).href,
    standardFontDataUrl: new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).href,
    wasmUrl: new URL("../node_modules/pdfjs-dist/wasm/", import.meta.url).href,
  });

  const pdf = await loadingTask.promise;
  const pagesToRead = Math.min(pdf.numPages, PDF_TEXT_MAX_PAGES);
  const skippedPages = Math.max(0, pdf.numPages - pagesToRead);
  const pageTexts = [];
  let ocrWorker;
  let ocrPages = 0;
  let failedPages = 0;
  let lastPageError;

  if (!pagesToRead) {
    await pdf.destroy?.();
    return { text: "" };
  }

  try {
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      const pageStartProgress = (pageNumber - 1) / pagesToRead;
      const pageEndProgress = pageNumber / pagesToRead;
      let page;

      try {
        onProgress?.(pageStartProgress, `Checking PDF page ${pageNumber} of ${pdf.numPages}...`);
        page = await pdf.getPage(pageNumber);

        const embeddedText = await extractPdfPageText(page);
        if (hasUsefulPdfText(embeddedText)) {
          pageTexts.push(formatPdfPageText(pageNumber, embeddedText));
          onProgress?.(pageEndProgress, `Read PDF page ${pageNumber} of ${pdf.numPages}.`);
          continue;
        }

        onProgress?.(pageStartProgress + (pageEndProgress - pageStartProgress) * 0.25, `Preparing PDF page ${pageNumber} of ${pdf.numPages}...`);
        const pageImage = await renderPdfPageToBlob(page);
        ocrWorker ||= await createOcrWorker((progress) => {
          const pageProgress = pageStartProgress + (pageEndProgress - pageStartProgress) * (0.35 + (progress * 0.65));
          onProgress?.(pageProgress, `Reading PDF page ${pageNumber} of ${pdf.numPages}... ${Math.round(progress * 100)}%`);
        });
        const pageText = await recognizeBlobWithWorker(ocrWorker, pageImage);
        ocrPages += 1;
        if (pageText.trim()) {
          pageTexts.push(formatPdfPageText(pageNumber, pageText));
        }
        onProgress?.(pageEndProgress, `Read PDF page ${pageNumber} of ${pdf.numPages}.`);
      } catch (error) {
        failedPages += 1;
        lastPageError = error;
      } finally {
        page?.cleanup?.();
      }
    }
  } finally {
    await terminateWorker(ocrWorker);
    await pdf.destroy?.();
  }

  const noticeParts = [];
  if (ocrPages) noticeParts.push(`${ocrPages} PDF page${ocrPages === 1 ? "" : "s"} read.`);
  if (skippedPages) noticeParts.push(`Only the first ${PDF_TEXT_MAX_PAGES} pages were read.`);
  if (failedPages) noticeParts.push(`${failedPages} PDF page${failedPages === 1 ? "" : "s"} could not be read.`);

  const text = pageTexts.join("\n\n");
  if (!text.trim() && failedPages === pagesToRead && lastPageError) {
    throw lastPageError;
  }

  return {
    text,
    notice: noticeParts.join(" "),
  };
}

async function readPlainTextDocument(blob, _documentRecord, { onProgress } = {}) {
  if (blob.size > DOCUMENT_TEXT_FILE_SIZE_LIMIT) {
    throw new Error(`Text files over ${formatFileSize(DOCUMENT_TEXT_FILE_SIZE_LIMIT)} are too large to read in this beta.`);
  }
  onProgress?.(0.25, "Reading text file...");
  const text = cleanExtractedDocumentText(await blob.text());
  onProgress?.(1, "Text file read.");
  return { text };
}

async function loadTesseract() {
  tesseractModulePromise ||= import("../node_modules/tesseract.js/dist/tesseract.esm.min.js").then((module) => module.createWorker ? module : module.default);
  return tesseractModulePromise;
}

async function createOcrWorker(onProgress) {
  const { createWorker } = await loadTesseract();
  if (typeof createWorker !== "function") throw new Error("Text reader could not be loaded.");
  const worker = await createWorker("eng", 1, {
    workerPath: new URL("../node_modules/tesseract.js/dist/worker.min.js", import.meta.url).href,
    corePath: new URL("../node_modules/tesseract.js-core", import.meta.url).href,
    langPath: new URL("../node_modules/@tesseract.js-data/eng/4.0.0", import.meta.url).href,
    workerBlobURL: false,
    cacheMethod: "none",
    logger(message) {
      if (message.status === "recognizing text") {
        onProgress?.(Math.max(0, Math.min(1, Number(message.progress) || 0)));
      }
    },
  });

  return worker;
}

async function recognizeBlobWithWorker(worker, blob) {
  const result = await worker.recognize(blob);
  return cleanExtractedDocumentText(result?.data?.text || "");
}

async function terminateWorker(worker) {
  if (!worker) return;
  try {
    await worker.terminate();
  } catch {
    // A failed teardown should not hide the text extraction result.
  }
}

async function loadPdfJs() {
  pdfJsModulePromise ||= import("../node_modules/pdfjs-dist/build/pdf.mjs").then((pdfjsLib) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../node_modules/pdfjs-dist/build/pdf.worker.mjs", import.meta.url).href;
    return pdfjsLib;
  });
  return pdfJsModulePromise;
}

async function extractPdfPageText(page) {
  const content = await page.getTextContent();
  const text = (content.items || []).map((item) => {
    const value = typeof item.str === "string" ? item.str : "";
    return item.hasEOL ? `${value}\n` : value;
  }).join(" ");
  return cleanExtractedDocumentText(text);
}

function hasUsefulPdfText(text) {
  return cleanExtractedDocumentText(text).replace(/\s/g, "").length >= PDF_TEXT_CONTENT_MIN_LENGTH;
}

async function renderPdfPageToBlob(page) {
  const unitViewport = page.getViewport({ scale: 1 });
  const unitPixels = Math.max(1, unitViewport.width * unitViewport.height);
  const scale = Math.max(PDF_RENDER_MIN_SCALE, Math.min(PDF_RENDER_MAX_SCALE, Math.sqrt(PDF_RENDER_MAX_PIXELS / unitPixels)));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The PDF page could not be prepared for reading.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  try {
    await page.render({
      canvasContext: context,
      viewport,
    }).promise;
    prepareCanvasForOcr(canvas, context);
    return await canvasToBlob(canvas, "image/png");
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function prepareCanvasForOcr(canvas, context) {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data: pixels } = imageData;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    const red = (pixels[index] * alpha) + (255 * (1 - alpha));
    const green = (pixels[index + 1] * alpha) + (255 * (1 - alpha));
    const blue = (pixels[index + 2] * alpha) + (255 * (1 - alpha));
    const brightness = (red * 0.299) + (green * 0.587) + (blue * 0.114);
    const contrasted = Math.max(0, Math.min(255, ((brightness - 128) * 1.45) + 128));

    pixels[index] = contrasted;
    pixels[index + 1] = contrasted;
    pixels[index + 2] = contrasted;
    pixels[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("The PDF page could not be prepared for reading."));
      }
    }, mimeType);
  });
}

function formatPdfPageText(pageNumber, text) {
  return `Page ${pageNumber}\n${cleanExtractedDocumentText(text)}`;
}

function cleanExtractedDocumentText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function syncOcrStatusCopy() {
  const statusElement = app.querySelector(".preview-side-panel .helper-note");
  if (statusElement) statusElement.textContent = getOcrStatusCopy();
}

function getOcrError(error) {
  const message = String(error?.message || "");
  if (/too large/i.test(message)) return message;
  if (/worker|wasm|fetch|load/i.test(message)) {
    return "Text reading could not start. Reopen the app and try again.";
  }
  if (/pdf/i.test(message)) return "This PDF could not be read.";
  return "This file could not be read.";
}

function isPreviewableStoredFile(documentRecord, mimeType = "") {
  return isImageFile(documentRecord, mimeType) || isPdfFile(documentRecord, mimeType);
}

function canReadStoredFileText(documentRecord, mimeType = "") {
  return Boolean(getDocumentTextProcessor(documentRecord, mimeType));
}

function getDocumentTextProcessor(documentRecord, mimeType = "") {
  if (isImageFile(documentRecord, mimeType)) {
    return {
      readyCopy: "Supported image text can be saved into the document notes.",
      startCopy: "Reading image... 0%",
      read: readImageDocumentText,
    };
  }
  if (isPdfFile(documentRecord, mimeType)) {
    return {
      readyCopy: "PDF text can be saved into the document notes.",
      startCopy: "Opening PDF...",
      read: readPdfDocumentText,
    };
  }
  if (isPlainTextFile(documentRecord, mimeType)) {
    return {
      readyCopy: "Plain text files can be copied into the document notes.",
      startCopy: "Reading text file...",
      read: readPlainTextDocument,
    };
  }
  return null;
}

function isImageFile(documentRecord, mimeType = "") {
  const type = String(mimeType || documentRecord?.mimeType || "").toLowerCase();
  const name = String(documentRecord?.fileName || "").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/.test(name);
}

function isPdfFile(documentRecord, mimeType = "") {
  const type = String(mimeType || documentRecord?.mimeType || "").toLowerCase();
  const name = String(documentRecord?.fileName || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

function isPlainTextFile(documentRecord, mimeType = "") {
  const type = String(mimeType || documentRecord?.mimeType || "").toLowerCase().split(";")[0];
  const name = String(documentRecord?.fileName || "").toLowerCase();
  return type.startsWith("text/") || PLAIN_TEXT_MIME_TYPES.has(type) || PLAIN_TEXT_EXTENSIONS.test(name);
}

async function deleteProperty(propertyId) {
  const property = data.properties.find((currentProperty) => currentProperty.id === propertyId);
  if (!property) return;

  const linkedProjects = data.projects.filter((project) => project.propertyId === propertyId);
  const linkedExpenses = data.expenses.filter((expense) => expense.propertyId === propertyId);
  const linkedDocuments = data.documents.filter((document) => document.propertyId === propertyId);
  const fileIdsToDelete = linkedDocuments
    .filter((document) => document.hasFile)
    .map((document) => document.fileId || document.id)
    .filter(Boolean);

  const confirmation = [
    `Delete ${property.name} from this app?`,
    `This removes ${linkedProjects.length} project(s), ${linkedExpenses.length} expense(s), ${linkedDocuments.length} document entr${linkedDocuments.length === 1 ? "y" : "ies"}, and stored document copies for this property.`,
    "Original files on your computer and any exported backups are not deleted.",
  ].join("\n\n");
  if (!window.confirm(confirmation)) return;

  const remainingProperties = data.properties.filter((currentProperty) => currentProperty.id !== propertyId);
  const saved = await updateData({
    ...data,
    properties: remainingProperties,
    projects: data.projects.filter((project) => project.propertyId !== propertyId),
    expenses: data.expenses.filter((expense) => expense.propertyId !== propertyId),
    documents: data.documents.filter((document) => document.propertyId !== propertyId),
  });
  if (!saved) return;

  selectedPropertyId = remainingProperties[0]?.id || "";
  propertyMode = "view";
  resetFiltersAfterRestore();
  resetStorageEstimate();
  const cleanup = isTutorialMode()
    ? { failed: 0 }
    : await deleteFilesBestEffort(fileIdsToDelete);
  showNotice(cleanup.failed
    ? "Property deleted. Some attached document files could not be removed."
    : "Property deleted.");
}

async function deleteProject(projectId) {
  if (!window.confirm("Delete this project? Related expenses and documents will stay saved without this project.")) return;
  const saved = await updateData({
    ...data,
    projects: data.projects.filter((project) => project.id !== projectId),
    expenses: data.expenses.map((expense) => expense.projectId === projectId ? { ...expense, projectId: "" } : expense),
    documents: data.documents.map((document) => document.projectId === projectId ? { ...document, projectId: "" } : document),
  });
  if (!saved) return;
  if (selectedProjectId === projectId) selectedProjectId = "";
  if (expenseFilters.projectId === projectId) expenseFilters.projectId = EMPTY_FILTER;
  editingProjectId = undefined;
  editingProjectField = "";
  showNotice("Project deleted. Related expenses and documents were kept.");
}

async function deleteExpense(expenseId) {
  if (!window.confirm("Delete this expense and unlink its documents?")) return;
  const saved = await updateData({
    ...data,
    expenses: data.expenses.filter((expense) => expense.id !== expenseId),
    documents: data.documents.map((document) => document.expenseId === expenseId ? { ...document, expenseId: "" } : document),
  });
  if (!saved) return;
  editingExpenseId = undefined;
  showNotice("Expense deleted.");
}

async function deleteDocument(documentId) {
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!documentRecord) return;
  if (!window.confirm("Delete this document from this app? This removes the stored copy and its note here, but does not delete the original file from your computer or any copies you downloaded.")) return;
  if (documentPreview?.documentId === documentId) closeDocumentPreview({ renderAfterClose: false });

  if (documentRecord?.hasFile && !isTutorialDocumentFile(documentRecord)) {
    try {
      await deleteDocumentFile(documentRecord.fileId || documentRecord.id);
      resetStorageEstimate();
    } catch {
      showNotice(`The document was not deleted because the stored file could not be removed from ${storageSurfaceName().toLowerCase()} storage.`);
      return;
    }
  }

  const nextDocuments = data.documents.filter((document) => document.id !== documentId);
  const saved = await updateData({
    ...data,
    documents: nextDocuments,
    expenses: reconcileExpensesAfterDocumentFileRemoval(nextDocuments, documentRecord),
  });
  if (!saved) return;

  editingDocumentId = undefined;
  documentFileInputAllowed = false;
  showNotice("Document deleted.");
}

async function downloadDocumentAttachment(documentId) {
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!documentRecord?.hasFile) return showNotice("No stored file is attached to this document.");
  if (isTutorialDocumentFile(documentRecord)) {
    return showNotice("Sample file details have no real file to download.");
  }

  try {
    const storedFile = await getDocumentFile(documentRecord.fileId || documentRecord.id);
    if (!storedFile?.blob) {
      await markDocumentFileMissing(documentRecord);
      return showNotice(`The file details are saved, but the stored file is missing. It may have been cleared from ${storageSurfaceName().toLowerCase()} storage.`);
    }
    downloadBlob(storedFile.blob, documentRecord.fileName || storedFile.name || "home-basis-document");
    showNotice("Downloading creates a separate copy outside this app.");
  } catch (error) {
    showNotice(getDocumentStorageError(error));
  }
}

async function removeDocumentAttachment(documentId) {
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!documentRecord?.hasFile) return showNotice("No stored file is attached to this document.");
  const confirmation = isTutorialDocumentFile(documentRecord)
    ? "Remove these sample file details? The document entry will stay, and no real file will be deleted."
    : "Remove the stored file from this app? The document entry will stay, and this will not delete the original file from your computer or any copies you downloaded.";
  if (!window.confirm(confirmation)) return;
  if (documentPreview?.documentId === documentId) closeDocumentPreview({ renderAfterClose: false });

  if (!isTutorialDocumentFile(documentRecord)) {
    try {
      await deleteDocumentFile(documentRecord.fileId || documentRecord.id);
    } catch (error) {
      showNotice(`The document was not updated because the stored file could not be removed from ${storageSurfaceName().toLowerCase()} storage. ${getDocumentStorageError(error)}`);
      return;
    }
  }

  const nextDocuments = data.documents.map((document) =>
    document.id === documentId
      ? {
          ...document,
          hasFile: false,
          fileId: "",
          fileName: "",
          fileStatusNote: "Stored file removed from this app.",
          mimeType: "",
          fileSize: 0,
          fileLastModified: null,
          fileStoredAt: "",
        }
      : document,
  );

  const saved = await updateData({
    ...data,
    documents: nextDocuments,
    expenses: reconcileExpensesAfterDocumentFileRemoval(nextDocuments, documentRecord),
  });
  if (!saved) return;

  resetStorageEstimate();
  showNotice("Stored file removed. The document entry was kept.");
}

async function markDocumentFileMissing(documentRecord) {
  const nextDocuments = data.documents.map((document) =>
    document.id === documentRecord.id
      ? {
          ...document,
          hasFile: false,
          fileId: "",
          fileName: document.fileName ? `${document.fileName} (missing)` : "",
          fileStatusNote: "Stored file details were present, but the file could not be found.",
          fileSize: 0,
          fileLastModified: null,
          fileStoredAt: "",
        }
      : document,
  );

  await updateData({
    ...data,
    documents: nextDocuments,
    expenses: reconcileExpensesAfterDocumentFileRemoval(nextDocuments, documentRecord),
  });
}

function reconcileExpensesAfterDocumentFileRemoval(nextDocuments, changedDocument) {
  if (!changedDocument?.expenseId || !["receipt", "invoice"].includes(changedDocument.documentType)) {
    return data.expenses;
  }

  const remainingAttachedDocument = nextDocuments.find((document) =>
    document.expenseId === changedDocument.expenseId &&
    document.hasFile &&
    ["receipt", "invoice"].includes(document.documentType)
  );

  return data.expenses.map((expense) => {
    if (expense.id !== changedDocument.expenseId) return expense;
    if (!["receipt attached", "invoice attached"].includes(expense.documentationStatus)) return expense;
    if (remainingAttachedDocument?.documentType === "invoice") {
      return { ...expense, documentationStatus: "invoice attached" };
    }
    if (remainingAttachedDocument?.documentType === "receipt") {
      return { ...expense, documentationStatus: "receipt attached" };
    }
    return { ...expense, documentationStatus: "needs follow-up" };
  });
}

async function saveCpaReviewPdfFile() {
  if (!data.properties.length && !data.expenses.length && !data.documents.length) {
    showNotice("Add a property, expense, or document before creating a review packet.");
    return;
  }

  if (!isDesktopMode()) {
    showNotice("Use the browser print dialog to save the review summary as a PDF.");
    window.print();
    return;
  }

  const filename = isTutorialMode()
    ? `home-ledger-tutorial-review-packet-${todayISO()}.pdf`
    : `home-ledger-review-packet-${todayISO()}.pdf`;

  try {
    const result = await saveCpaReviewPdf(filename, buildCpaReviewPdfHtml(data));
    if (result?.canceled) {
      showNotice("Review packet save canceled.");
      return;
    }
    showNotice(isTutorialMode() ? "Tutorial packet saved." : "Review packet saved.");
  } catch (error) {
    showNotice(error?.message || "Review packet could not be saved.");
  }
}

function buildCpaReviewPdfHtml(records) {
  const cleanData = sanitizeData(records);
  const totals = getExpenseTotals(cleanData.expenses);
  const packetSummary = getPacketReadinessSummary(cleanData, { tutorialMode: isTutorialMode() });
  const followUps = packetSummary.openItems;
  const supportRows = packetSummary.recordsStillNeededItems.map((item) => [
    item.label,
    item.typeLabel,
    getPdfFollowUpRecordLabel(cleanData, item),
    item.primaryAction?.label || item.label,
  ]);
  const reviewRows = followUps
    .filter((item) => !packetSummary.recordsStillNeededItems.some((neededItem) => neededItem.id === item.id))
    .map((item) => [
      item.label,
      item.typeLabel,
      getPdfFollowUpRecordLabel(cleanData, item),
      item.primaryAction?.label || item.label,
    ]);
  const propertySummaries = getPropertyReviewSummaries(cleanData);
  const projectSummaries = getProjectReviewSummaries(cleanData);
  const title = isTutorialMode() ? "Tutorial Review Packet" : packetSummary.title;
  const subtitle = isTutorialMode()
    ? "Prepared from sample tutorial items"
    : "Prepared from Home Ledger";
  const propertyRows = propertySummaries.map((summary) => [
    `${summary.property.name}${summary.property.address ? `\n${summary.property.address}` : ""}`,
    formatDate(summary.property.purchaseDate),
    summary.property.purchasePrice ? formatCurrency(summary.property.purchasePrice) : "Not added",
    formatCurrency(summary.totals.total),
    String(summary.projects.length),
    `${summary.documents.length} (${summary.storedFiles} files)`,
    String(summary.missingDocuments),
  ]);
  const projectRows = projectSummaries.map((summary) => [
    `${summary.project.name}\n${getPropertyName(cleanData, summary.project.propertyId)}`,
    getProfessionalProjectStatusLabel(summary.project.status),
    summary.dateRange,
    getProjectVendorName(cleanData, summary.project, "Not added"),
    summary.project.permitNumber || (summary.hasPermit ? "Permit attached" : "Not added"),
    formatCurrency(summary.totals.total),
    summary.completeness.isOverridden
      ? `Marked complete with note: ${summary.completeness.overrideNote}`
      : `${summary.completeness.score}% (${summary.completeness.completedChecks}/${summary.completeness.totalChecks})`,
  ]);
  const expenseRows = sortByDateDesc(cleanData.expenses).map((expense) => [
    formatDate(expense.date),
    `${getExpenseVendorName(cleanData, expense)}\n${expense.description}`,
    getPropertyName(cleanData, expense.propertyId),
    getProjectName(cleanData, expense.projectId),
    getProfessionalClassificationLabel(expense.classification),
    optionLabel(DOCUMENT_STATUSES, expense.documentationStatus),
    formatCurrency(expense.amount),
  ]);
  const proofFileRows = getPdfProofFileRows(cleanData);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: letter; margin: 0.55in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #202522;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      font-size: 10.5px;
      line-height: 1.42;
    }
    .brand-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #214f43;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: 1px solid #214f43;
      color: #214f43;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .brand-name {
      display: block;
      color: #1f2b26;
      font-size: 15px;
      font-weight: 750;
    }
    .brand-subtitle {
      display: block;
      color: #66716c;
      font-size: 9px;
      margin-top: 1px;
    }
    .prepared {
      color: #66716c;
      font-size: 9px;
      text-align: right;
    }
    h1 {
      margin: 0 0 6px;
      color: #15201c;
      font-size: 24px;
      line-height: 1.15;
      letter-spacing: 0;
    }
    h2 {
      margin: 20px 0 8px;
      color: #214f43;
      font-size: 13px;
      line-height: 1.25;
      border-bottom: 1px solid #d8ded9;
      padding-bottom: 5px;
    }
    p { margin: 0 0 8px; }
    .lede {
      color: #4f5d57;
      font-size: 11px;
      max-width: 620px;
    }
    .note {
      border: 1px solid #d8ded9;
      background: #f7f8f6;
      padding: 10px 12px;
      margin: 14px 0 16px;
      color: #3c4742;
    }
    .packet-status {
      border-top: 1px solid #cfd7d2;
      border-bottom: 1px solid #cfd7d2;
      margin: 14px 0 12px;
      padding: 9px 0;
    }
    .packet-status span {
      display: block;
      color: #66716c;
      font-size: 8.5px;
      text-transform: uppercase;
    }
    .packet-status strong {
      display: block;
      color: #1f2b26;
      font-size: 14px;
      margin-top: 2px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0 12px;
      margin: 16px 0 12px;
    }
    .metric {
      border-bottom: 1px solid #d8ded9;
      padding: 7px 0;
      min-height: 42px;
    }
    .metric span {
      display: block;
      color: #66716c;
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 0;
      margin-bottom: 4px;
    }
    .metric strong {
      display: block;
      color: #1f2b26;
      font-size: 13px;
      line-height: 1.2;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 12px;
      page-break-inside: auto;
    }
    tr { page-break-inside: avoid; }
    th {
      background: #eef2ef;
      border: 1px solid #cfd7d2;
      color: #26312d;
      font-size: 8.5px;
      letter-spacing: 0;
      text-align: left;
      text-transform: uppercase;
      padding: 6px;
      vertical-align: top;
      white-space: nowrap;
      word-break: keep-all;
    }
    td {
      border: 1px solid #dce2de;
      padding: 6px;
      vertical-align: top;
      white-space: pre-line;
      word-break: normal;
      overflow-wrap: break-word;
    }
    .nowrap {
      white-space: nowrap;
      word-break: keep-all;
      overflow-wrap: normal;
    }
    .id-cell {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 7.6px;
      white-space: nowrap;
      word-break: keep-all;
    }
    .amount-cell {
      text-align: right;
      white-space: nowrap;
    }
    .section {
      page-break-inside: avoid;
    }
    .empty {
      border: 1px solid #d8ded9;
      color: #66716c;
      padding: 9px;
      margin-bottom: 12px;
    }
    .footer {
      margin-top: 18px;
      border-top: 1px solid #d8ded9;
      padding-top: 8px;
      color: #66716c;
      font-size: 8.5px;
    }
  </style>
</head>
<body>
  <div class="brand-bar">
    <div class="brand">
      <span class="brand-mark">HB</span>
      <div>
        <span class="brand-name">Home Ledger</span>
        <span class="brand-subtitle">Home project paperwork</span>
      </div>
    </div>
    <div class="prepared">Prepared ${escapeHtml(formatDate(todayISO()))}</div>
  </div>
  <h1>${escapeHtml(title)}</h1>
  <p class="lede">${escapeHtml(subtitle)}. This packet organizes property, project, expense, and document details for review.</p>
  <div class="packet-status">
    <span>Packet status</span>
    <strong>${escapeHtml(packetSummary.statusLabel)}</strong>
  </div>
  <div class="note">Home Ledger keeps this as a clear handoff. Check records, support files, and cost types before sharing.</div>
  <div class="metrics">
    ${pdfMetric("Total tracked spend", formatCurrency(totals.total))}
    ${pdfMetric("Possible improvements", formatCurrency(totals.potential))}
    ${pdfMetric("Repair or upkeep", formatCurrency(totals.repair))}
    ${pdfMetric("Needs classification", formatCurrency(totals.unclear))}
    ${pdfMetric("Open items", String(packetSummary.openItemCount))}
    ${pdfMetric("Proof/support needed", String(packetSummary.proofFilesStillNeeded))}
    ${pdfMetric("Expense proof files linked", String(packetSummary.expenseProofFilesLinked))}
    ${pdfMetric("Dismissed items", String(packetSummary.dismissedItemCount))}
    ${pdfMetric("Properties", String(cleanData.properties.length))}
    ${pdfMetric("Projects", String(cleanData.projects.length))}
    ${pdfMetric("Documents", String(cleanData.documents.length))}
  </div>
  <p class="lede">${escapeHtml(packetSummary.dismissedItemCopy)}</p>
  ${pdfSection("Readiness Summary", pdfTable(["Status", "Open items", "Records/files still needed", "Needs classification", "Draft text flags"], [[
    packetSummary.statusLabel,
    String(packetSummary.openItemCount),
    String(packetSummary.supportItemCount),
    String(packetSummary.needsClassificationCount),
    String(packetSummary.placeholderItemCount),
  ]]))}
  ${pdfSection("Records Still Needed", supportRows.length
    ? pdfTable(["Item", "Type", "Related item", "Action"], supportRows)
    : `<div class="empty">No required support records or files are flagged.</div>`)}
  ${pdfSection("Items to Review Before Sharing", reviewRows.length
    ? pdfTable(["Item", "Type", "Related item", "Action"], reviewRows)
    : `<div class="empty">Nothing needs review before sharing.</div>`)}
  ${pdfSection("Property Summary", propertyRows.length
    ? pdfTable(["Property", "Purchase Date", "Purchase Price", "Tracked Spend", "Projects", "Documents", "Follow-Ups"], propertyRows)
    : `<div class="empty">No properties.</div>`)}
  ${pdfSection("Project Summary", projectRows.length
    ? pdfTable(["Project", "Status", "Dates", "Contractor", "Permit", "Spend", "Items to finish"], projectRows)
    : `<div class="empty">No projects.</div>`)}
  ${pdfSection("Expense Detail", expenseRows.length
    ? pdfTable(["Date", "Expense", "Property", "Project", "Cost Type", "Receipt/File", "Amount"], expenseRows)
    : `<div class="empty">No expenses.</div>`)}
  ${pdfSection("Proof Files and Document Index", proofFileRows.length
    ? pdfTable(["Document Title", "Original Filename", "Type", "Document Date", "Linked Project", "Linked Expense", "File Status"], proofFileRows)
    : `<div class="empty">No documents.</div>`)}
  <div class="footer">Generated by Home Ledger. Attached file contents are not embedded in this PDF.</div>
</body>
</html>`;
}

function getPdfProofFileRows(records) {
  return records.documents.map((documentRecord) => {
    const relatedExpense = records.expenses.find((expense) => expense.id === documentRecord.expenseId);
    return [
      documentRecord.displayName,
      documentRecord.fileName || "None recorded",
      optionLabel(DOCUMENT_TYPES, documentRecord.documentType),
      formatDate(documentRecord.addedDate),
      getProjectName(records, documentRecord.projectId),
      relatedExpense ? `${getExpenseVendorName(records, relatedExpense)} / ${relatedExpense.description}` : "None recorded",
      getPdfDocumentFileStatus(documentRecord),
    ];
  });
}

function getPdfDocumentFileStatus(documentRecord) {
  if (documentRecord.hasFile) {
    return `File attached (${formatFileSize(documentRecord.fileSize)})`;
  }
  return documentRecord.fileStatusNote || "No file attached";
}

function getPdfFollowUpRecordLabel(records, item) {
  if (item.expenseId) {
    const expense = records.expenses.find((currentExpense) => currentExpense.id === item.expenseId);
    if (expense) return `${getExpenseVendorName(records, expense)} / ${expense.description}`;
  }
  if (item.documentId) {
    return records.documents.find((documentRecord) => documentRecord.id === item.documentId)?.displayName || "Document";
  }
  if (item.projectId) {
    return records.projects.find((project) => project.id === item.projectId)?.name || "Project";
  }
  if (item.propertyId) {
    return records.properties.find((property) => property.id === item.propertyId)?.name || "Property";
  }
  return "Record";
}

function pdfMetric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function pdfSection(title, body) {
  return `<section class="section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function pdfTable(headers, rows) {
  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th class="${pdfColumnClass(header)}">${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${pdfColumnClass(headers[index])}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function pdfColumnClass(header = "") {
  const label = String(header).toLowerCase();
  const classes = [];
  if (/\bid\b/.test(label)) classes.push("id-cell");
  if (/date|status|type|file status|receipt\/file|cost type/.test(label)) classes.push("nowrap");
  if (/amount|spend|price|total/.test(label)) classes.push("amount-cell");
  return classes.join(" ");
}

async function downloadFullBackup() {
  try {
    const backup = await buildFullBackup();
    const backupText = `${JSON.stringify(backup, null, 2)}\n`;
    if (new Blob([backupText]).size > MAX_BACKUP_FILE_SIZE) {
      showNotice(`This backup is over ${formatFileSize(MAX_BACKUP_FILE_SIZE)} and may be too large to restore in this beta. Remove a few large files or export the CSV and print summary separately.`);
      return;
    }
    const filename = isTutorialMode()
      ? `home-ledger-tutorial-backup-${todayISO()}.json`
      : `home-ledger-backup-${todayISO()}.json`;
    if (isDesktopMode()) {
      const result = await saveBackupFile(filename, backupText);
      if (result?.canceled) {
        showNotice("Backup canceled.");
        return;
      }
    } else {
      downloadTextFile(
        backupText,
        filename,
        "application/json;charset=utf-8",
      );
    }
    if (backup.missingFiles.length) {
      lastBackupCreatedAt = new Date().toISOString();
      showNotice(`Backup saved, but some stored files were missing from ${storageSurfaceName().toLowerCase()} storage.`);
      return;
    }
    lastBackupCreatedAt = new Date().toISOString();
    showNotice(isTutorialMode() ? "Tutorial backup saved with sample items only." : "Full backup saved.");
  } catch (error) {
    showNotice(getBackupError(error));
  }
}

async function buildFullBackup() {
  const backupData = sanitizeData(data);
  const files = [];
  const missingFiles = [];

  if (isTutorialMode()) {
    const tutorialDocumentsWithFiles = backupData.documents.filter((document) => document.hasFile);
    return createBackupEnvelope({
      ...backupData,
      documents: backupData.documents.map((documentRecord) =>
        documentRecord.hasFile
          ? stripDocumentFileMetadata(documentRecord, "Sample file details only. No file content was included.")
          : documentRecord,
      ),
    }, files, tutorialDocumentsWithFiles.map((documentRecord) => ({
      documentId: documentRecord.id,
      fileName: documentRecord.fileName || "Tutorial file",
      reason: "Sample file details only",
    })));
  }

  for (const documentRecord of backupData.documents.filter((document) => document.hasFile)) {
    try {
      const storedFile = await getDocumentFile(documentRecord.fileId || documentRecord.id);
      if (!storedFile?.blob) {
        missingFiles.push({
          documentId: documentRecord.id,
          fileName: documentRecord.fileName || "Attached file",
          reason: "Stored file missing",
        });
        continue;
      }

      const dataUrl = await blobToDataUrl(storedFile.blob);
      files.push({
        documentId: documentRecord.id,
        fileId: documentRecord.fileId || documentRecord.id,
        fileName: documentRecord.fileName || storedFile.name || "Attached file",
        mimeType: documentRecord.mimeType || storedFile.type || "application/octet-stream",
        fileSize: documentRecord.fileSize || storedFile.size || storedFile.blob.size || 0,
        fileLastModified: documentRecord.fileLastModified || storedFile.lastModified || null,
        fileStoredAt: documentRecord.fileStoredAt || storedFile.storedAt || "",
        sha256: await hashBlob(storedFile.blob),
        dataUrl,
      });
    } catch {
      missingFiles.push({
        documentId: documentRecord.id,
        fileName: documentRecord.fileName || "Attached file",
        reason: "Stored file could not be read",
      });
    }
  }

  return createBackupEnvelope(backupData, files, missingFiles);
}

async function restoreFromBackupFile(file) {
  if (!file) return;
  if (file.size > MAX_BACKUP_FILE_SIZE) {
    return showNotice(`Backup files over ${formatFileSize(MAX_BACKUP_FILE_SIZE)} are not accepted in this beta.`);
  }

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    return showNotice("This backup file could not be read as JSON.");
  }

  let backupSummary;
  try {
    backupSummary = summarizeBackupEnvelope(backup);
  } catch (error) {
    return showNotice(getBackupError(error));
  }

  if (!window.confirm(buildRestorePreviewMessage(file, backupSummary))) return;

  const oldFileIds = isTutorialMode() ? [] : await getExistingDocumentFileIds();
  let restored;
  try {
    restored = isTutorialMode()
      ? prepareTutorialBackupRestore(backup)
      : await prepareBackupRestore(backup);
  } catch (error) {
    return showNotice(getBackupError(error));
  }

  const saved = await updateData(restored.data, { allowBlockedWrite: true });
  if (!saved) {
    await deleteFilesBestEffort(restored.newFileIds);
    return;
  }

  const importedFileIds = new Set(restored.newFileIds);
  const cleanup = isTutorialMode()
    ? { failed: 0 }
    : await deleteFilesBestEffort(oldFileIds.filter((fileId) => !importedFileIds.has(fileId)));
  resetStorageEstimate();

  activeTab = "dashboard";
  selectedPropertyId = data.properties[0]?.id || "";
  resetFiltersAfterRestore();
  closeEditors();
  const restoreNotice = isTutorialMode()
    ? "Backup restored into the tutorial workspace only."
    : restored.skippedFiles
    ? "Backup restored. Some attached files could not be restored."
    : "Backup restored.";
  const cleanupNotice = cleanup.failed
    ? ` Some older stored files could not be removed from ${storageSurfaceName().toLowerCase()} storage.`
    : "";
  showNotice(`${restoreNotice}${cleanupNotice}`);
}

function buildRestorePreviewMessage(file, backupSummary) {
  const backupCounts = formatRecordCounts(backupSummary.counts);
  const currentCounts = formatRecordCounts(getRecordCounts(data));
  const fileCoverage = backupSummary.documentsWithFileMetadata
    ? `${backupSummary.fileCount} of ${backupSummary.documentsWithFileMetadata} document file${backupSummary.documentsWithFileMetadata === 1 ? "" : "s"} included`
    : "No attached file content marked";
  const filesMayBeSkipped = backupSummary.missingFilesCount || backupSummary.expectedFilesMissingFromBackup;
  const missingFileLine = filesMayBeSkipped
    ? `Files may be skipped: ${backupSummary.missingFilesCount + backupSummary.expectedFilesMissingFromBackup}`
    : "Files needing follow-up: none flagged";
  const workspaceLabel = isTutorialMode() ? "Tutorial workspace" : "Real home file";
  const modeCopy = isTutorialMode()
    ? "This will replace the temporary tutorial workspace only. Your real home file will not be changed."
    : "This will replace the current saved items. Download a backup first if you want to keep what is here.";

  return [
    "Restore this Home Ledger backup?",
    "",
    `Workspace affected: ${workspaceLabel}`,
    `Backup file: ${file?.name || "Selected backup"}`,
    `Created: ${formatRestoreTimestamp(backupSummary.createdAt)}`,
    `Items to restore: ${backupCounts}`,
    `Attached files: ${fileCoverage}`,
    missingFileLine,
    "",
    `Current saved items that will be replaced: ${currentCounts}`,
    modeCopy,
    "",
    "Choose OK to restore, or Cancel to keep the current workspace unchanged.",
  ].join("\n");
}

function getRecordCounts(records) {
  return {
    vendors: Array.isArray(records?.vendors) ? records.vendors.length : 0,
    properties: Array.isArray(records?.properties) ? records.properties.length : 0,
    projects: Array.isArray(records?.projects) ? records.projects.length : 0,
    expenses: Array.isArray(records?.expenses) ? records.expenses.length : 0,
    documents: Array.isArray(records?.documents) ? records.documents.length : 0,
  };
}

function formatRecordCounts(counts) {
  return [
    `${counts.vendors || 0} ${(counts.vendors || 0) === 1 ? "vendor" : "vendors"}`,
    `${counts.properties} ${counts.properties === 1 ? "property" : "properties"}`,
    `${counts.projects} ${counts.projects === 1 ? "project" : "projects"}`,
    `${counts.expenses} ${counts.expenses === 1 ? "expense" : "expenses"}`,
    `${counts.documents} ${counts.documents === 1 ? "document" : "documents"}`,
  ].join(", ");
}

function formatRestoreTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not listed";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function prepareTutorialBackupRestore(backup) {
  const { data: restoredData } = validateBackupEnvelope(backup);
  const restoredDocuments = restoredData.documents.map((documentRecord) =>
    documentRecord.hasFile
      ? stripDocumentFileMetadata(documentRecord, "Restored without the attached file. File content was not restored inside the tutorial workspace.")
      : documentRecord,
  );
  const tutorialRestoreData = sanitizeData({
    ...restoredData,
    documents: restoredDocuments,
  });

  return {
    data: {
      ...tutorialRestoreData,
      expenses: reconcileRestoredExpenseDocumentation(tutorialRestoreData.expenses, tutorialRestoreData.documents),
    },
    newFileIds: [],
    skippedFiles: restoredData.documents.some((documentRecord) => documentRecord.hasFile) ? 1 : 0,
  };
}

async function prepareBackupRestore(backup) {
  const { data: restoredData, files: backupFiles } = validateBackupEnvelope(backup);
  const newFileIds = [];
  let skippedFiles = 0;

  try {
    const restoredDocuments = [];

    for (const documentRecord of restoredData.documents) {
      if (!documentRecord.hasFile) {
        restoredDocuments.push(documentRecord);
        continue;
      }

      const backupFile = findBackupFileForDocument(backupFiles, documentRecord);

      if (!backupFile?.dataUrl) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "Restored without the attached file. File not included in backup."));
        continue;
      }
      if (!canStoreDocuments()) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "Restored without the attached file. File could not be restored in this app."));
        continue;
      }
      if (isBlockedBackupAttachment(backupFile)) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "Restored without the attached file. File type skipped during restore."));
        continue;
      }
      if (isBackupDataUrlTooLarge(backupFile.dataUrl)) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "Restored without the attached file. File too large to restore."));
        continue;
      }

      const blob = await dataUrlToBlob(backupFile.dataUrl);
      if (blob.size > MAX_DOCUMENT_FILE_SIZE) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "Restored without the attached file. File too large to restore."));
        continue;
      }
      if (!await backupFileChecksumMatches(blob, backupFile.sha256)) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "Restored without the attached file. File checksum did not match backup."));
        continue;
      }

      const fileId = createId("file");
      const storedFile = await saveDocumentFileRecord({
        id: fileId,
        blob,
        name: backupFile.fileName || documentRecord.fileName || "Attached file",
        type: backupFile.mimeType || documentRecord.mimeType || blob.type,
        size: blob.size,
        lastModified: backupFile.fileLastModified || documentRecord.fileLastModified || null,
        storedAt: backupFile.fileStoredAt || documentRecord.fileStoredAt || new Date().toISOString(),
      });
      newFileIds.push(fileId);

      restoredDocuments.push({
        ...documentRecord,
        hasFile: true,
        fileId,
        fileName: getSafeRestoredFileName(storedFile.name),
        mimeType: storedFile.type,
        fileSize: storedFile.size,
        fileLastModified: storedFile.lastModified,
        fileStoredAt: storedFile.storedAt,
      });
    }

    restoredData.documents = restoredDocuments;
    restoredData.expenses = reconcileRestoredExpenseDocumentation(restoredData.expenses, restoredDocuments);
  } catch (error) {
    await deleteFilesBestEffort(newFileIds);
    throw error;
  }

  return {
    data: restoredData,
    newFileIds,
    skippedFiles,
  };
}

async function getExistingDocumentFileIds() {
  try {
    const files = await listDocumentFiles();
    return files.map((fileRecord) => fileRecord.id).filter(Boolean);
  } catch {
    return data.documents.map((documentRecord) => documentRecord.fileId || documentRecord.id).filter(Boolean);
  }
}

async function deleteFilesBestEffort(fileIds) {
  const uniqueFileIds = [...new Set(fileIds.filter(Boolean))];
  const result = {
    deleted: 0,
    failed: 0,
  };
  await Promise.all(uniqueFileIds.map(async (fileId) => {
    try {
      await deleteDocumentFile(fileId);
      result.deleted += 1;
    } catch {
      result.failed += 1;
      // Backup/restore cleanup is best effort; the user-facing restore result remains accurate.
    }
  }));
  return result;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read file for backup."));
    reader.readAsDataURL(blob);
  });
}

async function hashBlob(blob) {
  if (!window.crypto?.subtle) return "";
  const buffer = await blob.arrayBuffer();
  const digest = await window.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function backupFileChecksumMatches(blob, expectedHash) {
  const hash = String(expectedHash || "").trim().toLowerCase();
  if (!hash) return true;
  if (!/^[a-f0-9]{64}$/.test(hash) || !window.crypto?.subtle) return false;
  return await hashBlob(blob) === hash;
}

async function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new Error("Backup file data is not in the expected format.");
  }
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Could not read a file stored in the backup.");
  return response.blob();
}

function requestStorageEstimate() {
  if (storageEstimate.status !== "idle") return;
  if (!navigator.storage?.estimate) {
    storageEstimate = { status: "unavailable", usage: 0, quota: 0 };
    return;
  }

  storageEstimate = { status: "loading", usage: 0, quota: 0 };
  navigator.storage.estimate()
    .then((estimate) => {
      storageEstimate = {
        status: "ready",
        usage: Number(estimate.usage) || 0,
        quota: Number(estimate.quota) || 0,
      };
      if (activeTab === "export") render();
    })
    .catch(() => {
      storageEstimate = { status: "unavailable", usage: 0, quota: 0 };
      if (activeTab === "export") render();
    });
}

function resetStorageEstimate() {
  storageEstimate = {
    status: "idle",
    usage: 0,
    quota: 0,
  };
}

function normalizeSelectionsAndFilters() {
  const propertyIds = new Set(data.properties.map((property) => property.id));
  if (selectedPropertyId && !propertyIds.has(selectedPropertyId)) {
    selectedPropertyId = data.properties[0]?.id || "";
  }
  if (projectFilters.propertyId !== EMPTY_FILTER && !propertyIds.has(projectFilters.propertyId)) {
    projectFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
  }
  if (expenseFilters.propertyId !== EMPTY_FILTER && !propertyIds.has(expenseFilters.propertyId)) {
    expenseFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
  }
  if (documentFilters.propertyId !== EMPTY_FILTER && !propertyIds.has(documentFilters.propertyId)) {
    documentFilters.propertyId = EMPTY_FILTER;
  }
  if (calculatorBasisPropertyId && !propertyIds.has(calculatorBasisPropertyId)) {
    calculatorBasisPropertyId = data.properties[0]?.id || "";
  }
  if (projectCostPlan.propertyId && !propertyIds.has(projectCostPlan.propertyId)) {
    projectCostPlan = { ...projectCostPlan, propertyId: data.properties[0]?.id || "", projectId: "" };
  }
  expandedDashboardPropertyIds = new Set([...expandedDashboardPropertyIds].filter((propertyId) => propertyIds.has(propertyId)));

  const projectIds = new Set(data.projects.map((project) => project.id));
  const vendorIds = new Set(data.vendors.map((vendor) => vendor.id));
  if (editingVendorId && !vendorIds.has(editingVendorId)) {
    editingVendorId = undefined;
  }
  if (selectedProjectId && !projectIds.has(selectedProjectId)) {
    selectedProjectId = "";
  }
  if (projectCostPlan.projectId && !projectIds.has(projectCostPlan.projectId)) {
    projectCostPlan = { ...projectCostPlan, projectId: "" };
  }
  if (propertyProjectPreviewId && !projectIds.has(propertyProjectPreviewId)) {
    propertyProjectPreviewId = "";
  }
  if (activeProjectFileId && !projectIds.has(activeProjectFileId)) {
    activeProjectFileId = "";
  }
  if (returnToProjectFileId && !projectIds.has(returnToProjectFileId)) {
    returnToProjectFileId = "";
  }
  expandedProjectFollowUpIds = new Set([...expandedProjectFollowUpIds].filter((projectId) => projectIds.has(projectId)));
  if (editingProjectId && !projectIds.has(editingProjectId)) {
    editingProjectId = undefined;
  }
  if (expenseFilters.projectId !== EMPTY_FILTER && !projectIds.has(expenseFilters.projectId)) {
    expenseFilters.projectId = EMPTY_FILTER;
  }
  const expenseIds = new Set(data.expenses.map((expense) => expense.id));
  if (expenseDocumentsPreviewId && !expenseIds.has(expenseDocumentsPreviewId)) {
    expenseDocumentsPreviewId = "";
  }
  if (activeFollowUpItemId && !getFollowUpItemById(activeFollowUpItemId)) {
    activeFollowUpItemId = "";
  }
  if (
    expenseFilters.projectId !== EMPTY_FILTER &&
    expenseFilters.propertyId !== EMPTY_FILTER &&
    !data.projects.some((project) => project.id === expenseFilters.projectId && project.propertyId === expenseFilters.propertyId)
  ) {
    expenseFilters.projectId = EMPTY_FILTER;
  }
}

function resetFiltersAfterRestore() {
  projectFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
  projectFilters.status = EMPTY_FILTER;
  projectFilters.category = EMPTY_FILTER;
  projectFilters.openItems = EMPTY_FILTER;
  projectFilters.startDateFrom = "";
  projectFilters.startDateTo = "";
  projectFilters.completionDateFrom = "";
  projectFilters.completionDateTo = "";
  expenseFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
  expenseFilters.projectId = EMPTY_FILTER;
  expenseFilters.classification = EMPTY_FILTER;
  expenseFilters.category = EMPTY_FILTER;
  expenseFilters.documentationStatus = EMPTY_FILTER;
  expenseFilters.sort = "date-desc";
  documentFilters.propertyId = EMPTY_FILTER;
  documentFilters.documentType = EMPTY_FILTER;
  documentFilters.fileStatus = EMPTY_FILTER;
  documentFilters.sort = "date-desc";
  calculatorBasisPropertyId = selectedPropertyId || "";
  projectCostPlan = { ...projectCostPlan, propertyId: selectedPropertyId || "", projectId: "" };
  selectedProjectId = "";
  draftExpenseProjectId = "";
  draftDocumentExpenseId = "";
  draftDocumentProjectId = "";
}

function getBackupError(error) {
  const message = error?.message || "";
  if (/quota|storage/i.test(message)) {
    return `The backup could not be restored because ${storageSurfaceName().toLowerCase()} storage may be full.`;
  }
  if (/Home Ledger backup|newer version/i.test(message)) {
    return message;
  }
  return "The backup could not be completed. Check the file and try again.";
}

async function updateData(nextData, options = {}) {
  if (!isTutorialMode() && storageWriteBlocked && !options.allowBlockedWrite) {
    notice = "Saves are paused because your information could not be loaded safely. Restore a backup or reopen the app before making changes.";
    render();
    return false;
  }
  const previousData = data;
  data = sanitizeData(nextData);
  if (isTutorialMode()) {
    tutorialData = data;
    render();
    return true;
  }
  try {
    data = await saveRecords(STORAGE_KEY, data);
    realData = data;
    storageWriteBlocked = false;
  } catch {
    data = previousData;
    notice = `Unable to save. Check ${storageSurfaceName()} storage settings before adding more items.`;
    render();
    return false;
  }
  try {
    storageInfo = await getStorageInfo();
  } catch {
    // The save succeeded; keep the app responsive if storage metrics are unavailable.
  }
  render();
  return true;
}

function getDocumentStorageError(error) {
  const message = error?.message || "";
  if (/quota|storage/i.test(message)) {
    return `The file could not be saved because ${storageSurfaceName().toLowerCase()} storage may be full. Keep your own backup of important files.`;
  }
  if (/available|indexeddb/i.test(message)) {
    return `Attached file storage is not available in this ${isDesktopMode() ? "Mac app" : "browser"}.`;
  }
  if (/blocked/i.test(message)) {
    return `Document storage is blocked by another ${isDesktopMode() ? "app window" : "browser tab"}. Close other windows for this app and try again.`;
  }
  return "The file could not be saved. Keep your own backup and try again.";
}

function renderToast() {
  return notice ? `<div class="toast" role="status">${escapeHtml(notice)}</div>` : "";
}

function syncNoticeToast() {
  const workspace = app.querySelector(".workspace");
  if (!workspace) return;

  const existingToast = workspace.querySelector(".toast");
  if (!notice) {
    existingToast?.remove();
    return;
  }

  if (existingToast) {
    existingToast.textContent = notice;
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = notice;
  workspace.prepend(toast);
}

function showNotice(message, options = {}) {
  const shouldRender = options.render !== false;
  notice = message;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    notice = "";
    if (shouldRender) {
      render();
    } else {
      syncNoticeToast();
    }
  }, 2800);
  if (shouldRender) {
    render();
  } else {
    syncNoticeToast();
  }
}

function showFormNotice(form, fieldName, message) {
  showNotice(message, { render: false });
  window.requestAnimationFrame(() => {
    const fieldControl = form?.querySelector(`[name="${fieldName}"]`) || app.querySelector(`[name="${fieldName}"]`);
    if (!fieldControl) return;
    const currentForm = fieldControl.closest("form") || form;
    currentForm?.querySelectorAll(".field-error-message").forEach((error) => error.remove());
    currentForm?.querySelectorAll("[aria-invalid='true']").forEach((control) => {
      control.removeAttribute("aria-invalid");
      const describedBy = (control.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter((id) => id && !id.endsWith("-error"))
        .join(" ");
      if (describedBy) {
        control.setAttribute("aria-describedby", describedBy);
      } else {
        control.removeAttribute("aria-describedby");
      }
    });

    const errorId = `${currentForm?.dataset.form || "form"}-${fieldName}-error`;
    const errorMessage = document.createElement("span");
    errorMessage.className = "field-error-message";
    errorMessage.id = errorId;
    errorMessage.setAttribute("role", "alert");
    errorMessage.textContent = message;
    (fieldControl.closest(".field") || fieldControl.parentElement)?.append(errorMessage);

    const describedBy = new Set((fieldControl.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    describedBy.add(errorId);
    fieldControl.focus();
    fieldControl.setAttribute("aria-invalid", "true");
    fieldControl.setAttribute("aria-describedby", Array.from(describedBy).join(" "));
  });
}

function closeEditors() {
  editingPropertyField = "";
  editingProjectId = undefined;
  editingProjectField = "";
  editingExpenseId = undefined;
  editingDocumentId = undefined;
  documentFileInputAllowed = false;
  editingVendorId = undefined;
  recordsToFinishOpen = false;
  activeFollowUpItemId = "";
  activeProjectFileId = "";
  returnToProjectFileId = "";
  propertyProjectPreviewId = "";
  expandedProjectFollowUpIds = new Set();
  expenseDocumentsPreviewId = "";
  vendorManagerOpen = false;
  draftExpenseFormValues = null;
  draftExpenseProjectId = "";
  draftDocumentExpenseId = "";
  draftDocumentProjectId = "";
  propertyMode = "view";
}

function captureExpenseFormDraft() {
  const form = app.querySelector('[data-form="expense"]');
  if (!form || editingExpenseId === undefined) return;
  draftExpenseFormValues = Object.fromEntries(new FormData(form).entries());
}

function renderPageIntro({ actions = "", title }) {
  return `
    <div class="page-intro">
      <div>
        <h2>${escapeHtml(title)}</h2>
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ""}
    </div>
  `;
}

function renderPanelHeader(title, _description = "", icon = "", actions = "") {
  return `
    <div class="panel-header">
      <div>
        ${icon ? `<span class="panel-icon" aria-hidden="true">${iconSymbol(icon)}</span>` : ""}
        <div>
          <h2>${escapeHtml(title)}</h2>
        </div>
      </div>
      ${actions ? `<div class="panel-actions">${actions}</div>` : ""}
    </div>
  `;
}

function renderMetrics(items, className = "") {
  return `
    <div class="metric-grid ${className}">
      ${items.map(([label, value, tone]) => `
        <article class="metric-card ${tone ? `tone-${tone}` : ""}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function renderNotice(text, className = "") {
  return `<div class="notice-card ${className}"><p>${escapeHtml(text)}</p></div>`;
}

function renderEmpty(title, text, actions = "") {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
      ${actions ? `<div class="empty-actions">${actions}</div>` : ""}
    </div>
  `;
}

function renderResultsSection(title, count, content) {
  return `
    <div class="results-area">
      <div class="results-header">
        <div>
          <span>Results</span>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <strong>${escapeHtml(formatResultCount(count))}</strong>
      </div>
      <div class="results-body">
        ${content}
      </div>
    </div>
  `;
}

function formatResultCount(count) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function renderInlineAction(label, action, className = "button-primary", dataset = {}) {
  const dataAttrs = Object.entries(dataset)
    .filter(([, value]) => value)
    .map(([key, value]) => `data-${kebabCase(key)}="${escapeAttr(value)}"`)
    .join(" ");
  return `<button class="button ${escapeAttr(className)}" data-action="${escapeAttr(action)}" ${dataAttrs} type="button">${escapeHtml(label)}</button>`;
}

function renderDisabledAction(label, reason) {
  return `
    <span class="disabled-action-wrap">
      <button class="button button-primary" disabled title="${escapeAttr(reason)}" type="button"><span aria-hidden="true">+</span>${escapeHtml(label)}</button>
      <small>${escapeHtml(reason)}</small>
    </span>
  `;
}

function renderFilterPanel(content, { count = 0, hasActiveFilters = false, clearAction = "", className = "" } = {}) {
  const shouldOpen = hasActiveFilters || count > 4;
  return `
    <details class="filter-panel" ${shouldOpen ? "open" : ""}>
      <summary>
        <span>Filters</span>
        ${hasActiveFilters ? `<button class="text-action" data-action="${escapeAttr(clearAction)}" type="button">Clear filters</button>` : ""}
      </summary>
      <div class="filter-bar ${escapeAttr(className)}">
        ${content}
      </div>
    </details>
  `;
}

function hasActiveProjectFilters() {
  return projectFilters.status !== EMPTY_FILTER ||
    projectFilters.category !== EMPTY_FILTER ||
    projectFilters.openItems !== EMPTY_FILTER ||
    Boolean(projectFilters.startDateFrom) ||
    Boolean(projectFilters.startDateTo) ||
    Boolean(projectFilters.completionDateFrom) ||
    Boolean(projectFilters.completionDateTo) ||
    (projectFilters.propertyId !== EMPTY_FILTER && projectFilters.propertyId !== selectedPropertyId);
}

function hasActiveExpenseFilters() {
  return expenseFilters.projectId !== EMPTY_FILTER ||
    expenseFilters.classification !== EMPTY_FILTER ||
    expenseFilters.category !== EMPTY_FILTER ||
    expenseFilters.documentationStatus !== EMPTY_FILTER ||
    expenseFilters.sort !== "date-desc" ||
    (expenseFilters.propertyId !== EMPTY_FILTER && expenseFilters.propertyId !== selectedPropertyId);
}

function hasActiveDocumentFilters() {
  return documentFilters.propertyId !== EMPTY_FILTER ||
    documentFilters.documentType !== EMPTY_FILTER ||
    documentFilters.fileStatus !== EMPTY_FILTER ||
    documentFilters.sort !== "date-desc";
}

function renderFilter(label, key, value, options, { includeAll = true } = {}) {
  return `
    <label class="field compact-field">
      <span>${escapeHtml(label)}</span>
      <select data-filter="${escapeAttr(key)}">
        ${includeAll ? optionHtml(EMPTY_FILTER, "All", value) : ""}
        ${options.map((option) => optionHtml(option.value, option.label, value)).join("")}
      </select>
    </label>
  `;
}

function renderDateFilter(label, key, value) {
  return `
    <label class="field compact-field">
      <span>${escapeHtml(label)}</span>
      <input data-filter="${escapeAttr(key)}" type="date" value="${escapeAttr(value || "")}">
    </label>
  `;
}

function renderProjectDateFilterCluster() {
  return `
    <fieldset class="filter-cluster project-date-filter-cluster">
      <legend>Dates</legend>
      <div class="date-filter-row">
        <span>Start</span>
        ${renderDateFilter("From", "project.startDateFrom", projectFilters.startDateFrom)}
        ${renderDateFilter("To", "project.startDateTo", projectFilters.startDateTo)}
      </div>
      <div class="date-filter-row">
        <span>Completion</span>
        ${renderDateFilter("From", "project.completionDateFrom", projectFilters.completionDateFrom)}
        ${renderDateFilter("To", "project.completionDateTo", projectFilters.completionDateTo)}
      </div>
    </fieldset>
  `;
}

function kebabCase(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function field(label, name, value, options = {}) {
  const type = options.type || "text";
  return `
    <label class="field ${options.highlight ? "needs-resolution" : ""}">
      <span>${escapeHtml(label)}</span>
      <input
        name="${escapeAttr(name)}"
        ${options.required ? "required" : ""}
        ${options.placeholder ? `placeholder="${escapeAttr(options.placeholder)}"` : ""}
        ${options.step ? `step="${escapeAttr(options.step)}"` : ""}
        type="${escapeAttr(type)}"
        value="${escapeAttr(value)}"
      >
    </label>
  `;
}

function textarea(label, name, value, options = {}) {
  return `
    <label class="field ${options.highlight ? "needs-resolution" : ""}">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeAttr(name)}" rows="4">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function selectField(label, name, value, options, includeBlank = true, fieldOptions = {}) {
  return `
    <label class="field ${fieldOptions.highlight ? "needs-resolution" : ""}">
      <span>${escapeHtml(label)}</span>
      <select name="${escapeAttr(name)}">
        ${includeBlank ? optionHtml("", name === "projectId" ? "No project" : name === "expenseId" ? "No expense" : name === "vendorId" ? "Unassigned / unknown" : "None", value) : ""}
        ${options.map((option) => optionHtml(option.value, option.label, value)).join("")}
      </select>
    </label>
  `;
}

function optionHtml(value, label, selectedValue) {
  return `<option value="${escapeAttr(value)}" ${String(value) === String(selectedValue) ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function formActions(label) {
  return `
    <div class="form-actions">
      <button class="button button-secondary" data-action="cancel-form" type="button">Cancel</button>
      <button class="button button-primary" type="submit">${escapeHtml(label)}</button>
    </div>
  `;
}

function documentFormActions(document) {
  return `
    <div class="form-actions">
      ${document ? `<button class="button button-danger" data-action="delete-document" data-id="${escapeAttr(document.id)}" type="button">Delete document</button>` : ""}
      <button class="button button-secondary" data-action="cancel-form" type="button">Cancel</button>
      <button class="button button-primary" type="submit">Save document</button>
    </div>
  `;
}

function scoreToneName(score) {
  if (score >= 80) return "green";
  if (score >= 50) return "amber";
  return "rust";
}

function scoreToneClass(score) {
  return `tone-${scoreToneName(score)}`;
}

function rowActions(editAction, deleteAction, id, label) {
  return `
    <div class="row-actions">
      <button aria-label="Edit ${escapeAttr(label)}" data-action="${escapeAttr(editAction)}" data-id="${escapeAttr(id)}" type="button">✎</button>
      <button aria-label="Delete ${escapeAttr(label)}" data-action="${escapeAttr(deleteAction)}" data-id="${escapeAttr(id)}" type="button">×</button>
    </div>
  `;
}

function deleteRowAction(deleteAction, id, label) {
  return `
    <div class="row-actions">
      <button aria-label="Delete ${escapeAttr(label)}" data-action="${escapeAttr(deleteAction)}" data-id="${escapeAttr(id)}" type="button">×</button>
    </div>
  `;
}

function projectRowActions(project) {
  return `
    <div class="row-actions text-actions">
      <button class="text-action" data-action="edit-project" data-id="${escapeAttr(project.id)}" type="button">Edit project</button>
      <button aria-label="Delete ${escapeAttr(project.name)}" data-action="delete-project" data-id="${escapeAttr(project.id)}" type="button">×</button>
    </div>
  `;
}

function getExpenseName(records, id) {
  const expense = records.expenses.find((item) => item.id === id);
  if (!expense) return "";
  return `${getExpenseVendorName(records, expense, "Expense")}${expense.description ? ` - ${expense.description}` : ""}`;
}

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((header, index) => `<th class="${index === headers.length - 1 ? "align-right" : ""}">${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const rowClass = row[row.length - 1] === "is-selected" ? " class=\"is-selected\"" : "";
            const cells = rowClass ? row.slice(0, -1) : row;
            return `<tr${rowClass}>${cells.map((cell, index) => `<td class="${index >= cells.length - 2 ? "align-right" : ""}" data-label="${escapeAttr(headers[index] || "")}">${cell}</td>`).join("")}</tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function countLabel(count, label) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function detailItem(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function classificationPill(value) {
  const tone = value === "potential basis addition" ? "green" : value === "repair or maintenance" ? "rust" : "amber";
  return `<span class="pill tone-${tone}">${escapeHtml(optionLabel(CLASSIFICATIONS, value))}</span>`;
}

function documentationPill(value) {
  const hasDocument = ["receipt attached", "invoice attached"].includes(value);
  return `<span class="pill ${hasDocument ? "tone-green" : "tone-amber"}">${hasDocument ? "✓ " : ""}${escapeHtml(optionLabel(DOCUMENT_STATUSES, value))}</span>`;
}

function iconSymbol(name) {
  const symbols = {
    alert: "△",
    activity: "▦",
    clipboard: "▤",
    document: "◇",
    edit: "✎",
    folder: "▣",
    home: "⌂",
    image: "□",
    receipt: "▥",
    settings: "⚙",
  };
  return symbols[name] || "•";
}

function tabIcon(id) {
  const icons = {
    dashboard: "⌂",
    property: "⌁",
    projects: "▣",
    expenses: "▥",
    documents: "◇",
    calculators: "#",
    export: "↓",
    tutorial: "▤",
  };
  return icons[id] || "•";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
