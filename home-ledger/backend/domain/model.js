export const STORAGE_KEY = "home-ledger:v1";
export const BACKUP_APP_ID = "home-basis-tracker";
export const BACKUP_VERSION = 1;
export const EXPORT_PRODUCT_NAME = "Home Ledger";
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
  followUpOverrides: [],
};

export const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "property", label: "Property" },
  { id: "projects", label: "Projects" },
  { id: "expenses", label: "Expenses" },
  { id: "documents", label: "Documents" },
  { id: "calculators", label: "Calculators" },
  { id: "export", label: "Export & backup" },
  { id: "tutorial", label: "Tutorial" },
];

export const PROJECT_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "in progress", label: "In progress" },
  { value: "blocked", label: "Blocked or waiting" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export const CLASSIFICATIONS = [
  { value: "potential basis addition", label: "Possible improvement" },
  { value: "repair or maintenance", label: "Repair or upkeep" },
  { value: "unclear / ask CPA", label: "Needs classification" },
];

const PROFESSIONAL_CLASSIFICATION_LABELS = {
  "potential basis addition": "Possible improvement",
  "repair or maintenance": "Repair or upkeep",
  "unclear / ask CPA": "Needs classification",
};

const PROFESSIONAL_PROJECT_STATUS_LABELS = {
  archived: "Archived / included for record review",
};

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
  { value: "payment record", label: "Payment proof" },
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
    followUpOverrides: Array.isArray(value?.followUpOverrides) ? value.followUpOverrides.slice(0, MAX_RECORDS_PER_TYPE).map(sanitizeFollowUpOverride) : [],
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
    isPrimary: Boolean(property?.isPrimary),
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
    completenessOverrideNote: cleanDisplayText(project?.completenessOverrideNote),
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

function sanitizeFollowUpOverride(override) {
  return {
    id: cleanText(override?.id),
    label: cleanDisplayText(override?.label),
    typeLabel: cleanDisplayText(override?.typeLabel),
    detail: cleanDisplayText(override?.detail),
    propertyId: cleanText(override?.propertyId),
    projectId: cleanText(override?.projectId),
    expenseId: cleanText(override?.expenseId),
    documentId: cleanText(override?.documentId),
    note: cleanDisplayText(override?.note),
    completedAt: cleanText(override?.completedAt),
  };
}

function normalizeRelationships(cleanData) {
  const usableProperties = cleanData.properties.filter((property) => property.id && property.name);
  const primaryPropertyId = usableProperties.find((property) => property.isPrimary)?.id || "";
  const properties = usableProperties
    .map((property) => ({
      ...property,
      isPrimary: Boolean(primaryPropertyId && property.id === primaryPropertyId),
    }))
    .sort((firstProperty, secondProperty) => Number(secondProperty.isPrimary) - Number(firstProperty.isPrimary));
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
    followUpOverrides: cleanData.followUpOverrides.filter((override) => override.id),
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

export function getRecordFollowUps(data, options = {}) {
  const records = getRecordCollections(data);
  const items = [];
  const overrideIds = new Set(records.followUpOverrides.map((override) => override.id));
  const pushItem = (item) => {
    if (!item?.id || overrideIds.has(item.id) || items.some((currentItem) => currentItem.id === item.id)) return;
    items.push({
      severity: "medium",
      priority: 50,
      propertyId: "",
      projectId: "",
      expenseId: "",
      documentId: "",
      surfaces: ["dashboard", "export"],
      ...item,
    });
  };

  records.properties.forEach((property) => {
    if (!property.purchaseDate) {
      pushItem(createFollowUpItem({
        id: `property:${property.id}:purchase-date`,
        type: "property-missing-purchase-date",
        typeLabel: "Property details",
        label: "Add purchase date",
        detail: `${property.name} is missing a purchase date.`,
        severity: "medium",
        priority: 20,
        propertyId: property.id,
        action: {
          label: "Add purchase date",
          action: "edit-property-field",
          id: property.id,
          field: "purchaseDate",
          destinationTab: "property",
          opens: "property field editor",
        },
      }));
    }
    if (!property.purchasePrice) {
      pushItem(createFollowUpItem({
        id: `property:${property.id}:purchase-price`,
        type: "property-missing-purchase-price",
        typeLabel: "Property details",
        label: "Add purchase price",
        detail: `${property.name} is missing a purchase price.`,
        severity: "medium",
        priority: 21,
        propertyId: property.id,
        action: {
          label: "Add purchase price",
          action: "edit-property-field",
          id: property.id,
          field: "purchasePrice",
          destinationTab: "property",
          opens: "property field editor",
        },
      }));
    }
  });

  records.projects.forEach((project) => {
    getProjectFollowUpItems(records, project).forEach(pushItem);
  });

  records.expenses.forEach((expense) => {
    getExpenseFollowUpItems(records, expense).forEach(pushItem);
  });

  records.documents.forEach((documentRecord) => {
    const item = getDocumentFollowUpItem(records, documentRecord, options);
    if (item) pushItem(item);
  });

  getPlaceholderFollowUpItems(records).forEach(pushItem);

  return items.sort(compareFollowUpItems);
}

export function getRecordFollowUpsForSurface(data, surface, options = {}) {
  return getRecordFollowUps(data, options).filter((item) => item.surfaces.includes(surface));
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
      "Costs linked",
      expenses.length > 0,
      "Link at least one expense to this project.",
    ),
    projectCheck(
      "Supporting documents linked",
      documents.length > 0,
      "Attach receipts, invoices, permits, photos, or notes to this project.",
    ),
    projectCheck(
      "Receipt and invoice files linked",
      expenses.length > 0 && missingDocuments === 0,
      "Attach receipts or invoices for expenses that need them.",
    ),
    projectCheck(
      "Review treatment choices",
      expenses.length > 0 && unclearExpenses === 0,
      "Review expenses marked Needs classification.",
    ),
    projectCheck(
      "Expected document types covered",
      expectedDocumentFollowUps.length === 0,
      "",
    ),
  ];
  const completedChecks = checks.filter((check) => check.done).length;
  const totalChecks = checks.length;
  const completenessOverrideNote = cleanDisplayText(project?.completenessOverrideNote);

  if (completenessOverrideNote) {
    return {
      score: 100,
      completedChecks: totalChecks,
      totalChecks,
      checks,
      readyItems: ["Marked complete with note"],
      followUps: [],
      expectedDocumentTypes,
      missingExpectedDocumentTypes: [],
      missingDocuments,
      unclearExpenses,
      isOverridden: true,
      overrideNote: completenessOverrideNote,
    };
  }

  return {
    score: Math.round((completedChecks / totalChecks) * 100),
    completedChecks,
    totalChecks,
    checks,
    readyItems: checks.filter((check) => check.done).map((check) => check.label),
    followUps: [
      ...checks.filter((check) => !check.done).map((check) => check.followUp),
      ...expectedDocumentFollowUps.map((item) => `Add a ${item.label.toLowerCase()} if available or applicable.`),
    ].filter(Boolean),
    expectedDocumentTypes,
    missingExpectedDocumentTypes: expectedDocumentFollowUps,
    missingDocuments,
    unclearExpenses,
    isOverridden: false,
    overrideNote: "",
  };
}

