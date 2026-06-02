import {
  buildCpaReviewPacket,
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
  getExpenseTotals,
  getProjectReviewSummaries,
  getProjectName,
  getPropertyReviewSummaries,
  getPropertyName,
  getReviewReadiness,
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
} from "../backend/domain/model.js";
import {
  createBackupEnvelope,
  findBackupFileForDocument,
  getSafeRestoredFileName,
  isBackupDataUrlTooLarge,
  isBlockedBackupAttachment,
  reconcileRestoredExpenseDocumentation,
  stripDocumentFileMetadata,
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
  saveRecords,
} from "../backend/storage/records-storage.js";
import {
  createTutorialData,
  TUTORIAL_STEPS,
} from "../backend/domain/tutorial-data.js";

const EMPTY_FILTER = "all";
const WORKSPACE_REAL = "records";
const WORKSPACE_TUTORIAL = "tutorial";
const app = document.querySelector("#app");

let data = EMPTY_DATA;
let realData = EMPTY_DATA;
let tutorialData = createTutorialData();
let workspaceMode = WORKSPACE_REAL;
let activeTab = "dashboard";
let selectedPropertyId = "";
let notice = "";
let storageWriteBlocked = false;
let propertyMode = "new";
let selectedProjectId = "";
let editingProjectId;
let editingExpenseId;
let editingDocumentId;
let draftDocumentExpenseId = "";
let documentPreview = null;
let lastBackupCreatedAt = "";
let storageEstimate = {
  status: "idle",
  usage: 0,
  quota: 0,
};
let storageInfo = {
  mode: isDesktopMode() ? "desktop" : "browser",
  recordsPathLabel: isDesktopMode() ? "Mac app records file" : "Browser local storage",
  documentsPathLabel: isDesktopMode() ? "Mac app documents folder" : "Browser IndexedDB",
  storageDescription: isDesktopMode()
    ? "Records and document copies are stored locally by the Mac app."
    : "Records and document copies are stored in this browser profile.",
  recordsBytes: 0,
  documentBytes: 0,
  documentCount: 0,
};

const projectFilters = {
  propertyId: selectedPropertyId || EMPTY_FILTER,
  status: EMPTY_FILTER,
  category: EMPTY_FILTER,
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
  propertyId: selectedPropertyId || EMPTY_FILTER,
  documentType: EMPTY_FILTER,
  fileStatus: EMPTY_FILTER,
};

