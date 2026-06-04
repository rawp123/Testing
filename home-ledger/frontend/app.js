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
  getProjectCompleteness,
  getProjectReviewSummaries,
  getProjectVendorName,
  getProjectName,
  getPropertyReviewSummaries,
  getPropertyName,
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
const app = document.querySelector("#app");

let data = EMPTY_DATA;
let realData = EMPTY_DATA;
let tutorialData = createTutorialData();
let workspaceMode = WORKSPACE_REAL;
let activeTab = "dashboard";
let selectedPropertyId = "";
let notice = "";
let storageWriteBlocked = false;
let propertyMode = "view";
let editingPropertyField = "";
let selectedProjectId = "";
let expandedProjectIds = new Set();
let editingProjectId;
let editingProjectField = "";
let editingExpenseId;
let editingDocumentId;
let editingVendorId;
let vendorManagerOpen = false;
let draftExpenseProjectId = "";
let draftDocumentExpenseId = "";
let draftDocumentProjectId = "";
let documentPreview = null;
let lastBackupCreatedAt = "";
let storageEstimate = {
  status: "idle",
  usage: 0,
  quota: 0,
};
let storageInfo = {
  mode: isDesktopMode() ? "desktop" : "browser",
  recordsPathLabel: isDesktopMode() ? "Mac app records file" : "Browser storage",
  documentsPathLabel: isDesktopMode() ? "Mac app documents folder" : "Browser IndexedDB",
  storageDescription: isDesktopMode()
    ? "Records and document copies are stored by the Mac app."
    : "Records and document copies are available in this browser.",
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
  propertyId: EMPTY_FILTER,
  documentType: EMPTY_FILTER,
  fileStatus: EMPTY_FILTER,
};
const DOCUMENT_TAB_LIBRARY = "library";
const DOCUMENT_TAB_FOLLOW_UP = "follow-up";
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

const ENABLE_TEMP_SAMPLE_RECORDS = true;
const TEMP_SAMPLE_RECORDS_DISABLED_KEY = "home-ledger:disable-temp-sample-records";
const TEMP_SAMPLE_PROPERTY = {
  id: "temp_sample_property_testing",
  name: "Sample testing home",
  address: "42 Garden View Lane",
  purchaseDate: "2020-04-17",
  purchasePrice: 485000,
  notes: "Temporary sample property for testing project workflows. Remove before distribution.",
};

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
        ${renderPanelHeader("Opening Home Basis Tracker", "Loading your records.", "home")}
      </section>
    </main>
  `;
}

async function initializeApp() {
  try {
    realData = withTemporarySampleRecords(await loadRecords(STORAGE_KEY));
    data = realData;
    storageWriteBlocked = false;
  } catch {
    realData = withTemporarySampleRecords(EMPTY_DATA);
    data = EMPTY_DATA;
    storageWriteBlocked = true;
    notice = "Unable to load records. To protect existing data, new saves are paused until you restore a backup or reopen the app.";
  }
  try {
    storageInfo = await getStorageInfo();
  } catch {
    // Records can still load and save even if the optional storage summary is unavailable.
  }

  selectedPropertyId = data.properties[0]?.id || "";
  propertyMode = "view";
  resetFiltersAfterRestore();
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
              ${isTutorialMode() ? `<p class="eyebrow">Tutorial workspace</p>` : ""}
              <h1>Home Basis Tracker</h1>
              ${isTutorialMode() ? `<p>Sample workspace</p>` : ""}
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
              type="button"
            ><span aria-hidden="true">${tabIcon(tab.id)}</span>${escapeHtml(tab.label)}</button>
          `).join("")}
        </nav>
        ${renderWorkspaceControls()}
      </aside>
      <main class="workspace">
        ${renderToast()}
        ${renderTutorialModeBanner()}
        <section class="tab-panel" id="${activeTab}-panel" role="tabpanel" aria-labelledby="${activeTab}-tab">
          ${renderActiveTab()}
        </section>
        ${vendorManagerOpen ? renderVendorManagerModal() : ""}
        ${editingVendorId !== undefined ? renderVendorFormModal(editingVendorId ? data.vendors.find((vendor) => vendor.id === editingVendorId) : null) : ""}
        ${renderDocumentPreview()}
      </main>
    </div>
  `;
  keepActiveTabVisible();
}

function keepActiveTabVisible() {
  const activeButton = app.querySelector(".app-tabs button.is-active");
  activeButton?.scrollIntoView({ block: "nearest", inline: "nearest" });
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
  const attentionCount = readiness.followUps.length + readiness.expensesMissingLinkedEvidence.length + readiness.documentsWithoutFiles.length + readiness.expensesMissingVendors.length;
  const projectCounts = PROJECT_STATUSES.map((status) => ({
    ...status,
    count: data.projects.filter((project) => project.status === status.value).length,
  }));

  return `
    <div class="page-stack">
      ${hasRecords ? renderPageIntro({
        eyebrow: "Overview",
        title: "Your home records",
        description: "Track properties, projects, expenses, and documents in one place.",
        actions: `
          <button class="button button-secondary" data-action="add-expense" type="button"><span aria-hidden="true">+</span>Add expense</button>
          <button class="button button-primary" data-action="open-export" type="button"><span aria-hidden="true">↓</span>Export & backup</button>
        `,
      }) : renderOnboardingPanel()}

      ${renderMetrics([
        ["Properties", String(data.properties.length), ""],
        ["Projects", String(data.projects.length), "green"],
        ["Expenses", String(data.expenses.length), "blue"],
        ["Documents", String(data.documents.length), "amber"],
        ["Needs attention", String(attentionCount), attentionCount ? "rust" : "green"],
      ])}

      ${hasRecords ? renderReviewReadinessPanel(readiness) : ""}
      ${propertySummaries.length ? renderPropertyDashboardCards(propertySummaries) : ""}
      ${propertySummaries.length ? renderSaleScenarioPanel(propertySummaries) : ""}

      <div class="content-grid two-columns">
        <section class="panel">
          ${renderPanelHeader("Recent expenses", "Newest records in your binder.", "receipt")}
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
        <p>Create a private record of properties, improvement projects, receipts, permits, contractor records, photos, and notes.</p>
      </div>
      <ol class="step-list">
        <li><span aria-hidden="true">⌂</span><span>Add your property</span></li>
        <li><span aria-hidden="true">▣</span><span>Create projects</span></li>
        <li><span aria-hidden="true">▤</span><span>Attach supporting records and export a review packet</span></li>
      </ol>
      <div class="onboarding-actions">
        <button class="button button-primary" data-action="add-property" type="button"><span aria-hidden="true">+</span>Add your property</button>
        <button class="button button-secondary" data-action="start-tutorial" type="button">Open tutorial</button>
      </div>
    </section>
  `;
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

  return `
    <section class="panel sale-scenario-panel">
      ${renderPanelHeader(
        "Sale scenario",
        "Estimate net proceeds and potential taxable gain from saved records and a few assumptions.",
        "home",
      )}
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
              <span>Main-home exclusion</span>
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
            ${scenarioResultCard("Cash before tax", hasSalePrice ? formatCurrency(estimate.netProceedsBeforeTax) : "Enter sale price", "Sale price minus selling costs and mortgage payoff.")}
            ${scenarioResultCard("Potential taxable gain", hasSalePrice ? formatCurrency(estimate.potentialTaxableGain) : "Enter sale price", "Gain after the selected exclusion assumption.")}
          </div>
          <dl class="scenario-breakdown">
            ${detailItem("Purchase price", formatCurrency(estimate.purchasePrice))}
            ${detailItem("Included basis additions", formatCurrency(estimate.basisAdditions))}
            ${detailItem("Estimated selling costs", hasSalePrice ? formatCurrency(estimate.sellingCosts) : "Not estimated")}
            ${detailItem("Adjusted basis used", formatCurrency(estimate.adjustedBasis))}
            ${detailItem("Gain before exclusion", hasSalePrice ? formatCurrency(estimate.gainBeforeExclusion) : "Not estimated")}
            ${detailItem("Needs-review costs not included", formatCurrency(estimate.needsReviewCosts))}
          </dl>
          <p class="helper-note">This planner uses purchase price plus expenses marked potential basis addition. It does not estimate taxes owed, depreciation, state taxes, or whether you qualify for an exclusion. Confirm the assumptions with a qualified professional.</p>
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