export function getReviewReadiness(data) {
  const records = getRecordCollections(data);
  const followUpItems = getRecordFollowUps(records);
  const propertiesMissingPurchaseDetails = records.properties.filter((property) =>
    !property.purchaseDate || !property.purchasePrice
  );
  const expenseSupportFollowUpIds = new Set(followUpItems
    .filter((item) => item.type.startsWith("expense-") && item.type.includes("document"))
    .map((item) => item.expenseId));
  const expensesMissingLinkedEvidence = records.expenses.filter((expense) => expenseSupportFollowUpIds.has(expense.id));
  const unclearExpenses = records.expenses.filter((expense) => expense.classification === "unclear / ask CPA");
  const projectsToFinish = records.projects.filter((project) => !project.completenessOverrideNote);
  const projectsMissingDates = projectsToFinish.filter((project) =>
    !project.startDate || (project.status === "completed" && !project.completionDate)
  );
  const projectsMissingScope = projectsToFinish.filter((project) => !project.scopeSummary && !project.notes);
  const expensesMissingVendors = records.expenses.filter((expense) => !expense.vendorId && !expense.vendor);
  const documentsWithoutFiles = records.documents.filter((document) => !document.hasFile);
  const storedDocuments = records.documents.filter((document) => document.hasFile);
  const totalChecks = 7;
  const completedChecks = [
    records.properties.length > 0,
    records.expenses.length > 0,
    records.documents.length > 0,
    records.expenses.length > 0 && expensesMissingVendors.length === 0,
    records.properties.length > 0 && propertiesMissingPurchaseDetails.length === 0,
    records.expenses.length > 0 && expensesMissingLinkedEvidence.length === 0,
    records.expenses.length > 0 && unclearExpenses.length === 0,
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
    followUpItems,
    readyItems: [
      records.properties.length ? "Home details added" : "",
      records.projects.length ? "Projects grouped" : "",
      records.expenses.length && !expensesMissingVendors.length ? "Expense vendors linked" : "",
      storedDocuments.length ? "Stored document files attached" : "",
      records.expenses.some((expense) => expense.classification === "potential basis addition") ? "Possible improvements noted" : "",
    ].filter(Boolean),
    followUps: followUpItems.map((item) => item.label),
  };
}

