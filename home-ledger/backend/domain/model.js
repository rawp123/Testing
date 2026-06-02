export const STORAGE_KEY = "home-ledger:v1";
export const BACKUP_APP_ID = "home-basis-tracker";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_FILE_SIZE = 500 * 1024 * 1024;
export const MAX_DOCUMENT_FILE_SIZE = 25 * 1024 * 1024;
const MAX_RECORDS_PER_TYPE = 5000;
const MAX_TEXT_LENGTH = 5000;

export const EMPTY_DATA = {
  properties: [],
  projects: [],
  expenses: [],
  documents: [],
};

export const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "tutorial", label: "Tutorial" },
  { id: "property", label: "Property" },
  { id: "projects", label: "Projects" },
  { id: "expenses", label: "Expenses" },
  { id: "documents", label: "Documents" },
  { id: "export", label: "Export & backup" },
];

export const PROJECT_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "in progress", label: "In progress" },
  { value: "blocked", label: "Blocked / waiting" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export const CLASSIFICATIONS = [
  { value: "potential basis addition", label: "Potential basis addition" },
  { value: "repair or maintenance", label: "Repair or maintenance" },
  { value: "unclear / ask CPA", label: "Unclear / ask CPA" },
];

export const EXPENSE_CATEGORIES = [
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "roof", label: "Roof" },
  { value: "HVAC", label: "HVAC" },
  { value: "windows/doors", label: "Windows/doors" },
  { value: "flooring", label: "Flooring" },
  { value: "landscaping", label: "Landscaping" },
  { value: "addition/structural", label: "Addition/structural" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "appliances", label: "Appliances" },
  { value: "other", label: "Other" },
];

export const DOCUMENT_STATUSES = [
  { value: "receipt attached", label: "Receipt attached" },
  { value: "invoice attached", label: "Invoice attached" },
  { value: "no document yet", label: "No document yet" },
  { value: "needs follow-up", label: "Needs follow-up" },
];

