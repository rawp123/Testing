import { apiError, validationError } from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DESCRIPTION_MAX_LENGTH = 5000;
const CATEGORY_MAX_LENGTH = 120;
const VENDOR_NAME_RAW_MAX_LENGTH = 200;
const NOTES_MAX_LENGTH = 5000;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const RECORD_TREATMENTS = new Set(["possible_improvement", "repair_upkeep", "review_later"]);
const DOCUMENTATION_STATUSES = new Set(["receipt_attached", "invoice_attached", "no_document_yet", "needs_follow_up"]);
const EXPENSE_INPUT_FIELDS = new Set([
  "property_id",
  "project_id",
  "vendor_id",
  "vendor_name_raw",
  "expense_date",
  "description",
  "amount_cents",
  "currency_code",
  "category",
  "record_treatment",
  "documentation_status",
  "notes"
]);

const SORTS = {
  date_desc: "e.expense_date DESC NULLS LAST, e.created_at DESC, e.id ASC",
  date_asc: "e.expense_date ASC NULLS LAST, e.id ASC",
  amount_desc: "e.amount_cents DESC, e.id ASC",
  amount_asc: "e.amount_cents ASC, e.id ASC",
  vendor_asc: "COALESCE(v.name, e.vendor_name_raw, '') ASC, e.expense_date DESC NULLS LAST, e.id ASC",
  category_asc: "e.category ASC, e.expense_date DESC NULLS LAST, e.id ASC",
  created_desc: "e.created_at DESC, e.id ASC",
  updated_desc: "e.updated_at DESC, e.id ASC"
};

export async function listExpenses({ db, workspaceId, filters = {}, pagination = {}, sort }) {
  const query = buildListQuery({ workspaceId, filters, pagination, sort });
  const result = await db.query(query.sql, query.params);
  const totalCount = result.rows[0]?.total_count ? Number(result.rows[0].total_count) : 0;

  return {
    data: result.rows.map(mapExpenseRow),
    meta: {
      limit: query.limit,
      offset: query.offset,
      total_count: totalCount
    }
  };
}

export async function getExpenseById({ db, workspaceId, expenseId }) {
  validateExpenseId(expenseId);
  const result = await db.query(
    `
      -- getExpenseById
      SELECT ${expenseColumns()}
      FROM expenses e
      ${expenseJoins()}
      WHERE e.workspace_id = $1
        AND e.id = $2
        AND e.deleted_at IS NULL
      GROUP BY ${expenseGroupByColumns()}
      LIMIT 1
    `,
    [workspaceId, expenseId]
  );

  return result.rows[0] ? mapExpenseRow(result.rows[0]) : null;
}

export async function createExpense({ db, workspaceId, input, actorUserId }) {
  const expenseInput = validateExpenseInput(input, { partial: false });
  await validateExpenseRelationships({ db, workspaceId, expenseInput });

  const result = await db.query(
    `
      -- createExpense
      INSERT INTO expenses (
        workspace_id,
        property_id,
        project_id,
        vendor_id,
        vendor_name_raw,
        expense_date,
        description,
        amount_cents,
        currency_code,
        category,
        record_treatment,
        documentation_status,
        notes,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::date,
        $7,
        $8::bigint,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $14
      )
      RETURNING id
    `,
    [
      workspaceId,
      expenseInput.propertyId,
      expenseInput.projectId,
      expenseInput.vendorId,
      expenseInput.vendorNameRaw,
      expenseInput.expenseDate,
      expenseInput.description,
      expenseInput.amountCents,
      expenseInput.currencyCode,
      expenseInput.category,
      expenseInput.recordTreatment,
      expenseInput.documentationStatus,
      expenseInput.notes,
      actorUserId
    ]
  );

  return getExpenseById({ db, workspaceId, expenseId: result.rows[0].id });
}