export function getProfessionalClassificationLabel(value) {
  return PROFESSIONAL_CLASSIFICATION_LABELS[value] || optionLabel(CLASSIFICATIONS, value);
}

export function getProfessionalProjectStatusLabel(value) {
  return PROFESSIONAL_PROJECT_STATUS_LABELS[value] || optionLabel(PROJECT_STATUSES, value);
}

export function getPacketReadinessSummary(data, options = {}) {
  const records = getRecordCollections(data);
  const openItems = getRecordFollowUps(records, options).filter((item) => item.surfaces.includes("export"));
  const supportItems = openItems.filter(isSupportFollowUpItem);
  const placeholderItems = openItems.filter((item) => item.type === "record-placeholder-content");
  const needsClassificationItems = openItems.filter((item) => item.type === "expense-review-treatment");
  const dismissedItems = records.followUpOverrides.filter((override) => override.id);
  const hasRecords = Boolean(records.properties.length || records.projects.length || records.expenses.length || records.documents.length);
  const readyToShare = hasRecords && openItems.length === 0;
  const statusLabel = !hasRecords
    ? "Needs records"
    : supportItems.length
      ? "Needs records"
      : openItems.length
        ? "Needs review"
        : "Ready to share with a professional";

  return {
    title: readyToShare ? "Professional Review Packet" : "Draft Professional Review Packet",
    statusLabel,
    readyToShare,
    openItems,
    openItemCount: openItems.length,
    supportItems,
    supportItemCount: supportItems.length,
    recordsStillNeededItems: supportItems,
    placeholderItems,
    placeholderItemCount: placeholderItems.length,
    needsClassificationItems,
    needsClassificationCount: needsClassificationItems.length,
    dismissedItems,
    dismissedItemCount: dismissedItems.length,
    dismissedItemCopy: getDismissedItemCopy(dismissedItems.length),
    expenseProofFilesLinked: countLinkedExpenseProofFiles(records),
    proofFilesStillNeeded: supportItems.length,
    attachedFileCount: records.documents.filter((documentRecord) => documentRecord.hasFile).length,
  };
}

