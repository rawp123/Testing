import {
  BACKUP_APP_ID,
  BACKUP_VERSION,
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
  getProjectName,
  getPropertyName,
  isDocumentationGap,
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
} from "./model.js";
import {
  canStoreDocuments,
  deleteDocumentFile,
  getDocumentFile,
  listDocumentFiles,
  saveDocumentFile,
  saveDocumentFileRecord,
} from "./document-storage.js";

const EMPTY_FILTER = "all";
const app = document.querySelector("#app");
const MAX_BACKUP_DATA_URL_LENGTH = Math.ceil(MAX_DOCUMENT_FILE_SIZE * 1.38) + 4096;

let data = loadStoredData();
let activeTab = "dashboard";
let selectedPropertyId = data.properties[0]?.id || "";
let notice = "";
let propertyMode = data.properties.length ? "view" : "new";
let editingProjectId;
let editingExpenseId;
let editingDocumentId;
let storageEstimate = {
  status: "idle",
  usage: 0,
  quota: 0,
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

render();

app.addEventListener("click", handleClick);
app.addEventListener("submit", handleSubmit);
app.addEventListener("change", handleChange);

function render() {
  if (selectedPropertyId && !data.properties.some((property) => property.id === selectedPropertyId)) {
    selectedPropertyId = data.properties[0]?.id || "";
  }

  app.innerHTML = `
    <header class="app-header">
      <div class="brand-block">
        <p class="eyebrow">Home records</p>
        <h1>Home Basis Tracker</h1>
        <p>Keep receipts, project notes, and home improvement records organized on this device.</p>
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
            type="button"
          >${escapeHtml(tab.label)}</button>
        `).join("")}
      </nav>
    </header>
    <main class="workspace">
      ${notice ? `<div class="toast" role="status">${escapeHtml(notice)}</div>` : ""}
      <section class="tab-panel" id="${activeTab}-panel" role="tabpanel" aria-labelledby="${activeTab}-tab">
        ${renderActiveTab()}
      </section>
    </main>
  `;
}

function renderActiveTab() {
  if (activeTab === "property") return renderPropertyView();
  if (activeTab === "projects") return renderProjectsView();
  if (activeTab === "expenses") return renderExpensesView();
  if (activeTab === "documents") return renderDocumentsView();
  if (activeTab === "export") return renderExportCenter();
  return renderDashboard();
}

function renderDashboard() {
  const totals = getExpenseTotals(data.expenses);
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
        description: "A local-first summary of projects, expenses, documentation gaps, and records to review with your CPA.",
        actions: `
          <button class="button button-secondary" data-action="add-expense" type="button"><span aria-hidden="true">+</span>Add expense</button>
          <button class="button button-primary" data-action="open-export" type="button"><span aria-hidden="true">↓</span>Export packet</button>
        `,
      }) : renderOnboardingPanel()}

      ${renderMetrics([
        ["Total tracked spend", formatCurrency(totals.total), ""],
        ["Potential basis additions", formatCurrency(totals.potential), "green"],
        ["Repair/maintenance", formatCurrency(totals.repair), "rust"],
        ["Unclear / ask CPA", formatCurrency(totals.unclear), "amber"],
        ["Documentation gaps", String(totals.documentationGaps), "blue"],
      ])}

      ${renderNotice("Home Basis Tracker helps organize records for review. It is not tax software and does not decide tax treatment. Confirm classifications and records with your CPA.")}
      ${storedFileCount ? renderNotice(`${storedFileCount} attached file${storedFileCount === 1 ? " is" : "s are"} stored locally in this browser on this device. Keep your own backup of important records.`) : ""}

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
        <p>Track properties, projects, expenses, document status, notes, and local file attachments in this browser. Your records are saved in this browser on this device unless you export or share them.</p>
      </div>
      <ol class="step-list">
        <li><span aria-hidden="true">⌂</span><span>Add your property</span></li>
        <li><span aria-hidden="true">▣</span><span>Create projects</span></li>
        <li><span aria-hidden="true">▤</span><span>Track expenses and export a CPA review packet</span></li>
      </ol>
      <button class="button button-primary" data-action="add-property" type="button"><span aria-hidden="true">+</span>Add your property</button>
    </section>
  `;
}

