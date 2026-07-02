import { createHash } from "node:crypto";
import { apiError, validationError } from "./errors.js";

const FOLLOW_UP_ID_PATTERN = /^fu_[a-f0-9]{32}$/;
const RESOLVE_INPUT_FIELDS = new Set(["note"]);
const REOPEN_INPUT_FIELDS = new Set([]);
const OVERRIDE_NOTE_MAX_LENGTH = 1000;
const CONTRACT_REVIEW_THRESHOLD_CENTS = 100000;

const SEVERITY_ORDER = {
  missing_file: 10,
  needs_review: 20,
  missing_info: 30,
  info: 40
};

const TARGET_ORDER = {
  property: 10,
  project: 20,
  expense: 30,
  document: 40,
  vendor: 50
};

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
  "windows/doors"
]);

const DOCUMENT_TYPE_LABELS = {
  receipt: "receipt",
  invoice: "invoice",
  permit: "permit or approval",
  contract: "contract or estimate",
  photo: "before/after photo",
  "payment record": "payment proof",
  warranty: "warranty",
  appraisal: "appraisal",
  inspection: "inspection",
  "plan or drawing": "plan or drawing",
  other: "document"
};

const SUMMARY_BUCKETS = {
  property: { type: "property_items", label: "Property items" },
  project: { type: "project_items", label: "Project items" },
  expense: { type: "expense_items", label: "Expense items" },
  document: { type: "document_items", label: "Document items" }
};

export async function listFollowUps({ db, workspaceId, status = "open" }) {
  const normalizedStatus = normalizeStatus(status);
  const state = await loadFollowUpState({ db, workspaceId });
  return filterFollowUps(applyOverrides(generateFollowUps(state), state.overrides), normalizedStatus);
}

export async function getFollowUpSummary({ db, workspaceId }) {
  const items = await listFollowUps({ db, workspaceId, status: "all" });
  const openItems = items.filter((item) => item.status === "open");
  const resolvedItems = items.filter((item) => item.status === "resolved");

  return {
    workspace_id: workspaceId,
    generated_at: new Date().toISOString(),
    open_count: openItems.length,
    resolved_count: resolvedItems.length,
    by_type: groupFollowUps(openItems, bucketForFollowUp),
    by_severity: groupFollowUps(openItems, (item) => ({
      type: item.severity,
      label: severityLabel(item.severity)
    }))
  };
}

export async function resolveFollowUp({ db, workspaceId, followUpId, input, actorUserId }) {
  validateFollowUpId(followUpId);
  const { note } = validateResolveInput(input);
  const state = await loadFollowUpState({ db, workspaceId });
  const generated = generateFollowUps(state);
  const existingItem = generated.find((item) => item.id === followUpId);

  if (!existingItem) {
    throw apiError(404, "not_found", "Follow-up not found.");
  }

  const existingOverride = findOverrideForItem(state.overrides, existingItem);
  const override = existingOverride || await createFollowUpOverride({
    db,
    workspaceId,
    followUp: existingItem,
    note,
    actorUserId
  });

  return {
    ...existingItem,
    status: "resolved",
    resolved_at: formatTimestamp(override.completed_at),
    created_at: formatTimestamp(override.created_at),
    updated_at: formatTimestamp(override.updated_at)
  };
}

export async function reopenFollowUp({ db, workspaceId, followUpId, input }) {
  validateFollowUpId(followUpId);
  validateReopenInput(input);

  const result = await db.query(
    `
      -- reopenFollowUpOverride
      UPDATE follow_up_overrides
      SET invalidated_at = now(),
          updated_at = now()
      WHERE workspace_id = $1
        AND source_follow_up_id = $2
        AND invalidated_at IS NULL
      RETURNING id
    `,
    [workspaceId, followUpId]
  );

  if (!result.rows[0]) {
    throw apiError(404, "not_found", "Follow-up override not found.");
  }

  const state = await loadFollowUpState({ db, workspaceId });
  const item = generateFollowUps(state).find((followUp) => followUp.id === followUpId);

  return item ? { ...item, status: "open" } : {
    id: followUpId,
    status: "open"
  };
}