const DOCUMENT_FILE_FILTERS = [
  { value: "stored", label: "Stored file" },
  { value: "needs-follow-up", label: "Needs follow-up" },
  { value: "no-file", label: "No file" },
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
if (!isDesktopMode()) {
  window.addEventListener("storage", handleStorageEvent);
}

renderLoading();
initializeApp();

function renderLoading() {
  app.innerHTML = `
    <main class="workspace loading-workspace">
      <section class="panel">
        ${renderPanelHeader("Opening Home Basis Tracker", "Loading local records from this device.", "home")}
      </section>
    </main>
  `;
}

async function initializeApp() {
  try {
    realData = await loadRecords(STORAGE_KEY);
    data = realData;
    storageWriteBlocked = false;
  } catch {
    realData = EMPTY_DATA;
    data = EMPTY_DATA;
    storageWriteBlocked = true;
    notice = "Unable to load local records. To protect existing data, new saves are paused until you restore a backup or reopen the app.";
  }
  try {
    storageInfo = await getStorageInfo();
  } catch {
    // Records can still load and save even if the optional storage summary is unavailable.
  }

  selectedPropertyId = data.properties[0]?.id || "";
  propertyMode = data.properties.length ? "view" : "new";
  resetFiltersAfterRestore();
  render();
}

function render() {
  if (selectedPropertyId && !data.properties.some((property) => property.id === selectedPropertyId)) {
    selectedPropertyId = data.properties[0]?.id || "";
  }
  normalizeSelectionsAndFilters();

  app.innerHTML = `
    <header class="app-header ${isTutorialMode() ? "is-tutorial-mode" : ""}">
      <div class="brand-block">
        <p class="eyebrow">${isTutorialMode() ? "Tutorial workspace" : "Home records"}</p>
        <h1>Home Basis Tracker</h1>
        <p>${isTutorialMode()
          ? "You are using sample records. Changes here are temporary and separate from your real binder."
          : "Keep receipts, project notes, and home improvement records organized on this device."}</p>
      </div>
      <div class="header-actions">
        <nav class="app-tabs" aria-label="App sections" role="tablist">
          ${TABS.map((tab) => `
            <button
              aria-controls="${tab.id}-panel"
              aria-selected="${activeTab === tab.id}"
              class="${activeTab === tab.id ? "is-active" : ""}"
              data-tab="${tab.id}"
              id="${tab.id}-tab"
              role="tab"
              type="button"
            >${escapeHtml(tab.label)}</button>
          `).join("")}
        </nav>
        ${renderWorkspaceControls()}
      </div>
    </header>
    <main class="workspace">
      ${renderToast()}
      ${renderTutorialModeBanner()}
      <section class="tab-panel" id="${activeTab}-panel" role="tabpanel" aria-labelledby="${activeTab}-tab">
        ${renderActiveTab()}
      </section>
      ${renderDocumentPreview()}
    </main>
  `;
}

function renderActiveTab() {
  if (activeTab === "tutorial") return renderTutorialView();
  if (activeTab === "property") return renderPropertyView();
  if (activeTab === "projects") return renderProjectsView();
  if (activeTab === "expenses") return renderExpensesView();
  if (activeTab === "documents") return renderDocumentsView();
  if (activeTab === "export") return renderExportCenter();
  return renderDashboard();
}

function renderDashboard() {
  const totals = getExpenseTotals(data.expenses);
  const readiness = getReviewReadiness(data);
  const propertySummaries = getPropertyReviewSummaries(data);
  const recentExpenses = sortByDateDesc(data.expenses).slice(0, 6);
  const hasRecords = data.properties.length || data.projects.length || data.expenses.length || data.documents.length;
  const storedFileCount = data.documents.filter((document) => document.hasFile).length;
  const projectCounts = PROJECT_STATUSES.map((status) => ({
    ...status,
    count: data.projects.filter((project) => project.status === status.value).length,
  }));

  return `
    <div class="page-stack">
      ${hasRecords ? renderPageIntro({
        eyebrow: "Overview",
        title: "Your home records binder",
        description: "A local-first summary of projects, expenses, documentation follow-ups, and records to review with your CPA.",
        actions: `
          <button class="button button-secondary" data-action="add-expense" type="button"><span aria-hidden="true">+</span>Add expense</button>
          <button class="button button-primary" data-action="open-export" type="button"><span aria-hidden="true">↓</span>Export & backup</button>
        `,
      }) : renderOnboardingPanel()}

      ${renderMetrics([
        ["Total tracked spend", formatCurrency(totals.total), ""],
        ["Marked potential basis additions", formatCurrency(totals.potential), "green"],
        ["Repair/maintenance", formatCurrency(totals.repair), "rust"],
        ["Unclear / ask CPA", formatCurrency(totals.unclear), "amber"],
        ["Review readiness", `${readiness.score}%`, readiness.score >= 80 ? "green" : readiness.score >= 50 ? "amber" : "rust"],
      ])}

      ${renderNotice("Home Basis Tracker helps organize records for review. It is not tax software and does not decide tax treatment. Confirm classifications and records with your CPA.")}
      ${storedFileCount ? renderNotice(`${storedFileCount} attached file${storedFileCount === 1 ? " is" : "s are"} stored locally ${storageLocationShort()}. Keep your own backup of important records.`) : ""}

      ${hasRecords ? renderReviewReadinessPanel(readiness) : ""}
      ${propertySummaries.length ? renderPropertyDashboardCards(propertySummaries) : ""}

      <div class="content-grid two-columns">
        <section class="panel">
          ${renderPanelHeader("Recent expenses", "Newest records saved in your local binder.", "receipt")}
          ${recentExpenses.length ? renderRecentExpenseTable(recentExpenses) : renderEmpty("No expenses yet", "Add receipts, invoices, or notes when you are ready.")}
        </section>
        <section class="panel">
          ${renderPanelHeader("Projects by status", "A quick read on open and completed home work.", "folder")}
          <div class="status-list">
            ${projectCounts.map((status) => `
              <div class="status-row">
                <span>${escapeHtml(status.label)}</span>
                <strong>${status.count}</strong>
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderOnboardingPanel() {
  return `
    <section class="onboarding-panel">
      <div>
        <p class="eyebrow">Start your binder</p>
        <h2>Organize home improvement records before they become hard to find.</h2>
        <p>Track properties, projects, expenses, document status, notes, and local file attachments. Your records are saved locally ${storageLocationShort()} unless you export or share them.</p>
      </div>
      <ol class="step-list">
        <li><span aria-hidden="true">⌂</span><span>Add your property</span></li>
        <li><span aria-hidden="true">▣</span><span>Create projects</span></li>
        <li><span aria-hidden="true">▤</span><span>Track expenses and export a CPA review summary</span></li>
      </ol>
      <div class="onboarding-actions">
        <button class="button button-primary" data-action="add-property" type="button"><span aria-hidden="true">+</span>Add your property</button>
        <button class="button button-secondary" data-action="start-tutorial" type="button">Open tutorial</button>
      </div>
    </section>
  `;
}

function renderReviewReadinessPanel(readiness) {
  const followUps = readiness.followUps.slice(0, 6);
  const readyItems = readiness.readyItems.slice(0, 4);

  return `
    <section class="panel review-readiness-panel">
      ${renderPanelHeader("Review readiness", "A practical checklist for getting this binder ready to share with a CPA.", "clipboard", `
        <button class="button button-secondary" data-action="open-export" type="button">Open review packet</button>
      `)}
      <div class="readiness-layout">
        <div class="readiness-score ${readiness.score >= 80 ? "tone-green" : readiness.score >= 50 ? "tone-amber" : "tone-rust"}">
          <strong>${readiness.score}%</strong>
          <span>${readiness.completedChecks} of ${readiness.totalChecks} readiness checks complete</span>
        </div>
        <div class="readiness-columns">
          <div>
            <h3>Ready</h3>
            ${readyItems.length ? `
              <ul class="check-list">
                ${readyItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            ` : `<p class="helper-note">Add a property, expenses, and documents to begin building readiness.</p>`}
          </div>
          <div>
            <h3>Follow up</h3>
            ${followUps.length ? `
              <ul class="followup-list">
                ${followUps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            ` : `<p class="helper-note">No open readiness follow-ups recorded.</p>`}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderPropertyDashboardCards(propertySummaries) {
  return `
    <section class="panel">
      ${renderPanelHeader("Property dashboards", "Each property shows spend, documents, and review gaps at a glance.", "home")}
      <div class="property-dashboard-grid">
        ${propertySummaries.map((summary) => `
          <article class="property-dashboard-card">
            <div>
              <h3>${escapeHtml(summary.property.name)}</h3>
              <p>${escapeHtml(summary.property.address || "Address not added")}</p>
            </div>
            <dl class="mini-detail-list">
              ${detailItem("Spend", formatCurrency(summary.totals.total))}
              ${detailItem("Potential basis", formatCurrency(summary.totals.potential))}
              ${detailItem("Projects", summary.projects.length)}
              ${detailItem("Open projects", summary.openProjects.length)}
              ${detailItem("Documents", `${summary.documents.length} (${summary.storedFiles} files)`)}
              ${detailItem("Follow-ups", summary.missingDocuments)}
            </dl>
            <div class="readiness-meter" aria-label="Review readiness ${summary.readinessScore}%">
              <span style="width: ${summary.readinessScore}%"></span>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderWorkspaceControls() {
  if (isTutorialMode()) {
    return `
      <div class="workspace-controls" aria-label="Tutorial workspace controls">
        <button class="button button-secondary" data-action="reset-tutorial" type="button">Reset tutorial</button>
        <button class="button button-primary" data-action="exit-tutorial" type="button">Exit tutorial</button>
      </div>
    `;
  }

  return `
    <div class="workspace-controls" aria-label="Tutorial workspace controls">
      <button class="button button-secondary" data-action="start-tutorial" type="button">Tutorial workspace</button>
    </div>
  `;
}

function renderTutorialModeBanner() {
  if (!isTutorialMode()) return "";

  return `
    <section class="tutorial-banner print-hidden">
      <div>
        <p class="eyebrow">Sample data only</p>
        <h2>Tutorial Workspace</h2>
        <p>These records are temporary. They do not save to your real Home Basis Tracker records, and file attachments are simulated here.</p>
      </div>
      <div class="tutorial-banner-actions">
        <button class="button button-secondary" data-action="open-tutorial-step" data-tutorial-tab="tutorial" type="button">View guide</button>
        <button class="button button-secondary" data-action="reset-tutorial" type="button">Reset sample data</button>
        <button class="button button-primary" data-action="exit-tutorial" type="button">Return to real records</button>
      </div>
    </section>
  `;
}

function renderTutorialView() {
  const tutorialActions = isTutorialMode()
    ? `
      <button class="button button-secondary" data-action="reset-tutorial" type="button">Reset sample data</button>
      <button class="button button-primary" data-action="exit-tutorial" type="button">Return to real records</button>
    `
    : `<button class="button button-primary" data-action="start-tutorial" type="button">Start tutorial workspace</button>`;

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Tutorial Workspace",
        title: isTutorialMode() ? "Practice with sample home records" : "Learn the app without touching real records",
        description: isTutorialMode()
          ? "Use the sample property, projects, expenses, documents, exports, and backup controls. Your real binder is untouched."
          : "Open a separate sample-data workspace to learn every major workflow before entering your own records.",
        actions: tutorialActions,
      })}
      ${renderNotice(isTutorialMode()
        ? "Tutorial changes stay in memory until you exit, reset, or close this app window. They are not saved to your normal records file."
        : "The normal app opens empty by default. Sample data appears only after you start the tutorial workspace.", "tutorial-notice")}
      ${renderMetrics([
        ["Sample properties", String(tutorialData.properties.length), ""],
        ["Sample projects", String(tutorialData.projects.length), "blue"],
        ["Sample expenses", String(tutorialData.expenses.length), "green"],
        ["Sample documents", String(tutorialData.documents.length), "amber"],
        ["Storage impact", isTutorialMode() ? "Temporary" : "None", "rust"],
      ])}
      <section class="panel">
        ${renderPanelHeader("Guided workflow", "Open each area and try the task with sample records.", "clipboard")}
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
        ${renderPanelHeader("How separation works", "The tutorial is a sandbox, not your real binder.", "home")}
        <div class="safety-list">
          <div>
            <strong>Real records start empty</strong>
            <span>Sample records are never loaded into the normal workspace on first launch.</span>
          </div>
          <div>
            <strong>Edits are temporary</strong>
            <span>Add, edit, and delete sample records freely. Reset brings the tutorial back to its starting state.</span>
          </div>
          <div>
            <strong>Files are simulated</strong>
            <span>Choosing a file in tutorial mode records sample metadata only. The file is not copied into app storage.</span>
          </div>
          <div>
            <strong>Backups stay scoped</strong>
            <span>Tutorial backups contain sample records. Restores while in tutorial replace only the tutorial workspace.</span>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderPropertyView() {
  const selectedProperty = data.properties.find((property) => property.id === selectedPropertyId);
  const propertyProjects = data.projects.filter((project) => project.propertyId === selectedPropertyId);
  const propertyExpenses = data.expenses.filter((expense) => expense.propertyId === selectedPropertyId);
  const propertyDocuments = data.documents.filter((document) => document.propertyId === selectedPropertyId);
  const totals = getExpenseTotals(propertyExpenses);

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Property setup",
        title: "Property records",
        description: "Create a home profile, then connect projects and expenses to that property.",
        actions: `
          ${data.properties.length ? `<button class="button button-secondary" data-action="edit-property" type="button">Edit selected</button>` : ""}
          ${selectedProperty ? `<button class="button button-danger" data-action="delete-property" data-id="${escapeAttr(selectedProperty.id)}" type="button">Delete selected</button>` : ""}
          <button class="button button-primary" data-action="add-property" type="button"><span aria-hidden="true">+</span>Add property</button>
        `,
      })}
      <div class="content-grid two-columns">
        <section class="panel">
          ${renderPanelHeader("Selected property", "", "home")}
          ${data.properties.length ? `
            <label class="field">
              <span>Property</span>
              <select data-filter="selectedPropertyId">
                ${data.properties.map((property) => optionHtml(property.id, property.name, selectedPropertyId)).join("")}
              </select>
            </label>
            ${selectedProperty ? `
              <div class="summary-card">
                <h3>${escapeHtml(selectedProperty.name)}</h3>
                <dl class="detail-list">
                  ${detailItem("Address", selectedProperty.address || "Not added")}
                  ${detailItem("Purchase date", formatDate(selectedProperty.purchaseDate))}
                  ${detailItem("Purchase price", selectedProperty.purchasePrice ? formatCurrency(selectedProperty.purchasePrice) : "Not added")}
                  ${detailItem("Projects", propertyProjects.length)}
                  ${detailItem("Tracked expenses", formatCurrency(totals.total))}
                  ${detailItem("Documents", propertyDocuments.length)}
                </dl>
                ${selectedProperty.notes ? `<p class="notes-block">${escapeHtml(selectedProperty.notes)}</p>` : ""}
              </div>
            ` : ""}
          ` : renderEmpty("No property yet", "Start with the home these records belong to.")}
        </section>
        <section class="panel">
          ${renderPanelHeader(propertyMode === "edit" ? "Edit property" : "Add property", "Only the property name is required. You can fill in purchase details later.", "clipboard")}
          ${propertyMode === "view" && selectedProperty ? renderPropertyNextSteps(selectedProperty) : renderPropertyForm(propertyMode === "edit" ? selectedProperty : null)}
        </section>
      </div>
    </div>
  `;
}

function renderProjectsView() {
  const filteredProjects = data.projects.filter((project) => {
    if (projectFilters.propertyId !== EMPTY_FILTER && project.propertyId !== projectFilters.propertyId) return false;
    if (projectFilters.status !== EMPTY_FILTER && project.status !== projectFilters.status) return false;
    if (projectFilters.category !== EMPTY_FILTER && project.category !== projectFilters.category) return false;
    return true;
  });
  const editingProject = editingProjectId === null ? null : data.projects.find((project) => project.id === editingProjectId);
  const selectedProject = filteredProjects.find((project) => project.id === selectedProjectId) || filteredProjects[0] || null;
  const hasProjectsForCurrentFilters = data.projects.some((project) => {
    if (projectFilters.propertyId !== EMPTY_FILTER && project.propertyId !== projectFilters.propertyId) return false;
    return true;
  });

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Projects",
        title: "Renovation and improvement projects",
        description: "Group expenses by project so a CPA can review the work, timing, vendor, and documentation together.",
        actions: `<button class="button button-primary" data-action="add-project" ${data.properties.length ? "" : "disabled"} type="button"><span aria-hidden="true">+</span>Add project</button>`,
      })}
      ${data.properties.length ? "" : renderEmpty("Add a property first", "Projects need a property so totals and exports stay organized.")}
      <div class="content-grid project-layout">
        <section class="panel">
          ${renderPanelHeader("Project list", "", "folder")}
          <div class="filter-bar">
            ${renderFilter("Property", "project.propertyId", projectFilters.propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })))}
            ${renderFilter("Status", "project.status", projectFilters.status, PROJECT_STATUSES)}
            ${renderFilter("Category", "project.category", projectFilters.category, EXPENSE_CATEGORIES)}
          </div>
          ${filteredProjects.length
            ? renderProjectsTable(filteredProjects, selectedProject)
            : hasProjectsForCurrentFilters
              ? renderEmpty("No matching projects", "Adjust the status or category filters.")
              : data.properties.length
                ? renderEmpty("No projects yet", "Add your first project when you want to group related costs.")
                : renderEmpty("No property yet", "Add a property before creating projects.")}
        </section>
        <aside class="panel">
          ${editingProjectId !== undefined
            ? `${renderPanelHeader(editingProject ? "Edit project" : "Add project", "Projects help connect related expenses and notes.", "edit")}${renderProjectForm(editingProject || null)}`
            : selectedProject
              ? renderProjectDetail(selectedProject)
              : renderEmpty("No project selected", "Choose a project to see linked expenses.")}
        </aside>
      </div>
    </div>
  `;
}

function renderExpensesView() {
  const projectOptions = data.projects.filter(
    (project) => expenseFilters.propertyId === EMPTY_FILTER || project.propertyId === expenseFilters.propertyId,
  );
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
  const editingExpense = editingExpenseId === null ? null : data.expenses.find((expense) => expense.id === editingExpenseId);
  const hasExpensesForCurrentProperty = data.expenses.some((expense) =>
    expenseFilters.propertyId === EMPTY_FILTER || expense.propertyId === expenseFilters.propertyId
  );

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Expense tracker",
        title: "Receipts, invoices, and cost records",
        description: "Classify each item for organization only. Confirm treatment with your CPA.",
        actions: `<button class="button button-primary" data-action="add-expense" ${data.properties.length ? "" : "disabled"} type="button"><span aria-hidden="true">+</span>Add expense</button>`,
      })}
      ${data.properties.length ? "" : renderEmpty("Add a property first", "Expense records need a property so totals and exports stay organized.")}
      ${renderMetrics([
        ["Filtered total", formatCurrency(totals.total), ""],
        ["Marked potential basis additions", formatCurrency(totals.potential), "green"],
        ["Repair/maintenance", formatCurrency(totals.repair), "rust"],
        ["Unclear / ask CPA", formatCurrency(totals.unclear), "amber"],
      ], "compact")}
      ${editingExpenseId !== undefined ? `
        <section class="panel">
          ${renderPanelHeader(editingExpense ? "Edit expense" : "Add expense", "Amount, date, property, vendor, and description are required.", "edit", `<button class="icon-button" data-action="close-expense-form" type="button" aria-label="Close">×</button>`)}
          ${renderExpenseForm(editingExpense || null)}
        </section>
      ` : ""}
      <section class="panel">
        ${renderPanelHeader("Cost records", "", "receipt")}
        <div class="filter-bar expense-filters">
          ${renderFilter("Property", "expense.propertyId", expenseFilters.propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })))}
          ${renderFilter("Project", "expense.projectId", expenseFilters.projectId, projectOptions.map((project) => ({ value: project.id, label: project.name })))}
          ${renderFilter("Review type", "expense.classification", expenseFilters.classification, CLASSIFICATIONS)}
          ${renderFilter("Category", "expense.category", expenseFilters.category, EXPENSE_CATEGORIES)}
          ${renderFilter("Docs", "expense.documentationStatus", expenseFilters.documentationStatus, DOCUMENT_STATUSES)}
          <label class="field compact-field">
            <span>Sort</span>
            <select data-filter="expense.sort">
              ${optionHtml("date-desc", "Newest first", expenseFilters.sort)}
              ${optionHtml("date-asc", "Oldest first", expenseFilters.sort)}
              ${optionHtml("amount-desc", "Amount high to low", expenseFilters.sort)}
              ${optionHtml("amount-asc", "Amount low to high", expenseFilters.sort)}
            </select>
          </label>
        </div>
        ${filteredExpenses.length
          ? renderExpensesTable(filteredExpenses)
          : data.properties.length
            ? hasExpensesForCurrentProperty
              ? renderEmpty("No matching expenses", "Adjust the filters to see more cost records.")
              : renderEmpty("No expenses yet", "Add your first cost record when you have a receipt, invoice, or note.")
            : renderEmpty("No property yet", "Add a property before tracking expenses.")}
      </section>
    </div>
  `;
}

