import { apiError, validationError } from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME_MAX_LENGTH = 160;
const CATEGORY_MAX_LENGTH = 120;
const CONTACT_NAME_MAX_LENGTH = 160;
const PHONE_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;
const WEBSITE_MAX_LENGTH = 500;
const NOTES_MAX_LENGTH = 5000;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const VENDOR_STATUSES = new Set(["active", "archived"]);
const VENDOR_INPUT_FIELDS = new Set([
  "name",
  "category",
  "contact_name",
  "phone",
  "email",
  "website",
  "notes",
  "status"
]);

const SORTS = {
  name_asc: "name ASC, id ASC",
  name_desc: "name DESC, id ASC",
  category_asc: "category ASC NULLS LAST, name ASC, id ASC",
  category_desc: "category DESC NULLS LAST, name ASC, id ASC",
  created_desc: "created_at DESC, id ASC",
  updated_desc: "updated_at DESC, id ASC"
};

export async function listVendors({ db, workspaceId, filters = {}, pagination = {}, sort }) {
  const query = buildListQuery({ workspaceId, filters, pagination, sort });
  const result = await db.query(query.sql, query.params);
  const totalCount = result.rows[0]?.total_count ? Number(result.rows[0].total_count) : 0;

  return {
    data: result.rows.map(mapVendorRow),
    meta: {
      limit: query.limit,
      offset: query.offset,
      total_count: totalCount
    }
  };
}

export async function getVendorById({ db, workspaceId, vendorId }) {
  validateVendorId(vendorId);
  const result = await db.query(
    `
      -- getVendorById
      SELECT ${vendorColumns()}
      FROM vendors
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      LIMIT 1
    `,
    [workspaceId, vendorId]
  );

  return result.rows[0] ? mapVendorRow(result.rows[0]) : null;
}

export async function createVendor({ db, workspaceId, input, actorUserId }) {
  const vendorInput = validateVendorInput(input, { partial: false });

  const result = await db.query(
    `
      -- createVendor
      INSERT INTO vendors (
        workspace_id,
        name,
        normalized_name,
        category,
        contact_name,
        phone,
        email,
        website,
        notes,
        status,
        source_confidence,
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
        $7,
        $8,
        $9,
        $10,
        'user_confirmed',
        CASE WHEN $10 = 'archived' THEN now() ELSE NULL END,
        $11,
        $11
      )
      RETURNING ${vendorColumns()}
    `,
    [
      workspaceId,
      vendorInput.name,
      vendorInput.normalizedName,
      vendorInput.category,
      vendorInput.contactName,
      vendorInput.phone,
      vendorInput.email,
      vendorInput.website,
      vendorInput.notes,
      vendorInput.status,
      actorUserId
    ]
  );

  return mapVendorRow(result.rows[0]);
}

export async function updateVendor({ db, workspaceId, vendorId, input, actorUserId }) {
  validateVendorId(vendorId);
  const vendorInput = validateVendorInput(input, { partial: true });

  const result = await db.query(
    `
      -- updateVendor
      UPDATE vendors
      SET
        name = CASE WHEN $3::boolean THEN $4 ELSE name END,
        normalized_name = CASE WHEN $3::boolean THEN $5 ELSE normalized_name END,
        category = CASE WHEN $6::boolean THEN $7 ELSE category END,
        contact_name = CASE WHEN $8::boolean THEN $9 ELSE contact_name END,
        phone = CASE WHEN $10::boolean THEN $11 ELSE phone END,
        email = CASE WHEN $12::boolean THEN $13 ELSE email END,
        website = CASE WHEN $14::boolean THEN $15 ELSE website END,
        notes = CASE WHEN $16::boolean THEN $17 ELSE notes END,
        status = CASE WHEN $18::boolean THEN $19 ELSE status END,
        archived_at = CASE
          WHEN $18::boolean AND $19 = 'archived' THEN COALESCE(archived_at, now())
          WHEN $18::boolean AND $19 = 'active' THEN NULL
          ELSE archived_at
        END,
        updated_by_user_id = $20,
        updated_at = now()
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      RETURNING ${vendorColumns()}
    `,
    [
      workspaceId,
      vendorId,
      vendorInput.hasName,
      vendorInput.name,
      vendorInput.normalizedName,
      vendorInput.hasCategory,
      vendorInput.category,
      vendorInput.hasContactName,
      vendorInput.contactName,
      vendorInput.hasPhone,
      vendorInput.phone,
      vendorInput.hasEmail,
      vendorInput.email,
      vendorInput.hasWebsite,
      vendorInput.website,
      vendorInput.hasNotes,
      vendorInput.notes,
      vendorInput.hasStatus,
      vendorInput.status,
      actorUserId
    ]
  );

  return result.rows[0] ? mapVendorRow(result.rows[0]) : null;
}