function renderReviewReadinessPanel(readiness) {
  const followUps = readiness.followUps.slice(0, 6);
  const readyItems = readiness.readyItems.slice(0, 4);

  return `
    <section class="panel review-readiness-panel">
      ${renderPanelHeader("Record completeness", "Key gaps and next steps.", "clipboard", `
        <button class="button button-secondary" data-action="open-export" type="button">Open review packet</button>
      `)}
      <div class="readiness-layout">
        <div class="readiness-combined-card">
          <div class="readiness-list-section">
            <h3>Core records</h3>
            ${readyItems.length ? `
              <ul class="check-list">
                ${readyItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            ` : `<p class="helper-note">Add a property, expenses, and documents to begin building readiness.</p>`}
          </div>
          <div class="readiness-list-section">
            <h3>Suggested next actions</h3>
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

function withTemporarySampleRecords(records) {
  const cleanData = sanitizeData(records);
  if (!temporarySampleRecordsEnabled()) return cleanData;

  const propertyId = cleanData.properties[0]?.id || TEMP_SAMPLE_PROPERTY.id;
  const properties = cleanData.properties.length
    ? cleanData.properties
    : [TEMP_SAMPLE_PROPERTY];
  const sampleProjects = createTemporarySampleProjects(propertyId);
  const sampleExpenses = createTemporarySampleExpenses(propertyId);
  const sampleDocuments = createTemporarySampleDocuments(propertyId);

  return sanitizeData({
    properties,
    projects: addMissingRecords(cleanData.projects, sampleProjects),
    expenses: addMissingRecords(cleanData.expenses, sampleExpenses),
    documents: addMissingRecords(cleanData.documents, sampleDocuments),
  });
}

function temporarySampleRecordsEnabled() {
  try {
    return ENABLE_TEMP_SAMPLE_RECORDS && window.localStorage.getItem(TEMP_SAMPLE_RECORDS_DISABLED_KEY) !== "true";
  } catch {
    return ENABLE_TEMP_SAMPLE_RECORDS;
  }
}

function addMissingRecords(existingRecords, temporaryRecords) {
  const existingIds = new Set(existingRecords.map((record) => record.id));
  return [
    ...existingRecords,
    ...temporaryRecords.filter((record) => !existingIds.has(record.id)),
  ];
}

function createTemporarySampleProjects(propertyId) {
  return [
    {
      id: "temp_sample_project_interior_paint",
      propertyId,
      name: "Sample: Interior painting",
      category: "interior painting",
      startDate: "2024-02-05",
      completionDate: "2024-02-12",
      contractor: "Northside Painting Co.",
      permitNumber: "",
      status: "completed",
      scopeSummary: "Painted living room, hallway, bedroom walls, trim, and repaired minor drywall damage.",
      notes: "Temporary sample project for testing completed work, notes, expenses, and photo/document links.",
    },
    {
      id: "temp_sample_project_exterior_paint",
      propertyId,
      name: "Sample: Exterior painting",
      category: "exterior painting",
      startDate: "2024-06-03",
      completionDate: "",
      contractor: "Evergreen Exterior Finish",
      permitNumber: "",
      status: "in progress",
      scopeSummary: "Prep, scrape, prime, and repaint exterior siding, trim, shutters, and porch railings.",
      notes: "Useful for testing in-progress projects and follow-up documents.",
    },
    {
      id: "temp_sample_project_bathroom",
      propertyId,
      name: "Sample: Bathroom remodel",
      category: "bathroom",
      startDate: "2023-09-11",
      completionDate: "2023-10-20",
      contractor: "Harbor Bath & Tile",
      permitNumber: "TMP-BATH-2309",
      status: "completed",
      scopeSummary: "Updated tile, vanity, plumbing fixtures, ventilation fan, lighting, and waterproofing.",
      notes: "Temporary sample with permit, invoice, and photo records.",
    },
    {
      id: "temp_sample_project_deck",
      propertyId,
      name: "Sample: Deck repair and railing",
      category: "deck/patio/porch",
      startDate: "2025-03-18",
      completionDate: "",
      contractor: "Cedarline Carpentry",
      permitNumber: "TMP-DECK-2503",
      status: "planned",
      scopeSummary: "Replace damaged deck boards, reinforce stair stringers, and install new railing sections.",
      notes: "Temporary sample for planned work and permit/estimate follow-up.",
    },
    {
      id: "temp_sample_project_hvac",
      propertyId,
      name: "Sample: Heat pump installation",
      category: "HVAC",
      startDate: "2022-11-02",
      completionDate: "2022-11-04",
      contractor: "Summit Heating & Air",
      permitNumber: "TMP-HVAC-2211",
      status: "completed",
      scopeSummary: "Installed ducted heat pump system, thermostat, exterior condenser pad, and electrical disconnect.",
      notes: "Temporary sample for high-value equipment records, warranty, and professional review.",
    },
  ];
}

function createTemporarySampleExpenses(propertyId) {
  return [
    {
      id: "temp_sample_expense_interior_paint",
      propertyId,
      projectId: "temp_sample_project_interior_paint",
      date: "2024-02-12",
      vendor: "Northside Painting Co.",
      description: "Interior painting labor and materials",
      amount: 2480,
      classification: "repair or maintenance",
      category: "interior painting",
      documentationStatus: "receipt attached",
      notes: "Temporary sample expense linked to interior painting.",
    },
    {
      id: "temp_sample_expense_exterior_deposit",
      propertyId,
      projectId: "temp_sample_project_exterior_paint",
      date: "2024-06-03",
      vendor: "Evergreen Exterior Finish",
      description: "Exterior painting deposit",
      amount: 1500,
      classification: "unclear / ask CPA",
      category: "exterior painting",
      documentationStatus: "needs follow-up",
      notes: "Temporary sample showing a follow-up item.",
    },
    {
      id: "temp_sample_expense_bathroom_tile",
      propertyId,
      projectId: "temp_sample_project_bathroom",
      date: "2023-09-28",
      vendor: "Harbor Bath & Tile",
      description: "Bathroom tile, waterproofing, vanity, and fixture installation",
      amount: 14875.5,
      classification: "potential basis addition",
      category: "bathroom",
      documentationStatus: "invoice attached",
      notes: "Temporary sample expense linked to invoice and permit records.",
    },
    {
      id: "temp_sample_expense_deck_estimate",
      propertyId,
      projectId: "temp_sample_project_deck",
      date: "2025-03-10",
      vendor: "Cedarline Carpentry",
      description: "Deck repair estimate",
      amount: 0,
      classification: "unclear / ask CPA",
      category: "deck/patio/porch",
      documentationStatus: "no document yet",
      notes: "Temporary sample estimate with no payment yet.",
    },
    {
      id: "temp_sample_expense_hvac",
      propertyId,
      projectId: "temp_sample_project_hvac",
      date: "2022-11-04",
      vendor: "Summit Heating & Air",
      description: "Heat pump equipment and installation",
      amount: 18720,
      classification: "potential basis addition",
      category: "HVAC",
      documentationStatus: "invoice attached",
      notes: "Temporary high-value equipment sample.",
    },
  ];
}

function createTemporarySampleDocuments(propertyId) {
  return [
    {
      id: "temp_sample_document_interior_receipt",
      propertyId,
      projectId: "temp_sample_project_interior_paint",
      expenseId: "temp_sample_expense_interior_paint",
      displayName: "Sample interior painting receipt",
      documentType: "receipt",
      addedDate: "2024-02-13",
      notes: "Temporary sample document record. No file is stored.",
      ocrText: "Sample receipt: interior painting labor and materials.",
      hasFile: false,
      fileStatusNote: "Temporary sample record; no file copy is stored.",
    },
    {
      id: "temp_sample_document_bathroom_invoice",
      propertyId,
      projectId: "temp_sample_project_bathroom",
      expenseId: "temp_sample_expense_bathroom_tile",
      displayName: "Sample bathroom remodel invoice",
      documentType: "invoice",
      addedDate: "2023-10-20",
      notes: "Temporary sample invoice metadata.",
      ocrText: "Sample invoice: bathroom tile, waterproofing, vanity, fixtures, and labor.",
      hasFile: false,
      fileStatusNote: "Temporary sample record; no file copy is stored.",
    },
    {
      id: "temp_sample_document_bathroom_permit",
      propertyId,
      projectId: "temp_sample_project_bathroom",
      expenseId: "",
      displayName: "Sample bathroom permit",
      documentType: "permit",
      addedDate: "2023-09-12",
      notes: "Temporary sample permit record.",
      ocrText: "Sample permit TMP-BATH-2309.",
      hasFile: false,
      fileStatusNote: "Temporary sample record; no file copy is stored.",
    },
    {
      id: "temp_sample_document_deck_estimate",
      propertyId,
      projectId: "temp_sample_project_deck",
      expenseId: "temp_sample_expense_deck_estimate",
      displayName: "Sample deck repair estimate",
      documentType: "contract",
      addedDate: "2025-03-10",
      notes: "Temporary sample estimate/contract record.",
      ocrText: "Sample estimate: deck boards, railing, stair stringer reinforcement.",
      hasFile: false,
      fileStatusNote: "Temporary sample record; no file copy is stored.",
    },
    {
      id: "temp_sample_document_hvac_warranty",
      propertyId,
      projectId: "temp_sample_project_hvac",
      expenseId: "temp_sample_expense_hvac",
      displayName: "Sample heat pump warranty",
      documentType: "warranty",
      addedDate: "2022-11-05",
      notes: "Temporary sample warranty record.",
      ocrText: "Sample warranty: heat pump equipment registration.",
      hasFile: false,
      fileStatusNote: "Temporary sample record; no file copy is stored.",
    },
    {
      id: "temp_sample_document_exterior_photo",
      propertyId,
      projectId: "temp_sample_project_exterior_paint",
      expenseId: "",
      displayName: "Sample exterior before photos",
      documentType: "photo",
      addedDate: "2024-06-03",
      notes: "Temporary sample photo record.",
      ocrText: "",
      hasFile: false,
      fileStatusNote: "Temporary sample record; no file copy is stored.",
    },
  ];
}

function renderNextActionsPanel(readiness) {
  const actions = [
    data.properties.length ? "" : "Add your first property record.",
    data.projects.length ? "" : "Add an improvement project.",
    data.expenses.length ? "" : "Record an expense or receipt.",
    data.documents.length ? "" : "Attach a receipt, permit, invoice, photo, or contract.",
    readiness.followUps[0] || "",
  ].filter(Boolean).slice(0, 4);

  return `
    <section class="panel next-actions-panel">
      ${renderPanelHeader("Next suggested actions", "Small steps that make the binder easier to review later.", "clipboard")}
      ${actions.length ? `
        <div class="safety-list action-list">
          ${actions.map((item) => `
            <div>
              <strong>${escapeHtml(item)}</strong>
              <span>Keep the record simple now; you can add supporting details later.</span>
            </div>
          `).join("")}
        </div>
      ` : renderEmpty("No immediate suggestions", "Your core records are in good shape. Keep adding receipts, project notes, and supporting documents as you collect them.")}
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
            <progress class="readiness-meter" value="${clampPercent(summary.readinessScore)}" max="100" aria-label="Review readiness ${clampPercent(summary.readinessScore)}%"></progress>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderWorkspaceControls() {
  return "";
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function renderTutorialModeBanner() {
  if (!isTutorialMode()) return "";
  const guideButton = activeTab === "tutorial"
    ? ""
    : `<button class="button button-secondary" data-action="open-tutorial-step" data-tutorial-tab="tutorial" type="button">View guide</button>`;

  return `
    <section class="tutorial-banner print-hidden">
      <div>
        <p class="eyebrow">Sample data only</p>
        <h2>Tutorial Workspace</h2>
        <p>These records are temporary. They do not save to your real Home Basis Tracker records, and file attachments are simulated here.</p>
      </div>
      <div class="tutorial-banner-actions">
        ${guideButton}
        <button class="button button-secondary" data-action="reset-tutorial" type="button">Reset sample data</button>
        <button class="button button-primary" data-action="exit-tutorial" type="button">Return to binder</button>
      </div>
    </section>
  `;
}

function renderTutorialView() {
  const intro = isTutorialMode()
    ? ""
    : renderPageIntro({
      eyebrow: "Tutorial Workspace",
      title: "Learn the app with sample records",
      description: "Open a separate sample-data workspace to learn every major workflow before entering your own records.",
      actions: `<button class="button button-primary" data-action="start-tutorial" type="button">Start tutorial workspace</button>`,
    });

  return `
    <div class="page-stack">
      ${intro}
      ${renderNotice(isTutorialMode()
        ? "Changes stay in memory until you exit, reset, or close this app window."
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
        ${renderPanelHeader("How separation works", "The tutorial is a sandbox for practice.", "home")}
        <div class="safety-list">
          <div>
            <strong>Your binder starts empty</strong>
            <span>Sample records appear only after you open the tutorial.</span>
          </div>
          <div>
            <strong>Edits are temporary</strong>
            <span>Add, edit, and delete sample records freely. Reset brings the tutorial back to its starting state.</span>
          </div>
          <div>
            <strong>Files are simulated</strong>
            <span>Choosing a file in tutorial mode records sample metadata only.</span>
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
        description: "Keep each home profile connected to its projects, expenses, documents, and notes.",
        actions: `
          <button class="button button-primary" data-action="add-property" type="button"><span aria-hidden="true">+</span>Add property</button>
        `,
      })}
      <div class="content-grid">
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
                <div class="summary-title-row">
                  ${renderEditablePropertyField(selectedProperty, "name", "Property name", selectedProperty.name)}
                </div>
                <dl class="detail-list">
                  ${renderEditablePropertyField(selectedProperty, "address", "Address", selectedProperty.address || "Not added")}
                  ${renderEditablePropertyField(selectedProperty, "purchaseDate", "Purchase date", formatDate(selectedProperty.purchaseDate))}
                  ${renderEditablePropertyField(selectedProperty, "purchasePrice", "Purchase price", selectedProperty.purchasePrice ? formatCurrency(selectedProperty.purchasePrice) : "Not added")}
                  ${detailItem("Projects", propertyProjects.length)}
                  ${detailItem("Tracked expenses", formatCurrency(totals.total))}
                  ${detailItem("Documents", propertyDocuments.length)}
                </dl>
                ${selectedProperty.notes ? renderEditablePropertyField(selectedProperty, "notes", "Notes", selectedProperty.notes) : ""}
                <div class="record-action-row">
                  <button class="button button-secondary" data-action="add-project" data-property-id="${escapeAttr(selectedProperty.id)}" type="button"><span aria-hidden="true">+</span>Add project</button>
                  <button class="button button-secondary" data-action="add-expense" type="button"><span aria-hidden="true">+</span>Add expense</button>
                  <button class="button button-secondary" data-action="add-document" type="button"><span aria-hidden="true">+</span>Add document</button>
                </div>
                <div class="property-danger-zone">
                  <button class="button button-danger" data-action="delete-property" data-id="${escapeAttr(selectedProperty.id)}" type="button">Delete property</button>
                </div>
              </div>
            ` : ""}
          ` : renderEmpty("No property yet", "Start with the home these records belong to.")}
        </section>
        ${selectedProperty ? renderPropertyFileOverview(selectedProperty, propertyProjects, propertyExpenses, propertyDocuments) : ""}
      </div>
      ${propertyMode === "view" ? "" : renderPropertyFormModal(propertyMode === "edit" ? selectedProperty : null)}
    </div>
  `;
}

function renderPropertyFileOverview(property, projects, expenses, documents) {
  const totals = getExpenseTotals(expenses);
  const gaps = getDocumentationAttentionExpenses(expenses).slice(0, 4);
  const recentExpenses = sortByDateDesc(expenses).slice(0, 4);
  const recentDocuments = sortDocumentsByAddedDateDesc(documents).slice(0, 4);
  const openProjects = projects.filter((project) => !["completed", "archived"].includes(project.status));

  return `
    <section class="panel property-file-panel">
      ${renderPanelHeader(`${property.name} file`, "Linked projects, costs, documents, and open record gaps.", "clipboard")}
      <div class="property-file-grid">
        ${storageMetric("Tracked spend", formatCurrency(totals.total))}
        ${storageMetric("Potential basis", formatCurrency(totals.potential))}
        ${storageMetric("Open projects", openProjects.length)}
        ${storageMetric("Documents", documents.length)}
      </div>
      <div class="property-file-sections">
        <div>
          <h3>Linked projects</h3>
          ${projects.length ? `
            <ul class="record-chip-list">
              ${projects.slice(0, 5).map((project) => `<li><strong>${escapeHtml(project.name)}</strong><span>${escapeHtml(optionLabel(PROJECT_STATUSES, project.status))} / ${escapeHtml(optionLabel(EXPENSE_CATEGORIES, project.category))}</span></li>`).join("")}
            </ul>
          ` : renderEmpty("No projects yet", "Add projects to group related work.")}
        </div>
        <div>
          <h3>Recent expenses</h3>
          ${recentExpenses.length ? `
            <ul class="record-chip-list">
              ${recentExpenses.map((expense) => `<li><strong>${escapeHtml(getExpenseVendorName(data, expense))}</strong><span>${escapeHtml(expense.description)} / ${formatCurrency(expense.amount)}</span></li>`).join("")}
            </ul>
          ` : renderEmpty("No expenses yet", "Add costs as receipts or notes arrive.")}
        </div>
        <div>
          <h3>Documents</h3>
          ${recentDocuments.length ? `
            <ul class="record-chip-list">
              ${recentDocuments.map((document) => `<li><strong>${escapeHtml(document.displayName)}</strong><span>${escapeHtml(optionLabel(DOCUMENT_TYPES, document.documentType))} / ${document.hasFile ? "File stored" : "Needs file"}</span></li>`).join("")}
            </ul>
          ` : renderEmpty("No documents yet", "Attach receipts, permits, invoices, photos, or notes.")}
        </div>
        <div>
          <h3>Record gaps</h3>
          ${gaps.length ? `
            <ul class="record-chip-list compact-followups">
              ${gaps.map((expense) => `<li><strong>${escapeHtml(getExpenseVendorName(data, expense))}</strong><span>${escapeHtml(getExpenseDocumentationIssue(expense))}</span></li>`).join("")}
            </ul>
          ` : `<p class="helper-note">No open documentation gaps for this property.</p>`}
        </div>
      </div>
    </section>
  `;
}

function renderProjectsView() {
  const filteredProjects = getFilteredProjects();
  const editingProject = editingProjectId === null ? null : data.projects.find((project) => project.id === editingProjectId);
  const hasProjectsForCurrentFilters = data.projects.some((project) => {
    if (projectFilters.propertyId !== EMPTY_FILTER && project.propertyId !== projectFilters.propertyId) return false;
    return true;
  });

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Projects",
        title: "Renovation and improvement projects",
        description: "Track project dates, contractors, permits, notes, expenses, and supporting documents in one place.",
        actions: `
          <button class="button button-secondary" data-action="manage-vendors" type="button">Manage vendors</button>
          <button class="button button-primary" data-action="add-project" ${data.properties.length ? "" : "disabled"} type="button"><span aria-hidden="true">+</span>Add project</button>
        `,
      })}
      ${data.properties.length ? "" : renderEmpty("Add a property first", "Projects need a property so totals and exports stay organized.")}
      <section class="panel">
        ${renderPanelHeader("Project list", "", "folder", filteredProjects.length ? renderProjectExpansionActions(filteredProjects) : "")}
        <div class="filter-bar">
          ${renderFilter("Property", "project.propertyId", projectFilters.propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })))}
          ${renderFilter("Status", "project.status", projectFilters.status, PROJECT_STATUSES)}
          ${renderFilter("Category", "project.category", projectFilters.category, EXPENSE_CATEGORIES)}
        </div>
        ${filteredProjects.length
          ? renderProjectsTable(filteredProjects)
          : hasProjectsForCurrentFilters
            ? renderEmpty("No matching projects", "Adjust the status or category filters.")
            : data.properties.length
              ? renderEmpty("No projects yet", "Add your first project when you are ready to organize an improvement.")
              : renderEmpty("No property yet", "Add a property before creating projects.")}
      </section>
      ${editingProjectId !== undefined ? renderProjectFormModal(editingProject || null) : ""}
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
          <p>${activeVendors.length} vendor${activeVendors.length === 1 ? "" : "s"} available for project and expense records.</p>
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
      ` : renderEmpty("No vendors yet", "Add a vendor before linking new project and expense records. Existing payee text will be migrated automatically when present.")}
    </div>
  `;
}