function renderDocumentsView() {
  const readiness = getReviewReadiness(data);
  const documentationGaps = getDocumentationAttentionExpenses(data.expenses).filter((expense) => {
    if (documentFilters.propertyId !== EMPTY_FILTER && expense.propertyId !== documentFilters.propertyId) return false;
    return true;
  });
  const filteredDocuments = data.documents.filter((document) => {
    if (documentFilters.propertyId !== EMPTY_FILTER && document.propertyId !== documentFilters.propertyId) return false;
    if (documentFilters.documentType !== EMPTY_FILTER && document.documentType !== documentFilters.documentType) return false;
    if (documentFilters.fileStatus !== EMPTY_FILTER && getDocumentFileStatus(document) !== documentFilters.fileStatus) return false;
    return true;
  });
  const hasDocumentsForCurrentProperty = data.documents.some((document) =>
    documentFilters.propertyId === EMPTY_FILTER || document.propertyId === documentFilters.propertyId
  );
  const editingDocument = editingDocumentId === null ? null : data.documents.find((document) => document.id === editingDocumentId);

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Document checklist",
        title: "Receipts and supporting documents",
        description: "Attach receipt and invoice files locally, then track what still needs follow-up.",
        actions: `<button class="button button-primary" data-action="add-document" ${data.properties.length ? "" : "disabled"} type="button"><span aria-hidden="true">+</span>Add document</button>`,
      })}
      ${renderNotice("Try to keep receipts, contractor invoices, permits, before/after photos, and payment records.")}
      ${renderNotice(`Attached files are stored only ${storageLocationShort()}. They are not uploaded by this app. Anyone with access to ${storageAccessSurface()} may be able to view them.`)}
      ${data.properties.length ? "" : renderEmpty("Add a property first", "Documents need a property so they can be included with the right home records.")}
      ${data.properties.length ? renderDocumentCenterSummary(readiness) : ""}
      ${editingDocumentId !== undefined ? `
        <section class="panel">
          ${renderPanelHeader(editingDocument ? "Edit document" : "Add document", "Save a display name, document type, and optional local file. Local file paths are removed from notes.", "edit", `<button class="icon-button" data-action="close-document-form" type="button" aria-label="Close">×</button>`)}
          ${renderDocumentForm(editingDocument || null)}
        </section>
      ` : ""}
      <div class="content-grid two-columns">
        <section class="panel">
          ${renderPanelHeader("Documentation follow-up", "Expenses missing documents or marked attached without a linked stored receipt/invoice.", "alert")}
          ${documentationGaps.length
            ? renderDocumentationGapsTable(documentationGaps)
            : data.properties.length
              ? renderEmpty("No open documentation follow-ups", "Missing documents and attached statuses without linked stored files will appear here.")
              : renderEmpty("No property yet", "Add a property, then track expenses to build the checklist.")}
        </section>
        <section class="panel">
          ${renderPanelHeader("Documents", "", "document")}
          <div class="filter-bar document-filters">
            ${renderFilter("Property", "document.propertyId", documentFilters.propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })))}
            ${renderFilter("Type", "document.documentType", documentFilters.documentType, DOCUMENT_TYPES)}
            ${renderFilter("File", "document.fileStatus", documentFilters.fileStatus, DOCUMENT_FILE_FILTERS)}
          </div>
          ${filteredDocuments.length
            ? renderDocumentList(filteredDocuments)
            : data.properties.length
              ? data.documents.length && hasDocumentsForCurrentProperty
                ? renderEmpty("No matching documents", "Adjust the document filters to see more records.")
                : renderEmpty("No documents yet", "Add a simple record for receipts, invoices, permits, photos, or contracts.")
              : renderEmpty("No property yet", "Add a property before attaching documents.")}
        </section>
      </div>
    </div>
  `;
}

function renderDocumentCenterSummary(readiness) {
  const documentTypeCounts = DOCUMENT_TYPES.map((type) => ({
    ...type,
    count: data.documents.filter((document) => document.documentType === type.value).length,
  })).filter((type) => type.count > 0);
  const linkedDocumentCount = data.documents.filter((document) => document.expenseId || document.projectId).length;

  return `
    <section class="panel document-center-panel">
      ${renderPanelHeader("Document center", "Coverage, linked records, and missing evidence.", "document")}
      <div class="document-center-grid">
        ${storageMetric("Stored files", readiness.storedDocuments.length)}
        ${storageMetric("Document records", data.documents.length)}
        ${storageMetric("Linked records", linkedDocumentCount)}
        ${storageMetric("Needs file follow-up", readiness.documentsWithoutFiles.length)}
        ${storageMetric("Expense evidence gaps", readiness.expensesMissingLinkedEvidence.length)}
        ${storageMetric("Document types", documentTypeCounts.length || 0)}
      </div>
      ${documentTypeCounts.length ? `
        <div class="document-type-list" aria-label="Document type counts">
          ${documentTypeCounts.map((type) => `
            <span>${escapeHtml(type.label)} <strong>${type.count}</strong></span>
          `).join("")}
        </div>
      ` : `<p class="helper-note">Add receipts, invoices, permits, photos, warranties, contracts, payment records, appraisals, or inspections as you collect them.</p>`}
    </section>
  `;
}

function renderExportCenter() {
  const totals = getExpenseTotals(data.expenses);
  const readiness = getReviewReadiness(data);
  const documentationGaps = sortByDateDesc(getDocumentationAttentionExpenses(data.expenses));
  if (!isDesktopMode() && !isTutorialMode()) requestStorageEstimate();

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Export & backup",
        title: "Export records and keep backups",
        description: "Create CPA review files from saved records, then keep a separate private backup for yourself.",
      })}
      ${renderCpaExportPanel()}
      ${renderStorageHealthPanel()}
      ${renderBackupRestorePanel()}
      ${renderDataSafetyPanel()}
      <section class="panel print-summary">
        ${renderPanelHeader("CPA review summary", `Prepared from local records on ${formatDate(todayISO())}.`, "clipboard")}
        <p class="helper-note print-caveat">For record review only. Home Basis Tracker does not determine tax treatment.</p>
        ${renderMetrics([
          ["Total tracked spend", formatCurrency(totals.total), ""],
          ["Marked potential basis additions", formatCurrency(totals.potential), "green"],
          ["Repair/maintenance", formatCurrency(totals.repair), "rust"],
          ["Unclear / ask CPA", formatCurrency(totals.unclear), "amber"],
        ], "compact")}
        <div class="export-section">
          <h3>Review readiness</h3>
          ${renderExportReadinessChecklist(readiness)}
        </div>
        <div class="export-section">
          <h3>Properties</h3>
          ${data.properties.length ? renderExportPropertiesTable() : renderEmpty("No properties to export", "Add a property before preparing a full summary.")}
        </div>
        <div class="export-section">
          <h3>Projects</h3>
          ${data.projects.length ? renderExportProjectsTable() : renderEmpty("No projects to export", "Add project records to group related expenses and documents.")}
        </div>
        <div class="export-section">
          <h3>Expense detail</h3>
          ${data.expenses.length ? renderExportExpensesTable() : renderEmpty("No expenses to export", "Add expense records to build the CSV and review summary.")}
        </div>
        <div class="export-section">
          <h3>Documentation follow-ups</h3>
          ${documentationGaps.length ? renderExportDocumentationGapsTable(documentationGaps) : renderEmpty("No open documentation follow-ups", "Missing documents and attached statuses without linked stored files will appear here.")}
        </div>
        <div class="export-section">
          <h3>Documents</h3>
          ${data.documents.length ? renderExportDocumentsTable() : renderEmpty("No documents to export", "Add documents to include local file metadata in the printable summary.")}
        </div>
      </section>
    </div>
  `;
}