export async function addOpenItemCounts({ db, workspaceId, projects = [], expenses = [], documents = [] }) {
  if (!projects.length && !expenses.length && !documents.length) {
    return { projects, expenses, documents };
  }

  const openItems = await listFollowUps({ db, workspaceId, status: "open" });
  const projectCounts = countBy(openItems, "project_id");
  const expenseCounts = countBy(openItems, "expense_id");
  const documentCounts = countBy(openItems, "document_id");

  return {
    projects: projects.map((project) => ({
      ...project,
      openItemCount: projectCounts.get(project.id) || 0
    })),
    expenses: expenses.map((expense) => ({
      ...expense,
      openItemCount: expenseCounts.get(expense.id) || 0
    })),
    documents: documents.map((document) => ({
      ...document,
      openItemCount: documentCounts.get(document.id) || 0
    }))
  };
}

export function serializeFollowUp(followUp) {
  return {
    id: followUp.id,
    target_type: followUp.target_type,
    target_id: followUp.target_id,
    property_id: followUp.property_id,
    project_id: followUp.project_id,
    expense_id: followUp.expense_id,
    document_id: followUp.document_id,
    severity: followUp.severity,
    reason_code: followUp.reason_code,
    title: followUp.title,
    description: followUp.description,
    action_label: followUp.action_label,
    status: followUp.status || "open",
    source: followUp.source || "generated",
    created_from: followUp.created_from || "current_records",
    resolved_at: followUp.resolved_at || null,
    created_at: followUp.created_at || null,
    updated_at: followUp.updated_at || null
  };
}