export function isPlaceholderReviewValue(value) {
  const raw = cleanDisplayText(value).trim();
  if (!raw) return false;

  const lower = raw.toLowerCase().replace(/[“”]/g, "\"").replace(/[’]/g, "'");
  const compact = lower.replace(/[^a-z0-9]/g, "");
  const exactPlaceholders = new Set(["test", "asdf", "lorem", "todo", "tbd", "na", "n/a"]);
  if (exactPlaceholders.has(lower) || exactPlaceholders.has(compact)) return true;
  if (/^(this is )?(a )?test( item| record| note| project| file)?[.!?]?$/.test(lower)) return true;
  if (/^lorem( ipsum)?[.!?]?$/.test(lower)) return true;
  if (/^(todo|tbd|asdf|qwerty)[\s:._-]*\d{0,4}$/i.test(raw)) return true;
  if (compact.length >= 8 && /^(.)\1+$/.test(compact)) return true;
  if (/^(asdf|qwerty){2,}$/.test(compact)) return true;
  return false;
}

function isExpenseMissingLinkedEvidence(data, expense) {
  if (isDocumentationGap(expense) && !getStoredExpenseEvidenceDocument(data, expense)) return true;
  if (!["receipt attached", "invoice attached"].includes(expense.documentationStatus)) return false;
  return !getStoredExpenseEvidenceDocument(data, expense);
}

function getRecordCollections(data) {
  return {
    vendors: Array.isArray(data?.vendors) ? data.vendors : [],
    properties: Array.isArray(data?.properties) ? data.properties : [],
    projects: Array.isArray(data?.projects) ? data.projects : [],
    expenses: Array.isArray(data?.expenses) ? data.expenses : [],
    documents: Array.isArray(data?.documents) ? data.documents : [],
    followUpOverrides: Array.isArray(data?.followUpOverrides) ? data.followUpOverrides : [],
  };
}

function createFollowUpItem({ action, ...item }) {
  const primaryAction = {
    label: action.label,
    action: action.action,
    id: action.id || "",
    field: action.field || "",
    projectId: action.projectId || "",
    expenseId: action.expenseId || "",
    documentId: action.documentId || "",
    destinationTab: action.destinationTab,
    destination: action.destination || action.destinationTab,
    opens: action.opens || "",
    changesData: Boolean(action.changesData),
    copy: action.copy || getActionCopy(action),
  };
  return {
    ...item,
    primaryAction,
  };
}

function getActionCopy(action) {
  if (action.changesData) {
    return "Applies right away.";
  }
  return `Opens the ${action.opens || "related form"}. You can review it before saving.`;
}