function renderDataSafetyPanel() {
  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("About local storage", "A plain-English note on where your records live.", "home")}
      <div class="safety-list">
        <div>
          <strong>Records stay ${storageLocationShort()}</strong>
          <span>Properties, projects, expenses, and document records are saved with ${recordStorageLabel()}.</span>
        </div>
        <div>
          <strong>Attached files stay ${storageLocationShort()}</strong>
          <span>Receipt and invoice files are stored as ${documentStorageLabel()}. This app does not upload them.</span>
        </div>
        <div>
          <strong>${storageCleanupTitle()}</strong>
          <span>${storageCleanupCopy()}</span>
        </div>
        <div>
          <strong>Full backups are private records</strong>
          <span>Backup JSON files may contain receipts, invoices, photos, and notes. Keep them somewhere private.</span>
        </div>
      </div>
    </section>
  `;
}

function renderCpaExportPanel() {
  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("For CPA review", isTutorialMode()
        ? "CSV and print exports use tutorial sample records only, not your real binder."
        : "CSV and print exports include saved record details only, not attached file contents.", "clipboard")}
      <div class="backup-actions">
        <button class="button button-secondary" data-action="print-summary" type="button"><span aria-hidden="true">⎙</span>Print summary</button>
        <button class="button button-secondary" data-action="download-cpa-packet" ${data.properties.length || data.expenses.length || data.documents.length ? "" : "disabled"} type="button"><span aria-hidden="true">↓</span>${isTutorialMode() ? "Download tutorial review packet" : "Download CPA review packet"}</button>
        <button class="button button-primary" data-action="download-csv" ${data.expenses.length ? "" : "disabled"} type="button"><span aria-hidden="true">↓</span>${isTutorialMode() ? "Download tutorial CSV" : "Download expense CSV"}</button>
      </div>
      <p class="helper-note">Review exports before sharing. Classifications are for organization and CPA discussion only.</p>
    </section>
  `;
}

function renderStorageHealthPanel() {
  const attachedDocuments = data.documents.filter((document) => document.hasFile);
  const attachedFileSize = attachedDocuments.reduce((total, document) => total + (Number(document.fileSize) || 0), 0);
  const estimateCopy = getStorageEstimateCopy();

  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("Storage health", `${storageHealthCopy()} It is useful, but it is not a backup.`, "document")}
      <div class="storage-health-grid">
        ${storageMetric("Properties", data.properties.length)}
        ${storageMetric("Projects", data.projects.length)}
        ${storageMetric("Expenses", data.expenses.length)}
        ${storageMetric("Documents", data.documents.length)}
        ${storageMetric("Attached files", attachedDocuments.length)}
        ${storageMetric("Attached file size", formatFileSize(attachedFileSize))}
        ${storageMetric(isDesktopMode() ? "Records file size" : "Browser storage used", estimateCopy.used)}
        ${storageMetric(isDesktopMode() ? "Stored document copies" : "Estimated quota", estimateCopy.quota)}
      </div>
      <p class="helper-note">Large files may fail to save if local storage is full or removed. Keep your own backup of important records.</p>
    </section>
  `;
}

function renderBackupRestorePanel() {
  return `
    <section class="panel print-hidden">
      ${renderPanelHeader(isTutorialMode() ? "Tutorial backup and restore" : "For your backup", isTutorialMode()
        ? "Create or restore sample backup files inside this temporary tutorial workspace only."
        : `Create a private backup for your own records, or restore one ${storageLocationShort()}.`, "clipboard")}
      <div class="backup-actions">
        <button class="button button-primary" data-action="download-full-backup" type="button">${isTutorialMode() ? "Download tutorial backup" : isDesktopMode() ? "Save full backup" : "Download full backup"}</button>
        <button class="button button-secondary" data-action="choose-backup-file" type="button">${isTutorialMode() ? "Restore into tutorial" : "Restore from backup"}</button>
        <input class="restore-input" data-restore-input type="file" accept="application/json,.json">
      </div>
      <div class="backup-status-row">
        <span>Backup status</span>
        <strong>${lastBackupCreatedAt ? `Created this session ${formatBackupTimestamp(lastBackupCreatedAt)}` : "No backup created in this app session"}</strong>
      </div>
      <p class="helper-note">${isTutorialMode()
        ? "Tutorial restores replace the sample workspace only. Exit tutorial to return to your real records."
        : "Full backups include app records and may include receipts, invoices, photos, and notes encoded inside the JSON file. They are private records, not tax filing documents."}</p>
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

function storageLocationShort() {
  if (isTutorialMode()) return "inside this temporary tutorial workspace";
  return isDesktopMode() ? "in this Mac app on this Mac" : "in this browser on this device";
}

function storageAccessSurface() {
  if (isTutorialMode()) return "this tutorial workspace";
  return isDesktopMode() ? "this Mac user account" : "this browser profile";
}

function recordStorageLabel() {
  if (isTutorialMode()) return "temporary in-memory tutorial records";
  return isDesktopMode() ? "an app-managed records file on this Mac" : "browser local storage on this device";
}

function documentStorageLabel() {
  if (isTutorialMode()) return "simulated tutorial document metadata";
  return isDesktopMode() ? "app-managed copies on this Mac" : "browser document storage in this browser profile";
}

function storageCleanupTitle() {
  if (isTutorialMode()) return "Tutorial data resets on request";
  return isDesktopMode() ? "Deleting app data can remove records" : "Browser cleanup can remove records";
}

function storageCleanupCopy() {
  if (isTutorialMode()) {
    return "Exiting or resetting the tutorial removes sample changes and returns you to your real workspace.";
  }
  return isDesktopMode()
    ? "Deleting the app's local data folder can remove saved records and copied document files."
    : "Clearing site data, switching browser profiles, or using private browsing can remove saved records and files.";
}

