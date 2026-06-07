import { apiError, validationError } from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME_MAX_LENGTH = 160;
const CATEGORY_MAX_LENGTH = 120;
const CONTRACTOR_NAME_MAX_LENGTH = 200;
const PERMIT_NUMBER_MAX_LENGTH = 120;
const SCOPE_SUMMARY_MAX_LENGTH = 5000;
const NOTES_MAX_LENGTH = 5000;
const COMPLETENESS_OVERRIDE_NOTE_MAX_LENGTH = 1000;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const PROJECT_STATUSES = new Set(["planned", "in_progress", "blocked", "completed", "archived"]);
const PROJECT_INPUT_FIELDS = new Set([
  "property_id",
  "vendor_id",
  "name",
  "category",
  "status",
  "start_date",
  "completion_date",
  "contractor_name_raw",
  "permit_number",
  "scope_summary",
  "notes",
  "completeness_override_note"
]);

const SORTS = {
  name_asc: "pr.name ASC, pr.id ASC",
  name_desc: "pr.name DESC, pr.id ASC",
  status_asc: "pr.status ASC, pr.name ASC, pr.id ASC",
  status_desc: "pr.status DESC, pr.name ASC, pr.id ASC",
  category_asc: "pr.category ASC, pr.name ASC, pr.id ASC",
  category_desc: "pr.category DESC, pr.name ASC, pr.id ASC",
  start_date_asc: "pr.start_date ASC NULLS LAST, pr.id ASC",
  start_date_desc: "pr.start_date DESC NULLS LAST, pr.id ASC",
  completion_date_asc: "pr.completion_date ASC NULLS LAST, pr.id ASC",
  completion_date_desc: "pr.completion_date DESC NULLS LAST, pr.id ASC",
  created_desc: "pr.created_at DESC, pr.id ASC",
  updated_desc: "pr.updated_at DESC, pr.id ASC"
};

export async function listProjects({ db, workspaceId, filters = {}, pagination = {}, sort }) {
  const query = buildListQuery({ workspaceId, filters, pagination, sort });
  const result = await db.query(query.sql, query.params);
  const totalCount = result.rows[0]?.total_count ? Number(result.rows[0].total_count) : 0;

  return {
    data: result.rows.map(mapProjectRow),
    meta: {
      limit: query.limit,
      offset: query.offset,
      total_count: totalCount
    }
  };
}

export async function getProjectById({ db, workspaceId, projectId }) {
  validateProjectId(projectId);
  const result = await db.query(
    `
      -- getProjectById
      SELECT ${projectColumns()}
      FROM projects pr
      JOIN properties p
        ON p.workspace_id = pr.workspace_id
       AND p.id = pr.property_id
      LEFT JOIN vendors v
        ON v.workspace_id = pr.workspace_id
       AND v.id = pr.vendor_id
      WHERE pr.workspace_id = $1
        AND pr.id = $2
        AND pr.deleted_at IS NULL
        AND pr.archived_at IS NULL
      LIMIT 1
    `,
    [workspaceId, projectId]
  );

  return result.rows[0] ? mapProjectRow(result.rows[0]) : null;
}

export async function createProject({ db, workspaceId, input, actorUserId }) {
  const projectInput = validateProjectInput(input, { partial: false });
  await validateProjectRelationships({ db, workspaceId, projectInput });

  const result = await db.query(
    `
      -- createProject
      INSERT INTO projects (
        workspace_id,
        property_id,
        vendor_id,
        name,
        category,
        status,
        start_date,
        completion_date,
        contractor_name_raw,
        permit_number,
        scope_summary,
        notes,
        completeness_override_note,
        completeness_overridden_at,
        archived_at,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::date,
        $8::date,
        $9,
        $10,
        $11,
        $12,
        $13,
        CASE WHEN $13::text IS NULL THEN NULL ELSE now() END,
        CASE WHEN $6 = 'archived' THEN now() ELSE NULL END,
        $14,
        $14
      )
      RETURNING id
    `,
    [
      workspaceId,
      projectInput.propertyId,
      projectInput.vendorId,
      projectInput.name,
      projectInput.category,
      projectInput.status,
      projectInput.startDate,
      projectInput.completionDate,
      projectInput.contractorNameRaw,
      projectInput.permitNumber,
      projectInput.scopeSummary,
      projectInput.notes,
      projectInput.completenessOverrideNote,
      actorUserId
    ]
  );

  return getProjectById({ db, workspaceId, projectId: result.rows[0].id });
}