function renderPropertyView() {
  const selectedProperty = data.properties.find((property) => property.id === selectedPropertyId);
  const propertyProjects = data.projects.filter((project) => project.propertyId === selectedPropertyId);
  const propertyExpenses = data.expenses.filter((expense) => expense.propertyId === selectedPropertyId);
  const totals = getExpenseTotals(propertyExpenses);

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Property setup",
        title: "Property records",
        description: "Create a home profile, then connect projects and expenses to that property.",
        actions: `
          ${data.properties.length ? `<button class="button button-secondary" data-action="edit-property" type="button">Edit selected</button>` : ""}
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
                </dl>
                ${selectedProperty.notes ? `<p class="notes-block">${escapeHtml(selectedProperty.notes)}</p>` : ""}
              </div>
            ` : ""}
          ` : renderEmpty("No property yet", "Start with the home these records belong to.")}
        </section>
        <section class="panel">
          ${renderPanelHeader(propertyMode === "edit" ? "Edit property" : "Add property", "Only the property name is required. You can fill in purchase details later.", "clipboard")}
          ${propertyMode === "view" && selectedProperty ? renderEmpty("Property saved", "Use Edit selected to update this property profile.") : renderPropertyForm(propertyMode === "edit" ? selectedProperty : null)}
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
  const selectedProject = filteredProjects.find((project) => project.id === editingProjectId) || filteredProjects[0] || null;

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
          ${filteredProjects.length ? renderProjectsTable(filteredProjects, selectedProject) : renderEmpty("No matching projects", "Adjust the filters or add a project for this property.")}
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
        ["Potential basis additions", formatCurrency(totals.potential), "green"],
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
        ${renderPanelHeader("Expense ledger", "", "receipt")}
        <div class="filter-bar expense-filters">
          ${renderFilter("Property", "expense.propertyId", expenseFilters.propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })))}
          ${renderFilter("Project", "expense.projectId", expenseFilters.projectId, projectOptions.map((project) => ({ value: project.id, label: project.name })))}
          ${renderFilter("Classification", "expense.classification", expenseFilters.classification, CLASSIFICATIONS)}
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
            ? renderEmpty("No matching expenses", "Add an expense or adjust the filters.")
            : renderEmpty("No property yet", "Add a property before tracking expenses.")}
      </section>
    </div>
  `;
}

function renderDocumentsView() {
  const documentationGaps = data.expenses.filter(isDocumentationGap);
  const editingDocument = editingDocumentId === null ? null : data.documents.find((document) => document.id === editingDocumentId);

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Document checklist",
        title: "Receipts and supporting documents",
        description: "Attach receipt and invoice files locally, then track what still needs follow-up.",
        actions: `<button class="button button-primary" data-action="add-document" ${data.properties.length ? "" : "disabled"} type="button"><span aria-hidden="true">+</span>Add document note</button>`,
      })}
      ${renderNotice("Try to keep receipts, contractor invoices, permits, before/after photos, and payment records.")}
      ${renderNotice("Attached files are stored only in this browser on this device. They are not uploaded by this app. Anyone with access to this browser profile may be able to view them.")}
      ${data.properties.length ? "" : renderEmpty("Add a property first", "Document notes need a property so they can be included in the right records packet.")}
      ${editingDocumentId !== undefined ? `
        <section class="panel">
          ${renderPanelHeader(editingDocument ? "Edit document note" : "Add document note", "Save a display name, document type, and optional local file. Local file paths are removed from document notes.", "edit", `<button class="icon-button" data-action="close-document-form" type="button" aria-label="Close">×</button>`)}
          ${renderDocumentForm(editingDocument || null)}
        </section>
      ` : ""}
      <div class="content-grid two-columns">
        <section class="panel">
          ${renderPanelHeader("Missing documentation", "Expenses marked no document yet or needs follow-up.", "alert")}
          ${documentationGaps.length
            ? renderDocumentationGapsTable(documentationGaps)
            : data.properties.length
              ? renderEmpty("No open documentation gaps", "Expenses with missing document status will appear here.")
              : renderEmpty("No property yet", "Add a property, then track expenses to build the checklist.")}
        </section>
        <section class="panel">
          ${renderPanelHeader("Document notes", "", "document")}
          ${data.documents.length
            ? renderDocumentList()
            : data.properties.length
              ? renderEmpty("No document notes yet", "Add a simple note for receipts, invoices, permits, photos, or contracts.")
              : renderEmpty("No property yet", "Add a property before attaching document notes.")}
        </section>
      </div>
    </div>
  `;
}

function renderExportCenter() {
  const totals = getExpenseTotals(data.expenses);
  requestStorageEstimate();

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Export center",
        title: "Share a clean records packet with your CPA",
        description: "Create a CSV of saved expenses and print a summary view for professional review.",
        actions: `
          <button class="button button-secondary" data-action="print-summary" type="button"><span aria-hidden="true">⎙</span>Print summary</button>
          <button class="button button-primary" data-action="download-csv" ${data.expenses.length ? "" : "disabled"} type="button"><span aria-hidden="true">↓</span>Download CSV</button>
        `,
      })}
      ${renderNotice("Exports may include home, vendor, amount, notes, and document status details. Review them before sharing. CSV and print exports include metadata only, not stored document files.", "print-hidden")}
      ${renderStorageHealthPanel()}
      ${renderBackupRestorePanel()}
      <section class="panel print-summary">
        ${renderPanelHeader("CPA packet summary", `Prepared from local records on ${formatDate(todayISO())}.`, "clipboard")}
        ${renderMetrics([
          ["Total tracked spend", formatCurrency(totals.total), ""],
          ["Potential basis additions", formatCurrency(totals.potential), "green"],
          ["Repair/maintenance", formatCurrency(totals.repair), "rust"],
          ["Unclear / ask CPA", formatCurrency(totals.unclear), "amber"],
        ], "compact")}
        <div class="export-section">
          <h3>Properties</h3>
          ${data.properties.length ? renderExportPropertiesTable() : renderEmpty("No properties to export", "Add a property before preparing a full packet.")}
        </div>
        <div class="export-section">
          <h3>Expense detail</h3>
          ${data.expenses.length ? renderExportExpensesTable() : renderEmpty("No expenses to export", "Add expense records to build the CSV and summary packet.")}
        </div>
        <div class="export-section">
          <h3>Document notes</h3>
          ${data.documents.length ? renderExportDocumentsTable() : renderEmpty("No document notes to export", "Add document notes to include local file metadata in the printable summary.")}
        </div>
      </section>
    </div>
  `;
}