function storageHealthCopy() {
  if (isTutorialMode()) return "Tutorial storage is temporary and separate from your real records.";
  return isDesktopMode()
    ? "Mac app storage is local to this Mac user account."
    : "Browser storage is local to this device and browser profile.";
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

function renderPropertyNextSteps(property) {
  return `
    <div class="next-step-panel">
      <strong>${escapeHtml(property.name)} is ready.</strong>
      <span>Add projects first if you want to group related costs, or enter expenses directly and organize them later.</span>
      <div class="next-step-actions">
        <button class="button button-primary" data-action="add-project" type="button"><span aria-hidden="true">+</span>Add project</button>
        <button class="button button-secondary" data-action="add-expense" type="button"><span aria-hidden="true">+</span>Add expense</button>
        <button class="button button-secondary" data-action="add-document" type="button"><span aria-hidden="true">+</span>Add document</button>
      </div>
    </div>
  `;
}

function renderProjectForm(project) {
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
        ${field("Start date", "startDate", project?.startDate || "", { type: "date" })}
        ${field("Completion date", "completionDate", project?.completionDate || "", { type: "date" })}
      </div>
      <div class="form-row">
        ${field("Contractor/vendor", "contractor", project?.contractor || "")}
        ${field("Permit number", "permitNumber", project?.permitNumber || "", { placeholder: "Optional permit or approval number" })}
      </div>
      ${textarea("Scope summary", "scopeSummary", project?.scopeSummary || "")}
      ${textarea("Notes", "notes", project?.notes || "")}
      ${formActions("Save project")}
    </form>
  `;
}

function renderExpenseForm(expense) {
  const propertyId = expense?.propertyId || selectedPropertyId || data.properties[0]?.id || "";
  const projectOptions = data.projects.filter((project) => project.propertyId === propertyId);

  return `
    <form class="form-grid" data-form="expense" novalidate>
      <input type="hidden" name="id" value="${escapeAttr(expense?.id || "")}">
      <div class="form-row">
        ${selectField("Property", "propertyId", propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })), false)}
        ${selectField("Project", "projectId", expense?.projectId || "", projectOptions.map((project) => ({ value: project.id, label: project.name })))}
      </div>
      <div class="form-row">
        ${field("Date", "date", expense?.date || todayISO(), { type: "date", required: true })}
        ${field("Amount", "amount", expense?.amount || "", { type: "number", step: "0.01", placeholder: "0.00", required: true })}
      </div>
      <div class="form-row">
        ${field("Vendor/payee", "vendor", expense?.vendor || "", { placeholder: "Store, contractor, or person paid", required: true })}
        ${field("Description", "description", expense?.description || "", { placeholder: "Roof repair, dishwasher install, permit fee", required: true })}
      </div>
      <div class="form-row">
        ${selectField("Review type", "classification", expense?.classification || "unclear / ask CPA", CLASSIFICATIONS, false)}
        ${selectField("Category", "category", expense?.category || "other", EXPENSE_CATEGORIES, false)}
      </div>
      <p class="helper-note">Examples: roof replacement or an addition might be a potential basis addition; a service visit or small repair might be repair/maintenance. Use unclear when you want your CPA to decide.</p>
      ${selectField("Documentation status", "documentationStatus", expense?.documentationStatus || "no document yet", DOCUMENT_STATUSES, false)}
      <p class="helper-note">Use your best guess for sorting only. Your CPA should make the final call.</p>
      ${textarea("Notes", "notes", expense?.notes || "")}
      ${formActions("Save expense")}
    </form>
  `;
}

function renderDocumentForm(document) {
  const draftExpense = !document && draftDocumentExpenseId
    ? data.expenses.find((expense) => expense.id === draftDocumentExpenseId)
    : null;
  const propertyId = draftExpense?.propertyId || document?.propertyId || selectedPropertyId || data.properties[0]?.id || "";
  const projectOptions = data.projects.filter((project) => project.propertyId === propertyId);
  const expenseOptions = data.expenses.filter((expense) => expense.propertyId === propertyId);
  const selectedExpenseId = document?.expenseId || draftExpense?.id || "";
  const fileHelper = document?.hasFile
    ? `Current file: ${document.fileName || "Attached file"} (${formatFileSize(document.fileSize)}). Choose a new file to replace it.`
    : isTutorialMode()
      ? "Choosing a file in tutorial mode records sample metadata only. No file copy is saved."
      : `Attached files are saved locally ${storageLocationShort()}. They are not uploaded.`;

  return `
    <form class="form-grid" data-form="document" enctype="multipart/form-data" novalidate>
      <input type="hidden" name="id" value="${escapeAttr(document?.id || "")}">
      ${selectField("Related expense", "expenseId", selectedExpenseId, expenseOptions.map((expense) => ({ value: expense.id, label: `${formatDate(expense.date)} / ${expense.vendor} / ${formatCurrency(expense.amount)}` })))}
      <p class="helper-note">Choosing an expense sets the property and project for this document.</p>
      <div class="form-row">
        ${selectField("Property", "propertyId", propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })), false)}
        ${selectField("Document type", "documentType", document?.documentType || "receipt", DOCUMENT_TYPES, false)}
      </div>
      ${field("Display name", "displayName", document?.displayName || "", { required: true })}
      ${selectField("Project", "projectId", draftExpense?.projectId || document?.projectId || "", projectOptions.map((project) => ({ value: project.id, label: project.name })))}
      ${field("Added date", "addedDate", document?.addedDate || todayISO(), { type: "date", required: true })}
      <label class="field file-field">
        <span>Attach file</span>
        <input name="file" type="file">
        <small>${escapeHtml(fileHelper)}</small>
        <small>${isTutorialMode() ? "Use the normal workspace when you are ready to store real document copies." : `${storageSurfaceName()} storage is limited. Files over ${formatFileSize(MAX_DOCUMENT_FILE_SIZE)} are not accepted in this beta.`}</small>
      </label>
      ${textarea("Notes", "notes", document?.notes || "")}
      ${formActions("Save document")}
    </form>
  `;
}

function renderRecentExpenseTable(expenses) {
  return table(["Date", "Vendor", "Review type", "Amount"], expenses.map((expense) => [
    formatDate(expense.date),
    `<strong>${escapeHtml(expense.vendor)}</strong><span>${escapeHtml(expense.description)}</span>`,
    optionLabel(CLASSIFICATIONS, expense.classification),
    `<span class="money">${formatCurrency(expense.amount)}</span>`,
  ]));
}

function renderProjectsTable(projects, selectedProject) {
  return table(["Project", "Status", "Category", "Total", "Actions"], projects.map((project) => {
    const projectTotal = getExpenseTotals(data.expenses.filter((expense) => expense.projectId === project.id)).total;
    return [
      `<button class="table-link" data-action="select-project" data-id="${escapeAttr(project.id)}" type="button">${escapeHtml(project.name)}</button><span>${escapeHtml(getPropertyName(data, project.propertyId))}</span>`,
      optionLabel(PROJECT_STATUSES, project.status),
      optionLabel(EXPENSE_CATEGORIES, project.category),
      `<span class="money">${formatCurrency(projectTotal)}</span>`,
      rowActions("edit-project", "delete-project", project.id, project.name),
      selectedProject?.id === project.id ? "is-selected" : "",
    ];
  }));
}

function renderExpensesTable(expenses) {
  return table(["Date", "Expense", "Property / project", "Review type", "Docs", "Amount", "Actions"], expenses.map((expense) => [
    formatDate(expense.date),
    `<strong>${escapeHtml(expense.vendor)}</strong><span>${escapeHtml(expense.description)}</span>`,
    `<strong>${escapeHtml(getPropertyName(data, expense.propertyId))}</strong><span>${escapeHtml(getProjectName(data, expense.projectId))}</span>`,
    `${classificationPill(expense.classification)}<span>${escapeHtml(optionLabel(EXPENSE_CATEGORIES, expense.category))}</span>`,
    documentationPill(expense.documentationStatus),
    `<span class="money">${formatCurrency(expense.amount)}</span>`,
    rowActions("edit-expense", "delete-expense", expense.id, expense.description),
  ]));
}

function renderDocumentationGapsTable(expenses) {
  return table(["Date", "Expense", "Status", "Amount", "Actions"], expenses.map((expense) => [
    formatDate(expense.date),
    `<strong>${escapeHtml(expense.vendor)}</strong><span>${escapeHtml(expense.description)}</span>`,
    `${documentationPill(expense.documentationStatus)}<span>${escapeHtml(getExpenseDocumentationIssue(expense))}</span>`,
    `<span class="money">${formatCurrency(expense.amount)}</span>`,
    `<div class="row-actions text-actions">
      <button class="text-action" data-action="add-document-for-expense" data-id="${escapeAttr(expense.id)}" type="button">Add document</button>
      <button class="text-action" data-action="edit-expense" data-id="${escapeAttr(expense.id)}" type="button">Edit</button>
    </div>`,
  ]));
}

function renderDocumentList(documents = data.documents) {
  return `
    <div class="document-list">
      ${documents.map((document) => `
        <article class="document-card">
          <div>
            <h3>${escapeHtml(document.displayName)}</h3>
            <p>${escapeHtml(optionLabel(DOCUMENT_TYPES, document.documentType))} added ${formatDate(document.addedDate)}</p>
            <p>${escapeHtml(getPropertyName(data, document.propertyId))}${document.projectId ? ` / ${escapeHtml(getProjectName(data, document.projectId))}` : ""}</p>
            ${renderDocumentFileMeta(document)}
            ${document.notes ? `<p class="notes-block">${escapeHtml(document.notes)}</p>` : ""}
          </div>
          <div class="document-actions">
            ${document.hasFile ? `
              <button class="button button-primary" data-action="preview-document-file" data-id="${escapeAttr(document.id)}" type="button">Preview</button>
              <button class="button button-secondary" data-action="download-document-file" data-id="${escapeAttr(document.id)}" type="button">Download file</button>
              <button class="button button-secondary" data-action="remove-document-file" data-id="${escapeAttr(document.id)}" type="button">Remove file</button>
            ` : ""}
            ${rowActions("edit-document", "delete-document", document.id, document.displayName)}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function getDocumentFileStatus(document) {
  if (document.hasFile) return "stored";
  if (document.fileStatusNote) return "needs-follow-up";
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

function getDocumentationAttentionExpenses(expenses) {
  return expenses.filter((expense) => Boolean(getExpenseDocumentationIssue(expense)));
}

function getExpenseDocumentationIssue(expense) {
  if (isDocumentationGap(expense)) {
    return "Needs a receipt, invoice, or follow-up note.";
  }
  if (!["receipt attached", "invoice attached"].includes(expense.documentationStatus)) {
    return "";
  }

  const expectedType = expense.documentationStatus === "invoice attached" ? "invoice" : "receipt";
  const hasLinkedStoredDocument = data.documents.some((document) =>
    document.expenseId === expense.id &&
    document.hasFile &&
    document.documentType === expectedType
  );
  if (hasLinkedStoredDocument) return "";

  return `Marked ${optionLabel(DOCUMENT_STATUSES, expense.documentationStatus).toLowerCase()}, but no linked stored ${expectedType} is in this binder.`;
}

function renderDocumentFileMeta(document) {
  if (!document.hasFile) {
    return `
      <p><span class="pill tone-amber">${document.fileStatusNote ? "File needs follow-up" : "No file attached"}</span></p>
      ${document.fileStatusNote ? `<p class="file-status-note">${escapeHtml(document.fileStatusNote)}</p>` : ""}
    `;
  }

  if (isTutorialDocumentFile(document)) {
    return `
      <p>
        <span class="pill tone-blue">Tutorial metadata</span>
        <span class="file-meta">${escapeHtml(document.fileName || "Tutorial file")} / ${escapeHtml(document.mimeType || "Unknown type")} / ${formatFileSize(document.fileSize)}</span>
      </p>
      ${document.fileStatusNote ? `<p class="file-status-note">${escapeHtml(document.fileStatusNote)}</p>` : ""}
    `;
  }

  const type = document.mimeType || "Unknown type";
  return `
    <p>
      <span class="pill tone-green">Stored locally</span>
      <span class="file-meta">${escapeHtml(document.fileName || "Attached file")} / ${escapeHtml(type)} / ${formatFileSize(document.fileSize)}</span>
    </p>
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
            <p class="eyebrow">Document preview</p>
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
              <span>Local document text</span>
              <textarea name="ocrText" rows="8">${escapeHtml(documentRecord.ocrText || documentPreview.ocrText || "")}</textarea>
            </label>
            ${ocrCopy ? `<p class="helper-note">${escapeHtml(ocrCopy)}</p>` : ""}
            <div class="form-actions preview-actions">
              <button class="button button-secondary" data-action="download-document-file" data-id="${escapeAttr(documentRecord.id)}" type="button">Download file</button>
              <button class="button button-secondary" data-action="run-document-ocr" data-id="${escapeAttr(documentRecord.id)}" ${canReadText && documentPreview.ocrStatus !== "running" ? "" : "disabled"} type="button">Read text locally</button>
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
    return documentPreview.ocrStatusCopy || `Reading document locally... ${Math.round((documentPreview.ocrProgress || 0) * 100)}%`;
  }
  if (documentPreview.ocrStatus === "done") return "Text saved locally with this document record.";
  if (documentPreview.ocrStatus === "error") return documentPreview.ocrError || "This file could not be read locally.";
  if (documentPreview.status === "ready") {
    const processor = getDocumentTextProcessor(documentRecord, documentPreview.mimeType);
    if (!processor) {
      return "Local text reading is available for images, PDFs, and plain text files in this version.";
    }
    return processor.readyCopy;
  }
  return "Text reading runs locally in this app. It does not upload the file.";
}

