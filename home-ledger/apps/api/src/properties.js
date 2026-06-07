import { apiError, validationError } from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME_MAX_LENGTH = 120;
const DISPLAY_ADDRESS_MAX_LENGTH = 500;
const NOTES_MAX_LENGTH = 5000;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const PROPERTY_INPUT_FIELDS = new Set([
  "name",
  "display_address",
  "purchase_date",
  "purchase_price_cents",
  "currency_code",
  "notes",
  "is_primary"
]);

const SORTS = {
  name_asc: "name ASC, id ASC",
  name_desc: "name DESC, id ASC",
  purchase_date_asc: "purchase_date ASC NULLS LAST, id ASC",
  purchase_date_desc: "purchase_date DESC NULLS LAST, id ASC",
  created_desc: "created_at DESC, id ASC",
  updated_desc: "updated_at DESC, id ASC"
};

export async function listProperties({ db, workspaceId, filters = {}, pagination = {}, sort }) {
  const query = buildListQuery({ workspaceId, filters, pagination, sort });
  const result = await db.query(query.sql, query.params);
  const totalCount = result.rows[0]?.total_count ? Number(result.rows[0].total_count) : 0;

  return {
    data: result.rows.map(mapPropertyRow),
    meta: {
      limit: query.limit,
      offset: query.offset,
      total_count: totalCount
    }
  };
}

export async function getPropertyById({ db, workspaceId, propertyId }) {
  validatePropertyId(propertyId);
  const result = await db.query(
    `
      -- getPropertyById
      SELECT ${propertyColumns()}
      FROM properties
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      LIMIT 1
    `,
    [workspaceId, propertyId]
  );

  return result.rows[0] ? mapPropertyRow(result.rows[0]) : null;
}

export async function createProperty({ db, workspaceId, input, actorUserId }) {
  const propertyInput = validatePropertyInput(input, { partial: false });

  return withTransaction(db, async (client) => {
    const activeCount = await countActiveProperties({ db: client, workspaceId });
    const shouldBePrimary = propertyInput.hasIsPrimary
      ? propertyInput.isPrimary
      : activeCount === 0;

    if (shouldBePrimary) {
      await clearPrimaryProperties({ db: client, workspaceId });
    }

    const result = await client.query(
      `
        -- createProperty
        INSERT INTO properties (
          workspace_id,
          name,
          display_address,
          purchase_date,
          purchase_price_cents,
          currency_code,
          notes,
          is_primary,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4::date, $5::bigint, $6, $7, $8, $9, $9)
        RETURNING ${propertyColumns()}
      `,
      [
        workspaceId,
        propertyInput.name,
        propertyInput.displayAddress,
        propertyInput.purchaseDate,
        propertyInput.purchasePriceCents,
        propertyInput.currencyCode,
        propertyInput.notes,
        shouldBePrimary,
        actorUserId
      ]
    );

    return mapPropertyRow(result.rows[0]);
  });
}

export async function updateProperty({ db, workspaceId, propertyId, input, actorUserId }) {
  validatePropertyId(propertyId);
  const propertyInput = validatePropertyInput(input, { partial: true });

  return withTransaction(db, async (client) => {
    if (propertyInput.hasIsPrimary && propertyInput.isPrimary) {
      await clearPrimaryProperties({ db: client, workspaceId, exceptPropertyId: propertyId });
    }

    const result = await client.query(
      `
        -- updateProperty
        UPDATE properties
        SET
          name = CASE WHEN $3::boolean THEN $4 ELSE name END,
          display_address = CASE WHEN $5::boolean THEN $6 ELSE display_address END,
          purchase_date = CASE WHEN $7::boolean THEN $8::date ELSE purchase_date END,
          purchase_price_cents = CASE WHEN $9::boolean THEN $10::bigint ELSE purchase_price_cents END,
          currency_code = CASE WHEN $11::boolean THEN $12 ELSE currency_code END,
          notes = CASE WHEN $13::boolean THEN $14 ELSE notes END,
          is_primary = CASE WHEN $15::boolean THEN $16 ELSE is_primary END,
          updated_by_user_id = $17,
          updated_at = now()
        WHERE workspace_id = $1
          AND id = $2
          AND deleted_at IS NULL
          AND archived_at IS NULL
        RETURNING ${propertyColumns()}
      `,
      [
        workspaceId,
        propertyId,
        propertyInput.hasName,
        propertyInput.name,
        propertyInput.hasDisplayAddress,
        propertyInput.displayAddress,
        propertyInput.hasPurchaseDate,
        propertyInput.purchaseDate,
        propertyInput.hasPurchasePriceCents,
        propertyInput.purchasePriceCents,
        propertyInput.hasCurrencyCode,
        propertyInput.currencyCode,
        propertyInput.hasNotes,
        propertyInput.notes,
        propertyInput.hasIsPrimary,
        propertyInput.isPrimary,
        actorUserId
      ]
    );

    return result.rows[0] ? mapPropertyRow(result.rows[0]) : null;
  });
}