export const DOCUMENT_TYPES = [
  { value: "receipt", label: "Receipt" },
  { value: "invoice", label: "Invoice" },
  { value: "permit", label: "Permit" },
  { value: "warranty", label: "Warranty" },
  { value: "photo", label: "Photo" },
  { value: "contract", label: "Contract" },
  { value: "payment record", label: "Payment record" },
  { value: "appraisal", label: "Appraisal" },
  { value: "inspection", label: "Inspection" },
  { value: "plan or drawing", label: "Plan or drawing" },
  { value: "other", label: "Other" },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function sanitizeData(value) {
  const sanitized = {
    properties: Array.isArray(value?.properties) ? value.properties.slice(0, MAX_RECORDS_PER_TYPE).map(sanitizeProperty) : [],
    projects: Array.isArray(value?.projects) ? value.projects.slice(0, MAX_RECORDS_PER_TYPE).map(sanitizeProject) : [],
    expenses: Array.isArray(value?.expenses) ? value.expenses.slice(0, MAX_RECORDS_PER_TYPE).map(sanitizeExpense) : [],
    documents: Array.isArray(value?.documents) ? value.documents.slice(0, MAX_RECORDS_PER_TYPE).map(sanitizeDocument) : [],
  };
  return normalizeRelationships(sanitized);
}

function sanitizeProperty(property) {
  return {
    id: cleanText(property?.id),
    name: cleanDisplayText(property?.name),
    address: cleanDisplayText(property?.address),
    purchaseDate: cleanDate(property?.purchaseDate),
    purchasePrice: Math.max(0, parseAmount(property?.purchasePrice)),
    notes: cleanDisplayText(property?.notes),
  };
}

function sanitizeProject(project) {
  return {
    id: cleanText(project?.id),
    propertyId: cleanText(project?.propertyId),
    name: cleanDisplayText(project?.name),
    category: allowedOptionValue(EXPENSE_CATEGORIES, project?.category, "other"),
    startDate: cleanDate(project?.startDate),
    completionDate: cleanDate(project?.completionDate),
    contractor: cleanDisplayText(project?.contractor),
    permitNumber: cleanDisplayText(project?.permitNumber),
    status: allowedOptionValue(PROJECT_STATUSES, project?.status, "planned"),
    scopeSummary: cleanDisplayText(project?.scopeSummary),
    notes: cleanDisplayText(project?.notes),
  };
}

function sanitizeExpense(expense) {
  return {
    id: cleanText(expense?.id),
    propertyId: cleanText(expense?.propertyId),
    projectId: cleanText(expense?.projectId),
    date: cleanDate(expense?.date),
    vendor: cleanDisplayText(expense?.vendor),
    description: cleanDisplayText(expense?.description),
    amount: Math.max(0, parseAmount(expense?.amount)),
    classification: allowedOptionValue(CLASSIFICATIONS, expense?.classification, "unclear / ask CPA"),
    category: allowedOptionValue(EXPENSE_CATEGORIES, expense?.category, "other"),
    documentationStatus: allowedOptionValue(DOCUMENT_STATUSES, expense?.documentationStatus, "no document yet"),
    notes: cleanDisplayText(expense?.notes),
  };
}

function sanitizeDocument(document) {
  return {
    id: cleanText(document?.id),
    propertyId: cleanText(document?.propertyId),
    projectId: cleanText(document?.projectId),
    expenseId: cleanText(document?.expenseId),
    displayName: cleanDisplayText(document?.displayName),
    documentType: allowedOptionValue(DOCUMENT_TYPES, document?.documentType, "other"),
    addedDate: cleanDate(document?.addedDate),
    notes: cleanDisplayText(document?.notes),
    ocrText: cleanDisplayText(document?.ocrText),
    hasFile: Boolean(document?.hasFile),
    fileId: cleanText(document?.fileId),
    fileName: cleanDisplayText(document?.fileName),
    fileStatusNote: cleanDisplayText(document?.fileStatusNote),
    mimeType: cleanText(document?.mimeType),
    fileSize: Number(document?.fileSize) || 0,
    fileLastModified: document?.fileLastModified || null,
    fileStoredAt: cleanText(document?.fileStoredAt),
  };
}

function normalizeRelationships(cleanData) {
  const properties = cleanData.properties.filter((property) => property.id && property.name);
  const propertyIds = new Set(properties.map((property) => property.id));
  const fallbackPropertyId = properties[0]?.id || "";

  const projects = cleanData.projects
    .filter((project) => project.id && project.name)
    .map((project) => ({
      ...project,
      propertyId: propertyIds.has(project.propertyId) ? project.propertyId : fallbackPropertyId,
    }))
    .filter((project) => project.propertyId);
  const projectIds = new Set(projects.map((project) => project.id));

  const expenses = cleanData.expenses
    .filter((expense) => expense.id && expense.vendor && expense.description)
    .map((expense) => {
      const propertyId = propertyIds.has(expense.propertyId) ? expense.propertyId : fallbackPropertyId;
      const linkedProject = projects.find((project) => project.id === expense.projectId && project.propertyId === propertyId);
      return {
        ...expense,
        propertyId,
        projectId: linkedProject?.id || "",
      };
    })
    .filter((expense) => expense.propertyId);
  const expenseIds = new Set(expenses.map((expense) => expense.id));

  const documents = cleanData.documents
    .filter((document) => document.id && document.displayName)
    .map((document) => {
      const linkedExpense = expenses.find((expense) => expense.id === document.expenseId);
      if (linkedExpense) {
        return {
          ...document,
          propertyId: linkedExpense.propertyId,
          projectId: linkedExpense.projectId,
          expenseId: linkedExpense.id,
        };
      }

      const propertyId = propertyIds.has(document.propertyId) ? document.propertyId : fallbackPropertyId;
      const linkedProject = projects.find((project) => project.id === document.projectId && project.propertyId === propertyId);
      return {
        ...document,
        propertyId,
        projectId: linkedProject?.id || "",
        expenseId: expenseIds.has(document.expenseId) ? document.expenseId : "",
      };
    })
    .filter((document) => document.propertyId);

  return {
    properties,
    projects: projects.filter((project) => projectIds.has(project.id)),
    expenses,
    documents,
  };
}

function cleanText(value) {
  return removeLocalPaths(value).trim().slice(0, MAX_TEXT_LENGTH);
}

function cleanDisplayText(value) {
  return removeLocalPaths(value || "").trim().slice(0, MAX_TEXT_LENGTH);
}

function cleanDate(value) {
  const text = String(value || "").trim();
  return isValidISODate(text) ? text : "";
}

export function isValidISODate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function createId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseAmount(value) {
  const numericValue = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numericValue)) return 0;
  return Math.round(numericValue * 100) / 100;
}

