export const STORAGE_KEY = "home-ledger:v1";
export const BACKUP_APP_ID = "home-basis-tracker";
export const BACKUP_VERSION = 1;
export const EXPORT_PRODUCT_NAME = "Home Basis Tracker";
export const EXPORT_PRODUCT_VERSION = "0.1.0";
export const MAX_BACKUP_FILE_SIZE = 500 * 1024 * 1024;
export const MAX_DOCUMENT_FILE_SIZE = 25 * 1024 * 1024;
const MAX_RECORDS_PER_TYPE = 5000;
const MAX_TEXT_LENGTH = 5000;

export const EMPTY_DATA = {
  vendors: [],
  properties: [],
  projects: [],
  expenses: [],
  documents: [],
};

export const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "property", label: "Property" },
  { id: "projects", label: "Projects" },
  { id: "expenses", label: "Expenses" },
  { id: "documents", label: "Documents" },
  { id: "export", label: "Export & backup" },
  { id: "tutorial", label: "Tutorial" },
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
  { value: "unclear / ask CPA", label: "Needs professional review" },
];

export const EXPENSE_CATEGORIES = [
  { value: "addition/structural", label: "Addition/structural" },
  { value: "appliances", label: "Appliances" },
  { value: "attic", label: "Attic" },
  { value: "basement", label: "Basement" },
  { value: "bathroom", label: "Bathroom" },
  { value: "bedroom", label: "Bedroom" },
  { value: "cleanup/hauling", label: "Cleanup/hauling" },
  { value: "closets/storage", label: "Closets/storage" },
  { value: "deck/patio/porch", label: "Deck/patio/porch" },
  { value: "demolition", label: "Demolition" },
  { value: "dining room", label: "Dining room" },
  { value: "drainage/grading", label: "Drainage/grading" },
  { value: "driveway/walkway", label: "Driveway/walkway" },
  { value: "drywall/plaster", label: "Drywall/plaster" },
  { value: "electrical", label: "Electrical" },
  { value: "exterior masonry", label: "Exterior masonry" },
  { value: "fence/gate", label: "Fence/gate" },
  { value: "fireplace/chimney", label: "Fireplace/chimney" },
  { value: "flooring", label: "Flooring" },
  { value: "foundation", label: "Foundation" },
  { value: "garage", label: "Garage" },
  { value: "gutters/downspouts", label: "Gutters/downspouts" },
  { value: "HVAC", label: "HVAC" },
  { value: "inspection", label: "Inspection" },
  { value: "insulation/weatherization", label: "Insulation/weatherization" },
  { value: "irrigation", label: "Irrigation" },
  { value: "kitchen", label: "Kitchen" },
  { value: "landscaping", label: "Landscaping/yard" },
  { value: "laundry/mudroom", label: "Laundry/mudroom" },
  { value: "lighting", label: "Lighting" },
  { value: "living/family room", label: "Living/family room" },
  { value: "office", label: "Office" },
  { value: "exterior painting", label: "Painting - exterior" },
  { value: "interior painting", label: "Painting - interior" },
  { value: "permits/fees", label: "Permits/fees" },
  { value: "plans/design", label: "Plans/design" },
  { value: "plumbing", label: "Plumbing" },
  { value: "pool/spa", label: "Pool/spa" },
  { value: "roof", label: "Roof" },
  { value: "sewer/septic", label: "Sewer/septic" },
  { value: "siding", label: "Siding" },
  { value: "smart home/security", label: "Smart home/security" },
  { value: "solar/energy", label: "Solar/energy" },
  { value: "stairs/railings", label: "Stairs/railings" },
  { value: "tree work", label: "Tree work" },
  { value: "trim/millwork", label: "Trim/millwork" },
  { value: "warranty/service plan", label: "Warranty/service plan" },
  { value: "water heater", label: "Water heater" },
  { value: "well/water treatment", label: "Well/water treatment" },
  { value: "whole home", label: "Whole home" },
  { value: "windows/doors", label: "Windows/doors" },
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

export const VENDOR_STATUSES = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const PERMIT_LIKELY_CATEGORIES = new Set([
  "addition/structural",
  "basement",
  "deck/patio/porch",
  "demolition",
  "drainage/grading",
  "electrical",
  "exterior masonry",
  "foundation",
  "garage",
  "HVAC",
  "permits/fees",
  "plumbing",
  "pool/spa",
  "roof",
  "sewer/septic",
  "siding",
  "solar/energy",
  "water heater",
  "well/water treatment",
  "windows/doors",
]);
const CONTRACT_REVIEW_THRESHOLD = 1000;

export function sanitizeData(value) {
  const sanitized = {
    vendors: Array.isArray(value?.vendors) ? value.vendors.slice(0, MAX_RECORDS_PER_TYPE).map(sanitizeVendor) : [],
    properties: Array.isArray(value?.properties) ? value.properties.slice(0, MAX_RECORDS_PER_TYPE).map(sanitizeProperty) : [],
    projects: Array.isArray(value?.projects) ? value.projects.slice(0, MAX_RECORDS_PER_TYPE).map(sanitizeProject) : [],
    expenses: Array.isArray(value?.expenses) ? value.expenses.slice(0, MAX_RECORDS_PER_TYPE).map(sanitizeExpense) : [],
    documents: Array.isArray(value?.documents) ? value.documents.slice(0, MAX_RECORDS_PER_TYPE).map(sanitizeDocument) : [],
  };
  return normalizeRelationships(sanitized);
}

function sanitizeVendor(vendor) {
  return {
    id: cleanText(vendor?.id),
    name: cleanDisplayText(vendor?.name),
    category: allowedOptionValue(EXPENSE_CATEGORIES, vendor?.category, "other"),
    contactName: cleanDisplayText(vendor?.contactName),
    phone: cleanDisplayText(vendor?.phone),
    email: cleanDisplayText(vendor?.email),
    website: cleanDisplayText(vendor?.website),
    notes: cleanDisplayText(vendor?.notes),
    status: allowedOptionValue(VENDOR_STATUSES, vendor?.status, "active"),
  };
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
    vendorId: cleanText(project?.vendorId),
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
    vendorId: cleanText(expense?.vendorId),
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

  const baseProjects = cleanData.projects
    .filter((project) => project.id && project.name)
    .map((project) => ({
      ...project,
      propertyId: propertyIds.has(project.propertyId) ? project.propertyId : fallbackPropertyId,
    }))
    .filter((project) => project.propertyId);
  const baseProjectIds = new Set(baseProjects.map((project) => project.id));

  const baseExpenses = cleanData.expenses
    .filter((expense) => expense.id && expense.description)
    .map((expense) => {
      const propertyId = propertyIds.has(expense.propertyId) ? expense.propertyId : fallbackPropertyId;
      return {
        ...expense,
        propertyId,
        projectId: baseProjects.find((project) => project.id === expense.projectId && project.propertyId === propertyId)?.id || "",
      };
    })
    .filter((expense) => expense.propertyId);

  const vendorRegistry = buildVendorRegistry(cleanData.vendors, baseProjects, baseExpenses);
  const projects = baseProjects.map((project) => ({
    ...project,
    vendorId: vendorRegistry.resolve(project.vendorId, project.contractor),
  })).map((project) => ({
    ...project,
    contractor: getVendorNameFromRegistry(vendorRegistry, project.vendorId) || project.contractor,
  }));
  const projectIds = new Set(projects.map((project) => project.id));

  const expenses = baseExpenses.map((expense) => {
    const linkedProject = projects.find((project) => project.id === expense.projectId);
    const vendorId = vendorRegistry.resolve(expense.vendorId, expense.vendor || linkedProject?.contractor);
    return {
      ...expense,
      vendorId,
      vendor: getVendorNameFromRegistry(vendorRegistry, vendorId) || expense.vendor,
    };
  });
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
    vendors: vendorRegistry.vendors,
    properties,
    projects: projects.filter((project) => projectIds.has(project.id) && baseProjectIds.has(project.id)),
    expenses,
    documents,
  };
}