async function loadFollowUpState({ db, workspaceId }) {
  const [properties, projects, expenses, documents, overrides] = await Promise.all([
    db.query(
      `
        -- listFollowUpProperties
        SELECT
          id,
          name,
          purchase_date,
          purchase_price_cents,
          created_at,
          updated_at
        FROM properties
        WHERE workspace_id = $1
          AND deleted_at IS NULL
          AND archived_at IS NULL
        ORDER BY name ASC, id ASC
      `,
      [workspaceId]
    ),
    db.query(
      `
        -- listFollowUpProjects
        SELECT
          pr.id,
          pr.property_id,
          p.name AS property_name,
          pr.vendor_id,
          v.name AS vendor_name,
          pr.name,
          pr.category,
          pr.status,
          pr.start_date,
          pr.completion_date,
          pr.contractor_name_raw,
          pr.permit_number,
          pr.scope_summary,
          pr.notes,
          pr.completeness_override_note,
          pr.created_at,
          pr.updated_at
        FROM projects pr
        JOIN properties p
          ON p.workspace_id = pr.workspace_id
         AND p.id = pr.property_id
        LEFT JOIN vendors v
          ON v.workspace_id = pr.workspace_id
         AND v.id = pr.vendor_id
        WHERE pr.workspace_id = $1
          AND pr.deleted_at IS NULL
          AND pr.archived_at IS NULL
        ORDER BY pr.name ASC, pr.id ASC
      `,
      [workspaceId]
    ),
    db.query(
      `
        -- listFollowUpExpenses
        SELECT
          e.id,
          e.property_id,
          p.name AS property_name,
          e.project_id,
          pr.name AS project_name,
          e.vendor_id,
          v.name AS vendor_name,
          e.vendor_name_raw,
          e.description,
          e.amount_cents,
          e.category,
          e.record_treatment,
          e.documentation_status,
          e.created_at,
          e.updated_at
        FROM expenses e
        JOIN properties p
          ON p.workspace_id = e.workspace_id
         AND p.id = e.property_id
        LEFT JOIN projects pr
          ON pr.workspace_id = e.workspace_id
         AND pr.id = e.project_id
        LEFT JOIN vendors v
          ON v.workspace_id = e.workspace_id
         AND v.id = e.vendor_id
        WHERE e.workspace_id = $1
          AND e.deleted_at IS NULL
        ORDER BY e.created_at DESC, e.id ASC
      `,
      [workspaceId]
    ),
    db.query(
      `
        -- listFollowUpDocuments
        SELECT
          d.id,
          d.property_id,
          p.name AS property_name,
          d.project_id,
          pr.name AS project_name,
          d.expense_id,
          e.description AS expense_description,
          d.display_name,
          d.document_type,
          d.file_availability,
          d.file_status_note,
          d.created_at,
          d.updated_at,
          f.id AS file_id,
          f.status AS file_status,
          o.status AS ocr_status
        FROM documents d
        JOIN properties p
          ON p.workspace_id = d.workspace_id
         AND p.id = d.property_id
        LEFT JOIN projects pr
          ON pr.workspace_id = d.workspace_id
         AND pr.id = d.project_id
        LEFT JOIN expenses e
          ON e.workspace_id = d.workspace_id
         AND e.id = d.expense_id
        LEFT JOIN LATERAL (
          SELECT df.id, df.status
          FROM document_files df
          WHERE df.workspace_id = d.workspace_id
            AND df.document_id = d.id
            AND df.deleted_at IS NULL
          ORDER BY CASE WHEN df.status = 'available' THEN 0 ELSE 1 END, df.created_at DESC, df.id ASC
          LIMIT 1
        ) f ON true
        LEFT JOIN document_ocr o
          ON o.workspace_id = d.workspace_id
         AND o.document_id = d.id
        WHERE d.workspace_id = $1
          AND d.deleted_at IS NULL
        ORDER BY d.display_name ASC, d.id ASC
      `,
      [workspaceId]
    ),
    db.query(
      `
        -- listActiveFollowUpOverrides
        SELECT
          id,
          follow_up_type,
          source_follow_up_id,
          property_id,
          project_id,
          expense_id,
          document_id,
          label_snapshot,
          detail_snapshot,
          note,
          completed_at,
          created_at,
          updated_at
        FROM follow_up_overrides
        WHERE workspace_id = $1
          AND invalidated_at IS NULL
        ORDER BY completed_at DESC, id ASC
      `,
      [workspaceId]
    )
  ]);

  return {
    workspaceId,
    properties: properties.rows.map(mapProperty),
    projects: projects.rows.map(mapProject),
    expenses: expenses.rows.map(mapExpense),
    documents: documents.rows.map(mapDocument),
    overrides: overrides.rows.map(mapOverride)
  };
}

function generateFollowUps(state) {
  const items = [];
  const records = {
    properties: state.properties,
    projects: state.projects,
    expenses: state.expenses,
    documents: state.documents,
    expensesById: new Map(state.expenses.map((expense) => [expense.id, expense]))
  };

  for (const property of state.properties) {
    if (!property.purchaseDate) {
      items.push(createFollowUp(state, {
        targetType: "property",
        targetId: property.id,
        propertyId: property.id,
        reasonCode: "property_missing_purchase_date",
        severity: "missing_info",
        title: "Add purchase date",
        description: `${property.name} is missing a purchase date.`,
        actionLabel: "Add purchase date",
        priority: 20
      }));
    }
    if (!property.purchasePriceCents) {
      items.push(createFollowUp(state, {
        targetType: "property",
        targetId: property.id,
        propertyId: property.id,
        reasonCode: "property_missing_purchase_price",
        severity: "missing_info",
        title: "Add purchase price",
        description: `${property.name} is missing a purchase price.`,
        actionLabel: "Add purchase price",
        priority: 21
      }));
    }
  }

  for (const project of state.projects) {
    if (!project.completenessOverrideNote) {
      items.push(...getProjectFollowUps(state, records, project));
    }
  }

  for (const expense of state.expenses) {
    items.push(...getExpenseFollowUps(state, records, expense));
  }

  for (const document of state.documents) {
    const item = getDocumentFollowUp(state, records, document);
    if (item) items.push(item);
    const ocrItem = getOcrFollowUp(state, document);
    if (ocrItem) items.push(ocrItem);
  }

  return dedupeFollowUps(items).sort(compareFollowUps);
}