function getProjectFollowUpItems(records, project) {
  if (project?.completenessOverrideNote) return [];

  const items = [];
  const expenses = records.expenses.filter((expense) => expense.projectId === project.id);
  const documents = records.documents.filter((documentRecord) => documentRecord.projectId === project.id);
  const totals = getExpenseTotals(expenses);
  const expectedDocumentTypes = getExpectedProjectDocumentTypes(project, expenses, totals.total);
  const missingProjectDocumentTypes = getMissingProjectDocumentTypes(project, documents, expectedDocumentTypes)
    .filter((type) => !["receipt/invoice", "payment record"].includes(type.value));
  const propertyId = project.propertyId || "";

  const projectAction = (label) => ({
    label,
    action: "edit-project",
    id: project.id,
    destinationTab: "projects",
    opens: "project form",
  });

  if (!project.vendorId && !project.contractor && !expenses.some((expense) => expense.vendorId || expense.vendor)) {
    items.push(createFollowUpItem({
      id: `project:${project.id}:vendor`,
      type: "project-missing-vendor",
      typeLabel: "Project item",
      label: "Add project vendor",
      detail: `${project.name} does not have a vendor linked yet.`,
      severity: "medium",
      priority: 30,
      propertyId,
      projectId: project.id,
      surfaces: ["dashboard", "projects", "export"],
      action: projectAction("Add vendor"),
    }));
  }

  const missingDates = [
    !project.startDate ? "start date" : "",
    ["completed", "archived"].includes(project.status) && !project.completionDate ? "completion date" : "",
  ].filter(Boolean);
  if (missingDates.length) {
    items.push(createFollowUpItem({
      id: `project:${project.id}:dates`,
      type: "project-missing-dates",
      typeLabel: "Project item",
      label: missingDates.length === 2 ? "Add project dates" : `Add ${missingDates[0]}`,
      detail: `${project.name} is missing ${humanList(missingDates)}.`,
      severity: "medium",
      priority: 31,
      propertyId,
      projectId: project.id,
      surfaces: ["dashboard", "projects", "export"],
      action: projectAction("Add project dates"),
    }));
  }

  if (!project.scopeSummary && !project.notes) {
    items.push(createFollowUpItem({
      id: `project:${project.id}:scope`,
      type: "project-missing-scope",
      typeLabel: "Project item",
      label: "Add project description",
      detail: `${project.name} needs a short description or note.`,
      severity: "medium",
      priority: 32,
      propertyId,
      projectId: project.id,
      surfaces: ["dashboard", "projects", "export"],
      action: projectAction("Add description"),
    }));
  }

  missingProjectDocumentTypes.forEach((documentType, index) => {
    const documentLabel = documentType.label.toLowerCase();
    items.push(createFollowUpItem({
      id: `project:${project.id}:supporting-document:${slugifyId(documentType.value) || index + 1}`,
      type: "project-missing-supporting-documents",
      typeLabel: "Project documents",
      label: `Add ${documentLabel}`,
      detail: `${project.name} is missing a ${documentLabel} document record.`,
      severity: "medium",
      priority: 33 + index,
      propertyId,
      projectId: project.id,
      surfaces: ["dashboard", "projects", "export"],
      action: {
        label: `Add ${documentLabel}`,
        action: "add-document",
        id: project.id,
        projectId: project.id,
        destinationTab: "documents",
        opens: "document form",
        copy: `Opens the document form for this project. Add a ${documentLabel} record and upload the file if you have it.`,
      },
    }));
  });

  if (!missingProjectDocumentTypes.length && !documents.length && !expenses.length) {
    items.push(createFollowUpItem({
      id: `project:${project.id}:supporting-document`,
      type: "project-missing-supporting-documents",
      typeLabel: "Project documents",
      label: "Add supporting document",
      detail: `${project.name} does not have any project documents yet. Add a receipt, invoice, permit, photo, contract, or note if one applies.`,
      severity: "medium",
      priority: 33,
      propertyId,
      projectId: project.id,
      surfaces: ["dashboard", "projects", "export"],
      action: {
        label: "Add supporting document",
        action: "add-document",
        id: project.id,
        projectId: project.id,
        destinationTab: "documents",
        opens: "document form",
        copy: "Opens the document form for this project. Add the specific record you have available.",
      },
    }));
  }

  return items;
}