function buildVendorRegistry(explicitVendors, projects, expenses) {
  const vendors = [];
  const byId = new Map();
  const byNameKey = new Map();
  const usedIds = new Set();

  function addVendor(vendor, preferredId = "") {
    const name = cleanDisplayText(vendor?.name);
    if (!name) return "";
    const nameKey = vendorNameKey(name);
    const existingNameId = byNameKey.get(nameKey);
    if (existingNameId) return existingNameId;

    const rawId = cleanText(preferredId || vendor?.id);
    const id = rawId && !usedIds.has(rawId) ? rawId : uniqueVendorId(name, usedIds);
    const normalizedVendor = {
      id,
      name,
      category: allowedOptionValue(EXPENSE_CATEGORIES, vendor?.category, "other"),
      contactName: cleanDisplayText(vendor?.contactName),
      phone: cleanDisplayText(vendor?.phone),
      email: cleanDisplayText(vendor?.email),
      website: cleanDisplayText(vendor?.website),
      notes: cleanDisplayText(vendor?.notes),
      status: allowedOptionValue(VENDOR_STATUSES, vendor?.status, "active"),
    };
    vendors.push(normalizedVendor);
    byId.set(id, normalizedVendor);
    byNameKey.set(nameKey, id);
    usedIds.add(id);
    return id;
  }

  for (const vendor of explicitVendors) {
    addVendor(vendor, vendor.id);
  }
  for (const project of projects) {
    if (project.vendorId && byId.has(project.vendorId)) continue;
    addVendor({ name: project.contractor, category: project.category }, project.vendorId);
  }
  for (const expense of expenses) {
    if (expense.vendorId && byId.has(expense.vendorId)) continue;
    addVendor({ name: expense.vendor, category: expense.category }, expense.vendorId);
  }

  vendors.sort((a, b) => a.name.localeCompare(b.name));

  return {
    vendors,
    byId,
    resolve(vendorId, fallbackName = "") {
      const cleanVendorId = cleanText(vendorId);
      if (cleanVendorId && byId.has(cleanVendorId)) return cleanVendorId;
      const fallbackKey = vendorNameKey(fallbackName);
      if (fallbackKey && byNameKey.has(fallbackKey)) return byNameKey.get(fallbackKey);
      return "";
    },
  };
}