export async function updateExpense({ db, workspaceId, expenseId, input, actorUserId }) {
  validateExpenseId(expenseId);
  const expenseInput = validateExpenseInput(input, { partial: true });
  const needsRelationshipValidation = expenseInput.hasPropertyId || expenseInput.hasProjectId || expenseInput.hasVendorId;
  const existingExpense = needsRelationshipValidation
    ? await getActiveExpenseRelationshipState({ db, workspaceId, expenseId })
    : null;

  if (needsRelationshipValidation && !existingExpense) {
    return null;
  }

  await validateExpenseRelationships({ db, workspaceId, expenseInput, existingExpense });

  const result = await db.query(
    `
      -- updateExpense
      UPDATE expenses
      SET
        property_id = CASE WHEN $3::boolean THEN $4 ELSE property_id END,
        project_id = CASE WHEN $5::boolean THEN $6 ELSE project_id END,
        vendor_id = CASE WHEN $7::boolean THEN $8 ELSE vendor_id END,
        vendor_name_raw = CASE WHEN $9::boolean THEN $10 ELSE vendor_name_raw END,
        expense_date = CASE WHEN $11::boolean THEN $12::date ELSE expense_date END,
        description = CASE WHEN $13::boolean THEN $14 ELSE description END,
        amount_cents = CASE WHEN $15::boolean THEN $16::bigint ELSE amount_cents END,
        currency_code = CASE WHEN $17::boolean THEN $18 ELSE currency_code END,
        category = CASE WHEN $19::boolean THEN $20 ELSE category END,
        record_treatment = CASE WHEN $21::boolean THEN $22 ELSE record_treatment END,
        documentation_status = CASE WHEN $23::boolean THEN $24 ELSE documentation_status END,
        notes = CASE WHEN $25::boolean THEN $26 ELSE notes END,
        updated_by_user_id = $27,
        updated_at = now()
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
      RETURNING id
    `,
    [
      workspaceId,
      expenseId,
      expenseInput.hasPropertyId,
      expenseInput.propertyId,
      expenseInput.hasProjectId,
      expenseInput.projectId,
      expenseInput.hasVendorId,
      expenseInput.vendorId,
      expenseInput.hasVendorNameRaw,
      expenseInput.vendorNameRaw,
      expenseInput.hasExpenseDate,
      expenseInput.expenseDate,
      expenseInput.hasDescription,
      expenseInput.description,
      expenseInput.hasAmountCents,
      expenseInput.amountCents,
      expenseInput.hasCurrencyCode,
      expenseInput.currencyCode,
      expenseInput.hasCategory,
      expenseInput.category,
      expenseInput.hasRecordTreatment,
      expenseInput.recordTreatment,
      expenseInput.hasDocumentationStatus,
      expenseInput.documentationStatus,
      expenseInput.hasNotes,
      expenseInput.notes,
      actorUserId
    ]
  );

  return result.rows[0] ? getExpenseById({ db, workspaceId, expenseId: result.rows[0].id }) : null;
}

export async function deleteExpense({ db, workspaceId, expenseId, actorUserId }) {
  validateExpenseId(expenseId);
  const result = await db.query(
    `
      -- deleteExpense
      UPDATE expenses
      SET deleted_at = now(),
          updated_by_user_id = $3,
          updated_at = now()
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
      RETURNING id
    `,
    [workspaceId, expenseId, actorUserId]
  );

  return result.rows[0] ? getExpenseByIdIncludingDeleted({ db, workspaceId, expenseId: result.rows[0].id }) : null;
}