export function formatCurrency(value) {
  return currencyFormatter.format(parseAmount(value));
}

export function formatFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || "None";
}

function allowedOptionValue(options, value, fallback) {
  return options.some((option) => option.value === value) ? value : fallback;
}

export function getPropertyName(data, id) {
  return data.properties.find((property) => property.id === id)?.name || "Unassigned property";
}

export function getProjectName(data, id) {
  if (!id) return "No project";
  return data.projects.find((project) => project.id === id)?.name || "No project";
}

export function getExpenseTotals(expenses) {
  return expenses.reduce(
    (totals, expense) => {
      const amount = parseAmount(expense.amount);
      totals.total += amount;
      if (expense.classification === "potential basis addition") totals.potential += amount;
      if (expense.classification === "repair or maintenance") totals.repair += amount;
      if (expense.classification === "unclear / ask CPA") totals.unclear += amount;
      if (isDocumentationGap(expense)) totals.documentationGaps += 1;
      return totals;
    },
    { total: 0, potential: 0, repair: 0, unclear: 0, documentationGaps: 0 },
  );
}

export function getPropertyReviewSummaries(data) {
  return data.properties.map((property) => {
    const projects = data.projects.filter((project) => project.propertyId === property.id);
    const expenses = data.expenses.filter((expense) => expense.propertyId === property.id);
    const documents = data.documents.filter((document) => document.propertyId === property.id);
    const totals = getExpenseTotals(expenses);
    const openProjects = projects.filter((project) => !["completed", "archived"].includes(project.status));
    const storedFiles = documents.filter((document) => document.hasFile).length;
    const missingDocuments = expenses.filter((expense) => isExpenseMissingLinkedEvidence(data, expense)).length;

    return {
      property,
      projects,
      expenses,
      documents,
      totals,
      openProjects,
      storedFiles,
      missingDocuments,
      readinessScore: calculateReadinessScore({
        propertyHasPurchaseDetails: Boolean(property.purchaseDate && property.purchasePrice),
        expenseCount: expenses.length,
        documentCount: documents.length,
        missingDocuments,
        unclearCount: expenses.filter((expense) => expense.classification === "unclear / ask CPA").length,
      }),
    };
  });
}

export function getProjectReviewSummaries(data) {
  return data.projects.map((project) => {
    const expenses = data.expenses.filter((expense) => expense.projectId === project.id);
    const documents = data.documents.filter((document) => document.projectId === project.id);
    const totals = getExpenseTotals(expenses);
    const missingDocuments = expenses.filter((expense) => isExpenseMissingLinkedEvidence(data, expense)).length;

    return {
      project,
      expenses,
      documents,
      totals,
      missingDocuments,
      hasPermit: documents.some((document) => document.documentType === "permit") || Boolean(project.permitNumber),
      hasContract: documents.some((document) => document.documentType === "contract"),
      hasPhoto: documents.some((document) => document.documentType === "photo"),
      dateRange: getProjectDateRange(project, expenses),
    };
  });
}