function getFilteredProjects() {
  return data.projects.filter((project) => {
    if (projectFilters.propertyId !== EMPTY_FILTER && project.propertyId !== projectFilters.propertyId) return false;
    if (projectFilters.status !== EMPTY_FILTER && project.status !== projectFilters.status) return false;
    if (projectFilters.category !== EMPTY_FILTER && project.category !== projectFilters.category) return false;
    return true;
  });
}

function renderProjectExpansionActions(filteredProjects) {
  const expandedCount = filteredProjects.filter((project) => expandedProjectIds.has(project.id)).length;
  return `
    <button class="button button-secondary" data-action="expand-all-projects" type="button" ${expandedCount === filteredProjects.length ? "disabled" : ""}>Expand all</button>
    <button class="button button-secondary" data-action="collapse-all-projects" type="button" ${expandedCount === 0 ? "disabled" : ""}>Collapse all</button>
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
        description: "Connect each cost record to the right property, project, category, and supporting receipt or invoice.",
        actions: `<button class="button button-primary" data-action="add-expense" ${data.properties.length ? "" : "disabled"} type="button"><span aria-hidden="true">+</span>Add expense</button>`,
      })}
      ${data.properties.length ? "" : renderEmpty("Add a property first", "Expense records need a property so totals and exports stay organized.")}
      ${renderMetrics([
        ["Filtered total", formatCurrency(totals.total), ""],
        ["Marked potential basis additions", formatCurrency(totals.potential), "green"],
        ["Repair/maintenance", formatCurrency(totals.repair), "rust"],
        ["Needs professional review", formatCurrency(totals.unclear), "amber"],
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
          ${renderFilter("Expense type", "expense.classification", expenseFilters.classification, CLASSIFICATIONS)}
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
  const documentationGaps = sortByDateDesc(getDocumentationAttentionExpenses(data.expenses).filter((expense) => {
    if (documentFilters.propertyId !== EMPTY_FILTER && expense.propertyId !== documentFilters.propertyId) return false;
    return true;
  }));
  const filteredDocuments = data.documents.filter((document) => {
    if (documentFilters.propertyId !== EMPTY_FILTER && document.propertyId !== documentFilters.propertyId) return false;
    if (documentFilters.documentType !== EMPTY_FILTER && document.documentType !== documentFilters.documentType) return false;
    if (documentFilters.fileStatus !== EMPTY_FILTER && getDocumentFileStatus(document) !== documentFilters.fileStatus) return false;
    return true;
  });
  const sortedDocuments = sortDocumentsByAddedDateDesc(filteredDocuments);
  const documentFollowUps = sortDocumentsByAddedDateDesc(data.documents.filter((document) => {
    if (documentFilters.propertyId !== EMPTY_FILTER && document.propertyId !== documentFilters.propertyId) return false;
    return getDocumentFileStatus(document) !== "stored";
  }));
  const hasDocumentsForCurrentProperty = data.documents.some((document) =>
    documentFilters.propertyId === EMPTY_FILTER || document.propertyId === documentFilters.propertyId
  );
  const editingDocument = editingDocumentId === null ? null : data.documents.find((document) => document.id === editingDocumentId);

  return `
    <div class="page-stack">
      ${renderPageIntro({
        eyebrow: "Document checklist",
        title: "Receipts and supporting documents",
        description: "Build a home record library for receipts, invoices, permits, photos, warranties, contracts, and payment records.",
        actions: `<button class="button button-primary" data-action="add-document" ${data.properties.length ? "" : "disabled"} type="button"><span aria-hidden="true">+</span>Add document</button>`,
      })}
      ${renderNotice("Attach receipts, invoices, permits, before/after photos, and payment records as you collect them.")}
      ${data.properties.length ? "" : renderEmpty("Add a property first", "Documents need a property so they can be included with the right home records.")}
      ${data.properties.length ? renderDocumentCenterSummary(readiness) : ""}
      ${data.properties.length ? renderDocumentSubTabs(sortedDocuments.length, documentationGaps.length, documentFollowUps.length) : ""}
      ${editingDocumentId !== undefined ? `
        <section class="panel">
          ${renderPanelHeader(editingDocument ? "Edit document" : "Add document", "Save a display name, document type, and optional file. File paths are removed from notes.", "edit", `<button class="icon-button" data-action="close-document-form" type="button" aria-label="Close">×</button>`)}
          ${renderDocumentForm(editingDocument || null)}
        </section>
      ` : ""}
      ${data.properties.length && documentSubTab === DOCUMENT_TAB_LIBRARY ? `
        <section class="panel">
          ${renderPanelHeader("All documents", "Receipts, invoices, permits, photos, warranties, contracts, and notes in one place.", "document")}
          <div class="filter-bar document-filters">
            ${renderFilter("Property", "document.propertyId", documentFilters.propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })))}
            ${renderFilter("Type", "document.documentType", documentFilters.documentType, DOCUMENT_TYPES)}
            ${renderFilter("File", "document.fileStatus", documentFilters.fileStatus, DOCUMENT_FILE_FILTERS)}
          </div>
          ${sortedDocuments.length
            ? renderDocumentList(sortedDocuments)
            : data.properties.length
              ? data.documents.length && hasDocumentsForCurrentProperty
                ? renderEmpty("No matching documents", "Adjust the document filters to see more records.")
                : renderEmpty("No documents yet", "Add a simple record for receipts, invoices, permits, photos, or contracts.")
              : renderEmpty("No property yet", "Add a property before attaching documents.")}
        </section>
      ` : ""}
      ${data.properties.length && documentSubTab === DOCUMENT_TAB_FOLLOW_UP ? renderDocumentFollowUpTab(documentationGaps, documentFollowUps) : ""}
    </div>
  `;
}

function renderDocumentSubTabs(documentCount, expenseFollowUpCount, fileFollowUpCount) {
  return `
    <div class="sub-tabs" role="tablist" aria-label="Document views">
      <button
        aria-selected="${documentSubTab === DOCUMENT_TAB_LIBRARY}"
        class="${documentSubTab === DOCUMENT_TAB_LIBRARY ? "is-active" : ""}"
        data-action="set-document-subtab"
        data-document-subtab="${DOCUMENT_TAB_LIBRARY}"
        role="tab"
        type="button"
      >All documents <span>${documentCount}</span></button>
      <button
        aria-selected="${documentSubTab === DOCUMENT_TAB_FOLLOW_UP}"
        class="${documentSubTab === DOCUMENT_TAB_FOLLOW_UP ? "is-active" : ""}"
        data-action="set-document-subtab"
        data-document-subtab="${DOCUMENT_TAB_FOLLOW_UP}"
        role="tab"
        type="button"
      >Needs follow-up <span>${expenseFollowUpCount} expense${expenseFollowUpCount === 1 ? "" : "s"}</span><span>${fileFollowUpCount} file${fileFollowUpCount === 1 ? "" : "s"}</span></button>
    </div>
  `;
}

function renderDocumentFollowUpTab(documentationGaps, documentFollowUps) {
  return `
    <section class="panel">
      ${renderPanelHeader("Needs follow-up", "Expense documentation gaps and document file follow-ups are listed separately.", "alert")}
      <div class="filter-bar document-followup-filters">
        ${renderFilter("Property", "document.propertyId", documentFilters.propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })))}
      </div>
      <div class="document-followup-summary">
        ${storageMetric("Expense documentation gaps", documentationGaps.length)}
        ${storageMetric("Document file follow-ups", documentFollowUps.length)}
      </div>
      <div class="document-followup-grid">
        <div>
          <h3>Expense documentation</h3>
          ${documentationGaps.length
            ? renderDocumentationGapsTable(documentationGaps)
            : renderEmpty("No expense documentation follow-ups", "Missing documents and attached statuses without linked stored files will appear here.")}
        </div>
        <div>
          <h3>Document files</h3>
          ${documentFollowUps.length
            ? renderDocumentList(documentFollowUps, { compactActions: true })
            : renderEmpty("No document file follow-ups", "Every matching document record has a stored file attached.")}
        </div>
      </div>
    </section>
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
      ${renderPanelHeader("Document center", "Coverage, linked records, and document gaps.", "document")}
      <div class="document-center-grid">
        ${storageMetric("Stored files", readiness.storedDocuments.length)}
        ${storageMetric("Document records", data.documents.length)}
        ${storageMetric("Linked records", linkedDocumentCount)}
        ${storageMetric("Needs file follow-up", readiness.documentsWithoutFiles.length)}
        ${storageMetric("Expense document gaps", readiness.expensesMissingLinkedEvidence.length)}
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
        description: "Create professional review exports from saved records, then keep a separate private backup for yourself.",
      })}
      ${renderCpaExportPanel()}
      ${renderBackupRestorePanel()}
      ${renderDataSafetyPanel()}
      ${renderStorageHealthPanel()}
      ${renderReviewSummaryPreview(totals, readiness, documentationGaps)}
    </div>
  `;
}

function renderReviewSummaryPreview(totals, readiness, documentationGaps) {
  return `
    <details class="panel print-summary export-preview-panel">
      <summary>
        <span>
          <strong>Detailed review summary preview</strong>
          <small>Prepared ${formatDate(todayISO())}. Expand only when you want to inspect the full packet content.</small>
        </span>
      </summary>
      <p class="helper-note print-caveat">For record review only. Home Basis Tracker does not determine tax treatment.</p>
      ${renderMetrics([
        ["Total tracked spend", formatCurrency(totals.total), ""],
        ["Marked potential basis additions", formatCurrency(totals.potential), "green"],
        ["Repair/maintenance", formatCurrency(totals.repair), "rust"],
        ["Needs professional review", formatCurrency(totals.unclear), "amber"],
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
        ${data.documents.length ? renderExportDocumentsTable() : renderEmpty("No documents to export", "Add documents to include file metadata in the printable summary.")}
      </div>
    </details>
  `;
}

function renderDataSafetyPanel() {
  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("Backup notes", "Keep a copy of anything important.", "home")}
      <div class="safety-list">
        <div>
          <strong>Full backups may include files</strong>
          <span>Backup JSON files can include receipts, invoices, photos, and notes.</span>
        </div>
        <div>
          <strong>Keep backups private</strong>
          <span>Store backup files somewhere you are comfortable keeping home records.</span>
        </div>
        <div>
          <strong>Restore with care</strong>
          <span>Restoring a backup replaces the current workspace after confirmation.</span>
        </div>
        <div>
          <strong>Check file follow-ups</strong>
          <span>After restore, review any documents marked as missing file content.</span>
        </div>
      </div>
    </section>
  `;
}

function renderCpaExportPanel() {
  const hasReviewRecords = data.properties.length || data.expenses.length || data.documents.length;
  const pdfLabel = isDesktopMode()
    ? isTutorialMode() ? "Save tutorial review PDF" : "Save professional review PDF"
    : "Print / save PDF";
  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("Create review packet", isTutorialMode()
        ? "Exports use tutorial sample records only, not your real binder."
        : "Create a polished review PDF and a spreadsheet-ready expense export from saved records.", "clipboard")}
      <div class="backup-actions">
        <button class="button button-secondary" data-action="print-summary" type="button"><span aria-hidden="true">⎙</span>Print review summary</button>
        <button class="button button-primary" data-action="download-cpa-pdf" ${hasReviewRecords ? "" : "disabled"} type="button"><span aria-hidden="true">↓</span>${pdfLabel}</button>
        <button class="button button-secondary" data-action="download-csv" ${data.expenses.length ? "" : "disabled"} type="button"><span aria-hidden="true">↓</span>${isTutorialMode() ? "Download tutorial expense CSV" : "Download expense CSV"}</button>
      </div>
      <p class="helper-note">The review packet is for homeowner reference and professional review. The CSV stays spreadsheet-friendly and does not include attached file contents.</p>
    </section>
  `;
}

function renderStorageHealthPanel() {
  const attachedDocuments = data.documents.filter((document) => document.hasFile);
  const attachedFileSize = attachedDocuments.reduce((total, document) => total + (Number(document.fileSize) || 0), 0);

  return `
    <section class="panel print-hidden">
      ${renderPanelHeader("Record counts", "Current records and attached file size.", "document")}
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
      ${renderPanelHeader(isTutorialMode() ? "Tutorial backup and restore" : "For your backup", isTutorialMode()
        ? "Create or restore sample backup files inside this temporary tutorial workspace only."
        : "Create a private backup for your own records, or restore one you saved earlier.", "clipboard")}
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
  if (["scopeSummary", "notes"].includes(fieldName)) {
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

function renderProjectForm(project) {
  const vendorId = project?.vendorId || "";
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
        ${selectField("Primary vendor", "vendorId", vendorId, getVendorSelectOptions({ includeArchived: true }))}
        ${field("Permit number", "permitNumber", project?.permitNumber || "", { placeholder: "Optional permit or approval number" })}
      </div>
      <p class="helper-note">Add vendors once, then reuse them across projects and expenses. Leave this unassigned if you are still gathering details. <button class="inline-text-button" data-action="add-vendor" type="button">Add vendor</button></p>
      ${textarea("Project description", "scopeSummary", project?.scopeSummary || "")}
      ${textarea("Notes", "notes", project?.notes || "")}
      ${formActions("Save project")}
    </form>
  `;
}

function getVendorSelectOptions({ includeArchived = false } = {}) {
  return data.vendors
    .filter((vendor) => includeArchived || vendor.status !== "archived")
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

function renderExpenseForm(expense) {
  const draftProject = !expense && draftExpenseProjectId
    ? data.projects.find((project) => project.id === draftExpenseProjectId)
    : null;
  const propertyId = expense?.propertyId || draftProject?.propertyId || selectedPropertyId || data.properties[0]?.id || "";
  const projectOptions = data.projects.filter((project) => project.propertyId === propertyId);
  const projectId = expense?.projectId || draftProject?.id || "";
  const vendorId = expense?.vendorId || draftProject?.vendorId || "";

  return `
    <form class="form-grid" data-form="expense" novalidate>
      <input type="hidden" name="id" value="${escapeAttr(expense?.id || "")}">
      <div class="form-row">
        ${selectField("Property", "propertyId", propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })), false)}
        ${selectField("Project", "projectId", projectId, projectOptions.map((project) => ({ value: project.id, label: project.name })))}
      </div>
      <div class="form-row">
        ${field("Date", "date", expense?.date || todayISO(), { type: "date", required: true })}
        ${field("Amount", "amount", expense?.amount || "", { type: "number", step: "0.01", placeholder: "0.00", required: true })}
      </div>
      <div class="form-row">
        ${selectField("Vendor/payee", "vendorId", vendorId, getVendorSelectOptions({ includeArchived: true }))}
        ${field("Description", "description", expense?.description || "", { placeholder: "Roof repair, dishwasher install, permit fee", required: true })}
      </div>
      <p class="helper-note">Expenses use shared vendors. Choose Unassigned / unknown only when you need to capture the cost before the payee is clear. <button class="inline-text-button" data-action="add-vendor" type="button">Add vendor</button></p>
      <div class="form-row">
        ${selectField("Expense type", "classification", expense?.classification || "unclear / ask CPA", CLASSIFICATIONS, false)}
        ${selectField("Category", "category", expense?.category || "other", EXPENSE_CATEGORIES, false)}
      </div>
      <p class="helper-note">Examples: roof replacement or an addition might be a potential basis addition; a service visit or small repair might be repair/maintenance. Use professional review when you want a qualified professional to decide.</p>
      ${selectField("Documentation status", "documentationStatus", expense?.documentationStatus || "no document yet", DOCUMENT_STATUSES, false)}
      <p class="helper-note">Use your best guess for sorting only. A qualified professional should make the final call.</p>
      ${textarea("Notes", "notes", expense?.notes || "")}
      ${formActions("Save expense")}
    </form>
  `;
}

function renderDocumentForm(document) {
  const draftExpense = !document && draftDocumentExpenseId
    ? data.expenses.find((expense) => expense.id === draftDocumentExpenseId)
    : null;
  const draftProject = !document && !draftExpense && draftDocumentProjectId
    ? data.projects.find((project) => project.id === draftDocumentProjectId)
    : null;
  const propertyId = draftExpense?.propertyId || document?.propertyId || draftProject?.propertyId || selectedPropertyId || data.properties[0]?.id || "";
  const projectOptions = data.projects.filter((project) => project.propertyId === propertyId);
  const expenseOptions = data.expenses.filter((expense) => expense.propertyId === propertyId);
  const selectedExpenseId = document?.expenseId || draftExpense?.id || "";
  const selectedProjectId = draftExpense?.projectId || document?.projectId || draftProject?.id || "";
  const fileHelper = document?.hasFile
    ? `Current file: ${document.fileName || "Attached file"} (${formatFileSize(document.fileSize)}). Choose a new file to replace it.`
    : isTutorialMode()
      ? "Choosing a file in tutorial mode records sample metadata only. No file copy is saved."
      : "Choose a receipt, invoice, permit, photo, or related file.";

  return `
    <form class="form-grid" data-form="document" enctype="multipart/form-data" novalidate>
      <input type="hidden" name="id" value="${escapeAttr(document?.id || "")}">
      ${selectField("Related expense", "expenseId", selectedExpenseId, expenseOptions.map((expense) => ({ value: expense.id, label: `${formatDate(expense.date)} / ${getExpenseVendorName(data, expense)} / ${formatCurrency(expense.amount)}` })))}
      <p class="helper-note">Choosing an expense sets the property and project for this document.</p>
      <div class="form-row">
        ${selectField("Property", "propertyId", propertyId, data.properties.map((property) => ({ value: property.id, label: property.name })), false)}
        ${selectField("Document type", "documentType", document?.documentType || "receipt", DOCUMENT_TYPES, false)}
      </div>
      ${field("Display name", "displayName", document?.displayName || "", { required: true })}
      ${selectField("Project", "projectId", selectedProjectId, projectOptions.map((project) => ({ value: project.id, label: project.name })))}
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
  return `
    <div class="recent-record-list">
      ${expenses.map((expense) => `
        <article class="recent-record-card">
          <div>
            <span>${formatDate(expense.date)}</span>
            <strong>${escapeHtml(getExpenseVendorName(data, expense))}</strong>
            <small>${escapeHtml(expense.description)}</small>
          </div>
          <div>
            ${classificationPill(expense.classification)}
            <strong class="money">${formatCurrency(expense.amount)}</strong>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderProjectsTable(projects) {
  return `
    <div class="project-card-list">
      ${projects.map((project) => {
        const isExpanded = expandedProjectIds.has(project.id);
        const projectExpenses = data.expenses.filter((expense) => expense.projectId === project.id);
        const projectDocuments = data.documents.filter((document) => document.projectId === project.id);
        const totals = getExpenseTotals(projectExpenses);
        const completeness = getProjectTabCompleteness(getProjectCompleteness(data, project));
        return `
          <article class="project-file-card ${isExpanded ? "is-expanded" : ""}">
            <div class="project-file-main">
              <div>
                <button class="table-link project-title-button" data-action="select-project" data-id="${escapeAttr(project.id)}" aria-expanded="${isExpanded ? "true" : "false"}" type="button">${escapeHtml(project.name)}</button>
                <p>${escapeHtml(getPropertyName(data, project.propertyId))}</p>
              </div>
              <div class="project-file-actions">
                ${projectRowActions(project)}
              </div>
            </div>
            <div class="project-file-meta">
              <span class="pill tone-blue">${escapeHtml(optionLabel(PROJECT_STATUSES, project.status))}</span>
              <span>${escapeHtml(optionLabel(EXPENSE_CATEGORIES, project.category))}</span>
              <span>${escapeHtml(formatProjectDateRange(project))}</span>
              <span>${escapeHtml(getProjectVendorName(data, project))}</span>
            </div>
            <div class="project-file-stats">
              ${storageMetric("Expenses", `${projectExpenses.length} / ${formatCurrency(totals.total)}`)}
              ${storageMetric("Documents", projectDocuments.length)}
              ${storageMetric("Completeness", `${completeness.score}%`)}
            </div>
            ${isExpanded ? `<div class="project-card-detail">${renderProjectDetail(project)}</div>` : ""}
          </article>
        `;
      }).join("")}
    </div>
  `;
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
    <div class="expense-record-list">
      ${expenses.map((expense) => `
        <article class="expense-record-card">
          <div class="expense-record-main">
            <div>
              <p class="record-date">${formatDate(expense.date)}</p>
              <h3>${escapeHtml(getExpenseVendorName(data, expense))}</h3>
              <p>${escapeHtml(expense.description)}</p>
            </div>
            <strong class="record-amount">${formatCurrency(expense.amount)}</strong>
          </div>
          <div class="expense-record-meta">
            <span>${escapeHtml(getPropertyName(data, expense.propertyId))}</span>
            <span>${escapeHtml(getProjectName(data, expense.projectId))}</span>
          </div>
          <div class="expense-record-footer">
            <div class="expense-chip-row">
              ${classificationPill(expense.classification)}
              <span class="pill tone-blue">${escapeHtml(optionLabel(EXPENSE_CATEGORIES, expense.category))}</span>
              ${documentationPill(expense.documentationStatus)}
            </div>
            ${rowActions("edit-expense", "delete-expense", expense.id, expense.description)}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderDocumentationGapsTable(expenses) {
  return `
    <div class="followup-inbox-list">
      ${expenses.map((expense) => `
        <article class="followup-inbox-card">
          <div>
            <p class="record-date">${formatDate(expense.date)}</p>
            <h4>${escapeHtml(getExpenseVendorName(data, expense))}</h4>
            <p>${escapeHtml(expense.description)}</p>
          </div>
          <div class="followup-inbox-meta">
            ${documentationPill(expense.documentationStatus)}
            <span>${escapeHtml(getExpenseDocumentationIssue(expense))}</span>
            <strong>${formatCurrency(expense.amount)}</strong>
          </div>
          <div class="row-actions text-actions">
            <button class="text-action" data-action="add-document-for-expense" data-id="${escapeAttr(expense.id)}" type="button">Add document</button>
            <button class="text-action" data-action="edit-expense" data-id="${escapeAttr(expense.id)}" type="button">Edit</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function sortDocumentsByAddedDateDesc(documents) {
  return [...documents].sort((a, b) => String(b.addedDate || "").localeCompare(String(a.addedDate || "")));
}

function renderDocumentList(documents = data.documents, options = {}) {
  return `
    <div class="document-list">
      ${documents.map((document) => `
        <article class="document-card document-row-card">
          <span class="document-icon" aria-hidden="true">${iconSymbol(document.documentType === "photo" ? "image" : "document")}</span>
          <div class="document-body">
            <h3>${escapeHtml(document.displayName)}</h3>
            <p>${escapeHtml(optionLabel(DOCUMENT_TYPES, document.documentType))} · ${formatDate(document.addedDate)}</p>
            <p>${escapeHtml(getPropertyName(data, document.propertyId))}${document.projectId ? ` / ${escapeHtml(getProjectName(data, document.projectId))}` : ""}${document.expenseId ? ` / ${escapeHtml(getExpenseName(data, document.expenseId))}` : ""}</p>
            ${renderDocumentFileMeta(document)}
            ${document.notes ? `<p class="notes-block">${escapeHtml(document.notes)}</p>` : ""}
          </div>
          <div class="document-actions">
            ${document.hasFile ? `
              <button class="button button-primary" data-action="preview-document-file" data-id="${escapeAttr(document.id)}" type="button">View document</button>
              ${options.compactActions ? "" : `<button class="button button-secondary" data-action="download-document-file" data-id="${escapeAttr(document.id)}" type="button">Download file</button>`}
              ${options.compactActions ? "" : `<button class="button button-secondary" data-action="remove-document-file" data-id="${escapeAttr(document.id)}" type="button">Remove file</button>`}
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
      <span class="pill tone-green">File attached</span>
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
              <button class="button button-secondary" data-action="run-document-ocr" data-id="${escapeAttr(documentRecord.id)}" ${canReadText && documentPreview.ocrStatus !== "running" ? "" : "disabled"} type="button">Read text</button>
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
  if (documentPreview.ocrStatus === "done") return "Text saved with this document record.";
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
  const projectDocuments = data.documents.filter((document) => document.projectId === project.id);
  const projectExpenses = data.expenses.filter((expense) => expense.projectId === project.id);

  return `
    <div class="project-inline-detail">
      <div>
        <p class="eyebrow">Project file</p>
        <dl class="detail-list project-detail-list project-detail-grid">
          ${renderEditableProjectField(project, "scopeSummary", "Project description", project.scopeSummary || "Not added")}
          ${renderEditableProjectField(project, "notes", "Notes", project.notes || "Not added")}
          ${renderEditableProjectField(project, "permitNumber", "Permit number", project.permitNumber || "Not added")}
        </dl>
        ${renderLinkedProjectRecords(project, projectDocuments, projectExpenses)}
      </div>
      ${renderProjectCompletenessPanel(visibleCompleteness, project)}
    </div>
  `;
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
          <p class="eyebrow">Linked records</p>
          <h3>Supporting records for this project</h3>
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
        ? `<p class="helper-note">Use the Documents and Expenses tabs to review linked records in detail.</p>`
        : renderEmpty("No linked records yet", "Add a document or connect expenses when records are available.")}
    </div>
  `;
}

function renderProjectCompletenessPanel(completeness, project) {
  const readyItems = completeness.readyItems.slice(0, 5);
  const followUps = completeness.followUps.slice(0, 7);

  return `
    <div class="project-completeness">
      <div class="readiness-columns project-completeness-columns">
        <div>
          <h3>Core record status</h3>
          ${readyItems.length ? `
            <ul class="check-list">
              ${readyItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          ` : `<p class="helper-note">Add dates, project details, and documents to build project readiness.</p>`}
        </div>
        <div>
          <h3>Suggested next records</h3>
          ${followUps.length ? `
            <ul class="followup-list">
              ${followUps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          ` : `<p class="helper-note">No suggested project records right now.</p>`}
          <div class="project-document-action">
            <button class="button button-secondary" data-action="add-document" data-project-id="${escapeAttr(project.id)}" type="button"><span aria-hidden="true">+</span>Add document</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getProjectTabCompleteness(completeness) {
  const hiddenCheckLabels = new Set([
    "Cost records linked",
    "Receipt and invoice records linked",
    "Review classifications chosen",
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
      ...visibleExpectedDocumentTypes.map((item) => `Add a ${item.label.toLowerCase()} record if available or applicable.`),
    ].filter(Boolean),
    missingExpectedDocumentTypes: visibleExpectedDocumentTypes,
  };
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
  return table(["Project", "Property", "Status", "Completeness", "Dates", "Contractor", "Permit", "Spend", "Documents"], getProjectReviewSummaries(data).map((summary) => [
    `<strong>${escapeHtml(summary.project.name)}</strong><span>${summary.project.scopeSummary ? escapeHtml(summary.project.scopeSummary) : "Project description not added"}</span>`,
    escapeHtml(getPropertyName(data, summary.project.propertyId)),
    escapeHtml(optionLabel(PROJECT_STATUSES, summary.project.status)),
    `<span class="pill ${scoreToneClass(summary.completeness.score)}">${summary.completeness.score}%</span><span>${summary.completeness.completedChecks}/${summary.completeness.totalChecks} checks</span>`,
    escapeHtml(summary.dateRange),
    escapeHtml(getProjectVendorName(data, summary.project, "Not added")),
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
    escapeHtml(getExpenseVendorName(data, expense)),
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
    `<strong>${escapeHtml(getExpenseVendorName(data, expense))}</strong><span>${escapeHtml(expense.description)}</span>`,
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
      relatedExpense ? escapeHtml(`${getExpenseVendorName(data, relatedExpense)} / ${relatedExpense.description}`) : "No expense",
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
  } else if (action === "set-document-subtab") {
    documentSubTab = actionButton.dataset.documentSubtab === DOCUMENT_TAB_FOLLOW_UP ? DOCUMENT_TAB_FOLLOW_UP : DOCUMENT_TAB_LIBRARY;
    editingDocumentId = undefined;
    draftDocumentExpenseId = "";
    draftDocumentProjectId = "";
  } else if (action === "add-property") {
    activeTab = "property";
    propertyMode = "new";
    editingPropertyField = "";
  } else if (action === "edit-property-field") {
    editingPropertyField = actionButton.dataset.field || "";
  } else if (action === "cancel-property-field") {
    editingPropertyField = "";
  } else if (action === "delete-property") {
    await deleteProperty(id);
  } else if (action === "add-project") {
    if (actionButton.dataset.propertyId) {
      selectedPropertyId = actionButton.dataset.propertyId;
      projectFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
    }
    activeTab = "projects";
    editingProjectId = null;
    editingProjectField = "";
  } else if (action === "edit-project") {
    activeTab = "projects";
    selectedProjectId = id;
    expandedProjectIds.add(id);
    editingProjectId = id;
    editingProjectField = "";
  } else if (action === "edit-project-field") {
    editingProjectField = actionButton.dataset.field || "";
  } else if (action === "cancel-project-field") {
    editingProjectField = "";
  } else if (action === "select-project") {
    if (expandedProjectIds.has(id)) {
      expandedProjectIds.delete(id);
      if (selectedProjectId === id) selectedProjectId = "";
    } else {
      expandedProjectIds.add(id);
      selectedProjectId = id;
    }
    editingProjectId = undefined;
    editingProjectField = "";
  } else if (action === "expand-all-projects") {
    getFilteredProjects().forEach((project) => expandedProjectIds.add(project.id));
    editingProjectId = undefined;
    editingProjectField = "";
  } else if (action === "collapse-all-projects") {
    getFilteredProjects().forEach((project) => expandedProjectIds.delete(project.id));
    selectedProjectId = "";
    editingProjectId = undefined;
    editingProjectField = "";
  } else if (action === "delete-project") {
    await deleteProject(id);
  } else if (action === "manage-vendors") {
    vendorManagerOpen = true;
    editingVendorId = undefined;
  } else if (action === "close-vendor-manager") {
    vendorManagerOpen = false;
    editingVendorId = undefined;
  } else if (action === "add-vendor") {
    editingVendorId = null;
  } else if (action === "edit-vendor") {
    editingVendorId = id;
  } else if (action === "cancel-vendor-form") {
    editingVendorId = undefined;
  } else if (action === "add-expense") {
    draftExpenseProjectId = "";
    if (actionButton.dataset.projectId) {
      const project = data.projects.find((currentProject) => currentProject.id === actionButton.dataset.projectId);
      if (project) {
        selectedPropertyId = project.propertyId;
        selectedProjectId = project.id;
        draftExpenseProjectId = project.id;
        expenseFilters.propertyId = project.propertyId;
        expenseFilters.projectId = project.id;
      }
    }
    activeTab = "expenses";
    editingExpenseId = null;
  } else if (action === "edit-expense") {
    activeTab = "expenses";
    editingExpenseId = id;
    draftExpenseProjectId = "";
  } else if (action === "delete-expense") {
    await deleteExpense(id);
  } else if (action === "close-expense-form") {
    editingExpenseId = undefined;
    draftExpenseProjectId = "";
  } else if (action === "add-document") {
    documentSubTab = DOCUMENT_TAB_LIBRARY;
    draftDocumentProjectId = "";
    if (actionButton.dataset.projectId) {
      const project = data.projects.find((currentProject) => currentProject.id === actionButton.dataset.projectId);
      if (project) {
        selectedPropertyId = project.propertyId;
        selectedProjectId = project.id;
        documentFilters.propertyId = project.propertyId;
        draftDocumentProjectId = project.id;
      }
    }
    activeTab = "documents";
    editingDocumentId = null;
    draftDocumentExpenseId = "";
  } else if (action === "add-document-for-expense") {
    activeTab = "documents";
    documentSubTab = DOCUMENT_TAB_FOLLOW_UP;
    editingDocumentId = null;
    draftDocumentExpenseId = id;
    draftDocumentProjectId = "";
  } else if (action === "edit-document") {
    editingDocumentId = id;
    draftDocumentExpenseId = "";
    draftDocumentProjectId = "";
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
    draftDocumentProjectId = "";
  } else if (action === "open-export") {
    activeTab = "export";
  } else if (action === "download-csv") {
    const filename = isTutorialMode()
      ? `home-basis-tracker-tutorial-expense-export-${todayISO()}.csv`
      : `home-basis-tracker-expense-export-${todayISO()}.csv`;
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

function handleChange(event) {
  const control = event.target;
  if (control.matches("[data-restore-input]")) {
    void restoreFromBackupFile(control.files?.[0]);
    control.value = "";
    return;
  }

  const filter = control.dataset.filter;
  if (!filter) {
    if (control.closest('[data-form="expense"]') && ["propertyId", "projectId"].includes(control.name)) {
      syncExpenseProjectOptions(control);
    }
    if (control.closest('[data-form="document"]') && ["propertyId", "expenseId"].includes(control.name)) {
      syncDocumentRelationshipForm(control);
    }
    return;
  }

  if (filter === "selectedPropertyId") {
    selectedPropertyId = control.value;
    editingPropertyField = "";
    projectFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
    expenseFilters.propertyId = selectedPropertyId || EMPTY_FILTER;
    expenseFilters.projectId = EMPTY_FILTER;
    documentFilters.propertyId = EMPTY_FILTER;
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
    realData = withTemporarySampleRecords(event.newValue ? sanitizeData(JSON.parse(event.newValue)) : EMPTY_DATA);
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
  const vendorSelect = form.elements.vendorId;
  const currentProjectId = projectSelect.value;
  const propertyId = form.elements.propertyId.value;
  const projectOptions = data.projects.filter((project) => project.propertyId === propertyId);
  const selectedProjectId = projectOptions.some((project) => project.id === currentProjectId) ? currentProjectId : "";

  if (control.name === "propertyId") {
    projectSelect.innerHTML = `${optionHtml("", "No project", selectedProjectId)}${projectOptions.map((project) => optionHtml(project.id, project.name, selectedProjectId)).join("")}`;
  }
  const selectedProject = data.projects.find((project) => project.id === projectSelect.value && project.propertyId === propertyId);
  if (selectedProject?.vendorId && vendorSelect && !vendorSelect.value) {
    vendorSelect.value = selectedProject.vendorId;
  }
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
  if (formType === "property-field") await savePropertyField(values);
  if (formType === "vendor") await saveVendor(values);
  if (formType === "project") await saveProject(values);
  if (formType === "project-field") await saveProjectField(values);
  if (formType === "expense") await saveExpense(values);
  if (formType === "document") await saveDocument(values, formData.get("file"));
  if (formType === "document-preview-notes") await saveDocumentPreviewNotes(values);
  if (formType === "sale-scenario") saveSaleScenario(values);
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
  expandedProjectIds.add(project.id);
  projectFilters.propertyId = project.propertyId;
  if (expenseFilters.projectId === project.id && expenseFilters.propertyId !== EMPTY_FILTER && expenseFilters.propertyId !== project.propertyId) {
    expenseFilters.projectId = EMPTY_FILTER;
  }
  editingProjectId = undefined;
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
  } else if (["contractor", "permitNumber", "scopeSummary", "notes"].includes(fieldName)) {
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
  expandedProjectIds.add(nextProject.id);
  projectFilters.propertyId = nextProject.propertyId;
  if (expenseFilters.projectId === nextProject.id && expenseFilters.propertyId !== EMPTY_FILTER && expenseFilters.propertyId !== nextProject.propertyId) {
    expenseFilters.projectId = EMPTY_FILTER;
  }
  editingProjectField = "";
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
  draftExpenseProjectId = "";
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
  draftDocumentProjectId = "";
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
      : "Document and attached file saved."
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
  if (ocrPages) noticeParts.push(`${ocrPages} scanned PDF page${ocrPages === 1 ? "" : "s"} processed with OCR.`);
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
      readyCopy: "OCR can read supported image text.",
      startCopy: "Reading image... 0%",
      read: readImageDocumentText,
    };
  }
  if (isPdfFile(documentRecord, mimeType)) {
    return {
      readyCopy: "Searchable PDFs are fast; scanned PDFs can take a while.",
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
  if (!window.confirm("Delete this project? Related records will stay saved without this project.")) return;
  const saved = await updateData({
    ...data,
    projects: data.projects.filter((project) => project.id !== projectId),
    expenses: data.expenses.map((expense) => expense.projectId === projectId ? { ...expense, projectId: "" } : expense),
    documents: data.documents.map((document) => document.projectId === projectId ? { ...document, projectId: "" } : document),
  });
  if (!saved) return;
  if (selectedProjectId === projectId) selectedProjectId = "";
  expandedProjectIds.delete(projectId);
  if (expenseFilters.projectId === projectId) expenseFilters.projectId = EMPTY_FILTER;
  editingProjectId = undefined;
  editingProjectField = "";
  showNotice("Project deleted. Related records were kept.");
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

async function saveCpaReviewPdfFile() {
  if (!data.properties.length && !data.expenses.length && !data.documents.length) {
    showNotice("Add records before creating a professional review PDF.");
    return;
  }

  if (!isDesktopMode()) {
    showNotice("Use the browser print dialog to save the review summary as a PDF.");
    window.print();
    return;
  }

  const filename = isTutorialMode()
    ? `home-basis-tracker-tutorial-professional-review-${todayISO()}.pdf`
    : `home-basis-tracker-professional-review-${todayISO()}.pdf`;

  try {
    const result = await saveCpaReviewPdf(filename, buildCpaReviewPdfHtml(data));
    if (result?.canceled) {
      showNotice("Professional review PDF save canceled.");
      return;
    }
    showNotice(isTutorialMode() ? "Tutorial review PDF saved." : "Professional review PDF saved.");
  } catch (error) {
    showNotice(error?.message || "Professional review PDF could not be saved.");
  }
}

function buildCpaReviewPdfHtml(records) {
  const cleanData = sanitizeData(records);
  const totals = getExpenseTotals(cleanData.expenses);
  const readiness = getReviewReadiness(cleanData);
  const propertySummaries = getPropertyReviewSummaries(cleanData);
  const projectSummaries = getProjectReviewSummaries(cleanData);
  const documentationGaps = sortByDateDesc(cleanData.expenses.filter((expense) => getPdfExpenseDocumentationIssue(cleanData, expense)));
  const title = isTutorialMode() ? "Tutorial Professional Review" : "Professional Review Packet";
  const subtitle = isTutorialMode()
    ? "Prepared from sample tutorial records"
    : "Prepared from Home Basis Tracker records";
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
    optionLabel(PROJECT_STATUSES, summary.project.status),
    summary.dateRange,
    getProjectVendorName(cleanData, summary.project, "Not added"),
    summary.project.permitNumber || (summary.hasPermit ? "Permit record attached" : "Not added"),
    formatCurrency(summary.totals.total),
    `${summary.completeness.score}% (${summary.completeness.completedChecks}/${summary.completeness.totalChecks})`,
  ]);
  const expenseRows = sortByDateDesc(cleanData.expenses).map((expense) => [
    formatDate(expense.date),
    `${getExpenseVendorName(cleanData, expense)}\n${expense.description}`,
    getPropertyName(cleanData, expense.propertyId),
    getProjectName(cleanData, expense.projectId),
    optionLabel(CLASSIFICATIONS, expense.classification),
    optionLabel(DOCUMENT_STATUSES, expense.documentationStatus),
    formatCurrency(expense.amount),
  ]);
  const followUpRows = documentationGaps.map((expense) => [
    formatDate(expense.date),
    `${getExpenseVendorName(cleanData, expense)}\n${expense.description}`,
    getProjectName(cleanData, expense.projectId),
    getPdfExpenseDocumentationIssue(cleanData, expense),
    formatCurrency(expense.amount),
  ]);
  const documentRows = cleanData.documents.map((documentRecord) => {
    const relatedExpense = cleanData.expenses.find((expense) => expense.id === documentRecord.expenseId);
    return [
      documentRecord.displayName,
      optionLabel(DOCUMENT_TYPES, documentRecord.documentType),
      getPropertyName(cleanData, documentRecord.propertyId),
      getProjectName(cleanData, documentRecord.projectId),
      relatedExpense ? `${getExpenseVendorName(cleanData, relatedExpense)} / ${relatedExpense.description}` : "None",
      documentRecord.hasFile
        ? `${documentRecord.fileName || "Attached file"} (${formatFileSize(documentRecord.fileSize)})`
        : documentRecord.fileStatusNote || "No file attached",
    ];
  });

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
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 16px 0 12px;
    }
    .metric {
      border: 1px solid #d8ded9;
      padding: 9px;
      min-height: 58px;
    }
    .metric span {
      display: block;
      color: #66716c;
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
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
      letter-spacing: 0.04em;
      text-align: left;
      text-transform: uppercase;
      padding: 6px;
      vertical-align: top;
    }
    td {
      border: 1px solid #dce2de;
      padding: 6px;
      vertical-align: top;
      white-space: pre-line;
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
        <span class="brand-name">Home Basis Tracker</span>
        <span class="brand-subtitle">Home improvement records for professional review</span>
      </div>
    </div>
    <div class="prepared">Prepared ${escapeHtml(formatDate(todayISO()))}</div>
  </div>
  <h1>${escapeHtml(title)}</h1>
  <p class="lede">${escapeHtml(subtitle)}. This packet organizes property, project, expense, and document records so a qualified professional can review them efficiently.</p>
  <div class="note">Home Basis Tracker does not calculate tax basis or determine tax treatment. Use this report as an organized record handoff and confirm classifications with a qualified professional.</div>
  <div class="metrics">
    ${pdfMetric("Total tracked spend", formatCurrency(totals.total))}
    ${pdfMetric("Potential basis additions", formatCurrency(totals.potential))}
    ${pdfMetric("Repair or maintenance", formatCurrency(totals.repair))}
    ${pdfMetric("Needs review", formatCurrency(totals.unclear))}
    ${pdfMetric("Readiness", `${readiness.score}%`)}
    ${pdfMetric("Properties", String(cleanData.properties.length))}
    ${pdfMetric("Projects", String(cleanData.projects.length))}
    ${pdfMetric("Documents", String(cleanData.documents.length))}
  </div>
  ${pdfSection("Readiness Follow-Ups", readiness.followUps.length
    ? `<ul>${readiness.followUps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<div class="empty">No open readiness follow-ups recorded.</div>`)}
  ${pdfSection("Property Summary", propertyRows.length
    ? pdfTable(["Property", "Purchase Date", "Purchase Price", "Tracked Spend", "Projects", "Documents", "Follow-Ups"], propertyRows)
    : `<div class="empty">No property records.</div>`)}
  ${pdfSection("Project Summary", projectRows.length
    ? pdfTable(["Project", "Status", "Dates", "Contractor", "Permit", "Spend", "Completeness"], projectRows)
    : `<div class="empty">No project records.</div>`)}
  ${pdfSection("Expense Detail", expenseRows.length
    ? pdfTable(["Date", "Expense", "Property", "Project", "Classification", "Documentation", "Amount"], expenseRows)
    : `<div class="empty">No expense records.</div>`)}
  ${pdfSection("Documentation Follow-Ups", followUpRows.length
    ? pdfTable(["Date", "Expense", "Project", "Issue", "Amount"], followUpRows)
    : `<div class="empty">No open documentation follow-ups recorded.</div>`)}
  ${pdfSection("Document Index", documentRows.length
    ? pdfTable(["Document", "Type", "Property", "Project", "Related Expense", "Stored File"], documentRows)
    : `<div class="empty">No document records.</div>`)}
  <div class="footer">Generated by Home Basis Tracker. Attached file contents are not embedded in this PDF.</div>
</body>
</html>`;
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
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function getPdfExpenseDocumentationIssue(records, expense) {
  if (isDocumentationGap(expense)) {
    return "Needs a receipt, invoice, or follow-up note.";
  }
  if (!["receipt attached", "invoice attached"].includes(expense.documentationStatus)) {
    return "";
  }

  const expectedType = expense.documentationStatus === "invoice attached" ? "invoice" : "receipt";
  const hasLinkedStoredDocument = records.documents.some((documentRecord) =>
    documentRecord.expenseId === expense.id &&
    documentRecord.hasFile &&
    documentRecord.documentType === expectedType
  );
  if (hasLinkedStoredDocument) return "";
  return `Marked ${optionLabel(DOCUMENT_STATUSES, expense.documentationStatus).toLowerCase()}, but no linked stored ${expectedType} is in this binder.`;
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
  const missingFileLine = backupSummary.missingFilesCount || backupSummary.expectedFilesMissingFromBackup
    ? `Files needing follow-up: ${backupSummary.missingFilesCount + backupSummary.expectedFilesMissingFromBackup}`
    : "Files needing follow-up: none flagged";
  const modeCopy = isTutorialMode()
    ? "This will replace the temporary tutorial workspace only. Your real records will not be changed."
    : "This will replace the current records. Download a backup first if you want to keep what is here.";

  return [
    "Restore this Home Basis Tracker backup?",
    "",
    `Backup file: ${file?.name || "Selected backup"}`,
    `Created: ${formatRestoreTimestamp(backupSummary.createdAt)}`,
    `Backup contents: ${backupCounts}`,
    `Attached files: ${fileCoverage}`,
    missingFileLine,
    "",
    `Current contents to replace: ${currentCounts}`,
    modeCopy,
    "Only restore backups you created or trust.",
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
    documentFilters.propertyId = EMPTY_FILTER;
  }

  const projectIds = new Set(data.projects.map((project) => project.id));
  const vendorIds = new Set(data.vendors.map((vendor) => vendor.id));
  if (editingVendorId && !vendorIds.has(editingVendorId)) {
    editingVendorId = undefined;
  }
  if (selectedProjectId && !projectIds.has(selectedProjectId)) {
    selectedProjectId = "";
  }
  expandedProjectIds = new Set([...expandedProjectIds].filter((projectId) => projectIds.has(projectId)));
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
  documentFilters.propertyId = EMPTY_FILTER;
  documentFilters.documentType = EMPTY_FILTER;
  documentFilters.fileStatus = EMPTY_FILTER;
  selectedProjectId = "";
  expandedProjectIds = new Set();
  draftExpenseProjectId = "";
  draftDocumentExpenseId = "";
  draftDocumentProjectId = "";
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
    notice = "Saves are paused because records could not be loaded safely. Restore a backup or reopen the app before making changes.";
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
    notice = `Unable to save. Check ${storageSurfaceName()} storage settings before adding more records.`;
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
    fieldControl.focus();
    fieldControl.setAttribute("aria-invalid", "true");
    window.setTimeout(() => fieldControl.removeAttribute("aria-invalid"), 2800);
  });
}

function closeEditors() {
  editingPropertyField = "";
  editingProjectId = undefined;
  editingProjectField = "";
  editingExpenseId = undefined;
  editingDocumentId = undefined;
  editingVendorId = undefined;
  vendorManagerOpen = false;
  draftExpenseProjectId = "";
  draftDocumentExpenseId = "";
  draftDocumentProjectId = "";
  propertyMode = "view";
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
      <button class="text-action" data-action="edit-project" data-id="${escapeAttr(project.id)}" type="button">Edit details</button>
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
    image: "□",
    receipt: "▥",
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