export async function getExpenseFilterOptions({ db, workspaceId, filters = {} }) {
  const query = buildFilterOptionsQuery({ workspaceId, filters });
  const result = await db.query(query.sql, query.params);

  const properties = new Map();
  const projects = new Map();
  const vendors = new Map();
  const categories = new Set();
  const recordTreatments = new Set();
  const documentationStatuses = new Set();
  const currencyCodes = new Set();

  for (const row of result.rows) {
    if (row.property_id && row.property_name) {
      properties.set(row.property_id, { id: row.property_id, name: row.property_name });
    }
    if (row.project_id && row.project_name) {
      projects.set(row.project_id, { id: row.project_id, name: row.project_name });
    }
    if (row.vendor_id && row.vendor_name) {
      vendors.set(row.vendor_id, { id: row.vendor_id, name: row.vendor_name });
    }
    if (row.category) categories.add(row.category);
    if (row.record_treatment) recordTreatments.add(row.record_treatment);
    if (row.documentation_status) documentationStatuses.add(row.documentation_status);
    if (row.currency_code) currencyCodes.add(row.currency_code);
  }

  return {
    properties: [...properties.values()].sort(compareNamedOptions),
    projects: [...projects.values()].sort(compareNamedOptions),
    vendors: [...vendors.values()].sort(compareNamedOptions),
    categories: [...categories].sort(),
    record_treatments: [...recordTreatments].sort(),
    documentation_statuses: [...documentationStatuses].sort(),
    currency_codes: [...currencyCodes].sort()
  };
}

export function serializeExpense(expense) {
  return {
    id: expense.id,
    property_id: expense.propertyId,
    property_name: expense.propertyName,
    project_id: expense.projectId,
    project_name: expense.projectName,
    vendor_id: expense.vendorId,
    vendor_name: expense.vendorName,
    vendor_name_raw: expense.vendorNameRaw,
    expense_date: expense.expenseDate,
    description: expense.description,
    amount_cents: expense.amountCents,
    currency_code: expense.currencyCode,
    category: expense.category,
    record_treatment: expense.recordTreatment,
    documentation_status: expense.documentationStatus,
    notes: expense.notes,
    document_count: expense.documentCount,
    open_item_count: Number(expense.openItemCount || 0),
    deleted_at: expense.deletedAt,
    created_at: expense.createdAt,
    updated_at: expense.updatedAt
  };
}

export function validateExpenseId(expenseId) {
  if (!UUID_PATTERN.test(String(expenseId || ""))) {
    throw apiError(400, "invalid_request", "Invalid expense id.");
  }
  return expenseId;
}

function buildListQuery({ workspaceId, filters, pagination, sort }) {
  const query = buildExpenseWhere({ workspaceId, filters, tableAlias: "e" });
  const limit = parseLimit(pagination.limit);
  const offset = parseOffset(pagination.offset);
  query.params.push(limit, offset);

  const orderBy = SORTS[sort] || SORTS.date_desc;

  return {
    sql: `
      -- listExpenses
      SELECT ${expenseColumns()}, count(*) OVER() AS total_count
      FROM expenses e
      ${expenseJoins()}
      WHERE ${query.where.join(" AND ")}
      GROUP BY ${expenseGroupByColumns()}
      ORDER BY ${orderBy}
      LIMIT $${query.params.length - 1}
      OFFSET $${query.params.length}
    `,
    params: query.params,
    limit,
    offset
  };
}

function buildFilterOptionsQuery({ workspaceId, filters }) {
  const query = buildExpenseWhere({ workspaceId, filters, tableAlias: "e" });
  return {
    sql: `
      -- expenseFilterOptions
      SELECT DISTINCT
        e.property_id,
        p.name AS property_name,
        e.project_id,
        pr.name AS project_name,
        e.vendor_id,
        v.name AS vendor_name,
        e.category,
        e.record_treatment,
        e.documentation_status,
        e.currency_code
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
      WHERE ${query.where.join(" AND ")}
      ORDER BY p.name ASC, pr.name ASC, v.name ASC, e.category ASC, e.record_treatment ASC, e.documentation_status ASC
    `,
    params: query.params
  };
}