export function getReviewReadiness(data) {
  const propertiesMissingPurchaseDetails = data.properties.filter((property) =>
    !property.purchaseDate || !property.purchasePrice
  );
  const expensesMissingLinkedEvidence = data.expenses.filter((expense) => isExpenseMissingLinkedEvidence(data, expense));
  const unclearExpenses = data.expenses.filter((expense) => expense.classification === "unclear / ask CPA");
  const projectsMissingDates = data.projects.filter((project) =>
    !project.startDate || (project.status === "completed" && !project.completionDate)
  );
  const projectsMissingScope = data.projects.filter((project) => !project.scopeSummary && !project.notes);
  const documentsWithoutFiles = data.documents.filter((document) => !document.hasFile);
  const storedDocuments = data.documents.filter((document) => document.hasFile);
  const totalChecks = 6;
  const completedChecks = [
    data.properties.length > 0,
    data.expenses.length > 0,
    data.documents.length > 0,
    data.properties.length > 0 && propertiesMissingPurchaseDetails.length === 0,
    data.expenses.length > 0 && expensesMissingLinkedEvidence.length === 0,
    data.expenses.length > 0 && unclearExpenses.length === 0,
  ].filter(Boolean).length;

  return {
    score: Math.round((completedChecks / totalChecks) * 100),
    completedChecks,
    totalChecks,
    propertiesMissingPurchaseDetails,
    expensesMissingLinkedEvidence,
    unclearExpenses,
    projectsMissingDates,
    projectsMissingScope,
    documentsWithoutFiles,
    storedDocuments,
    readyItems: [
      data.properties.length ? "Property record created" : "",
      data.projects.length ? "Projects grouped" : "",
      storedDocuments.length ? "Stored document files attached" : "",
      data.expenses.some((expense) => expense.classification === "potential basis addition") ? "Potential basis additions flagged" : "",
    ].filter(Boolean),
    followUps: [
      data.properties.length ? "" : "Add at least one property.",
      data.expenses.length ? "" : "Add expense records before preparing a CPA packet.",
      data.documents.length ? "" : "Add supporting document records.",
      propertiesMissingPurchaseDetails.length ? "Add purchase date and purchase price where available." : "",
      expensesMissingLinkedEvidence.length ? "Link stored receipts or invoices to documented expenses." : "",
      unclearExpenses.length ? "Review unclear classifications with your CPA." : "",
      projectsMissingDates.length ? "Add missing project start/completion dates." : "",
      projectsMissingScope.length ? "Add project scope notes for context." : "",
    ].filter(Boolean),
  };
}