function getProjectFollowUps(state, records, project) {
  const items = [];
  const projectExpenses = records.expenses.filter((expense) => expense.projectId === project.id);
  const projectDocuments = records.documents.filter((document) => document.projectId === project.id);
  const totalSpendCents = projectExpenses.reduce((total, expense) => total + Number(expense.amountCents || 0), 0);
  const hasVendor = Boolean(project.vendorId || project.contractorNameRaw || projectExpenses.some((expense) => expense.vendorId || expense.vendorNameRaw));

  if (!hasVendor) {
    items.push(createFollowUp(state, {
      targetType: "project",
      targetId: project.id,
      propertyId: project.propertyId,
      projectId: project.id,
      reasonCode: "project_missing_vendor",
      severity: "missing_info",
      title: "Add project vendor",
      description: `${project.name} does not have a vendor linked yet.`,
      actionLabel: "Add vendor",
      priority: 30
    }));
  }

  const missingDates = [
    !project.startDate ? "start date" : "",
    ["completed", "archived"].includes(project.status) && !project.completionDate ? "completion date" : ""
  ].filter(Boolean);
  if (missingDates.length) {
    items.push(createFollowUp(state, {
      targetType: "project",
      targetId: project.id,
      propertyId: project.propertyId,
      projectId: project.id,
      reasonCode: "project_missing_dates",
      severity: "missing_info",
      title: missingDates.length === 2 ? "Add project dates" : `Add ${missingDates[0]}`,
      description: `${project.name} is missing ${humanList(missingDates)}.`,
      actionLabel: "Add project dates",
      priority: 31
    }));
  }

  if (!project.scopeSummary && !project.notes) {
    items.push(createFollowUp(state, {
      targetType: "project",
      targetId: project.id,
      propertyId: project.propertyId,
      projectId: project.id,
      reasonCode: "project_missing_scope",
      severity: "missing_info",
      title: "Add project description",
      description: `${project.name} needs a short description or note.`,
      actionLabel: "Add description",
      priority: 32
    }));
  }

  const missingTypes = getMissingProjectDocumentTypes(project, projectDocuments, projectExpenses, totalSpendCents)
    .filter((type) => !["receipt_or_invoice", "payment_record"].includes(type.value));

  missingTypes.forEach((documentType, index) => {
    items.push(createFollowUp(state, {
      targetType: "project",
      targetId: project.id,
      propertyId: project.propertyId,
      projectId: project.id,
      reasonCode: documentType.reasonCode,
      severity: "missing_file",
      title: `Add ${documentType.label}`,
      description: `${project.name} is missing a ${documentType.label} document record.`,
      actionLabel: `Add ${documentType.label}`,
      qualifier: documentType.value,
      priority: 33 + index
    }));
  });

  if (!missingTypes.length && !projectDocuments.length && !projectExpenses.length) {
    items.push(createFollowUp(state, {
      targetType: "project",
      targetId: project.id,
      propertyId: project.propertyId,
      projectId: project.id,
      reasonCode: "project_missing_supporting_document",
      severity: "missing_file",
      title: "Add supporting document",
      description: `${project.name} does not have any project documents yet. Add a receipt, invoice, permit, photo, contract, or note if one applies.`,
      actionLabel: "Add supporting document",
      priority: 33
    }));
  }

  return items;
}