function renderStorageHealthPanel() {
  const attachedDocuments = data.documents.filter((document) => document.hasFile);
  const attachedFileSize = attachedDocuments.reduce((total, document) => total + (Number(document.fileSize) || 0), 0);
  const estimateCopy = getStorageEstimateCopy();

  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("Storage health", "Browser storage is local to this device and browser profile. It is useful, but it is not a backup.", "document")}
      <div class="storage-health-grid">
        ${storageMetric("Properties", data.properties.length)}
        ${storageMetric("Projects", data.projects.length)}
        ${storageMetric("Expenses", data.expenses.length)}
        ${storageMetric("Document notes", data.documents.length)}
        ${storageMetric("Attached files", attachedDocuments.length)}
        ${storageMetric("Attached file size", formatFileSize(attachedFileSize))}
        ${storageMetric("Browser storage used", estimateCopy.used)}
        ${storageMetric("Estimated quota", estimateCopy.quota)}
      </div>
      <p class="helper-note">Large files may fail to save if browser storage is full or cleared. Keep your own backup of important records.</p>
    </section>
  `;
}

function renderBackupRestorePanel() {
  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("Backup and restore", "Create a private backup for your own records, or restore one on this browser.", "clipboard")}
      <div class="backup-actions">
        <button class="button button-primary" data-action="download-full-backup" type="button">Download full backup</button>
        <button class="button button-secondary" data-action="choose-backup-file" type="button">Restore from backup</button>
        <input class="restore-input" data-restore-input type="file" accept="application/json,.json">
      </div>
      <p class="helper-note">Full backups include app records and attached files encoded inside the JSON file. They are for your own records and are not tax filing documents.</p>
    </section>
  `;
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
      ${field("Contractor/vendor", "contractor", project?.contractor || "")}
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
        ${field("Vendor/payee", "vendor", expense?.vendor || "", { required: true })}
        ${field("Description", "description", expense?.description || "", { required: true })}
      </div>
      <div class="form-row">
        ${selectField("Classification", "classification", expense?.classification || "unclear / ask CPA", CLASSIFICATIONS, false)}
        ${selectField("Category", "category", expense?.category || "other", EXPENSE_CATEGORIES, false)}
      </div>
      ${selectField("Documentation status", "documentationStatus", expense?.documentationStatus || "no document yet", DOCUMENT_STATUSES, false)}
      <p class="helper-note">This classification is for organization only. Confirm treatment with your CPA.</p>
      ${textarea("Notes", "notes", expense?.notes || "")}
      ${formActions("Save expense")}
    </form>
  `;
}

function renderDocumentForm(document) {
  const propertyId = document?.propertyId || selectedPropertyId || data.properties[0]?.id || "";
  const projectOptions = data.projects.filter((project) => project.propertyId === propertyId);
  const expenseOptions = data.expenses.filter((expense) => expense.propertyId === propertyId);
  const fileHelper = document?.hasFile
    ? `Current file: ${document.fileName || "Attached file"} (${formatFileSize(document.fileSize)}). Choose a new file to replace it.`
    : "Attached files are saved locally in this browser on this device. They are not uploaded.";

  return `
    <form class="form-grid" data-form="document" enctype="multipart/form-data" novalidate>
      <input type="hidden" name="id" value="${escapeAttr(document?.id || "")}">
      <div class="form-row">
        ${selectField("Property", "propertyId", propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })), false)}
        ${selectField("Document type", "documentType", document?.documentType || "receipt", DOCUMENT_TYPES, false)}
      </div>
      ${field("Display name", "displayName", document?.displayName || "", { required: true })}
      <div class="form-row">
        ${selectField("Project", "projectId", document?.projectId || "", projectOptions.map((project) => ({ value: project.id, label: project.name })))}
        ${selectField("Related expense", "expenseId", document?.expenseId || "", expenseOptions.map((expense) => ({ value: expense.id, label: `${formatDate(expense.date)} / ${expense.vendor} / ${formatCurrency(expense.amount)}` })))}
      </div>
      ${field("Added date", "addedDate", document?.addedDate || todayISO(), { type: "date", required: true })}
      <label class="field file-field">
        <span>Attach file</span>
        <input name="file" type="file">
        <small>${escapeHtml(fileHelper)}</small>
        <small>Browser storage is limited. Files over ${formatFileSize(MAX_DOCUMENT_FILE_SIZE)} are not accepted in this MVP.</small>
      </label>
      ${textarea("Notes", "notes", document?.notes || "")}
      ${formActions("Save document note")}
    </form>
  `;
}

function renderRecentExpenseTable(expenses) {
  return table(["Date", "Vendor", "Classification", "Amount"], expenses.map((expense) => [
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
  return table(["Date", "Expense", "Property / project", "Classification", "Docs", "Amount", "Actions"], expenses.map((expense) => [
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
  return table(["Date", "Expense", "Status", "Amount"], expenses.map((expense) => [
    formatDate(expense.date),
    `<strong>${escapeHtml(expense.vendor)}</strong><span>${escapeHtml(expense.description)}</span>`,
    documentationPill(expense.documentationStatus),
    `<span class="money">${formatCurrency(expense.amount)}</span>`,
  ]));
}

function renderDocumentList() {
  return `
    <div class="document-list">
      ${data.documents.map((document) => `
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

function renderDocumentFileMeta(document) {
  if (!document.hasFile) {
    return `<p><span class="pill tone-amber">No file attached</span></p>`;
  }

  const type = document.mimeType || "Unknown type";
  return `
    <p>
      <span class="pill tone-green">Stored locally</span>
      <span class="file-meta">${escapeHtml(document.fileName || "Attached file")} / ${escapeHtml(type)} / ${formatFileSize(document.fileSize)}</span>
    </p>
  `;
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
      ${detailItem("Linked expense total", formatCurrency(totals.total))}
    </dl>
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
        : "No file attached",
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

  if (action === "add-property") {
    activeTab = "property";
    propertyMode = "new";
  } else if (action === "edit-property") {
    propertyMode = "edit";
  } else if (action === "add-project") {
    activeTab = "projects";
    editingProjectId = null;
  } else if (action === "edit-project") {
    activeTab = "projects";
    editingProjectId = id;
  } else if (action === "select-project") {
    editingProjectId = id;
  } else if (action === "delete-project") {
    deleteProject(id);
  } else if (action === "add-expense") {
    activeTab = "expenses";
    editingExpenseId = null;
  } else if (action === "edit-expense") {
    editingExpenseId = id;
  } else if (action === "delete-expense") {
    deleteExpense(id);
  } else if (action === "close-expense-form") {
    editingExpenseId = undefined;
  } else if (action === "add-document") {
    activeTab = "documents";
    editingDocumentId = null;
  } else if (action === "edit-document") {
    editingDocumentId = id;
  } else if (action === "delete-document") {
    await deleteDocument(id);
  } else if (action === "download-document-file") {
    await downloadDocumentAttachment(id);
  } else if (action === "remove-document-file") {
    await removeDocumentAttachment(id);
  } else if (action === "close-document-form") {
    editingDocumentId = undefined;
  } else if (action === "open-export") {
    activeTab = "export";
  } else if (action === "download-csv") {
    downloadTextFile(buildExpensesCsv(data), `home-basis-tracker-expenses-${todayISO()}.csv`, "text/csv;charset=utf-8");
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
  } else if (filter.startsWith("project.")) {
    projectFilters[filter.replace("project.", "")] = control.value;
  } else if (filter.startsWith("expense.")) {
    const key = filter.replace("expense.", "");
    expenseFilters[key] = control.value;
    if (key === "propertyId") expenseFilters.projectId = EMPTY_FILTER;
  }

  render();
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

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formType = form.dataset.form;
  if (!formType) return;
  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());

  if (formType === "property") saveProperty(values);
  if (formType === "project") saveProject(values);
  if (formType === "expense") saveExpense(values);
  if (formType === "document") await saveDocument(values, formData.get("file"));
}

function saveProperty(values) {
  if (!values.name?.trim()) return showNotice("Property name is required.");
  const property = {
    id: values.id || createId("property"),
    name: removeLocalPaths(values.name).trim(),
    address: removeLocalPaths(values.address).trim(),
    purchaseDate: values.purchaseDate,
    purchasePrice: parseAmount(values.purchasePrice),
    notes: removeLocalPaths(values.notes).trim(),
  };
  updateData({ ...data, properties: upsertById(data.properties, property) });
  selectedPropertyId = property.id;
  propertyMode = "view";
  showNotice("Property saved.");
}

function saveProject(values) {
  if (!values.propertyId) return showNotice("Property is required.");
  if (!values.name?.trim()) return showNotice("Project name is required.");
  const project = {
    id: values.id || createId("project"),
    propertyId: values.propertyId,
    name: removeLocalPaths(values.name).trim(),
    category: values.category,
    startDate: values.startDate,
    completionDate: values.completionDate,
    contractor: removeLocalPaths(values.contractor).trim(),
    status: values.status,
    notes: removeLocalPaths(values.notes).trim(),
  };
  const existingProject = data.projects.find((currentProject) => currentProject.id === project.id);
  const propertyChanged = existingProject && existingProject.propertyId !== project.propertyId;
  updateData({
    ...data,
    projects: upsertById(data.projects, project),
    expenses: propertyChanged
      ? data.expenses.map((expense) => expense.projectId === project.id ? { ...expense, propertyId: project.propertyId } : expense)
      : data.expenses,
    documents: propertyChanged
      ? data.documents.map((document) => document.projectId === project.id ? { ...document, propertyId: project.propertyId } : document)
      : data.documents,
  });
  selectedPropertyId = project.propertyId;
  projectFilters.propertyId = project.propertyId;
  editingProjectId = undefined;
  showNotice("Project saved.");
}

function saveExpense(values) {
  if (!values.propertyId) return showNotice("Property is required.");
  if (!values.date) return showNotice("Date is required.");
  if (!values.vendor?.trim()) return showNotice("Vendor or payee is required.");
  if (!values.description?.trim()) return showNotice("Description is required.");
  if (parseAmount(values.amount) <= 0) return showNotice("Enter an amount greater than zero.");

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
  updateData({
    ...data,
    expenses: upsertById(data.expenses, expense),
    documents: data.documents.map((documentRecord) =>
      documentRecord.expenseId === expense.id
        ? { ...documentRecord, propertyId: expense.propertyId, projectId: expense.projectId }
        : documentRecord,
    ),
  });
  selectedPropertyId = expense.propertyId;
  expenseFilters.propertyId = expense.propertyId;
  editingExpenseId = undefined;
  showNotice("Expense saved.");
}

async function saveDocument(values, file) {
  if (!values.propertyId) return showNotice("Property is required.");
  if (!values.displayName?.trim()) return showNotice("Display name is required.");
  if (!values.addedDate) return showNotice("Added date is required.");
  if (file && file.size > MAX_DOCUMENT_FILE_SIZE) {
    return showNotice(`Files over ${formatFileSize(MAX_DOCUMENT_FILE_SIZE)} are not accepted in this MVP.`);
  }
  if (file && !canStoreDocuments()) {
    return showNotice("Attached file storage is not available in this browser.");
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
        mimeType: existingDocument.mimeType || "",
        fileSize: existingDocument.fileSize || 0,
        fileLastModified: existingDocument.fileLastModified || null,
        fileStoredAt: existingDocument.fileStoredAt || "",
      }
    : {
        hasFile: false,
        fileId: "",
        fileName: "",
        mimeType: "",
        fileSize: 0,
        fileLastModified: null,
        fileStoredAt: "",
      };

  if (file && file.size > 0) {
    try {
      newlySavedFileId = createId("file");
      const storedFile = await saveDocumentFile(newlySavedFileId, file);
      fileMetadata = {
        hasFile: true,
        fileId: storedFile.id,
        fileName: removeLocalPaths(storedFile.name).trim() || "Attached file",
        mimeType: storedFile.type,
        fileSize: storedFile.size,
        fileLastModified: storedFile.lastModified,
        fileStoredAt: storedFile.storedAt,
      };
    } catch (error) {
      return showNotice(getDocumentStorageError(error));
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

  const saved = updateData({ ...data, documents: nextDocuments, expenses: nextExpenses });

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
  resetStorageEstimate();

  if (newlySavedFileId && previousFileId && previousFileId !== newlySavedFileId) {
    try {
      await deleteDocumentFile(previousFileId);
    } catch {
      showNotice("Document saved, but the previous stored file could not be removed from browser storage.");
      return;
    }
  }

  showNotice(documentRecord.hasFile ? "Document note and local file saved." : "Document note saved.");
}

function deleteProject(projectId) {
  if (!window.confirm("Delete this project? Linked expenses will stay saved without a project.")) return;
  updateData({
    ...data,
    projects: data.projects.filter((project) => project.id !== projectId),
    expenses: data.expenses.map((expense) => expense.projectId === projectId ? { ...expense, projectId: "" } : expense),
    documents: data.documents.map((document) => document.projectId === projectId ? { ...document, projectId: "" } : document),
  });
  editingProjectId = undefined;
  showNotice("Project deleted. Linked expenses were kept.");
}

function deleteExpense(expenseId) {
  if (!window.confirm("Delete this expense and unlink its document notes?")) return;
  updateData({
    ...data,
    expenses: data.expenses.filter((expense) => expense.id !== expenseId),
    documents: data.documents.map((document) => document.expenseId === expenseId ? { ...document, expenseId: "" } : document),
  });
  editingExpenseId = undefined;
  showNotice("Expense deleted.");
}

async function deleteDocument(documentId) {
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!window.confirm("Delete this document from this app? This removes the stored copy and its note here, but does not delete the original file from your computer or any copies you downloaded.")) return;

  const nextDocuments = data.documents.filter((document) => document.id !== documentId);
  const saved = updateData({
    ...data,
    documents: nextDocuments,
    expenses: reconcileExpensesAfterDocumentFileRemoval(nextDocuments, documentRecord),
  });
  if (!saved) return;

  if (documentRecord?.hasFile) {
    try {
      await deleteDocumentFile(documentRecord.fileId || documentRecord.id);
      resetStorageEstimate();
    } catch {
      editingDocumentId = undefined;
      showNotice("The note was removed, but the stored file could not be removed from browser storage.");
      return;
    }
  }
  editingDocumentId = undefined;
  showNotice("Document note deleted.");
}

async function downloadDocumentAttachment(documentId) {
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!documentRecord?.hasFile) return showNotice("No stored file is attached to this document note.");

  try {
    const storedFile = await getDocumentFile(documentRecord.fileId || documentRecord.id);
    if (!storedFile?.blob) {
      await markDocumentFileMissing(documentRecord);
      return showNotice("The file metadata is saved, but the stored file is missing. It may have been cleared from browser storage.");
    }
    downloadBlob(storedFile.blob, documentRecord.fileName || storedFile.name || "home-basis-document");
    showNotice("Downloading creates a separate copy outside this app.");
  } catch (error) {
    showNotice(getDocumentStorageError(error));
  }
}

async function removeDocumentAttachment(documentId) {
  const documentRecord = data.documents.find((document) => document.id === documentId);
  if (!documentRecord?.hasFile) return showNotice("No stored file is attached to this document note.");
  if (!window.confirm("Remove the stored file from this app? The document note will stay, and this will not delete the original file from your computer or any copies you downloaded.")) return;

  const nextDocuments = data.documents.map((document) =>
    document.id === documentId
      ? {
          ...document,
          hasFile: false,
          fileId: "",
          fileName: "",
          mimeType: "",
          fileSize: 0,
          fileLastModified: null,
          fileStoredAt: "",
        }
      : document,
  );

  const saved = updateData({
    ...data,
    documents: nextDocuments,
    expenses: reconcileExpensesAfterDocumentFileRemoval(nextDocuments, documentRecord),
  });
  if (!saved) return;

  try {
    await deleteDocumentFile(documentRecord.fileId || documentRecord.id);
  } catch (error) {
    return showNotice(getDocumentStorageError(error));
  }
  resetStorageEstimate();
  showNotice("Stored file removed. The document note was kept.");
}

async function markDocumentFileMissing(documentRecord) {
  const nextDocuments = data.documents.map((document) =>
    document.id === documentRecord.id
      ? {
          ...document,
          hasFile: false,
          fileId: "",
          fileName: document.fileName ? `${document.fileName} (missing)` : "",
          fileSize: 0,
          fileLastModified: null,
          fileStoredAt: "",
        }
      : document,
  );

  updateData({
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
    downloadTextFile(
      `${JSON.stringify(backup, null, 2)}\n`,
      `home-basis-tracker-backup-${todayISO()}.json`,
      "application/json;charset=utf-8",
    );
    if (backup.missingFiles.length) {
      showNotice("Backup downloaded, but some stored files were missing from browser storage.");
      return;
    }
    showNotice("Full backup downloaded.");
  } catch (error) {
    showNotice(getBackupError(error));
  }
}

async function buildFullBackup() {
  const backupData = sanitizeData(data);
  const files = [];
  const missingFiles = [];

  for (const documentRecord of backupData.documents.filter((document) => document.hasFile)) {
    const storedFile = await getDocumentFile(documentRecord.fileId || documentRecord.id);
    if (!storedFile?.blob) {
      missingFiles.push({
        documentId: documentRecord.id,
        fileName: documentRecord.fileName || "Attached file",
      });
      continue;
    }

    files.push({
      documentId: documentRecord.id,
      fileId: documentRecord.fileId || documentRecord.id,
      fileName: documentRecord.fileName || storedFile.name || "Attached file",
      mimeType: documentRecord.mimeType || storedFile.type || "application/octet-stream",
      fileSize: documentRecord.fileSize || storedFile.size || storedFile.blob.size || 0,
      fileLastModified: documentRecord.fileLastModified || storedFile.lastModified || null,
      fileStoredAt: documentRecord.fileStoredAt || storedFile.storedAt || "",
      dataUrl: await blobToDataUrl(storedFile.blob),
    });
  }

  return {
    app: BACKUP_APP_ID,
    backupVersion: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data: backupData,
    files,
    missingFiles,
  };
}

async function restoreFromBackupFile(file) {
  if (!file) return;
  if (file.size > MAX_BACKUP_FILE_SIZE) {
    return showNotice(`Backup files over ${formatFileSize(MAX_BACKUP_FILE_SIZE)} are not accepted in this MVP.`);
  }
  if (!window.confirm("Restore this backup? This replaces the current local records in this browser. It does not upload anything.")) return;

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    return showNotice("This backup file could not be read as JSON.");
  }

  const oldFileIds = await getExistingDocumentFileIds();
  let restored;
  try {
    restored = await prepareBackupRestore(backup);
  } catch (error) {
    return showNotice(getBackupError(error));
  }

  const saved = updateData(restored.data);
  if (!saved) {
    await deleteFilesBestEffort(restored.newFileIds);
    return;
  }

  const importedFileIds = new Set(restored.newFileIds);
  const cleanup = await deleteFilesBestEffort(oldFileIds.filter((fileId) => !importedFileIds.has(fileId)));
  resetStorageEstimate();

  activeTab = "dashboard";
  selectedPropertyId = data.properties[0]?.id || "";
  resetFiltersAfterRestore();
  closeEditors();
  const restoreNotice = restored.skippedFiles
    ? "Backup restored. Some attached files could not be restored in this browser."
    : "Backup restored.";
  const cleanupNotice = cleanup.failed
    ? " Some older stored files could not be removed from browser storage."
    : "";
  showNotice(`${restoreNotice}${cleanupNotice}`);
}

async function prepareBackupRestore(backup) {
  if (!backup || backup.app !== BACKUP_APP_ID || !backup.data) {
    throw new Error("This does not look like a Home Basis Tracker backup.");
  }
  if (Number(backup.backupVersion || 1) > BACKUP_VERSION) {
    throw new Error("This backup was created by a newer version of Home Basis Tracker.");
  }

  const restoredData = sanitizeData(backup.data);
  const backupFiles = Array.isArray(backup.files) ? backup.files : [];
  const newFileIds = [];
  let skippedFiles = 0;

  try {
    const restoredDocuments = [];

    for (const documentRecord of restoredData.documents) {
      if (!documentRecord.hasFile) {
        restoredDocuments.push(documentRecord);
        continue;
      }

      const backupFile = backupFiles.find((fileRecord) =>
        fileRecord.documentId === documentRecord.id ||
        fileRecord.fileId === documentRecord.fileId
      );

      if (!backupFile?.dataUrl) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "File not included in backup"));
        continue;
      }
      if (!canStoreDocuments()) {
        skippedFiles += 1;
        restoredDocuments.push(stripDocumentFileMetadata(documentRecord, "File could not be restored in this browser"));
        continue;
      }
      if (isDataUrlTooLarge(backupFile.dataUrl)) {
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
        fileName: removeLocalPaths(storedFile.name).trim() || "Attached file",
        mimeType: storedFile.type,
        fileSize: storedFile.size,
        fileLastModified: storedFile.lastModified,
        fileStoredAt: storedFile.storedAt,
      });
    }

    restoredData.documents = restoredDocuments;
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

function stripDocumentFileMetadata(documentRecord, reason) {
  return {
    ...documentRecord,
    hasFile: false,
    fileId: "",
    fileName: reason,
    mimeType: "",
    fileSize: 0,
    fileLastModified: null,
    fileStoredAt: "",
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

async function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new Error("Backup file data is not in the expected format.");
  }
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Could not read a file stored in the backup.");
  return response.blob();
}

function isDataUrlTooLarge(dataUrl) {
  return typeof dataUrl !== "string" || dataUrl.length > MAX_BACKUP_DATA_URL_LENGTH;
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
}

function getBackupError(error) {
  const message = error?.message || "";
  if (/quota|storage/i.test(message)) {
    return "The backup could not be restored because browser storage may be full.";
  }
  if (/Home Basis Tracker backup/i.test(message)) {
    return message;
  }
  return "The backup could not be completed. Check the file and try again.";
}

function loadStoredData() {
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    return storedValue ? sanitizeData(JSON.parse(storedValue)) : EMPTY_DATA;
  } catch {
    return EMPTY_DATA;
  }
}

function updateData(nextData) {
  const previousData = data;
  data = sanitizeData(nextData);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    data = previousData;
    notice = "Unable to save locally. Check browser storage settings before adding more records.";
    render();
    return false;
  }
  render();
  return true;
}

function getDocumentStorageError(error) {
  const message = error?.message || "";
  if (/quota|storage/i.test(message)) {
    return "The file could not be saved because browser storage may be full. Keep your own backup of important records.";
  }
  if (/available|indexeddb/i.test(message)) {
    return "Attached file storage is not available in this browser.";
  }
  if (/blocked/i.test(message)) {
    return "Document storage is blocked by another browser tab. Close other tabs for this app and try again.";
  }
  return "The file could not be saved locally. Keep your own backup and try again.";
}

function showNotice(message) {
  notice = message;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    notice = "";
    render();
  }, 2800);
  render();
}

function closeEditors() {
  editingProjectId = undefined;
  editingExpenseId = undefined;
  editingDocumentId = undefined;
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
  return `<div class="notice-card ${className}"><span aria-hidden="true">!</span><p>${escapeHtml(text)}</p></div>`;
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
            return `<tr${rowClass}>${cells.map((cell, index) => `<td class="${index >= cells.length - 2 ? "align-right" : ""}">${cell}</td>`).join("")}</tr>`;
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
  return `<span class="pill ${hasDocument ? "tone-green" : "tone-amber"}">${hasDocument ? "✓" : "!"} ${escapeHtml(optionLabel(DOCUMENT_STATUSES, value))}</span>`;
}

function iconSymbol(name) {
  const symbols = {
    alert: "!",
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