export function buildCpaReviewPacket(data) {
  const cleanData = sanitizeData(data);
  const totals = getExpenseTotals(cleanData.expenses);
  const readiness = getReviewReadiness(cleanData);
  const propertySummaries = getPropertyReviewSummaries(cleanData);
  const projectSummaries = getProjectReviewSummaries(cleanData);
  const lines = [
    "Home Basis Tracker CPA Review Packet",
    `Prepared: ${formatDate(todayISO())}`,
    "",
    "Important note",
    "Home Basis Tracker organizes records for review. It does not calculate taxes, determine basis, or provide legal or tax advice.",
    "",
    "Overall totals",
    `Total tracked spend: ${formatCurrency(totals.total)}`,
    `Marked potential basis additions: ${formatCurrency(totals.potential)}`,
    `Repair/maintenance: ${formatCurrency(totals.repair)}`,
    `Unclear / ask CPA: ${formatCurrency(totals.unclear)}`,
    `Documentation follow-ups: ${readiness.expensesMissingLinkedEvidence.length}`,
    `Review readiness: ${readiness.score}% (${readiness.completedChecks}/${readiness.totalChecks} checks)`,
    "",
    "Readiness follow-ups",
    ...(readiness.followUps.length ? readiness.followUps.map((item) => `- ${item}`) : ["- No open readiness follow-ups recorded."]),
    "",
    "Properties",
    ...(propertySummaries.length ? propertySummaries.flatMap((summary) => [
      `${summary.property.name}`,
      `Address: ${summary.property.address || "Not added"}`,
      `Purchase date: ${formatDate(summary.property.purchaseDate)}`,
      `Purchase price: ${summary.property.purchasePrice ? formatCurrency(summary.property.purchasePrice) : "Not added"}`,
      `Tracked spend: ${formatCurrency(summary.totals.total)}`,
      `Potential basis additions: ${formatCurrency(summary.totals.potential)}`,
      `Projects: ${summary.projects.length}`,
      `Documents: ${summary.documents.length} (${summary.storedFiles} stored files)`,
      `Documentation follow-ups: ${summary.missingDocuments}`,
      summary.property.notes ? `Notes: ${summary.property.notes}` : "Notes: None",
      "",
    ]) : ["No property records.", ""]),
    "Projects",
    ...(projectSummaries.length ? projectSummaries.flatMap((summary) => [
      `${summary.project.name} (${getPropertyName(cleanData, summary.project.propertyId)})`,
      `Status: ${optionLabel(PROJECT_STATUSES, summary.project.status)}`,
      `Category: ${optionLabel(EXPENSE_CATEGORIES, summary.project.category)}`,
      `Dates: ${summary.dateRange}`,
      `Contractor/vendor: ${summary.project.contractor || "Not added"}`,
      `Permit number: ${summary.project.permitNumber || "Not added"}`,
      `Tracked spend: ${formatCurrency(summary.totals.total)}`,
      `Documents: ${summary.documents.length}`,
      `Coverage: ${[
        summary.hasPermit ? "permit" : "",
        summary.hasContract ? "contract" : "",
        summary.hasPhoto ? "photos" : "",
      ].filter(Boolean).join(", ") || "No permit/contract/photo records"}`,
      summary.project.scopeSummary ? `Scope: ${summary.project.scopeSummary}` : "",
      summary.project.notes ? `Notes: ${summary.project.notes}` : "",
      "",
    ]) : ["No project records.", ""]),
    "Expense detail",
    ...(cleanData.expenses.length ? sortByDateDesc(cleanData.expenses).flatMap((expense) => [
      `${formatDate(expense.date)} / ${expense.vendor} / ${formatCurrency(expense.amount)}`,
      `Property: ${getPropertyName(cleanData, expense.propertyId)}`,
      `Project: ${getProjectName(cleanData, expense.projectId)}`,
      `Description: ${expense.description}`,
      `Category: ${optionLabel(EXPENSE_CATEGORIES, expense.category)}`,
      `Classification: ${optionLabel(CLASSIFICATIONS, expense.classification)}`,
      `Documentation: ${optionLabel(DOCUMENT_STATUSES, expense.documentationStatus)}`,
      isExpenseMissingLinkedEvidence(cleanData, expense) ? "Follow-up: linked stored receipt/invoice evidence should be reviewed." : "Follow-up: none recorded.",
      expense.notes ? `Notes: ${expense.notes}` : "Notes: None",
      "",
    ]) : ["No expense records.", ""]),
    "Document index",
    ...(cleanData.documents.length ? cleanData.documents.map((document) => {
      const linkedExpense = cleanData.expenses.find((expense) => expense.id === document.expenseId);
      return [
        `${document.displayName}`,
        `Type: ${optionLabel(DOCUMENT_TYPES, document.documentType)}`,
        `Property: ${getPropertyName(cleanData, document.propertyId)}`,
        `Project: ${getProjectName(cleanData, document.projectId)}`,
        `Related expense: ${linkedExpense ? `${linkedExpense.vendor} / ${linkedExpense.description}` : "None"}`,
        `Stored file: ${document.hasFile ? `${document.fileName || "Attached file"} (${formatFileSize(document.fileSize)})` : document.fileStatusNote || "No file attached"}`,
        document.notes ? `Notes: ${document.notes}` : "Notes: None",
        "",
      ].join("\n");
    }) : ["No document records."]),
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function isExpenseMissingLinkedEvidence(data, expense) {
  if (isDocumentationGap(expense)) return true;
  if (!["receipt attached", "invoice attached"].includes(expense.documentationStatus)) return false;

  const expectedType = expense.documentationStatus === "invoice attached" ? "invoice" : "receipt";
  return !data.documents.some((document) =>
    document.expenseId === expense.id &&
    document.hasFile &&
    document.documentType === expectedType
  );
}

function getProjectDateRange(project, expenses) {
  const expenseDates = expenses.map((expense) => expense.date).filter(Boolean).sort();
  const start = project.startDate || expenseDates[0] || "";
  const end = project.completionDate || expenseDates.at(-1) || "";
  if (start && end && start !== end) return `${formatDate(start)} - ${formatDate(end)}`;
  if (start) return formatDate(start);
  return "Not set";
}

function calculateReadinessScore({ propertyHasPurchaseDetails, expenseCount, documentCount, missingDocuments, unclearCount }) {
  const checks = [
    propertyHasPurchaseDetails,
    expenseCount > 0,
    documentCount > 0,
    missingDocuments === 0,
    unclearCount === 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function isDocumentationGap(expense) {
  return ["no document yet", "needs follow-up"].includes(expense.documentationStatus);
}

export function sortByDateDesc(items) {
  return [...items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export function upsertById(items, item) {
  if (items.some((currentItem) => currentItem.id === item.id)) {
    return items.map((currentItem) => (currentItem.id === item.id ? item : currentItem));
  }
  return [item, ...items];
}

export function removeLocalPaths(value) {
  return String(value ?? "")
    .replace(/file:\/\/(?:localhost)?\/[^\r\n,;)]*/gi, "[local file path removed]")
    .replace(/~\/[^\r\n,;)]*/g, "[local file path removed]")
    .replace(/\/(?:Applications|Library|System|Users|Volumes|bin|dev|etc|home|opt|private|sbin|tmp|usr|var)\/[^\r\n,;)]*/gi, "[local file path removed]")
    .replace(/\.\.?\/(?:[^/\r\n,;)]+\/)*[^/\r\n,;)]*/g, "[local file path removed]")
    .replace(/[A-Z]:\/[^\r\n,;)]*/gi, "[local file path removed]")
    .replace(/[A-Z]:\\[^\r\n,;)]*/gi, "[local file path removed]")
    .replace(/\\\\[^\\/:*?"<>|\r\n]+\\[^\r\n,;)]*/g, "[local file path removed]");
}

export function downloadTextFile(contents, filename, type = "text/plain;charset=utf-8") {
  const blob = new Blob([contents], { type });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function buildExpensesCsv(data) {
  const headers = [
    "Property",
    "Project",
    "Category",
    "Date",
    "Vendor/Payee",
    "Description",
    "Amount",
    "Classification",
    "Documentation status",
    "Notes",
  ];

  const rows = sortByDateDesc(data.expenses).map((expense) => [
    getPropertyName(data, expense.propertyId),
    getProjectName(data, expense.projectId),
    expense.category,
    expense.date,
    expense.vendor,
    expense.description,
    parseAmount(expense.amount).toFixed(2),
    expense.classification,
    expense.documentationStatus,
    expense.notes,
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = neutralizeSpreadsheetFormula(String(value ?? ""));
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function neutralizeSpreadsheetFormula(value) {
  const trimmedStart = value.trimStart();
  if (/^[=+\-@]/.test(trimmedStart)) {
    return `'${value}`;
  }
  return value;
}