function getExpenseFollowUpItems(records, expense) {
  const items = [];
  const propertyId = expense.propertyId || "";
  const projectId = expense.projectId || "";
  const expenseName = getExpenseFollowUpName(records, expense);

  if (!expense.vendorId && !expense.vendor) {
    items.push(createFollowUpItem({
      id: `expense:${expense.id}:vendor`,
      type: "expense-missing-vendor",
      typeLabel: "Expense item",
      label: "Add vendor",
      detail: `${expenseName} does not have a vendor or payee yet.`,
      severity: "medium",
      priority: 40,
      propertyId,
      projectId,
      expenseId: expense.id,
      surfaces: ["dashboard", "projects", "export"],
      action: {
        label: "Add vendor",
        action: "edit-expense",
        id: expense.id,
        destinationTab: "expenses",
        opens: "expense form",
      },
    }));
  }

  if (expense.classification === "unclear / ask CPA") {
    items.push(createFollowUpItem({
      id: `expense:${expense.id}:record-treatment`,
      type: "expense-review-treatment",
      typeLabel: "Cost type",
      label: "Review cost type",
      detail: `${expenseName} needs classification before sharing.`,
      severity: "medium",
      priority: 41,
      propertyId,
      projectId,
      expenseId: expense.id,
      surfaces: ["dashboard", "projects", "export"],
      action: {
        label: "Review cost type",
        action: "edit-expense",
        id: expense.id,
        destinationTab: "expenses",
        opens: "expense form",
      },
    }));
  }

  const expectedType = getExpectedExpenseDocumentType(expense);
  const supportLabel = getExpenseSupportLabel(records, expense);
  const linkedExpectedDocument = getLinkedExpenseEvidenceDocuments(records, expense)
    .find((documentRecord) => documentRecord.documentType === expectedType);
  const storedExpectedDocument = getStoredExpenseEvidenceDocument(records, expense);

  if (isDocumentationGap(expense) && !storedExpectedDocument && !linkedExpectedDocument) {
    items.push(createFollowUpItem({
      id: `expense:${expense.id}:document-support`,
      type: "expense-missing-document-support",
      typeLabel: "Expense support",
      label: `Add ${expectedType} for ${supportLabel}`,
      detail: `${expenseName} needs ${expectedType} support. Add a ${expectedType} document record and upload the file if you have it.`,
      severity: "high",
      priority: 10,
      propertyId,
      projectId,
      expenseId: expense.id,
      surfaces: ["dashboard", "projects", "export"],
      action: {
        label: `Add ${expectedType}`,
        action: "add-document-for-expense",
        id: expense.id,
        expenseId: expense.id,
        destinationTab: "documents",
        opens: "document form",
        copy: `Opens the document form with this expense selected. Add a ${expectedType} record and upload the file if you have it.`,
      },
    }));
  }

  if (["receipt attached", "invoice attached"].includes(expense.documentationStatus) && !storedExpectedDocument && !linkedExpectedDocument) {
    items.push(createFollowUpItem({
      id: `expense:${expense.id}:documented-without-support`,
      type: "expense-documented-without-support",
      typeLabel: "Expense support",
      label: `Upload ${expectedType} for ${supportLabel}`,
      detail: `${expenseName} is marked ${optionLabel(DOCUMENT_STATUSES, expense.documentationStatus).toLowerCase()}, but no uploaded ${expectedType} file is linked yet.`,
      severity: "high",
      priority: 11,
      propertyId,
      projectId,
      expenseId: expense.id,
      surfaces: ["dashboard", "projects", "export"],
      action: {
        label: `Upload ${expectedType}`,
        action: "add-document-for-expense",
        id: expense.id,
        expenseId: expense.id,
        destinationTab: "documents",
        opens: "document form",
        copy: `Opens the document form with this expense selected. Add or upload the ${expectedType} file that supports it.`,
      },
    }));
  }

  return items;
}