function getExpenseFollowUps(state, records, expense) {
  const items = [];
  const expenseName = getExpenseFollowUpName(expense);

  if (!expense.vendorId && !expense.vendorNameRaw) {
    items.push(createFollowUp(state, {
      targetType: "expense",
      targetId: expense.id,
      propertyId: expense.propertyId,
      projectId: expense.projectId,
      expenseId: expense.id,
      reasonCode: "expense_missing_vendor",
      severity: "missing_info",
      title: "Add vendor",
      description: `${expenseName} does not have a vendor or payee yet.`,
      actionLabel: "Add vendor",
      priority: 40
    }));
  }

  if (expense.recordTreatment === "review_later") {
    items.push(createFollowUp(state, {
      targetType: "expense",
      targetId: expense.id,
      propertyId: expense.propertyId,
      projectId: expense.projectId,
      expenseId: expense.id,
      reasonCode: "expense_review_later",
      severity: "needs_review",
      title: "Review cost type",
      description: `${expenseName} is marked Review later.`,
      actionLabel: "Review cost type",
      priority: 41
    }));
  }

  const expectedType = getExpectedExpenseDocumentType(expense);
  const linkedExpectedDocument = getLinkedExpenseEvidenceDocuments(records, expense)
    .find((document) => document.documentType === expectedType);
  const storedExpectedDocument = getStoredExpenseEvidenceDocument(records, expense);
  const supportLabel = getExpenseSupportLabel(expense);

  if (["no_document_yet", "needs_follow_up"].includes(expense.documentationStatus) && !storedExpectedDocument && !linkedExpectedDocument) {
    items.push(createFollowUp(state, {
      targetType: "expense",
      targetId: expense.id,
      propertyId: expense.propertyId,
      projectId: expense.projectId,
      expenseId: expense.id,
      reasonCode: "expense_missing_document_support",
      severity: "missing_file",
      title: `Add ${expectedType} for ${supportLabel}`,
      description: `${expenseName} needs ${expectedType} support. Add a ${expectedType} document record and upload the file if you have it.`,
      actionLabel: `Add ${expectedType}`,
      qualifier: expectedType,
      priority: 10
    }));
  }

  if (["receipt_attached", "invoice_attached"].includes(expense.documentationStatus) && !storedExpectedDocument && !linkedExpectedDocument) {
    items.push(createFollowUp(state, {
      targetType: "expense",
      targetId: expense.id,
      propertyId: expense.propertyId,
      projectId: expense.projectId,
      expenseId: expense.id,
      reasonCode: "expense_documented_without_support",
      severity: "missing_file",
      title: `Upload ${expectedType} for ${supportLabel}`,
      description: `${expenseName} is marked ${documentationStatusLabel(expense.documentationStatus).toLowerCase()}, but no uploaded ${expectedType} file is linked yet.`,
      actionLabel: `Upload ${expectedType}`,
      qualifier: expectedType,
      priority: 11
    }));
  }

  return items;
}

function getDocumentFollowUp(state, records, document) {
  if (document.hasAvailableFile) return null;

  const relatedExpense = records.expensesById.get(document.expenseId);
  const fileLabel = `${documentTypeLabel(document.documentType)} file`;
  const restoredOrMissing = /restored|skipped|not included|not restored/i.test(document.fileStatusNote || "") ||
    ["missing", "skipped", "corrupt", "checksum_failed"].includes(document.fileAvailability);
  const title = restoredOrMissing ? `Restore or upload ${fileLabel}` : `Upload ${fileLabel}`;
  const baseDescription = relatedExpense
    ? `${document.displayName} is linked to ${getExpenseFollowUpName(relatedExpense)}, but the ${fileLabel} has not been uploaded.`
    : `${document.displayName} has a document entry, but the ${fileLabel} has not been uploaded.`;

  return createFollowUp(state, {
    targetType: "document",
    targetId: document.id,
    propertyId: document.propertyId,
    projectId: document.projectId,
    expenseId: document.expenseId,
    documentId: document.id,
    reasonCode: "document_missing_file",
    severity: "missing_file",
    title,
    description: document.fileStatusNote ? `${baseDescription} ${document.fileStatusNote}` : baseDescription,
    actionLabel: title,
    priority: restoredOrMissing ? 12 : 42
  });
}

function getOcrFollowUp(state, document) {
  if (!document.hasAvailableFile || !["queued", "processing"].includes(document.ocrStatus)) {
    return null;
  }

  return createFollowUp(state, {
    targetType: "document",
    targetId: document.id,
    propertyId: document.propertyId,
    projectId: document.projectId,
    expenseId: document.expenseId,
    documentId: document.id,
    reasonCode: "document_ocr_pending",
    severity: "info",
    title: "Text extraction pending",
    description: `${document.displayName} is waiting for text extraction to finish.`,
    actionLabel: "Review OCR status",
    priority: 80
  });
}