function renderProjectDetail(project) {
  const projectExpenses = data.expenses.filter((expense) => expense.projectId === project.id);
  const totals = getExpenseTotals(projectExpenses);

  return `
    ${renderPanelHeader(project.name, getPropertyName(data, project.propertyId), "folder", `<button class="button button-secondary" data-action="edit-project" data-id="${escapeAttr(project.id)}" type="button">Edit</button>`)}
    <dl class="detail-list">
      ${detailItem("Status", optionLabel(PROJECT_STATUSES, project.status))}
      ${detailItem("Category", optionLabel(EXPENSE_CATEGORIES, project.category))}
      ${detailItem("Start", formatDate(project.startDate))}
      ${detailItem("Completed", formatDate(project.completionDate))}
      ${detailItem("Vendor/contractor", project.contractor || "Not added")}
      ${detailItem("Permit number", project.permitNumber || "Not added")}
      ${detailItem("Linked expense total", formatCurrency(totals.total))}
    </dl>
    ${project.scopeSummary ? `<p class="notes-block"><strong>Scope:</strong> ${escapeHtml(project.scopeSummary)}</p>` : ""}
    ${project.notes ? `<p class="notes-block">${escapeHtml(project.notes)}</p>` : ""}
    <div class="linked-list">
      <h3>Linked expenses</h3>
      ${projectExpenses.length ? projectExpenses.map((expense) => `
        <div class="linked-row">
          <div>
            <strong>${escapeHtml(expense.description)}</strong>
            <span>${formatDate(expense.date)} / ${escapeHtml(expense.vendor)}</span>
          </div>
          <b>${formatCurrency(expense.amount)}</b>
        </div>
      `).join("") : renderEmpty("No linked expenses", "Assign expenses to this project from the expense tracker.")}
    </div>
  `;
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
  return table(["Project", "Property", "Status", "Dates", "Contractor", "Permit", "Spend", "Documents"], getProjectReviewSummaries(data).map((summary) => [
    `<strong>${escapeHtml(summary.project.name)}</strong><span>${summary.project.scopeSummary ? escapeHtml(summary.project.scopeSummary) : "Scope not added"}</span>`,
    escapeHtml(getPropertyName(data, summary.project.propertyId)),
    escapeHtml(optionLabel(PROJECT_STATUSES, summary.project.status)),
    escapeHtml(summary.dateRange),
    escapeHtml(summary.project.contractor || "Not added"),
    escapeHtml(summary.project.permitNumber || (summary.hasPermit ? "Permit record attached" : "Not added")),
    `<span class="money">${formatCurrency(summary.totals.total)}</span>`,
    escapeHtml(`${summary.documents.length} (${summary.missingDocuments} follow-ups)`),
  ]));
}

function renderExportReadinessChecklist(readiness) {
  return `
    <div class="export-readiness">
      <strong>${readiness.score}% ready</strong>
      <span>${readiness.completedChecks} of ${readiness.totalChecks} readiness checks complete.</span>
    </div>
    ${readiness.followUps.length ? `
      <ul class="followup-list export-followups">
        ${readiness.followUps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    ` : `<p class="helper-note">No open readiness follow-ups recorded.</p>`}
  `;
}

function renderExportExpensesTable() {
  return table(["Date", "Property", "Project", "Vendor", "Description", "Classification", "Docs", "Amount"], sortByDateDesc(data.expenses).map((expense) => [
    escapeHtml(formatDate(expense.date)),
    escapeHtml(getPropertyName(data, expense.propertyId)),
    escapeHtml(getProjectName(data, expense.projectId)),
    escapeHtml(expense.vendor),
    escapeHtml(expense.description),
    escapeHtml(optionLabel(CLASSIFICATIONS, expense.classification)),
    escapeHtml(optionLabel(DOCUMENT_STATUSES, expense.documentationStatus)),
    `<span class="money">${formatCurrency(expense.amount)}</span>`,
  ]));
}

function renderExportDocumentationGapsTable(expenses) {
  return table(["Date", "Property", "Project", "Expense", "Status", "Issue", "Amount"], expenses.map((expense) => [
    escapeHtml(formatDate(expense.date)),
    escapeHtml(getPropertyName(data, expense.propertyId)),
    escapeHtml(getProjectName(data, expense.projectId)),
    `<strong>${escapeHtml(expense.vendor)}</strong><span>${escapeHtml(expense.description)}</span>`,
    escapeHtml(optionLabel(DOCUMENT_STATUSES, expense.documentationStatus)),
    escapeHtml(getExpenseDocumentationIssue(expense)),
    `<span class="money">${formatCurrency(expense.amount)}</span>`,
  ]));
}

function renderExportDocumentsTable() {
  return table(["Document", "Property", "Project", "Related expense", "Type", "Stored file", "Added"], data.documents.map((document) => {
    const relatedExpense = data.expenses.find((expense) => expense.id === document.expenseId);
    return [
      `<strong>${escapeHtml(document.displayName)}</strong><span>${document.notes ? escapeHtml(document.notes) : "No notes"}</span>`,
      escapeHtml(getPropertyName(data, document.propertyId)),
      escapeHtml(getProjectName(data, document.projectId)),
      relatedExpense ? escapeHtml(`${relatedExpense.vendor} / ${relatedExpense.description}`) : "No expense",
      escapeHtml(optionLabel(DOCUMENT_TYPES, document.documentType)),
      document.hasFile
        ? `<strong>${escapeHtml(document.fileName || "Attached file")}</strong><span>${escapeHtml(document.mimeType || "Unknown type")} / ${formatFileSize(document.fileSize)}</span>`
        : escapeHtml(document.fileStatusNote || "No file attached"),
      escapeHtml(formatDate(document.addedDate)),
    ];
  }));
}

async function handleClick(event) {
  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) {
    activeTab = tabButton.dataset.tab;
    closeEditors();
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const { action, id } = actionButton.dataset;

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
  } else if (action === "add-property") {
    activeTab = "property";
    propertyMode = "new";
  } else if (action === "edit-property") {
    propertyMode = "edit";
  } else if (action === "delete-property") {
    await deleteProperty(id);
  } else if (action === "add-project") {
    activeTab = "projects";
    editingProjectId = null;
  } else if (action === "edit-project") {
    activeTab = "projects";
    selectedProjectId = id;
    editingProjectId = id;
  } else if (action === "select-project") {
    selectedProjectId = id;
    editingProjectId = undefined;
  } else if (action === "delete-project") {
    await deleteProject(id);
  } else if (action === "add-expense") {
    activeTab = "expenses";
    editingExpenseId = null;
  } else if (action === "edit-expense") {
    activeTab = "expenses";
    editingExpenseId = id;
  } else if (action === "delete-expense") {
    await deleteExpense(id);
  } else if (action === "close-expense-form") {
    editingExpenseId = undefined;
  } else if (action === "add-document") {
    activeTab = "documents";
    editingDocumentId = null;
    draftDocumentExpenseId = "";
  } else if (action === "add-document-for-expense") {
    activeTab = "documents";
    editingDocumentId = null;
    draftDocumentExpenseId = id;
  } else if (action === "edit-document") {
    editingDocumentId = id;
    draftDocumentExpenseId = "";
  } else if (action === "delete-document") {
    await deleteDocument(id);
  } else if (action === "preview-document-file") {
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
    draftDocumentExpenseId = "";
  } else if (action === "open-export") {
    activeTab = "export";
  } else if (action === "download-csv") {
    const filename = isTutorialMode()
      ? `home-basis-tracker-tutorial-expenses-${todayISO()}.csv`
      : `home-basis-tracker-expenses-${todayISO()}.csv`;
    downloadTextFile(buildExpensesCsv(data), filename, "text/csv;charset=utf-8");
  } else if (action === "download-cpa-packet") {
    const filename = isTutorialMode()
      ? `home-basis-tracker-tutorial-cpa-review-${todayISO()}.txt`
      : `home-basis-tracker-cpa-review-${todayISO()}.txt`;
    downloadTextFile(buildCpaReviewPacket(data), filename, "text/plain;charset=utf-8");
  } else if (action === "download-full-backup") {
    await downloadFullBackup();
  } else if (action === "choose-backup-file") {
    app.querySelector("[data-restore-input]")?.click();
    return;
  } else if (action === "print-summary") {
    window.print();
  } else if (action === "cancel-form") {
    closeEditors();
  }

  render();
}