function buildExpenseWhere({ workspaceId, filters, tableAlias }) {
  const params = [workspaceId];
  const where = [`${tableAlias}.workspace_id = $1`, `${tableAlias}.deleted_at IS NULL`];

  addUuidFilter({ filters, field: "property_id", column: `${tableAlias}.property_id`, params, where });
  addUuidFilter({ filters, field: "project_id", column: `${tableAlias}.project_id`, params, where, nullable: true });
  addUuidFilter({ filters, field: "vendor_id", column: `${tableAlias}.vendor_id`, params, where, nullable: true });
  addTextFilter({ filters, field: "category", column: `${tableAlias}.category`, params, where });
  addTextFilter({ filters, field: "record_treatment", column: `${tableAlias}.record_treatment`, params, where });
  addTextFilter({ filters, field: "documentation_status", column: `${tableAlias}.documentation_status`, params, where });
  addTextFilter({ filters, field: "currency_code", column: `${tableAlias}.currency_code`, params, where });
  addDateRangeFilter({ filters, fromField: "date_from", toField: "date_to", column: `${tableAlias}.expense_date`, params, where });
  addAmountRangeFilter({ filters, minField: "amount_min_cents", maxField: "amount_max_cents", column: `${tableAlias}.amount_cents`, params, where });

  const q = normalizeOptionalText(filters.q);
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    where.push(`(${tableAlias}.description ILIKE $${params.length} OR ${tableAlias}.vendor_name_raw ILIKE $${params.length} OR ${tableAlias}.notes ILIKE $${params.length})`);
  }

  return { params, where };
}