function createFollowUp(state, {
  targetType,
  targetId,
  propertyId = null,
  projectId = null,
  expenseId = null,
  documentId = null,
  reasonCode,
  severity,
  title,
  description,
  actionLabel,
  qualifier = "",
  priority = 50
}) {
  const canonical = [
    state.workspaceId,
    reasonCode,
    propertyId || "",
    projectId || "",
    expenseId || "",
    documentId || "",
    qualifier || ""
  ].join("|");

  return {
    id: `fu_${sha256(canonical).slice(0, 32)}`,
    target_type: targetType,
    target_id: targetId,
    property_id: propertyId || null,
    project_id: projectId || null,
    expense_id: expenseId || null,
    document_id: documentId || null,
    severity,
    reason_code: reasonCode,
    title,
    description,
    action_label: actionLabel,
    status: "open",
    source: "generated",
    created_from: "current_records",
    priority
  };
}

function applyOverrides(items, overrides) {
  return items.map((item) => {
    const override = findOverrideForItem(overrides, item);
    if (!override) return item;
    return {
      ...item,
      status: "resolved",
      resolved_at: formatTimestamp(override.completed_at),
      created_at: formatTimestamp(override.created_at),
      updated_at: formatTimestamp(override.updated_at)
    };
  });
}

async function createFollowUpOverride({ db, workspaceId, followUp, note, actorUserId }) {
  const existing = await db.query(
    `
      -- findActiveFollowUpOverrideBySource
      SELECT
        id,
        completed_at,
        created_at,
        updated_at
      FROM follow_up_overrides
      WHERE workspace_id = $1
        AND source_follow_up_id = $2
        AND invalidated_at IS NULL
      LIMIT 1
    `,
    [workspaceId, followUp.id]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const result = await db.query(
    `
      -- createFollowUpOverride
      INSERT INTO follow_up_overrides (
        workspace_id,
        follow_up_type,
        source_follow_up_id,
        property_id,
        project_id,
        expense_id,
        document_id,
        label_snapshot,
        detail_snapshot,
        note,
        completed_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id,
        completed_at,
        created_at,
        updated_at
    `,
    [
      workspaceId,
      followUp.reason_code,
      followUp.id,
      followUp.property_id,
      followUp.project_id,
      followUp.expense_id,
      followUp.document_id,
      followUp.title,
      followUp.description,
      note,
      actorUserId
    ]
  );

  return result.rows[0];
}

function findOverrideForItem(overrides, item) {
  return overrides.find((override) =>
    override.source_follow_up_id === item.id ||
    (
      override.follow_up_type === item.reason_code &&
      nullableEquals(override.property_id, item.property_id) &&
      nullableEquals(override.project_id, item.project_id) &&
      nullableEquals(override.expense_id, item.expense_id) &&
      nullableEquals(override.document_id, item.document_id)
    )
  ) || null;
}

function filterFollowUps(items, status) {
  if (status === "all") return items;
  return items.filter((item) => item.status === status);
}

function normalizeStatus(status) {
  const normalized = String(status || "open").trim();
  if (!["open", "resolved", "all"].includes(normalized)) {
    throw apiError(400, "invalid_request", "Invalid follow-up status.");
  }
  return normalized;
}

function validateFollowUpId(followUpId) {
  if (!FOLLOW_UP_ID_PATTERN.test(String(followUpId || ""))) {
    throw apiError(400, "invalid_request", "Invalid follow-up id.");
  }
  return followUpId;
}

function validateResolveInput(input) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const details = [];

  for (const key of Object.keys(body)) {
    if (!RESOLVE_INPUT_FIELDS.has(key)) {
      details.push({ field: key, issue: "unknown_field" });
    }
  }

  const note = normalizeNullableText(body.note);
  if (note && note.length > OVERRIDE_NOTE_MAX_LENGTH) {
    details.push({ field: "note", issue: "too_long" });
  }

  if (details.length) {
    throw validationError(details);
  }

  return { note };
}