function getVendorNameFromRegistry(registry, vendorId) {
  if (!vendorId) return "";
  return registry.byId.get(vendorId)?.name || "";
}

function vendorNameKey(value) {
  return cleanDisplayText(value).toLowerCase().replace(/\s+/g, " ");
}

function uniqueVendorId(name, usedIds) {
  const base = `vendor_${slugifyId(name) || "unknown"}`;
  let id = base;
  let index = 2;
  while (usedIds.has(id)) {
    id = `${base}_${index}`;
    index += 1;
  }
  return id;
}

function slugifyId(value) {
  return cleanDisplayText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
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

function roundMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
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

export function getVendorName(data, id, fallback = "Unassigned / unknown") {
  if (!id) return fallback;
  return data.vendors?.find((vendor) => vendor.id === id)?.name || fallback;
}

export function getExpenseVendorName(data, expense, fallback = "Unassigned / unknown") {
  return getVendorName(data, expense?.vendorId, expense?.vendor || fallback);
}

export function getProjectVendorName(data, project, fallback = "Vendor not added") {
  return getVendorName(data, project?.vendorId, project?.contractor || fallback);
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

export function buildSaleScenarioEstimate(data, scenario = {}) {
  const properties = Array.isArray(data?.properties) ? data.properties : [];
  const property = properties.find((item) => item.id === scenario.propertyId) || properties[0] || null;
  const propertyExpenses = property
    ? (Array.isArray(data?.expenses) ? data.expenses : []).filter((expense) => expense.propertyId === property.id)
    : [];
  const totals = getExpenseTotals(propertyExpenses);
  const salePrice = parseAmount(scenario.salePrice);
  const mortgagePayoff = parseAmount(scenario.mortgagePayoff);
  const sellingCostsRate = Math.max(0, parseAmount(scenario.sellingCostsRate));
  const explicitSellingCosts = parseAmount(scenario.sellingCostsAmount);
  const sellingCosts = explicitSellingCosts > 0
    ? explicitSellingCosts
    : roundMoney(salePrice * (sellingCostsRate / 100));
  const purchasePrice = parseAmount(property?.purchasePrice);
  const basisAdditions = roundMoney(totals.potential);
  const needsReviewCosts = roundMoney(totals.unclear);
  const adjustedBasis = roundMoney(purchasePrice + basisAdditions);
  const amountRealized = roundMoney(salePrice - sellingCosts);
  const gainBeforeExclusion = roundMoney(amountRealized - adjustedBasis);
  const exclusionAmount = Math.max(0, parseAmount(scenario.exclusionAmount));
  const excludedGain = Math.min(Math.max(0, gainBeforeExclusion), exclusionAmount);
  const potentialTaxableGain = roundMoney(Math.max(0, gainBeforeExclusion - exclusionAmount));
  const netProceedsBeforeTax = roundMoney(salePrice - sellingCosts - mortgagePayoff);

  return {
    property,
    salePrice,
    mortgagePayoff,
    sellingCostsRate,
    sellingCosts,
    purchasePrice,
    basisAdditions,
    needsReviewCosts,
    repairCosts: roundMoney(totals.repair),
    adjustedBasis,
    amountRealized,
    gainBeforeExclusion,
    exclusionAmount,
    excludedGain,
    potentialTaxableGain,
    netProceedsBeforeTax,
  };
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
    const context = getProjectContext(data, project);
    const completeness = buildProjectCompleteness(project, context);

    return {
      project,
      expenses: context.expenses,
      documents: context.documents,
      totals: context.totals,
      missingDocuments: context.missingDocuments,
      hasPermit: context.documents.some((document) => document.documentType === "permit") || Boolean(project.permitNumber),
      hasContract: context.documents.some((document) => document.documentType === "contract"),
      hasPhoto: context.documents.some((document) => document.documentType === "photo"),
      dateRange: getProjectDateRange(project, context.expenses),
      completeness,
    };
  });
}