function handleChange(event) {
  const control = event.target;
  if (control.matches("[data-restore-input]")) {
    void restoreFromBackupFile(control.files?.[0]);
    control.value = "";
    return;
  }

  const filter = control.dataset.filter;
  if (!filter) {
    if (control.closest('[data-form="expense"]') && control.name === "propertyId") {
      syncExpenseProjectOptions(control);
    }
    if (control.closest('[data-form="document"]') && ["propertyId", "expenseId"].includes(control.name)) {
      syncDocumentRelationshipForm(control);
    }
    return;
  }

  if (filter === "selectedPropertyId") {
    selectedPropertyId = control.value;
    projectFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
    expenseFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
    expenseFilters.projectId = EMPTY_FILTER;
    documentFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
  } else if (filter.startsWith("project.")) {
    projectFilters[filter.replace("project.", "")] = control.value;
  } else if (filter.startsWith("expense.")) {
    const key = filter.replace("expense.", "");
    expenseFilters[key] = control.value;
    if (key === "propertyId") expenseFilters.projectId = EMPTY_FILTER;
  } else if (filter.startsWith("document.")) {
    const key = filter.replace("document.", "");
    documentFilters[key] = control.value;
  }

  render();
}

function handleStorageEvent(event) {
  if (event.key !== STORAGE_KEY) return;
  try {
    realData = event.newValue ? sanitizeData(JSON.parse(event.newValue)) : EMPTY_DATA;
    if (isTutorialMode()) {
      notice = "Your real records changed in another browser window. Exit the tutorial to see the refreshed binder.";
      syncNoticeToast();
      return;
    }
    data = realData;
    selectedPropertyId = data.properties[0]?.id || "";
    resetFiltersAfterRestore();
    closeEditors();
    notice = "Records changed in another browser window. This view has been refreshed.";
    render();
  } catch {
    // Ignore malformed external storage writes; the next normal load will sanitize again.
  }
}

function syncExpenseProjectOptions(control) {
  const form = control.closest('[data-form="expense"]');
  const projectSelect = form.elements.projectId;
  const currentProjectId = projectSelect.value;
  const projectOptions = data.projects.filter((project) => project.propertyId === control.value);
  const selectedProjectId = projectOptions.some((project) => project.id === currentProjectId) ? currentProjectId : "";

  projectSelect.innerHTML = `${optionHtml("", "No project", selectedProjectId)}${projectOptions.map((project) => optionHtml(project.id, project.name, selectedProjectId)).join("")}`;
}

function syncDocumentRelationshipForm(control) {
  const form = control.closest('[data-form="document"]');
  const propertySelect = form.elements.propertyId;
  const projectSelect = form.elements.projectId;
  const expenseSelect = form.elements.expenseId;

  if (control.name === "expenseId" && control.value) {
    const linkedExpense = data.expenses.find((expense) => expense.id === control.value);
    if (linkedExpense) {
      propertySelect.value = linkedExpense.propertyId;
      rebuildDocumentRelationshipOptions(form, linkedExpense.propertyId, linkedExpense.projectId, linkedExpense.id);
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
  expenseSelect.innerHTML = `${optionHtml("", "No expense", selectedExpenseId)}${expenseOptions.map((expense) => optionHtml(expense.id, `${formatDate(expense.date)} / ${expense.vendor} / ${formatCurrency(expense.amount)}`, selectedExpenseId)).join("")}`;
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
  propertyMode = data.properties.length ? "view" : "new";
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
  propertyMode = data.properties.length ? "view" : "new";
  resetFiltersAfterRestore();
  closeEditors();
  closeDocumentPreview({ renderAfterClose: false });
  showNotice("Returned to your real records.");
}

function resetTutorialWorkspace() {
  if (!isTutorialMode()) {
    enterTutorialWorkspace();
    return;
  }
  if (!window.confirm("Reset the tutorial workspace back to the original sample records?")) return;
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
  if (formType === "project") await saveProject(values);
  if (formType === "expense") await saveExpense(values);
  if (formType === "document") await saveDocument(values, formData.get("file"));
  if (formType === "document-preview-notes") await saveDocumentPreviewNotes(values);
}

async function saveProperty(values) {
  const form = app.querySelector('[data-form="property"]');
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
  };
  const saved = await updateData({ ...data, properties: upsertById(data.properties, property) });
  if (!saved) return;
  selectedPropertyId = property.id;
  propertyMode = "view";
  showNotice("Property saved.");
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
    name: removeLocalPaths(values.name).trim(),
    category: values.category,
    startDate: values.startDate,
    completionDate: values.completionDate,
    contractor: removeLocalPaths(values.contractor).trim(),
    permitNumber: removeLocalPaths(values.permitNumber).trim(),
    status: values.status,
    scopeSummary: removeLocalPaths(values.scopeSummary).trim(),
    notes: removeLocalPaths(values.notes).trim(),
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
  showNotice("Project saved.");
}

async function saveExpense(values) {
  const form = app.querySelector('[data-form="expense"]');
  if (!values.propertyId) return showFormNotice(form, "propertyId", "Property is required.");
  if (!values.date) return showFormNotice(form, "date", "Date is required.");
  if (!isValidISODate(values.date)) return showFormNotice(form, "date", "Enter a valid expense date.");
  if (!values.vendor?.trim()) return showFormNotice(form, "vendor", "Vendor or payee is required.");
  if (!values.description?.trim()) return showFormNotice(form, "description", "Description is required.");
  if (parseAmount(values.amount) <= 0) return showFormNotice(form, "amount", "Enter an amount greater than zero.");

  const projectId = data.projects.some((project) => project.id === values.projectId && project.propertyId === values.propertyId)
    ? values.projectId
    : "";
  const expense = {
    id: values.id || createId("expense"),
    propertyId: values.propertyId,
    projectId,
    date: values.date,
    vendor: removeLocalPaths(values.vendor).trim(),
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
  editingExpenseId = undefined;
  showNotice("Expense saved.");
}

async function saveDocument(values, file) {
  const hasSelectedFile = file && file.size > 0;
  const form = app.querySelector('[data-form="document"]');
  if (!values.propertyId) return showFormNotice(form, "propertyId", "Property is required.");
  if (!values.displayName?.trim()) return showFormNotice(form, "displayName", "Display name is required.");
  if (!values.addedDate) return showFormNotice(form, "addedDate", "Added date is required.");
  if (!isValidISODate(values.addedDate)) return showFormNotice(form, "addedDate", "Enter a valid added date.");
  if (hasSelectedFile && file.size > MAX_DOCUMENT_FILE_SIZE) {
    return showFormNotice(form, "file", `Files over ${formatFileSize(MAX_DOCUMENT_FILE_SIZE)} are not accepted in this beta.`);
  }
  if (hasSelectedFile && !isTutorialMode() && !canStoreDocuments()) {
    return showFormNotice(form, "file", `Attached file storage is not available in this ${storageSurfaceName().toLowerCase()}.`);
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
        fileStatusNote: "Tutorial file metadata only. No copy was saved.",
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

  const documentRecord = {
    id: documentId,
    propertyId: linkedExpense?.propertyId || values.propertyId,
    projectId: linkedExpense?.projectId || values.projectId,
    expenseId: values.expenseId,
    displayName: removeLocalPaths(values.displayName).trim(),
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
  draftDocumentExpenseId = "";
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
      ? "Document saved with tutorial file metadata. No file copy was stored."
      : "Document and local file saved."
    : "Document saved.");
}

async function openDocumentPreview(documentId) {
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!documentRecord?.hasFile) return showNotice("No stored file is attached to this document.");
  if (isTutorialDocumentFile(documentRecord)) {
    return showNotice("Tutorial files are metadata only. Preview real files from your normal workspace.");
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
        error: `The file metadata is saved, but the stored file is missing. It may have been cleared from ${storageSurfaceName().toLowerCase()} storage.`,
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
    return showNotice("Tutorial files are metadata only. Local text reading runs on real files in your normal workspace.");
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
    showNotice(cleanText ? `Text saved with this document.${noticeSuffix}` : `Text reading finished, but no text was found.${noticeSuffix}`);
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
    onProgress?.(progress, `Reading image locally... ${Math.round(progress * 100)}%`);
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
  onProgress?.(0.01, "Opening PDF locally...");

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

        onProgress?.(pageStartProgress + (pageEndProgress - pageStartProgress) * 0.25, `Rendering scanned PDF page ${pageNumber} of ${pdf.numPages}...`);
        const pageImage = await renderPdfPageToBlob(page);
        ocrWorker ||= await createOcrWorker((progress) => {
          const pageProgress = pageStartProgress + (pageEndProgress - pageStartProgress) * (0.35 + (progress * 0.65));
          onProgress?.(pageProgress, `Reading scanned PDF page ${pageNumber} of ${pdf.numPages}... ${Math.round(progress * 100)}%`);
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
  if (ocrPages) noticeParts.push(`${ocrPages} scanned PDF page${ocrPages === 1 ? "" : "s"} processed with local OCR.`);
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
    throw new Error(`Text files over ${formatFileSize(DOCUMENT_TEXT_FILE_SIZE_LIMIT)} are too large to read locally in this beta.`);
  }
  onProgress?.(0.25, "Reading text file locally...");
  const text = cleanExtractedDocumentText(await blob.text());
  onProgress?.(1, "Text file read locally.");
  return { text };
}

async function loadTesseract() {
  tesseractModulePromise ||= import("../node_modules/tesseract.js/dist/tesseract.esm.min.js").then((module) => module.createWorker ? module : module.default);
  return tesseractModulePromise;
}

async function createOcrWorker(onProgress) {
  const { createWorker } = await loadTesseract();
  if (typeof createWorker !== "function") throw new Error("Local OCR worker could not be loaded.");
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
  if (!context) throw new Error("The PDF page could not be rendered for OCR.");
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
        reject(new Error("The PDF page could not be rendered for OCR."));
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
    return "Local text reading could not start. Reopen the app and try again.";
  }
  if (/pdf/i.test(message)) return "This PDF could not be read locally.";
  return "This file could not be read locally.";
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
      readyCopy: "OCR runs locally in this app. It does not upload the image.",
      startCopy: "Reading image locally... 0%",
      read: readImageDocumentText,
    };
  }
  if (isPdfFile(documentRecord, mimeType)) {
    return {
      readyCopy: "PDF pages are read locally. Searchable PDFs are fast; scanned PDFs can take a while.",
      startCopy: "Opening PDF locally...",
      read: readPdfDocumentText,
    };
  }
  if (isPlainTextFile(documentRecord, mimeType)) {
    return {
      readyCopy: "Text files are read locally in this app. They are not uploaded.",
      startCopy: "Reading text file locally...",
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
    `This removes ${linkedProjects.length} project(s), ${linkedExpenses.length} expense(s), ${linkedDocuments.length} document record(s), and stored document copies for this property.`,
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
  propertyMode = selectedPropertyId ? "view" : "new";
  resetFiltersAfterRestore();
  resetStorageEstimate();
  const cleanup = isTutorialMode()
    ? { failed: 0 }
    : await deleteFilesBestEffort(fileIdsToDelete);
  showNotice(cleanup.failed
    ? "Property deleted. Some stored document files could not be removed from local storage."
    : "Property deleted.");
}

async function deleteProject(projectId) {
  if (!window.confirm("Delete this project? Linked expenses will stay saved without a project.")) return;
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
  showNotice("Project deleted. Linked expenses were kept.");
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
  showNotice("Document deleted.");
}

async function downloadDocumentAttachment(documentId) {
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!documentRecord?.hasFile) return showNotice("No stored file is attached to this document.");
  if (isTutorialDocumentFile(documentRecord)) {
    return showNotice("Tutorial files are metadata only. Download real stored files from your normal workspace.");
  }

  try {
    const storedFile = await getDocumentFile(documentRecord.fileId || documentRecord.id);
    if (!storedFile?.blob) {
      await markDocumentFileMissing(documentRecord);
      return showNotice(`The file metadata is saved, but the stored file is missing. It may have been cleared from ${storageSurfaceName().toLowerCase()} storage.`);
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
    ? "Remove this tutorial file metadata? The document record will stay, and no real file will be deleted."
    : "Remove the stored file from this app? The document record will stay, and this will not delete the original file from your computer or any copies you downloaded.";
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
  showNotice("Stored file removed. The document record was kept.");
}

async function markDocumentFileMissing(documentRecord) {
  const nextDocuments = data.documents.map((document) =>
    document.id === documentRecord.id
      ? {
          ...document,
          hasFile: false,
          fileId: "",
          fileName: document.fileName ? `${document.fileName} (missing)` : "",
          fileStatusNote: "Stored file metadata was present, but the file could not be found.",
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

async function downloadFullBackup() {
  try {
    const backup = await buildFullBackup();
    const backupText = `${JSON.stringify(backup, null, 2)}\n`;
    if (new Blob([backupText]).size > MAX_BACKUP_FILE_SIZE) {
      showNotice(`This backup is over ${formatFileSize(MAX_BACKUP_FILE_SIZE)} and may be too large to restore in this beta. Remove a few large files or export the CSV and print summary separately.`);
      return;
    }
    const filename = isTutorialMode()
      ? `home-basis-tracker-tutorial-backup-${todayISO()}.json`
      : `home-basis-tracker-backup-${todayISO()}.json`;
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
    showNotice(isTutorialMode() ? "Tutorial backup saved with sample records only." : "Full backup saved.");
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
          ? stripDocumentFileMetadata(documentRecord, "Tutorial file metadata only. No file content was included.")
          : documentRecord,
      ),
    }, files, tutorialDocumentsWithFiles.map((documentRecord) => ({
      documentId: documentRecord.id,
      fileName: documentRecord.fileName || "Tutorial file",
      reason: "Tutorial file metadata only",
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
  const restoreMessage = isTutorialMode()
    ? "Restore this backup into the temporary tutorial workspace only? Your real records will not be replaced."
    : `Restore this backup and replace all current records ${storageLocationShort()}? Only restore backups you created or trust. This does not upload anything. Download a backup first if you want to keep what is here.`;
  if (!window.confirm(restoreMessage)) return;

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    return showNotice("This backup file could not be read as JSON.");
  }

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
    ? `Backup restored. Some attached files could not be restored ${storageLocationShort()}.`
    : "Backup restored.";
  const cleanupNotice = cleanup.failed
    ? ` Some older stored files could not be removed from ${storageSurfaceName().toLowerCase()} storage.`
    : "";
  showNotice(`${restoreNotice}${cleanupNotice}`);
}

function prepareTutorialBackupRestore(backup) {
  const { data: restoredData } = validateBackupEnvelope(backup);
  const restoredDocuments = restoredData.documents.map((documentRecord) =>
    documentRecord.hasFile
      ? stripDocumentFileMetadata(documentRecord, "File content was not restored inside the tutorial workspace")
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
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "File not included in backup"));
        continue;
      }
      if (!canStoreDocuments()) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "File could not be restored in this app"));
        continue;
      }
      if (isBlockedBackupAttachment(backupFile)) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "File type skipped during restore"));
        continue;
      }
      if (isBackupDataUrlTooLarge(backupFile.dataUrl)) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "File too large to restore"));
        continue;
      }

      const blob = await dataUrlToBlob(backupFile.dataUrl);
      if (blob.size > MAX_DOCUMENT_FILE_SIZE) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "File too large to restore"));
        continue;
      }
      if (!await backupFileChecksumMatches(blob, backupFile.sha256)) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "File checksum did not match backup"));
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
    documentFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
  }

  const projectIds = new Set(data.projects.map((project) => project.id));
  if (selectedProjectId && !projectIds.has(selectedProjectId)) {
    selectedProjectId = "";
  }
  if (editingProjectId && !projectIds.has(editingProjectId)) {
    editingProjectId = undefined;
  }
  if (expenseFilters.projectId !== EMPTY_FILTER && !projectIds.has(expenseFilters.projectId)) {
    expenseFilters.projectId = EMPTY_FILTER;
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
  expenseFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
  expenseFilters.projectId = EMPTY_FILTER;
  expenseFilters.classification = EMPTY_FILTER;
  expenseFilters.category = EMPTY_FILTER;
  expenseFilters.documentationStatus = EMPTY_FILTER;
  expenseFilters.sort = "date-desc";
  documentFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
  documentFilters.documentType = EMPTY_FILTER;
  documentFilters.fileStatus = EMPTY_FILTER;
  selectedProjectId = "";
}