export async function archiveVendor({ db, workspaceId, vendorId, actorUserId }) {
  validateVendorId(vendorId);
  const result = await db.query(
    `
      -- archiveVendor
      UPDATE vendors
      SET archived_at = now(),
          status = 'archived',
          updated_by_user_id = $3,
          updated_at = now()
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      RETURNING ${vendorColumns()}
    `,
    [workspaceId, vendorId, actorUserId]
  );

  return result.rows[0] ? mapVendorRow(result.rows[0]) : null;
}

export function serializeVendor(vendor) {
  return {
    id: vendor.id,
    name: vendor.name,
    normalized_name: vendor.normalizedName,
    category: vendor.category,
    contact_name: vendor.contactName,
    phone: vendor.phone,
    email: vendor.email,
    website: vendor.website,
    notes: vendor.notes,
    status: vendor.status,
    source_confidence: vendor.sourceConfidence,
    archived_at: vendor.archivedAt,
    created_at: vendor.createdAt,
    updated_at: vendor.updatedAt
  };
}

export function validateVendorId(vendorId) {
  if (!UUID_PATTERN.test(String(vendorId || ""))) {
    throw apiError(400, "invalid_request", "Invalid vendor id.");
  }
  return vendorId;
}

function buildListQuery({ workspaceId, filters, pagination, sort }) {
  const params = [workspaceId];
  const where = ["workspace_id = $1", "deleted_at IS NULL"];
  const includeArchived = parseBoolean(filters.include_archived);
  const archivedOnly = parseBoolean(filters.archived);

  if (archivedOnly) {
    where.push("archived_at IS NOT NULL");
  } else if (!includeArchived) {
    where.push("archived_at IS NULL");
  }

  const category = normalizeOptionalText(filters.category);
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }

  const status = normalizeOptionalText(filters.status);
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  const sourceConfidence = normalizeOptionalText(filters.source_confidence);
  if (sourceConfidence) {
    params.push(sourceConfidence);
    where.push(`source_confidence = $${params.length}`);
  }

  const q = normalizeOptionalText(filters.q);
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    where.push(`(
      name ILIKE $${params.length}
      OR normalized_name ILIKE $${params.length}
      OR contact_name ILIKE $${params.length}
      OR email ILIKE $${params.length}
      OR phone ILIKE $${params.length}
    )`);
  }

  const limit = parseLimit(pagination.limit);
  const offset = parseOffset(pagination.offset);
  params.push(limit, offset);

  const orderBy = SORTS[sort] || SORTS.name_asc;

  return {
    sql: `
      -- listVendors
      SELECT ${vendorColumns()}, count(*) OVER() AS total_count
      FROM vendors
      WHERE ${where.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params,
    limit,
    offset
  };
}

function validateVendorInput(input, { partial }) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const details = [];
  for (const field of Object.keys(body)) {
    if (!VENDOR_INPUT_FIELDS.has(field)) {
      details.push({ field, issue: "unknown_field" });
    }
  }

  const normalized = {
    hasName: Object.hasOwn(body, "name"),
    name: undefined,
    normalizedName: undefined,
    hasCategory: Object.hasOwn(body, "category"),
    category: undefined,
    hasContactName: Object.hasOwn(body, "contact_name"),
    contactName: undefined,
    hasPhone: Object.hasOwn(body, "phone"),
    phone: undefined,
    hasEmail: Object.hasOwn(body, "email"),
    email: undefined,
    hasWebsite: Object.hasOwn(body, "website"),
    website: undefined,
    hasNotes: Object.hasOwn(body, "notes"),
    notes: undefined,
    hasStatus: Object.hasOwn(body, "status"),
    status: "active"
  };

  if (!partial || normalized.hasName) {
    const name = normalizeRequiredText(body.name);
    if (!name) {
      details.push({ field: "name", issue: "required" });
    } else if (name.length > NAME_MAX_LENGTH) {
      details.push({ field: "name", issue: "too_long" });
    } else {
      normalized.name = name;
      normalized.normalizedName = normalizeVendorName(name);
    }
  }

  if (normalized.hasCategory) {
    normalized.category = normalizeNullableText(body.category);
    if (normalized.category && normalized.category.length > CATEGORY_MAX_LENGTH) {
      details.push({ field: "category", issue: "too_long" });
    }
  } else if (!partial) {
    normalized.category = null;
  }

  if (normalized.hasContactName) {
    normalized.contactName = normalizeNullableText(body.contact_name);
    if (normalized.contactName && normalized.contactName.length > CONTACT_NAME_MAX_LENGTH) {
      details.push({ field: "contact_name", issue: "too_long" });
    }
  } else if (!partial) {
    normalized.contactName = null;
  }

  if (normalized.hasPhone) {
    normalized.phone = normalizeNullableText(body.phone);
    if (normalized.phone && normalized.phone.length > PHONE_MAX_LENGTH) {
      details.push({ field: "phone", issue: "too_long" });
    }
  } else if (!partial) {
    normalized.phone = null;
  }

  if (normalized.hasEmail) {
    normalized.email = normalizeEmail(body.email);
    if (normalized.email === false) {
      details.push({ field: "email", issue: "invalid_email" });
      normalized.email = undefined;
    } else if (normalized.email && normalized.email.length > EMAIL_MAX_LENGTH) {
      details.push({ field: "email", issue: "too_long" });
    }
  } else if (!partial) {
    normalized.email = null;
  }

  if (normalized.hasWebsite) {
    normalized.website = normalizeWebsite(body.website);
    if (normalized.website === false) {
      details.push({ field: "website", issue: "invalid_url" });
      normalized.website = undefined;
    } else if (normalized.website && normalized.website.length > WEBSITE_MAX_LENGTH) {
      details.push({ field: "website", issue: "too_long" });
    }
  } else if (!partial) {
    normalized.website = null;
  }

  if (normalized.hasNotes) {
    normalized.notes = normalizeNullableText(body.notes);
    if (normalized.notes && normalized.notes.length > NOTES_MAX_LENGTH) {
      details.push({ field: "notes", issue: "too_long" });
    }
  } else if (!partial) {
    normalized.notes = null;
  }

  if (normalized.hasStatus) {
    normalized.status = normalizeOptionalText(body.status);
    if (!VENDOR_STATUSES.has(normalized.status)) {
      details.push({ field: "status", issue: "invalid_status" });
    }
  }

  if (partial && details.length === 0 && !Object.keys(body).some((field) => VENDOR_INPUT_FIELDS.has(field))) {
    details.push({ field: "body", issue: "no_fields" });
  }

  if (details.length > 0) {
    throw validationError(details);
  }

  return normalized;
}

function vendorColumns() {
  return `
    id,
    workspace_id,
    name,
    normalized_name,
    category,
    contact_name,
    phone,
    email,
    website,
    notes,
    status,
    source_confidence,
    archived_at,
    created_at,
    updated_at
  `;
}

function mapVendorRow(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    normalizedName: row.normalized_name || null,
    category: row.category || null,
    contactName: row.contact_name || null,
    phone: row.phone || null,
    email: row.email || null,
    website: row.website || null,
    notes: row.notes || null,
    status: row.status,
    sourceConfidence: row.source_confidence || null,
    archivedAt: formatTimestamp(row.archived_at),
    createdAt: formatTimestamp(row.created_at),
    updatedAt: formatTimestamp(row.updated_at)
  };
}

function normalizeVendorName(value) {
  return normalizeOptionalText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
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

function normalizeEmail(value) {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return null;
  }
  const email = normalized.toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : false;
}

function normalizeWebsite(value) {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return null;
  }
  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : false;
  } catch {
    return false;
  }
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

function formatTimestamp(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