function getDocumentFollowUpItem(records, documentRecord, options = {}) {
  const propertyId = documentRecord.propertyId || "";
  const projectId = documentRecord.projectId || "";
  const relatedExpense = records.expenses.find((expense) => expense.id === documentRecord.expenseId);
  const documentType = optionLabel(DOCUMENT_TYPES, documentRecord.documentType).toLowerCase();
  const fileLabel = `${documentType} file`;
  const action = {
    label: `Upload ${fileLabel}`,
    action: "edit-document",
    id: documentRecord.id,
    documentId: documentRecord.id,
    destinationTab: "documents",
    opens: "document form",
  };

  if (isTutorialMetadataDocument(documentRecord, options)) {
    return createFollowUpItem({
      id: `document:${documentRecord.id}:tutorial-metadata`,
      type: "document-tutorial-metadata-only",
      typeLabel: "Sample file details",
      label: `Upload ${fileLabel}`,
      detail: `${documentRecord.displayName} only has sample ${fileLabel} details. Use your normal workspace to upload the real file.`,
      severity: "low",
      priority: 90,
      propertyId,
      projectId,
      expenseId: documentRecord.expenseId || "",
      documentId: documentRecord.id,
      surfaces: ["dashboard", "projects", "export"],
      action: {
        ...action,
        label: `Upload ${fileLabel}`,
        copy: `Opens this document record. Upload the missing ${fileLabel}.`,
      },
    });
  }

  if (documentRecord.hasFile) return null;

  const restoredOrMissing = isRestoredDocumentWithoutFile(documentRecord);
  const label = restoredOrMissing ? `Restore or upload ${fileLabel}` : `Upload ${fileLabel}`;
  const detail = relatedExpense
    ? `${documentRecord.displayName} is linked to ${getExpenseFollowUpName(records, relatedExpense)}, but the ${fileLabel} has not been uploaded.`
    : `${documentRecord.displayName} has a document entry, but the ${fileLabel} has not been uploaded.`;

  return createFollowUpItem({
    id: `document:${documentRecord.id}:attached-file`,
    type: restoredOrMissing ? "document-restored-without-file-content" : "document-missing-attached-file",
    typeLabel: restoredOrMissing ? "Restored file" : "Document file",
    label,
    detail: documentRecord.fileStatusNote ? `${detail} ${documentRecord.fileStatusNote}` : detail,
    severity: restoredOrMissing ? "high" : "medium",
    priority: restoredOrMissing ? 12 : 42,
    propertyId,
    projectId,
    expenseId: documentRecord.expenseId || "",
    documentId: documentRecord.id,
    surfaces: ["dashboard", "projects", "export"],
    action: {
      ...action,
      label,
      copy: restoredOrMissing
        ? `Opens this document record. Restore or upload the missing ${fileLabel}.`
        : `Opens this document record. Upload the missing ${fileLabel}.`,
    },
  });
}

function getLinkedExpenseEvidenceDocuments(data, expense) {
  const records = getRecordCollections(data);
  return records.documents.filter((documentRecord) =>
    documentRecord.expenseId === expense.id &&
    ["receipt", "invoice"].includes(documentRecord.documentType)
  );
}

function getStoredExpenseEvidenceDocument(data, expense) {
  const expectedType = getExpectedExpenseDocumentType(expense);
  return getLinkedExpenseEvidenceDocuments(data, expense).find((documentRecord) =>
    documentRecord.hasFile &&
    documentRecord.documentType === expectedType
  );
}

function getExpectedExpenseDocumentType(expense) {
  return expense?.documentationStatus === "invoice attached" ? "invoice" : "receipt";
}

function getExpenseFollowUpName(records, expense) {
  return `${getExpenseVendorName(records, expense, "Expense")} / ${expense.description || "Expense"}`;
}

function getExpenseSupportLabel(records, expense) {
  return getExpenseVendorName(records, expense, expense.description || "expense");
}