function getBackupError(error) {
  const message = error?.message || "";
  if (/quota|storage/i.test(message)) {
    return `The backup could not be restored because ${storageSurfaceName().toLowerCase()} storage may be full.`;
  }
  if (/Home Basis Tracker backup|newer version/i.test(message)) {
    return message;
  }
  return "The backup could not be completed. Check the file and try again.";
}

async function updateData(nextData, options = {}) {
  if (!isTutorialMode() && storageWriteBlocked && !options.allowBlockedWrite) {
    notice = "Saves are paused because local records could not be loaded safely. Restore a backup or reopen the app before making changes.";
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
    notice = `Unable to save locally. Check ${storageSurfaceName()} storage settings before adding more records.`;
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
    return `The file could not be saved because ${storageSurfaceName().toLowerCase()} storage may be full. Keep your own backup of important records.`;
  }
  if (/available|indexeddb/i.test(message)) {
    return `Attached file storage is not available in this ${isDesktopMode() ? "Mac app" : "browser"}.`;
  }
  if (/blocked/i.test(message)) {
    return `Document storage is blocked by another ${isDesktopMode() ? "app window" : "browser tab"}. Close other windows for this app and try again.`;
  }
  return "The file could not be saved locally. Keep your own backup and try again.";
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
    fieldControl.focus();
    fieldControl.setAttribute("aria-invalid", "true");
    window.setTimeout(() => fieldControl.removeAttribute("aria-invalid"), 2800);
  });
}

function closeEditors() {
  editingProjectId = undefined;
  editingExpenseId = undefined;
  editingDocumentId = undefined;
  draftDocumentExpenseId = "";
  if (data.properties.length && propertyMode !== "view") propertyMode = "view";
}

function renderPageIntro({ actions = "", description = "", eyebrow, title }) {
  return `
    <div class="page-intro">
      <div>
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h2>${escapeHtml(title)}</h2>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ""}
    </div>
  `;
}

function renderPanelHeader(title, description = "", icon = "", actions = "") {
  return `
    <div class="panel-header">
      <div>
        ${icon ? `<span class="panel-icon" aria-hidden="true">${iconSymbol(icon)}</span>` : ""}
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${description ? `<p>${escapeHtml(description)}</p>` : ""}
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

function renderEmpty(title, text) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

function renderFilter(label, key, value, options) {
  return `
    <label class="field compact-field">
      <span>${escapeHtml(label)}</span>
      <select data-filter="${escapeAttr(key)}">
        ${optionHtml(EMPTY_FILTER, "All", value)}
        ${options.map((option) => optionHtml(option.value, option.label, value)).join("")}
      </select>
    </label>
  `;
}

function field(label, name, value, options = {}) {
  const type = options.type || "text";
  return `
    <label class="field">
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

function textarea(label, name, value) {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeAttr(name)}" rows="4">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function selectField(label, name, value, options, includeBlank = true) {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <select name="${escapeAttr(name)}">
        ${includeBlank ? optionHtml("", name === "projectId" ? "No project" : name === "expenseId" ? "No expense" : "None", value) : ""}
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

function rowActions(editAction, deleteAction, id, label) {
  return `
    <div class="row-actions">
      <button aria-label="Edit ${escapeAttr(label)}" data-action="${escapeAttr(editAction)}" data-id="${escapeAttr(id)}" type="button">✎</button>
      <button aria-label="Delete ${escapeAttr(label)}" data-action="${escapeAttr(deleteAction)}" data-id="${escapeAttr(id)}" type="button">×</button>
    </div>
  `;
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
    clipboard: "▤",
    document: "◇",
    edit: "✎",
    folder: "▣",
    home: "⌂",
    receipt: "▥",
  };
  return symbols[name] || "•";
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