function validateReopenInput(input) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const details = [];

  for (const key of Object.keys(body)) {
    if (!REOPEN_INPUT_FIELDS.has(key)) {
      details.push({ field: key, issue: "unknown_field" });
    }
  }

  if (details.length) {
    throw validationError(details);
  }
}

function getMissingProjectDocumentTypes(project, documents, expenses, totalSpendCents) {
  return getExpectedProjectDocumentTypes(project, expenses, totalSpendCents).filter((type) => {
    if (type.value === "receipt_or_invoice") {
      return !documents.some((document) =>
        ["receipt", "invoice"].includes(document.documentType) &&
        document.hasAvailableFile
      );
    }
    if (type.value === "permit") {
      return !project.permitNumber && !documents.some((document) => document.documentType === "permit");
    }
    return !documents.some((document) => document.documentType === type.documentType);
  });
}

function getExpectedProjectDocumentTypes(project, expenses, totalSpendCents) {
  const expectedTypes = [];
  if (expenses.length) {
    expectedTypes.push({ value: "receipt_or_invoice", documentType: "receipt", label: "receipt or invoice", reasonCode: "project_missing_receipt_or_invoice" });
  }
  if (project.permitNumber || PERMIT_LIKELY_CATEGORIES.has(project.category)) {
    expectedTypes.push({ value: "permit", documentType: "permit", label: "permit or approval", reasonCode: "project_missing_permit_or_approval" });
  }
  if (project.vendorId || project.contractorNameRaw || totalSpendCents >= CONTRACT_REVIEW_THRESHOLD_CENTS) {
    expectedTypes.push({ value: "contract", documentType: "contract", label: "contract or estimate", reasonCode: "project_missing_contract_or_estimate" });
  }
  if (project.status === "completed") {
    expectedTypes.push({ value: "photo", documentType: "photo", label: "before/after photo", reasonCode: "project_missing_before_after_photo" });
  }
  if (expenses.length) {
    expectedTypes.push({ value: "payment_record", documentType: "payment record", label: "payment proof", reasonCode: "project_missing_payment_proof" });
  }

  const seen = new Set();
  return expectedTypes.filter((type) => {
    if (seen.has(type.value)) return false;
    seen.add(type.value);
    return true;
  });
}

function getLinkedExpenseEvidenceDocuments(records, expense) {
  return records.documents.filter((document) =>
    document.expenseId === expense.id &&
    ["receipt", "invoice"].includes(document.documentType)
  );
}

function getStoredExpenseEvidenceDocument(records, expense) {
  const expectedType = getExpectedExpenseDocumentType(expense);
  return getLinkedExpenseEvidenceDocuments(records, expense).find((document) =>
    document.hasAvailableFile &&
    document.documentType === expectedType
  );
}

function getExpectedExpenseDocumentType(expense) {
  return expense.documentationStatus === "invoice_attached" ? "invoice" : "receipt";
}

function getExpenseFollowUpName(expense) {
  return `${getExpenseVendorName(expense, "Expense")} / ${expense.description || "Expense"}`;
}

function getExpenseSupportLabel(expense) {
  return getExpenseVendorName(expense, expense.description || "expense");
}

function getExpenseVendorName(expense, fallback) {
  return expense.vendorName || expense.vendorNameRaw || fallback;
}

function documentTypeLabel(value) {
  return DOCUMENT_TYPE_LABELS[value] || value || "document";
}

function documentationStatusLabel(value) {
  const labels = {
    receipt_attached: "Receipt attached",
    invoice_attached: "Invoice attached",
    no_document_yet: "No document yet",
    needs_follow_up: "Needs follow-up"
  };
  return labels[value] || value;
}

function bucketForFollowUp(item) {
  return SUMMARY_BUCKETS[item.target_type] || { type: "follow_up", label: "Follow-up" };
}