function validateExpenseInput(input, { partial }) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const details = [];
  for (const field of Object.keys(body)) {
    if (!EXPENSE_INPUT_FIELDS.has(field)) {
      details.push({ field, issue: "unknown_field" });
    }
  }

  const normalized = {
    hasPropertyId: Object.hasOwn(body, "property_id"),
    propertyId: undefined,
    hasProjectId: Object.hasOwn(body, "project_id"),
    projectId: undefined,
    hasVendorId: Object.hasOwn(body, "vendor_id"),
    vendorId: undefined,
    hasVendorNameRaw: Object.hasOwn(body, "vendor_name_raw"),
    vendorNameRaw: undefined,
    hasExpenseDate: Object.hasOwn(body, "expense_date"),
    expenseDate: undefined,
    hasDescription: Object.hasOwn(body, "description"),
    description: undefined,
    hasAmountCents: Object.hasOwn(body, "amount_cents"),
    amountCents: undefined,
    hasCurrencyCode: Object.hasOwn(body, "currency_code"),
    currencyCode: "USD",
    hasCategory: Object.hasOwn(body, "category"),
    category: undefined,
    hasRecordTreatment: Object.hasOwn(body, "record_treatment"),
    recordTreatment: "review_later",
    hasDocumentationStatus: Object.hasOwn(body, "documentation_status"),
    documentationStatus: "no_document_yet",
    hasNotes: Object.hasOwn(body, "notes"),
    notes: undefined
  };

  if (!partial || normalized.hasPropertyId) {
    normalized.propertyId = normalizeRelationshipId(body.property_id, "property_id", { required: true }, details);
  }

  if (normalized.hasProjectId) {
    normalized.projectId = normalizeRelationshipId(body.project_id, "project_id", { required: false }, details);
  } else if (!partial) {
    normalized.projectId = null;
  }

  if (normalized.hasVendorId) {
    normalized.vendorId = normalizeRelationshipId(body.vendor_id, "vendor_id", { required: false }, details);
  } else if (!partial) {
    normalized.vendorId = null;
  }

  normalizeNullableField({ body, normalized, hasKey: "hasVendorNameRaw", valueKey: "vendorNameRaw", field: "vendor_name_raw", maxLength: VENDOR_NAME_RAW_MAX_LENGTH, partial, details });

  if (normalized.hasExpenseDate) {
    normalized.expenseDate = normalizeDate(body.expense_date);
    if (normalized.expenseDate === false) {
      details.push({ field: "expense_date", issue: "invalid_date" });
      normalized.expenseDate = undefined;
    }
  } else if (!partial) {
    normalized.expenseDate = null;
  }

  if (!partial || normalized.hasDescription) {
    const description = normalizeRequiredText(body.description);
    if (!description) {
      details.push({ field: "description", issue: "required" });
    } else if (description.length > DESCRIPTION_MAX_LENGTH) {
      details.push({ field: "description", issue: "too_long" });
    } else {
      normalized.description = description;
    }
  }

  if (!partial || normalized.hasAmountCents) {
    normalized.amountCents = normalizeIntegerCents(body.amount_cents);
    if (normalized.amountCents === null) {
      details.push({ field: "amount_cents", issue: "required" });
    } else if (normalized.amountCents === false) {
      details.push({ field: "amount_cents", issue: "invalid_amount" });
      normalized.amountCents = undefined;
    }
  }

  if (normalized.hasCurrencyCode) {
    normalized.currencyCode = normalizeOptionalText(body.currency_code);
    if (!/^[A-Z]{3}$/.test(normalized.currencyCode)) {
      details.push({ field: "currency_code", issue: "invalid_currency" });
    }
  }

  if (!partial || normalized.hasCategory) {
    const category = normalizeRequiredText(body.category);
    if (!category) {
      details.push({ field: "category", issue: "required" });
    } else if (category.length > CATEGORY_MAX_LENGTH) {
      details.push({ field: "category", issue: "too_long" });
    } else {
      normalized.category = category;
    }
  }

  if (normalized.hasRecordTreatment) {
    normalized.recordTreatment = normalizeOptionalText(body.record_treatment);
    if (!RECORD_TREATMENTS.has(normalized.recordTreatment)) {
      details.push({ field: "record_treatment", issue: "invalid_record_treatment" });
    }
  }

  if (normalized.hasDocumentationStatus) {
    normalized.documentationStatus = normalizeOptionalText(body.documentation_status);
    if (!DOCUMENTATION_STATUSES.has(normalized.documentationStatus)) {
      details.push({ field: "documentation_status", issue: "invalid_documentation_status" });
    }
  }

  normalizeNullableField({ body, normalized, hasKey: "hasNotes", valueKey: "notes", field: "notes", maxLength: NOTES_MAX_LENGTH, partial, details });

  if (partial && details.length === 0 && !Object.keys(body).some((field) => EXPENSE_INPUT_FIELDS.has(field))) {
    details.push({ field: "body", issue: "no_fields" });
  }

  if (details.length > 0) {
    throw validationError(details);
  }

  return normalized;
}

async function validateExpenseRelationships({ db, workspaceId, expenseInput, existingExpense }) {
  const propertyId = expenseInput.hasPropertyId
    ? expenseInput.propertyId
    : existingExpense?.property_id;
  const projectId = expenseInput.hasProjectId
    ? expenseInput.projectId
    : existingExpense?.project_id;

  if (expenseInput.hasPropertyId || expenseInput.propertyId) {
    const property = await loadActiveRelationship({
      db,
      workspaceId,
      table: "properties",
      marker: "loadExpenseProperty",
      id: expenseInput.propertyId
    });
    if (!property) {
      throw invalidRelationship("property_id", "not_found");
    }
  }

  if (projectId) {
    const project = await loadActiveProjectRelationship({ db, workspaceId, id: projectId });
    if (!project) {
      throw invalidRelationship("project_id", "not_found");
    }
    if (propertyId && project.property_id !== propertyId) {
      throw invalidRelationship("project_id", "property_mismatch");
    }
  }

  if (expenseInput.hasVendorId && expenseInput.vendorId) {
    const vendor = await loadActiveRelationship({
      db,
      workspaceId,
      table: "vendors",
      marker: "loadExpenseVendor",
      id: expenseInput.vendorId
    });
    if (!vendor) {
      throw invalidRelationship("vendor_id", "not_found");
    }
  }
}