export async function archiveProperty({ db, workspaceId, propertyId, actorUserId }) {
  validatePropertyId(propertyId);
  const result = await db.query(
    `
      -- archiveProperty
      UPDATE properties
      SET archived_at = now(),
          is_primary = false,
          updated_by_user_id = $3,
          updated_at = now()
      WHERE workspace_id = $1
        AND id = $2
        AND deleted_at IS NULL
        AND archived_at IS NULL
      RETURNING ${propertyColumns()}
    `,
    [workspaceId, propertyId, actorUserId]
  );

  return result.rows[0] ? mapPropertyRow(result.rows[0]) : null;
}

export function serializeProperty(property) {
  return {
    id: property.id,
    name: property.name,
    display_address: property.displayAddress,
    purchase_date: property.purchaseDate,
    purchase_price_cents: property.purchasePriceCents,
    currency_code: property.currencyCode,
    notes: property.notes,
    is_primary: property.isPrimary,
    archived_at: property.archivedAt,
    created_at: property.createdAt,
    updated_at: property.updatedAt
  };
}

export function validatePropertyId(propertyId) {
  if (!UUID_PATTERN.test(String(propertyId || ""))) {
    throw apiError(400, "invalid_request", "Invalid property id.");
  }
  return propertyId;
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

  if (filters.is_primary !== undefined) {
    params.push(parseBoolean(filters.is_primary));
    where.push(`is_primary = $${params.length}`);
  }

  const q = normalizeOptionalText(filters.q);
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    where.push(`(name ILIKE $${params.length} OR display_address ILIKE $${params.length})`);
  }

  const limit = parseLimit(pagination.limit);
  const offset = parseOffset(pagination.offset);
  params.push(limit, offset);

  const orderBy = SORTS[sort] || SORTS.name_asc;

  return {
    sql: `
      -- listProperties
      SELECT ${propertyColumns()}, count(*) OVER() AS total_count
      FROM properties
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

function validatePropertyInput(input, { partial }) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const details = [];
  for (const field of Object.keys(body)) {
    if (!PROPERTY_INPUT_FIELDS.has(field)) {
      details.push({ field, issue: "unknown_field" });
    }
  }

  const normalized = {
    hasName: Object.hasOwn(body, "name"),
    name: undefined,
    hasDisplayAddress: Object.hasOwn(body, "display_address"),
    displayAddress: undefined,
    hasPurchaseDate: Object.hasOwn(body, "purchase_date"),
    purchaseDate: undefined,
    hasPurchasePriceCents: Object.hasOwn(body, "purchase_price_cents"),
    purchasePriceCents: undefined,
    hasCurrencyCode: Object.hasOwn(body, "currency_code"),
    currencyCode: "USD",
    hasNotes: Object.hasOwn(body, "notes"),
    notes: undefined,
    hasIsPrimary: Object.hasOwn(body, "is_primary"),
    isPrimary: undefined
  };

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

  if (normalized.hasDisplayAddress) {
    normalized.displayAddress = normalizeNullableText(body.display_address);
    if (normalized.displayAddress && normalized.displayAddress.length > DISPLAY_ADDRESS_MAX_LENGTH) {
      details.push({ field: "display_address", issue: "too_long" });
    }
  } else if (!partial) {
    normalized.displayAddress = null;
  }

  if (normalized.hasPurchaseDate) {
    normalized.purchaseDate = normalizeDate(body.purchase_date);
    if (normalized.purchaseDate === false) {
      details.push({ field: "purchase_date", issue: "invalid_date" });
      normalized.purchaseDate = undefined;
    }
  } else if (!partial) {
    normalized.purchaseDate = null;
  }

  if (normalized.hasPurchasePriceCents) {
    normalized.purchasePriceCents = normalizeNullableInteger(body.purchase_price_cents);
    if (normalized.purchasePriceCents === false) {
      details.push({ field: "purchase_price_cents", issue: "must_be_integer" });
      normalized.purchasePriceCents = undefined;
    } else if (normalized.purchasePriceCents !== null && normalized.purchasePriceCents < 0) {
      details.push({ field: "purchase_price_cents", issue: "must_be_nonnegative" });
    }
  } else if (!partial) {
    normalized.purchasePriceCents = null;
  }

  if (normalized.hasCurrencyCode) {
    normalized.currencyCode = normalizeCurrencyCode(body.currency_code);
    if (!normalized.currencyCode) {
      details.push({ field: "currency_code", issue: "invalid_currency" });
      normalized.currencyCode = undefined;
    }
  }

  if (normalized.hasNotes) {
    normalized.notes = normalizeNullableText(body.notes);
    if (normalized.notes && normalized.notes.length > NOTES_MAX_LENGTH) {
      details.push({ field: "notes", issue: "too_long" });
    }
  } else if (!partial) {
    normalized.notes = null;
  }

  if (normalized.hasIsPrimary) {
    if (typeof body.is_primary !== "boolean") {
      details.push({ field: "is_primary", issue: "must_be_boolean" });
    } else {
      normalized.isPrimary = body.is_primary;
    }
  } else if (!partial) {
    normalized.isPrimary = undefined;
  }

  if (partial && details.length === 0 && !Object.keys(body).some((field) => PROPERTY_INPUT_FIELDS.has(field))) {
    details.push({ field: "body", issue: "no_fields" });
  }

  if (details.length > 0) {
    throw validationError(details);
  }

  return normalized;
}

async function countActiveProperties({ db, workspaceId }) {
  const result = await db.query(
    `
      -- countActiveProperties
      SELECT count(*)::int AS count
      FROM properties
      WHERE workspace_id = $1
        AND deleted_at IS NULL
        AND archived_at IS NULL
    `,
    [workspaceId]
  );
  return Number(result.rows[0]?.count || 0);
}

async function clearPrimaryProperties({ db, workspaceId, exceptPropertyId }) {
  await db.query(
    `
      -- clearPrimaryProperties
      UPDATE properties
      SET is_primary = false,
          updated_at = now()
      WHERE workspace_id = $1
        AND deleted_at IS NULL
        AND archived_at IS NULL
        AND is_primary = true
        AND ($2::uuid IS NULL OR id <> $2::uuid)
    `,
    [workspaceId, exceptPropertyId || null]
  );
}

function propertyColumns() {
  return `
    id,
    workspace_id,
    name,
    display_address,
    purchase_date,
    purchase_price_cents,
    currency_code,
    notes,
    is_primary,
    archived_at,
    created_at,
    updated_at
  `;
}

function mapPropertyRow(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    displayAddress: row.display_address || null,
    purchaseDate: formatDateOnly(row.purchase_date),
    purchasePriceCents: row.purchase_price_cents === null || row.purchase_price_cents === undefined
      ? null
      : Number(row.purchase_price_cents),
    currencyCode: row.currency_code,
    notes: row.notes || null,
    isPrimary: row.is_primary === true,
    archivedAt: formatTimestamp(row.archived_at),
    createdAt: formatTimestamp(row.created_at),
    updatedAt: formatTimestamp(row.updated_at)
  };
}

async function withTransaction(db, callback) {
  const client = typeof db.connect === "function" ? await db.connect() : db;

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    if (client !== db && typeof client.release === "function") {
      client.release();
    }
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

function normalizeNullableInteger(value) {
  if (value === null || value === "") {
    return null;
  }
  if (!Number.isSafeInteger(value)) {
    return false;
  }
  return value;
}

function normalizeCurrencyCode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "";
}

function normalizeDate(value) {
  if (value === null || value === "") {
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