export function getProjectCompleteness(data, project) {
  return buildProjectCompleteness(project, getProjectContext(data, project));
}

function getProjectContext(data, project) {
  const properties = Array.isArray(data?.properties) ? data.properties : [];
  const expenses = Array.isArray(data?.expenses) ? data.expenses.filter((expense) => expense.projectId === project?.id) : [];
  const documents = Array.isArray(data?.documents) ? data.documents.filter((document) => document.projectId === project?.id) : [];
  const totals = getExpenseTotals(expenses);
  const missingDocuments = expenses.filter((expense) => isExpenseMissingLinkedEvidence(data, expense)).length;
  const unclearExpenses = expenses.filter((expense) => expense.classification === "unclear / ask CPA").length;
  return { properties, expenses, documents, totals, missingDocuments, unclearExpenses };
}

function buildProjectCompleteness(project, context) {
  const { properties, expenses, documents, totals, missingDocuments, unclearExpenses } = context;
  const expectedDocumentTypes = getExpectedProjectDocumentTypes(project, expenses, totals.total);
  const expectedDocumentFollowUps = getMissingProjectDocumentTypes(project, documents, expectedDocumentTypes);
  const isFinished = ["completed", "archived"].includes(project?.status);
  const checks = [
    projectCheck(
      "Linked to a property",
      properties.some((property) => property.id === project?.propertyId),
      "Link this project to a property.",
    ),
    projectCheck(
      "Project description or notes added",
      Boolean(project?.scopeSummary || project?.notes),
      "Add a short project description or project note.",
    ),
    projectCheck(
      "Start date added",
      Boolean(project?.startDate),
      "Add a project start date when available.",
    ),
    projectCheck(
      "Completion date handled",
      !isFinished || Boolean(project?.completionDate),
      "Add the completion date for finished projects.",
    ),
    projectCheck(
      "Contractor or vendor identified",
      Boolean(project?.vendorId || project?.contractor || expenses.some((expense) => expense.vendorId || expense.vendor)),
      "Add the contractor/vendor on the project or linked expenses.",
    ),
    projectCheck(
      "Cost records linked",
      expenses.length > 0,
      "Link at least one expense to this project.",
    ),
    projectCheck(
      "Supporting documents linked",
      documents.length > 0,
      "Link receipts, invoices, permits, photos, or notes to this project.",
    ),
    projectCheck(
      "Receipt and invoice records linked",
      expenses.length > 0 && missingDocuments === 0,
      "Link receipts or invoices for expenses that need them.",
    ),
    projectCheck(
      "Review classifications chosen",
      expenses.length > 0 && unclearExpenses === 0,
      "Review unclear expense classifications with a qualified professional.",
    ),
    projectCheck(
      "Expected document types covered",
      expectedDocumentFollowUps.length === 0,
      "",
    ),
  ];
  const completedChecks = checks.filter((check) => check.done).length;
  const totalChecks = checks.length;

  return {
    score: Math.round((completedChecks / totalChecks) * 100),
    completedChecks,
    totalChecks,
    checks,
    readyItems: checks.filter((check) => check.done).map((check) => check.label),
    followUps: [
      ...checks.filter((check) => !check.done).map((check) => check.followUp),
      ...expectedDocumentFollowUps.map((item) => `Add a ${item.label.toLowerCase()} record if available or applicable.`),
    ].filter(Boolean),
    expectedDocumentTypes,
    missingExpectedDocumentTypes: expectedDocumentFollowUps,
    missingDocuments,
    unclearExpenses,
  };
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
  const expensesMissingVendors = data.expenses.filter((expense) => !expense.vendorId);
  const documentsWithoutFiles = data.documents.filter((document) => !document.hasFile);
  const storedDocuments = data.documents.filter((document) => document.hasFile);
  const totalChecks = 7;
  const completedChecks = [
    data.properties.length > 0,
    data.expenses.length > 0,
    data.documents.length > 0,
    data.expenses.length > 0 && expensesMissingVendors.length === 0,
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
    expensesMissingVendors,
    projectsMissingDates,
    projectsMissingScope,
    documentsWithoutFiles,
    storedDocuments,
    readyItems: [
      data.properties.length ? "Property record created" : "",
      data.projects.length ? "Projects grouped" : "",
      data.expenses.length && !expensesMissingVendors.length ? "Expense vendors linked" : "",
      storedDocuments.length ? "Stored document files attached" : "",
      data.expenses.some((expense) => expense.classification === "potential basis addition") ? "Potential basis additions flagged" : "",
    ].filter(Boolean),
    followUps: [
      data.properties.length ? "" : "Add at least one property.",
      data.expenses.length ? "" : "Add expense records before preparing a professional review packet.",
      data.documents.length ? "" : "Add supporting document records.",
      expensesMissingVendors.length ? "Assign vendors/payees to unassigned expenses." : "",
      propertiesMissingPurchaseDetails.length ? "Add purchase date and purchase price where available." : "",
      expensesMissingLinkedEvidence.length ? "Link stored receipts or invoices to documented expenses." : "",
      unclearExpenses.length ? "Review items marked for professional classification." : "",
      projectsMissingDates.length ? "Add missing project start/completion dates." : "",
      projectsMissingScope.length ? "Add project descriptions or notes for context." : "",
    ].filter(Boolean),
  };
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

function projectCheck(label, done, followUp) {
  return {
    label,
    done: Boolean(done),
    followUp: done ? "" : followUp,
  };
}

function getExpectedProjectDocumentTypes(project, expenses, totalSpend) {
  const expectedTypes = [];
  if (expenses.length) {
    expectedTypes.push({ value: "receipt/invoice", label: "Receipt or invoice" });
  }
  if (project?.permitNumber || PERMIT_LIKELY_CATEGORIES.has(project?.category)) {
    expectedTypes.push({ value: "permit", label: "Permit or approval" });
  }
  if (project?.vendorId || project?.contractor || totalSpend >= CONTRACT_REVIEW_THRESHOLD) {
    expectedTypes.push({ value: "contract", label: "Contract or estimate" });
  }
  if (["completed", "archived"].includes(project?.status)) {
    expectedTypes.push({ value: "photo", label: "Before/after photo" });
  }
  if (expenses.length) {
    expectedTypes.push({ value: "payment record", label: "Payment record" });
  }

  const seenValues = new Set();
  return expectedTypes.filter((type) => {
    if (seenValues.has(type.value)) return false;
    seenValues.add(type.value);
    return true;
  });
}

function getMissingProjectDocumentTypes(project, documents, expectedDocumentTypes) {
  return expectedDocumentTypes.filter((type) => {
    if (type.value === "receipt/invoice") {
      return !documents.some((document) =>
        ["receipt", "invoice"].includes(document.documentType) &&
        document.hasFile
      );
    }
    if (type.value === "permit") {
      return !project?.permitNumber && !documents.some((document) => document.documentType === "permit");
    }
    return !documents.some((document) => document.documentType === type.value);
  });
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
  link.download = getSafeDownloadFileName(filename);
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function getSafeDownloadFileName(filename) {
  const fileName = String(filename || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop();
  return fileName?.trim().slice(0, 180) || "home-basis-download";
}

export function buildExpensesCsv(data) {
  const cleanData = sanitizeData(data);
  const headers = [
    "Export Source",
    "Export Date",
    "Property",
    "Project",
    "Vendor ID",
    "Category",
    "Date",
    "Vendor/Payee",
    "Description",
    "Amount",
    "Classification",
    "Documentation status",
    "Notes",
  ];

  const rows = sortByDateDesc(cleanData.expenses).map((expense) => [
    EXPORT_PRODUCT_NAME,
    todayISO(),
    getPropertyName(cleanData, expense.propertyId),
    getProjectName(cleanData, expense.projectId),
    expense.vendorId,
    expense.category,
    expense.date,
    getExpenseVendorName(cleanData, expense),
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