function getPlaceholderFollowUpItems(records) {
  const items = [];
  const addItem = ({ id, typeLabel, label, detail, propertyId = "", projectId = "", expenseId = "", documentId = "", action }) => {
    items.push(createFollowUpItem({
      id,
      type: "record-placeholder-content",
      typeLabel,
      label,
      detail,
      severity: "medium",
      priority: 14,
      propertyId,
      projectId,
      expenseId,
      documentId,
      surfaces: ["export"],
      action,
    }));
  };

  records.properties.forEach((property) => {
    if (isPlaceholderReviewValue(property.notes)) {
      addItem({
        id: `property:${property.id}:placeholder:notes`,
        typeLabel: "Needs review",
        label: "Review property notes",
        detail: `${property.name} has possible draft or test content in property notes.`,
        propertyId: property.id,
        action: {
          label: "Review notes",
          action: "edit-property-field",
          id: property.id,
          field: "notes",
          destinationTab: "property",
          opens: "property notes",
        },
      });
    }
  });

  records.projects.forEach((project) => {
    [
      ["scopeSummary", "project description", project.scopeSummary],
      ["notes", "project notes", project.notes],
      ["contractor", "contractor or payee", project.contractor],
      ["permitNumber", "permit number", project.permitNumber],
    ].forEach(([field, label, value]) => {
      if (!isPlaceholderReviewValue(value)) return;
      addItem({
        id: `project:${project.id}:placeholder:${field}`,
        typeLabel: "Needs review",
        label: `Review ${label}`,
        detail: `${project.name} has possible draft or test content in ${label}.`,
        propertyId: project.propertyId,
        projectId: project.id,
        action: {
          label: `Review ${label}`,
          action: "edit-project",
          id: project.id,
          field,
          destinationTab: "projects",
          opens: "project form",
        },
      });
    });
  });

  records.expenses.forEach((expense) => {
    [
      ["vendor", "vendor or payee", expense.vendor],
      ["notes", "expense notes", expense.notes],
    ].forEach(([field, label, value]) => {
      if (!isPlaceholderReviewValue(value)) return;
      addItem({
        id: `expense:${expense.id}:placeholder:${field}`,
        typeLabel: "Needs review",
        label: `Review ${label}`,
        detail: `${expense.description} has possible draft or test content in ${label}.`,
        propertyId: expense.propertyId,
        projectId: expense.projectId,
        expenseId: expense.id,
        action: {
          label: `Review ${label}`,
          action: "edit-expense",
          id: expense.id,
          field,
          destinationTab: "expenses",
          opens: "expense form",
        },
      });
    });
  });

  records.documents.forEach((documentRecord) => {
    if (isPlaceholderReviewValue(documentRecord.displayName)) {
      addItem({
        id: `document:${documentRecord.id}:placeholder:title`,
        typeLabel: "Needs review",
        label: "Review document title",
        detail: `${documentRecord.displayName} looks like draft or test content. Rename the document before sharing the packet.`,
        propertyId: documentRecord.propertyId,
        projectId: documentRecord.projectId,
        expenseId: documentRecord.expenseId,
        documentId: documentRecord.id,
        action: {
          label: "Review title",
          action: "edit-document",
          id: documentRecord.id,
          field: "displayName",
          destinationTab: "documents",
          opens: "document form",
        },
      });
    }
  });

  return items;
}

function isSupportFollowUpItem(item) {
  return [
    "project-missing-supporting-documents",
    "expense-missing-document-support",
    "expense-documented-without-support",
    "document-missing-attached-file",
    "document-restored-without-file-content",
    "document-tutorial-metadata-only",
  ].includes(item?.type);
}

function countLinkedExpenseProofFiles(records) {
  return records.expenses.reduce((total, expense) => {
    const expectedType = getExpectedExpenseDocumentType(expense);
    return total + getLinkedExpenseEvidenceDocuments(records, expense).filter((documentRecord) =>
      documentRecord.hasFile &&
      documentRecord.documentType === expectedType
    ).length;
  }, 0);
}

function getDismissedItemCopy(count) {
  if (!count) return "No dismissed items.";
  return `${count} dismissed item${count === 1 ? " is" : "s are"} excluded from open counts.`;
}

function isRestoredDocumentWithoutFile(documentRecord) {
  return /restored|skipped|not included|not restored/i.test(documentRecord?.fileStatusNote || "");
}

function isTutorialMetadataDocument(documentRecord, options = {}) {
  return Boolean(options.tutorialMode && (
    /^tutorial-file-/i.test(String(documentRecord?.fileId || documentRecord?.id || "")) ||
    /tutorial sample|tutorial file metadata|sample metadata/i.test(documentRecord?.fileStatusNote || "")
  ));
}

function humanList(items) {
  const values = items.filter(Boolean);
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function compareFollowUpItems(firstItem, secondItem) {
  if (firstItem.priority !== secondItem.priority) return firstItem.priority - secondItem.priority;
  return String(firstItem.id).localeCompare(String(secondItem.id));
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
    expectedTypes.push({ value: "payment record", label: "Payment proof" });
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
    "Cost type",
    "Documentation",
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
    getProfessionalClassificationLabel(expense.classification),
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