function severityLabel(value) {
  const labels = {
    missing_file: "Missing file",
    needs_review: "Needs review",
    missing_info: "Missing information",
    info: "Informational"
  };
  return labels[value] || value;
}

function groupFollowUps(items, getBucket) {
  const groups = new Map();
  for (const item of items) {
    const bucket = getBucket(item);
    const current = groups.get(bucket.type) || { type: bucket.type, label: bucket.label, count: 0 };
    current.count += 1;
    groups.set(bucket.type, current);
  }
  return [...groups.values()].sort((left, right) => left.type.localeCompare(right.type));
}

function countBy(items, field) {
  const counts = new Map();
  for (const item of items) {
    const value = item[field];
    if (value) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return counts;
}

function dedupeFollowUps(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  return deduped;
}

function compareFollowUps(first, second) {
  return SEVERITY_ORDER[first.severity] - SEVERITY_ORDER[second.severity] ||
    first.priority - second.priority ||
    String(first.property_id || "").localeCompare(String(second.property_id || "")) ||
    String(first.project_id || "").localeCompare(String(second.project_id || "")) ||
    TARGET_ORDER[first.target_type] - TARGET_ORDER[second.target_type] ||
    first.reason_code.localeCompare(second.reason_code) ||
    first.title.localeCompare(second.title) ||
    first.id.localeCompare(second.id);
}

function humanList(items) {
  const values = items.filter(Boolean);
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function mapProperty(row) {
  return {
    id: row.id,
    name: row.name,
    purchaseDate: formatDateOnly(row.purchase_date),
    purchasePriceCents: row.purchase_price_cents === null || row.purchase_price_cents === undefined
      ? null
      : Number(row.purchase_price_cents)
  };
}

function mapProject(row) {
  return {
    id: row.id,
    propertyId: row.property_id,
    propertyName: row.property_name || null,
    vendorId: row.vendor_id || null,
    vendorName: row.vendor_name || null,
    name: row.name,
    category: row.category,
    status: row.status,
    startDate: formatDateOnly(row.start_date),
    completionDate: formatDateOnly(row.completion_date),
    contractorNameRaw: row.contractor_name_raw || null,
    permitNumber: row.permit_number || null,
    scopeSummary: row.scope_summary || null,
    notes: row.notes || null,
    completenessOverrideNote: row.completeness_override_note || null
  };
}

function mapExpense(row) {
  return {
    id: row.id,
    propertyId: row.property_id,
    propertyName: row.property_name || null,
    projectId: row.project_id || null,
    projectName: row.project_name || null,
    vendorId: row.vendor_id || null,
    vendorName: row.vendor_name || null,
    vendorNameRaw: row.vendor_name_raw || null,
    description: row.description,
    amountCents: Number(row.amount_cents || 0),
    category: row.category,
    recordTreatment: row.record_treatment,
    documentationStatus: row.documentation_status
  };
}

function mapDocument(row) {
  const fileStatus = row.file_status || null;
  return {
    id: row.id,
    propertyId: row.property_id,
    propertyName: row.property_name || null,
    projectId: row.project_id || null,
    projectName: row.project_name || null,
    expenseId: row.expense_id || null,
    expenseDescription: row.expense_description || null,
    displayName: row.display_name,
    documentType: row.document_type,
    fileAvailability: row.file_availability,
    fileStatusNote: row.file_status_note || null,
    fileId: row.file_id || null,
    fileStatus,
    hasAvailableFile: fileStatus === "available",
    ocrStatus: row.ocr_status || "not_requested"
  };
}

function mapOverride(row) {
  return {
    id: row.id,
    follow_up_type: row.follow_up_type,
    source_follow_up_id: row.source_follow_up_id || null,
    property_id: row.property_id || null,
    project_id: row.project_id || null,
    expense_id: row.expense_id || null,
    document_id: row.document_id || null,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function nullableEquals(left, right) {
  return (left || null) === (right || null);
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function formatDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