export async function updateProject({ db, workspaceId, projectId, input, actorUserId }) {
  validateProjectId(projectId);
  const projectInput = validateProjectInput(input, { partial: true });
  await validateProjectRelationships({ db, workspaceId, projectInput });

  const result = await db.query(
    `
      -- updateProject
      UPDATE projects
      SET
        property_id = CASE WHEN $3::boolean THEN $4 ELSE property_id END,
        vendor_id = CASE WHEN $5::boolean THEN $6 ELSE vendor_id END,
        name = CASE WHEN $7::boolean THEN $8 ELSE name END,
        category = CASE WHEN $9::boolean THEN $10 ELSE category END,
        status = CASE WHEN $11::boolean THEN $12 ELSE status END,
        start_date = CASE WHEN $13::boolean THEN $14::date ELSE start_date END,
        completion_date = CASE WHEN $15::boolean THEN $16::date ELSE completion_date END,
        contractor_name_raw = CASE WHEN $17::boolean THEN $18 ELSE contractor_name_raw END,
        permit_number = CASE WHEN $19::boolean THEN $20 ELSE permit_number END,
        scope_summary = CASE WHEN $21::boolean THEN $22 ELSE scope_summary END,
        notes = CASE WHEN $23::boolean THEN $24 ELSE notes END,
        completeness_override_note = CASE WHEN $25::boolean THEN $26 ELSE completeness_override_note END,
        completeness_overridden_at = CASE
          WHEN $25::boolean AND $26 IS NULL THEN NULL
          WHEN $25::boolean THEN now()
          ELSE completeness_overridden_at
        END,
        archived_at = CASE
          WHEN $11::boolean AND $12 = 'archived' THEN COALESCE(archived_at, now())
          WHEN $11::boolean AND $12 <> 'archived' THEN NULL
          ELSE archived_at
        END,
        updated_by_user_id = $27,
        updated_at = now()
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      RETURNING id
    `,
    [
      workspaceId,
      projectId,
      projectInput.hasPropertyId,
      projectInput.propertyId,
      projectInput.hasVendorId,
      projectInput.vendorId,
      projectInput.hasName,
      projectInput.name,
      projectInput.hasCategory,
      projectInput.category,
      projectInput.hasStatus,
      projectInput.status,
      projectInput.hasStartDate,
      projectInput.startDate,
      projectInput.hasCompletionDate,
      projectInput.completionDate,
      projectInput.hasContractorNameRaw,
      projectInput.contractorNameRaw,
      projectInput.hasPermitNumber,
      projectInput.permitNumber,
      projectInput.hasScopeSummary,
      projectInput.scopeSummary,
      projectInput.hasNotes,
      projectInput.notes,
      projectInput.hasCompletenessOverrideNote,
      projectInput.completenessOverrideNote,
      actorUserId
    ]
  );

  return result.rows[0] ? getProjectByIdIncludingArchived({ db, workspaceId, projectId: result.rows[0].id }) : null;
}

export async function archiveProject({ db, workspaceId, projectId, actorUserId }) {
  validateProjectId(projectId);
  const result = await db.query(
    `
      -- archiveProject
      UPDATE projects
      SET archived_at = now(),
          status = 'archived',
          updated_by_user_id = $3,
          updated_at = now()
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      RETURNING id
    `,
    [workspaceId, projectId, actorUserId]
  );

  return result.rows[0] ? getProjectByIdIncludingArchived({ db, workspaceId, projectId: result.rows[0].id }) : null;
}