async function getActiveExpenseRelationshipState({ db, workspaceId, expenseId }) {
  const result = await db.query(
    `
      -- getExpenseRelationshipState
      SELECT property_id, project_id, vendor_id
      FROM expenses
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [workspaceId, expenseId]
  );
  return result.rows[0] || null;
}

async function loadActiveRelationship({ db, workspaceId, table, marker, id }) {
  const result = await db.query(
    `
      -- ${marker}
      SELECT id, name
      FROM ${table}
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      LIMIT 1
    `,
    [workspaceId, id]
  );
  return result.rows[0] || null;
}

async function loadActiveProjectRelationship({ db, workspaceId, id }) {
  const result = await db.query(
    `
      -- loadExpenseProject
      SELECT id, name, property_id
      FROM projects
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      LIMIT 1
    `,
    [workspaceId, id]
  );
  return result.rows[0] || null;
}

function invalidRelationship(field, issue) {
  return apiError(400, "invalid_request", "Invalid expense relationship.", [
    {
      field,
      issue
    }
  ]);
}

async function getExpenseByIdIncludingDeleted({ db, workspaceId, expenseId }) {
  const result = await db.query(
    `
      -- getExpenseByIdIncludingDeleted
      SELECT ${expenseColumns()}
      FROM expenses e
      ${expenseJoins()}
      WHERE e.workspace_id = $1
        AND e.id = $2
      GROUP BY ${expenseGroupByColumns()}
      LIMIT 1
    `,
    [workspaceId, expenseId]
  );

  return result.rows[0] ? mapExpenseRow(result.rows[0]) : null;
}

function expenseColumns() {
  return `
    ${expenseBaseColumns()},
    p.name AS property_name,
    pr.name AS project_name,
    v.name AS vendor_name,
    count(d.id)::int AS document_count
  `;
}

function expenseBaseColumns() {
  return `
    e.id,
    e.workspace_id,
    e.property_id,
    e.project_id,
    e.vendor_id,
    e.vendor_name_raw,
    e.expense_date,
    e.description,
    e.amount_cents,
    e.currency_code,
    e.category,
    e.record_treatment,
    e.documentation_status,
    e.notes,
    e.deleted_at,
    e.created_at,
    e.updated_at
  `;
}

function expenseJoins() {
  return `
    JOIN properties p
      ON p.workspace_id = e.workspace_id
     AND p.id = e.property_id
    LEFT JOIN projects pr
      ON pr.workspace_id = e.workspace_id
     AND pr.id = e.project_id
    LEFT JOIN vendors v
      ON v.workspace_id = e.workspace_id
     AND v.id = e.vendor_id
    LEFT JOIN documents d
      ON d.workspace_id = e.workspace_id
     AND d.expense_id = e.id
     AND d.deleted_at IS NULL
  `;
}

function expenseGroupByColumns() {
  return `
    e.id,
    e.workspace_id,
    e.property_id,
    e.project_id,
    e.vendor_id,
    e.vendor_name_raw,
    e.expense_date,
    e.description,
    e.amount_cents,
    e.currency_code,
    e.category,
    e.record_treatment,
    e.documentation_status,
    e.notes,
    e.deleted_at,
    e.created_at,
    e.updated_at,
    p.name,
    pr.name,
    v.name
  `;
}

function mapExpenseRow(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    propertyId: row.property_id,
    propertyName: row.property_name || null,
    projectId: row.project_id || null,
    projectName: row.project_name || null,
    vendorId: row.vendor_id || null,
    vendorName: row.vendor_name || null,
    vendorNameRaw: row.vendor_name_raw || null,
    expenseDate: formatDateOnly(row.expense_date),
    description: row.description,
    amountCents: Number(row.amount_cents),
    currencyCode: row.currency_code,
    category: row.category,
    recordTreatment: row.record_treatment,
    documentationStatus: row.documentation_status,
    notes: row.notes || null,
    documentCount: Number(row.document_count || 0),
    deletedAt: formatTimestamp(row.deleted_at),
    createdAt: formatTimestamp(row.created_at),
    updatedAt: formatTimestamp(row.updated_at)
  };
}

function normalizeRelationshipId(value, field, { required }, details) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      details.push({ field, issue: "required" });
      return undefined;
    }
    return null;
  }
  const normalized = String(value || "").trim();
  if (!UUID_PATTERN.test(normalized)) {
    throw apiError(400, "invalid_request", `Invalid ${field}.`, [
      {
        field,
        issue: "invalid_uuid"
      }
    ]);
  }
  return normalized;
}

function addUuidFilter({ filters, field, column, params, where, nullable = false }) {
  if (filters[field] === undefined) {
    return;
  }
  const value = String(filters[field] || "").trim();
  if (!value && nullable) {
    where.push(`${column} IS NULL`);
    return;
  }
  if (!UUID_PATTERN.test(value)) {
    throw apiError(400, "invalid_request", `Invalid ${field}.`);
  }
  params.push(value);
  where.push(`${column} = $${params.length}`);
}

function addTextFilter({ filters, field, column, params, where }) {
  const value = normalizeOptionalText(filters[field]);
  if (!value) {
    return;
  }
  params.push(value);
  where.push(`${column} = $${params.length}`);
}

function addDateRangeFilter({ filters, fromField, toField, column, params, where }) {
  const from = normalizeDate(filters[fromField]);
  if (from === false) {
    throw apiError(400, "invalid_request", `Invalid ${fromField}.`);
  }
  if (from) {
    params.push(from);
    where.push(`${column} >= $${params.length}::date`);
  }

  const to = normalizeDate(filters[toField]);
  if (to === false) {
    throw apiError(400, "invalid_request", `Invalid ${toField}.`);
  }
  if (to) {
    params.push(to);
    where.push(`${column} <= $${params.length}::date`);
  }
}

function addAmountRangeFilter({ filters, minField, maxField, column, params, where }) {
  const min = normalizeOptionalIntegerCents(filters[minField]);
  if (min === false) {
    throw apiError(400, "invalid_request", `Invalid ${minField}.`);
  }
  if (min !== null) {
    params.push(min);
    where.push(`${column} >= $${params.length}::bigint`);
  }

  const max = normalizeOptionalIntegerCents(filters[maxField]);
  if (max === false) {
    throw apiError(400, "invalid_request", `Invalid ${maxField}.`);
  }
  if (max !== null) {
    params.push(max);
    where.push(`${column} <= $${params.length}::bigint`);
  }
}

function normalizeNullableField({ body, normalized, hasKey, valueKey, field, maxLength, partial, details }) {
  if (normalized[hasKey]) {
    normalized[valueKey] = normalizeNullableText(body[field]);
    if (normalized[valueKey] && normalized[valueKey].length > maxLength) {
      details.push({ field, issue: "too_long" });
    }
  } else if (!partial) {
    normalized[valueKey] = null;
  }
}

function normalizeRequiredText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  return String(value || "").trim();
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeIntegerCents(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return normalizeOptionalIntegerCents(value);
}

function normalizeOptionalIntegerCents(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : false;
  }
  return false;
}

function normalizeDate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return false;
  }
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? false
    : normalized;
}

function parseLimit(value) {
  const limit = Number.parseInt(String(value || DEFAULT_LIMIT), 10);
  if (!Number.isInteger(limit) || limit < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(limit, MAX_LIMIT);
}

function parseOffset(value) {
  const offset = Number.parseInt(String(value || 0), 10);
  if (!Number.isInteger(offset) || offset < 0) {
    return 0;
  }
  return offset;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function formatDateOnly(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function formatTimestamp(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function compareNamedOptions(left, right) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