export async function getProjectFilterOptions({ db, workspaceId, filters = {} }) {
  const query = buildFilterOptionsQuery({ workspaceId, filters });
  const result = await db.query(query.sql, query.params);

  const properties = new Map();
  const vendors = new Map();
  const statuses = new Set();
  const categories = new Set();

  for (const row of result.rows) {
    if (row.property_id && row.property_name) {
      properties.set(row.property_id, {
        id: row.property_id,
        name: row.property_name
      });
    }
    if (row.vendor_id && row.vendor_name) {
      vendors.set(row.vendor_id, {
        id: row.vendor_id,
        name: row.vendor_name
      });
    }
    if (row.status) {
      statuses.add(row.status);
    }
    if (row.category) {
      categories.add(row.category);
    }
  }

  return {
    properties: [...properties.values()].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    vendors: [...vendors.values()].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    statuses: [...statuses].sort(),
    categories: [...categories].sort()
  };
}

export function serializeProject(project) {
  return {
    id: project.id,
    property_id: project.propertyId,
    property_name: project.propertyName,
    vendor_id: project.vendorId,
    vendor_name: project.vendorName,
    name: project.name,
    category: project.category,
    status: project.status,
    start_date: project.startDate,
    completion_date: project.completionDate,
    contractor_name_raw: project.contractorNameRaw,
    permit_number: project.permitNumber,
    scope_summary: project.scopeSummary,
    notes: project.notes,
    completeness_override_note: project.completenessOverrideNote,
    completeness_overridden_at: project.completenessOverriddenAt,
    open_item_count: Number(project.openItemCount || 0),
    archived_at: project.archivedAt,
    created_at: project.createdAt,
    updated_at: project.updatedAt
  };
}

export function validateProjectId(projectId) {
  if (!UUID_PATTERN.test(String(projectId || ""))) {
    throw apiError(400, "invalid_request", "Invalid project id.");
  }
  return projectId;
}

function buildListQuery({ workspaceId, filters, pagination, sort }) {
  const query = buildProjectWhere({ workspaceId, filters, tableAlias: "pr" });
  const limit = parseLimit(pagination.limit);
  const offset = parseOffset(pagination.offset);
  query.params.push(limit, offset);

  const orderBy = SORTS[sort] || SORTS.updated_desc;

  return {
    sql: `
      -- listProjects
      SELECT ${projectColumns()}, count(*) OVER() AS total_count
      FROM projects pr
      JOIN properties p
        ON p.workspace_id = pr.workspace_id
       AND p.id = pr.property_id
      LEFT JOIN vendors v
        ON v.workspace_id = pr.workspace_id
       AND v.id = pr.vendor_id
      WHERE ${query.where.join(" AND ")}
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
  const query = buildProjectWhere({ workspaceId, filters, tableAlias: "pr" });
  return {
    sql: `
      -- projectFilterOptions
      SELECT DISTINCT
        pr.property_id,
        p.name AS property_name,
        pr.vendor_id,
        v.name AS vendor_name,
        pr.status,
        pr.category
      FROM projects pr
      JOIN properties p
        ON p.workspace_id = pr.workspace_id
       AND p.id = pr.property_id
      LEFT JOIN vendors v
        ON v.workspace_id = pr.workspace_id
       AND v.id = pr.vendor_id
      WHERE ${query.where.join(" AND ")}
      ORDER BY p.name ASC, v.name ASC, pr.status ASC, pr.category ASC
    `,
    params: query.params
  };
}

function buildProjectWhere({ workspaceId, filters, tableAlias }) {
  const params = [workspaceId];
  const where = [`${tableAlias}.workspace_id = $1`, `${tableAlias}.deleted_at IS NULL`];
  const includeArchived = parseBoolean(filters.include_archived);
  const archivedOnly = parseBoolean(filters.archived);

  if (archivedOnly) {
    where.push(`${tableAlias}.archived_at IS NOT NULL`);
  } else if (!includeArchived) {
    where.push(`${tableAlias}.archived_at IS NULL`);
  }

  addUuidFilter({ filters, field: "property_id", column: `${tableAlias}.property_id`, params, where });
  addUuidFilter({ filters, field: "vendor_id", column: `${tableAlias}.vendor_id`, params, where, nullable: true });
  addTextFilter({ filters, field: "status", column: `${tableAlias}.status`, params, where });
  addTextFilter({ filters, field: "category", column: `${tableAlias}.category`, params, where });
  addDateRangeFilter({ filters, fromField: "start_date_from", toField: "start_date_to", column: `${tableAlias}.start_date`, params, where });
  addDateRangeFilter({ filters, fromField: "completion_date_from", toField: "completion_date_to", column: `${tableAlias}.completion_date`, params, where });

  const q = normalizeOptionalText(filters.q);
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    where.push(`(${tableAlias}.name ILIKE $${params.length} OR ${tableAlias}.scope_summary ILIKE $${params.length})`);
  }

  return { params, where };
}

function validateProjectInput(input, { partial }) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const details = [];
  for (const field of Object.keys(body)) {
    if (!PROJECT_INPUT_FIELDS.has(field)) {
      details.push({ field, issue: "unknown_field" });
    }
  }

  const normalized = {
    hasPropertyId: Object.hasOwn(body, "property_id"),
    propertyId: undefined,
    hasVendorId: Object.hasOwn(body, "vendor_id"),
    vendorId: undefined,
    hasName: Object.hasOwn(body, "name"),
    name: undefined,
    hasCategory: Object.hasOwn(body, "category"),
    category: undefined,
    hasStatus: Object.hasOwn(body, "status"),
    status: "planned",
    hasStartDate: Object.hasOwn(body, "start_date"),
    startDate: undefined,
    hasCompletionDate: Object.hasOwn(body, "completion_date"),
    completionDate: undefined,
    hasContractorNameRaw: Object.hasOwn(body, "contractor_name_raw"),
    contractorNameRaw: undefined,
    hasPermitNumber: Object.hasOwn(body, "permit_number"),
    permitNumber: undefined,
    hasScopeSummary: Object.hasOwn(body, "scope_summary"),
    scopeSummary: undefined,
    hasNotes: Object.hasOwn(body, "notes"),
    notes: undefined,
    hasCompletenessOverrideNote: Object.hasOwn(body, "completeness_override_note"),
    completenessOverrideNote: undefined
  };

  if (!partial || normalized.hasPropertyId) {
    normalized.propertyId = normalizeRelationshipId(body.property_id, "property_id", { required: true }, details);
  }

  if (normalized.hasVendorId) {
    normalized.vendorId = normalizeRelationshipId(body.vendor_id, "vendor_id", { required: false }, details);
  } else if (!partial) {
    normalized.vendorId = null;
  }

  if (!partial || normalized.hasName) {
    const name = normalizeRequiredText(body.name);
    if (!name) {
      details.push({ field: "name", issue: "required" });
    } else if (name.length > NAME_MAX_LENGTH) {
      details.push({ field: "name", issue: "too_long" });
    } else {
      normalized.name = name;
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

  if (normalized.hasStatus) {
    normalized.status = normalizeOptionalText(body.status);
    if (!PROJECT_STATUSES.has(normalized.status)) {
      details.push({ field: "status", issue: "invalid_status" });
    }
  }

  if (normalized.hasStartDate) {
    normalized.startDate = normalizeDate(body.start_date);
    if (normalized.startDate === false) {
      details.push({ field: "start_date", issue: "invalid_date" });
      normalized.startDate = undefined;
    }
  } else if (!partial) {
    normalized.startDate = null;
  }

  if (normalized.hasCompletionDate) {
    normalized.completionDate = normalizeDate(body.completion_date);
    if (normalized.completionDate === false) {
      details.push({ field: "completion_date", issue: "invalid_date" });
      normalized.completionDate = undefined;
    }
  } else if (!partial) {
    normalized.completionDate = null;
  }

  if (
    normalized.startDate &&
    normalized.completionDate &&
    normalized.completionDate < normalized.startDate
  ) {
    details.push({ field: "completion_date", issue: "before_start_date" });
  }

  normalizeNullableField({ body, normalized, hasKey: "hasContractorNameRaw", valueKey: "contractorNameRaw", field: "contractor_name_raw", maxLength: CONTRACTOR_NAME_MAX_LENGTH, partial, details });
  normalizeNullableField({ body, normalized, hasKey: "hasPermitNumber", valueKey: "permitNumber", field: "permit_number", maxLength: PERMIT_NUMBER_MAX_LENGTH, partial, details });
  normalizeNullableField({ body, normalized, hasKey: "hasScopeSummary", valueKey: "scopeSummary", field: "scope_summary", maxLength: SCOPE_SUMMARY_MAX_LENGTH, partial, details });
  normalizeNullableField({ body, normalized, hasKey: "hasNotes", valueKey: "notes", field: "notes", maxLength: NOTES_MAX_LENGTH, partial, details });
  normalizeNullableField({
    body,
    normalized,
    hasKey: "hasCompletenessOverrideNote",
    valueKey: "completenessOverrideNote",
    field: "completeness_override_note",
    maxLength: COMPLETENESS_OVERRIDE_NOTE_MAX_LENGTH,
    partial,
    details
  });

  if (partial && details.length === 0 && !Object.keys(body).some((field) => PROJECT_INPUT_FIELDS.has(field))) {
    details.push({ field: "body", issue: "no_fields" });
  }

  if (details.length > 0) {
    throw validationError(details);
  }

  return normalized;
}

async function validateProjectRelationships({ db, workspaceId, projectInput }) {
  if (projectInput.hasPropertyId || projectInput.propertyId) {
    const property = await loadActiveRelationship({
      db,
      workspaceId,
      table: "properties",
      marker: "loadProjectProperty",
      id: projectInput.propertyId
    });
    if (!property) {
      throw invalidRelationship("property_id");
    }
  }

  if (projectInput.hasVendorId && projectInput.vendorId) {
    const vendor = await loadActiveRelationship({
      db,
      workspaceId,
      table: "vendors",
      marker: "loadProjectVendor",
      id: projectInput.vendorId
    });
    if (!vendor) {
      throw invalidRelationship("vendor_id");
    }
  }
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

function invalidRelationship(field) {
  return apiError(400, "invalid_request", "Invalid project relationship.", [
    {
      field,
      issue: "not_found"
    }
  ]);
}

async function getProjectByIdIncludingArchived({ db, workspaceId, projectId }) {
  const result = await db.query(
    `
      -- getProjectByIdIncludingArchived
      SELECT ${projectColumns()}
      FROM projects pr
      JOIN properties p
        ON p.workspace_id = pr.workspace_id
       AND p.id = pr.property_id
      LEFT JOIN vendors v
        ON v.workspace_id = pr.workspace_id
       AND v.id = pr.vendor_id
      WHERE pr.workspace_id = $1
        AND pr.id = $2
        AND pr.deleted_at IS NULL
      LIMIT 1
    `,
    [workspaceId, projectId]
  );

  return result.rows[0] ? mapProjectRow(result.rows[0]) : null;
}

function projectColumns() {
  return `
    ${projectBaseColumns()},
    p.name AS property_name,
    v.name AS vendor_name
  `;
}

function projectBaseColumns() {
  return `
    pr.id,
    pr.workspace_id,
    pr.property_id,
    pr.vendor_id,
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
    pr.completeness_overridden_at,
    pr.archived_at,
    pr.created_at,
    pr.updated_at
  `;
}

function mapProjectRow(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
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
    completenessOverrideNote: row.completeness_override_note || null,
    completenessOverriddenAt: formatTimestamp(row.completeness_overridden_at),
    archivedAt: formatTimestamp(row.archived_at),
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

function parseBoolean(value) {
  if (value === true || value === "true" || value === "1") {
    return true;
  }
  if (value === false || value === "false" || value === "0") {
    return false;
  }
  return false;
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
